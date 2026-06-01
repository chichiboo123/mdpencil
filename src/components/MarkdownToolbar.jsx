import { useTranslation } from 'react-i18next';
import styles from './MarkdownToolbar.module.css';

/**
 * 편집기 텍스트영역에 마크다운 문법을 쉽게 삽입/토글하는 서식 툴바.
 * 모든 동작은 현재 선택 영역을 기준으로 동작하며, 같은 버튼을 다시 누르면
 * (가능한 경우) 해제된다.
 */
export default function MarkdownToolbar({ textareaRef, value, onChange, onOpenGuide }) {
  const { t } = useTranslation();

  const setSelection = (start, end) => {
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(start, end);
    });
  };

  const getSel = () => {
    const ta = textareaRef.current;
    if (!ta) return null;
    return { s: ta.selectionStart, e: ta.selectionEnd };
  };

  const getLineRange = (s, e) => {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = value.indexOf('\n', e);
    if (lineEnd === -1) lineEnd = value.length;
    return { lineStart, lineEnd };
  };

  // 선택 영역을 marker로 감싼다. 이미 감싸져 있으면 해제(토글).
  const wrapInline = (marker, placeholderKey) => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const selected = value.slice(s, e);
    const ml = marker.length;
    const before = value.slice(s - ml, s);
    const after = value.slice(e, e + ml);

    if (selected && before === marker && after === marker) {
      const nv = value.slice(0, s - ml) + selected + value.slice(e + ml);
      onChange(nv);
      setSelection(s - ml, e - ml);
      return;
    }
    const text = selected || t(`mdToolbar.${placeholderKey}`);
    const nv = value.slice(0, s) + marker + text + marker + value.slice(e);
    onChange(nv);
    setSelection(s + ml, s + ml + text.length);
  };

  // 제목: 선택된 줄들에 #/##/### 토글 (다른 레벨이면 교체)
  const heading = (level) => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const { lineStart, lineEnd } = getLineRange(s, e);
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const hashes = '#'.repeat(level);
    const re = new RegExp(`^#{${level}}\\s`);
    const allSame = lines.every((l) => re.test(l));
    const newLines = lines.map((l) => {
      const stripped = l.replace(/^#{1,6}\s+/, '');
      return allSame ? stripped : `${hashes} ${stripped}`;
    });
    const joined = newLines.join('\n');
    onChange(value.slice(0, lineStart) + joined + value.slice(lineEnd));
    setSelection(lineStart, lineStart + joined.length);
  };

  // 줄 접두어 토글 (목록 "- ", 인용 "> ")
  const linePrefix = (prefix) => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const { lineStart, lineEnd } = getLineRange(s, e);
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const all = lines.every((l) => l.startsWith(prefix));
    const newLines = lines.map((l) => (all ? l.slice(prefix.length) : prefix + l));
    const joined = newLines.join('\n');
    onChange(value.slice(0, lineStart) + joined + value.slice(lineEnd));
    setSelection(lineStart, lineStart + joined.length);
  };

  // 번호 목록 토글
  const orderedList = () => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const { lineStart, lineEnd } = getLineRange(s, e);
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const all = lines.every((l) => /^\d+\.\s/.test(l));
    const newLines = lines.map((l, i) => (all ? l.replace(/^\d+\.\s/, '') : `${i + 1}. ${l}`));
    const joined = newLines.join('\n');
    onChange(value.slice(0, lineStart) + joined + value.slice(lineEnd));
    setSelection(lineStart, lineStart + joined.length);
  };

  const insertLink = () => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const selected = value.slice(s, e);
    const text = selected || t('mdToolbar.linkText');
    const snippet = `[${text}](url)`;
    onChange(value.slice(0, s) + snippet + value.slice(e));
    const urlStart = s + 1 + text.length + 2; // "[" + text + "]("
    setSelection(urlStart, urlStart + 3); // "url" 선택
  };

  const codeBlock = () => {
    const sel = getSel();
    if (!sel) return;
    const { s, e } = sel;
    const selected = value.slice(s, e) || t('mdToolbar.codeText');
    const pre = s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const snippet = `${pre}\`\`\`\n${selected}\n\`\`\`\n`;
    onChange(value.slice(0, s) + snippet + value.slice(e));
    const innerStart = s + pre.length + 4; // "```\n"
    setSelection(innerStart, innerStart + selected.length);
  };

  const insertHr = () => {
    const sel = getSel();
    if (!sel) return;
    const { s } = sel;
    const pre = s > 0 && value[s - 1] !== '\n' ? '\n' : '';
    const snippet = `${pre}---\n`;
    onChange(value.slice(0, s) + snippet + value.slice(s));
    const pos = s + snippet.length;
    setSelection(pos, pos);
  };

  const Btn = ({ onClick, icon, label, text }) => (
    <button type="button" className={styles.btn} onClick={onClick} title={label} aria-label={label}>
      {icon ? <span className="material-icons">{icon}</span> : <span className={styles.txtIcon}>{text}</span>}
    </button>
  );

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('mdToolbar.title')}>
      <div className={styles.group}>
        <Btn onClick={() => heading(1)} text="H1" label={t('mdToolbar.h1')} />
        <Btn onClick={() => heading(2)} text="H2" label={t('mdToolbar.h2')} />
        <Btn onClick={() => heading(3)} text="H3" label={t('mdToolbar.h3')} />
      </div>
      <div className={styles.sep} />
      <div className={styles.group}>
        <Btn onClick={() => wrapInline('**', 'sampleText')} icon="format_bold" label={t('mdToolbar.bold')} />
        <Btn onClick={() => wrapInline('*', 'sampleText')} icon="format_italic" label={t('mdToolbar.italic')} />
        <Btn onClick={() => wrapInline('~~', 'sampleText')} icon="format_strikethrough" label={t('mdToolbar.strike')} />
        <Btn onClick={() => wrapInline('`', 'codeText')} icon="code" label={t('mdToolbar.code')} />
      </div>
      <div className={styles.sep} />
      <div className={styles.group}>
        <Btn onClick={() => linePrefix('- ')} icon="format_list_bulleted" label={t('mdToolbar.ul')} />
        <Btn onClick={orderedList} icon="format_list_numbered" label={t('mdToolbar.ol')} />
        <Btn onClick={() => linePrefix('> ')} icon="format_quote" label={t('mdToolbar.quote')} />
      </div>
      <div className={styles.sep} />
      <div className={styles.group}>
        <Btn onClick={insertLink} icon="link" label={t('mdToolbar.link')} />
        <Btn onClick={codeBlock} icon="data_object" label={t('mdToolbar.codeblock')} />
        <Btn onClick={insertHr} icon="horizontal_rule" label={t('mdToolbar.hr')} />
      </div>
      <button type="button" className={styles.guideBtn} onClick={onOpenGuide}>
        <span className="material-icons" style={{ fontSize: '15px' }}>help_outline</span>
        {t('mdToolbar.guide')}
      </button>
    </div>
  );
}
