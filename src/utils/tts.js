const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

class TtsController {
  constructor() {
    this.utterance = null;
    this.isPaused = false;
    this.isSpeaking = false;
    this.rate = 1.0;
    this.selectedVoice = null;
    this.onStateChange = null;
  }

  get supported() {
    return 'speechSynthesis' in window;
  }

  getVoices(lang) {
    if (!this.supported) return [];
    const locale = LANG_MAP[lang] || 'ko-KR';
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith(locale.split('-')[0]));
  }

  setVoice(voice) {
    this.selectedVoice = voice;
  }

  play(text, lang = 'ko') {
    if (!this.supported || !text) return false;
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang = LANG_MAP[lang] || 'ko-KR';
    this.utterance.rate = this.rate;
    if (this.selectedVoice) this.utterance.voice = this.selectedVoice;

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

/**
 * Record TTS audio by capturing the current tab's audio via getDisplayMedia.
 * Works in Chromium browsers (Chrome, Edge). Returns a Blob.
 */
export async function recordTtsAudio(text, lang, rate, voice) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('not_supported');
  }

  // Request tab audio capture
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  });

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('no_audio');
  }

  const audioStream = new MediaStream(audioTracks);
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  const recorder = new MediaRecorder(audioStream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (chunks.length === 0) {
        reject(new Error('no_data'));
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    recorder.start(100);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_MAP[lang] || 'ko-KR';
    utterance.rate = rate;
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 400);
    };

    utterance.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (recorder.state === 'recording') recorder.stop();
      reject(new Error('tts_error'));
    };

    window.speechSynthesis.speak(utterance);
  });
}
