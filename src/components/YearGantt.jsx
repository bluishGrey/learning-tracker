import { useStore } from '../state/StoreContext.jsx';
import { selectYearGantt } from '../state/selectors.js';
import SubjectDot from './SubjectDot.jsx';
import { layeredBackground } from '../lib/color.js';
import { yearFraction, todayKey, parseDateKey, formatMonthDay } from '../lib/date.js';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 연간 활동 요약 — 간트 스타일.
 *
 * 세로축은 과목 한 줄, 가로축은 1월~12월.
 * 막대는 그 해 첫 기록부터 마지막 기록까지 걸쳐 있다.
 *
 * 두 가지를 서로 다른 축으로 인코딩한다:
 *   막대 진하기 = 활동 밀도   (기록 수 ÷ 기간, 비선형)
 *   라벨 진하기 = 활성도      (마지막 활동 이후 경과일)
 * 한 채널에 둘을 섞으면 어느 쪽도 읽히지 않는다.
 *
 * 장식·조망용이라 클릭하지 않는다.
 */
export default function YearGantt({ year }) {
  const { state, index } = useStore();
  const today = todayKey();
  const { rows } = selectYearGantt(state, index, year, today);

  if (rows.length === 0) {
    return <p className="gantt__empty">{year}년에는 기록이 없습니다.</p>;
  }

  const monthTicks = MONTHS.map((month) => ({
    month,
    left: yearFraction(`${year}-${String(month).padStart(2, '0')}-01`) * 100,
  }));

  const todayLeft = parseDateKey(today)?.year === year ? yearFraction(today) * 100 : null;

  return (
    <div className="gantt" aria-hidden="true">
      <div className="gantt__months">
        <span className="gantt__label" />
        <div className="gantt__track gantt__track--head">
          {monthTicks.map(({ month, left }) => (
            <span key={month} className="gantt__month" style={{ left: `${left}%` }}>
              {month}
            </span>
          ))}
        </div>
      </div>

      {rows.map((row) => (
        <div className="gantt__row" key={row.subject.id}>
          <span
            className="gantt__label"
            style={{ opacity: 0.45 + 0.55 * row.labelAlpha }}
            title={row.subject.name}
          >
            <SubjectDot subject={row.subject} alpha={row.labelAlpha} size={8} />
            <span className="gantt__name">{row.subject.name}</span>
          </span>

          <div className="gantt__track">
            {monthTicks.map(({ month, left }) => (
              <span key={month} className="gantt__tick" style={{ left: `${left}%` }} />
            ))}

            {todayLeft !== null && (
              <span className="gantt__today" style={{ left: `${todayLeft}%` }} />
            )}

            <span
              className="gantt__bar"
              style={{
                ...layeredBackground(row.subject, row.barAlpha),
                left: `${row.start * 100}%`,
                width: `${Math.max((row.end - row.start) * 100, 0)}%`,
              }}
            />
          </div>
        </div>
      ))}

      <p className="gantt__caption">
        막대는 첫 기록 ~ 마지막 기록, 진하기는 그 기간의 기록 밀도입니다.
      </p>
    </div>
  );
}

/** 툴팁 없이도 대강 읽히도록 기간을 문장으로 (접근성 대체 텍스트용) */
export function describeGanttRow(row) {
  return `${row.subject.name}: ${formatMonthDay(row.firstDate)} ~ ${formatMonthDay(
    row.lastDate
  )}, 기록 ${row.entryCount}개`;
}
