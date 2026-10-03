/**
 * 단일 reducer — 모든 데이터 변경은 여기를 지난다.
 *
 * 규칙 두 가지:
 *  1. 새 엔티티의 id 는 호출부가 미리 만들어 액션에 실어 보낸다.
 *     그래야 dispatch 직후 곧바로 그 화면으로 이동할 수 있다.
 *  2. 파생값(hue, order)은 reducer 안에서 state 를 보고 계산한다.
 *     콜백이 낡은 state 를 참조해 색이 겹치는 사고를 막기 위함이다.
 */

import {
  nowIso,
  normalizeTags,
  normalizeTitle,
  normalizeSvg,
  normalizeDiagram,
  normalizePercent,
  normalizeCustomColor,
  createInitialState,
} from '../storage/schema.js';
import { nextFreeHueIndex } from '../lib/color.js';

export const ACTIONS = {
  SUBJECT_ADD: 'subject/add',
  SUBJECT_UPDATE: 'subject/update',
  SUBJECT_REMOVE: 'subject/remove',
  SUBJECT_REORDER: 'subject/reorder',

  BLOCK_ADD: 'block/add',
  BLOCK_UPDATE: 'block/update',
  BLOCK_TOGGLE: 'block/toggle',
  BLOCK_REMOVE: 'block/remove',
  BLOCK_REORDER: 'block/reorder',
  BLOCK_MOVE: 'block/move',

  ENTRY_ADD: 'entry/add',
  ENTRY_UPDATE: 'entry/update',
  ENTRY_REMOVE: 'entry/remove',
  ENTRY_MOVE: 'entry/move',

  BUNDLE_APPLY: 'bundle/apply',
  BUNDLES_APPLY: 'bundles/apply',

  SETTINGS_UPDATE: 'settings/update',
  EXPORT_MARK: 'export/mark',
  DATA_REPLACE: 'data/replace',
  DATA_RESET: 'data/reset',
};

export function reducer(state, action) {
  switch (action.type) {
    // ─── Subject ───────────────────────────────────────────
    case ACTIONS.SUBJECT_ADD: {
      const { id, name, customColor, description, diagramCode, svgCode } = action;

      // 이미 쓰이는 색과 겹치지 않는 다음 순번을 고른다.
      // (백업 병합으로 순번이 건너뛰어졌을 수 있으므로 커서만 믿지 않는다)
      const usedHues = Object.values(state.subjects)
        .map((s) => Number(s.colorHue))
        .filter(Number.isFinite);
      const { index, hue } = nextFreeHueIndex(usedHues, state.settings.hueIndex);

      const at = nowIso();
      return touch({
        ...state,
        settings: { ...state.settings, hueIndex: index + 1 },
        subjects: {
          ...state.subjects,
          [id]: {
            id,
            name: String(name ?? '').trim(),
            // 자동 배정 색은 사용자가 색을 직접 골랐더라도 그대로 남긴다.
            // 골든 앵글 순서와 색 충돌 판정이 계속 이 값으로만 이뤄지기 때문이다.
            colorHue: hue,
            customColor: normalizeCustomColor(customColor),
            description: String(description ?? ''),
            diagramCode: normalizeDiagram(diagramCode),
            svgCode: normalizeSvg(svgCode),
            createdAt: at,
            updatedAt: at,
          },
        },
        subjectOrder: [...state.subjectOrder, id],
      });
    }

    case ACTIONS.SUBJECT_UPDATE: {
      const current = state.subjects[action.id];
      if (!current) return state;
      const patch = {};
      if (action.patch.name !== undefined) patch.name = String(action.patch.name).trim();
      // null 을 넘기면 자동 배정 색으로 되돌아간다.
      if (action.patch.customColor !== undefined) {
        patch.customColor = normalizeCustomColor(action.patch.customColor);
      }
      if (action.patch.description !== undefined) {
        patch.description = String(action.patch.description);
      }
      if (action.patch.diagramCode !== undefined) {
        patch.diagramCode = normalizeDiagram(action.patch.diagramCode);
      }
      if (action.patch.svgCode !== undefined) {
        patch.svgCode = normalizeSvg(action.patch.svgCode);
      }
      return touch({
        ...state,
        subjects: {
          ...state.subjects,
          [action.id]: { ...current, ...patch, updatedAt: nowIso() },
        },
      });
    }

    case ACTIONS.SUBJECT_REMOVE: {
      if (!state.subjects[action.id]) return state;

      const subjects = omit(state.subjects, action.id);
      const removedBlockIds = new Set(
        Object.values(state.blocks)
          .filter((b) => b.subjectId === action.id)
          .map((b) => b.id)
      );

      return touch({
        ...state,
        subjects,
        subjectOrder: state.subjectOrder.filter((id) => id !== action.id),
        blocks: filterValues(state.blocks, (b) => !removedBlockIds.has(b.id)),
        entries: filterValues(state.entries, (e) => !removedBlockIds.has(e.blockId)),
      });
    }

    case ACTIONS.SUBJECT_REORDER: {
      const known = action.order.filter((id) => Object.hasOwn(state.subjects, id));
      const missing = state.subjectOrder.filter((id) => !known.includes(id));
      return touch({ ...state, subjectOrder: [...known, ...missing] });
    }

    // ─── Block ─────────────────────────────────────────────
    case ACTIONS.BLOCK_ADD: {
      const { id, subjectId, name, description, progressPercent, diagramCode, svgCode } = action;
      if (!state.subjects[subjectId]) return state;

      const at = nowIso();
      return touch({
        ...state,
        blocks: {
          ...state.blocks,
          [id]: {
            id,
            subjectId,
            name: String(name ?? '').trim(),
            isCompleted: false,
            order: nextBlockOrder(state, subjectId),
            description: String(description ?? ''),
            progressPercent: normalizePercent(progressPercent),
            diagramCode: normalizeDiagram(diagramCode),
            svgCode: normalizeSvg(svgCode),
            // 블록 정보(설명·진행률·그림)를 마지막으로 받거나 고친 시각. 이름만 있는 새 블록은 '모름'.
            infoUpdatedAt: null,
            createdAt: at,
            updatedAt: at,
          },
        },
      });
    }

    case ACTIONS.BLOCK_UPDATE: {
      const current = state.blocks[action.id];
      if (!current) return state;

      const p = action.patch;
      const patch = {};
      if (p.name !== undefined) patch.name = String(p.name).trim();
      if (p.isCompleted !== undefined) patch.isCompleted = Boolean(p.isCompleted);
      if (p.description !== undefined) patch.description = String(p.description);
      // null 을 넘기면 '미설정'으로 되돌아간다 (0% 와는 다른 상태다)
      if (p.progressPercent !== undefined) patch.progressPercent = normalizePercent(p.progressPercent);
      if (p.diagramCode !== undefined) patch.diagramCode = normalizeDiagram(p.diagramCode);
      if (p.svgCode !== undefined) patch.svgCode = normalizeSvg(p.svgCode);

      const at = nowIso();
      // 블록 정보 갱신 시각: 가져오기(markInfo)는 값이 같아도 '지금 기준으로 확인됨'이라 찍고,
      // 손으로 고친 경우는 정보 항목이 실제로 바뀌었을 때만 찍는다 (이름·완료만 바꾼 건 아니다).
      const infoChanged = INFO_FIELDS.some(
        (key) => Object.hasOwn(patch, key) && patch[key] !== (current[key] ?? defaultInfo(key))
      );
      if (action.markInfo || infoChanged) patch.infoUpdatedAt = at;

      return touch({
        ...state,
        blocks: { ...state.blocks, [action.id]: { ...current, ...patch, updatedAt: at } },
      });
    }

    case ACTIONS.BLOCK_TOGGLE: {
      const current = state.blocks[action.id];
      if (!current) return state;
      return touch({
        ...state,
        blocks: {
          ...state.blocks,
          [action.id]: {
            ...current,
            isCompleted: !current.isCompleted,
            updatedAt: nowIso(),
          },
        },
      });
    }

    case ACTIONS.BLOCK_REMOVE: {
      const current = state.blocks[action.id];
      if (!current) return state;
      return touch({
        ...state,
        blocks: omit(state.blocks, action.id),
        entries: filterValues(state.entries, (e) => e.blockId !== action.id),
      });
    }

    /**
     * 블록을 다른 과목으로 옮긴다.
     *
     * 소속 Entry 는 blockId 로만 블록에 매달려 있어 함께 따라온다 (건드릴 필요가 없다).
     * order 는 옮겨간 과목의 맨 뒤로 새로 받는다 — 원래 과목에서의 순번을 그대로
     * 들고 가면 이미 그 번호를 쓰는 블록과 겹쳐 목록 순서가 흔들린다.
     */
    case ACTIONS.BLOCK_MOVE: {
      const current = state.blocks[action.id];
      if (!current) return state;
      if (!state.subjects[action.subjectId]) return state;
      if (current.subjectId === action.subjectId) return state;

      return touch({
        ...state,
        blocks: {
          ...state.blocks,
          [action.id]: {
            ...current,
            subjectId: action.subjectId,
            order: nextBlockOrder(state, action.subjectId),
            updatedAt: nowIso(),
          },
        },
      });
    }

    case ACTIONS.BLOCK_REORDER: {
      const at = nowIso();
      const blocks = { ...state.blocks };
      action.orderedIds.forEach((id, index) => {
        const block = blocks[id];
        if (block && block.subjectId === action.subjectId) {
          blocks[id] = { ...block, order: index, updatedAt: at };
        }
      });
      return touch({ ...state, blocks });
    }

    // ─── Entry ─────────────────────────────────────────────
    case ACTIONS.ENTRY_ADD: {
      const { id, blockId, date, tags, content, diagramCode, svgCode, title, progressPercent } =
        action;
      if (!state.blocks[blockId]) return state;

      const at = nowIso();
      return touch({
        ...state,
        entries: {
          ...state.entries,
          [id]: {
            id,
            blockId,
            date,
            title: normalizeTitle(title),
            tags: normalizeTags(tags),
            content: String(content ?? ''),
            diagramCode: normalizeDiagram(diagramCode),
            svgCode: normalizeSvg(svgCode),
            progressPercent: normalizePercent(progressPercent),
            createdAt: at,
            updatedAt: at,
          },
        },
      });
    }

    case ACTIONS.ENTRY_UPDATE: {
      const current = state.entries[action.id];
      if (!current) return state;

      const p = action.patch;
      const patch = {};
      if (p.date !== undefined) patch.date = p.date;
      if (p.title !== undefined) patch.title = normalizeTitle(p.title);
      if (p.tags !== undefined) patch.tags = normalizeTags(p.tags);
      if (p.content !== undefined) patch.content = String(p.content);
      if (p.diagramCode !== undefined) patch.diagramCode = normalizeDiagram(p.diagramCode);
      if (p.svgCode !== undefined) patch.svgCode = normalizeSvg(p.svgCode);
      if (p.progressPercent !== undefined) patch.progressPercent = normalizePercent(p.progressPercent);
      if (p.blockId !== undefined && state.blocks[p.blockId]) patch.blockId = p.blockId;

      return touch({
        ...state,
        entries: { ...state.entries, [action.id]: { ...current, ...patch, updatedAt: nowIso() } },
      });
    }

    case ACTIONS.ENTRY_REMOVE: {
      if (!state.entries[action.id]) return state;
      return touch({ ...state, entries: omit(state.entries, action.id) });
    }

    case ACTIONS.ENTRY_MOVE: {
      const current = state.entries[action.id];
      if (!current || !state.blocks[action.blockId]) return state;
      return touch({
        ...state,
        entries: {
          ...state.entries,
          [action.id]: { ...current, blockId: action.blockId, updatedAt: nowIso() },
        },
      });
    }

    /**
     * 일괄 가져오기 반영 — 과목 정보·블록들·기록들을 한 번에.
     *
     * 액션 하나로 끝내는 이유:
     *  - **원자성.** 중간에 멈추면 절반만 들어간 상태가 남는데, 그건 사용자가
     *    되돌릴 수 없는 상태다. 계획이 통째로 적용되거나 아예 적용되지 않거나 둘 중 하나여야 한다.
     *  - 리렌더와 저장(lastChangeAt)도 한 번만 일어난다.
     *
     * 계획(plan)은 lib/importPlan.js 가 만든다. id 는 호출부가 미리 만들어 싣는
     * 이 파일의 규칙을 따르되, **order 만은 여기서 계산한다** — 파생값은 reducer 가
     * state 를 보고 정하는 쪽이 낡은 값을 참조할 여지가 없다.
     */
    case ACTIONS.BUNDLE_APPLY: {
      const next = applyBundlePlan(state, action.plan);
      return next === state ? state : touch(next);
    }

    /**
     * 여러 과목에 걸친 일괄 반영 — '오늘 기록 붙여넣기'.
     * 과목마다 계획이 하나씩이고, 액션 하나로 전부 반영하거나 하나도 반영하지 않는다.
     */
    case ACTIONS.BUNDLES_APPLY: {
      const next = action.plans.reduce((acc, plan) => applyBundlePlan(acc, plan), state);
      return next === state ? state : touch(next);
    }

    // ─── 설정 / 데이터 전체 ──────────────────────────────────
    case ACTIONS.SETTINGS_UPDATE:
      return touch({ ...state, settings: { ...state.settings, ...action.patch } });

    /**
     * 내보내기 완료 표시.
     * lastChangeAt 을 건드리면 안 되므로 touch() 를 쓰지 않는다.
     * (내보내기는 데이터 변경이 아니다)
     */
    case ACTIONS.EXPORT_MARK:
      return {
        ...state,
        settings: { ...state.settings, lastExportedAt: action.at ?? nowIso() },
      };

    /** 가져오기 결과를 통째로 교체 (덮어쓰기·병합 공통) */
    case ACTIONS.DATA_REPLACE:
      return action.state;

    case ACTIONS.DATA_RESET:
      return createInitialState();

    default:
      return state;
  }
}

/**
 * 계획 하나(과목 하나 분량)를 state 에 반영한다. BUNDLE_APPLY 와 BUNDLES_APPLY 가 같이 쓴다.
 * 과목이 없으면 그대로 돌려준다.
 */
function applyBundlePlan(state, plan) {
  const subject = state.subjects[plan.subjectId];
  if (!subject) return state;

  const at = nowIso();

  const subjects = plan.subjectPatch
    ? {
        ...state.subjects,
        [plan.subjectId]: {
          ...subject,
          description: String(plan.subjectPatch.description ?? ''),
          diagramCode: normalizeDiagram(plan.subjectPatch.diagramCode),
          svgCode: normalizeSvg(plan.subjectPatch.svgCode),
          updatedAt: at,
        },
      }
    : state.subjects;

  const blocks = { ...state.blocks };
  let nextOrder = nextBlockOrder(state, plan.subjectId);

  for (const item of plan.blocks) {
    const current = blocks[item.id];
    // ---BLOCK--- 는 적은 항목만 바꾼다. undefined(빠진 항목)는 지금 값을 그대로 둔다.
    // (지우려면 '(지움)' 으로 적어 null/'' 이 들어온다)
    const p = item.patch;
    const patch = {};
    if (p.description !== undefined) patch.description = String(p.description ?? '');
    if (p.progressPercent !== undefined) patch.progressPercent = normalizePercent(p.progressPercent);
    if (p.diagramCode !== undefined) patch.diagramCode = normalizeDiagram(p.diagramCode);
    if (p.svgCode !== undefined) patch.svgCode = normalizeSvg(p.svgCode);

    // ---BLOCK--- 문서로 받은 정보면 갱신 시각을 찍는다. 과목 정보의 '블록 목록'으로
    // 이름만 만든 뼈대(infoFromDoc === false)는 정보를 받은 게 아니므로 '모름'으로 둔다.
    const infoUpdatedAt = item.infoFromDoc === false ? (current?.infoUpdatedAt ?? null) : at;

    blocks[item.id] = current
      ? { ...current, ...patch, infoUpdatedAt, updatedAt: at }
      : {
          id: item.id,
          subjectId: plan.subjectId,
          name: String(item.name ?? '').trim(),
          isCompleted: false,
          // 새로 만드는 블록이 여럿이면 순번이 겹치지 않게 하나씩 올린다
          order: nextOrder++,
          description: '',
          progressPercent: null,
          diagramCode: null,
          svgCode: null,
          ...patch,
          infoUpdatedAt,
          createdAt: at,
          updatedAt: at,
        };
  }

  const entries = { ...state.entries };
  for (const item of plan.entries) {
    const current = entries[item.id];
    const data = {
      date: item.data.date,
      title: normalizeTitle(item.data.title),
      tags: normalizeTags(item.data.tags),
      content: String(item.data.content ?? ''),
      progressPercent: normalizePercent(item.data.progressPercent),
      diagramCode: normalizeDiagram(item.data.diagramCode),
      svgCode: normalizeSvg(item.data.svgCode),
    };

    entries[item.id] = current
      ? { ...current, ...data, blockId: item.blockId, updatedAt: at }
      : { id: item.id, blockId: item.blockId, ...data, createdAt: at, updatedAt: at };
  }

  return { ...state, subjects, blocks, entries };
}

/** '블록 정보'에 해당하는 항목 — 갱신 시각(infoUpdatedAt)을 찍는 기준 */
const INFO_FIELDS = ['description', 'progressPercent', 'diagramCode', 'svgCode'];

/** 필드가 없던 예전 데이터와 비교할 때의 기본값 (정규화 결과와 같은 모양) */
function defaultInfo(key) {
  return key === 'description' ? '' : null;
}

/** 데이터가 바뀐 시각을 남긴다 — '내보내기 필요' 배너의 근거가 된다. */
function touch(state) {
  return { ...state, settings: { ...state.settings, lastChangeAt: nowIso() } };
}

/**
 * 과목 안에서 다음 블록이 받을 order.
 * 추가·이동 두 곳에서 같은 규칙을 써야 하므로 함수로 뽑았다.
 */
function nextBlockOrder(state, subjectId) {
  return (
    Object.values(state.blocks)
      .filter((b) => b.subjectId === subjectId)
      .reduce((max, b) => Math.max(max, Number(b.order) || 0), -1) + 1
  );
}

function omit(obj, key) {
  const { [key]: _removed, ...rest } = obj;
  return rest;
}

function filterValues(obj, predicate) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (predicate(value)) out[key] = value;
  }
  return out;
}
