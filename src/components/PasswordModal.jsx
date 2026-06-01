import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import modal from './HelpModal.module.css';
import styles from './SettingsModal.module.css';

/**
 * AI 교정 최초 1회 비밀번호 입력 모달.
 * 입력한 비밀번호는 localStorage에 저장되며, 프록시의 AI_PASSWORD 환경변수와
 * 대조된다. 불일치(401) 시 다시 열려 재입력을 받는다.
 */
export default function PasswordModal({ open, onClose, onSubmit }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const prevFocusRef = useRef(null);
  const [pw, setPw] = useState('');

  useEffect(() => {
    if (!open) return;
    setPw('');
    prevFocusRef.current = document.activeElement;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    // 입력란으로 포커스
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
      if (prevFocusRef.current instanceof HTMLElement) prevFocusRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = () => {
    const trimmed = pw.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <div className={modal.overlay} onClick={onClose}>
      <div
        className={modal.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        style={{ maxWidth: '420px' }}
      >
        <div className={modal.modalHeader}>
          <span className={modal.modalTitle} id="password-modal-title">
            <span className="material-icons">lock</span>
            {t('password.title')}
          </span>
          <button className={modal.closeBtn} onClick={onClose} aria-label={t('help.close')}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className={modal.modalBody}>
          <p className={modal.sectionBody} style={{ marginBottom: '14px' }}>
            {t('password.body')}
          </p>
          <input
            ref={inputRef}
            type="password"
            className={styles.input}
            placeholder={t('password.placeholder')}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            autoComplete="off"
          />
          <div className={styles.actions} style={{ marginTop: '18px' }}>
            <button className={styles.saveBtn} onClick={submit} disabled={!pw.trim()}>
              <span className="material-icons" style={{ fontSize: '18px' }}>check</span>
              {t('password.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
