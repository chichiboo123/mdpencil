/**
 * Gemini(Google AI Studio) 기반 OCR 결과 교정 유틸.
 *
 * 보안 설계: API 키는 절대 프런트엔드에 두지 않는다. 이 앱은 정적 호스팅이므로
 * 키는 사용자가 배포하는 서버리스 프록시(Netlify Functions / Cloudflare Worker)
 * 안의 환경변수에만 보관한다. 프런트엔드는 그 프록시 URL과, 프록시 접근용
 * 비밀번호만 알면 된다(둘 다 브라우저 localStorage에 저장).
 *
 * 프록시 계약(contract):
 *   POST <proxyUrl>
 *     { text: string, lang: 'ko'|'en'|'ja',
 *       image?: { mimeType: string, data: string(base64) },
 *       password?: string }
 *   → 200 { text: string }     (교정된 Markdown)
 *   → 401                       (비밀번호 불일치)
 *   → 그 외 상태코드            (오류)
 */

const PROXY_URL_KEY = 'mdpencil:geminiProxyUrl';
const ENABLED_KEY = 'mdpencil:aiCorrectEnabled';
const PASSWORD_KEY = 'mdpencil:aiPassword';

function readLocal(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    if (value == null || value === '') localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* localStorage 비활성 환경(시크릿 모드 등)은 조용히 무시 */
  }
}

/** 설정된 프록시 URL을 반환한다. localStorage 우선, 없으면 빌드 환경변수. */
export function getProxyUrl() {
  const stored = readLocal(PROXY_URL_KEY);
  if (stored && stored.trim()) return stored.trim();
  return (import.meta.env.VITE_GEMINI_PROXY_URL || '').trim();
}

export function setProxyUrl(url) {
  writeLocal(PROXY_URL_KEY, (url || '').trim());
}

/** 사용자가 AI 교정 기능을 켰는지 여부. */
export function isAiCorrectEnabled() {
  return readLocal(ENABLED_KEY) === '1';
}

export function setAiCorrectEnabled(enabled) {
  writeLocal(ENABLED_KEY, enabled ? '1' : '');
}

/** 프록시 접근 비밀번호 (localStorage). */
export function getPassword() {
  return readLocal(PASSWORD_KEY) || '';
}

export function setPassword(pw) {
  writeLocal(PASSWORD_KEY, (pw || '').trim());
}

export function hasPassword() {
  return !!getPassword();
}

export function clearPassword() {
  writeLocal(PASSWORD_KEY, '');
}

/** AI 교정 버튼을 노출할 조건: 기능이 켜져 있고 프록시 URL이 설정됨. */
export function canCorrect() {
  return isAiCorrectEnabled() && !!getProxyUrl();
}

/**
 * 이미지(URL/dataURL/objectURL)를 Gemini inlineData 형식(base64 JPEG)으로
 * 변환한다. 전송량과 무료 티어 보호를 위해 긴 변을 maxDim으로 축소한다.
 */
export function imageToInlineData(src, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ mimeType: 'image/jpeg', data: dataUrl.split(',')[1] });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/** 프록시 오류를 구분하기 위한 에러 코드 부착 헬퍼 */
function err(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

/**
 * OCR Markdown을 Gemini 프록시로 보내 교정본을 받는다.
 * 원본 이미지를 함께 보내면 Gemini가 이미지와 대조하여 교정한다.
 * 실패 시 예외를 던지므로 호출부는 원본으로 폴백해야 한다.
 *
 * @param {string} markdown OCR 결과 Markdown
 * @param {'ko'|'en'|'ja'} lang 주 언어 힌트
 * @param {{ image?: {mimeType:string,data:string}, timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<string>} 교정된 Markdown
 */
export async function correctMarkdown(markdown, lang = 'ko', opts = {}) {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) throw err('proxy URL not configured', 'no-config');
  if (!markdown || !markdown.trim()) return markdown;

  const { image, timeoutMs = 60000, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: markdown, lang, image, password: getPassword() }),
      signal: controller.signal,
    });
    if (res.status === 401) throw err('unauthorized', 'auth');
    if (res.status === 404) throw err('proxy not found (404)', 'not-found');
    if (!res.ok) throw err(`proxy responded ${res.status}`, 'http');
    const data = await res.json();
    const out = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!out) throw err('empty response', 'empty');
    return out;
  } finally {
    clearTimeout(timer);
  }
}
