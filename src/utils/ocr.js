import { createWorker } from 'tesseract.js';

const LANG_MAP = {
  ko: 'kor',
  en: 'eng',
  ja: 'jpn',
};

// 단어 단위 신뢰도 임계값. 이보다 낮은 단어는 노이즈로 간주하고 버린다.
// (사진·아이콘·UI 요소에서 나온 잘못된 인식은 신뢰도가 낮다)
const MIN_WORD_CONFIDENCE = 60;
// 줄 평균 신뢰도가 이보다 낮으면 줄 전체를 버린다.
const MIN_LINE_CONFIDENCE = 45;

/**
 * 이미지를 Canvas에 로드하여 가볍게 전처리한다.
 * - 그레이스케일 변환
 * - 대비(contrast) 정규화
 * - 작은 이미지 확대
 *
 * ⚠️ 하드 이진화(binarization)는 의도적으로 하지 않는다.
 * 스크린샷·사진이 포함된 이미지에서 전역 이진화는 사진/아이콘을
 * 노이즈로 만들어 OCR 품질을 떨어뜨린다. 이진화는 Tesseract 내부의
 * 적응형(Leptonica) 처리에 맡긴다.
 */
function preprocessImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 작은 이미지는 확대(최대 3배, 최대 변 ~2000px)하여 인식률을 높인다.
      const scale = Math.max(1, Math.min(3, 2000 / Math.max(img.width, img.height)));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

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

      // 2) 대비 정규화 (contrast stretch) — 텍스트 가독성만 살짝 끌어올린다.
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
 * Tesseract 결과(blocks)에서 신뢰도가 높은 텍스트만 재구성한다.
 * 단락(paragraph) 구조를 보존하여 빈 줄로 구분하고,
 * 저신뢰 단어/줄은 버려 사진·아이콘 노이즈를 제거한다.
 */
function reconstructText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const paragraphs = [];

  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      const paraLines = [];

      for (const line of para.lines || []) {
        const words = line.words || [];
        // 신뢰도 높은 단어만 유지
        const goodWords = words
          .filter((wd) => (wd.confidence ?? 0) >= MIN_WORD_CONFIDENCE)
          .map((wd) => (wd.text || '').trim())
          .filter(Boolean);

        if (goodWords.length === 0) continue;
        // 줄 자체의 평균 신뢰도가 너무 낮으면 통째로 버린다.
        if ((line.confidence ?? 0) < MIN_LINE_CONFIDENCE) continue;

        paraLines.push(goodWords.join(' '));
      }

      if (paraLines.length > 0) {
        paragraphs.push(paraLines.join('\n'));
      }
    }
  }

  return paragraphs.join('\n\n');
}

/**
 * OCR 수행 후 텍스트와 신뢰도를 반환한다.
 * 이미지 전처리 → Tesseract 인식 → 신뢰도 기반 노이즈 제거.
 */
export async function performOCR(imageSource, ocrLang = 'ko', onProgress) {
  const lang = LANG_MAP[ocrLang] || 'kor';

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
    await worker.setParameters({
      // PSM 3: 자동 페이지 레이아웃 분석. 다중 영역(텍스트+사진)을 구분하고
      // 비텍스트 영역을 건너뛰어 스크린샷·복합 문서에 강하다.
      tessedit_pageseg_mode: '3',
      preserve_interword_spaces: '1',
    });

    const { data } = await worker.recognize(processedImage);

    // 신뢰도 기반 재구성. 실패 시 원본 텍스트로 폴백.
    const reconstructed = reconstructText(data.blocks);
    const text = reconstructed && reconstructed.trim() ? reconstructed : data.text;

    return { text, confidence: data.confidence };
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
