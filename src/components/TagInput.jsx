import { useId, useRef, useState } from 'react';

/**
 * 자유 입력 태그.
 * Enter 또는 쉼표로 확정하고, 빈 입력에서 Backspace 를 누르면 마지막 태그를 지운다.
 *
 * ─ Enter 는 태그만 확정한다 ─────────────────────────────────
 *
 * 이 입력칸은 기록 작성 <form> 안에 있다. Enter 를 그냥 두면 브라우저의
 * '암시적 제출'이 일어나 태그를 넣으려다 기록이 저장된다. 그래서 Enter 는
 * 조합 중이든 아니든 **항상** preventDefault 한다. 기록 저장은 저장 버튼이나
 * Ctrl(⌘)+Enter 로만 한다 (Ctrl+Enter 는 폼 쪽에서 받는다).
 *
 * ─ 한글 IME ────────────────────────────────────────────────
 *
 * 한글은 마지막 글자가 '조합 중'인 채로 Enter 가 눌린다. 브라우저마다 순서가 다르다.
 *   - 조합 중 Enter keydown(isComposing) → compositionend (Windows Chrome 등)
 *   - 조합 중 Enter keydown → compositionend → 조합 아닌 Enter keydown 한 번 더 (macOS 등)
 * 조합 중에 바로 확정하면 ① 아직 확정 안 된 마지막 글자가 빠진 태그가 들어가고,
 * ② 입력칸을 비운 뒤 IME 가 그 글자를 다시 써 넣어 '마지막 글자가 남는' 현상이 생긴다.
 * 두 번째 Enter 까지 오는 브라우저에서는 같은 태그가 두 번 들어가기도 한다.
 *
 * 그래서 조합 중 Enter 는 '확정 예약'만 해 두고 compositionend 뒤에 확정한다.
 * 중복은 최신 태그 목록을 ref 로 들고 비교해 막는다 — props 의 value 는
 * 같은 이벤트 루프 안에서는 아직 갱신 전이라 믿을 수 없다.
 */
export default function TagInput({ value, onChange, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const listId = useId();
  const inputRef = useRef(null);

  // 같은 틱 안에서 두 번 확정돼도 중복이 생기지 않도록 최신값을 직접 쥔다.
  const valueRef = useRef(value);
  valueRef.current = value;
  const composingRef = useRef(false);
  const pendingCommitRef = useRef(false);

  /** 쉼표로 나뉜 여러 태그를 한 번에 확정한다 (붙여넣기 대비) */
  const commit = (raw) => {
    const parts = String(raw ?? '')
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);

    let next = valueRef.current;
    for (const tag of parts) {
      if (next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue;
      next = [...next, tag];
    }
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChange(next);
    }
    setDraft('');
  };

  const isComposing = (e) =>
    composingRef.current || e.nativeEvent?.isComposing || e.keyCode === 229;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      // 조합 중이든 아니든 폼 제출로 번지지 않게 막는다.
      e.preventDefault();
      // Ctrl+Enter 는 폼이 '저장'으로 처리한다. 여기서는 쓰던 태그만 확정해 둔다.
      if (isComposing(e)) {
        pendingCommitRef.current = true;
        return;
      }
      commit(e.currentTarget.value);
      return;
    }

    if (e.key === ',' && !isComposing(e)) {
      e.preventDefault();
      commit(e.currentTarget.value);
      return;
    }

    if (e.key === 'Backspace' && !isComposing(e) && e.currentTarget.value === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    if (!pendingCommitRef.current) return;
    pendingCommitRef.current = false;
    // compositionend 직후에는 마지막 글자가 아직 value 에 반영되지 않은 브라우저가 있다.
    // 한 틱 뒤 입력칸의 실제 값으로 확정한다.
    setTimeout(() => {
      const input = inputRef.current;
      if (input) commit(input.value);
    }, 0);
  };

  return (
    <div className="taginput">
      {value.length > 0 && (
        <div className="tag-list">
          {value.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
              <button
                type="button"
                className="tag__remove"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`${tag} 태그 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        className="input"
        value={draft}
        list={listId}
        onChange={(e) => {
          const next = e.target.value;
          // 쉼표가 들어오면(모바일 키보드·붙여넣기·조합 중 쉼표) 그 앞까지 확정한다.
          // 조합 중에는 손대지 않는다 — 값을 바꾸면 IME 가 글자를 다시 써 넣는다.
          if (!composingRef.current && /[,，、]/.test(next)) {
            const lastSep = Math.max(next.lastIndexOf(','), next.lastIndexOf('，'), next.lastIndexOf('、'));
            commit(next.slice(0, lastSep));
            setDraft(next.slice(lastSep + 1).trimStart());
            return;
          }
          setDraft(next);
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={handleCompositionEnd}
        onBlur={(e) => commit(e.currentTarget.value)}
        placeholder="태그 입력 후 Enter (쉼표로도 구분)"
        enterKeyHint="done"
      />
      <datalist id={listId}>
        {suggestions.map(({ tag }) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
