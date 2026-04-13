import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import Preview from './components/Preview';
import Editor from './components/Editor';
import Toolbar from './components/Toolbar';
import TtsControls from './components/TtsControls';
import HelpModal from './components/HelpModal';
import Footer from './components/Footer';
import { performOCR } from './utils/ocr';
import { renderAllPdfPages } from './utils/pdf';
import { ocrTextToMarkdown } from './utils/markdown';
import styles from './App.module.css';

export default function App() {
  const { t } = useTranslation();

  const [helpOpen, setHelpOpen] = useState(false);
  const [markdown, setMarkdown] = useState('');
  const [previewUrls, setPreviewUrls] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [ocrLang, setOcrLang] = useState('ko');

  // OCR loading state
  const [loading, setLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState({ stage: '', progress: 0 });

  // Toast
  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2500);
  }, []);

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleFileSelect(file);
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [ocrLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = useCallback(
    async (file) => {
      setLoading(true);
      setOcrProgress({ stage: 'init', progress: 0 });

      try {
        if (file.type === 'application/pdf') {
          // PDF: render all pages, then OCR each
          const { pages } = await renderAllPdfPages(file);
          const urls = pages.map((p) => p.dataUrl);
          setPreviewUrls(urls);
          setTotalPages(pages.length);
          setCurrentPage(1);

          // OCR all pages
          let allText = '';
          for (let i = 0; i < pages.length; i++) {
            setOcrProgress({
              stage: 'recognize',
              progress: i / pages.length,
            });
            const text = await performOCR(pages[i].dataUrl, ocrLang, (p) =>
              setOcrProgress({
                stage: p.stage,
                progress: (i + p.progress) / pages.length,
              }),
            );
            if (text.trim()) {
              allText += (allText ? '\n\n---\n\n' : '') + text;
            }
          }

          if (!allText.trim()) {
            showToast(t('ocr.noText'), 'error');
          } else {
            const md = ocrTextToMarkdown(allText);
            setMarkdown(md);
            showToast(t('ocr.success'), 'success');
          }
        } else {
          // Image file
          const url = URL.createObjectURL(file);
          setPreviewUrls([url]);
          setTotalPages(1);
          setCurrentPage(1);

          const text = await performOCR(file, ocrLang, setOcrProgress);
          if (!text.trim()) {
            showToast(t('ocr.noText'), 'error');
          } else {
            const md = ocrTextToMarkdown(text);
            setMarkdown(md);
            showToast(t('ocr.success'), 'success');
          }
        }
      } catch (err) {
        console.error('OCR error:', err);
        const msg = file.type === 'application/pdf' ? t('ocr.pdfFail') : t('ocr.fail');
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    },
    [ocrLang, showToast, t],
  );

  const getProgressText = () => {
    if (ocrProgress.stage === 'init') return t('ocr.progressInit');
    if (ocrProgress.stage === 'recognize') return t('ocr.progressRecognize');
    return t('ocr.processing');
  };

  const hasPreview = previewUrls.length > 0;

  return (
    <>
      <Header onHelpOpen={() => setHelpOpen(true)} />

      <main className={styles.container}>
        {/* Hero */}
        <div className={styles.hero}>
          <p className={styles.heroTitle}>{t('app.subtitle')}</p>
          <p className={styles.heroDesc}>{t('app.description')}</p>
        </div>

        {/* Upload zone */}
        {!loading && !hasPreview && (
          <UploadZone
            onFileSelect={handleFileSelect}
            ocrLang={ocrLang}
            onOcrLangChange={setOcrLang}
          />
        )}

        {/* Loading */}
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>{t('ocr.processing')}</p>
            <p className={styles.loadingSubtext}>{getProgressText()}</p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Workspace: Preview + Editor */}
        {!loading && hasPreview && (
          <>
            <div
              className={`${styles.workspace} ${
                hasPreview ? styles.workspaceSplit : styles.workspaceSingle
              }`}
            >
              <Preview
                previewUrls={previewUrls}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
              <Editor value={markdown} onChange={setMarkdown} />
            </div>

            {/* Actions row */}
            <div className={styles.actionsRow}>
              <Toolbar
                content={markdown}
                onClear={() => setMarkdown('')}
                showToast={showToast}
              />
              <div className={styles.separator} />
              <TtsControls content={markdown} showToast={showToast} />
            </div>

            {/* Upload another file */}
            <UploadZone
              onFileSelect={handleFileSelect}
              ocrLang={ocrLang}
              onOcrLangChange={setOcrLang}
            />
          </>
        )}
      </main>

      <Footer />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Toast */}
      <div className={styles.toastContainer}>
        <div className={`toast ${toast.type} ${toast.visible ? 'visible' : ''}`}>
          {toast.message}
        </div>
      </div>
    </>
  );
}
