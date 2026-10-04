import { Link } from 'react-router-dom';
import DeadlineBadge from './DeadlineBadge.jsx';
import SubjectDot from './SubjectDot.jsx';
import { formatMonthDay } from '../lib/date.js';

/**
 * 마감 한 줄 — 홈의 '마감 일정'과 그날 화면의 '이 날 마감'이 같이 쓴다.
 *
 *   [D-5]  ● 그래프 탐색            10월 9일
 *            알고리즘 · 진행률 20%
 *
 * 줄 전체가 그 블록(과목 마감이면 과목) 화면으로 가는 링크다.
 * 색은 D-day 배지와 같은 규칙 — 지났는데 끝나지 않은 것만 --danger.
 *
 * @param {{ item: object, showDate?: boolean }} props  item 은 selectDeadlineItems 의 한 줄
 */
export default function DeadlineRow({ item, showDate = true }) {
  const { kind, subject, block, deadline, info, done, progressPercent } = item;
  const isSubject = kind === 'subject';
  const to = isSubject ? `/subjects/${subject.id}` : `/subjects/${subject.id}/${block.id}`;
  const name = isSubject ? subject.name : block.name;
  const progressLabel = isSubject ? '진도율' : '진행률';

  const meta = [
    isSubject ? '과목 마감' : subject.name,
    progressPercent == null ? null : `${progressLabel} ${progressPercent}%`,
    done ? '완료' : null,
  ].filter(Boolean);

  return (
    <Link
      to={to}
      className={`dlrow${info.overdue && !done ? ' dlrow--overdue' : ''}${done ? ' dlrow--done' : ''}`}
    >
      <span className="dlrow__badge">
        <DeadlineBadge deadline={deadline} done={done} />
      </span>
      <SubjectDot subject={subject} size={8} />
      <span className="dlrow__main">
        <span className="dlrow__name">{name || '(이름 없음)'}</span>
        <span className="dlrow__meta">{meta.join(' · ')}</span>
      </span>
      {showDate && (
        <span className="dlrow__date">{info.days === 0 ? '오늘' : formatMonthDay(deadline)}</span>
      )}
    </Link>
  );
}
