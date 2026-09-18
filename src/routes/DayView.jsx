import { Link, useParams } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectEntriesOfDate } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import EntryRow from '../components/EntryRow.jsx';
import NotFound from './NotFound.jsx';
import {
  isValidDateKey,
  monthKeyOf,
  formatMonthLabel,
  formatMonthDay,
  formatFullDate,
  formatRelativeDay,
  addDays,
} from '../lib/date.js';

/** 경로 A의 두 번째 단계 — 그날의 기록 목록 */
export default function DayView() {
  const { dateKey } = useParams();
  const { state, index } = useStore();

  if (!isValidDateKey(dateKey)) return <NotFound />;

  const entries = selectEntriesOfDate(index, dateKey);
  const monthKey = monthKeyOf(dateKey);

  return (
    <main className="page">
      <Breadcrumb
        items={[
          { label: '홈', to: '/' },
          { label: formatMonthLabel(monthKey), to: `/calendar/${monthKey}` },
          { label: formatMonthDay(dateKey) },
        ]}
      />

      <h1 className="page__title">{formatFullDate(dateKey)}</h1>
      <p className="page__sub">
        {formatRelativeDay(dateKey)} · 기록 {entries.length}개
      </p>

      <div className="daynav">
        <Link to={`/day/${addDays(dateKey, -1)}`} className="btn btn--sm">
          ‹ 전날
        </Link>
        <Link to={`/new?date=${dateKey}`} className="btn btn--primary btn--sm">
          + 이 날짜에 기록
        </Link>
        <Link to={`/day/${addDays(dateKey, 1)}`} className="btn btn--sm">
          다음날 ›
        </Link>
      </div>

      <section className="section">
        {entries.length === 0 ? (
          <div className="empty">이 날짜에는 기록이 없습니다.</div>
        ) : (
          <ul className="stack">
            {entries.map((entry) => {
              const block = state.blocks[entry.blockId];
              const subject = block ? state.subjects[block.subjectId] : null;
              return (
                <li key={entry.id}>
                  <EntryRow
                    entry={entry}
                    subject={subject}
                    block={block}
                    to={`/day/${dateKey}/e/${entry.id}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
