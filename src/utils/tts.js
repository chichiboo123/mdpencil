const LANG_MAP = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

// 성별 판별을 위한 알려진 음성 이름 패턴
const FEMALE_HINTS = [
  /female/i, /여성/i, /woman/i,
  /sunhi/i, /sun-hi/i, /heami/i, /yuna/i, /sora/i, /jiyeon/i, /seonhye/i, /jihye/i,
  /zira/i, /hazel/i, /linda/i, /samantha/i, /karen/i, /fiona/i, /moira/i, /tessa/i, /victoria/i, /susan/i, /sara/i,
  /nanami/i, /haruka/i, /ayumi/i, /keiko/i, /aoi/i,
  /google.*한국/i, /google.*ko/i,
];
const MALE_HINTS = [
  /\bmale\b/i, /남성/i, /\bman\b/i,
  /injoon/i, /in-joon/i, /hyunbin/i, /bongiin/i, /gookmin/i,
  /david/i, /mark/i, /george/i, /daniel/i, /james/i, /richard/i, /thomas/i, /fred/i,
  /takumi/i, /ichiro/i, /keitaro/i, /naoki/i, /daichi/i,
];

function guessGender(voice) {
  const name = voice.name;
  for (const p of FEMALE_HINTS) if (p.test(name)) return 'female';
  for (const p of MALE_HINTS) if (p.test(name)) return 'male';
  return null;
}

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

  /** 현재 언어에 대해 여성/남성 음성을 반환 */
  getGenderedVoices(lang) {
    if (!this.supported) return { female: null, male: null };
    const locale = LANG_MAP[lang] || 'ko-KR';
    const prefix = locale.split('-')[0];
    const langVoices = window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang.startsWith(prefix));

    let female = null;
    let male = null;

    for (const v of langVoices) {
      const g = guessGender(v);
      if (g === 'female' && !female) female = v;
      if (g === 'male' && !male) male = v;
      if (female && male) break;
    }

    // 성별을 판별하지 못한 경우, 첫 두 음성 사용
    if (!female && !male && langVoices.length >= 2) {
      female = langVoices[0];
      male = langVoices[1];
    } else if (!female && !male && langVoices.length === 1) {
      female = langVoices[0];
    }

    return { female, male };
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
      this.onStateChange({ isSpeaking: this.isSpeaking, isPaused: this.isPaused });
    }
  }
}

export const ttsController = new TtsController();
