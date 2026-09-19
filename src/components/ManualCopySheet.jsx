import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { copyText } from '../lib/clipboard.js';

/**
 * 클립보드가 막혔을 때 직접 복사하게 하는 창 + 그 상태를 쥐는 훅.
 *
 * `navigator.clipboard` 는 보안 컨텍스트에서만 동작하고, 그 안에서도 권한이
 * 거부될 수 있다. 그때 **조용히 실패하지 않는 것**이 이 모듈의 존재 이유다.
 * 내보내기를 눌렀는데 아무 일도 안 일어나면 사용자는 버튼이 고장난 줄 안다.
 *
 * 세 화면(과목·블록·기록)이 같은 동작을 하므로 훅과 창을 한 곳에 둔다.
 */
export function useTextExport(setNotice) {
  const [manualCopy, setManualCopy] = useState(null);

  /** 클립보드에 넣고, 막히면 원문을 띄운다 */
  const exportText = async (text, successMessage) => {
    const result = await copyText(text);
    if (result.ok) setNotice({ level: 'success', message: successMessage });
    else setManualCopy(text);
  };

  return {
    exportText,
    manualCopyProps: {
      open: manualCopy !== null,
      text: manualCopy ?? '',
      onClose: () => setManualCopy(null),
    },
  };
}

export default function ManualCopySheet({ open, text, onClose }) {
  return (
    <Sheet
      open={open}
      title="직접 복사해 주세요"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          닫기
        </button>
      }
    >
      <div className="callout callout--warn">
        브라우저가 클립보드 접근을 막았습니다. (권한이 거부되었거나 보안 컨텍스트가
        아닌 경우) 아래 내용을 전체 선택해 복사하세요.
      </div>
      <textarea
        className="textarea textarea--code"
        readOnly
        value={text}
        onFocus={(e) => e.target.select()}
        style={{ minHeight: '220px' }}
      />
    </Sheet>
  );
}
