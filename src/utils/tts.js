const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

class TtsController {
  constructor() {
    this.utterance = null;
    this.isPaused = false;
    this.isSpeaking = false;
    this.rate = 1.0;
    this.gender = ''; // '', 'female', 'male'
    this.onStateChange = null;
  }

  get supported() {
    return 'speechSynthesis' in window;
  }

  setGender(gender) {
    this.gender = gender || '';
  }

  play(text, lang = 'ko') {
    if (!this.supported || !text) return false;
    this.stop();

    const locale = LANG_MAP[lang] || 'ko-KR';

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = locale;
    this.utterance.rate = this.rate;

    // pitch로 여성/남성 구분 (음성이 1개뿐인 기기에서도 동작)
    if (this.gender === 'female') {
      this.utterance.pitch = 1.2;
    } else if (this.gender === 'male') {
      this.utterance.pitch = 0.7;
    } else {
      this.utterance.pitch = 1.0;
    }

    // 해당 언어의 음성이 있으면 첫 번째 것을 사용
    const voices = window.speechSynthesis.getVoices();
    const prefix = locale.split('-')[0];
    const langVoices = voices.filter((v) => v.lang.startsWith(prefix));
    if (langVoices.length > 0) {
      this.utterance.voice = langVoices[0];
    }

    this.utterance.onstart = () => {
      this.isSpeaking = true;
      this.isPaused = false;
      this._notify();
    };
    this.utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this._notify();
    };
    this.utterance.onerror = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this._notify();
    };

    window.speechSynthesis.speak(this.utterance);
    this.isSpeaking = true;
    this._notify();
    return true;
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
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this.utterance = null;
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
