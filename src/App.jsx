import { useCallback, useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import AppHeader from './components/AppHeader.jsx';
import NoticeBar from './components/NoticeBar.jsx';
import Sidebar from './components/Sidebar.jsx';
import ShortcutHelp from './components/ShortcutHelp.jsx';

import Home from './routes/Home.jsx';
import CalendarView from './routes/CalendarView.jsx';
import DayView from './routes/DayView.jsx';
import SubjectListView from './routes/SubjectListView.jsx';
import SubjectView from './routes/SubjectView.jsx';
import BlockView from './routes/BlockView.jsx';
import EntryView from './routes/EntryView.jsx';
import EntryEditor from './routes/EntryEditor.jsx';
import NotFound from './routes/NotFound.jsx';

import { todayKey, monthKeyOf } from './lib/date.js';
import { isTypingTarget, isBareKey, hasMod } from './lib/hotkeys.js';

// 순서가 중요하다 — 컴포넌트 규칙이 기본 규칙을 덮어쓸 수 있어야 한다.
import './styles/global.css';
import './styles/components.css';

/** 이 폭 미만에서는 사이드바가 본문을 밀지 않고 위에 덮인다 */
const NARROW_QUERY = '(max-width: 899px)';

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}

/**
 * 앱 껍데기 — 헤더 + 사이드바 + 본문.
 *
 * 라우팅: HashRouter 를 쓰는 이유는 서버가 없기 때문이다. 빌드한 dist/index.html 을
 * file:// 로 열어도 그대로 동작해야 한다.
 *
 * URL 에 '어느 경로로 들어왔는지'를 인코딩한다. 같은 Entry 라도
 * /day/:dateKey/e/:id 로 왔는지 /subjects/:sid/:bid/e/:id 로 왔는지가 남으므로,
 * Breadcrumb 을 별도 상태로 들고 있지 않아도 새로고침·뒤로가기에서 경로가 복원된다.
 */
function Shell() {
  const navigate = useNavigate();
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia?.(NARROW_QUERY).matches ?? false
  );
  // 넓은 화면에서는 기본으로 펼쳐 두고, 좁은 화면에서는 접어 둔다.
  const [sidebarOpen, setSidebarOpen] = useState(() => !isNarrow);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const handle = (event) => {
      setIsNarrow(event.matches);
      setSidebarOpen(!event.matches);
    };
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  /**
   * 검색창으로 포커스를 옮긴다.
   *
   * 좁은 화면에서는 사이드바가 닫혀 있고 inert 라 포커스가 들어가지 않는다.
   * 먼저 열고, 화면이 다시 그려진 다음 프레임에 잡는다.
   */
  const focusSearch = useCallback(() => {
    setSidebarOpen(true);
    requestAnimationFrame(() => {
      const input = searchRef.current;
      if (!input) return;
      input.focus();
      input.select();
    });
  }, []);

  /*
   * 전역 단축키.
   *
   * 단독 키(/ 와 ?)는 **입력 중이면 무시한다.** 이 가드가 없으면 기록을 쓰다가
   * '/' 를 칠 때마다 검색창으로 튄다. 조합키는 글자를 만들지 않으므로 가드 없이
   * 받는다.
   *
   * 글자 키는 event.code 로 본다 — Mac 의 Option+N 은 데드키라 event.key 가
   * 'n' 이 아니다.
   */
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.repeat) return;

      // ─ 조합키: 어디서든 ─
      if (hasMod(event) && event.altKey && event.code === 'KeyN') {
        event.preventDefault();
        navigate('/new');
        return;
      }
      if (hasMod(event) && !event.altKey && event.code === 'KeyB') {
        event.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }

      // ─ 단독 키: 글을 쓰는 중이 아닐 때만 ─
      if (!isBareKey(event) || isTypingTarget(event.target)) return;

      if (event.key === '/') {
        event.preventDefault();
        focusSearch();
      } else if (event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, focusSearch]);

  // 좁은 화면에서는 이동하면 덮개를 걷어준다.
  const handleNavigate = useCallback(() => {
    if (isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  return (
    <div className={`app${sidebarOpen ? ' app--sidebar-open' : ''}`}>
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <NoticeBar />

      <div className="shell">
        <Sidebar
          open={sidebarOpen}
          onNavigate={handleNavigate}
          searchRef={searchRef}
          onOpenHelp={() => setHelpOpen(true)}
        />

        {isNarrow && sidebarOpen && (
          <button
            type="button"
            className="shell__backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-label="사이드바 닫기"
          />
        )}

        <div className="shell__content">
          <Routes>
            {/* 홈이 곧 이번 달 캘린더다 */}
            <Route path="/" element={<Home />} />

            {/* 경로 A — 캘린더 (시간순 복기) */}
            <Route
              path="/calendar"
              element={<Navigate to={`/calendar/${monthKeyOf(todayKey())}`} replace />}
            />
            <Route path="/calendar/:monthKey" element={<CalendarView />} />
            <Route path="/day/:dateKey" element={<DayView />} />
            <Route path="/day/:dateKey/e/:entryId" element={<EntryView />} />

            {/* 경로 B — 과목 (진행도 확인) */}
            <Route path="/subjects" element={<SubjectListView />} />
            <Route path="/subjects/:subjectId" element={<SubjectView />} />
            <Route path="/subjects/:subjectId/:blockId" element={<BlockView />} />
            <Route path="/subjects/:subjectId/:blockId/e/:entryId" element={<EntryView />} />

            {/* 입력 */}
            <Route path="/new" element={<EntryEditor />} />
            <Route path="/e/:entryId/edit" element={<EntryEditor />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>

      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
