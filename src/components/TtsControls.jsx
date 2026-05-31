import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ttsController } from '../utils/tts';
import { markdownToReadableText } from '../utils/markdown';
import styles from './TtsControls.module.css';

export default function TtsControls({ content, showToast, ttsLang }) {
  const { t, i18n } = useTranslation();
  const [ttsState, setTtsState] = useState({ isSpeaking: false, isPaused: false });
  const [rate, setRate] = useState(1.0);

  useEffect(() => {
    ttsController.onStateChange = setTtsState;
    return () => {
      ttsController.stop();
      ttsController.onStateChange = null;
    };
  }, []);

  const handlePlay = useCallback(() => {
    if (!ttsController.supported) {
      showToast(t('tts.notSupported'), 'error');
      return;
    }
    const text = markdownToReadableText(content);
    if (!text) {
      showToast(t('tts.noContent'), 'info');
      return;
    }
    ttsController.setRate(rate);
    // 읽을 언어는 인식 언어(ttsLang) 우선, 없으면 UI 언어
    ttsController.play(text, ttsLang || i18n.language);
  }, [content, rate, ttsLang, i18n.language, showToast, t]);

  return (
    <div className={styles.ttsRow}>
      {!ttsState.isSpeaking ? (
        <button className={`${styles.btn} ${styles.btnPlay}`} onClick={handlePlay}>
          <span className="material-icons">play_arrow</span>
          {t('tts.play')}
        </button>
      ) : (
        <>
          <button
            className={styles.btn}
            onClick={() =>
              ttsState.isPaused ? ttsController.resume() : ttsController.pause()
            }
            aria-label={ttsState.isPaused ? t('tts.resume') : t('tts.pause')}
            title={ttsState.isPaused ? t('tts.resume') : t('tts.pause')}
          >
            <span className="material-icons">
              {ttsState.isPaused ? 'play_arrow' : 'pause'}
            </span>
          </button>
          <button
            className={`${styles.btn} ${styles.btnStop}`}
            onClick={() => ttsController.stop()}
            aria-label={t('tts.stop')}
            title={t('tts.stop')}
          >
            <span className="material-icons">stop</span>
          </button>
        </>
      )}

      {/* Speed */}
      <div className={styles.speedControl}>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={rate}
          onChange={(e) => {
            const r = parseFloat(e.target.value);
            setRate(r);
            ttsController.setRate(r);
          }}
          className={styles.speedSlider}
          aria-label={t('tts.speed')}
        />
        <span className={styles.speedValue}>{rate.toFixed(1)}x</span>
      </div>
    </div>
  );
}
