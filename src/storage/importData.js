/**
 * 가져오기 오케스트레이션.
 *
 * 순서가 이 모듈의 전부다:
 *   파일 읽기 → JSON.parse → 검증 → 메모리에서 새 state 완성 → (여기까지 통과해야)
 *   → 현재 상태 스냅샷 → 커밋
 *
 * 즉 검증이 끝나기 전에는 기존 데이터를 건드리지 않는다. 어느 단계에서
 * 실패하든 기존 기록은 그대로 남는다.
 */

import { ensureShape, pruneOrphans, nowIso } from './schema.js';
import { validateBackup, countEntities } from './validate.js';
import { mergeStates } from './merge.js';
import { snapshotCurrent } from './persist.js';

export const IMPORT_MODE = {
  OVERWRITE: 'overwrite',
  MERGE: 'merge',
};

/** File → 텍스트 */
export function readFileAsText(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ ok: false, text: null, error: '선택된 파일이 없습니다.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ ok: true, text: String(reader.result), error: null });
    reader.onerror = () =>
      resolve({ ok: false, text: null, error: '파일을 읽지 못했습니다.' });
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * 텍스트 → 검증된 백업 객체.
 * @returns {{ ok: boolean, errors: Array, warnings: Array, backup: object|null }}
 */
export function parseBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          path: '(파일)',
          message: `JSON 파일을 읽을 수 없습니다. 파일이 손상되었거나 JSON 형식이 아닙니다. (${err.message})`,
        },
      ],
      warnings: [],
      backup: null,
    };
  }
  return validateBackup(parsed);
}

/**
 * 모달에 보여줄 비교표를 만든다. 아직 아무것도 커밋하지 않는다.
 *
 * @returns {{
 *   current: object, incoming: object,
 *   mergeReport: object, mergePreviewCounts: object,
 *   isEmpty: boolean
 * }}
 */
export function previewImport(currentState, backup) {
  const current = countEntities(currentState);
  const incoming = backup.counts ?? countEntities(backup.data);
  const { state: merged, report } = mergeStates(currentState, backup.data);

  return {
    current,
    incoming,
    mergeReport: report,
    mergePreviewCounts: countEntities(merged),
    // 기존 데이터가 없으면 물어볼 게 없으므로 모달 없이 바로 가져온다.
    isEmpty:
      current.subjects === 0 && current.blocks === 0 && current.entries === 0,
  };
}

/**
 * 실제 적용. 호출부는 반환된 state 를 그대로 dispatch 하면 된다.
 *
 * @param {object} currentState
 * @param {object} backup  parseBackupText 를 통과한 객체
 * @param {'overwrite'|'merge'} mode
 * @returns {{ ok, state, report, snapshotKey, error }}
 */
export function applyImport(currentState, backup, mode) {
  if (!backup?.data) {
    return { ok: false, state: null, report: null, snapshotKey: null, error: '가져올 데이터가 없습니다.' };
  }

  let nextState;
  let report;

  if (mode === IMPORT_MODE.OVERWRITE) {
    const pruned = pruneOrphans(ensureShape(backup.data));
    const incomingCounts = countEntities(pruned.state);
    nextState = {
      ...pruned.state,
      settings: {
        ...pruned.state.settings,
        // 복원 직후의 데이터는 파일과 정확히 같으므로 '미내보내기' 상태가 아니다.
        lastExportedAt: backup.exportedAt ?? nowIso(),
        lastChangeAt: backup.exportedAt ?? nowIso(),
      },
    };
    report = {
      mode: IMPORT_MODE.OVERWRITE,
      replaced: countEntities(currentState),
      added: incomingCounts,
      skipped: { subjects: 0, blocks: 0, entries: 0 },
      orphans: pruned.removed,
      recolored: [],
    };
  } else if (mode === IMPORT_MODE.MERGE) {
    const merged = mergeStates(currentState, backup.data);
    nextState = merged.state;
    report = { mode: IMPORT_MODE.MERGE, ...merged.report };
  } else {
    return {
      ok: false,
      state: null,
      report: null,
      snapshotKey: null,
      error: `알 수 없는 가져오기 방식입니다: ${mode}`,
    };
  }

  // 여기까지 왔다는 건 새 state 가 문제없이 만들어졌다는 뜻이다.
  // 그제서야 현재 상태를 스냅샷으로 남긴다 (덮어쓰기도 되돌릴 여지를 남기기 위함).
  const snapshotKey = snapshotCurrent(`pre-import-${mode}`);

  return { ok: true, state: nextState, report, snapshotKey, error: null };
}

/** 결과 보고를 사람이 읽을 문장으로 */
export function describeImportReport(report) {
  if (!report) return '';

  const lines = [];
  if (report.mode === IMPORT_MODE.OVERWRITE) {
    lines.push(
      `전체 덮어쓰기 완료 — 과목 ${report.added.subjects}개, 블록 ${report.added.blocks}개, 기록 ${report.added.entries}개를 불러왔습니다.`
    );
  } else {
    lines.push(
      `병합 완료 — 과목 ${report.added.subjects}개, 블록 ${report.added.blocks}개, 기록 ${report.added.entries}개를 추가했습니다.`
    );
    const skipped = report.skipped.subjects + report.skipped.blocks + report.skipped.entries;
    if (skipped > 0) {
      lines.push(`이미 있는 항목 ${skipped}개는 건너뛰었습니다.`);
    }
  }

  const orphans = (report.orphans?.blocks ?? 0) + (report.orphans?.entries ?? 0);
  if (orphans > 0) {
    lines.push(
      `소속 과목·블록이 백업에 없어 건너뛴 항목이 ${orphans}개 있습니다. (블록 ${report.orphans.blocks}, 기록 ${report.orphans.entries})`
    );
  }

  if (report.recolored?.length > 0) {
    const names = report.recolored.map((r) => r.name).join(', ');
    lines.push(`색이 겹쳐 새 색을 배정한 과목: ${names}`);
  }

  return lines.join('\n');
}
