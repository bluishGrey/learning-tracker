/**
 * 내보내기 — 전체 데이터를 JSON 파일로 저장한다.
 *
 * 날것의 state 를 그대로 쓰지 않고 봉투(envelope)로 감싼다.
 * 서명(app)과 개수(counts)가 있어야 가져올 때 "이 앱 파일이 맞는지",
 * "중간에 잘리지 않았는지"를 판별하고 명확한 오류를 낼 수 있다.
 */

import { BACKUP_APP_ID, SCHEMA_VERSION } from './schema.js';
import { countEntities } from './validate.js';
import { todayKey, toDateKey, timeSuffix } from '../lib/date.js';

export function buildBackup(state, exportedAt = new Date()) {
  const data = {
    settings: state.settings,
    subjects: state.subjects,
    subjectOrder: state.subjectOrder,
    blocks: state.blocks,
    entries: state.entries,
  };

  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    counts: countEntities(data),
    data,
  };
}

export function backupToText(state, exportedAt = new Date()) {
  return JSON.stringify(buildBackup(state, exportedAt), null, 2);
}

/**
 * 파일명 생성.
 *
 * 기본형은 learning-tracker-backup-YYYY-MM-DD.json 이다.
 * 같은 날 두 번째부터는 브라우저가 붙이는 '(1)' 대신 시각을 덧붙여
 * 어느 것이 최신인지 파일명만 보고 알 수 있게 한다.
 */
export function backupFilename(state, now = new Date()) {
  const dateKey = toDateKey(now);
  const lastExportedAt = state?.settings?.lastExportedAt;

  let sameDay = false;
  if (lastExportedAt) {
    const prev = new Date(lastExportedAt);
    sameDay = !Number.isNaN(prev.getTime()) && toDateKey(prev) === dateKey;
  }

  return sameDay
    ? `learning-tracker-backup-${dateKey}-${timeSuffix(now)}.json`
    : `learning-tracker-backup-${dateKey}.json`;
}

/**
 * 실제 다운로드를 트리거한다.
 * @returns {{ ok: boolean, filename: string|null, exportedAt: string|null, error: string|null }}
 */
export function downloadBackup(state, now = new Date()) {
  let url = null;
  try {
    const filename = backupFilename(state, now);
    const text = backupToText(state, now);
    const blob = new Blob([text], { type: 'application/json' });
    url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return {
      ok: true,
      filename,
      exportedAt: now.toISOString(),
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      filename: null,
      exportedAt: null,
      error: `내보내기에 실패했습니다: ${err.message}`,
    };
  } finally {
    // 즉시 해제하면 일부 브라우저에서 다운로드가 취소되므로 한 틱 뒤에 정리한다.
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 오늘 내보내기를 했는지 (배너 문구 판단용) */
export function exportedToday(state) {
  const at = state?.settings?.lastExportedAt;
  if (!at) return false;
  const d = new Date(at);
  return !Number.isNaN(d.getTime()) && toDateKey(d) === todayKey();
}
