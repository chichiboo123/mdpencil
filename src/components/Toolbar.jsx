import { useTranslation } from 'react-i18next';
import styles from './Toolbar.module.css';

export default function Toolbar({ content, onClear, showToast }) {
  const { t } = useTranslation();

  const handleCopy = async () => {
    if (!content.trim()) {
      showToast(t('toolbar.noContent'), 'info');
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      showToast(t('toolbar.copied'), 'success');
    } catch {
      showToast(t('toolbar.copyFail'), 'error');
    }
  };

  const handleDownload = () => {
    if (!content.trim()) {
      showToast(t('toolbar.noContent'), 'info');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mdpencil-result.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('toolbar.downloaded'), 'success');
  };

  const handleClear = () => {
    onClear();
    showToast(t('toolbar.cleared'), 'info');
  };

  return (
    <div className={styles.toolbar}>
      <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleCopy}>
        <span className="material-icons">content_copy</span>
        {t('toolbar.copy')}
      </button>
      <button className={styles.btn} onClick={handleDownload}>
        <span className="material-icons">download</span>
        {t('toolbar.download')}
      </button>
      <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleClear}>
        <span className="material-icons">delete_outline</span>
        {t('toolbar.clear')}
      </button>
    </div>
  );
}
