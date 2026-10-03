import { Link } from 'react-router-dom';
import SubjectDot from './SubjectDot.jsx';
import { entryTitle } from '../lib/entryTitle.js';
import { formatMonthDay } from '../lib/date.js';

/**
 * 기록 한 줄.
 *
 * 진행률은 배지로 함께 찍는다. 추이 그래프와 같은 값을 숫자로도 읽을 수 있어야
 * 그림을 보지 못하는 상황에서도 정보가 남는다.
 *
 * progressDropped 는 블록 화면이 넘겨준다 — 직전 기록보다 진행률이 낮아졌다는 작은 표시.
 * 오류가 아니라 '한번 확인해 보라'는 뜻이라 경고색 글자 하나로만 남긴다.
 *
 * @param {{ entry, to, subject?, block?, showDate?: boolean, progressDropped?: boolean }} props
 */
export default function EntryRow({ entry, to, subject, block, showDate = false, progressDropped = false }) {
  return (
    <Link to={to} className="card entryrow">
      <div className="entryrow__head">
        {subject && <SubjectDot subject={subject} size={8} />}
        <span className="card__title entryrow__title">{entryTitle(entry)}</span>
      </div>

      <div className="entryrow__meta card__meta">
        {showDate && <span>{formatMonthDay(entry.date)}</span>}
        {/* 과목 화면에서는 블록만, 캘린더에서는 과목/블록을 함께 보여준다 */}
        {(subject || block) && (
          <span className="entryrow__path">
            {[subject?.name, block?.name].filter(Boolean).join(' / ')}
          </span>
        )}
        {entry.progressPercent != null && (
          <span className="entryrow__badge entryrow__badge--progress">
            {entry.progressPercent}%
          </span>
        )}
        {progressDropped && (
          <span
            className="entryrow__drop"
            title="진행률이 이전보다 낮음"
            aria-label="진행률이 이전보다 낮음"
            role="img"
          >
            ▼
          </span>
        )}
        {entry.diagramCode && <span className="entryrow__badge">다이어그램</span>}
        {entry.svgCode && <span className="entryrow__badge">SVG</span>}
      </div>

      {entry.tags?.length > 0 && (
        <div className="tag-list entryrow__tags">
          {entry.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
