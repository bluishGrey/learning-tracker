import { useStore, useActions } from '../state/StoreContext.jsx';

/**
 * 저장 실패·가져오기 오류 등을 알린다.
 * 실패를 조용히 삼키지 않는 것이 이 앱의 원칙이라 항상 화면에 띄운다.
 */
export default function NoticeBar() {
  const { notice } = useStore();
  const actions = useActions();

  if (!notice) return null;

  return (
    <div className={`notice notice--${notice.level}`} role="status">
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
  );
}
