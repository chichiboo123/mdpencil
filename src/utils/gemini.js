/**
 * Gemini(Google AI Studio) 기반 OCR 결과 교정 유틸.
 *
 * 보안 설계: API 키는 절대 프런트엔드에 두지 않는다. 이 앱은 GitHub Pages
 * 정적 호스팅이므로, 키는 사용자가 직접 배포하는 서버리스 프록시(Cloudflare
 * Worker 등) 안의 비밀(secret)에만 보관한다. 프런트엔드는 그 프록시 URL만
 * 알면 되고, 그 값은 브라우저 localStorage(또는 빌드 시 환경변수)에 저장한다.
 *
 * 프록시 계약(contract):
 *   POST <proxyUrl>  { text: string, lang: 'ko'|'en'|'ja' }
 *   → 200 { text: string }   (교정된 Markdown)
 *   → 그 외 상태코드는 오류로 간주
 */

const PROXY_URL_KEY = 'mdpencil:geminiProxyUrl';
const ENABLED_KEY = 'mdpencil:aiCorrectEnabled';

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
  const env = (import.meta.env.VITE_GEMINI_PROXY_URL || '').trim();
  return env;
}

export function setProxyUrl(url) {
  writeLocal(PROXY_URL_KEY, (url || '').trim());
}

/** 사용자가 AI 교정을 켰는지 여부. */
export function isAiCorrectEnabled() {
  return readLocal(ENABLED_KEY) === '1';
}

export function setAiCorrectEnabled(enabled) {
  writeLocal(ENABLED_KEY, enabled ? '1' : '');
}

/** 교정 기능을 실제로 쓸 수 있는 상태인지(켜짐 + URL 설정됨). */
export function canCorrect() {
  return isAiCorrectEnabled() && !!getProxyUrl();
}

/**
 * OCR로 얻은 Markdown을 Gemini 프록시로 보내 교정본을 받는다.
 * 실패 시 예외를 던지므로, 호출부는 원본으로 폴백해야 한다.
 *
 * @param {string} markdown OCR 결과 Markdown
 * @param {'ko'|'en'|'ja'} lang 주 언어 힌트
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<string>} 교정된 Markdown
 */
export async function correctMarkdown(markdown, lang = 'ko', opts = {}) {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) throw new Error('gemini: proxy URL not configured');
  if (!markdown || !markdown.trim()) return markdown;

  const { timeoutMs = 45000, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // 외부 취소 신호(예: 작업 취소)와 연동
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: markdown, lang }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`gemini: proxy responded ${res.status}`);
    }
    const data = await res.json();
    const out = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!out) throw new Error('gemini: empty response');
    return out;
  } finally {
    clearTimeout(timer);
  }
}
