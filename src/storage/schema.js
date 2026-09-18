/**
 * 데이터 스키마 — 이 파일이 데이터 형태에 대한 단일 진실 공급원이다.
 *
 * 저장 구조는 3단 계층(Subject > Block > Entry)이지만 중첩 객체가 아니라
 * 평면 맵으로 보관한다. 이유:
 *   - 캘린더는 '날짜'로, 과목 화면은 'subjectId'로 조회한다. 두 방향이 모두 필요하다.
 *   - Entry 상세에서 소속 Block/Subject 로 O(1) 역참조가 된다 (반대 경로 점프).
 *   - 완료 토글·수정·삭제가 깊은 중첩 불변 업데이트 없이 끝난다.
 */

import { newId } from '../lib/id.js';
import { todayKey } from '../lib/date.js';
import { normalizeHex } from '../lib/color.js';

/**
 * v1 → v2: Subject 에 사용자 지정 색(customColor)이 추가되었다.
 * 자동 배정된 colorHue 는 그대로 두고, customColor 가 있으면 렌더링에서만 우선한다.
 *
 * v2 → v3: Block 이 '그릇'에서 '자체 정보를 가진 계층'으로 올라갔다.
 * Block 에 description/progressPercent/diagramCode/svgCode 가, Entry 에는
 * diagramCode/progressPercent 가 붙는다.
 *
 * progressPercent 가 두 곳에 있는 것은 의도된 것이다. 둘은 다른 값이다.
 *   - Block.progressPercent  = 그 블록의 대표 진행률. 트래커가 계산하지 않고
 *     claude.ai 가 계산해 보내준 값을 그대로 보관만 한다.
 *   - Entry.progressPercent  = 그 기록 시점의 진행률. 시간축으로 늘어놓아
 *     블록 상세의 진행률 추이 그래프를 그리는 데 쓴다.
 * 앞의 것은 '지금 어디쯤인가', 뒤의 것은 '어떻게 여기까지 왔나'를 답한다.
 */
export const SCHEMA_VERSION = 3;

/** localStorage 메인 키 */
export const STORAGE_KEY = 'learning-tracker:v1';

/** 백업 파일 서명 — 엉뚱한 JSON 을 즉시 판별하기 위한 값 */
export const BACKUP_APP_ID = 'learning-tracker';

/** 가져오기 직전 상태를 보관하는 스냅샷 키 접두사 */
export const SNAPSHOT_PREFIX = 'learning-tracker:snapshot:';

/** 파싱에 실패한 원본을 보존하는 키 접두사 (덮어써서 날리지 않기 위함) */
export const CORRUPT_PREFIX = 'learning-tracker:corrupt:';

export const DEFAULT_SETTINGS = {
  /** 이 일수가 지나면 완전한 무채색이 된다 */
  inactivityDays: 7,
  /** 다음 Subject 에 배정할 골든앵글 순번. 정수라서 두 기기의 값을 max() 로 합칠 수 있다. */
  hueIndex: 0,
  /** 마지막으로 JSON 내보내기를 한 시각 (ISO) */
  lastExportedAt: null,
  /** 마지막으로 데이터가 변경된 시각 (ISO) — 삭제까지 포함해 '변경 있음'을 판단 */
  lastChangeAt: null,
};

export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    subjects: {},
    subjectOrder: [],
    blocks: {},
    entries: {},
  };
}

// ─── 엔티티 팩토리 ─────────────────────────────────────────

export function makeSubject({ name, totalBlocks = 0, colorHue = 0, customColor = null }) {
  const now = nowIso();
  return {
    id: newId(),
    name: String(name ?? '').trim(),
    colorHue,
    customColor: normalizeCustomColor(customColor),
    totalBlocks: toNonNegativeInt(totalBlocks),
    createdAt: now,
    updatedAt: now,
  };
}

export function makeBlock({
  subjectId,
  name,
  order = 0,
  description = '',
  progressPercent = null,
  diagramCode = null,
  svgCode = null,
}) {
  const now = nowIso();
  return {
    id: newId(),
    subjectId,
    name: String(name ?? '').trim(),
    isCompleted: false,
    order,
    description: String(description ?? ''),
    progressPercent: normalizePercent(progressPercent),
    diagramCode: normalizeDiagram(diagramCode),
    svgCode: normalizeSvg(svgCode),
    createdAt: now,
    updatedAt: now,
  };
}

export function makeEntry({
  blockId,
  date = todayKey(),
  tags = [],
  content = '',
  diagramCode = null,
  svgCode = null,
  title = null,
  progressPercent = null,
}) {
  const now = nowIso();
  return {
    id: newId(),
    blockId,
    date,
    title: normalizeTitle(title),
    tags: normalizeTags(tags),
    content: String(content ?? ''),
    diagramCode: normalizeDiagram(diagramCode),
    svgCode: normalizeSvg(svgCode),
    progressPercent: normalizePercent(progressPercent),
    createdAt: now,
    updatedAt: now,
  };
}

// ─── 정규화 헬퍼 ───────────────────────────────────────────

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of tags) {
    const tag = String(raw ?? '').trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue; // 대소문자만 다른 중복은 하나로 본다
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function normalizeTitle(title) {
  if (typeof title !== 'string') return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 사용자 지정 색은 '#rrggbb' 로만 보관한다.
 * 유효하지 않으면 null 로 떨어뜨려 자동 배정 색을 쓰게 한다.
 */
export function normalizeCustomColor(value) {
  return normalizeHex(value);
}

export function normalizeSvg(svgCode) {
  return trimToNull(svgCode);
}

/**
 * 다이어그램은 Mermaid 문법 텍스트 원문을 그대로 보관한다.
 * SVG 와 같은 규칙이지만 별도 함수로 두는 쪽이 호출부에서 읽기 쉽고,
 * 나중에 한쪽 규칙만 바뀌어도 서로를 건드리지 않는다.
 */
export function normalizeDiagram(diagramCode) {
  return trimToNull(diagramCode);
}

/**
 * 진행률은 0~100 정수 또는 null 이다.
 *
 * '미설정'과 '0%'는 다른 뜻이라 반드시 null 로 구분한다.
 * (toNonNegativeInt 는 잘못된 값을 0 으로 떨어뜨리므로 여기 쓸 수 없다)
 * 범위를 넘는 값은 버리지 않고 양 끝으로 물린다 — claude.ai 가 105 를 보내와도
 * 기록 자체를 잃는 것보다 100 으로 저장되는 편이 낫다.
 */
export function normalizePercent(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function trimToNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toNonNegativeInt(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ─── 마이그레이션 ──────────────────────────────────────────

/**
 * 과거 버전 데이터를 현재 스키마로 끌어올린다.
 * 버전이 올라갈 때마다 여기에 단계를 추가한다. (v1 → v2 → ... 순차 적용)
 */
const MIGRATIONS = {
  /** v1 → v2: Subject 에 customColor(사용자 지정 색) 필드 추가 */
  1: (state) => ({
    ...state,
    subjects: Object.fromEntries(
      Object.entries(state.subjects ?? {}).map(([id, subject]) => [
        id,
        { ...subject, customColor: normalizeCustomColor(subject.customColor) },
      ])
    ),
  }),

  /**
   * v2 → v3: Block 이 자체 정보(설명·진행률·다이어그램·SVG)를 갖고,
   * Entry 에 다이어그램과 진행률이 붙는다.
   *
   * 기존 데이터에는 전부 없는 필드이므로 '미설정'을 뜻하는 값으로 채운다.
   * 진행률을 0 이 아니라 null 로 채우는 게 중요하다 — 0 으로 채우면 예전 기록이
   * 전부 "진행률 0%"로 그래프에 찍혀 추이가 거짓이 된다.
   */
  2: (state) => ({
    ...state,
    blocks: Object.fromEntries(
      Object.entries(state.blocks ?? {}).map(([id, block]) => [
        id,
        {
          ...block,
          description: String(block.description ?? ''),
          progressPercent: normalizePercent(block.progressPercent),
          diagramCode: normalizeDiagram(block.diagramCode),
          svgCode: normalizeSvg(block.svgCode),
        },
      ])
    ),
    entries: Object.fromEntries(
      Object.entries(state.entries ?? {}).map(([id, entry]) => [
        id,
        {
          ...entry,
          diagramCode: normalizeDiagram(entry.diagramCode),
          progressPercent: normalizePercent(entry.progressPercent),
        },
      ])
    ),
  }),
};

/**
 * @returns {{ state: object, applied: number[] }}
 * @throws {Error} 앱보다 높은 버전이면 안전하게 다룰 수 없으므로 던진다.
 */
export function migrate(rawState) {
  const from = Number(rawState?.version);
  if (!Number.isFinite(from)) {
    throw new Error('버전 정보가 없습니다.');
  }
  if (from > SCHEMA_VERSION) {
    throw new Error(
      `더 새로운 버전(v${from})에서 만든 데이터입니다. 앱을 최신으로 업데이트한 뒤 다시 시도하세요.`
    );
  }

  let state = rawState;
  const applied = [];
  for (let v = from; v < SCHEMA_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new Error(`v${v} → v${v + 1} 마이그레이션 경로가 없습니다.`);
    }
    state = step(state);
    applied.push(v + 1);
  }

  return { state: ensureShape(state), applied };
}

/**
 * 누락된 필드를 기본값으로 채워 넣는다.
 * 손상 복구가 아니라 "구조는 맞지만 필드가 빠진" 경우를 메우는 용도다.
 * 구조 자체의 검증은 storage/validate.js 가 맡는다.
 */
export function ensureShape(state) {
  const base = createInitialState();
  const subjects = state?.subjects ?? {};
  const blocks = state?.blocks ?? {};
  const entries = state?.entries ?? {};

  const subjectOrder = Array.isArray(state?.subjectOrder)
    ? state.subjectOrder.filter((id) => Object.hasOwn(subjects, id))
    : [];

  // subjectOrder 에서 누락된 과목이 있으면 뒤에 덧붙여 유실을 막는다.
  for (const id of Object.keys(subjects)) {
    if (!subjectOrder.includes(id)) subjectOrder.push(id);
  }

  return {
    version: SCHEMA_VERSION,
    settings: { ...base.settings, ...(state?.settings ?? {}) },
    subjects,
    subjectOrder,
    blocks,
    entries,
  };
}

/**
 * 부모가 사라진 Block/Entry 를 걷어낸다.
 * 불러오기와 가져오기 양쪽에서 쓴다 — 고아가 남으면 어느 화면에도 보이지
 * 않으면서 용량만 차지하고, 진도율 계산도 어긋난다.
 *
 * @returns {{ state: object, removed: { blocks: number, entries: number } }}
 */
export function pruneOrphans(state) {
  const blocks = {};
  let removedBlocks = 0;
  for (const [id, block] of Object.entries(state.blocks)) {
    if (Object.hasOwn(state.subjects, block.subjectId)) blocks[id] = block;
    else removedBlocks += 1;
  }

  const entries = {};
  let removedEntries = 0;
  for (const [id, entry] of Object.entries(state.entries)) {
    if (Object.hasOwn(blocks, entry.blockId)) entries[id] = entry;
    else removedEntries += 1;
  }

  if (removedBlocks === 0 && removedEntries === 0) {
    return { state, removed: { blocks: 0, entries: 0 } };
  }
  return {
    state: { ...state, blocks, entries },
    removed: { blocks: removedBlocks, entries: removedEntries },
  };
}
