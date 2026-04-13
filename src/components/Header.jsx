import { useTranslation } from 'react-i18next';
import styles from './Header.module.css';

export default function Header({ onHelpOpen }) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (e) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.logo}>MD</div>
        <span className={styles.title}>{t('app.title')}</span>
      </div>
      <div className={styles.controls}>
        <select
          className={styles.langSelect}
          value={i18n.language}
          onChange={changeLanguage}
          aria-label="Language"
        >
          <option value="ko">{t('lang.ko')}</option>
          <option value="en">{t('lang.en')}</option>
          <option value="ja">{t('lang.ja')}</option>
        </select>
        <button className={styles.helpBtn} onClick={onHelpOpen} aria-label={t('help.title')}>
          <span className="material-icons">help_outline</span>
          <span className={styles.helpBtnText}>{t('help.title')}</span>
        </button>
      </div>
    </header>
  );
}
