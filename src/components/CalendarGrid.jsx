import { Link } from 'react-router-dom';
import SubjectDot from './SubjectDot.jsx';
import { subjectPaint } from '../lib/color.js';
import {
  parseMonthKey,
  daysInMonth,
  firstWeekdayOfMonth,
  WEEKDAY_LABELS,
  todayKey,
} from '../lib/date.js';

/** 한 칸에 보여줄 라벨의 최대 개수. 넘으면 +N 으로 줄인다. */
const MAX_LABELS = 3;

/**
 * 월 단위 캘린더.
 *
 * 칸마다 그날의 기록을 '점 + 제목' 라벨로 쌓는다. 점 색은 과목색이고 투명도는 항상 1 이다.
 * 이 화면은 "그날 뭘 했나"를 보는 곳이라 활성도(최근성) 개념이 필요 없다.
 *
 * ─ 링크가 겹치지 않게 ─
 * 칸 전체(그날 화면)와 라벨(그 기록)이 모두 링크다. <a> 안에 <a> 를 넣을 수 없으므로
 * 칸 링크는 칸을 덮는 투명한 층으로 깔고, 라벨 링크를 그 위에 올린다.
 *
 * @param {{ monthKey: string, labelsOnDate: (dateKey) => Array }} props
 */
export default function CalendarGrid({ monthKey, labelsOnDate }) {
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
          const labels = labelsOnDate(dateKey);
          const shown = labels.slice(0, MAX_LABELS);
          const overflow = labels.length - shown.length;
          const isToday = dateKey === today;
          const subjectNames = [...new Set(labels.map((l) => l.subject.name))];

          return (
            <div
              key={dateKey}
              className={`calendar__day${isToday ? ' calendar__day--today' : ''}${
                labels.length > 0 ? ' calendar__day--active' : ''
              }`}
            >
              <Link
                to={`/day/${dateKey}`}
                className="calendar__daylink"
                aria-label={`${month}월 ${day}일${
                  labels.length > 0
                    ? `, 기록 ${labels.length}개 (${subjectNames.join(', ')})`
                    : ', 기록 없음'
                }`}
              />
              <span className="calendar__num" aria-hidden="true">
                {day}
              </span>
              {shown.length > 0 && (
                <span className="calendar__labels">
                  {shown.map((label) => (
                    <Link
                      key={label.entry.id}
                      to={`/day/${dateKey}/e/${label.entry.id}`}
                      className="calendar__label"
                      title={label.tooltip}
                      style={{ '--label-color': subjectPaint(label.subject, 1), '--label-bg': subjectPaint(label.subject, 0.14) }}
                    >
                      <SubjectDot subject={label.subject} size={6} />
                      <span className="calendar__labeltext">{label.text}</span>
                    </Link>
                  ))}
                  {overflow > 0 && (
                    <Link
                      to={`/day/${dateKey}`}
                      className="calendar__more"
                      title={labels
                        .slice(MAX_LABELS)
                        .map((l) => l.text)
                        .join('\n')}
                    >
                      +{overflow}
                    </Link>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
