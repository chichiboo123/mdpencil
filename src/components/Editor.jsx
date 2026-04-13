import { useTranslation } from 'react-i18next';
import styles from './Editor.module.css';

export default function Editor({ value, onChange }) {
  const { t } = useTranslation();

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <span className="material-icons">edit_note</span>
          {t('editor.title')}
        </span>
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('editor.placeholder')}
        spellCheck={false}
        aria-label={t('editor.title')}
      />
    </div>
  );
}
