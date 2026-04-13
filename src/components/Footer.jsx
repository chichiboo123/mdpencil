import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <a
        href="https://litt.ly/chichiboo"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.link}
      >
        {t('footer.credit')}
      </a>
    </footer>
  );
}
