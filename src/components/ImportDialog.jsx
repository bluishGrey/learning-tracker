import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { useActions, IMPORT_MODE } from '../state/StoreContext.jsx';
import { describeImportReport } from '../storage/importData.js';
import { hasAdditions } from '../storage/merge.js';

/**
 * 기존 데이터가 있을 때 덮어쓰기 / 병합을 고르게 하는 대화상자.
 *
 * 절대 조용히 덮어쓰지 않는다. 비교표로 무엇이 얼마나 바뀌는지 먼저 보여주고,
 * 덮어쓰기는 삭제될 개수를 명시한 2차 확인을 한 번 더 받는다.
 */
export default function ImportDialog({ pending, onClose }) {
  const actions = useActions();
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);
  const [result, setResult] = useState(null);

  if (!pending) return null;

  const { current, incoming, mergeReport } = pending.preview;
  const added = mergeReport.added;

  const close = () => {
    setConfirmingOverwrite(false);
    setResult(null);
    onClose();
  };

  const run = (mode) => {
    const outcome = actions.commitImport(pending.backup, mode);
    if (outcome.ok) setResult(outcome.report);
    else close();
  };

  // ── 완료 화면 ──
  if (result) {
    return (
      <Sheet
        open
        title="가져오기 완료"
        onClose={close}
        footer={
          <button type="button" className="btn btn--primary btn--block" onClick={close}>
            확인
          </button>
        }
      >
        <p className="dialog__lead">{describeImportReport(result)}</p>
        <div className="callout callout--info">
          잘못 가져왔다면 지금 되돌릴 수 있습니다. 브라우저를 닫으면 되돌리기 기록도 사라집니다.
          <button
            type="button"
            className="btn btn--sm"
            style={{ marginTop: 'var(--sp-2)' }}
            onClick={() => {
              actions.restoreLatestSnapshot();
              close();
            }}
          >
            가져오기 직전으로 되돌리기
          </button>
        </div>
      </Sheet>
    );
  }

  // ── 덮어쓰기 2차 확인 ──
  if (confirmingOverwrite) {
    return (
      <Sheet
        open
        title="정말 덮어쓸까요?"
        onClose={close}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setConfirmingOverwrite(false)}>
              뒤로
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => run(IMPORT_MODE.OVERWRITE)}
            >
              덮어쓰기 실행
            </button>
          </div>
        }
      >
        <div className="callout callout--danger">
          <strong>
            지금 있는 기록 {current.entries}개(과목 {current.subjects}개, 블록 {current.blocks}개)가
            삭제됩니다.
          </strong>
          <p>파일에 들어 있는 내용으로 완전히 교체합니다.</p>
        </div>
        <p className="dialog__note">
          양쪽에서 각각 기록했다면 <strong>병합</strong>을 고르는 편이 안전합니다.
          덮어쓰기 직전 상태는 자동으로 저장되므로 실수해도 되돌릴 수 있습니다.
        </p>
      </Sheet>
    );
  }

  // ── 선택 화면 ──
  const nothingToAdd = !hasAdditions(mergeReport);

  return (
    <Sheet
      open
      title="어떻게 가져올까요?"
      onClose={close}
      footer={
        <div className="dialog__actions dialog__actions--stack">
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => run(IMPORT_MODE.MERGE)}
            disabled={nothingToAdd}
          >
            병합 {nothingToAdd ? '(추가될 항목 없음)' : '(권장)'}
          </button>
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => setConfirmingOverwrite(true)}
          >
            전체 덮어쓰기
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={close}>
            취소
          </button>
        </div>
      }
    >
      <table className="difftable">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">현재</th>
            <th scope="col">가져올 파일</th>
            <th scope="col">병합 시 추가</th>
          </tr>
        </thead>
        <tbody>
          <Row label="과목" a={current.subjects} b={incoming.subjects} add={added.subjects} />
          <Row label="블록" a={current.blocks} b={incoming.blocks} add={added.blocks} />
          <Row label="기록" a={current.entries} b={incoming.entries} add={added.entries} />
        </tbody>
      </table>

      <ul className="dialog__points">
        <li>
          <strong>병합</strong> — 겹치는 항목은 건너뛰고 새 것만 더합니다. 지금 기록은 사라지지 않습니다.
        </li>
        <li>
          <strong>덮어쓰기</strong> — 지금 기록을 모두 지우고 파일 내용으로 교체합니다.
        </li>
      </ul>

      {mergeReport.orphans.blocks + mergeReport.orphans.entries > 0 && (
        <div className="callout callout--warn">
          소속 과목·블록이 파일에 없어 건너뛸 항목이 {mergeReport.orphans.blocks + mergeReport.orphans.entries}개
          있습니다.
        </div>
      )}

      {pending.warnings?.length > 0 && (
        <details className="dialog__details">
          <summary>파일 점검 메모 {pending.warnings.length}건</summary>
          <ul>
            {pending.warnings.slice(0, 10).map((w, i) => (
              <li key={i}>
                {w.path}: {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Sheet>
  );
}

function Row({ label, a, b, add }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{a}</td>
      <td>{b}</td>
      <td className={add > 0 ? 'difftable__add' : undefined}>{add > 0 ? `+${add}` : '—'}</td>
    </tr>
  );
}
