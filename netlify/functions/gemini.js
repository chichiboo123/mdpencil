/**
 * 몽당(MD)연필 — Gemini OCR 교정 프록시 (Netlify Functions)
 *
 * 역할: 프런트엔드는 API 키를 가질 수 없다. 이 함수가 Netlify 환경변수에
 * 보관된 GEMINI_API_KEY로 Google AI Studio(Generative Language API)를
 * 대신 호출하고, 교정된 Markdown만 돌려준다.
 *
 * 배포 후 호출 주소:
 *   https://<your-site>.netlify.app/.netlify/functions/gemini
 *
 * Netlify 환경변수(Site settings → Environment variables):
 *   - GEMINI_API_KEY  (필수)  : https://aistudio.google.com 에서 발급
 *   - ALLOWED_ORIGIN  (선택, 기본 '*') : 허용할 사이트 origin
 *        예) https://chichiboo123.github.io   또는 본인 Netlify 주소
 *   - GEMINI_MODEL    (선택, 기본 'gemini-2.5-flash')
 *
 * 계약(contract):
 *   POST  { text: string, lang?: 'ko'|'en'|'ja' }  →  200 { text: string }
 */

const DEFAULT_MODEL = 'gemini-2.5-flash';

const LANG_NAME = {
  ko: 'Korean (한국어)',
  en: 'English',
  ja: 'Japanese (日本語)',
};

function buildPrompt(lang) {
  const primary = LANG_NAME[lang] || 'the original language';
  return [
    'You are an OCR post-correction assistant for a Markdown converter.',
    `The input below is Markdown text produced by an OCR engine from an image. Its primary language is ${primary}, but it may contain mixed languages (Korean, English, Japanese, numbers, symbols).`,
    '',
    'Fix ONLY OCR errors. Specifically:',
    '1. Correct misrecognized characters and words, including English words that were garbled or split.',
    '2. Restore natural word spacing. For Korean, fix incorrect 띄어쓰기 (e.g. join wrongly split syllables like "교 육 과정" → "교육과정"). For English, use single spaces between words.',
    '3. Preserve the original layout as closely as possible: keep line breaks, paragraph breaks (blank lines), and the reading order from the source.',
    '4. Keep existing Markdown structure (headings #/##, lists -/1., **bold**). Do not invent new structure that was not implied by the text.',
    '',
    'STRICT RULES:',
    '- Do NOT add, remove, summarize, translate, or explain any content. Only correct what is clearly an OCR mistake.',
    '- If text is genuinely ambiguous, keep it as-is rather than guessing wildly.',
    '- Output ONLY the corrected Markdown. No code fences, no commentary, no preamble.',
    '',
    '--- OCR TEXT START ---',
  ].join('\n');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body, statusCode, origin) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    body: JSON.stringify(body),
  };
}

export async function handler(event) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(allowed), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, allowed);
  }
  if (!process.env.GEMINI_API_KEY) {
    return json({ error: 'Server is missing GEMINI_API_KEY' }, 500, allowed);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, allowed);
  }

  const text = typeof payload?.text === 'string' ? payload.text : '';
  const lang = payload?.lang;
  if (!text.trim()) {
    return json({ error: 'Empty text' }, 400, allowed);
  }
  // 무료 티어 보호를 위한 입력 길이 상한 (대략 12k자)
  if (text.length > 12000) {
    return json({ error: 'Text too long' }, 413, allowed);
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${buildPrompt(lang)}\n${text}\n--- OCR TEXT END ---` }],
      },
    ],
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
  const parts = data?.candidates?.[0]?.content?.parts;
  const corrected = Array.isArray(parts)
    ? parts.map((p) => p?.text || '').join('').trim()
    : '';

  if (!corrected) {
    return json({ error: 'Empty response from Gemini' }, 502, allowed);
  }

  return json({ text: corrected }, 200, allowed);
}
