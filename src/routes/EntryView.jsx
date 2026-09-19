import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectEntryContext } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import Markdown from '../components/Markdown.jsx';
import DiagramEmbed from '../components/DiagramEmbed.jsx';
import SvgEmbed from '../components/SvgEmbed.jsx';
import SubjectDot from '../components/SubjectDot.jsx';
import Sheet from '../components/Sheet.jsx';
import ManualCopySheet, { useTextExport } from '../components/ManualCopySheet.jsx';
import NotFound from './NotFound.jsx';
import { entryTitle } from '../lib/entryTitle.js';
import { buildEntryText } from '../lib/structuredText.js';
import {
  formatFullDate,
  formatMonthDay,
  formatMonthLabel,
  monthKeyOf,
} from '../lib/date.js';

/**
 * 기록 상세. 두 경로에서 모두 도달한다.
 *
 * URL 파라미터로 어느 쪽에서 왔는지 알 수 있으므로 Breadcrumb 이 그에 맞게 바뀐다.
 * 그와 별개로, 소속 과목/블록 칩과 날짜 칩을 항상 함께 보여준다.
 * 캘린더로 들어왔어도 과목 칩을 눌러 반대쪽 경로로 건너뛸 수 있게 하기 위함이다.
 */
export default function EntryView() {
  const { entryId, dateKey, subjectId, blockId } = useParams();
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { exportText, manualCopyProps } = useTextExport(actions.setNotice);

  const context = selectEntryContext(state, entryId);
  if (!context) return <NotFound />;

  const { entry, block, subject } = context;
  const title = entryTitle(entry);

  // 캘린더 경로로 들어왔는지 (dateKey 가 있으면 경로 A)
  const viaCalendar = Boolean(dateKey);

  const monthKey = monthKeyOf(entry.date);
  const calendarPath = `/day/${entry.date}/e/${entry.id}`;
  const subjectPath =
    block && subject ? `/subjects/${subject.id}/${block.id}/e/${entry.id}` : null;

  const crumbs = viaCalendar
    ? [
        { label: '홈', to: '/' },
        { label: formatMonthLabel(monthKey), to: `/calendar/${monthKey}` },
        { label: formatMonthDay(entry.date), to: `/day/${entry.date}` },
        { label: title },
      ]
    : [
        { label: '홈', to: '/' },
        { label: subject?.name ?? '(과목 없음)', to: `/subjects/${subjectId}` },
        { label: block?.name ?? '(블록 없음)', to: `/subjects/${subjectId}/${blockId}` },
        { label: title },
      ];

  const handleDelete = () => {
    actions.removeEntry(entry.id);
    navigate(viaCalendar ? `/day/${entry.date}` : `/subjects/${subjectId}/${blockId}`, {
      replace: true,
    });
  };

  return (
    <main className="page">
      <Breadcrumb items={crumbs} />

      <h1 className="page__title">{title}</h1>

      {/* 반대쪽 경로로 건너뛰는 칩 */}
      <div className="jumpchips">
        {subject && block && subjectPath && (
          <Link
            to={subjectPath}
            className={`jumpchip${!viaCalendar ? ' jumpchip--current' : ''}`}
            title="과목 경로로 이동"
          >
            <SubjectDot subject={subject} size={8} />
            {subject.name} / {block.name}
          </Link>
        )}
        <Link
          to={calendarPath}
          className={`jumpchip${viaCalendar ? ' jumpchip--current' : ''}`}
          title="캘린더 경로로 이동"
        >
          🗓 {formatFullDate(entry.date)}
        </Link>
      </div>

      {entry.progressPercent != null && (
        <p className="page__sub entryview__progress">
          이 시점 진행률 <strong>{entry.progressPercent}%</strong>
          <span className="field__hint"> — 블록 상세의 추이 그래프에 찍힙니다</span>
        </p>
      )}

      {entry.tags?.length > 0 && (
        <div className="tag-list entryview__tags">
          {entry.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <article className="section entryview__content">
        {entry.content?.trim() ? (
          <Markdown>{entry.content}</Markdown>
        ) : (
          <p className="page__sub">내용이 비어 있습니다.</p>
        )}
      </article>

      {/* 다이어그램이 위, SVG 가 아래 — 블록 상세와 같은 순서로 둔다 */}
      {entry.diagramCode && (
        <section className="section">
          <h2 className="section__title">다이어그램</h2>
          <DiagramEmbed code={entry.diagramCode} />
        </section>
      )}

      {entry.svgCode && (
        <section className="section">
          <h2 className="section__title">참고 SVG</h2>
          <SvgEmbed code={entry.svgCode} />
        </section>
      )}

      <div className="row entryview__actions">
        {/* 지금 경로를 실어 보내 저장 후 있던 자리로 정확히 돌아오게 한다 */}
        <Link
          to={`/e/${entry.id}/edit?from=${encodeURIComponent(location.pathname)}`}
          className="btn"
        >
          수정
        </Link>
        {/*
          이 기록 하나를 ---ENTRY--- 형식으로. claude.ai 에 "이거 이어서 더 정리해줘"
          라고 할 때 현재 값을 그대로 넘기는 용도다.
          받은 답은 '수정' 화면의 기록 가져오기로 되붙인다.
        */}
        <button
          type="button"
          className="btn"
          onClick={() =>
            exportText(
              buildEntryText(subject, block, entry),
              `'${title}' 기록을 클립보드에 복사했습니다.`
            )
          }
          title="이 기록을 ---ENTRY--- 형식으로 클립보드에 복사"
        >
          ⧉ 기록 내보내기
        </button>
        <button type="button" className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
          삭제
        </button>
      </div>

      <Sheet
        open={confirmDelete}
        title="기록을 삭제할까요?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button type="button" className="btn btn--danger" onClick={handleDelete}>
              삭제
            </button>
          </div>
        }
      >
        <div className="callout callout--danger">
          <strong>{title}</strong>
          <p>되돌릴 수 없습니다.</p>
        </div>
      </Sheet>

      <ManualCopySheet {...manualCopyProps} />
    </main>
  );
}
