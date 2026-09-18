/**
 * localStorage 영속화.
 *
 * 이 앱의 데이터는 전부 브라우저 안에만 있고, 사용 환경(공용 PC)상
 * 언제든 날아갈 수 있다. 그래서 저장 실패를 조용히 삼키지 않는 것이
 * 이 모듈의 가장 중요한 책임이다. 실패는 항상 호출부로 올려보낸다.
 */

import {
  STORAGE_KEY,
  SNAPSHOT_PREFIX,
  CORRUPT_PREFIX,
  createInitialState,
  ensureShape,
  pruneOrphans,
  migrate,
} from './schema.js';
import { validateStateShape, formatErrors } from './validate.js';

/** 보관할 스냅샷 최대 개수 (용량이 5MB 뿐이라 무한정 쌓을 수 없다) */
const MAX_SNAPSHOTS = 3;

/** 브라우저 localStorage 의 통상적인 상한 — 사용률 표시용 근사치 */
export const ASSUMED_QUOTA_BYTES = 5 * 1024 * 1024;

/** 시크릿 모드 등에서 localStorage 자체가 막혀 있는지 */
export function isStorageAvailable() {
  try {
    const probe = '__lt_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * 저장된 상태를 읽어온다.
 *
 * 어떤 이유로든 읽기에 실패하면 초기 상태로 시작하되, 깨진 원본은
 * 별도 키로 보존한다. 덮어써서 복구 가능성을 없애지 않기 위함이다.
 *
 * @returns {{ state: object, notice: {level: string, message: string}|null }}
 */
export function loadState() {
  if (!isStorageAvailable()) {
    return {
      state: createInitialState(),
      notice: {
        level: 'error',
        message:
          '브라우저 저장소를 쓸 수 없습니다(시크릿 모드이거나 사이트 데이터가 차단됨). 기록이 저장되지 않으니 설정을 확인해 주세요.',
      },
    };
  }

  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: createInitialState(),
      notice: { level: 'error', message: '저장소를 읽지 못했습니다.' },
    };
  }

  if (raw === null) {
    return { state: createInitialState(), notice: null };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const key = preserveCorrupt(raw);
    return {
      state: createInitialState(),
      notice: {
        level: 'error',
        message: `저장된 데이터를 읽을 수 없어 빈 상태로 시작합니다. 깨진 원본은 '${key}' 키에 보존했습니다. 백업 파일이 있다면 불러오기로 복구하세요.`,
      },
    };
  }

  const shape = validateStateShape(parsed);
  if (!shape.ok) {
    const key = preserveCorrupt(raw);
    return {
      state: createInitialState(),
      notice: {
        level: 'error',
        message: `저장된 데이터의 구조가 올바르지 않아 빈 상태로 시작합니다. 원본은 '${key}' 키에 보존했습니다.\n${formatErrors(shape.errors)}`,
      },
    };
  }

  let migrated;
  try {
    migrated = migrate(parsed);
  } catch (err) {
    const key = preserveCorrupt(raw);
    return {
      state: createInitialState(),
      notice: {
        level: 'error',
        message: `${err.message} 원본은 '${key}' 키에 보존했습니다.`,
      },
    };
  }

  const { state, removed } = pruneOrphans(ensureShape(migrated.state));

  let notice = null;
  if (removed.blocks > 0 || removed.entries > 0) {
    notice = {
      level: 'warn',
      message: `소속이 사라진 항목을 정리했습니다. (블록 ${removed.blocks}개, 기록 ${removed.entries}개)`,
    };
  } else if (migrated.applied.length > 0) {
    notice = {
      level: 'info',
      message: `데이터를 최신 형식(v${migrated.applied.at(-1)})으로 변환했습니다.`,
    };
  }

  return { state, notice };
}

/**
 * 즉시 저장. 실패 사유를 그대로 돌려준다.
 * @returns {{ ok: boolean, error: string|null, bytes: number }}
 */
export function saveStateNow(state) {
  let serialized;
  try {
    serialized = JSON.stringify(state);
  } catch {
    return { ok: false, error: '데이터를 직렬화하지 못했습니다.', bytes: 0 };
  }

  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    return { ok: true, error: null, bytes: serialized.length };
  } catch (err) {
    if (isQuotaError(err)) {
      // 오래된 스냅샷을 비우고 한 번만 재시도한다.
      const freed = dropOldestSnapshots(MAX_SNAPSHOTS - 1);
      if (freed > 0) {
        try {
          localStorage.setItem(STORAGE_KEY, serialized);
          return { ok: true, error: null, bytes: serialized.length };
        } catch {
          /* 아래 공통 오류로 떨어진다 */
        }
      }
      return {
        ok: false,
        error:
          '저장 공간이 가득 찼습니다. 방금 변경한 내용이 저장되지 않았습니다. 지금 바로 내보내기로 백업한 뒤, SVG 코드가 큰 기록을 정리해 주세요.',
        bytes: serialized.length,
      };
    }
    return { ok: false, error: `저장에 실패했습니다: ${err.message}`, bytes: 0 };
  }
}

/**
 * 디바운스 저장기.
 * 타이핑마다 5MB 짜리 JSON 을 쓰지 않도록 묶어서 저장한다.
 *
 * @param {(result: {ok: boolean, error: string|null}) => void} onResult
 */
export function createDebouncedSaver(onResult, delay = 300) {
  let timer = null;
  let pending = null;

  const commit = () => {
    timer = null;
    if (pending === null) return;
    const state = pending;
    pending = null;
    const result = saveStateNow(state);
    onResult?.(result);
  };

  return {
    save(state) {
      pending = state;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(commit, delay);
    },
    /** 탭을 닫기 직전 등 대기 중인 저장을 즉시 밀어 넣어야 할 때 */
    flush() {
      if (timer !== null) clearTimeout(timer);
      commit();
    },
    hasPending() {
      return pending !== null;
    },
  };
}

// ─── 스냅샷 ────────────────────────────────────────────────

/**
 * 현재 저장된 원본을 스냅샷으로 복사해 둔다.
 * 가져오기(특히 덮어쓰기) 직전에 호출해, 실수로 덮어써도 되돌릴 여지를 남긴다.
 * @returns {string|null} 스냅샷 키
 */
export function snapshotCurrent(reason = 'manual') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const key = `${SNAPSHOT_PREFIX}${reason}:${new Date().toISOString()}`;
    localStorage.setItem(key, raw);
    dropOldestSnapshots(MAX_SNAPSHOTS);
    return key;
  } catch {
    return null;
  }
}

export function listSnapshots() {
  return allKeys()
    .filter((k) => k.startsWith(SNAPSHOT_PREFIX))
    .sort()
    .reverse();
}

/** 스냅샷을 되돌린다. 성공 시 그 상태를 반환한다. */
export function restoreSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { ok: false, error: '스냅샷을 찾을 수 없습니다.' };
    const parsed = JSON.parse(raw);
    const shape = validateStateShape(parsed);
    if (!shape.ok) {
      return { ok: false, error: `스냅샷이 손상되었습니다.\n${formatErrors(shape.errors)}` };
    }
    return { ok: true, state: pruneOrphans(ensureShape(parsed)).state, error: null };
  } catch (err) {
    return { ok: false, error: `스냅샷 복구 실패: ${err.message}` };
  }
}

/** 최신 keep 개만 남기고 오래된 스냅샷을 지운다. @returns 삭제 개수 */
function dropOldestSnapshots(keep) {
  const snapshots = listSnapshots();
  let removed = 0;
  for (const key of snapshots.slice(Math.max(keep, 0))) {
    try {
      localStorage.removeItem(key);
      removed += 1;
    } catch {
      /* 무시 */
    }
  }
  return removed;
}

// ─── 용량 ─────────────────────────────────────────────────

/** 대시보드에 사용률을 표시하기 위한 근사 계산 */
export function getStorageUsage() {
  let appBytes = 0;
  let totalBytes = 0;
  for (const key of allKeys()) {
    let size = 0;
    try {
      size = (localStorage.getItem(key)?.length ?? 0) + key.length;
    } catch {
      size = 0;
    }
    totalBytes += size;
    if (key.startsWith('learning-tracker')) appBytes += size;
  }
  return {
    appBytes,
    totalBytes,
    quotaBytes: ASSUMED_QUOTA_BYTES,
    ratio: Math.min(1, totalBytes / ASSUMED_QUOTA_BYTES),
  };
}

// ─── 내부 헬퍼 ─────────────────────────────────────────────

function preserveCorrupt(raw) {
  const key = `${CORRUPT_PREFIX}${new Date().toISOString()}`;
  try {
    localStorage.setItem(key, raw);
    return key;
  } catch {
    return '(보존 실패 — 저장 공간 부족)';
  }
}

function allKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null) keys.push(key);
    }
  } catch {
    /* 무시 */
  }
  return keys;
}

function isQuotaError(err) {
  return (
    err?.name === 'QuotaExceededError' ||
    err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err?.code === 22 ||
    err?.code === 1014
  );
}
