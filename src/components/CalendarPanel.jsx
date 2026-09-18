import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectSubjectsOnDate } from '../state/selectors.js';
import CalendarGrid from './CalendarGrid.jsx';
import SubjectDot from './SubjectDot.jsx';
import { addMonths, formatMonthLabel, monthKeyOf, todayKey } from '../lib/date.js';

/**
 * 월 달력 + 이동 + 범례.
 * 홈(이번 달)과 캘린더 전용 화면(임의의 달)이 같은 것을 쓴다.
 */
export default function CalendarPanel({ monthKey }) {
  const { state, index } = useStore();

  const subjectsOnDate = useCallback(
    (dateKey) => selectSubjectsOnDate(state, index, dateKey),
    [state, index]
  );

  const thisMonth = monthKeyOf(todayKey());

  // 이 달에 기록이 있는 과목과 그 일수 — 하단 범례
  const monthSubjects = new Map();
  for (const [dateKey, entries] of index.entriesByDate) {
    if (!dateKey.startsWith(monthKey) || entries.length === 0) continue;
    for (const subject of subjectsOnDate(dateKey)) {
      monthSubjects.set(subject.id, (monthSubjects.get(subject.id) ?? 0) + 1);
    }
  }

  return (
    <>
      <div className="monthnav">
        <Link
          to={`/calendar/${addMonths(monthKey, -1)}`}
          className="btn btn--sm"
          aria-label="이전 달"
        >
          ‹
        </Link>
        <h2 className="monthnav__label">{formatMonthLabel(monthKey)}</h2>
        <Link
          to={`/calendar/${addMonths(monthKey, 1)}`}
          className="btn btn--sm"
          aria-label="다음 달"
        >
          ›
        </Link>
      </div>

      {monthKey !== thisMonth && (
        <Link to="/" className="btn btn--ghost btn--sm calendar__todaybtn">
          이번 달로
        </Link>
      )}

      <CalendarGrid monthKey={monthKey} subjectsOnDate={subjectsOnDate} />

      {monthSubjects.size > 0 && (
        <section className="section">
          <h3 className="section__title">이 달에 공부한 과목</h3>
          <ul className="legend">
            {[...monthSubjects.entries()].map(([subjectId, days]) => {
              const subject = state.subjects[subjectId];
              if (!subject) return null;
              return (
                <li key={subjectId}>
                  <Link to={`/subjects/${subjectId}`} className="legend__item">
                    <SubjectDot subject={subject} size={9} />
                    <span>{subject.name}</span>
                    <span className="legend__count">{days}일</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
