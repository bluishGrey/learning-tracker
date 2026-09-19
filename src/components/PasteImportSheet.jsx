import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';

/**
 * claude.ai 가 만들어 준 정형 텍스트를 붙여넣는 창.
 *
 * 붙여넣기 → **읽기** → 확인 → **반영**. 두 단계로 나눈 이유는, 이 창이
 * 기존 값을 덮어쓰기 때문이다. 붙여넣자마자 반영해 버리면 형식이 살짝 어긋난
 * 텍스트 하나로 공들여 쓴 설명이 날아간다. 무엇이 들어올지 먼저 보여주고,
 * 그 화면에서 한 번 더 눌러야 실제로 바뀐다.
 *
 * 오류는 알림 팝업이 아니라 이 창 안에 남긴다. 붙여넣은 텍스트를 고쳐가며
 * 다시 시도하는 흐름이라, 창이 닫히면 고칠 대상도 함께 사라진다.
 *
 * @param {object}   props
 * @param {Function} props.parse         (text) => { ok, value, errors, warnings }
 * @param {Function} props.renderPreview (value) => ReactNode — 반영 전에 보여줄 요약
 * @param {Function} props.onApply       (value) => void
 */
export default function PasteImportSheet({
  open,
  onClose,
  title,
  hint,
  placeholder,
  parse,
  renderPreview,
  applyLabel = '반영',
  onApply,
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  // 열 때마다 빈 상태에서 시작한다. 지난번 텍스트가 남아 있으면
  // 무엇을 반영하려는 건지 헷갈린다.
  // (포커스는 Sheet 가 첫 입력칸 — 여기서는 이 textarea — 로 넣어 준다)
  useEffect(() => {
    if (!open) return;
    setText('');
    setResult(null);
  }, [open]);

  const read = () => setResult(parse(text));

  const apply = () => {
    if (!result?.ok) return;
    onApply(result.value);
    onClose();
  };

  const ready = result?.ok === true;

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          {ready ? (
            <button type="button" className="btn btn--primary" onClick={apply}>
              {applyLabel}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--primary"
              onClick={read}
              disabled={text.trim().length === 0}
            >
              읽기
            </button>
          )}
        </div>
      }
    >
      <p className="field__hint">{hint}</p>

      <textarea
        className="textarea textarea--code paste__input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          // 텍스트가 바뀌면 지난 결과는 더 이상 그 텍스트의 것이 아니다.
          if (result) setResult(null);
        }}
        placeholder={placeholder}
        spellCheck={false}
      />

      {result && !result.ok && (
        <div className="callout callout--danger paste__result">
          <strong>가져오지 못했습니다.</strong>
          <ul className="paste__errors">
            {result.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {ready && (
        <div className="paste__result">
          {result.warnings?.length > 0 && (
            <div className="callout callout--warn">
              <ul className="paste__errors">
                {result.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="callout callout--info">
            <strong>이대로 반영합니다.</strong>
          </div>
          {renderPreview(result.value)}
        </div>
      )}
    </Sheet>
  );
}
