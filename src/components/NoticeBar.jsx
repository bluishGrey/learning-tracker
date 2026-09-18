import { useEffect } from 'react';
import { useStore, useActions } from '../state/StoreContext.jsx';

/** 오류가 아닌 알림은 이 시간 뒤 스스로 사라진다 */
const AUTO_DISMISS_MS = 4500;

/**
 * 저장 실패·가져오기 오류 등을 알린다.
 * 실패를 조용히 삼키지 않는 것이 이 앱의 원칙이라 항상 화면에 띄운다.
 *
 * 레이아웃 흐름에서 빠져나와(fixed) 화면 위에 떠 있는다.
 * 흐름 안에 두면 알림이 뜰 때마다 본문이 아래로 밀려 읽던 자리를 잃는다.
 *
 * 오류는 직접 닫을 때까지 남긴다 — 데이터가 걸린 문제라 놓치면 안 된다.
 * 성공·안내는 잠시 뒤 스스로 사라진다.
 */
export default function NoticeBar() {
  const { notice } = useStore();
  const actions = useActions();

  useEffect(() => {
    if (!notice || notice.level === 'error') return undefined;
    const timer = setTimeout(actions.dismissNotice, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice, actions]);

  if (!notice) return null;

  return (
    <div className="notice-layer">
      <div
        className={`notice notice--${notice.level}`}
        role={notice.level === 'error' ? 'alert' : 'status'}
        aria-live={notice.level === 'error' ? 'assertive' : 'polite'}
      >
        <p className="notice__text">{notice.message}</p>
        <button
          type="button"
          className="notice__close"
          onClick={actions.dismissNotice}
          aria-label="알림 닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}
