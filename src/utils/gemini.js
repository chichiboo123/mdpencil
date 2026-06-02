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
const LAST_MODEL_KEY = 'mdpencil:lastModel';

/** 모델 변경을 UI(배터리 표시)에 알리기 위한 커스텀 이벤트 이름. */
export const MODEL_CHANGE_EVENT = 'mdpencil:modelchange';

/**
 * 프록시의 폴백 우선순위와 동일한 순서(프런트 표시용).
 * 배터리 잔량 = 이 목록에서의 위치로 계산한다(앞일수록 가득 참 = 여유 있음).
 * 프록시에서 GEMINI_MODELS 를 바꿔 목록에 없는 모델이 와도, UI는
 * "알 수 없음 = 최하위"로 처리하므로 깨지지 않는다.
 */
export const MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

/** 모델 ID → 사람이 읽기 좋은 표시 이름. 목록에 없으면 ID를 그대로 보여준다. */
export const MODEL_LABELS = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
};

export function modelLabel(model) {
  if (!model) return '';
  return MODEL_LABELS[model] || model;
}

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

/** 마지막으로 실제 응답을 생성한 모델 ID(배터리 표시용). */
export function getLastModel() {
  return readLocal(LAST_MODEL_KEY) || '';
}

/**
 * 마지막 사용 모델을 저장하고, UI가 즉시 갱신되도록 커스텀 이벤트를 쏜다.
 * (localStorage 'storage' 이벤트는 같은 탭에서는 발생하지 않으므로 직접 dispatch.)
 */
function setLastModel(model) {
  writeLocal(LAST_MODEL_KEY, model || '');
  try {
    window.dispatchEvent(new CustomEvent(MODEL_CHANGE_EVENT, { detail: model || '' }));
  } catch {
    /* 비브라우저 환경 무시 */
  }
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
 * @returns {Promise<{ text: string, model: string }>} 교정된 Markdown과 응답 모델 ID
 */
export async function correctMarkdown(markdown, lang = 'ko', opts = {}) {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) throw err('proxy URL not configured', 'no-config');
  if (!markdown || !markdown.trim()) return { text: markdown, model: getLastModel() };

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
    // 프록시가 알려준 "실제 응답 모델"을 저장해 배터리 표시에 반영한다.
    const model = typeof data?.model === 'string' ? data.model : '';
    setLastModel(model);
    return { text: out, model };
  } finally {
    clearTimeout(timer);
  }
}
