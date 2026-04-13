import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './HelpModal.module.css';

export default function HelpModal({ open, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            <span className="material-icons">menu_book</span>
            {t('help.title')}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('help.close')}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className="material-icons">info</span>
              {t('help.section1Title')}
            </h3>
            <p className={styles.sectionBody}>{t('help.section1Body')}</p>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className="material-icons">rocket_launch</span>
              {t('help.section2Title')}
            </h3>
            <ol className={styles.steps}>
              <li>{t('help.step1')}</li>
              <li>{t('help.step2')}</li>
              <li>{t('help.step3')}</li>
              <li>{t('help.step4')}</li>
            </ol>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className="material-icons">code</span>
              {t('help.section3Title')}
            </h3>
            <p className={styles.sectionBody}>{t('help.section3Body')}</p>
            <div className={styles.mdExamples}>
              <div className={styles.mdExample}>{t('help.mdHeading')}</div>
              <div className={styles.mdExample}>{t('help.mdSubheading')}</div>
              <div className={styles.mdExample}>{t('help.mdList')}</div>
              <div className={styles.mdExample}>{t('help.mdBold')}</div>
              <div className={styles.mdExample}>{t('help.mdParagraph')}</div>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className="material-icons">record_voice_over</span>
              {t('help.section4Title')}
            </h3>
            <p className={styles.sectionBody}>{t('help.section4Body')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
