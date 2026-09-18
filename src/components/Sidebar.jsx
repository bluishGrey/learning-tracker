import { useEffect, useState } from 'react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectBlocks, selectBlockEntries } from '../state/selectors.js';
import SubjectDot from './SubjectDot.jsx';
import { entryTitle } from '../lib/entryTitle.js';
import { todayKey, monthKeyOf, formatMonthDay } from '../lib/date.js';

/**
 * 전체 구조(Subject → Block → Entry)를 트리로 보여주는 사이드바.
 *
 * 행을 누르면 펼쳐지고, 옆의 화살표를 누르면 그 화면으로 이동한다.
 * 펼치기와 이동을 한 행에 겹쳐 두면 둘 중 하나는 반드시 방해받기 때문에 나눴다.
 *
 * 캘린더는 트리에 넣지 않는다 — 시간축으로 보는 화면이라 계층 구조와 성격이 다르고,
 * 전용 화면을 그대로 둔다.
 */
export default function Sidebar({ open, onNavigate }) {
  const { state, index } = useStore();
  const location = useLocation();

  const [openSubjects, setOpenSubjects] = useState(() => new Set());
  const [openBlocks, setOpenBlocks] = useState(() => new Set());

  // 지금 보고 있는 항목이 트리에서 접혀 있으면 자동으로 펼친다.
  const activeIds = useActiveIds(state);
  useEffect(() => {
    if (activeIds.subjectId) {
      setOpenSubjects((prev) => (prev.has(activeIds.subjectId) ? prev : new Set(prev).add(activeIds.subjectId)));
    }
    if (activeIds.blockId) {
      setOpenBlocks((prev) => (prev.has(activeIds.blockId) ? prev : new Set(prev).add(activeIds.blockId)));
    }
  }, [activeIds.subjectId, activeIds.blockId]);

  const toggle = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSubject = toggle(setOpenSubjects);
  const toggleBlock = toggle(setOpenBlocks);

  const subjects = state.subjectOrder.map((id) => state.subjects[id]).filter(Boolean);
  const isCalendarRoute =
    location.pathname === '/' ||
    location.pathname.startsWith('/calendar') ||
    location.pathname.startsWith('/day');

  return (
    <aside
      className={`sidebar${open ? ' sidebar--open' : ''}`}
      aria-label="전체 구조"
      aria-hidden={open ? undefined : 'true'}
      // 닫혀 있을 때는 탭 이동으로도 안 들어가게 막는다
      inert={open ? undefined : true}
    >
      <nav className="sidebar__nav">
        <Link
          to={`/calendar/${monthKeyOf(todayKey())}`}
          className={`sidebar__navlink${isCalendarRoute ? ' sidebar__navlink--on' : ''}`}
          onClick={onNavigate}
        >
          🗓 캘린더
        </Link>
        <Link to="/new" className="sidebar__navlink" onClick={onNavigate}>
          ✏️ 새 기록
        </Link>
      </nav>

      <div className="sidebar__sectionhead">
        {/* 섹션 제목 자체가 과목 목록 전체 화면으로 가는 링크다 */}
        <Link to="/subjects" className="sidebar__sectiontitle" onClick={onNavigate}>
          과목
          <span className="sidebar__sectioncount">{subjects.length}</span>
        </Link>
      </div>

      {subjects.length === 0 ? (
        <p className="sidebar__empty">
          아직 과목이 없습니다.
          <br />
          <Link to="/subjects" onClick={onNavigate} className="sidebar__emptylink">
            과목 만들기
          </Link>
        </p>
      ) : (
        <ul className="tree">
          {subjects.map((subject) => {
            const blocks = selectBlocks(index, subject.id);
            const expanded = openSubjects.has(subject.id);
            return (
              <li key={subject.id}>
                <div
                  className={`tree__row tree__row--subject${
                    activeIds.subjectId === subject.id ? ' tree__row--active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="tree__toggle"
                    onClick={() => toggleSubject(subject.id)}
                    aria-expanded={expanded}
                    aria-label={`${subject.name} ${expanded ? '접기' : '펼치기'}`}
                  >
                    <span className={`tree__chevron${expanded ? ' tree__chevron--open' : ''}`}>
                      ▸
                    </span>
                    <SubjectDot subject={subject} size={9} />
                    <span className="tree__label">{subject.name || '(이름 없음)'}</span>
                    <span className="tree__count">{blocks.length}</span>
                  </button>
                  <Link
                    to={`/subjects/${subject.id}`}
                    className="tree__go"
                    onClick={onNavigate}
                    aria-label={`${subject.name} 화면으로 이동`}
                  >
                    ›
                  </Link>
                </div>

                {expanded && (
                  <ul className="tree tree--nested">
                    {blocks.length === 0 && <li className="tree__none">블록 없음</li>}
                    {blocks.map((block) => {
                      const entries = selectBlockEntries(index, block.id);
                      const blockOpen = openBlocks.has(block.id);
                      return (
                        <li key={block.id}>
                          <div
                            className={`tree__row${
                              activeIds.blockId === block.id ? ' tree__row--active' : ''
                            }`}
                          >
                            <button
                              type="button"
                              className="tree__toggle"
                              onClick={() => toggleBlock(block.id)}
                              aria-expanded={blockOpen}
                              aria-label={`${block.name} ${blockOpen ? '접기' : '펼치기'}`}
                            >
                              <span
                                className={`tree__chevron${blockOpen ? ' tree__chevron--open' : ''}`}
                              >
                                ▸
                              </span>
                              <span
                                className={`tree__label${
                                  block.isCompleted ? ' tree__label--done' : ''
                                }`}
                              >
                                {block.name || '(이름 없음)'}
                              </span>
                              <span className="tree__count">{entries.length}</span>
                            </button>
                            <Link
                              to={`/subjects/${subject.id}/${block.id}`}
                              className="tree__go"
                              onClick={onNavigate}
                              aria-label={`${block.name} 화면으로 이동`}
                            >
                              ›
                            </Link>
                          </div>

                          {blockOpen && (
                            <ul className="tree tree--nested">
                              {entries.length === 0 && <li className="tree__none">기록 없음</li>}
                              {entries.map((entry) => (
                                <li key={entry.id}>
                                  {/* 기록은 펼칠 것이 없으므로 행 전체가 바로 이동한다 */}
                                  <Link
                                    to={`/subjects/${subject.id}/${block.id}/e/${entry.id}`}
                                    className={`tree__row tree__entry${
                                      activeIds.entryId === entry.id ? ' tree__row--active' : ''
                                    }`}
                                    onClick={onNavigate}
                                  >
                                    <span className="tree__label">{entryTitle(entry)}</span>
                                    <span className="tree__date">{formatMonthDay(entry.date)}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

/** 구체적인 것부터 먼저 맞춰본다 */
const ROUTE_PATTERNS = [
  '/subjects/:subjectId/:blockId/e/:entryId',
  '/subjects/:subjectId/:blockId',
  '/subjects/:subjectId',
  '/day/:dateKey/e/:entryId',
  '/e/:entryId/edit',
];

/**
 * 현재 화면이 가리키는 subject/block/entry id.
 *
 * 사이드바는 <Routes> 바깥에 있어서 useParams() 가 비어 있다.
 * 그래서 경로를 직접 맞춰보고, 캘린더 경로로 들어온 기록은 소속을 역참조해
 * 트리에서 제자리를 찾게 한다.
 */
function useActiveIds(state) {
  const { pathname } = useLocation();

  let params = {};
  for (const pattern of ROUTE_PATTERNS) {
    const match = matchPath(pattern, pathname);
    if (match) {
      params = match.params;
      break;
    }
  }

  const entryId = params.entryId ?? null;
  const entry = entryId ? state.entries[entryId] : null;
  const blockId = params.blockId ?? entry?.blockId ?? null;
  const block = blockId ? state.blocks[blockId] : null;
  const subjectId = params.subjectId ?? block?.subjectId ?? null;
  return { subjectId, blockId, entryId };
}
