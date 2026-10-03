import { useEffect } from 'react';

const HEADING_TEXT_RE = /헷갈렸던\s*부분\s*정리/;
/** 마크다운 렌더러가 지연 로딩이라 표가 늦게 나타날 수 있다. 이만큼까지는 기다린다. */
const WAIT_MS = 4000;
const FLASH_MS = 2400;

/**
 * 렌더링된 기록 본문에서 '헷갈렸던 부분 정리' 표의 rowIndex 번째 행으로 스크롤하고 잠깐 강조한다.
 *
 * 행 번호는 lib/confusionTable.js 가 원문에서 센 표 본문(tbody) 순서다. react-markdown(GFM)이
 * 같은 표를 같은 순서로 그리므로 DOM 에서도 같은 자리를 가리킨다.
 *
 * @param {React.RefObject<HTMLElement>} containerRef 기록 본문을 감싼 요소
 * @param {number|null} rowIndex  없으면 아무것도 하지 않는다
 * @param {string} triggerKey     같은 행을 다시 눌러도 다시 움직이도록 (location.key 등)
 */
export function useConfusionRowFocus(containerRef, rowIndex, triggerKey) {
  useEffect(() => {
    if (rowIndex == null || !Number.isInteger(rowIndex) || rowIndex < 0) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    let done = false;
    let flashTimer = null;

    const tryFocus = () => {
      if (done) return true;
      const row = findRow(container, rowIndex);
      if (!row) return false;
      done = true;
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.remove('confusion-flash');
      // 같은 행을 연달아 눌러도 애니메이션이 다시 돌도록 한 프레임 쉰다
      requestAnimationFrame(() => row.classList.add('confusion-flash'));
      flashTimer = setTimeout(() => row.classList.remove('confusion-flash'), FLASH_MS);
      return true;
    };

    if (tryFocus()) return () => clearTimeout(flashTimer);

    const observer = new MutationObserver(() => {
      if (tryFocus()) observer.disconnect();
    });
    observer.observe(container, { childList: true, subtree: true });
    const giveUp = setTimeout(() => observer.disconnect(), WAIT_MS);

    return () => {
      observer.disconnect();
      clearTimeout(giveUp);
      clearTimeout(flashTimer);
    };
  }, [containerRef, rowIndex, triggerKey]);
}

function findRow(container, rowIndex) {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
  for (const heading of headings) {
    if (!HEADING_TEXT_RE.test(heading.textContent ?? '')) continue;
    const level = Number(heading.tagName.slice(1));

    for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
      if (/^H[1-6]$/.test(el.tagName) && Number(el.tagName.slice(1)) <= level) break;
      const table = el.tagName === 'TABLE' ? el : el.querySelector?.('table');
      if (table) return table.tBodies[0]?.rows[rowIndex] ?? null;
    }
    return null;
  }
  return null;
}
