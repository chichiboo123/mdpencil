import { createWorker } from 'tesseract.js';

const LANG_MAP = {
  ko: 'kor',
  en: 'eng',
  ja: 'jpn',
};

/**
 * 이미지를 Canvas에 로드하여 전처리한다.
 * - 그레이스케일 변환
 * - 대비(contrast) 강화
 * - 이진화(binarization)
 * - 작은 이미지 확대
 */
function preprocessImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 작은 이미지는 2배 확대
      const scale = Math.max(1, Math.min(3, 1500 / Math.max(img.width, img.height)));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      // 고품질 보간
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // 1) 그레이스케일 변환
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // 2) 대비 강화 (contrast stretch)
      let min = 255, max = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < min) min = data[i];
        if (data[i] > max) max = data[i];
      }
      const range = max - min || 1;
      for (let i = 0; i < data.length; i += 4) {
        const stretched = ((data[i] - min) / range) * 255;
        data[i] = stretched;
        data[i + 1] = stretched;
        data[i + 2] = stretched;
      }

      // 3) 적응형 이진화 (Otsu's method 간이 구현)
      const histogram = new Array(256).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        histogram[Math.round(data[i])]++;
      }
      const totalPixels = data.length / 4;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];

      let sumB = 0, wB = 0, maxVariance = 0, threshold = 128;
      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        const wF = totalPixels - wB;
        if (wF === 0) break;
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) * (mB - mF);
        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = t;
        }
      }

      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;

    if (imageSource instanceof File || imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    } else {
      img.src = imageSource;
    }
  });
}

/**
 * OCR 수행 후 텍스트와 신뢰도를 반환한다.
 * 이미지 전처리 → Tesseract 최적 파라미터로 인식.
 */
export async function performOCR(imageSource, ocrLang = 'ko', onProgress) {
  const lang = LANG_MAP[ocrLang] || 'kor';

  // 이미지 전처리
  if (onProgress) onProgress({ stage: 'init', progress: 0 });
  const processedImage = await preprocessImage(imageSource);

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
    // Tesseract 파라미터 최적화
    await worker.setParameters({
      tessedit_pageseg_mode: '6',        // 단일 균일 텍스트 블록
      preserve_interword_spaces: '1',     // 단어 간 공백 보존
    });

    const { data } = await worker.recognize(processedImage);
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
