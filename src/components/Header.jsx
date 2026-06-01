import { useTranslation } from 'react-i18next';
import styles from './Header.module.css';

export default function Header({ onHelpOpen, onSettingsOpen }) {
  const { t, i18n } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={`material-icons ${styles.logo}`}>edit</span>
        <span className={styles.title}>{t('app.title')}</span>
      </div>
      <div className={styles.controls}>
        <select
          className={styles.langSelect}
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          aria-label="Language"
        >
          <option value="ko">{t('lang.ko')}</option>
          <option value="en">{t('lang.en')}</option>
          <option value="ja">{t('lang.ja')}</option>
        </select>
        <button className={styles.helpBtn} onClick={onSettingsOpen} aria-label={t('settings.title')}>
          <span className="material-icons">settings</span>
        </button>
        <button className={styles.helpBtn} onClick={onHelpOpen} aria-label={t('help.title')}>
          <span className="material-icons">help_outline</span>
        </button>
      </div>
    </header>
  );
}
