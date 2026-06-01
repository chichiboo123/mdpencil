import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import modal from './HelpModal.module.css';
import styles from './SettingsModal.module.css';
import {
  getProxyUrl,
  setProxyUrl,
  isAiCorrectEnabled,
  setAiCorrectEnabled,
  hasPassword,
  clearPassword,
} from '../utils/gemini';

export default function SettingsModal({ open, onClose, onSaved, showToast }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);

  const [enabled, setEnabled] = useState(false);
  const [url, setUrl] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  // 모달이 열릴 때 저장된 값으로 동기화
  useEffect(() => {
    if (!open) return;
    setEnabled(isAiCorrectEnabled());
    setUrl(getProxyUrl());
    setPwSaved(hasPassword());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
      if (prevFocusRef.current instanceof HTMLElement) prevFocusRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = url.trim();
    if (enabled && !trimmed) {
      showToast?.(t('settings.needUrl'), 'error');
      return;
    }
    setProxyUrl(trimmed);
    setAiCorrectEnabled(enabled);
    onSaved?.();
    showToast?.(t('settings.saved'), 'success');
    onClose();
  };

  return (
    <div className={modal.overlay} onClick={onClose}>
      <div
        className={modal.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className={modal.modalHeader}>
          <span className={modal.modalTitle} id="settings-modal-title">
            <span className="material-icons">settings</span>
            {t('settings.title')}
          </span>
          <button
            ref={closeRef}
            className={modal.closeBtn}
            onClick={onClose}
            aria-label={t('help.close')}
          >
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className={modal.modalBody}>
          <div className={modal.section}>
            <h3 className={modal.sectionTitle}>
              <span className="material-icons">auto_fix_high</span>
              {t('settings.aiSectionTitle')}
            </h3>
            <p className={modal.sectionBody}>{t('settings.aiSectionBody')}</p>

            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>{t('settings.enableLabel')}</span>
            </label>

            <label className={styles.fieldLabel} htmlFor="gemini-proxy-url">
              {t('settings.urlLabel')}
            </label>
            <input
              id="gemini-proxy-url"
              type="url"
              className={styles.input}
              placeholder="https://gemini-proxy.your-account.workers.dev"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <p className={styles.hint}>{t('settings.urlHint')}</p>

            <div className={styles.pwRow}>
              <span className={styles.hint} style={{ marginTop: 0 }}>
                {pwSaved ? t('settings.passwordStatusSet') : t('settings.passwordStatusUnset')}
              </span>
              {pwSaved && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    clearPassword();
                    setPwSaved(false);
                    showToast?.(t('settings.passwordCleared'), 'info');
                  }}
                >
                  {t('settings.passwordReset')}
                </button>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.saveBtn} onClick={handleSave}>
              <span className="material-icons" style={{ fontSize: '18px' }}>check</span>
              {t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
