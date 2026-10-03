import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectReviewRows } from '../state/selectors.js';
import SubjectDot from './SubjectDot.jsx';
import { formatMonthDay, todayKey } from '../lib/date.js';

/**
 * 오늘의 복습 — 1·3·7·14일 전 기록의 '헷갈렸던 부분' 표에서 최대 3행.
 *
 * 정답 요약은 가려 두고 눌러야 펼친다. 펼친 상태는 저장하지 않는다(새로고침하면 다시 가려짐).
 * '복습 완료' 같은 기록도 남기지 않는다 — 날짜 계산만으로 동작한다.
 * 헷갈린 것(질문)을 누르면 원본 기록의 그 행으로 간다.
 */
export default function ReviewCard() {
  const { state, index } = useStore();
  const today = todayKey();
  const items = selectReviewRows(state, index, today);
  const [revealed, setRevealed] = useState(() => new Set());

  if (items.length === 0) return null;

  const toggle = (key) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="section reviewcard" aria-label="오늘의 복습">
      <div className="section__head">
        <h2 className="section__title">오늘의 복습</h2>
        <span className="section__note">1 · 3 · 7 · 14일 전 헷갈렸던 것</span>
      </div>

      <ul className="reviewcard__list">
        {items.map(({ entry, block, subject, row, daysAgo }) => {
          const key = `${entry.id}:${row.rowIndex}`;
          const open = revealed.has(key);
          return (
            <li key={key} className="reviewcard__item">
              <Link
                to={`/subjects/${subject.id}/${block.id}/e/${entry.id}?row=${row.rowIndex}`}
                className="reviewcard__q"
                title="원본 기록에서 보기"
              >
                {row.question || '(헷갈린 것 비어 있음)'}
              </Link>

              <button
                type="button"
                className={`reviewcard__a${open ? ' reviewcard__a--open' : ''}`}
                onClick={() => toggle(key)}
                aria-expanded={open}
              >
                {open ? row.answer || '(정답 요약 비어 있음)' : '정답 요약 보기'}
              </button>

              <p className="reviewcard__meta">
                <SubjectDot subject={subject} size={7} />
                {formatMonthDay(entry.date)} · {subject.name} / {block.name}
                <span className="reviewcard__badge">{daysAgo ? `${daysAgo}일 전` : '최근'}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
