import { useEffect, useRef } from 'react';

/**
 * 모달 / 바텀시트.
 *
 * 모바일에서는 화면 아래에서 올라오고(엄지 도달 범위), 넓은 화면에서는
 * 가운데 카드로 뜬다. 뒤 배경 스크롤은 잠근다.
 */
export default function Sheet({ open, title, onClose, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 열릴 때 패널로 포커스를 옮겨 키보드·스크린리더가 안에서 시작하게 한다.
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="sheet__body">{children}</div>
        {footer && <footer className="sheet__foot">{footer}</footer>}
      </div>
    </div>
  );
}
