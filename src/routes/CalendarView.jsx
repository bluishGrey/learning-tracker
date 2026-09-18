import { useCallback } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectSubjectsOnDate } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import CalendarGrid from '../components/CalendarGrid.jsx';
import SubjectDot from '../components/SubjectDot.jsx';
import {
  isValidMonthKey,
  addMonths,
  formatMonthLabel,
  monthKeyOf,
  todayKey,
} from '../lib/date.js';

export default function CalendarView() {
  const { monthKey } = useParams();
  const { state, index } = useStore();

  const subjectsOnDate = useCallback(
    (dateKey) => selectSubjectsOnDate(state, index, dateKey),
    [state, index]
  );

  if (!isValidMonthKey(monthKey)) {
    return <Navigate to={`/calendar/${monthKeyOf(todayKey())}`} replace />;
  }

  const thisMonth = monthKeyOf(todayKey());

  // 이 달에 기록이 있는 과목들 — 하단 범례
  const monthSubjects = new Map();
  for (const [dateKey, entries] of index.entriesByDate) {
    if (!dateKey.startsWith(monthKey) || entries.length === 0) continue;
    for (const subject of subjectsOnDate(dateKey)) {
      monthSubjects.set(subject.id, (monthSubjects.get(subject.id) ?? 0) + 1);
    }
  }

  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: formatMonthLabel(monthKey) }]} />

      <div className="monthnav">
        <Link
          to={`/calendar/${addMonths(monthKey, -1)}`}
          className="btn btn--sm"
          aria-label="이전 달"
        >
          ‹
        </Link>
        <h1 className="monthnav__label">{formatMonthLabel(monthKey)}</h1>
        <Link
          to={`/calendar/${addMonths(monthKey, 1)}`}
          className="btn btn--sm"
          aria-label="다음 달"
        >
          ›
        </Link>
      </div>

      {monthKey !== thisMonth && (
        <Link to={`/calendar/${thisMonth}`} className="btn btn--ghost btn--sm calendar__todaybtn">
          이번 달로
        </Link>
      )}

      <CalendarGrid monthKey={monthKey} subjectsOnDate={subjectsOnDate} />

      {monthSubjects.size > 0 && (
        <section className="section">
          <h2 className="section__title">이 달에 공부한 과목</h2>
          <ul className="legend">
            {[...monthSubjects.entries()].map(([subjectId, days]) => {
              const subject = state.subjects[subjectId];
              if (!subject) return null;
              return (
                <li key={subjectId}>
                  <Link to={`/subjects/${subjectId}`} className="legend__item">
                    <SubjectDot hue={subject.colorHue} size={9} />
                    <span>{subject.name}</span>
                    <span className="legend__count">{days}일</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
