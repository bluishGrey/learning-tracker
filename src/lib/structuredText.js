/**
 * claude.ai 와 주고받는 정형 텍스트 — 이 파일이 그 형식의 단일 진실 공급원이다.
 *
 * 읽기(파싱)와 쓰기(생성)를 한 모듈에 둔 이유: 두 방향이 어긋나면 내보낸 텍스트를
 * 다시 가져올 수 없게 된다. 같은 파일 안에 있으면 한쪽만 고치는 사고가 줄어든다.
 *
 *   ---ENTRY---            기록 하나
 *   날짜: 2026-09-18       한 줄짜리 값
 *   ...
 *   내용:                  여러 줄짜리 값 (다음 키워드까지)
 *   ...
 *   ---END---
 *
 *   ---BLOCK---            블록 자체 정보 (날짜/제목/태그/내용 대신 '설명')
 *   ...
 *   ---END---
 *
 * 설계 원칙 세 가지:
 *
 *  1. **과목·블록을 새로 만들지 않는다.** 이름이 기존 것과 정확히 일치하지 않으면
 *     오류를 내고 멈춘다. 오타 하나로 'CS50x' 와 'CS50X' 두 과목에 기록이
 *     쪼개지는 사고가 이 앱에서 가장 복구하기 어려운 종류의 사고다.
 *  2. **필수 항목이 없으면 절반만 채우지 않는다.** 무엇이 없는지 이름을 대고 멈춘다.
 *  3. **파싱은 순수 함수다.** state 를 읽는 해석(resolve)은 별도 함수로 분리해서,
 *     형식 검사만 따로 시험해 볼 수 있게 한다.
 */

import { isValidDateKey } from './date.js';

export const ENTRY_MARKER = '---ENTRY---';
export const BLOCK_MARKER = '---BLOCK---';
export const END_MARKER = '---END---';

const K = {
  DATE: '날짜',
  SUBJECT: '과목',
  BLOCK: '블록',
  TITLE: '제목',
  TAGS: '태그',
  CONTENT: '내용',
  DESCRIPTION: '설명',
  PROGRESS: '진행률',
  DIAGRAM: '다이어그램',
  SVG: 'SVG',
};

/** 한 줄로 끝나는 값들. 나머지는 다음 키워드가 나올 때까지 여러 줄을 먹는다. */
const SINGLE_LINE = new Set([K.DATE, K.SUBJECT, K.BLOCK, K.TITLE, K.TAGS, K.PROGRESS]);

const FORMS = {
  entry: {
    marker: ENTRY_MARKER,
    label: '기록',
    fields: [K.DATE, K.SUBJECT, K.BLOCK, K.TITLE, K.TAGS, K.CONTENT, K.PROGRESS, K.DIAGRAM, K.SVG],
    required: [K.DATE, K.SUBJECT, K.BLOCK, K.CONTENT],
  },
  block: {
    marker: BLOCK_MARKER,
    label: '블록 정보',
    fields: [K.SUBJECT, K.BLOCK, K.DESCRIPTION, K.PROGRESS, K.DIAGRAM, K.SVG],
    required: [K.SUBJECT, K.BLOCK, K.DESCRIPTION],
  },
};

// ─── 파싱 ──────────────────────────────────────────────────

/**
 * ---ENTRY--- 텍스트 → 기록 입력 폼에 채울 값.
 *
 * @returns {{ ok: boolean, value: object|null, errors: string[], warnings: string[] }}
 */
export function parseEntryText(text) {
  const parsed = parseStructured(text, 'entry');
  if (!parsed.ok) return parsed;

  const f = parsed.fields;
  return {
    ok: true,
    value: {
      date: f[K.DATE],
      subjectName: f[K.SUBJECT],
      blockName: f[K.BLOCK],
      title: f[K.TITLE] ?? '',
      tags: f[K.TAGS] ?? [],
      content: f[K.CONTENT],
      progressPercent: f[K.PROGRESS] ?? null,
      diagramCode: f[K.DIAGRAM] ?? '',
      svgCode: f[K.SVG] ?? '',
    },
    errors: [],
    warnings: parsed.warnings,
  };
}

/**
 * ---BLOCK--- 텍스트 → 블록 자체 정보.
 * @returns {{ ok: boolean, value: object|null, errors: string[], warnings: string[] }}
 */
export function parseBlockText(text) {
  const parsed = parseStructured(text, 'block');
  if (!parsed.ok) return parsed;

  const f = parsed.fields;
  return {
    ok: true,
    value: {
      subjectName: f[K.SUBJECT],
      blockName: f[K.BLOCK],
      description: f[K.DESCRIPTION],
      progressPercent: f[K.PROGRESS] ?? null,
      diagramCode: f[K.DIAGRAM] ?? '',
      svgCode: f[K.SVG] ?? '',
    },
    errors: [],
    warnings: parsed.warnings,
  };
}

/**
 * 두 형식의 공통 파서.
 *
 * 키워드는 **줄 맨 앞**에 있어야 한다. 들여쓰기된 `SVG:` 같은 줄을 키워드로 보면
 * 내용 안의 코드·목록이 필드 경계로 오인되기 때문이다. 같은 이유로 코드펜스(```)
 * 안에서는 어떤 줄도 키워드로 보지 않는다 — 다이어그램 본문이 바로 코드펜스다.
 */
function parseStructured(text, formName) {
  const form = FORMS[formName];
  const raw = String(text ?? '').replace(/\r\n?/g, '\n');
  const lines = raw.split('\n');

  const start = lines.findIndex((line) => line.trim() === form.marker);
  if (start < 0) {
    return { ok: false, value: null, errors: [describeMissingMarker(lines, form)], warnings: [] };
  }

  // ---END--- 가 없으면 텍스트 끝까지로 본다. 복사가 조금 잘려도 앞부분은 살린다.
  let end = lines.findIndex((line, i) => i > start && line.trim() === END_MARKER);
  if (end < 0) end = lines.length;

  const body = lines.slice(start + 1, end);
  const keyPattern = new RegExp(`^(${form.fields.map(escapeRegExp).join('|')})[ \t]*:(.*)$`);

  /** @type {Record<string, string[]>} 키 → 원본 줄들 */
  const collected = {};
  let current = null;
  let inFence = false;

  for (const line of body) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;

    const match = inFence ? null : line.match(keyPattern);
    // 같은 키가 두 번 나오면 뒤쪽은 값의 일부로 본다 (내용 안의 "진행률: ..." 같은 줄)
    if (match && !Object.hasOwn(collected, match[1])) {
      current = match[1];
      collected[current] = [match[2]];
      if (SINGLE_LINE.has(current)) current = null;
      continue;
    }

    if (current) collected[current].push(line);
    // current 가 없는 줄(키 사이의 빈 줄 등)은 버린다
  }

  const errors = [];
  const warnings = [];
  const fields = {};

  // ─ 여러 줄 값: 앞뒤 빈 줄만 걷어내고 안쪽은 원문 그대로 둔다 ─
  for (const key of form.fields) {
    if (!Object.hasOwn(collected, key)) continue;
    const joined = collected[key].join('\n');
    const value = SINGLE_LINE.has(key) ? joined.trim() : trimBlankEdges(joined);
    if (value.length === 0) continue; // 키워드만 있고 값이 빈 것은 '없음'으로 본다
    fields[key] = value;
  }

  // ─ 필수 항목 ─
  const missing = form.required.filter((key) => !Object.hasOwn(fields, key));
  if (missing.length > 0) {
    const names = missing.join(', ');
    errors.push(`형식이 올바르지 않습니다: ${names}${subjectParticle(names)} 없습니다.`);
    return { ok: false, value: null, fields: null, errors, warnings };
  }

  // ─ 개별 항목 변환 ─
  if (Object.hasOwn(fields, K.DATE) && !isValidDateKey(fields[K.DATE])) {
    errors.push(
      `날짜 형식이 올바르지 않습니다: "${fields[K.DATE]}" (YYYY-MM-DD 로 적어주세요)`
    );
  }

  if (Object.hasOwn(fields, K.TAGS)) {
    fields[K.TAGS] = splitTags(fields[K.TAGS]);
  }

  if (Object.hasOwn(fields, K.PROGRESS)) {
    const percent = parsePercent(fields[K.PROGRESS]);
    if (percent === null) {
      errors.push(
        `진행률은 0~100 사이의 숫자여야 합니다: "${fields[K.PROGRESS]}"`
      );
    } else {
      fields[K.PROGRESS] = percent;
    }
  }

  if (Object.hasOwn(fields, K.DIAGRAM)) {
    fields[K.DIAGRAM] = stripCodeFence(fields[K.DIAGRAM]);
    if (fields[K.DIAGRAM].length === 0) delete fields[K.DIAGRAM];
  }

  if (errors.length > 0) {
    return { ok: false, value: null, fields: null, errors, warnings };
  }

  return { ok: true, value: null, fields, errors, warnings };
}

/** 시작 표시가 없을 때 — 다른 형식을 붙여넣은 경우를 따로 짚어준다 */
function describeMissingMarker(lines, form) {
  const other = form.marker === ENTRY_MARKER ? FORMS.block : FORMS.entry;
  const hasOther = lines.some((line) => line.trim() === other.marker);

  if (hasOther) {
    return `${other.label} 형식(${other.marker})을 붙여넣으셨습니다. 여기에는 ${form.label} 형식(${form.marker})이 필요합니다.`;
  }
  return `${form.marker} 로 시작하는 텍스트가 없습니다. claude.ai 가 만들어 준 ${form.label} 형식 텍스트를 그대로 붙여넣어 주세요.`;
}

/** 앞뒤의 빈 줄만 제거한다. 들여쓰기는 마크다운·코드에서 의미가 있으므로 건드리지 않는다. */
function trimBlankEdges(text) {
  return text.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
}

/**
 * ```mermaid … ``` 코드펜스를 벗긴다. 펜스가 없으면 원문 그대로 둔다.
 * (claude.ai 가 펜스 없이 보내오는 경우도 받아들인다)
 */
export function stripCodeFence(text) {
  const lines = String(text ?? '').split('\n');
  let from = 0;
  let to = lines.length;

  while (from < to && lines[from].trim() === '') from += 1;
  while (to > from && lines[to - 1].trim() === '') to -= 1;

  if (from < to && /^```/.test(lines[from].trim())) {
    from += 1;
    if (to > from && lines[to - 1].trim() === '```') to -= 1;
  }

  return lines.slice(from, to).join('\n').trim();
}

/** 쉼표(전각 쉼표 「、」 포함)로 나눈다 */
function splitTags(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text).split(/[,、]/)) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** "65", "65%", "65 %" 를 모두 받아들인다. 숫자로 읽을 수 없으면 null */
function parsePercent(text) {
  const cleaned = String(text).replace(/%/g, '').trim();
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * 마지막 글자의 종성을 보고 '이/가'를 고른다.
 * "내용가 없습니다" 같은 문장이 오류 메시지에 찍히면 읽는 사람이 먼저 피곤해진다.
 */
function subjectParticle(word) {
  const last = String(word ?? '').trim().slice(-1);
  const code = last.charCodeAt(0);
  if (!Number.isFinite(code) || code < 0xac00 || code > 0xd7a3) return '이';
  return (code - 0xac00) % 28 === 0 ? '가' : '이';
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── 해석: 이름 → 실제 과목·블록 ───────────────────────────

/**
 * 파싱된 과목·블록 이름을 트래커의 실제 id 로 바꾼다.
 *
 * **없으면 만들지 않는다.** 이게 이 함수의 존재 이유다. 자동 생성을 허용하면
 * 오타 한 번에 과목이 둘로 갈라지고, 그 뒤로 진도율·활성도·간트가 전부 어긋난다.
 * 대신 대소문자·공백만 다른 후보가 있으면 오류 메시지에 그 이름을 적어준다.
 *
 * @returns {{ ok: boolean, subjectId: string|null, blockId: string|null, errors: string[] }}
 */
export function resolveTarget(state, { subjectName, blockName }) {
  const wantedSubject = String(subjectName ?? '').trim();
  const wantedBlock = String(blockName ?? '').trim();

  const subjects = Object.values(state.subjects ?? {});
  const subjectMatches = subjects.filter((s) => String(s.name ?? '').trim() === wantedSubject);

  if (subjectMatches.length === 0) {
    const near = subjects.find((s) => looseEqual(s.name, wantedSubject));
    return {
      ok: false,
      subjectId: null,
      blockId: null,
      errors: [
        near
          ? `'${wantedSubject}'라는 과목을 찾을 수 없습니다. 이름이 비슷한 "${near.name}" 이(가) 있습니다 — 이름을 정확히 맞춰주세요.`
          : `'${wantedSubject}'라는 과목을 찾을 수 없습니다. 먼저 과목을 만들거나 이름을 확인해주세요.`,
      ],
    };
  }
  if (subjectMatches.length > 1) {
    return {
      ok: false,
      subjectId: null,
      blockId: null,
      errors: [
        `'${wantedSubject}'라는 이름의 과목이 ${subjectMatches.length}개 있어 어느 쪽인지 알 수 없습니다. 과목 이름을 서로 다르게 바꾼 뒤 다시 시도해주세요.`,
      ],
    };
  }

  const subject = subjectMatches[0];
  const blocks = Object.values(state.blocks ?? {}).filter((b) => b.subjectId === subject.id);
  const blockMatches = blocks.filter((b) => String(b.name ?? '').trim() === wantedBlock);

  if (blockMatches.length === 0) {
    const near = blocks.find((b) => looseEqual(b.name, wantedBlock));
    return {
      ok: false,
      subjectId: subject.id,
      blockId: null,
      errors: [
        near
          ? `'${subject.name}' 과목에 '${wantedBlock}'라는 블록이 없습니다. 이름이 비슷한 "${near.name}" 이(가) 있습니다 — 이름을 정확히 맞춰주세요.`
          : `'${subject.name}' 과목에 '${wantedBlock}'라는 블록이 없습니다. 먼저 블록을 만들거나 이름을 확인해주세요.`,
      ],
    };
  }
  if (blockMatches.length > 1) {
    return {
      ok: false,
      subjectId: subject.id,
      blockId: null,
      errors: [
        `'${subject.name}' 과목에 '${wantedBlock}'라는 블록이 ${blockMatches.length}개 있어 어느 쪽인지 알 수 없습니다.`,
      ],
    };
  }

  return { ok: true, subjectId: subject.id, blockId: blockMatches[0].id, errors: [] };
}

/** 대소문자와 공백만 다른 이름인지 (오타 후보 제안용) */
function looseEqual(a, b) {
  const flat = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
  return flat(a) === flat(b) && flat(a).length > 0;
}

// ─── 생성: 블록 정보 내보내기 ──────────────────────────────

/**
 * 블록 자체 정보를 ---BLOCK--- 형식으로 만든다.
 *
 * "이 블록의 현재 상태는 이렇다, 갱신해 달라"고 claude.ai 에 넘기는 용도라
 * 가져오기와 **같은 형식**으로 낸다. 그래야 받은 답을 그대로 되붙일 수 있다.
 *
 * 비어 있는 항목은 본문에 넣지 않고 ---END--- **뒤에** 안내 한 줄로 적는다.
 * 본문 안에 "(없음)" 같은 자리표시자를 넣으면 그게 값으로 읽혀 되돌아온다.
 */
export function buildBlockInfoText(subject, block) {
  const lines = [BLOCK_MARKER];
  lines.push(`${K.SUBJECT}: ${subject?.name ?? ''}`);
  lines.push(`${K.BLOCK}: ${block?.name ?? ''}`);

  const empty = [];
  const description = String(block?.description ?? '').trim();
  if (description) {
    lines.push('', `${K.DESCRIPTION}:`, description);
  } else {
    empty.push(K.DESCRIPTION);
  }

  if (block?.progressPercent != null) {
    lines.push('', `${K.PROGRESS}: ${block.progressPercent}`);
  } else {
    empty.push(K.PROGRESS);
  }

  const diagram = String(block?.diagramCode ?? '').trim();
  if (diagram) {
    lines.push('', `${K.DIAGRAM}:`, '```mermaid', diagram, '```');
  } else {
    empty.push(K.DIAGRAM);
  }

  const svg = String(block?.svgCode ?? '').trim();
  if (svg) {
    lines.push('', `${K.SVG}:`, svg);
  } else {
    empty.push(K.SVG);
  }

  lines.push(END_MARKER);

  if (empty.length > 0) {
    lines.push('', `(아직 비어 있는 항목: ${empty.join(', ')})`);
  }

  return `${lines.join('\n')}\n`;
}

/** 내보내기 안내 문구용 요약 */
export function summarizeBlockInfo(block) {
  const parts = [];
  if (String(block?.description ?? '').trim()) parts.push('설명');
  if (block?.progressPercent != null) parts.push('진행률');
  if (String(block?.diagramCode ?? '').trim()) parts.push('다이어그램');
  if (String(block?.svgCode ?? '').trim()) parts.push('SVG');
  return parts.length > 0 ? parts.join(' · ') : '아직 채운 항목 없음';
}
