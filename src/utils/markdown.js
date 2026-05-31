/**
 * 한 줄이 OCR 노이즈(사진·아이콘·UI에서 잘못 인식된 쓰레기)인지 판별한다.
 * 신뢰도 필터를 통과한 잔여 노이즈를 보수적으로 제거한다.
 * 정상 문장은 글자 비율이 높아 영향을 받지 않는다.
 */
function isNoiseLine(s) {
  const t = s.trim();
  if (!t) return false;

  const len = [...t].length;
  const letters = (t.match(/[A-Za-z가-힣ぁ-んァ-ヶ一-龥]/g) || []).length;
  const letterRatio = len > 0 ? letters / len : 0;
  // 정상 텍스트엔 거의 없는 기호들 (역슬래시·파이프·물결·괄호류 등)
  const weird = (t.match(/[\\|~`^<>{}[\]_]/g) || []).length;
  // 6자리 이상 연속 숫자 (정상 문서의 연도·가격엔 드묾)
  const hasLongDigitRun = /\d{6,}/.test(t);
  // 숫자와 글자가 직접 붙은 토큰 (예: "1005나", "839이") — 전형적 OCR 노이즈
  const hasDigitLetterGlue = /[가-힣A-Za-z]\d{3,}|\d{3,}[가-힣A-Za-z]/.test(t);

  // 보수적 규칙만 사용한다. 정상 본문(날짜·수식·가격 포함)을 지우지 않기 위해
  // "거의 확실한" 노이즈 신호에만 반응한다. 1차 필터는 OCR 단계의 신뢰도 검사다.
  if (t.includes('\\')) return true;                       // 역슬래시
  if (weird >= 2) return true;                             // 기호 군집
  if (letters === 0 && len >= 4) return true;              // 글자 없는 숫자·기호 덩어리
  if (hasLongDigitRun && letterRatio < 0.6) return true;   // 긴 숫자열 + 글자 희박
  if (hasDigitLetterGlue && letterRatio < 0.5) return true; // 숫자-글자 접합 + 글자 희박

  return false;
}

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

  // 각 줄 trim + 노이즈 줄 제거
  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => !isNoiseLine(l))
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
    // 데이터성 줄(키:값, 날짜, 분수 등)은 제목으로 보지 않는다.
    const looksLikeData = /[:：]/.test(line) || /\d{4}/.test(line) || /\d+\s*[-/.]\s*\d+/.test(line);
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
    const afterEmpty = prevLine === '' || i === 0;

    if (
      isShort &&
      !isJustNumber &&
      !looksLikeData &&
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
 * Markdown → HTML 렌더링. 간단한 Markdown 문법을 HTML로 변환한다.
 */
export function markdownToHtml(md) {
  if (!md) return '';

  // 코드 블록 보호 (```...```)
  const codeBlocks = [];
  let html = md.replace(/```([\s\S]*?)```/g, (_, code) => {
    codeBlocks.push(code.trim());
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // 인라인 코드 보호
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    inlineCodes.push(code);
    return `%%INLINE_${inlineCodes.length - 1}%%`;
  });

  // 줄 단위 처리
  const lines = html.split('\n');
  const output = [];
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 코드블록 복원
    const cbMatch = line.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (cbMatch) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      output.push(`<pre><code>${escapeHtml(codeBlocks[parseInt(cbMatch[1])])}</code></pre>`);
      continue;
    }

    // 수평선
    if (/^---+$/.test(line.trim())) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      output.push('<hr/>');
      continue;
    }

    // 제목
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      const level = headingMatch[1].length;
      output.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
      continue;
    }

    // 비순서 목록
    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
        output.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      output.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // 순서 목록
    const olMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');
        output.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      output.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // 빈 줄
    if (line.trim() === '') {
      if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
      continue;
    }

    // 일반 텍스트 → 단락
    if (inList) { output.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false; }
    output.push(`<p>${inlineFormat(line)}</p>`);
  }

  if (inList) output.push(listType === 'ul' ? '</ul>' : '</ol>');

  let result = output.join('\n');

  // 인라인 코드 복원
  result = result.replace(/%%INLINE_(\d+)%%/g, (_, idx) =>
    `<code>${escapeHtml(inlineCodes[parseInt(idx)])}</code>`
  );

  return result;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
  let s = escapeHtml(text);
  // 볼드
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // 이탤릭
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/_(.+?)_/g, '<em>$1</em>');
  // 인라인 코드 플레이스홀더는 그대로 유지
  return s;
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
