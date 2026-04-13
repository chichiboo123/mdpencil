import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ttsController, recordTtsAudio } from '../utils/tts';
import { markdownToReadableText } from '../utils/markdown';
import styles from './TtsControls.module.css';

export default function TtsControls({ content, showToast }) {
  const { t, i18n } = useTranslation();
  const [ttsState, setTtsState] = useState({ isSpeaking: false, isPaused: false });
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    ttsController.onStateChange = setTtsState;
    return () => {
      ttsController.stop();
      ttsController.onStateChange = null;
    };
  }, []);

  // Load voices when language changes
  useEffect(() => {
    const loadVoices = () => {
      const available = ttsController.getVoices(i18n.language);
      setVoices(available);
      setSelectedVoiceURI('');
      ttsController.setVoice(null);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
  }, [i18n.language]);

  const getReadableText = useCallback(() => {
    return markdownToReadableText(content);
  }, [content]);

  const handlePlay = useCallback(() => {
    if (!ttsController.supported) {
      showToast(t('tts.notSupported'), 'error');
      return;
    }
    const text = getReadableText();
    if (!text) {
      showToast(t('tts.noContent'), 'info');
      return;
    }
    ttsController.setRate(rate);
    ttsController.play(text, i18n.language);
  }, [getReadableText, rate, i18n.language, showToast, t]);

  const handleVoiceChange = (e) => {
    const uri = e.target.value;
    setSelectedVoiceURI(uri);
    if (!uri) {
      ttsController.setVoice(null);
      return;
    }
    const voice = voices.find((v) => v.voiceURI === uri);
    ttsController.setVoice(voice || null);
  };

  const handleRecord = useCallback(async () => {
    const text = getReadableText();
    if (!text) {
      showToast(t('tts.noContent'), 'info');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast(t('tts.recordNotSupported'), 'error');
      return;
    }

    setRecording(true);
    try {
      const voice = voices.find((v) => v.voiceURI === selectedVoiceURI) || null;
      const blob = await recordTtsAudio(text, i18n.language, rate, voice);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mdpencil-tts.webm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(t('tts.recordComplete'), 'success');
    } catch {
      showToast(t('tts.recordFail'), 'error');
    } finally {
      setRecording(false);
    }
  }, [getReadableText, i18n.language, rate, selectedVoiceURI, voices, showToast, t]);

  return (
    <div className={styles.ttsRow}>
      {/* Play / Pause / Stop */}
      {!ttsState.isSpeaking ? (
        <button className={`${styles.btn} ${styles.btnPlay}`} onClick={handlePlay}>
          <span className="material-icons">play_arrow</span>
          {t('tts.play')}
        </button>
      ) : (
        <>
          <button className={styles.btn} onClick={() => ttsState.isPaused ? ttsController.resume() : ttsController.pause()}>
            <span className="material-icons">
              {ttsState.isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>
          <button className={`${styles.btn} ${styles.btnStop}`} onClick={() => ttsController.stop()}>
            <span className="material-icons">stop</span>
          </button>
        </>
      )}

      {/* Record / Download */}
      <button
        className={`${styles.btn} ${recording ? styles.btnRecording : ''}`}
        onClick={handleRecord}
        disabled={recording}
      >
        <span className="material-icons">{recording ? 'fiber_manual_record' : 'mic'}</span>
        {recording ? t('tts.recording') : t('tts.record')}
      </button>

      {/* Voice selector */}
      {voices.length > 0 && (
        <select
          className={styles.voiceSelect}
          value={selectedVoiceURI}
          onChange={handleVoiceChange}
          aria-label={t('tts.voice')}
        >
          <option value="">{t('tts.voiceDefault')}</option>
          {voices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name}
            </option>
          ))}
        </select>
      )}

      {/* Speed */}
      <div className={styles.speedControl}>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={rate}
          onChange={(e) => { const r = parseFloat(e.target.value); setRate(r); ttsController.setRate(r); }}
          className={styles.speedSlider}
          aria-label={t('tts.speed')}
        />
        <span className={styles.speedValue}>{rate.toFixed(1)}x</span>
      </div>
    </div>
  );
}
