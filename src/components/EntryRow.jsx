import { Link } from 'react-router-dom';
import SubjectDot from './SubjectDot.jsx';
import { entryTitle } from '../lib/entryTitle.js';
import { formatMonthDay } from '../lib/date.js';

/**
 * 기록 한 줄.
 * @param {{ entry, to, subject?, block?, showDate?: boolean }} props
 */
export default function EntryRow({ entry, to, subject, block, showDate = false }) {
  return (
    <Link to={to} className="card entryrow">
      <div className="entryrow__head">
        {subject && <SubjectDot hue={subject.colorHue} size={8} />}
        <span className="card__title entryrow__title">{entryTitle(entry)}</span>
      </div>

      <div className="entryrow__meta card__meta">
        {showDate && <span>{formatMonthDay(entry.date)}</span>}
        {subject && block && (
          <span className="entryrow__path">
            {subject.name} / {block.name}
          </span>
        )}
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
