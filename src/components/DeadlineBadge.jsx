import { deadlineInfo, formatFullDate } from '../lib/date.js';

/**
 * 마감 D-day 표시 — 'D-5' · 'D-day' · 'D+2(지남)'.
 *
 * 마감이 없거나 읽을 수 없으면 아무것도 그리지 않는다.
 * 지났는데 아직 끝나지 않은 것(done === false)만 경고색으로 칠한다. 이미 끝낸 것은
 * 지난 마감이어도 흐리게만 둔다 — 끝낸 일에 빨간 딱지가 붙어 있으면 진짜 급한 것이 묻힌다.
 *
 * 경고색은 --danger 다. 테라코타 포인트(--accent, hue 15°)와 헷갈리지 않게 따로 둔
 * 붉은색이고, 색만으로 구분하지 않도록 '(지남)' 글자와 테두리가 함께 붙는다.
 */
export default function DeadlineBadge({ deadline, done = false }) {
  const info = deadlineInfo(deadline);
  if (!info) return null;

  const tone = info.overdue ? (done ? ' deadline--past' : ' deadline--overdue') : '';
  const title = `마감 ${formatFullDate(deadline)}${info.overdue && !done ? ' — 지났는데 아직 완료되지 않음' : ''}`;

  return (
    <span className={`deadline${tone}`} title={title}>
      {info.label}
    </span>
  );
}
