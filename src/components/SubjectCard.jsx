import { Link } from 'react-router-dom';
import SubjectDot from './SubjectDot.jsx';
import ProgressBar from './ProgressBar.jsx';
import { formatRelativeDay } from '../lib/date.js';

/**
 * 과목 목록의 카드.
 *
 * 여기가 활성도(최근 활동 기준 투명도)를 쓰는 화면이다.
 * 오래 손대지 않은 과목일수록 색이 빠져 회색에 가까워진다.
 */
export default function SubjectCard({ row }) {
  const { subject, progress, alpha, lastActiveDate, daysSince, blockCount, entryCount } = row;

  return (
    <Link to={`/subjects/${subject.id}`} className="card subjectcard">
      <div className="subjectcard__head">
        <SubjectDot hue={subject.colorHue} alpha={alpha} size={12} />
        <span className="card__title">{subject.name || '(이름 없음)'}</span>
        <div className="spacer" />
        <span className="subjectcard__percent">
          {progress.hasTarget ? `${progress.percent}%` : '—'}
        </span>
      </div>

      <ProgressBar
        percent={progress.percent}
        hue={subject.colorHue}
        alpha={alpha}
        label={`${subject.name} 진도율`}
      />

      <div className="card__meta subjectcard__meta">
        <span>
          {progress.hasTarget
            ? `${progress.completed} / ${progress.total} 완료`
            : '전체 진도 단위 미설정'}
        </span>
        <span>·</span>
        <span>
          블록 {blockCount} · 기록 {entryCount}
        </span>
        <span>·</span>
        <span className={daysSince !== null && daysSince <= 1 ? 'subjectcard__fresh' : undefined}>
          {lastActiveDate ? formatRelativeDay(lastActiveDate) : '기록 없음'}
        </span>
      </div>

      {progress.overflow && (
        <p className="subjectcard__warn">
          만든 블록({progress.created})이 설정한 전체 진도 단위({progress.total})보다 많습니다.
        </p>
      )}
    </Link>
  );
}
