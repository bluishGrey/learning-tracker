/**
 * 일괄 가져오기 계획기.
 *
 * 붙여넣은 문서들(parseDocuments 의 결과)과 지금의 state 를 맞춰 보고,
 * **무엇이 새로 생기고 무엇이 갱신되는지**를 미리 계산한다. 계산만 하고
 * 아무것도 바꾸지 않는다 — 실제 반영은 reducer 가 이 계획을 받아서 한다.
 *
 * 왜 계획을 따로 만드나:
 *
 *  1. 들어오기 전에 보여주기 위해서다. "블록 2개 추가, 기록 5개 중 2개 갱신"을
 *     먼저 읽고 누를 수 있어야 한다. 덮어쓰는 동작을 눈 감고 시키지 않는다.
 *  2. 순수 함수라 브라우저 없이 검증할 수 있다.
 *  3. 하나라도 어긋나면 **전부 멈춘다.** 절반만 반영되면 무엇이 들어갔는지
 *     알 수 없고 되돌릴 방법도 없다.
 *
 * ─ 무엇을 '같은 것'으로 보나 ──────────────────────────────
 *
 *   과목 — 이름. 없으면 만들지 않고 오류를 낸다 (가져오기의 기준점이다).
 *   블록 — 그 과목 안에서의 이름. 없으면 새로 만든다.
 *   (이름은 lib/nameMatch.js 규칙 — 정확히 같은 이름이 먼저, 없으면 공백·대소문자 무시)
 *   기록 — 같은 블록 안에서 '날짜 + 제목'. 없으면 새로 만든다.
 *
 * 과목만 자동 생성하지 않는 이유는 오타 사고 때문이다. 'Algebra' 를 'algebra' 로
 * 한 번 잘못 적으면 과목이 둘로 갈라지고 진도율·활성도·간트가 전부 어긋난다.
 * 블록과 기록은 그 과목 **안에서만** 생기므로 같은 사고가 나지 않는다.
 * (날짜·제목이 같은 기록이 여럿이면 가장 먼저 만든 것을 갱신한다)
 */

import { newId } from './id.js';
import { nameKey, findByName } from './nameMatch.js';
import { checkCompanionBlock } from './structuredText.js';

/**
 * 블록 하나에 기록들을 몰아넣는 계획 — 블록 상세의 '기록 전체 가져오기'.
 *
 * 이 화면은 블록 하나에 매여 있으므로 다른 블록의 기록이 섞여 들어오면 막는다.
 * 조용히 다른 블록으로 흘려보내면 어디가 오염됐는지 알 수 없다.
 */
export function planEntriesImport(state, docs, { subjectId, blockId }) {
  const subject = state.subjects[subjectId];
  const block = state.blocks[blockId];
  if (!subject || !block) {
    return fail(['가져올 대상 블록을 찾을 수 없습니다.']);
  }

  const errors = [];
  // 그 블록 자신의 ---BLOCK--- 문서 하나는 함께 받는다 (블록 정보 동기화).
  // 과목 정보나 다른 블록의 정보는 이 화면의 일이 아니다.
  const wrongKind = docs.filter((d) => d.kind !== 'entry' && d.kind !== 'block');
  if (wrongKind.length > 0) {
    errors.push(
      `기록(---ENTRY---)과 이 블록의 블록 정보(---BLOCK---)만 가져올 수 있습니다. 과목 정보가 섞여 있습니다. (${wrongKind
        .map((d) => `${d.line}번째 줄`)
        .join(', ')})`
    );
  }
  const blockDocs = docs.filter((d) => d.kind === 'block');
  for (const doc of blockDocs) {
    if (nameKey(doc.value.subjectName) !== nameKey(subject.name) || nameKey(doc.value.blockName) !== nameKey(block.name)) {
      errors.push(
        `${doc.line}번째 줄의 블록 정보는 '${doc.value.subjectName} / ${doc.value.blockName}' 의 것입니다. 지금 보고 있는 '${subject.name} / ${block.name}' 에는 반영할 수 없습니다.`
      );
    }
  }

  const entryDocs = docs.filter((d) => d.kind === 'entry');
  if (entryDocs.length === 0 && errors.length === 0) {
    errors.push('가져올 기록이 없습니다.');
  }

  for (const doc of entryDocs) {
    const wantSubject = String(doc.value.subjectName ?? '').trim();
    const wantBlock = String(doc.value.blockName ?? '').trim();
    if (nameKey(wantSubject) !== nameKey(subject.name) || nameKey(wantBlock) !== nameKey(block.name)) {
      errors.push(
        `${doc.line}번째 줄의 기록은 '${wantSubject} / ${wantBlock}' 소속입니다. 지금 보고 있는 '${subject.name} / ${block.name}' 에는 넣을 수 없습니다.`
      );
    }
  }

  if (errors.length > 0) return fail(errors);

  const companion = checkCompanionBlock(blockDocs, entryDocs);
  if (!companion.ok) return fail(companion.errors);

  const blocks = companion.block
    ? [{ id: blockId, name: block.name, patch: blockPatchOf(companion.block), isNew: false, infoFromDoc: true }]
    : [];

  const entries = planEntries(state, entryDocs, () => blockId);
  return done({ subjectId, subjectPatch: null, blocks, entries });
}

/** ---BLOCK--- 문서 값 → 블록에 덮어쓸 정보 (블록 정보 가져오기와 같은 네 항목) */
export function blockPatchOf(value) {
  return {
    description: value.description,
    progressPercent: value.progressPercent,
    diagramCode: value.diagramCode,
    svgCode: value.svgCode,
  };
}

/**
 * 과목 하나를 통째로 — 과목 상세의 '과목 전체 가져오기'.
 *
 * SUBJECT 는 있으면 반영하고 없어도 진행한다. 블록·기록만 골라 붙여넣는 것도
 * 흔한 쓰임이라 막을 이유가 없다. 다만 어느 문서든 **다른 과목을 가리키면**
 * 멈춘다 — 이 화면이 그 과목에 매여 있기 때문이다.
 */
export function planSubjectImport(state, docs, { subjectId }) {
  const subject = state.subjects[subjectId];
  if (!subject) return fail(['가져올 대상 과목을 찾을 수 없습니다.']);

  const errors = [];
  const warnings = [];

  for (const doc of docs) {
    const want = String(doc.value.subjectName ?? '').trim();
    if (nameKey(want) !== nameKey(subject.name)) {
      errors.push(
        `${doc.line}번째 줄의 문서는 '${want}' 과목의 것입니다. 지금 보고 있는 '${subject.name}' 에는 넣을 수 없습니다.`
      );
    }
  }
  if (errors.length > 0) return fail(errors);

  // ─ 과목 자체 정보 ─
  const subjectDocs = docs.filter((d) => d.kind === 'subject');
  if (subjectDocs.length > 1) {
    return fail([`과목 정보(---SUBJECT---)가 ${subjectDocs.length}개 있습니다. 하나만 있어야 합니다.`]);
  }
  const subjectPatch = subjectDocs[0]
    ? {
        description: subjectDocs[0].value.description,
        diagramCode: subjectDocs[0].value.diagramCode,
        svgCode: subjectDocs[0].value.svgCode,
      }
    : null;

  // ─ 블록: 이름으로 맞춰 보고, 없으면 새로 만든다 ─
  const existingList = Object.values(state.blocks).filter((b) => b.subjectId === subjectId);

  /** 정규화 이름 → 이번에 새로 만들 블록 id. 같은 텍스트 안에서 이름이 조금 달라도 하나로 모인다. */
  const newIdByKey = new Map();
  const blocks = [];

  /**
   * 이름 → { id, isNew } | null(모호). 기존 블록이 먼저, 그다음 이번에 새로 만들 블록.
   * 정규화로 맞춘 경우는 경고로 남겨 미리보기에서 보이게 한다.
   */
  const lookup = (name, line) => {
    const found = findByName(existingList, name);
    if (found.match) {
      if (found.loose) {
        const note = `블록 '${name}' 을(를) 기존 블록 "${found.match.name}" 으로 맞춰 읽었습니다.`;
        if (!warnings.includes(note)) warnings.push(note);
      }
      return { id: found.match.id, isNew: false, existing: found.match };
    }
    if (found.ambiguous.length > 1) {
      errors.push(
        `${line}번째 줄: '${name}' 와 같은 이름(공백·대소문자 무시)의 블록이 ${found.ambiguous.length}개 있어 어느 쪽인지 알 수 없습니다. (${found.ambiguous.map((b) => `"${b.name}"`).join(', ')})`
      );
      return null;
    }
    const key = nameKey(name);
    if (newIdByKey.has(key)) return { id: newIdByKey.get(key), isNew: false, existing: null };
    return undefined; // 아직 없음
  };

  for (const doc of docs.filter((d) => d.kind === 'block')) {
    const name = String(doc.value.blockName ?? '').trim();
    if (!name) {
      errors.push(`${doc.line}번째 줄: 블록 이름이 비어 있습니다.`);
      continue;
    }
    const patch = blockPatchOf(doc.value);

    const hit = lookup(name, doc.line);
    if (hit === null) continue;
    if (hit) {
      // 기존 블록 갱신, 또는 같은 텍스트 안에 같은 블록이 두 번 — 뒤쪽 값으로 덮는다
      blocks.push({ id: hit.id, name: hit.existing?.name ?? name, patch, isNew: false, infoFromDoc: true });
    } else {
      const id = newId();
      newIdByKey.set(nameKey(name), id);
      blocks.push({ id, name, patch, isNew: true, infoFromDoc: true });
    }
  }

  /*
   * 과목 정보에 적힌 블록 목록 — 이름뿐인 뼈대다.
   *
   * BLOCK 문서를 **먼저** 처리한 뒤에 본다. 같은 이름이 양쪽에 다 있으면
   * 설명·진행률까지 실린 BLOCK 문서 쪽이 이겨야 하기 때문이다. 목록은
   * 그러고도 남은 이름만 만든다.
   *
   * 이미 트래커에 있는 이름은 건너뛰고 결과에 적는다 — 이름만 담긴 목록으로
   * 기존 블록의 설명·진행률을 덮어쓰면 안 된다.
   */
  const skipped = [];
  const listedNames = subjectDocs[0]?.value.blockNames ?? null;

  if (listedNames) {
    for (const name of listedNames) {
      const hit = lookup(name, subjectDocs[0].line);
      if (hit === null) continue;
      if (hit) {
        if (hit.existing) skipped.push(name);
        continue; // 기존 블록이거나 이번 텍스트의 BLOCK 문서가 이미 맡았다
      }

      const id = newId();
      newIdByKey.set(nameKey(name), id);
      blocks.push({
        id,
        name,
        patch: { description: '', progressPercent: null, diagramCode: '', svgCode: '' },
        isNew: true,
        infoFromDoc: false,
      });
    }
  }

  // ─ 기록: 이름으로 소속 블록을 찾는다 (문서 순서가 아니라 적힌 이름 기준) ─
  const entryDocs = docs.filter((d) => d.kind === 'entry');
  const entryBlockId = new Map();
  for (const doc of entryDocs) {
    const name = String(doc.value.blockName ?? '').trim();
    const hit = lookup(name, doc.line);
    if (hit === null) continue;
    if (!hit) {
      errors.push(
        `${doc.line}번째 줄의 기록이 가리키는 블록 '${name}' 을 찾을 수 없습니다. 그 블록의 ---BLOCK--- 문서를 함께 붙여넣거나, 먼저 블록을 만들어 주세요.`
      );
      continue;
    }
    entryBlockId.set(doc, hit.id);
  }
  if (errors.length > 0) return fail(errors);

  const entries = planEntries(state, entryDocs, (doc) => entryBlockId.get(doc));

  return done({ subjectId, subjectPatch, blocks, entries }, { skipped }, warnings);
}

// ─── 내부 ──────────────────────────────────────────────────

/** 기록 문서들을 '갱신 / 추가'로 가른다 */
function planEntries(state, entryDocs, blockIdOf) {
  // 기존 기록을 (블록, 날짜, 제목)으로 찾아볼 수 있게 펼쳐 둔다.
  // 먼저 만든 것이 앞에 오도록 정렬해, 같은 키가 여럿이면 가장 오래된 것을 잡는다.
  const existing = new Map();
  const sorted = Object.values(state.entries).sort((a, b) =>
    String(a.createdAt).localeCompare(String(b.createdAt))
  );
  for (const e of sorted) {
    const key = entryKey(e.blockId, e.date, e.title);
    if (!existing.has(key)) existing.set(key, e);
  }

  const planned = [];
  const usedKeys = new Set();

  for (const doc of entryDocs) {
    const blockId = blockIdOf(doc);
    const v = doc.value;
    const data = {
      date: v.date,
      title: v.title.trim() || null,
      tags: v.tags,
      content: v.content,
      progressPercent: v.progressPercent,
      diagramCode: v.diagramCode.trim() || null,
      svgCode: v.svgCode.trim() || null,
    };

    const key = entryKey(blockId, v.date, data.title);
    const match = existing.get(key);

    // 같은 텍스트 안에 같은 키가 두 번 나오면 뒤쪽은 새 기록으로 넣는다.
    // 한 기록을 두 번 덮어쓰면 앞의 내용이 소리 없이 사라진다.
    if (match && !usedKeys.has(key)) {
      usedKeys.add(key);
      planned.push({ id: match.id, blockId, data, isNew: false });
    } else {
      planned.push({ id: newId(), blockId, data, isNew: true });
    }
  }

  return planned;
}

/** 날짜 + 제목. 제목이 없는 기록끼리도 날짜로 맞춰진다. */
function entryKey(blockId, date, title) {
  const t = typeof title === 'string' ? title.trim() : '';
  return `${blockId}\u0000${date}\u0000${t}`;
}

function fail(errors) {
  return { ok: false, errors, warnings: [], plan: null, summary: null };
}

function done(plan, extra = {}, warnings = []) {
  return {
    ok: true,
    errors: [],
    warnings,
    plan,
    summary: {
      subjectUpdated: plan.subjectPatch !== null,
      blocksAdded: plan.blocks.filter((b) => b.isNew).length,
      blocksUpdated: plan.blocks.filter((b) => !b.isNew).length,
      entriesAdded: plan.entries.filter((e) => e.isNew).length,
      entriesUpdated: plan.entries.filter((e) => !e.isNew).length,
      skipped: [],
      ...extra,
    },
  };
}

/** 미리보기 문장 — 미리 읽고 누를 수 있어야 한다 */
export function describePlan(summary) {
  if (!summary) return '';
  const rows = [];
  if (summary.subjectUpdated) rows.push('과목 정보 갱신');
  if (summary.blocksAdded > 0) rows.push(`블록 ${summary.blocksAdded}개 추가`);
  if (summary.blocksUpdated > 0) rows.push(`블록 ${summary.blocksUpdated}개 갱신`);
  if (summary.entriesAdded > 0) rows.push(`기록 ${summary.entriesAdded}개 추가`);
  if (summary.entriesUpdated > 0) rows.push(`기록 ${summary.entriesUpdated}개 갱신`);
  if (summary.skipped?.length > 0) {
    rows.push(`이미 있어 건너뜀 ${summary.skipped.length}개 (${summary.skipped.join(', ')})`);
  }
  return rows.length > 0 ? rows.join(' · ') : '바뀌는 것이 없습니다';
}
