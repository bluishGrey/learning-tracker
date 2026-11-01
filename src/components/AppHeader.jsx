import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { formatRelativeDay, toDateKey } from '../lib/date.js';
import ImportDialog from './ImportDialog.jsx';
import LoginDialog from './LoginDialog.jsx';
import ServerLight from './ServerLight.jsx';
import { isLoggedIn } from '../storage/serverSync.js';

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
  const headerRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false); // 서버에 올리는 중인지 기억해 두는 칸
  const [downloading, setDownloading] = useState(false); // 서버에서 받아 오는 중인지 기억해 두는 칸
  const [lightKey, setLightKey] = useState(0); // 올 때마다 바뀌는 번호. 바뀌면 표시등이 서버를 즉시 다시 확인한다
  const [loginFor, setLoginFor] = useState(null); // 로그인 창을 띄운 이유: 'upload' | 'download' | null (null이면 창이 닫혀 있음)
  
  /*
   * 상단 바 높이를 재서 --appbar-h 에 넣는다.
   * 사이드바와 알림이 이 값에 기대어 자리를 잡는데, 상태 문구가 두 줄로 접히거나
   * safe-area 가 끼면 높이가 달라져서 고정값으로는 어긋난다.
   */
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;

    const apply = () =>
      document.documentElement.style.setProperty('--appbar-h', `${el.offsetHeight}px`);

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

    const handleUpload = async () => {
    if (!isLoggedIn()) {             // 증표가 없으면 서버에 가지 않고 로그인 창부터 띄운다
      setLoginFor('upload');
      return;
    }
    setUploading(true);
    await actions.uploadBackup();
    setUploading(false);
    setLightKey((k) => k + 1);       // 방금 서버와 주고받았으니 표시등도 바로 다시 확인
    if (!isLoggedIn()) setLoginFor('upload');   // 서버가 401로 거절해서 증표가 비워졌으면 다시 로그인 창
  };

  const handleServerImport = async () => {
    if (!isLoggedIn()) {
      setLoginFor('download');
      return;
    }
    setDownloading(true);
    const result = await actions.prepareServerImport();
    setDownloading(false);
    setLightKey((k) => k + 1);
    if (!isLoggedIn()) {             // 401로 증표가 비워졌으면 로그인 창을 다시 띄운다
      setLoginFor('download');
      return;
    }
    if (result.needsChoice) setPending(result.pending);
  };

  // 로그인에 성공하면 창을 닫고, 원래 하려던 일(올리기/받기)을 이어서 실행한다.
  const handleLoginSuccess = async () => {
    const task = loginFor;
    setLoginFor(null);
    setLightKey((k) => k + 1);       // 로그인했으니 표시등이 초록으로 바뀌는지 바로 확인
    if (task === 'upload') await handleUpload();
    else if (task === 'download') await handleServerImport();
  };

  const status = describeStatus(exportStatus);

  return (
    <>
      <header className="appbar" ref={headerRef}>
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
            <ServerLight refreshKey={lightKey} />
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
              onClick={handleUpload}
              disabled={uploading}
            >
              ☁ {uploading ? '올리는 중…' : '서버에 올리기'}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleServerImport}
              disabled={downloading}
            >
              ☁ {downloading ? '받는 중…' : '서버에서 받기'}
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
      <LoginDialog open={loginFor !== null} onClose={() => setLoginFor(null)} onSuccess={handleLoginSuccess} />
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
