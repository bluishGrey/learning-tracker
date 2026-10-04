import { useState } from 'react';
import { useStore } from '../state/StoreContext.jsx';
import { selectUpcomingDeadlines, UPCOMING_DEADLINE_DAYS } from '../state/selectors.js';
import DeadlineRow from './DeadlineRow.jsx';
import { todayKey } from '../lib/date.js';

/** 접힌 상태에서 보여줄 줄 수 — 넘으면 '전체 보기'로 그 자리에서 펼친다 */
const COLLAPSED_LIMIT = 5;

const BUCKETS = [
  { key: 'overdue', title: '지났는데 미완료' },
  { key: 'thisWeek', title: '이번 주' },
  { key: 'nextWeek', title: '다음 주' },
  { key: 'later', title: `그 이후 (${UPCOMING_DEADLINE_DAYS}일 이내)` },
];

/**
 * 홈 '마감 일정' — 캘린더 아래.
 *
 * 아직 끝나지 않은 마감 중 지난 것 전부 + 앞으로 30일 이내를, 지남 / 이번 주 / 다음 주 / 그 이후로
 * 묶어 보여준다. 지난 묶음은 빨갛게 — 가장 먼저 처리할 것이 위에 온다(마감 이른 순이라 저절로 그렇다).
 *
 * 처음에는 5줄만 보여주고 나머지는 같은 자리에서 펼친다. 펼친 상태는 저장하지 않는다.
 * 보여줄 마감이 하나도 없으면 섹션 자체를 그리지 않는다 (오늘의 복습과 같은 방식).
 */
export default function DeadlineSection() {
  const { state, index } = useStore();
  const [expanded, setExpanded] = useState(false);

  const items = selectUpcomingDeadlines(state, index, todayKey());
  if (items.length === 0) return null;

  const shown = expanded ? items : items.slice(0, COLLAPSED_LIMIT);

  return (
    <section className="section" aria-label="마감 일정">
      <div className="section__head">
        <h2 className="section__title">마감 일정</h2>
        <span className="section__note">지난 것 · 앞으로 {UPCOMING_DEADLINE_DAYS}일</span>
      </div>

      {BUCKETS.map(({ key, title }) => {
        const rows = shown.filter((item) => item.bucket === key);
        if (rows.length === 0) return null;
        return (
          <div key={key} className={`dlgroup${key === 'overdue' ? ' dlgroup--overdue' : ''}`}>
            <h3 className="dlgroup__title">
              {title}
              {key === 'overdue' && ` ${items.filter((item) => item.bucket === 'overdue').length}`}
            </h3>
            <ul className="dllist">
              {rows.map((item) => (
                <li key={item.key}>
                  <DeadlineRow item={item} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {items.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          className="btn btn--ghost btn--sm dlmore"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? '접기' : `마감 ${items.length}개 전체 보기`}
        </button>
      )}
    </section>
  );
}
