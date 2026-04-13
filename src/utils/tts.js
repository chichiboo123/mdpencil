class TtsController {
  constructor() {
    this.utterance = null;
    this.isPaused = false;
    this.isSpeaking = false;
    this.rate = 1.0;
    this.onStateChange = null;
  }

  get supported() {
    return 'speechSynthesis' in window;
  }

  play(text, lang = 'ko') {
    if (!this.supported || !text) return false;

    this.stop();

    const langMap = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = langMap[lang] || 'ko-KR';
    this.utterance.rate = this.rate;

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
      this.onStateChange({
        isSpeaking: this.isSpeaking,
        isPaused: this.isPaused,
      });
    }
  }
}

export const ttsController = new TtsController();
