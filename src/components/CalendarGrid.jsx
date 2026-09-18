import { Link } from 'react-router-dom';
import SubjectDot from './SubjectDot.jsx';
import {
  parseMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  WEEKDAY_LABELS,
  todayKey,
} from '../lib/date.js';

/** 한 칸에 표시할 점의 최대 개수. 넘으면 +n 으로 줄인다. */
const MAX_DOTS = 4;

/**
 * 월 단위 캘린더.
 *
 * 점의 색은 과목의 hue 이고 투명도는 항상 1 이다.
 * 이 화면은 "그날 뭘 했나"를 보는 곳이라 활성도(최근성) 개념이 필요 없다.
 * 활동이 없으면 점 자체가 없다.
 */
export default function CalendarGrid({ monthKey, subjectsOnDate }) {
  const { year, month } = parseMonthKey(monthKey);
  const leading = firstWeekdayOfMonth(year, month);
  const total = daysInMonth(year, month);
  const today = todayKey();

  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div className="calendar">
      <div className="calendar__weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, i) => (
          <span
            key={label}
            className={`calendar__weekday${i === 0 ? ' calendar__weekday--sun' : ''}${
              i === 6 ? ' calendar__weekday--sat' : ''
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="calendar__grid">
        {cells.map((day, i) => {
          if (day === null) return <span key={`pad-${i}`} className="calendar__pad" />;

          const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
          const subjects = subjectsOnDate(dateKey);
          const shown = subjects.slice(0, MAX_DOTS);
          const overflow = subjects.length - shown.length;
          const isToday = dateKey === today;

          return (
            <Link
              key={dateKey}
              to={`/day/${dateKey}`}
              className={`calendar__day${isToday ? ' calendar__day--today' : ''}${
                subjects.length > 0 ? ' calendar__day--active' : ''
              }`}
              aria-label={`${month}월 ${day}일${
                subjects.length > 0 ? `, ${subjects.map((s) => s.name).join(', ')}` : ', 기록 없음'
              }`}
            >
              <span className="calendar__num">{day}</span>
              <span className="calendar__dots">
                {shown.map((subject) => (
                  <SubjectDot key={subject.id} hue={subject.colorHue} size={7} />
                ))}
                {overflow > 0 && <span className="calendar__more">+{overflow}</span>}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
