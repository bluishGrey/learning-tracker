import { Link } from 'react-router-dom';

/**
 * 블록 한 줄. 완료 토글은 링크와 분리해 별도 버튼으로 둔다
 * (줄 전체가 링크라 체크만 하려다 화면이 이동하면 안 된다).
 */
export default function BlockRow({ block, to, entryCount, onToggle }) {
  return (
    <div className={`blockrow${block.isCompleted ? ' blockrow--done' : ''}`}>
      <button
        type="button"
        className="blockrow__check"
        onClick={onToggle}
        aria-pressed={block.isCompleted}
        aria-label={`${block.name} ${block.isCompleted ? '완료 해제' : '완료로 표시'}`}
      >
        <span className="blockrow__box" aria-hidden="true">
          {block.isCompleted ? '✓' : ''}
        </span>
      </button>

      <Link to={to} className="blockrow__body">
        <span className="blockrow__name">{block.name || '(이름 없음)'}</span>
        <span className="blockrow__meta">기록 {entryCount}개</span>
      </Link>
    </div>
  );
}
