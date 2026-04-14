import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { markdownToHtml } from '../utils/markdown';
import styles from './Editor.module.css';

export default function Editor({ value, onChange }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('edit');

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>
          <span className="material-icons">edit_note</span>
          {t('editor.title')}
        </span>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'edit' ? styles.tabActive : ''}`}
            onClick={() => setTab('edit')}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
            {t('editor.tabEdit')}
          </button>
          <button
            className={`${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`}
            onClick={() => setTab('preview')}
          >
            <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
            {t('editor.tabPreview')}
          </button>
        </div>
      </div>

      {tab === 'edit' ? (
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('editor.placeholder')}
          spellCheck={false}
          aria-label={t('editor.title')}
        />
      ) : (
        <div
          className={styles.preview}
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || `<p class="${styles.emptyPreview}">${t('editor.placeholder')}</p>` }}
        />
      )}
    </div>
  );
}
