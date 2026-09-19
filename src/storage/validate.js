/**
 * 백업 파일 / 저장 데이터 검증.
 *
 * 핵심 원칙: 검증이 끝나기 전에는 기존 데이터를 단 한 바이트도 건드리지 않는다.
 * 그래서 이 모듈은 순수 함수만 두고, 부수효과(저장·스냅샷)는 importData.js 가 맡는다.
 *
 * 실패는 절대 조용히 넘어가지 않는다. 어느 항목이 왜 잘못됐는지 경로까지 돌려준다.
 */

import { BACKUP_APP_ID, SCHEMA_VERSION } from './schema.js';
import { isValidDateKey } from '../lib/date.js';

/** 화면에 한 번에 보여줄 오류 최대 개수 (수백 개가 쏟아지는 걸 방지) */
export const MAX_REPORTED_ERRORS = 12;

const isPlainObject = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/**
 * 백업 파일 전체(봉투 포함)를 검증한다.
 * @returns {{ ok: boolean, errors: Array, warnings: Array, backup: object|null }}
 */
export function validateBackup(parsed) {
  const errors = [];

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      errors: [
        {
          path: '(파일)',
          message: '최상위가 JSON 객체가 아닙니다. 학습 트래커 백업 파일이 아닙니다.',
        },
      ],
      warnings: [],
      backup: null,
    };
  }

  if (parsed.app !== BACKUP_APP_ID) {
    return {
      ok: false,
      errors: [
        {
          path: 'app',
          message:
            '학습 트래커 백업 파일이 아닙니다. 내보내기로 받은 learning-tracker-backup-*.json 을 선택해 주세요.',
        },
      ],
      warnings: [],
      backup: null,
    };
  }

  const version = Number(parsed.schemaVersion);
  if (!Number.isFinite(version)) {
    errors.push({ path: 'schemaVersion', message: '스키마 버전이 없습니다.' });
  } else if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: 'schemaVersion',
          message: `더 새로운 버전(v${version})에서 만든 백업입니다. 앱을 최신으로 업데이트한 뒤 다시 시도하세요.`,
        },
      ],
      warnings: [],
      backup: null,
    };
  }

  if (!isPlainObject(parsed.data)) {
    return {
      ok: false,
      errors: [...errors, { path: 'data', message: '데이터 본문이 없습니다.' }],
      warnings: [],
      backup: null,
    };
  }

  const shape = validateStateShape(parsed.data);
  errors.push(...shape.errors);

  // counts 교차 검증 — 파일이 중간에 잘렸는지 잡아낸다.
  if (isPlainObject(parsed.counts)) {
    const actual = countEntities(parsed.data);
    for (const kind of ['subjects', 'blocks', 'entries']) {
      const declared = Number(parsed.counts[kind]);
      if (Number.isFinite(declared) && declared !== actual[kind]) {
        errors.push({
          path: `counts.${kind}`,
          message: `파일이 일부 손실된 것 같습니다. (${KIND_LABELS[kind]} ${declared}개여야 하는데 ${actual[kind]}개)`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    warnings: shape.warnings,
    backup:
      errors.length === 0
        ? {
            version,
            exportedAt: parsed.exportedAt ?? null,
            data: parsed.data,
            counts: countEntities(parsed.data),
          }
        : null,
  };
}

const KIND_LABELS = { subjects: '과목', blocks: '블록', entries: '기록' };

/**
 * state 본문의 구조를 검증한다.
 *
 * errors   = 가져오기를 중단시켜야 하는 문제
 * warnings = 가져오되 해당 항목을 버리고 보고하면 되는 문제 (고아 등)
 */
export function validateStateShape(data) {
  const errors = [];
  const warnings = [];

  for (const kind of ['subjects', 'blocks', 'entries']) {
    if (!isPlainObject(data[kind])) {
      errors.push({
        path: kind,
        message: `${KIND_LABELS[kind]} 목록이 객체 형태가 아닙니다.`,
      });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  if (data.subjectOrder !== undefined && !Array.isArray(data.subjectOrder)) {
    warnings.push({
      path: 'subjectOrder',
      message: '과목 순서 정보가 배열이 아니어서 무시하고 새로 계산합니다.',
    });
  }

  if (data.settings !== undefined && !isPlainObject(data.settings)) {
    warnings.push({
      path: 'settings',
      message: '설정이 객체가 아니어서 기본값을 사용합니다.',
    });
  }

  // ─ Subject ─
  const subjectIds = Object.keys(data.subjects);
  subjectIds.forEach((key, i) => {
    const s = data.subjects[key];
    const at = (f) => `subjects[${i}].${f}`;
    if (!isPlainObject(s)) {
      errors.push({ path: `subjects[${i}]`, message: '과목 항목이 객체가 아닙니다.' });
      return;
    }
    if (s.id !== key) {
      errors.push({ path: at('id'), message: `id 가 키와 다릅니다. (${s.id} ≠ ${key})` });
    }
    if (typeof s.name !== 'string') {
      errors.push({ path: at('name'), message: '과목 이름이 문자열이 아닙니다.' });
    }
    if (!Number.isFinite(Number(s.colorHue))) {
      errors.push({ path: at('colorHue'), message: '색상값(colorHue)이 숫자가 아닙니다.' });
    }
    // customColor 는 v2 에서 추가된 선택 필드다. 형식이 틀리면 경고만 하고
    // 자동 배정 색으로 떨어뜨린다 — 색 하나 때문에 가져오기를 막을 이유가 없다.
    if (s.customColor != null && typeof s.customColor !== 'string') {
      warnings.push({
        path: at('customColor'),
        message: '사용자 지정 색 형식이 올바르지 않아 자동 배정 색을 사용합니다.',
      });
    }
    if (!Number.isFinite(Number(s.totalBlocks)) || Number(s.totalBlocks) < 0) {
      errors.push({
        path: at('totalBlocks'),
        message: '전체 진도 단위 수가 0 이상의 숫자가 아닙니다.',
      });
    }
    // ─ v4 에서 추가된 Subject 자체 정보. 전부 선택 필드다. ─
    if (s.description != null && typeof s.description !== 'string') {
      errors.push({ path: at('description'), message: '과목 설명이 문자열이 아닙니다.' });
    }
    if (s.diagramCode != null && typeof s.diagramCode !== 'string') {
      errors.push({ path: at('diagramCode'), message: '다이어그램 코드가 문자열이 아닙니다.' });
    }
    if (s.svgCode != null && typeof s.svgCode !== 'string') {
      errors.push({ path: at('svgCode'), message: 'SVG 코드가 문자열이 아닙니다.' });
    }
  });

  // ─ Block ─
  Object.keys(data.blocks).forEach((key, i) => {
    const b = data.blocks[key];
    const at = (f) => `blocks[${i}].${f}`;
    if (!isPlainObject(b)) {
      errors.push({ path: `blocks[${i}]`, message: '블록 항목이 객체가 아닙니다.' });
      return;
    }
    if (b.id !== key) {
      errors.push({ path: at('id'), message: `id 가 키와 다릅니다. (${b.id} ≠ ${key})` });
    }
    if (!isNonEmptyString(b.subjectId)) {
      errors.push({ path: at('subjectId'), message: '소속 과목 id 가 없습니다.' });
    } else if (!Object.hasOwn(data.subjects, b.subjectId)) {
      warnings.push({
        path: at('subjectId'),
        message: `소속 과목(${b.subjectId})이 백업에 없습니다. 이 블록은 건너뜁니다.`,
      });
    }
    if (typeof b.name !== 'string') {
      errors.push({ path: at('name'), message: '블록 이름이 문자열이 아닙니다.' });
    }
    if (typeof b.isCompleted !== 'boolean') {
      errors.push({ path: at('isCompleted'), message: '완료 여부가 true/false 가 아닙니다.' });
    }
    // ─ v3 에서 추가된 Block 자체 정보. 전부 선택 필드다. ─
    if (b.description != null && typeof b.description !== 'string') {
      errors.push({ path: at('description'), message: '블록 설명이 문자열이 아닙니다.' });
    }
    if (b.diagramCode != null && typeof b.diagramCode !== 'string') {
      errors.push({ path: at('diagramCode'), message: '다이어그램 코드가 문자열이 아닙니다.' });
    }
    if (b.svgCode != null && typeof b.svgCode !== 'string') {
      errors.push({ path: at('svgCode'), message: 'SVG 코드가 문자열이 아닙니다.' });
    }
    warnings.push(...checkPercent(b.progressPercent, at('progressPercent'), '블록 진행률'));
  });

  // ─ Entry ─
  Object.keys(data.entries).forEach((key, i) => {
    const e = data.entries[key];
    const at = (f) => `entries[${i}].${f}`;
    if (!isPlainObject(e)) {
      errors.push({ path: `entries[${i}]`, message: '기록 항목이 객체가 아닙니다.' });
      return;
    }
    if (e.id !== key) {
      errors.push({ path: at('id'), message: `id 가 키와 다릅니다. (${e.id} ≠ ${key})` });
    }
    if (!isNonEmptyString(e.blockId)) {
      errors.push({ path: at('blockId'), message: '소속 블록 id 가 없습니다.' });
    } else if (!Object.hasOwn(data.blocks, e.blockId)) {
      warnings.push({
        path: at('blockId'),
        message: `소속 블록(${e.blockId})이 백업에 없습니다. 이 기록은 건너뜁니다.`,
      });
    }
    if (!isValidDateKey(e.date)) {
      errors.push({
        path: at('date'),
        message: `날짜 형식 오류 (YYYY-MM-DD 여야 함, 받은 값: ${JSON.stringify(e.date)})`,
      });
    }
    if (typeof e.content !== 'string') {
      errors.push({ path: at('content'), message: '내용이 문자열이 아닙니다.' });
    }
    if (e.tags !== undefined && !Array.isArray(e.tags)) {
      errors.push({ path: at('tags'), message: '태그가 배열이 아닙니다.' });
    }
    if (e.svgCode != null && typeof e.svgCode !== 'string') {
      errors.push({ path: at('svgCode'), message: 'SVG 코드가 문자열이 아닙니다.' });
    }
    if (e.title != null && typeof e.title !== 'string') {
      errors.push({ path: at('title'), message: '제목이 문자열이 아닙니다.' });
    }
    if (e.diagramCode != null && typeof e.diagramCode !== 'string') {
      errors.push({ path: at('diagramCode'), message: '다이어그램 코드가 문자열이 아닙니다.' });
    }
    warnings.push(...checkPercent(e.progressPercent, at('progressPercent'), '기록 진행률'));
  });

  return {
    ok: errors.length === 0,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    warnings,
  };
}

/**
 * 진행률(0~100 또는 null) 검사.
 *
 * 오류가 아니라 경고로 둔다. 진행률은 claude.ai 가 계산해 보내준 참고값이라
 * 값 하나가 이상하다고 백업 전체의 가져오기를 막을 만한 데이터가 아니다.
 * 화면에 그릴 때 0~100 으로 물려서 표시한다.
 */
function checkPercent(value, path, label) {
  if (value == null) return [];
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return [{ path, message: `${label}이 숫자가 아니어서 무시합니다. (받은 값: ${JSON.stringify(value)})` }];
  }
  if (n < 0 || n > 100) {
    return [{ path, message: `${label}이 0~100 범위를 벗어났습니다. (${n}) 표시할 때 범위 안으로 맞춥니다.` }];
  }
  return [];
}

export function countEntities(data) {
  return {
    subjects: Object.keys(data?.subjects ?? {}).length,
    blocks: Object.keys(data?.blocks ?? {}).length,
    entries: Object.keys(data?.entries ?? {}).length,
  };
}

/** 오류 목록을 사람이 읽을 한 덩어리 문자열로 */
export function formatErrors(errors) {
  if (!errors?.length) return '';
  return errors.map((e) => `• ${e.path}: ${e.message}`).join('\n');
}
