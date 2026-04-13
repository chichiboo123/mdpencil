/**
 * OCR 원본 텍스트를 읽기 좋은 Markdown 구조로 후처리한다.
 * 완벽한 구조 분석은 불가능하므로, 합리적인 휴리스틱으로 정리한다.
 */
export function ocrTextToMarkdown(raw) {
  if (!raw || !raw.trim()) return '';

  let text = raw;

  // 연속 공백을 하나로
  text = text.replace(/[^\S\n]{2,}/g, ' ');

  // 각 줄 앞뒤 공백 제거
  text = text
    .split('\n')
    .map((line) => line.trim())
    .join('\n');

  // 3개 이상 연속 빈 줄을 2개로
  text = text.replace(/\n{3,}/g, '\n\n');

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

    // 번호 목록 패턴 (1. 2. 3. 등) - 이미 올바른 형식
    if (/^\d+[.)]\s/.test(line)) {
      result.push(line);
      continue;
    }

    // 짧은 줄(제목 후보) 감지: 문장 종결 없이 15자 이하이고 앞뒤에 빈 줄이 있는 경우
    const isShort = line.length <= 20 && !/[.。!?!？,，]$/.test(line);
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    const surroundedByEmpty = prevLine === '' || i === 0;

    if (isShort && surroundedByEmpty && !line.startsWith('#') && !line.startsWith('-')) {
      // 첫 줄이거나 빈 줄 뒤의 짧은 텍스트 → 제목 후보
      if (i === 0 || (prevLine === '' && nextLine !== '')) {
        // 첫 번째로 등장하는 제목은 #, 나머지는 ##
        const hasHeading = result.some((r) => r.startsWith('#'));
        line = hasHeading ? `## ${line}` : `# ${line}`;
      }
    }

    // 글머리 기호 패턴 변환: ○, ●, ◆, ▶, ·, ※ 등 → -
    line = line.replace(/^[○●◆◇▶▷·※•]\s*/, '- ');

    result.push(line);
  }

  return result.join('\n').trim();
}

/**
 * Markdown에서 TTS용 읽기 텍스트를 생성한다.
 * #, ##, -, ```, ** 등의 문법 기호를 제거하거나 자연스러운 형태로 변환한다.
 */
export function markdownToReadableText(md) {
  if (!md) return '';

  let text = md;

  // 코드 블록 제거
  text = text.replace(/```[\s\S]*?```/g, '');

  // 인라인 코드 제거
  text = text.replace(/`([^`]+)`/g, '$1');

  // 제목 기호 → 줄바꿈 유지
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 굵게, 기울임 제거
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // 목록 기호 제거
  text = text.replace(/^[-*+]\s+/gm, '');

  // 링크 → 텍스트만
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 이미지 제거
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 수평선 제거
  text = text.replace(/^---+$/gm, '');

  // 연속 빈 줄 정리
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}
