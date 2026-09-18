import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { formatRelativeDay, toDateKey } from '../lib/date.js';
import ImportDialog from './ImportDialog.jsx';

/**
 * 항상 화면 상단에 붙어 있는 헤더.
 *
 * 내보내기·불러오기를 설정 메뉴에 숨기지 않고 여기 고정한다.
 * 공용 PC를 오가는 사용 환경에서는 이 두 버튼이 부가 기능이 아니라
 * 데이터를 잃지 않기 위한 주 동선이기 때문이다.
 */
export default function AppHeader({ sidebarOpen, onToggleSidebar }) {
  const { exportStatus } = useStore();
  const actions = useActions();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    // 같은 파일을 다시 고를 수 있도록 값을 비운다.
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    const result = await actions.prepareImport(file);
    setBusy(false);

    if (result.needsChoice) setPending(result.pending);
  };

  const status = describeStatus(exportStatus);

  return (
    <>
      <header className="appbar">
        <div className="appbar__inner">
          <div className="appbar__row">
            <button
              type="button"
              className="appbar__burger"
              onClick={onToggleSidebar}
              aria-expanded={sidebarOpen}
              aria-label={`사이드바 ${sidebarOpen ? '닫기' : '열기'} (Ctrl+B)`}
              title="사이드바 (Ctrl+B)"
            >
              <span className="appbar__burgerbars" aria-hidden="true" />
            </button>
            <Link to="/" className="appbar__brand">
              학습 트래커
            </Link>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => actions.exportBackup()}
            >
              ⬇ 내보내기
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              ⬆ {busy ? '읽는 중…' : '불러오기'}
            </button>
          </div>

          <p className={`appbar__status appbar__status--${status.tone}`}>{status.text}</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="visually-hidden"
          aria-label="백업 JSON 파일 선택"
        />
      </header>

      <ImportDialog pending={pending} onClose={() => setPending(null)} />
    </>
  );
}

/**
 * 내보내기 누락 경보 문구.
 * 공용 PC에서의 진짜 위험은 가져오기 실패가 아니라 퇴실 전 내보내기를
 * 깜빡하는 것이라, 상태를 항상 문장으로 노출한다.
 */
function describeStatus(exportStatus) {
  const { neverExported, unexportedEntries, hasChanges, lastExportedAt } = exportStatus;

  if (neverExported) {
    return unexportedEntries > 0
      ? { tone: 'warn', text: `아직 내보낸 적 없음 · 기록 ${unexportedEntries}개` }
      : { tone: 'calm', text: '기록을 추가하면 여기에 내보내기 상태가 표시됩니다' };
  }

  const when = formatRelativeDay(toDateKey(new Date(lastExportedAt)));

  if (!hasChanges) {
    return { tone: 'ok', text: `마지막 내보내기: ${when} · 최신 상태` };
  }

  return {
    tone: 'warn',
    text:
      unexportedEntries > 0
        ? `마지막 내보내기: ${when} · 이후 기록 ${unexportedEntries}개 — 내보내기 필요`
        : `마지막 내보내기: ${when} · 변경사항 있음 — 내보내기 필요`,
  };
}
