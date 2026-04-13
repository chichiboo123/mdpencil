import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './UploadZone.module.css';

const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export default function UploadZone({ onFileSelect, ocrLang, onOcrLangChange }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const validateAndSelect = useCallback(
    (file) => {
      if (!file) return;
      if (!ACCEPTED_TYPES.includes(file.type)) {
        alert(t('upload.supported'));
        return;
      }
      if (file.size > MAX_SIZE) {
        alert(t('upload.maxSize'));
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, t],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSelect(file);
    e.target.value = '';
  };

  const handleClick = () => inputRef.current?.click();

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={t('upload.title')}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      >
        <span className={`material-icons ${styles.icon}`}>cloud_upload</span>
        <p className={styles.mainText}>{t('upload.dragDrop')}</p>
        <p className={styles.orText}>{t('upload.or')}</p>
        <span className={styles.browseBtn}>
          <span className="material-icons">folder_open</span>
          {t('upload.browse')}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          onChange={handleChange}
          className={styles.fileInput}
        />
      </div>
      <p className={styles.hint}>
        {t('upload.paste')}
        <br />
        {t('upload.supported')} &middot; {t('upload.maxSize')}
      </p>
      <div className={styles.ocrLangRow}>
        <label className={styles.ocrLangLabel}>{t('ocr.langLabel')}:</label>
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
