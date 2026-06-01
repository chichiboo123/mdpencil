import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { markdownToHtml } from '../utils/markdown';
import modal from './HelpModal.module.css';
import styles from './MarkdownGuide.module.css';

// 가이드에 표시할 문법 항목 순서. 각 항목의 소스/설명은 i18n에서 가져온다.
const ITEM_KEYS = [
  'h1', 'h2', 'h3',
  'bold', 'italic', 'strike', 'code',
  'ul', 'ol', 'quote',
  'link', 'codeblock', 'hr',
];

export default function MarkdownGuide({ open, onClose }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  const prevFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
      if (prevFocusRef.current instanceof HTMLElement) prevFocusRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={modal.overlay} onClick={onClose}>
      <div
        className={modal.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="md-guide-title"
      >
        <div className={modal.modalHeader}>
          <span className={modal.modalTitle} id="md-guide-title">
            <span className="material-icons">menu_book</span>
            {t('guide.title')}
          </span>
          <button ref={closeRef} className={modal.closeBtn} onClick={onClose} aria-label={t('help.close')}>
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className={modal.modalBody}>
          <p className={modal.sectionBody} style={{ marginBottom: '14px' }}>
            {t('guide.intro')}
          </p>

          <div className={styles.tableHead}>
            <span>{t('guide.colSyntax')}</span>
            <span>{t('guide.colResult')}</span>
          </div>

          <div className={styles.list}>
            {ITEM_KEYS.map((k) => {
              const md = t(`guide.items.${k}.md`);
              const desc = t(`guide.items.${k}.desc`);
              return (
                <div className={styles.row} key={k}>
                  <div className={styles.syntaxCell}>
                    <pre className={styles.code}>{md}</pre>
                    <span className={styles.desc}>{desc}</span>
                  </div>
                  <div
                    className={styles.resultCell}
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(md) }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
