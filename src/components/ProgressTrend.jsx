import { subjectPaint } from '../lib/color.js';
import { daysBetween, formatMonthDay, formatFullDate } from '../lib/date.js';

/**
 * 블록 안의 진행률 추이 — 기록에 적어 둔 진행률을 시간순으로 이은 꺾은선.
 *
 * 값이 하나뿐인 계열이라 범례를 두지 않는다 (색이 하나인데 상자를 만들면
 * 제목을 두 번 쓰는 셈이다). 대신 마지막 점에 값을 직접 붙인다.
 *
 * 세로축은 0~100 으로 **고정**한다. 데이터 범위에 맞춰 늘리면 60→65 의 작은
 * 변화가 화면 전체를 가로지르는 급등처럼 보인다. 진행률은 기준이 정해진 값이므로
 * 그 기준 그대로 보여주는 쪽이 정직하다.
 *
 * 가로축은 기록 순서가 아니라 **실제 날짜 간격**이다. 한 달 쉰 구간과 이틀 간격이
 * 같은 폭으로 그려지면 "꾸준히 했다"는 거짓 인상을 준다.
 *
 * 값은 그림에만 있지 않다 — 아래 기록 목록에도 숫자로 함께 찍히므로,
 * 색이나 그림을 읽지 못하는 상황에서도 같은 정보를 얻을 수 있다.
 */

const VIEW_W = 640;
const VIEW_H = 180;
const PAD = { top: 16, right: 44, bottom: 24, left: 30 };
const GRID = [0, 50, 100];

export default function ProgressTrend({ points, subject }) {
  if (!points || points.length === 0) return null;

  const stroke = subjectPaint(subject, 1);
  const fill = subjectPaint(subject, 0.1);

  const plotW = VIEW_W - PAD.left - PAD.right;
  const plotH = VIEW_H - PAD.top - PAD.bottom;

  const first = points[0].date;
  const last = points[points.length - 1].date;
  const span = daysBetween(first, last) ?? 0;

  // 같은 날짜뿐이면 날짜 비율로 나눌 수 없다. 그때만 등간격으로 눕힌다.
  const xOf = (point, i) => {
    if (points.length === 1) return PAD.left + plotW / 2;
    if (span <= 0) return PAD.left + (plotW * i) / (points.length - 1);
    return PAD.left + (plotW * (daysBetween(first, point.date) ?? 0)) / span;
  };
  const yOf = (percent) => PAD.top + plotH * (1 - percent / 100);

  const coords = points.map((point, i) => ({ ...point, x: xOf(point, i), y: yOf(point.percent) }));
  const line = coords.map((c) => `${round(c.x)},${round(c.y)}`).join(' ');
  const areaPath = `M ${round(coords[0].x)},${round(PAD.top + plotH)} L ${coords
    .map((c) => `${round(c.x)},${round(c.y)}`)
    .join(' L ')} L ${round(coords[coords.length - 1].x)},${round(PAD.top + plotH)} Z`;

  const lastPoint = coords[coords.length - 1];
  const summary = `${formatFullDate(first)}부터 ${formatFullDate(last)}까지 진행률 ${points[0].percent}%에서 ${lastPoint.percent}%로 변화`;

  return (
    <figure className="trend">
      <svg
        className="trend__svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={summary}
      >
        {/* 눈금 — 데이터보다 뒤로 물러나 있어야 한다 */}
        {GRID.map((value) => (
          <g key={value}>
            <line
              className="trend__grid"
              x1={PAD.left}
              x2={VIEW_W - PAD.right}
              y1={yOf(value)}
              y2={yOf(value)}
            />
            <text className="trend__tick" x={PAD.left - 8} y={yOf(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}

        {points.length > 1 && (
          <>
            <path d={areaPath} fill={fill} />
            <polyline
              points={line}
              fill="none"
              stroke={stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {coords.map((c) => (
          <g key={c.entryId}>
            {/* 표면색 링이 있어야 점이 선·다른 점과 겹쳐도 구분된다 */}
            <circle cx={c.x} cy={c.y} r="4" fill={stroke} className="trend__dot" />
            {/* 손가락·마우스가 닿을 자리는 점보다 넉넉해야 한다 */}
            <circle cx={c.x} cy={c.y} r="12" fill="transparent">
              <title>{`${formatFullDate(c.date)} · ${c.percent}%`}</title>
            </circle>
          </g>
        ))}

        {/* 값은 모든 점이 아니라 마지막 점에만 붙인다 */}
        <text
          className="trend__value"
          x={Math.min(lastPoint.x + 10, VIEW_W - 4)}
          y={lastPoint.y + 4}
        >
          {lastPoint.percent}%
        </text>
      </svg>

      <figcaption className="trend__caption">
        {formatMonthDay(first)} → {formatMonthDay(last)} · 진행률이 적힌 기록 {points.length}개
      </figcaption>
    </figure>
  );
}

function round(n) {
  return Math.round(n * 10) / 10;
}
