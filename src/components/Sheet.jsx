import { useEffect, useRef } from 'react';

/**
 * 모달 / 바텀시트.
 *
 * 모바일에서는 화면 아래에서 올라오고(엄지 도달 범위), 넓은 화면에서는
 * 가운데 카드로 뜬다. 뒤 배경 스크롤은 잠근다.
 *
 * ─ 포커스를 '열릴 때 한 번'으로 못박는 이유 ────────────────────
 *
 * 예전에는 Escape 처리·스크롤 잠금·포커스를 한 effect 에 묶고 의존성에
 * [open, onClose] 를 걸었다. 그런데 호출부는 거의 다 onClose={() => setX(false)}
 * 처럼 인라인 함수를 넘긴다. 인라인 함수는 렌더마다 새 값이므로,
 *
 *   시트 안 입력칸에 한 글자 입력
 *     → 그 state 를 가진 부모가 리렌더
 *     → onClose 의 정체성이 바뀜
 *     → effect 재실행 → panel.focus() 가 다시 실행
 *     → 입력칸에서 포커스를 빼앗아 패널이 잡음 (그 뒤 타이핑이 먹히지 않음)
 *
 * 이 사고가 '과목 추가'와 '블록 추가'에서만 났던 이유는 그 둘만 폼 state 를
 * 시트 바깥(라우트 컴포넌트)에 두고 있어서다. 블록 설정·가져오기 창은 시트를
 * 렌더하는 컴포넌트가 자기 state 를 들고 있어 부모가 리렌더되지 않았다.
 *
 * 그래서 두 가지를 분리했다.
 *   1. 포커스는 open 이 바뀔 때만. 리렌더는 포커스를 건드리지 않는다.
 *   2. onClose 는 ref 로 최신값만 읽는다. 의존성에서 빼야 리스너도 덩달아
 *      붙었다 떼어지지 않는다.
 *
 * ─ 어디로 포커스를 주나 ──────────────────────────────────────
 *
 * 첫 입력칸이 있으면 거기로, 없으면 패널로 준다. React 19 는 autoFocus 를
 * DOM 속성으로 남기지 않고 직접 focus() 를 부르는데, 그러면 이 effect 가
 * 곧바로 덮어써서 호출부의 autoFocus 가 조용히 죽는다. 첫 입력칸을 직접
 * 찾아 주는 편이 그 의도와 맞는다.
 *
 * 버튼은 일부러 후보에서 뺐다. 삭제 확인 시트처럼 입력칸이 없는 시트에서
 * 파괴적인 버튼에 포커스가 얹히면 엔터 한 번에 사고가 난다.
 */
export default function Sheet({ open, title, onClose, children, footer }) {
  const panelRef = useRef(null);

  // 콜백은 최신값만 읽는다 — 의존성에 넣지 않기 위함이다.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ─ 열릴 때 한 번만: 포커스 ─
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;

    const firstField = panel.querySelector('input, textarea, select');
    (firstField ?? panel).focus();
  }, [open]);

  // ─ 열려 있는 동안: Escape 로 닫기 + 배경 스크롤 잠금 ─
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

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
