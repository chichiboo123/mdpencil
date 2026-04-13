import { useTranslation } from 'react-i18next';
import styles from './Preview.module.css';

export default function Preview({
  previewUrls,
  currentPage,
  totalPages,
  onPageChange,
}) {
  const { t } = useTranslation();

  if (!previewUrls || previewUrls.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>
            <span className="material-icons">image</span>
            {t('preview.title')}
          </span>
        </div>
        <div className={styles.empty}>
          <span className={`material-icons ${styles.emptyIcon}`}>insert_photo</span>
          {t('preview.noFile')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <span className="material-icons">image</span>
          {t('preview.title')}
        </span>
        {totalPages > 1 && (
          <div className={styles.pageNav}>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <span className="material-icons">chevron_left</span>
            </button>
            <span>
              {t('preview.page')} {currentPage}{t('preview.of')}{totalPages}
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              <span className="material-icons">chevron_right</span>
            </button>
          </div>
        )}
      </div>
      <div className={styles.imageContainer}>
        <img
          src={previewUrls[currentPage - 1]}
          alt={`Preview page ${currentPage}`}
          className={styles.previewImage}
        />
      </div>
    </div>
  );
}
