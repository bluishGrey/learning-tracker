import { createPortal } from 'react-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectBlockEntries, selectBlockStaleness } from '../state/selectors.js';
import ManualCopySheet, { useTextExport } from './ManualCopySheet.jsx';
import { buildBlockRefreshRequest } from '../lib/structuredText.js';
import { entryTitle } from '../lib/entryTitle.js';
import { formatMonthDay } from '../lib/date.js';

/** 요청문에 실을 최근 기록 수 */
const RECENT_COUNT = 3;

/**
 * '블록 정보가 기록보다 오래됨' 표시 — 누르면 Claude 에게 보낼 갱신 요청문을 복사한다.
 *
 * 기록만 가져오다 보면 블록 설명·진행률·그림이 그대로 남는다. 경고가 아니라
 * 알림이라 작게 단다. 낡지 않았으면 아무것도 그리지 않는다.
 *
 * variant
 *   - 'banner' : 블록 페이지 상단 한 줄
 *   - 'icon'   : 사이드바 블록 옆 작은 아이콘
 *
 * 복사가 막히면 원문을 띄우는 창은 document.body 로 포털한다 — 좁은 화면의 사이드바는
 * transform 이 걸려 있어서 그 안의 position:fixed 창이 사이드바 안에 갇힌다.
 */
export default function StaleBadge({ subject, block, variant = 'banner' }) {
  const { index } = useStore();
  const actions = useActions();
  const { exportText, manualCopyProps } = useTextExport(actions.setNotice);

  const staleness = selectBlockStaleness(index, block);
  if (!staleness.stale) return null;

  const why =
    staleness.reason === 'unknown'
      ? '블록 정보를 언제 받았는지 기록이 없습니다'
      : `블록 정보 ${formatMonthDay(staleness.infoDate)} · 마지막 기록 ${formatMonthDay(staleness.lastEntryDate)}`;

  const copyRequest = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const recent = [...selectBlockEntries(index, block.id)].reverse().slice(0, RECENT_COUNT);
    exportText(
      buildBlockRefreshRequest(subject, block, recent, entryTitle),
      `'${block.name}' 블록 갱신 요청문을 복사했습니다. claude.ai 에 붙여넣고, 받은 ---BLOCK--- 를 '오늘 기록 붙여넣기'나 '블록 정보 가져오기'로 붙여넣으세요.`
    );
  };

  const tooltip = `블록 정보가 기록보다 오래됨 (${why}) — 누르면 'Claude에게 블록 갱신 요청' 텍스트를 복사합니다`;

  return (
    <>
      {variant === 'icon' ? (
        <button type="button" className="stalebadge stalebadge--icon" onClick={copyRequest} title={tooltip} aria-label={tooltip}>
          ⟳
        </button>
      ) : (
        <button type="button" className="stalebadge" onClick={copyRequest} title={tooltip}>
          <span aria-hidden="true">⟳</span> 블록 정보가 기록보다 오래됨
          <span className="stalebadge__why">· {why} · 눌러서 갱신 요청 복사</span>
        </button>
      )}
      {manualCopyProps.open && createPortal(<ManualCopySheet {...manualCopyProps} />, document.body)}
    </>
  );
}
