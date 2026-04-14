import { createWorker } from 'tesseract.js';

const LANG_MAP = {
  ko: 'kor',
  en: 'eng',
  ja: 'jpn',
};

/**
 * OCR 수행 후 텍스트와 신뢰도를 반환한다.
 */
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
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

/**
 * OCR 결과가 의미 있는 텍스트인지 판별한다.
 * confidence가 낮거나, 읽을 수 있는 문자 비율이 낮으면 false.
 */
export function isValidOcrResult(text, confidence) {
  if (!text || !text.trim()) return false;
  if (confidence < 20) return false;

  const cleaned = text.trim();
  // 의미 있는 문자: 한글, 영문, 일문, 숫자, 일반 구두점, 공백
  const readable = cleaned.match(/[a-zA-Z가-힣ぁ-んァ-ヶ一-龥0-9.,!?;:'"\s\-()]/g);
  const ratio = readable ? readable.length / cleaned.length : 0;
  return ratio > 0.35;
}
