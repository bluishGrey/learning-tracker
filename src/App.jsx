import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import AppHeader from './components/AppHeader.jsx';
import NoticeBar from './components/NoticeBar.jsx';

import Dashboard from './routes/Dashboard.jsx';
import CalendarView from './routes/CalendarView.jsx';
import DayView from './routes/DayView.jsx';
import SubjectListView from './routes/SubjectListView.jsx';
import SubjectView from './routes/SubjectView.jsx';
import BlockView from './routes/BlockView.jsx';
import EntryView from './routes/EntryView.jsx';
import EntryEditor from './routes/EntryEditor.jsx';
import NotFound from './routes/NotFound.jsx';

import { todayKey, monthKeyOf } from './lib/date.js';

// 순서가 중요하다 — 컴포넌트 규칙이 기본 규칙을 덮어쓸 수 있어야 한다.
import './styles/global.css';
import './styles/components.css';

/**
 * 라우팅.
 *
 * HashRouter 를 쓰는 이유: 서버가 없다. 빌드한 dist/index.html 을 file:// 로
 * 열어도 그대로 동작해야 한다.
 *
 * URL 에 '어느 경로로 들어왔는지'를 인코딩한다. 같은 Entry 라도
 * /day/:dateKey/e/:id 로 왔는지 /subjects/:sid/:bid/e/:id 로 왔는지가 남으므로,
 * Breadcrumb 을 별도 상태로 들고 있지 않아도 새로고침·뒤로가기에서 경로가 복원된다.
 */
export default function App() {
  return (
    <HashRouter>
      <div className="app">
        <AppHeader />
        <NoticeBar />

        <Routes>
          <Route path="/" element={<Dashboard />} />

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
    </HashRouter>
  );
}
