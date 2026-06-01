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
import { performOCR, isValidOcrResult } from './utils/ocr';
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

  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  const toastTimer = useRef(null);
  // 진행 중인 OCR 작업을 식별/취소하기 위한 토큰
  const ocrJobRef = useRef(0);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2500);
  }, []);

  const handleReset = useCallback(() => {
    ocrJobRef.current += 1; // 진행 중 작업 무효화
    setMarkdown('');
    setPreviewUrls([]);
    setCurrentPage(1);
    setTotalPages(0);
    setLoading(false);
    showToast(t('toolbar.resetDone'), 'info');
  }, [showToast, t]);

  const handleCancelOcr = useCallback(() => {
    ocrJobRef.current += 1; // 진행 중 작업 무효화
    setPreviewUrls([]);
    setTotalPages(0);
    setCurrentPage(1);
    setLoading(false);
    showToast(t('ocr.canceled'), 'info');
  }, [showToast, t]);

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
      const jobId = ++ocrJobRef.current; // 이 작업의 고유 ID
      const isCurrent = () => ocrJobRef.current === jobId;

      setLoading(true);
      setOcrProgress({ stage: 'init', progress: 0 });

      try {
        if (file.type === 'application/pdf') {
          const { pages } = await renderAllPdfPages(file);
          if (!isCurrent()) return;
          const urls = pages.map((p) => p.dataUrl);
          setPreviewUrls(urls);
          setTotalPages(pages.length);
          setCurrentPage(1);

          let allText = '';
          let anyStructured = false;
          for (let i = 0; i < pages.length; i++) {
            if (!isCurrent()) return; // 취소되면 중단
            setOcrProgress({ stage: 'recognize', progress: i / pages.length });
            const { text, confidence, structured } = await performOCR(pages[i].dataUrl, ocrLang, (p) => {
              if (isCurrent()) {
                setOcrProgress({ stage: p.stage, progress: (i + p.progress) / pages.length });
              }
            });
            if (isValidOcrResult(text, confidence)) {
              allText += (allText ? '\n\n---\n\n' : '') + text;
              if (structured) anyStructured = true;
            }
          }

          if (!isCurrent()) return;
          if (!allText.trim()) {
            showToast(t('ocr.noText'), 'info');
          } else {
            setMarkdown(ocrTextToMarkdown(allText, { preStructured: anyStructured }));
            showToast(t('ocr.success'), 'success');
          }
        } else {
          const url = URL.createObjectURL(file);
          setPreviewUrls([url]);
          setTotalPages(1);
          setCurrentPage(1);

          const { text, confidence, structured } = await performOCR(file, ocrLang, (p) => {
            if (isCurrent()) setOcrProgress(p);
          });
          if (!isCurrent()) return;
          if (!isValidOcrResult(text, confidence)) {
            showToast(t('ocr.noText'), 'info');
          } else {
            setMarkdown(ocrTextToMarkdown(text, { preStructured: structured }));
            showToast(t('ocr.success'), 'success');
          }
        }
      } catch (err) {
        if (!isCurrent()) return;
        console.error('OCR error:', err);
        showToast(file.type === 'application/pdf' ? t('ocr.pdfFail') : t('ocr.fail'), 'error');
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [ocrLang, showToast, t],
  );

  const hasPreview = previewUrls.length > 0;

  return (
    <>
      <Header onHelpOpen={() => setHelpOpen(true)} />

      <main className={styles.container}>
        {!loading && !hasPreview && (
          <div className={styles.initialScreen}>
            <p className={styles.subtitle}>{t('app.subtitle')}</p>
            <UploadZone
              onFileSelect={handleFileSelect}
              ocrLang={ocrLang}
              onOcrLangChange={setOcrLang}
              showToast={showToast}
            />
          </div>
        )}

        {loading && (
          <div className={styles.initialScreen}>
            <div className={styles.loadingOverlay} role="status" aria-live="polite">
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
              <button className={styles.cancelBtn} onClick={handleCancelOcr}>
                <span className="material-icons" style={{ fontSize: '16px' }}>close</span>
                {t('ocr.cancel')}
              </button>
            </div>
          </div>
        )}

        {!loading && hasPreview && (
          <div className={styles.workspaceScreen}>
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

            <div className={styles.actionsRow}>
              <Toolbar
                content={markdown}
                onClear={() => setMarkdown('')}
                showToast={showToast}
              />
              <div className={styles.separator} />
              <TtsControls content={markdown} showToast={showToast} ttsLang={ocrLang} />
            </div>

            <UploadZone
              onFileSelect={handleFileSelect}
              ocrLang={ocrLang}
              onOcrLangChange={setOcrLang}
              showToast={showToast}
              compact
            />
          </div>
        )}
      </main>

      <Footer />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className={styles.toastContainer} aria-live="assertive" role="status">
        <div className={`toast ${toast.type} ${toast.visible ? 'visible' : ''}`}>
          {toast.message}
        </div>
      </div>
    </>
  );
}
