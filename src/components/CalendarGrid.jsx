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

/** 깃발에 마우스를 올렸을 때 보여줄 한 줄 — '통계 · Week 5 (D-day)' */
function deadlineLine(item) {
  const what = item.kind === 'subject' ? `${item.subject.name} (과목 마감)` : `${item.subject.name} · ${item.block.name}`;
  return `${what} — ${item.done ? '완료' : item.info.label}`;
}

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
 * ─ 마감 깃발 ─
 * 마감이 있는 날은 칸 오른쪽 위에 ⚑ (여럿이면 ⚑2) 만 단다. 기록 라벨 자리를 뺏지 않기 위해서다 —
 * 좁은 화면에서는 라벨 글자가 몇 자밖에 안 들어가서, 마감 이름까지 넣으면 둘 다 읽을 수 없다.
 * 무엇의 마감인지는 마우스를 올리면(title) 보이고, 칸을 누르면 그날 화면의 '이 날 마감'에 나온다.
 * 지났는데 끝나지 않은 것이 하나라도 있으면 --danger, 전부 끝났으면 흐리게.
 *
 * @param {{ monthKey: string, labelsOnDate: (dateKey) => Array, deadlinesOnDate?: (dateKey) => Array }} props
 */
export default function CalendarGrid({ monthKey, labelsOnDate, deadlinesOnDate = () => [] }) {
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
          const deadlines = deadlinesOnDate(dateKey);
          const deadlineTip = deadlines.map(deadlineLine).join('\n');
          const flagTone = deadlines.some((d) => d.info.overdue && !d.done)
            ? ' calendar__flag--overdue'
            : deadlines.every((d) => d.done)
              ? ' calendar__flag--done'
              : '';

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
                }${deadlines.length > 0 ? `, 마감 ${deadlines.length}개 (${deadlineTip.replace(/\n/g, ', ')})` : ''}`}
              />
              <span className="calendar__num" aria-hidden="true">
                {day}
              </span>
              {deadlines.length > 0 && (
                // 칸 링크 위에 올라가는 층이라 이것도 그날 화면으로 가는 링크로 둔다 (눌러도 같은 곳)
                <Link
                  to={`/day/${dateKey}`}
                  className={`calendar__flag${flagTone}`}
                  title={`마감\n${deadlineTip}`}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  ⚑{deadlines.length > 1 ? deadlines.length : ''}
                </Link>
              )}
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
