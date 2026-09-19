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
 *     오류를 내고 멈춘다. 오타 하나로 'Algebra' 와 'algebra' 두 과목에 기록이
 *     쪼개지는 사고가 이 앱에서 가장 복구하기 어려운 종류의 사고다.
 *  2. **필수 항목이 없으면 절반만 채우지 않는다.** 무엇이 없는지 이름을 대고 멈춘다.
 *  3. **파싱은 순수 함수다.** state 를 읽는 해석(resolve)은 별도 함수로 분리해서,
 *     형식 검사만 따로 시험해 볼 수 있게 한다.
 */

import { isValidDateKey } from './date.js';

export const SUBJECT_MARKER = '---SUBJECT---';
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
  BLOCKLIST: '블록 목록',
};

/** 한 줄로 끝나는 값들. 나머지는 다음 키워드가 나올 때까지 여러 줄을 먹는다. */
const SINGLE_LINE = new Set([K.DATE, K.SUBJECT, K.BLOCK, K.TITLE, K.TAGS, K.PROGRESS]);

const FORMS = {
  /**
   * 과목 정보. '블록 목록'을 품고 있다 — 예전에는 ---BLOCKLIST--- 라는 별도
   * 형식이었는데, 과목 설정 화면에 설명·색·다이어그램이 이미 모여 있는 마당에
   * 블록 목록만 따로 주고받을 이유가 없었다. claude.ai 쪽에서도 "이 과목은 이렇다"를
   * 한 문서로 정리해 보내는 편이 자연스럽다.
   *
   * 블록 목록은 **선택**이다. 설명만 고치고 싶을 때 목록을 적지 않으면
   * 블록은 하나도 건드리지 않는다.
   */
  subject: {
    marker: SUBJECT_MARKER,
    label: '과목 정보',
    fields: [K.SUBJECT, K.DESCRIPTION, K.BLOCKLIST, K.DIAGRAM, K.SVG],
    required: [K.SUBJECT, K.DESCRIPTION],
  },
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
  const parsed = parseDocuments(text);
  if (!parsed.ok) {
    return { ok: false, value: null, errors: parsed.errors, warnings: parsed.warnings };
  }

  const entries = parsed.docs.filter((d) => d.kind === 'entry');
  const others = parsed.docs.filter((d) => d.kind !== 'entry');

  if (entries.length === 0) {
    return { ok: false, value: null, errors: [describeMissingMarker(others, FORMS.entry)], warnings: [] };
  }

  // '새 기록' 은 이름 그대로 기록 하나를 다루는 화면이다. 여러 개가 한꺼번에
  // 반영되면 방금 무엇이 들어갔는지 화면에서 확인할 길이 없다.
  // 여러 기록은 그 목록을 이미 보여주고 있는 블록 상세에서 받는다.
  if (entries.length > 1) {
    return {
      ok: false,
      value: null,
      errors: [
        `기록이 ${entries.length}개 들어 있습니다. 새 기록 화면에서는 기록 하나만 가져올 수 있습니다. 여러 개를 한 번에 가져오려면 블록 페이지의 '기록 전체 가져오기' 를 이용하세요.`,
      ],
      warnings: [],
    };
  }

  if (others.length > 0) {
    return {
      ok: false,
      value: null,
      errors: [
        `기록 외에 ${others.map((d) => FORMS[d.kind].label).join(', ')} 형식이 함께 들어 있습니다. 새 기록 화면에서는 기록 하나만 가져올 수 있습니다.`,
      ],
      warnings: [],
    };
  }

  return { ok: true, value: entries[0].value, errors: [], warnings: parsed.warnings };
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
 * 한 줄에 하나씩 적힌 블록 이름.
 *
 * 목록 기호(`-`, `*`, `1.`)는 떼고 읽는다. claude.ai 가 목록을 물으면 마크다운
 * 불릿으로 답하는 일이 흔한데, 그것 때문에 이름이 "- 1주차" 가 되면 곤란하다.
 * 같은 이름이 두 번 적혀 있으면 한 번만 센다.
 */
function splitBlockNames(text) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text ?? '').split('\n')) {
    const name = raw.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

/**
 * ---SUBJECT--- 텍스트 → 과목 자체 정보.
 * @returns {{ ok: boolean, value: object|null, errors: string[], warnings: string[] }}
 */
export function parseSubjectText(text) {
  const parsed = parseStructured(text, 'subject');
  if (!parsed.ok) return parsed;
  return { ok: true, value: toValue('subject', parsed.fields), errors: [], warnings: parsed.warnings };
}

/**
 * 한 텍스트 안의 모든 문서를 **나온 순서대로** 잘라낸다.
 *
 * 과목 전체 내보내기처럼 SUBJECT 하나 + BLOCK 여럿 + ENTRY 여럿이 한 덩어리로
 * 오가므로, 파서의 입구는 '문서 하나'가 아니라 '문서 목록'이어야 한다.
 *
 * 마커도 키워드와 같은 규칙을 따른다 — 줄 맨 앞이어야 하고, 코드펜스 안에서는
 * 마커로 보지 않는다. 기록 내용에 이 형식을 설명하는 예시가 들어 있어도
 * 문서 경계가 밀리지 않아야 한다.
 *
 * ---END--- 가 빠졌으면 다음 마커 직전까지를 그 문서의 몸통으로 본다.
 * 복사가 조금 어긋나도 앞 문서까지는 살린다.
 */
function sliceDocuments(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const byMarker = new Map(Object.entries(FORMS).map(([name, form]) => [form.marker, name]));

  const docs = [];
  let open = null;
  let inFence = false;

  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (inFence) return;

    const trimmed = line.trim();

    if (byMarker.has(trimmed)) {
      if (open) docs.push({ ...open, bodyLines: lines.slice(open.from, i) });
      open = { kind: byMarker.get(trimmed), marker: trimmed, line: i + 1, from: i + 1 };
      return;
    }

    if (trimmed === END_MARKER && open) {
      docs.push({ ...open, bodyLines: lines.slice(open.from, i) });
      open = null;
    }
  });

  if (open) docs.push({ ...open, bodyLines: lines.slice(open.from) });
  return { lines, docs };
}

/**
 * 잘라낸 문서 하나의 몸통에서 필드를 읽는다.
 *
 * 키워드는 **줄 맨 앞**에 있어야 한다. 들여쓰기된 `SVG:` 같은 줄을 키워드로 보면
 * 내용 안의 코드·목록이 필드 경계로 오인되기 때문이다. 같은 이유로 코드펜스(```)
 * 안에서는 어떤 줄도 키워드로 보지 않는다 — 다이어그램 본문이 바로 코드펜스다.
 */
function parseBody(body, form) {
  // 긴 이름부터 나열한다. '블록|블록 목록' 순서면 "블록 목록:" 줄이 '블록' 에 먼저 걸린다.
  const keys = [...form.fields].sort((a, b) => b.length - a.length);
  const keyPattern = new RegExp(`^(${keys.map(escapeRegExp).join('|')})[ \t]*:(.*)$`);

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
      // 콜론 뒤 공백은 구분자이지 값이 아니다. 여러 줄 필드를 "설명: 값" 처럼
      // 한 줄에 붙여 써도 값 앞에 공백이 딸려 들어가지 않게 한다.
      collected[current] = [match[2].replace(/^[ \t]+/, '')];
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

/**
 * 형식 하나짜리 파서 — 그 형식의 첫 문서만 읽는다.
 * (단일 가져오기 화면이 쓴다. 여러 문서가 필요한 화면은 parseDocuments 를 쓴다)
 */
function parseStructured(text, formName) {
  const form = FORMS[formName];
  const { lines, docs } = sliceDocuments(text);
  const found = docs.find((d) => d.kind === formName);

  if (!found) {
    return { ok: false, value: null, errors: [describeMissingMarker(docs, form)], warnings: [] };
  }
  return parseBody(found.bodyLines, form);
}

/**
 * 여러 문서를 순서대로 읽는다.
 *
 * 하나라도 형식이 깨지면 전부 멈춘다. 절반만 반영하면 무엇이 들어갔고 무엇이
 * 빠졌는지 알 수 없게 되고, 그 상태를 되돌릴 방법도 없다.
 *
 * @returns {{ ok, docs: Array<{kind, value, line}>, errors: string[], warnings: string[] }}
 */
export function parseDocuments(text) {
  const { docs } = sliceDocuments(text);

  if (docs.length === 0) {
    return {
      ok: false,
      docs: [],
      errors: [
        `읽을 수 있는 형식이 없습니다. ${SUBJECT_MARKER} · ${BLOCK_MARKER} · ${ENTRY_MARKER} 중 하나로 시작하는 텍스트를 붙여넣어 주세요.`,
      ],
      warnings: [],
    };
  }

  const out = [];
  const errors = [];
  const warnings = [];

  for (const doc of docs) {
    const parsed = parseBody(doc.bodyLines, FORMS[doc.kind]);
    if (!parsed.ok) {
      // 몇 번째 문서가 문제인지 알려주지 않으면 긴 텍스트에서 찾을 수가 없다.
      errors.push(...parsed.errors.map((e) => `${doc.marker} (${doc.line}번째 줄): ${e}`));
      continue;
    }
    warnings.push(...parsed.warnings);
    out.push({ kind: doc.kind, line: doc.line, value: toValue(doc.kind, parsed.fields) });
  }

  return { ok: errors.length === 0, docs: out, errors, warnings };
}

/** 읽어낸 필드 맵을 화면이 쓰는 모양으로 */
function toValue(kind, f) {
  if (kind === 'subject') {
    return {
      subjectName: f[K.SUBJECT],
      description: f[K.DESCRIPTION],
      // 목록 줄이 아예 없으면 null — '빈 목록'과 구분해야 한다.
      // null 이면 블록을 건드리지 않고, 빈 배열이면 "적었는데 하나도 못 읽었다"는 뜻이다.
      blockNames: Object.hasOwn(f, K.BLOCKLIST) ? splitBlockNames(f[K.BLOCKLIST]) : null,
      diagramCode: f[K.DIAGRAM] ?? '',
      svgCode: f[K.SVG] ?? '',
    };
  }
  if (kind === 'block') {
    return {
      subjectName: f[K.SUBJECT],
      blockName: f[K.BLOCK],
      description: f[K.DESCRIPTION],
      progressPercent: f[K.PROGRESS] ?? null,
      diagramCode: f[K.DIAGRAM] ?? '',
      svgCode: f[K.SVG] ?? '',
    };
  }
  return {
    date: f[K.DATE],
    subjectName: f[K.SUBJECT],
    blockName: f[K.BLOCK],
    title: f[K.TITLE] ?? '',
    tags: f[K.TAGS] ?? [],
    content: f[K.CONTENT],
    progressPercent: f[K.PROGRESS] ?? null,
    diagramCode: f[K.DIAGRAM] ?? '',
    svgCode: f[K.SVG] ?? '',
  };
}

/** 시작 표시가 없을 때 — 다른 형식을 붙여넣은 경우를 따로 짚어준다 */
function describeMissingMarker(docs, form) {
  const other = docs.find((d) => FORMS[d.kind].marker !== form.marker);

  if (other) {
    const label = FORMS[other.kind].label;
    return `${label} 형식(${FORMS[other.kind].marker})을 붙여넣으셨습니다. 여기에는 ${form.label} 형식(${form.marker})이 필요합니다.`;
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

// ─── 생성: 내보내기 텍스트 ─────────────────────────────────

/**
 * 문서 하나를 조립한다.
 *
 * 가져오기와 **같은 형식**으로 낸다. 그래야 받은 답을 그대로 되붙일 수 있다.
 * 값이 빈 항목은 아예 쓰지 않는다 — 본문에 "(없음)" 같은 자리표시자를 넣으면
 * 그게 값으로 읽혀 되돌아온다.
 *
 * @param {Array<[string, any, ('line'|'block'|'fence')?]>} rows
 */
function emitDoc(marker, rows, { emptyNote = false } = {}) {
  const lines = [marker];
  const empty = [];
  let lastWasBlock = false;

  for (const [key, value, kind = 'line'] of rows) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (text.length === 0) {
      empty.push(key);
      continue;
    }

    if (kind === 'line') {
      // 여러 줄짜리 값 뒤에 붙는 한 줄 값은 한 칸 띄워야 눈으로 경계가 보인다
      if (lastWasBlock) lines.push('');
      lines.push(`${key}: ${text}`);
      lastWasBlock = false;
      continue;
    }

    lines.push('', `${key}:`);
    if (kind === 'fence') lines.push('```mermaid', text, '```');
    else lines.push(text);
    lastWasBlock = true;
  }

  lines.push(END_MARKER);

  // 비어 있는 항목은 ---END--- '뒤에' 적는다. 안쪽에 적으면 값으로 읽힌다.
  if (emptyNote && empty.length > 0) {
    lines.push('', `(아직 비어 있는 항목: ${empty.join(', ')})`);
  }
  return lines.join('\n');
}

/**
 * 과목 자체 정보 → ---SUBJECT---
 *
 * 블록 목록은 **저장된 값이 아니라 지금 그 과목에 속한 블록들**이다.
 * 호출부가 selector 로 조회한 배열을 그대로 넘긴다 — 과목에 목록 사본을
 * 따로 보관하면 블록을 만들거나 지운 순간 둘이 어긋난다.
 */
export function buildSubjectInfoText(subject, blocks = []) {
  return `${emitDoc(SUBJECT_MARKER, subjectRows(subject, blocks), { emptyNote: true })}\n`;
}

function subjectRows(subject, blocks) {
  return [
    [K.SUBJECT, subject?.name],
    [K.DESCRIPTION, subject?.description, 'block'],
    [K.BLOCKLIST, blocks.map((b) => b.name).join('\n'), 'block'],
    [K.DIAGRAM, subject?.diagramCode, 'fence'],
    [K.SVG, subject?.svgCode, 'block'],
  ];
}

/** 블록 자체 정보 → ---BLOCK--- */
export function buildBlockInfoText(subject, block) {
  return `${emitDoc(BLOCK_MARKER, blockRows(subject, block), { emptyNote: true })}\n`;
}

/** 기록 하나 → ---ENTRY--- */
export function buildEntryText(subject, block, entry) {
  return `${emitDoc(ENTRY_MARKER, entryRows(subject, block, entry))}\n`;
}

/**
 * 블록의 기록 전체 → ---ENTRY--- 문서 여러 개.
 *
 * 예전에는 마커 없는 느슨한 형식으로 냈는데, 그 형식은 **되읽을 수가 없었다.**
 * 내보낸 것을 claude.ai 가 고쳐서 돌려줘도 가져올 방법이 없으니 반쪽짜리였다.
 */
export function buildEntriesText(subject, block, entries) {
  if (entries.length === 0) return '';
  return `${entries.map((entry) => emitDoc(ENTRY_MARKER, entryRows(subject, block, entry))).join('\n\n')}\n`;
}

/**
 * 과목 전체 → SUBJECT 하나 + (BLOCK + 그 블록의 ENTRY들) 반복.
 *
 * **요약본을 따로 보관하지 않는다.** 누를 때마다 지금의 블록·기록을 그대로 훑어
 * 조립한다. 그래야 기록을 고치거나 지운 뒤에 내보내도 결과가 항상 현재와 같다.
 *
 * @param {Function} entriesOf blockId → 그 블록의 기록 배열 (selector 를 그대로 넘긴다)
 */
export function buildSubjectBundleText(subject, blocks, entriesOf) {
  const parts = [emitDoc(SUBJECT_MARKER, subjectRows(subject, blocks))];

  for (const block of blocks) {
    parts.push(emitDoc(BLOCK_MARKER, blockRows(subject, block)));
    for (const entry of entriesOf(block.id)) {
      parts.push(emitDoc(ENTRY_MARKER, entryRows(subject, block, entry)));
    }
  }

  return `${parts.join('\n\n')}\n`;
}

function blockRows(subject, block) {
  return [
    [K.SUBJECT, subject?.name],
    [K.BLOCK, block?.name],
    [K.DESCRIPTION, block?.description, 'block'],
    [K.PROGRESS, block?.progressPercent],
    [K.DIAGRAM, block?.diagramCode, 'fence'],
    [K.SVG, block?.svgCode, 'block'],
  ];
}

function entryRows(subject, block, entry) {
  return [
    [K.DATE, entry?.date],
    [K.SUBJECT, subject?.name],
    [K.BLOCK, block?.name],
    [K.TITLE, entry?.title],
    [K.TAGS, (entry?.tags ?? []).join(', ')],
    [K.CONTENT, entry?.content, 'block'],
    [K.PROGRESS, entry?.progressPercent],
    [K.DIAGRAM, entry?.diagramCode, 'fence'],
    [K.SVG, entry?.svgCode, 'block'],
  ];
}

// ─── 안내 문구용 요약 ──────────────────────────────────────

/** 어떤 항목이 채워져 있는지 (내보내기 알림에 쓴다) */
export function summarizeSelfInfo(unit) {
  const parts = [];
  if (String(unit?.description ?? '').trim()) parts.push('설명');
  if (unit?.progressPercent != null) parts.push('진행률');
  if (String(unit?.diagramCode ?? '').trim()) parts.push('다이어그램');
  if (String(unit?.svgCode ?? '').trim()) parts.push('SVG');
  return parts.length > 0 ? parts.join(' · ') : '아직 채운 항목 없음';
}

/** 이전 이름 — 호출부 호환 */
export const summarizeBlockInfo = summarizeSelfInfo;
