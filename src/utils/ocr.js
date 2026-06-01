import { createWorker } from 'tesseract.js';

const LANG_MAP = {
  ko: 'kor',
  en: 'eng',
  ja: 'jpn',
};

/**
 * 이미지를 Canvas에 로드하여 가볍게 전처리한다.
 * - 그레이스케일 변환
 * - 대비(contrast) 정규화
 * - 작은 이미지 확대 (Tesseract 권장: 충분한 해상도 ≈ 300DPI)
 *
 * ⚠️ 하드 이진화(binarization)는 의도적으로 하지 않는다.
 * 스크린샷·사진이 포함된 이미지에서 전역 이진화는 사진/아이콘을
 * 노이즈로 만든다. 이진화는 Tesseract 내부의 적응형 처리에 맡긴다.
 */
function preprocessImage(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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

      // 그레이스케일 변환
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      // 대비 정규화 (contrast stretch)
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

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function countAlnum(str) {
  return (str.match(/[\p{L}\p{N}]/gu) || []).length;
}

/**
 * Tesseract의 줄 단위 bounding box를 이용해 문서 구조를 복원한다.
 * - 줄 높이가 본문 중앙값보다 크면 제목(#/##)으로 추정
 * - 줄 사이 세로 간격이 넓으면 문단 구분(빈 줄)
 *
 * ❗ 텍스트는 신뢰도로 버리지 않는다. 인식된 모든 단어를 보존한다.
 *    (구조 추정에만 기하 정보를 사용)
 */
function reconstructMarkdown(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  const lines = [];
  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words = (line.words || [])
          .map((wd) => (wd.text || '').trim())
          .filter(Boolean);
        if (words.length === 0) continue;

        const text = words.join(' ').replace(/[^\S\n]{2,}/g, ' ').trim();
        if (!text) continue;

        const bb = line.bbox || {};
        const top = Number.isFinite(bb.y0) ? bb.y0 : null;
        const bottom = Number.isFinite(bb.y1) ? bb.y1 : null;
        const height = top != null && bottom != null ? bottom - top : 0;
        lines.push({ text, top, bottom, height });
      }
    }
  }
  if (lines.length === 0) return null;

  const medianHeight = median(lines.map((l) => l.height).filter((h) => h > 0));

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].top != null && lines[i - 1].bottom != null) {
      const g = lines[i].top - lines[i - 1].bottom;
      if (g >= 0) gaps.push(g);
    }
  }
  // 본문 줄간격은 "작은 쪽" 분포로 추정한다(30 백분위). 중앙값은 문단이
  // 짧을 때 큰 간격에 오염되어 문단 분리를 놓치기 쉽다.
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const baseGap = sortedGaps.length
    ? sortedGaps[Math.floor(sortedGaps.length * 0.3)]
    : 0;

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // 문단 구분: 줄 간격이 본문 줄간격 + 줄 높이의 절반을 넘으면 빈 줄 삽입.
    // (촘촘한 본문·이중 행간 모두에서 과/미분할을 막는 적응형 기준)
    if (i > 0 && l.top != null && lines[i - 1].bottom != null && medianHeight > 0) {
      const gap = l.top - lines[i - 1].bottom;
      const threshold = baseGap + medianHeight * 0.5;
      if (gap > threshold) out.push('');
    }

    let line = l.text;
    const charLen = [...line].length;
    const isList = /^(\d+[.)]\s|[-*•·○●◆◇▶▷※]\s?)/.test(line);
    const endsSentence = /[.。!?！？,，;；]$/.test(line);

    // 제목 추정: 줄 높이가 본문보다 크고, 짧고, 문장부호로 끝나지 않는 줄
    if (
      medianHeight > 0 &&
      l.height > 0 &&
      !isList &&
      !endsSentence &&
      charLen <= 28 &&
      !line.startsWith('#')
    ) {
      const ratio = l.height / medianHeight;
      if (ratio >= 1.5) line = `# ${line}`;
      else if (ratio >= 1.28) line = `## ${line}`;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * OCR 수행 후 텍스트와 신뢰도를 반환한다.
 * 이미지 전처리 → Tesseract 인식 → 기하 기반 구조 복원.
 * 반환값의 structured=true면 이미 제목/문단이 구성된 Markdown임.
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
      // PSM 6: 단일 균일 텍스트 블록. 영역을 건너뛰지 않고 본문 전체를 인식 →
      // 일반 문서에서 누락 없이 최대한 많은 텍스트를 확보한다.
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });

    const { data } = await worker.recognize(processedImage);

    // 기하 기반 구조 복원. 단, 텍스트 손실이 없을 때만 채택(완전성 보장).
    let text = data.text;
    let structured = false;
    const rebuilt = reconstructMarkdown(data.blocks);
    if (rebuilt && rebuilt.trim()) {
      // 복원본이 원문 글자수의 90% 이상을 보존하면 채택, 아니면 원문 유지
      if (countAlnum(rebuilt) >= countAlnum(data.text) * 0.9) {
        text = rebuilt;
        structured = true;
      }
    }

    return { text, confidence: data.confidence, structured };
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
  if (confidence < 15) return false;

  const cleaned = text.trim();
  const readable = cleaned.match(/[a-zA-Z가-힣ぁ-んァ-ヶ一-龥0-9.,!?;:'"\s\-()]/g);
  const ratio = readable ? readable.length / cleaned.length : 0;
  return ratio > 0.3;
}
