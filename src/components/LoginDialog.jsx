import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { login } from '../storage/serverSync.js';

/**
 * 서버 비밀번호를 입력받는 창.
 * 맞으면 증표가 serverSync.js 안에 보관되고, onSuccess 로 "이제 하려던 일을 이어서 해라"를 알린다.
 */
export default function LoginDialog({ open, onClose, onSuccess }) {
  const [password, setPassword] = useState('');   // 입력 중인 비밀번호
  const [error, setError] = useState(null);       // 틀렸을 때 보여줄 문구
  const [busy, setBusy] = useState(false);        // 서버 응답을 기다리는 중인지

  if (!open) return null;

  // 창을 닫을 때 입력값과 오류 문구를 비운다 (다음에 열 때 이전 글자가 남아 있지 않게)
  const close = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();                 // 폼 제출 시 페이지가 새로고침되는 걸 막는다
    setBusy(true);
    const result = await login(password);   // 서버에 비밀번호를 보내 확인받는다
    setBusy(false);

    if (!result.ok) {
      setError(result.error);               // 틀렸거나 연결 실패: 창을 닫지 않고 이유를 보여준다
      return;
    }
    setPassword('');
    setError(null);
    onSuccess();                            // 맞았으면 부른 쪽(헤더)에게 알린다
  };

  return (
    <Sheet
      open
      title="서버 로그인"
      onClose={close}
      footer={
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={close}>
            취소
          </button>
          {/* form="login-form": 이 버튼이 폼 바깥(footer)에 있어도 아래 폼을 제출하게 연결한다 */}
          <button type="submit" form="login-form" className="btn btn--primary" disabled={busy || password === ''}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </div>
      }
    >
      <form id="login-form" onSubmit={submit}>
        <label className="field">
          <span className="field__label">비밀번호</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        {error && <div className="callout callout--danger">{error}</div>}
      </form>
    </Sheet>
  );
}
