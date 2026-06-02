/**
 * 몽당(MD)연필 — Gemini OCR 교정 프록시 (Cloudflare Worker)
 *
 * 역할: 프런트엔드는 API 키를 가질 수 없다. 이 Worker가 비밀(secret)로 보관된
 * GEMINI_API_KEY로 Google AI Studio(Generative Language API)를 대신 호출하고,
 * 교정된 Markdown만 돌려준다. 원본 이미지를 함께 받으면 이미지와 OCR 텍스트를
 * 대조하여 교정한다(멀티모달).
 *
 * Worker Variables & Secrets:
 *   - GEMINI_API_KEY  (필수, secret) : https://aistudio.google.com 에서 발급
 *   - AI_PASSWORD     (선택, 권장)    : 설정 시 요청의 password 와 일치해야 동작
 *   - ALLOWED_ORIGIN  (선택, 기본 '*')
 *   - GEMINI_MODEL    (선택) : 1순위 모델만 덮어쓰기(하위호환)
 *   - GEMINI_MODELS   (선택) : 폴백 우선순위 체인을 쉼표로 직접 지정
 *                              예) "gemini-2.5-flash,gemini-3.1-flash-lite,gemini-3.5-flash"
 *
 * 계약(contract):
 *   POST { text, lang?, image?: { mimeType, data(base64) }, password? }
 *     → 200 { text, model }   401(비밀번호 불일치)   4xx/5xx { error }
 *       (model: 실제로 응답을 생성한 모델 ID — 프런트의 "배터리" 표시에 사용)
 */

/**
 * 다중 모델 폴백(Fallback) 우선순위 체인.
 *
 * 무료 티어 한도(429 / Quota Exceeded)에 걸리면 위에서 아래 순서로
 * 자동 전환한다. 기본값은 "지금 바로 동작하는" 안정적인 무료 모델들로
 * 구성했다. 사용자가 원하는 체인(예: gemini-3.1-flash-lite, gemini-3.5-flash 등)이
 * 있으면 GEMINI_MODELS 환경변수로 자유롭게 바꿀 수 있고, 존재하지 않는
 * 모델 ID는 호출 시 404가 떨어지므로 자동으로 다음 순위로 건너뛴다.
 */
const DEFAULT_MODELS = [
  'gemini-2.5-flash', // 1순위: 기본 모델
  'gemini-2.5-flash-lite', // 2순위: 더 가벼운 무료 모델(쿼터가 분리되어 여유가 있음)
  'gemini-2.0-flash', // 3순위: 이전 세대 무료 모델
  'gemini-2.0-flash-lite', // 4순위: 최후의 경량 폴백
];

/**
 * 모델 이름을 API용 ID로 정규화한다.
 * "Gemini 2.5 Flash Lite" 같은 표시용 이름도 "gemini-2.5-flash-lite" 로 변환된다.
 */
function normalizeModelId(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * 환경변수를 반영해 최종 폴백 체인을 만든다.
 * - GEMINI_MODELS(쉼표 구분)가 있으면 그것을 그대로 우선순위로 사용.
 * - 없으면 DEFAULT_MODELS 사용.
 * - GEMINI_MODEL(단일)이 있으면 그 모델을 항상 1순위로 끌어올린다(하위호환).
 * - 중복은 제거하되 순서는 유지한다.
 */
function getModelChain(env) {
  const raw = (env.GEMINI_MODELS || '').trim();
  let chain = raw ? raw.split(',').map(normalizeModelId).filter(Boolean) : [...DEFAULT_MODELS];

  const single = normalizeModelId(env.GEMINI_MODEL);
  if (single) chain = [single, ...chain.filter((m) => m !== single)];

  return [...new Set(chain)];
}

/**
 * 한도 초과(Rate Limit / Quota) 오류인지 판별한다.
 * 429는 물론, 일부 쿼터 소진은 403 RESOURCE_EXHAUSTED 로도 내려온다.
 */
function isRateLimit(status, detail) {
  if (status === 429) return true;
  if (status === 403 && /quota|rate|resource[_\s-]?exhausted/i.test(detail || '')) return true;
  return false;
}

/**
 * 폴백 체인을 따라 순서대로 generateContent를 호출하는 재사용 함수.
 *
 * 동작:
 *   1) 1순위 모델로 호출 → 성공하면 { text, model } 즉시 반환.
 *   2) 한도 초과(429/403-quota) 또는 모델 사용 불가(404)·일시 오류(5xx)·
 *      네트워크 오류·빈 응답이면 콘솔에 경고를 남기고 다음 순위로 재시도.
 *   3) 그 외 명백한 클라이언트 오류(400 등)는 재시도해도 똑같이 실패하므로
 *      즉시 중단하고 해당 오류를 던진다.
 *   4) 모든 모델이 실패하면 마지막 오류 정보를 담아 예외를 던진다.
 *
 * @returns {Promise<{ text: string, model: string }>}
 */
async function generateContentWithFallback({ apiKey, models, requestBody }) {
  let last = null; // 마지막으로 만난 오류 정보

  for (const model of models) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // --- 1) 모델 호출 (네트워크 오류는 다음 모델로 폴백) ---
    let res;
    try {
      res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (e) {
      console.warn(`[gemini-fallback] ${model} fetch 실패: ${e.message} → 다음 모델 시도`);
      last = { status: 502, detail: e.message, model };
      continue;
    }

    // --- 2) 성공 응답 처리 ---
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const outParts = data?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(outParts)
        ? outParts.map((p) => p?.text || '').join('').trim()
        : '';
      if (text) {
        console.info(`[gemini-fallback] ${model} 응답 성공`);
        return { text, model };
      }
      // 200이지만 본문이 비어 있으면 다음 모델로
      console.warn(`[gemini-fallback] ${model} 빈 응답 → 다음 모델 시도`);
      last = { status: 502, detail: 'empty response', model };
      continue;
    }

    // --- 3) 오류 응답 분기 ---
    const detail = await res.text().catch(() => '');
    last = { status: res.status, detail, model };

    if (isRateLimit(res.status, detail)) {
      console.warn(`[gemini-fallback] ${model} 한도 초과(${res.status}) → 다음 모델로 폴백`);
      continue;
    }
    if (res.status === 404) {
      console.warn(`[gemini-fallback] ${model} 사용 불가(404) → 다음 모델로 폴백`);
      continue;
    }
    if (res.status >= 500) {
      console.warn(`[gemini-fallback] ${model} 일시 오류(${res.status}) → 다음 모델로 폴백`);
      continue;
    }

    // 그 외 클라이언트 오류(예: 400)는 모델을 바꿔도 동일하게 실패하므로 즉시 중단
    console.warn(`[gemini-fallback] ${model} 오류(${res.status}) — 폴백 불가, 중단`);
    break;
  }

  // 모든 모델 실패
  const e = new Error(last?.detail ? String(last.detail).slice(0, 500) : 'all models failed');
  e.status = last?.status || 502;
  e.lastModel = last?.model;
  throw e;
}

const LANG_NAME = {
  ko: 'Korean (한국어)',
  en: 'English',
  ja: 'Japanese (日本語)',
};

function buildPrompt(lang, hasImage) {
  const primary = LANG_NAME[lang] || 'the original language';
  const lines = [
    'You are an OCR proofreading assistant for a Markdown converter.',
    hasImage
      ? `You are given (1) the SOURCE IMAGE and (2) the Markdown that an OCR engine produced from that image. The primary language is ${primary}, but it may mix Korean, English, Japanese, numbers and symbols.`
      : `The input below is Markdown produced by an OCR engine. The primary language is ${primary}, but it may mix Korean, English, Japanese, numbers and symbols.`,
    '',
    hasImage
      ? 'Carefully compare the Markdown against the SOURCE IMAGE and fix OCR mistakes:'
      : 'Fix ONLY clear OCR mistakes:',
    '1. Correct misread characters and words, including garbled or split English/Japanese words.',
    '2. Restore natural spacing. For Korean fix wrong 띄어쓰기 (e.g. "교 육 과정" → "교육과정"). For English use single spaces.',
    '3. Reproduce the layout faithfully: keep line breaks, paragraph breaks (blank lines) and reading order as in the source.',
    '4. Keep Markdown structure (headings #/##, lists -/1., **bold**) consistent with how the text actually appears.',
    '',
    'STRICT RULES:',
    '- Do NOT add, remove, summarize, translate or explain content. Only correct OCR errors.',
    '- If something is genuinely ambiguous, keep it rather than guessing wildly.',
    '- Output ONLY the corrected Markdown. No code fences, no commentary, no preamble.',
    '',
    '--- OCR MARKDOWN START ---',
  ];
  return lines.join('\n');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allowed) });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, allowed);
    }
    if (!env.GEMINI_API_KEY) {
      return json({ error: 'Server is missing GEMINI_API_KEY' }, 500, allowed);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400, allowed);
    }

    // 비밀번호 게이트: AI_PASSWORD가 설정되어 있으면 반드시 일치해야 함
    if (env.AI_PASSWORD && payload?.password !== env.AI_PASSWORD) {
      return json({ error: 'Invalid password' }, 401, allowed);
    }

    const text = typeof payload?.text === 'string' ? payload.text : '';
    const lang = payload?.lang;
    const image = payload?.image;
    if (!text.trim()) {
      return json({ error: 'Empty text' }, 400, allowed);
    }
    if (text.length > 12000) {
      return json({ error: 'Text too long' }, 413, allowed);
    }

    const hasImage = !!(image && image.mimeType && image.data);

    const parts = [{ text: `${buildPrompt(lang, hasImage)}\n${text}\n--- OCR MARKDOWN END ---` }];
    if (hasImage) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, topP: 0.9, maxOutputTokens: 8192 },
    };

    // 폴백 체인을 따라 호출. 한 모델이 한도 초과여도 자동으로 다음 모델로 넘어간다.
    const models = getModelChain(env);
    try {
      const { text: corrected, model: usedModel } = await generateContentWithFallback({
        apiKey: env.GEMINI_API_KEY,
        models,
        requestBody,
      });
      // 어떤 모델이 응답했는지 함께 돌려준다(프런트의 모델 표시 UI용).
      return json({ text: corrected, model: usedModel }, 200, allowed);
    } catch (e) {
      // 모든 모델이 실패한 경우에만 여기 도달한다.
      return json(
        {
          error: 'All Gemini models failed',
          detail: String(e.message || '').slice(0, 500),
          lastModel: e.lastModel,
        },
        e.status === 429 ? 429 : 502,
        allowed,
      );
    }
  },
};
