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

  // Reset all state
  const handleReset = useCallback(() => {
    setMarkdown('');
    setPreviewUrls([]);
    setCurrentPage(1);
    setTotalPages(0);
    setLoading(false);
    showToast(t('toolbar.resetDone'), 'info');
  }, [showToast, t]);

  // Clipboard paste
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
          const { pages } = await renderAllPdfPages(file);
          const urls = pages.map((p) => p.dataUrl);
          setPreviewUrls(urls);
          setTotalPages(pages.length);
          setCurrentPage(1);

          let allText = '';
          for (let i = 0; i < pages.length; i++) {
            setOcrProgress({ stage: 'recognize', progress: i / pages.length });
            const text = await performOCR(pages[i].dataUrl, ocrLang, (p) =>
              setOcrProgress({ stage: p.stage, progress: (i + p.progress) / pages.length }),
            );
            if (text.trim()) {
              allText += (allText ? '\n\n---\n\n' : '') + text;
            }
          }

          if (!allText.trim()) {
            showToast(t('ocr.noText'), 'error');
          } else {
            setMarkdown(ocrTextToMarkdown(allText));
            showToast(t('ocr.success'), 'success');
          }
        } else {
          const url = URL.createObjectURL(file);
          setPreviewUrls([url]);
          setTotalPages(1);
          setCurrentPage(1);

          const text = await performOCR(file, ocrLang, setOcrProgress);
          if (!text.trim()) {
            showToast(t('ocr.noText'), 'error');
          } else {
            setMarkdown(ocrTextToMarkdown(text));
            showToast(t('ocr.success'), 'success');
          }
        }
      } catch (err) {
        console.error('OCR error:', err);
        showToast(file.type === 'application/pdf' ? t('ocr.pdfFail') : t('ocr.fail'), 'error');
      } finally {
        setLoading(false);
      }
    },
    [ocrLang, showToast, t],
  );

  const hasPreview = previewUrls.length > 0;

  return (
    <>
      <Header onHelpOpen={() => setHelpOpen(true)} />

      <main className={styles.container}>
        {/* Subtitle - only on initial screen */}
        {!loading && !hasPreview && (
          <p className={styles.subtitle}>{t('app.subtitle')}</p>
        )}

        {/* Upload zone - initial */}
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
            <p className={styles.loadingSubtext}>
              {ocrProgress.stage === 'init'
                ? t('ocr.progressInit')
                : ocrProgress.stage === 'recognize'
                  ? t('ocr.progressRecognize')
                  : t('ocr.processing')}
            </p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Workspace */}
        {!loading && hasPreview && (
          <>
            <div className={styles.workspace}>
              <Preview
                previewUrls={previewUrls}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                onReset={handleReset}
              />
              <Editor value={markdown} onChange={setMarkdown} />
            </div>

            {/* Actions */}
            <div className={styles.actionsRow}>
              <Toolbar
                content={markdown}
                onClear={() => setMarkdown('')}
                showToast={showToast}
              />
              <div className={styles.separator} />
              <TtsControls content={markdown} showToast={showToast} />
            </div>

            {/* Re-upload */}
            <UploadZone
              onFileSelect={handleFileSelect}
              ocrLang={ocrLang}
              onOcrLangChange={setOcrLang}
              compact
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
