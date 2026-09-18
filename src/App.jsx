/**
 * 임시 화면 — 3단계(캘린더/과목 네비게이션 UI)에서 라우터로 교체된다.
 * 지금은 데이터 계층이 실제로 살아 있는지 확인하는 용도만 한다.
 */
import { useStore } from './state/StoreContext.jsx';
import { selectSubjectList } from './state/selectors.js';

export default function App() {
  const { state, index, exportStatus, notice } = useStore();
  const subjects = selectSubjectList(state, index);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 20 }}>학습 트래커</h1>
      <p style={{ color: '#666' }}>
        데이터 계층 준비 완료 — 과목 {subjects.length} · 블록{' '}
        {Object.keys(state.blocks).length} · 기록 {Object.keys(state.entries).length}
      </p>
      {notice && <p style={{ color: notice.level === 'error' ? '#b00' : '#333' }}>{notice.message}</p>}
      <p style={{ color: '#666' }}>
        {exportStatus.hasChanges ? '내보내기 필요' : '내보내기 최신'}
      </p>
    </main>
  );
}
