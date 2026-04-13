/**
 * OCR 원본 텍스트를 정리하고 Markdown 구조로 변환한다.
 */
export function ocrTextToMarkdown(raw) {
  if (!raw || !raw.trim()) return '';

  let text = raw;

  // --- Phase 1: OCR 아티팩트 정리 ---

  // 스마트 따옴표 → 일반 따옴표
  text = text.replace(/[""„«»]/g, '"');
  text = text.replace(/[''‚‹›]/g, "'");

  // 숫자와 붙지 않은 단독 특수문자 제거 (%, $, @, ^ 등)
  text = text.replace(/(?<!\d)[%$](?!\d)/g, '');
  text = text.replace(/(?<![a-zA-Z가-힣ぁ-んァ-ヶ一-龥\d])[|¦](?![a-zA-Z가-힣ぁ-んァ-ヶ一-龥\d])/g, '');

  // Zero-width 문자, soft hyphen 제거
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // 연속 공백 → 하나
  text = text.replace(/[^\S\n]{2,}/g, ' ');

  // 각 줄 trim
  text = text
    .split('\n')
    .map((l) => l.trim())
    .join('\n');

  // 3+ 빈 줄 → 2줄
  text = text.replace(/\n{3,}/g, '\n\n');

  // --- Phase 2: Markdown 구조화 ---

  const lines = text.split('\n');
  const result = [];
  let prevEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line === '') {
      if (!prevEmpty) {
        result.push('');
        prevEmpty = true;
      }
      continue;
    }
    prevEmpty = false;

    // 번호 목록 패턴
    if (/^\d+[.)]\s/.test(line)) {
      result.push(line);
      continue;
    }

    // 제목 후보: 짧은 줄 + 문장종결 없음 + 숫자만은 제외
    const isShort = line.length <= 20 && !/[.。!?？,，;；:]$/.test(line);
    const isJustNumber = /^\d+$/.test(line);
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    const afterEmpty = prevLine === '' || i === 0;

    if (
      isShort &&
      !isJustNumber &&
      afterEmpty &&
      nextLine !== '' &&
      !line.startsWith('#') &&
      !line.startsWith('-')
    ) {
      const hasHeading = result.some((r) => r.startsWith('#'));
      line = hasHeading ? `## ${line}` : `# ${line}`;
    }

    // 글머리 기호 → -
    line = line.replace(/^[○●◆◇▶▷·※•]\s*/, '- ');

    result.push(line);
  }

  return result.join('\n').trim();
}

/**
 * Markdown → TTS용 평문. 문법 기호를 제거한다.
 */
export function markdownToReadableText(md) {
  if (!md) return '';

  let text = md;
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  text = text.replace(/^[-*+]\s+/gm, '');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  text = text.replace(/^---+$/gm, '');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
