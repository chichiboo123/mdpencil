const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

/**
 * 음성 목록을 비동기로 로드한다.
 * Chrome 등 일부 브라우저는 getVoices()가 처음엔 빈 배열을 반환하고
 * voiceschanged 이벤트 이후에 채워진다.
 */
function loadVoices() {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = finish;
    // 일부 브라우저는 voiceschanged를 발생시키지 않으므로 폴백
    setTimeout(finish, 1000);
  });
}

/**
 * 긴 텍스트를 문장 단위로 분할한다.
 * Chrome의 ~15초 발화 후 끊김 버그를 회피하기 위함.
 */
function chunkText(text, maxLen = 180) {
  const sentences = text
    .replace(/\n+/g, ' ')
    .match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [text];

  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

class TtsController {
  constructor() {
    this.isPaused = false;
    this.isSpeaking = false;
    this.rate = 1.0;
    this.onStateChange = null;
    this._queue = [];
    this._index = 0;
    this._voice = null;
    this._locale = 'ko-KR';
    this._token = 0;
  }

  get supported() {
    return 'speechSynthesis' in window;
  }

  async play(text, lang = 'ko') {
    if (!this.supported || !text) return false;
    this.stop();

    const token = ++this._token;
    this._locale = LANG_MAP[lang] || 'ko-KR';

    const voices = await loadVoices();
    // 사용자가 그 사이 정지했다면 중단
    if (token !== this._token) return false;

    const prefix = this._locale.split('-')[0];
    const langVoices = voices.filter((v) => v.lang.startsWith(prefix));
    this._voice = langVoices[0] || null;

    this._queue = chunkText(text);
    this._index = 0;
    this.isSpeaking = true;
    this.isPaused = false;
    this._notify();
    this._speakNext(token);
    return true;
  }

  _speakNext(token) {
    if (token !== this._token) return;
    if (this._index >= this._queue.length) {
      this.isSpeaking = false;
      this.isPaused = false;
      this._notify();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(this._queue[this._index]);
    utterance.lang = this._locale;
    utterance.rate = this.rate;
    utterance.pitch = 1.0;
    if (this._voice) utterance.voice = this._voice;

    utterance.onend = () => {
      if (token !== this._token) return;
      this._index += 1;
      this._speakNext(token);
    };
    utterance.onerror = () => {
      if (token !== this._token) return;
      // 한 청크 오류 시 다음으로 진행
      this._index += 1;
      this._speakNext(token);
    };

    window.speechSynthesis.speak(utterance);
  }

  pause() {
    if (!this.supported || !this.isSpeaking) return;
    window.speechSynthesis.pause();
    this.isPaused = true;
    this._notify();
  }

  resume() {
    if (!this.supported || !this.isPaused) return;
    window.speechSynthesis.resume();
    this.isPaused = false;
    this._notify();
  }

  stop() {
    if (!this.supported) return;
    this._token += 1; // 진행 중인 큐 무효화
    this._queue = [];
    this._index = 0;
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this._notify();
  }

  setRate(rate) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  _notify() {
    if (this.onStateChange) {
      this.onStateChange({ isSpeaking: this.isSpeaking, isPaused: this.isPaused });
    }
  }
}

export const ttsController = new TtsController();
