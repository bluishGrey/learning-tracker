/**
 * 병합 — 순수 함수. 저장소를 건드리지 않으므로 미리보기와 실제 적용에 같은 함수를 쓴다.
 *
 * 규칙: id 가 같으면 로컬을 유지하고 건너뛴다. 새 항목만 추가한다.
 *
 * 다만 "id 중복만 건너뛰기"를 단순하게 구현하면 부모 없는 Block/Entry(고아)가
 * 남을 수 있다. 그래서 Subject → Block → Entry 순서를 강제하고, 각 단계에서
 * 부모가 실제로 존재하는지 확인한 뒤에만 추가한다. 버려진 항목은 개수를 세어
 * 보고한다 (조용히 삼키지 않는다).
 */

import { ensureShape, nowIso } from './schema.js';
import { isSameHue, nextFreeHueIndex } from '../lib/color.js';

/**
 * @returns {{ state: object, report: object }}
 */
export function mergeStates(localRaw, incomingRaw) {
  const local = ensureShape(localRaw);
  const incoming = ensureShape(incomingRaw);

  const subjects = { ...local.subjects };
  const subjectOrder = [...local.subjectOrder];
  const blocks = { ...local.blocks };
  const entries = { ...local.entries };

  const report = {
    added: { subjects: 0, blocks: 0, entries: 0 },
    skipped: { subjects: 0, blocks: 0, entries: 0 },
    orphans: { blocks: 0, entries: 0 },
    recolored: [],
  };

  const addedSubjectIds = [];

  // 1) Subject — 가져온 쪽의 순서를 보존하며 뒤에 덧붙인다.
  for (const id of incoming.subjectOrder) {
    const subject = incoming.subjects[id];
    if (!subject) continue;
    if (Object.hasOwn(subjects, id)) {
      report.skipped.subjects += 1;
      continue;
    }
    subjects[id] = { ...subject };
    subjectOrder.push(id);
    addedSubjectIds.push(id);
    report.added.subjects += 1;
  }

  // 2) Block — 소속 과목이 (로컬 ∪ 방금 추가분)에 있을 때만 추가한다.
  for (const block of Object.values(incoming.blocks)) {
    if (Object.hasOwn(blocks, block.id)) {
      report.skipped.blocks += 1;
      continue;
    }
    if (!Object.hasOwn(subjects, block.subjectId)) {
      report.orphans.blocks += 1;
      continue;
    }
    blocks[block.id] = { ...block };
    report.added.blocks += 1;
  }

  // 3) Entry — 소속 블록이 (로컬 ∪ 방금 추가분)에 있을 때만 추가한다.
  for (const entry of Object.values(incoming.entries)) {
    if (Object.hasOwn(entries, entry.id)) {
      report.skipped.entries += 1;
      continue;
    }
    if (!Object.hasOwn(blocks, entry.blockId)) {
      report.orphans.entries += 1;
      continue;
    }
    entries[entry.id] = { ...entry };
    report.added.entries += 1;
  }

  // 4) 설정 — 기기별 취향이므로 로컬을 유지하되, hueIndex 만 큰 쪽을 취한다.
  //    정수 카운터라서 두 기기의 값을 max() 로 합칠 수 있다.
  const settings = {
    ...local.settings,
    hueIndex: Math.max(
      toInt(local.settings?.hueIndex),
      toInt(incoming.settings?.hueIndex)
    ),
    lastChangeAt: nowIso(),
  };

  // 5) 색 충돌 해소 — 서로 다른 기기에서 같은 순번으로 만든 과목은 같은 hue 를 갖는다.
  //    로컬 과목의 색은 절대 바꾸지 않고, 새로 들어온 쪽만 다음 빈 순번으로 옮긴다.
  const usedHues = local.subjectOrder
    .map((id) => Number(subjects[id]?.colorHue))
    .filter(Number.isFinite);

  let cursor = settings.hueIndex;
  for (const id of addedSubjectIds) {
    const subject = subjects[id];
    const hue = Number(subject.colorHue);

    if (Number.isFinite(hue) && !usedHues.some((u) => isSameHue(u, hue))) {
      usedHues.push(hue);
      continue;
    }

    const next = nextFreeHueIndex(usedHues, cursor);
    subjects[id] = { ...subject, colorHue: next.hue, updatedAt: nowIso() };
    usedHues.push(next.hue);
    cursor = next.index + 1;
    report.recolored.push({
      id,
      name: subject.name,
      from: Number.isFinite(hue) ? hue : null,
      to: next.hue,
    });
  }
  settings.hueIndex = Math.max(settings.hueIndex, cursor);

  return {
    state: { ...local, settings, subjects, subjectOrder, blocks, entries },
    report,
  };
}

/** 병합으로 실제 늘어나는 게 있는지 (없으면 UI 에서 '추가될 항목 없음'을 알려준다) */
export function hasAdditions(report) {
  return (
    report.added.subjects > 0 ||
    report.added.blocks > 0 ||
    report.added.entries > 0
  );
}

function toInt(v) {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
