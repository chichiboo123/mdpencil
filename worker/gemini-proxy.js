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
 *   - GEMINI_MODEL    (선택, 기본 'gemini-2.5-flash')
 *
 * 계약(contract):
 *   POST { text, lang?, image?: { mimeType, data(base64) }, password? }
 *     → 200 { text }   401(비밀번호 불일치)   4xx/5xx { error }
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';

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

    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const requestBody = {
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.1, topP: 0.9, maxOutputTokens: 8192 },
    };

    let geminiRes;
    try {
      geminiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (e) {
      return json({ error: `Upstream fetch failed: ${e.message}` }, 502, allowed);
    }

    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      return json(
        { error: `Gemini API error ${geminiRes.status}`, detail: detail.slice(0, 500) },
        geminiRes.status === 429 ? 429 : 502,
        allowed,
      );
    }

    const data = await geminiRes.json().catch(() => null);
    const outParts = data?.candidates?.[0]?.content?.parts;
    const corrected = Array.isArray(outParts)
      ? outParts.map((p) => p?.text || '').join('').trim()
      : '';

    if (!corrected) {
      return json({ error: 'Empty response from Gemini' }, 502, allowed);
    }

    return json({ text: corrected }, 200, allowed);
  },
};
