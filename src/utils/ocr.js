import { createWorker } from 'tesseract.js';

const LANG_MAP = {
  ko: 'kor',
  en: 'eng',
  ja: 'jpn',
};

export async function performOCR(imageSource, ocrLang = 'ko', onProgress) {
  const lang = LANG_MAP[ocrLang] || 'kor';

  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress) {
        if (m.status === 'recognizing text') {
          onProgress({ stage: 'recognize', progress: m.progress });
        } else {
          onProgress({ stage: 'init', progress: m.progress });
        }
      }
    },
  });

  try {
    const { data } = await worker.recognize(imageSource);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
