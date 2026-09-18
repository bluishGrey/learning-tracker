import { useId, useState } from 'react';

/**
 * 자유 입력 태그.
 * Enter 또는 쉼표로 확정하고, 빈 입력에서 Backspace 를 누르면 마지막 태그를 지운다.
 */
export default function TagInput({ value, onChange, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const listId = useId();

  const commit = (raw) => {
    const tag = raw.trim().replace(/,+$/, '').trim();
    if (!tag) return;
    const exists = value.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...value, tag]);
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
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
        className="input"
        value={draft}
        list={listId}
        onChange={(e) => {
          // 모바일 키보드에서 쉼표를 치면 곧바로 확정한다.
          if (e.target.value.endsWith(',')) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
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
