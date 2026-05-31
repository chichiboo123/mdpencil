import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './UploadZone.module.css';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_SIZE = 20 * 1024 * 1024;

export default function UploadZone({ onFileSelect, ocrLang, onOcrLangChange, compact, showToast }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const validateAndSelect = useCallback(
    (file) => {
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        showToast?.(t('upload.invalidType'), 'error');
        return;
      }
      if (file.size > MAX_SIZE) {
        showToast?.(t('upload.tooLarge'), 'error');
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, showToast, t],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      validateAndSelect(e.dataTransfer.files?.[0]);
    },
    [validateAndSelect],
  );

  return (
    <div className={`${styles.wrapper} ${compact ? styles.compact : ''}`}>
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => { e.preventDefault(); dragDepth.current += 1; setDragActive(true); }}
        onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) setDragActive(false); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={t('upload.dragDrop')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className={`material-icons ${styles.icon}`}>cloud_upload</span>
        <p className={styles.mainText}>{t('upload.dragDrop')}</p>
        <p className={styles.hint}>
          {t('upload.supported')} · {t('upload.paste')}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={(e) => { validateAndSelect(e.target.files?.[0]); e.target.value = ''; }}
          className={styles.fileInput}
        />
      </div>
      <div className={styles.ocrLangRow}>
        <label className={styles.ocrLangLabel}>{t('ocr.langLabel')}</label>
        <select
          className={styles.ocrLangSelect}
          value={ocrLang}
          onChange={(e) => onOcrLangChange(e.target.value)}
        >
          <option value="ko">{t('ocr.langKo')}</option>
          <option value="en">{t('ocr.langEn')}</option>
          <option value="ja">{t('ocr.langJa')}</option>
        </select>
      </div>
    </div>
  );
}
