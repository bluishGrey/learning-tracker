/**
 * 파생 데이터 계산.
 *
 * 저장되는 것은 평면 맵뿐이고, 화면이 필요로 하는 인덱스(날짜별·과목별)는
 * 전부 여기서 만든다. buildIndex() 한 번으로 무거운 맵을 다 만들어 두고
 * 개별 selector 는 그것을 조회만 한다 (Provider 에서 useMemo 로 감싼다).
 */

import {
  todayKey,
  daysBetween,
  yearFraction,
  daysInYear,
  parseDateKey,
} from '../lib/date.js';
import { activityAlpha, densityAlpha, nextFreeHueIndex } from '../lib/color.js';

/**
 * 밀도 계산 시 적용할 최소 기간.
 *
 * 없으면 "하루에 한 번 기록하고 만 과목"이 밀도 1.0 으로 가장 진하게 나온다
 * (1개 ÷ 1일). 기간이 짧을수록 밀도가 폭등하는 걸 막는 하한이다.
 */
const MIN_DENSITY_SPAN_DAYS = 14;

// ─── 인덱스 ────────────────────────────────────────────────

export function buildIndex(state) {
  const blocksBySubject = new Map();
  const entriesByBlock = new Map();
  const entriesByDate = new Map();
  const lastActiveBySubject = new Map();
  const tagCounts = new Map();

  for (const id of state.subjectOrder) {
    blocksBySubject.set(id, []);
  }

  for (const block of Object.values(state.blocks)) {
    if (!blocksBySubject.has(block.subjectId)) blocksBySubject.set(block.subjectId, []);
    blocksBySubject.get(block.subjectId).push(block);
    entriesByBlock.set(block.id, []);
  }
  for (const list of blocksBySubject.values()) {
    list.sort(byOrderThenCreated);
  }

  for (const entry of Object.values(state.entries)) {
    entriesByBlock.get(entry.blockId)?.push(entry);

    if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
    entriesByDate.get(entry.date).push(entry);

    const subjectId = state.blocks[entry.blockId]?.subjectId;
    if (subjectId) {
      const prev = lastActiveBySubject.get(subjectId);
      if (!prev || entry.date > prev) lastActiveBySubject.set(subjectId, entry.date);
    }

    for (const tag of entry.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  for (const list of entriesByBlock.values()) list.sort(byDateThenCreated);
  for (const list of entriesByDate.values()) list.sort(byCreated);

  return { blocksBySubject, entriesByBlock, entriesByDate, lastActiveBySubject, tagCounts };
}

// ─── Subject ───────────────────────────────────────────────

/**
 * 진도율 = 완료한 Block 수 ÷ totalBlocks.
 * totalBlocks 는 사용자가 직접 입력한 '전체 커리큘럼 기준' 값이라
 * 실제 만든 Block 수와 다를 수 있다. 그 경우를 플래그로 알려준다.
 */
export function selectProgress(state, index, subjectId) {
  const subject = state.subjects[subjectId];
  const blocks = index.blocksBySubject.get(subjectId) ?? [];
  const completed = blocks.filter((b) => b.isCompleted).length;
  const total = subject?.totalBlocks ?? 0;

  return {
    completed,
    total,
    created: blocks.length,
    hasTarget: total > 0,
    /** 목표를 정하지 않았으면 0% */
    percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
    /** 실제 Block 수가 목표를 넘었으면 경고 표시용 */
    overflow: total > 0 && blocks.length > total,
  };
}

/**
 * 다음에 만들 과목이 받게 될 자동 배정 색.
 * 과목 추가 폼에서 색상 피커의 기본값으로 미리 보여주기 위해 쓴다.
 * (reducer 가 실제로 쓰는 계산과 같은 함수를 통과시킨다)
 */
export function selectNextAutoHue(state) {
  const used = Object.values(state.subjects)
    .map((s) => Number(s.colorHue))
    .filter(Number.isFinite);
  return nextFreeHueIndex(used, state.settings.hueIndex).hue;
}

/** 마지막 기록일로부터 며칠 지났는지. 기록이 없으면 null */
export function selectDaysSinceActive(index, subjectId, today = todayKey()) {
  const last = index.lastActiveBySubject.get(subjectId);
  if (!last) return null;
  return Math.max(0, daysBetween(last, today) ?? 0);
}

/**
 * 과목 목록 화면용. 활성도 알파가 여기에 붙는다.
 * (캘린더에는 활성도를 쓰지 않는다 — 점은 항상 불투명하다)
 */
export function selectSubjectList(state, index, today = todayKey()) {
  return state.subjectOrder
    .map((id) => state.subjects[id])
    .filter(Boolean)
    .map((subject) => {
      const daysSince = selectDaysSinceActive(index, subject.id, today);
      return {
        subject,
        progress: selectProgress(state, index, subject.id),
        lastActiveDate: index.lastActiveBySubject.get(subject.id) ?? null,
        daysSince,
        alpha: activityAlpha(daysSince, state.settings.inactivityDays),
        blockCount: (index.blocksBySubject.get(subject.id) ?? []).length,
        entryCount: (index.blocksBySubject.get(subject.id) ?? []).reduce(
          (sum, b) => sum + (index.entriesByBlock.get(b.id)?.length ?? 0),
          0
        ),
      };
    });
}

export function selectBlocks(index, subjectId) {
  return index.blocksBySubject.get(subjectId) ?? [];
}

export function selectBlockEntries(index, blockId) {
  return index.entriesByBlock.get(blockId) ?? [];
}

/**
 * 과목 전체의 기록을 최신순으로. 과목 상세의 '소속 기록 요약' 목록에 쓴다.
 *
 * 블록 화면을 하나씩 열어보지 않고도 "이 과목에서 최근에 뭘 했나"를 알 수 있어야
 * 하는데, 인덱스는 블록별로만 묶여 있어 여기서 한 번 합친다.
 * 각 기록에 소속 블록을 함께 실어 보낸다 — 목록에서 바로 경로를 만들 수 있어야 한다.
 */
export function selectSubjectEntries(index, subjectId, limit = Infinity) {
  const rows = [];
  for (const block of index.blocksBySubject.get(subjectId) ?? []) {
    for (const entry of index.entriesByBlock.get(block.id) ?? []) {
      rows.push({ entry, block });
    }
  }
  rows.sort((a, b) => byDateThenCreated(b.entry, a.entry));
  return { total: rows.length, rows: Number.isFinite(limit) ? rows.slice(0, limit) : rows };
}

// ─── Block 자체 정보 ───────────────────────────────────────

/**
 * Block 의 대표 진행률.
 *
 * 트래커는 이 값을 계산하지 않는다. claude.ai 가 계산해 보내준 값을 그대로
 * 보관하고 있을 뿐이라, 화면에 그릴 때만 0~100 으로 물려서 쓴다.
 * (과목 진도율처럼 '완료 블록 ÷ 목표'로 유도되는 값이 아니다)
 */
export function selectBlockProgress(block) {
  const raw = block?.progressPercent;
  if (raw == null) return { hasValue: false, percent: 0 };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { hasValue: false, percent: 0 };
  return { hasValue: true, percent: Math.min(100, Math.max(0, Math.round(n))) };
}

/**
 * 블록 안의 진행률 추이 — 진행률이 적힌 기록만 날짜순으로 뽑는다.
 *
 * Block.progressPercent(대표값)와 달리 이쪽은 Entry.progressPercent 를 모은 것이다.
 * 진행률이 비어 있는 기록은 건너뛴다. 0 으로 채워 이어 붙이면 "그날 진도가
 * 0으로 떨어졌다"는 거짓말이 되기 때문이다.
 */
export function selectBlockTrend(index, blockId) {
  const points = [];
  for (const entry of index.entriesByBlock.get(blockId) ?? []) {
    const p = Number(entry.progressPercent);
    if (entry.progressPercent == null || !Number.isFinite(p)) continue;
    points.push({
      entryId: entry.id,
      date: entry.date,
      percent: Math.min(100, Math.max(0, Math.round(p))),
    });
  }
  return points;
}

// ─── 검색 ─────────────────────────────────────────────────

/** 종류별 최대 결과 수 — 사이드바에 수백 줄이 쏟아지지 않게 */
export const SEARCH_LIMIT = 20;

/**
 * 과목·블록·기록을 한 번에 훑는다.
 *
 * 저장은 평면 맵이라 세 종류를 각각 돌면 되고, 계층 문맥(과목/블록)은
 * 결과에 함께 실어 보낸다 — "Week 5"라는 블록이 어느 과목의 것인지 보이지
 * 않으면 검색 결과가 무의미해지기 때문이다.
 *
 * 대소문자를 구분하지 않고 부분 일치로 찾는다. 기록은 제목과 내용을 모두 보되,
 * 내용에서 걸린 경우에는 걸린 자리 주변을 잘라 미리보기로 돌려준다.
 */
export function selectSearch(state, index, rawQuery, limit = SEARCH_LIMIT) {
  const query = String(rawQuery ?? '').trim();
  if (query.length === 0) {
    return { query: '', isEmpty: true, total: 0, subjects: [], blocks: [], entries: [] };
  }

  const needle = query.toLowerCase();
  const hit = (text) => typeof text === 'string' && text.toLowerCase().includes(needle);

  const subjects = [];
  const blocks = [];
  const entries = [];

  for (const id of state.subjectOrder) {
    const subject = state.subjects[id];
    if (!subject) continue;

    if (hit(subject.name)) subjects.push({ subject });

    for (const block of index.blocksBySubject.get(id) ?? []) {
      if (hit(block.name) || hit(block.description)) {
        blocks.push({
          block,
          subject,
          // 이름이 아니라 설명에서 걸렸으면 어디서 걸렸는지 보여준다
          snippet: hit(block.name) ? null : snippetAround(block.description, needle),
        });
      }

      for (const entry of index.entriesByBlock.get(block.id) ?? []) {
        const inTitle = hit(entry.title);
        const inContent = hit(entry.content);
        const inTags = (entry.tags ?? []).some(hit);
        if (!inTitle && !inContent && !inTags) continue;
        entries.push({
          entry,
          block,
          subject,
          snippet: inContent ? snippetAround(entry.content, needle) : null,
        });
      }
    }
  }

  // 기록은 최신순이 유용하다 (과목·블록은 트리 순서를 유지한다)
  entries.sort((a, b) => byDateThenCreated(b.entry, a.entry));

  const total = subjects.length + blocks.length + entries.length;
  return {
    query,
    isEmpty: false,
    total,
    truncated: total > limit * 3,
    subjects: subjects.slice(0, limit),
    blocks: blocks.slice(0, limit),
    entries: entries.slice(0, limit),
  };
}

/** 검색어 주변 ±40자. 줄바꿈은 공백으로 눕혀 한 줄로 보여준다. */
const SNIPPET_PAD = 40;

function snippetAround(text, needle) {
  if (typeof text !== 'string') return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = flat.toLowerCase().indexOf(needle);
  if (at < 0) return flat.slice(0, SNIPPET_PAD * 2) || null;

  const from = Math.max(0, at - SNIPPET_PAD);
  const to = Math.min(flat.length, at + needle.length + SNIPPET_PAD);
  return `${from > 0 ? '…' : ''}${flat.slice(from, to)}${to < flat.length ? '…' : ''}`;
}

// ─── 캘린더 ────────────────────────────────────────────────

export function selectEntriesOfDate(index, dateKey) {
  return index.entriesByDate.get(dateKey) ?? [];
}

/**
 * 그날 활동한 과목들 — 캘린더 점.
 * 점 색은 과목의 hue, 투명도는 항상 1 이다.
 */
export function selectSubjectsOnDate(state, index, dateKey) {
  const seen = new Set();
  const result = [];
  for (const entry of selectEntriesOfDate(index, dateKey)) {
    const subjectId = state.blocks[entry.blockId]?.subjectId;
    if (!subjectId || seen.has(subjectId)) continue;
    seen.add(subjectId);
    const subject = state.subjects[subjectId];
    if (subject) result.push(subject);
  }
  // 과목 목록 순서대로 정렬해 날짜마다 점 순서가 흔들리지 않게 한다.
  const rank = new Map(state.subjectOrder.map((id, i) => [id, i]));
  return result.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

// ─── Entry 문맥 (반대 경로 점프용) ──────────────────────────

export function selectEntryContext(state, entryId) {
  const entry = state.entries[entryId];
  if (!entry) return null;
  const block = state.blocks[entry.blockId] ?? null;
  const subject = block ? (state.subjects[block.subjectId] ?? null) : null;
  return { entry, block, subject };
}

// ─── 연간 간트 ─────────────────────────────────────────────

/**
 * 연간 활동 요약 위젯 데이터. 장식용이므로 클릭 정보는 만들지 않는다.
 *
 * - 막대 위치: 그 해 첫 기록 ~ 마지막 기록
 * - 막대 진하기: 활동 밀도(기록 수 ÷ 기간)를 전체 최대치로 정규화한 뒤 비선형 변환
 * - 과목 라벨 진하기: 최근 활동 기준 활성도 (밀도와 다른 축이므로 막대와 분리)
 */
export function selectYearGantt(state, index, year, today = todayKey()) {
  const rows = [];

  for (const subjectId of state.subjectOrder) {
    const subject = state.subjects[subjectId];
    if (!subject) continue;

    let first = null;
    let last = null;
    let count = 0;

    for (const block of index.blocksBySubject.get(subjectId) ?? []) {
      for (const entry of index.entriesByBlock.get(block.id) ?? []) {
        if (parseDateKey(entry.date)?.year !== year) continue;
        count += 1;
        if (first === null || entry.date < first) first = entry.date;
        if (last === null || entry.date > last) last = entry.date;
      }
    }

    if (count === 0) continue;

    const spanDays = (daysBetween(first, last) ?? 0) + 1;
    const density = count / Math.max(spanDays, MIN_DENSITY_SPAN_DAYS);
    const daysSince = selectDaysSinceActive(index, subjectId, today);

    rows.push({
      subject,
      firstDate: first,
      lastDate: last,
      entryCount: count,
      spanDays,
      density,
      // 아래 두 값은 정규화 후 채운다
      barAlpha: 1,
      labelAlpha: activityAlpha(daysSince, state.settings.inactivityDays),
      start: yearFraction(first),
      end: yearFraction(last) + 1 / daysInYear(year),
    });
  }

  const maxDensity = rows.reduce((max, r) => Math.max(max, r.density), 0);
  for (const row of rows) {
    row.barAlpha = densityAlpha(maxDensity > 0 ? row.density / maxDensity : 0);
  }

  return { year, rows, maxDensity };
}

/** 기록이 존재하는 연도 목록 (간트의 연도 전환용) */
export function selectYearsWithEntries(state) {
  const years = new Set();
  for (const entry of Object.values(state.entries)) {
    const p = parseDateKey(entry.date);
    if (p) years.add(p.year);
  }
  return [...years].sort((a, b) => b - a);
}

// ─── 내보내기 상태 ─────────────────────────────────────────

/**
 * '내보내기 필요' 배너의 근거.
 *
 * 공용 PC 시나리오에서 진짜 위험은 가져오기 실패가 아니라
 * 퇴실 전 내보내기를 깜빡하는 것이라, 이 값을 항상 상단에 노출한다.
 */
export function selectExportStatus(state) {
  const lastExportedAt = state.settings.lastExportedAt ?? null;
  const lastChangeAt = state.settings.lastChangeAt ?? null;

  const since = lastExportedAt ? Date.parse(lastExportedAt) : null;
  const entryCount = Object.keys(state.entries).length;

  if (since === null || Number.isNaN(since)) {
    return {
      neverExported: true,
      unexportedEntries: entryCount,
      hasChanges: entryCount > 0 || lastChangeAt !== null,
      lastExportedAt: null,
    };
  }

  let unexported = 0;
  for (const entry of Object.values(state.entries)) {
    const at = Date.parse(entry.updatedAt ?? entry.createdAt ?? '');
    if (!Number.isNaN(at) && at > since) unexported += 1;
  }

  const changedAt = lastChangeAt ? Date.parse(lastChangeAt) : null;
  return {
    neverExported: false,
    unexportedEntries: unexported,
    // 삭제만 한 경우에도 '변경 있음'을 잡아내기 위해 lastChangeAt 을 함께 본다
    hasChanges: unexported > 0 || (changedAt !== null && changedAt > since),
    lastExportedAt,
  };
}

/** 태그 입력 자동완성용 — 많이 쓴 순 */
export function selectTagSuggestions(index, limit = 30) {
  return [...index.tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

// ─── 정렬 비교자 ───────────────────────────────────────────

function byOrderThenCreated(a, b) {
  const diff = (Number(a.order) || 0) - (Number(b.order) || 0);
  return diff !== 0 ? diff : String(a.createdAt).localeCompare(String(b.createdAt));
}

function byDateThenCreated(a, b) {
  const diff = a.date.localeCompare(b.date);
  return diff !== 0 ? diff : String(a.createdAt).localeCompare(String(b.createdAt));
}

function byCreated(a, b) {
  return String(a.createdAt).localeCompare(String(b.createdAt));
}
