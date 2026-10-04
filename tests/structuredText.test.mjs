/**
 * 정형 텍스트(---SUBJECT--- / ---BLOCK--- / ---ENTRY---) 가져오기·내보내기 검증.
 *
 * 브라우저 없이 순수 함수(파서·계획기·reducer)만으로 돈다. 실행: npm test
 * 시간대에 따라 하루가 밀리지 않는지 보려면 TZ 를 바꿔 돌린다 (예: TZ=Pacific/Kiritimati npm test).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import * as st from '../src/lib/structuredText.js';
import { deadlineInfo, todayKey, addDays } from '../src/lib/date.js';
import { reducer, ACTIONS } from '../src/state/reducer.js';
import { createInitialState } from '../src/storage/schema.js';
import { planSubjectImport, planDailyImport, planEntriesImport } from '../src/lib/importPlan.js';
import { validateBackup } from '../src/storage/validate.js';
import { buildBackup } from '../src/storage/exportData.js';
import { mergeStates } from '../src/storage/merge.js';
import { buildIndex, selectBlocks, selectBlockEntries, sortByDeadline } from '../src/state/selectors.js';

// ─── 도우미 ────────────────────────────────────────────────

const doc = (marker, lines) => [marker, ...lines, '---END---'].join('\n');
const BLOCK = (lines) => doc('---BLOCK---', lines);
const SUBJECT = (lines) => doc('---SUBJECT---', lines);

/** 수학(S) 과목에 블록 B1(설명 있음)·B2(설명 없음) */
function seed() {
  let s = createInitialState();
  s = reducer(s, { type: ACTIONS.SUBJECT_ADD, id: 'S', name: '수학', description: '과목 설명' });
  s = reducer(s, { type: ACTIONS.BLOCK_ADD, id: 'B1', subjectId: 'S', name: '1주차', description: '1주차 설명' });
  s = reducer(s, { type: ACTIONS.BLOCK_ADD, id: 'B2', subjectId: 'S', name: '2주차' });
  return s;
}

/** 과목 화면의 '과목 전체 가져오기'와 같은 경로 */
function importSubject(state, text) {
  const parsed = st.parseDocuments(text);
  assert.ok(parsed.ok, parsed.errors.join('\n'));
  const planned = planSubjectImport(state, parsed.docs, { subjectId: 'S' });
  assert.ok(planned.ok, planned.errors?.join('\n'));
  return { state: reducer(state, { type: ACTIONS.BUNDLE_APPLY, plan: planned.plan }), planned };
}

function exportBundle(state) {
  const index = buildIndex(state);
  return st.buildSubjectBundleText(state.subjects.S, selectBlocks(index, 'S'), (id) => selectBlockEntries(index, id));
}

// ─── 날짜 유틸 ────────────────────────────────────────────

describe('D-day 계산 (lib/date.js)', () => {
  it('D-5 / D-day / D+2(지남)', () => {
    const T = '2026-10-04';
    assert.equal(deadlineInfo('2026-10-09', T).label, 'D-5');
    assert.equal(deadlineInfo('2026-10-04', T).label, 'D-day');
    assert.deepEqual(deadlineInfo('2026-10-02', T), { days: -2, overdue: true, label: 'D+2(지남)' });
  });

  it('없거나 읽을 수 없는 마감은 null', () => {
    for (const v of [undefined, null, '', '2026-13-45', '2026-02-30', '2026/10/31']) {
      assert.equal(deadlineInfo(v, '2026-10-04'), null);
    }
  });

  it('연말·서머타임 경계에서 하루가 밀리지 않는다', () => {
    assert.equal(deadlineInfo('2027-01-01', '2026-12-31').label, 'D-1');
    assert.equal(deadlineInfo('2026-03-30', '2026-03-29').label, 'D-1');
    assert.equal(deadlineInfo('2026-11-02', '2026-11-01').label, 'D-1');
  });

  it(`로컬 오늘 기준 (TZ=${process.env.TZ ?? 'system'})`, () => {
    assert.equal(deadlineInfo(todayKey()).label, 'D-day');
    assert.equal(deadlineInfo(addDays(todayKey(), 1)).label, 'D-1');
    assert.equal(deadlineInfo(addDays(todayKey(), -1)).label, 'D+1(지남)');
  });

  it('마감일순: 이른 순, 마감 없음·무효값은 맨 뒤, 같은 마감은 원래 순서', () => {
    const list = [['a', '2026-11-01'], ['b', null], ['c', '2026-10-05'], ['d', undefined], ['e', 'bad'], ['f', '2026-10-05']]
      .map(([id, deadline]) => ({ id, deadline }));
    assert.deepEqual(sortByDeadline(list, (o) => o.deadline).map((o) => o.id), ['c', 'f', 'a', 'b', 'd', 'e']);
  });
});

// ─── 마감 필드 파싱 ───────────────────────────────────────

describe('마감 항목 파싱', () => {
  const block = (extra) => st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차', ...extra]));

  it('콜론 뒤·값 뒤 공백을 걷어낸다', () => {
    assert.equal(block(['마감:   2026-10-31   ']).value.deadline, '2026-10-31');
  });

  it("생략 → undefined(그대로), '없음'·'(지움)' → null(지움)", () => {
    assert.equal(block([]).value.deadline, undefined);
    assert.equal(block(['마감: 없음']).value.deadline, null);
    assert.equal(block(['마감: (지움)']).value.deadline, null);
  });

  it('잘못된 날짜는 기존 오류 형식으로 거부한다', () => {
    for (const bad of ['2026-13-45', '2026-02-30', '2026/10/31', '10월 31일', '2026-1-5']) {
      const r = block([`마감: ${bad}`]);
      assert.equal(r.ok, false);
      assert.match(r.errors[0], /^마감 형식이 올바르지 않습니다/);
    }
  });

  it('여러 문서 중 하나라도 틀리면 줄 번호를 붙여 전부 멈춘다', () => {
    const r = st.parseDocuments(
      `${SUBJECT(['과목: 수학', '마감: 2026-12-20'])}\n${BLOCK(['과목: 수학', '블록: 1주차', '마감: 2026-13-45'])}`
    );
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /^---BLOCK--- \(5번째 줄\): 마감 형식/);
  });

  it("ENTRY 내용 속 '마감:' 줄은 항목이 아니라 내용이다", () => {
    const r = st.parseEntryText(doc('---ENTRY---', ['날짜: 2026-10-04', '과목: 수학', '블록: 1주차', '내용:', '마감: 금요일']));
    assert.ok(r.ok);
    assert.equal(r.value.content, '마감: 금요일');
  });
});

// ─── 설명 선택화 ──────────────────────────────────────────

describe('설명은 선택 항목', () => {
  it('BLOCK·SUBJECT 모두 설명 없이 읽힌다 (설명은 undefined)', () => {
    const b = st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차']));
    assert.ok(b.ok, b.errors?.join());
    assert.equal(b.value.description, undefined);
    const s = st.parseSubjectText(SUBJECT(['과목: 수학']));
    assert.ok(s.ok, s.errors?.join());
    assert.equal(s.value.description, undefined);
  });

  it('과목·블록 이름은 여전히 필수다', () => {
    assert.match(st.parseBlockText(BLOCK(['과목: 수학'])).errors[0], /블록이 없습니다/);
    assert.match(st.parseSubjectText(SUBJECT(['설명: x'])).errors[0], /과목이 없습니다/);
  });

  it('[사용 사례] 과목·블록·마감 세 줄 BLOCK 으로 마감만 일괄 입력 — 설명·진행률·그림은 보존', () => {
    let s = seed();
    s = reducer(s, {
      type: ACTIONS.BLOCK_UPDATE,
      id: 'B1',
      patch: { progressPercent: 40, diagramCode: 'graph TD\n A-->B', svgCode: '<svg></svg>' },
    });
    const before = { B1: { ...s.blocks.B1 }, B2: { ...s.blocks.B2 } };

    const text = [
      BLOCK(['과목: 수학', '블록: 1주차', '마감: 2026-10-31']),
      BLOCK(['과목: 수학', '블록: 2주차', '마감: 2026-11-07']),
    ].join('\n\n');
    const { state: after, planned } = importSubject(s, text);

    assert.equal(planned.summary.blocksAdded, 0);
    assert.equal(planned.summary.blocksUpdated, 2);
    assert.equal(after.blocks.B1.deadline, '2026-10-31');
    assert.equal(after.blocks.B2.deadline, '2026-11-07');
    for (const id of ['B1', 'B2']) {
      for (const key of ['description', 'progressPercent', 'diagramCode', 'svgCode', 'name', 'isCompleted', 'order']) {
        assert.deepEqual(after.blocks[id][key], before[id][key], `${id}.${key} 가 바뀌었다`);
      }
      // 마감만 받은 건 '블록 정보를 받은' 게 아니다 — 낡음 표시 근거(갱신 시각)를 건드리지 않는다
      assert.equal(after.blocks[id].infoUpdatedAt, before[id].infoUpdatedAt);
    }
    assert.equal(after.blocks.B1.description, '1주차 설명');
  });

  it('[사용 사례] 오늘 기록 붙여넣기 경로에서도 마감만 적힌 BLOCK 이 설명을 보존한다', () => {
    const s = seed();
    const parsed = st.parseDocuments(BLOCK(['과목: 수학', '블록: 1주차', '마감: 2026-10-31']));
    const planned = planDailyImport(s, parsed.docs, '2026-10-04');
    assert.ok(planned.ok, planned.errors?.join());
    const after = reducer(s, { type: ACTIONS.BUNDLES_APPLY, plans: planned.plans });
    assert.equal(after.blocks.B1.deadline, '2026-10-31');
    assert.equal(after.blocks.B1.description, '1주차 설명');
  });

  it('[사용 사례] 블록 상세의 블록 정보 가져오기(updateBlock 경로)도 설명을 보존한다', () => {
    let s = seed();
    const parsed = st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차', '마감: 2026-10-31']));
    const v = parsed.value;
    // BlockView.applyBlockInfo 와 같은 패치
    s = reducer(s, {
      type: ACTIONS.BLOCK_UPDATE,
      id: 'B1',
      patch: { description: v.description, progressPercent: v.progressPercent, diagramCode: v.diagramCode, svgCode: v.svgCode, deadline: v.deadline },
      markInfo: false,
    });
    assert.equal(s.blocks.B1.deadline, '2026-10-31');
    assert.equal(s.blocks.B1.description, '1주차 설명');
  });

  it('SUBJECT 에 설명이 없으면 과목 설명을 그대로 둔다', () => {
    const { state } = importSubject(seed(), SUBJECT(['과목: 수학', '마감: 2026-12-20']));
    assert.equal(state.subjects.S.description, '과목 설명');
    assert.equal(state.subjects.S.deadline, '2026-12-20');
  });

  it('설명이 적힌 기존 동작은 그대로 — 적힌 설명으로 덮어쓰고 갱신 시각을 찍는다', () => {
    const s = seed();
    const { state } = importSubject(
      s,
      `${SUBJECT(['과목: 수학', '설명:', '새 과목 설명'])}\n${BLOCK(['과목: 수학', '블록: 1주차', '설명:', '새 블록 설명'])}`
    );
    assert.equal(state.subjects.S.description, '새 과목 설명');
    assert.equal(state.blocks.B1.description, '새 블록 설명');
    assert.ok(state.blocks.B1.infoUpdatedAt);
  });

  it('설명 없는 BLOCK 으로 새 블록을 만들면 빈 설명으로 만든다', () => {
    const { state, planned } = importSubject(seed(), BLOCK(['과목: 수학', '블록: 3주차', '마감: 2026-11-14']));
    assert.equal(planned.summary.blocksAdded, 1);
    const created = Object.values(state.blocks).find((b) => b.name === '3주차');
    assert.equal(created.description, '');
    assert.equal(created.deadline, '2026-11-14');
  });

  it('기록 전체 가져오기에 함께 온 설명 없는 BLOCK 도 받는다', () => {
    const s = seed();
    const text = `${doc('---ENTRY---', ['날짜: 2026-10-04', '과목: 수학', '블록: 1주차', '내용:', 'hi'])}\n${BLOCK(['과목: 수학', '블록: 1주차', '진행률: 50'])}`;
    const parsed = st.parseDocuments(text);
    const planned = planEntriesImport(s, parsed.docs, { subjectId: 'S', blockId: 'B1' });
    assert.ok(planned.ok, planned.errors?.join());
    const after = reducer(s, { type: ACTIONS.BUNDLE_APPLY, plan: planned.plan });
    assert.equal(after.blocks.B1.progressPercent, 50);
    assert.equal(after.blocks.B1.description, '1주차 설명');
    assert.ok(after.blocks.B1.infoUpdatedAt); // 진행률은 블록 정보라 갱신 시각을 찍는다
  });
});

// ─── SUBJECT: 빠진 항목은 그대로 ─────────────────────────

describe('SUBJECT 는 적힌 항목만 바꾼다', () => {
  /** 설명·다이어그램·SVG·마감이 모두 채워진 과목 */
  function richSubject() {
    let s = seed();
    s = reducer(s, {
      type: ACTIONS.SUBJECT_UPDATE,
      id: 'S',
      patch: { diagramCode: 'graph TD\n A-->B', svgCode: '<svg viewBox="0 0 1 1"></svg>', deadline: '2026-12-01' },
    });
    return s;
  }
  const keep = ['description', 'diagramCode', 'svgCode', 'name', 'colorHue', 'customColor'];

  it('[사용 사례] 과목 / 마감 두 줄로 마감만 넣어도 설명·다이어그램·SVG 가 남는다', () => {
    const s = richSubject();
    const { state, planned } = importSubject(s, SUBJECT(['과목: 수학', '마감: 2026-12-20']));
    assert.equal(state.subjects.S.deadline, '2026-12-20');
    for (const key of keep) assert.deepEqual(state.subjects.S[key], s.subjects.S[key], `subject.${key} 가 바뀌었다`);
    assert.equal(state.subjects.S.diagramCode, 'graph TD\n A-->B');
    assert.equal(state.subjects.S.svgCode, '<svg viewBox="0 0 1 1"></svg>');
    // 블록 목록이 없으니 블록도 그대로
    assert.equal(planned.summary.blocksAdded, 0);
    assert.equal(planned.summary.blocksUpdated, 0);
    assert.deepEqual(state.blocks, s.blocks);
  });

  it('과목 이름 한 줄뿐이면 마감까지 아무것도 바뀌지 않는다', () => {
    const s = richSubject();
    const { state } = importSubject(s, SUBJECT(['과목: 수학']));
    for (const key of [...keep, 'deadline']) assert.deepEqual(state.subjects.S[key], s.subjects.S[key]);
  });

  it("다이어그램: (지움) 은 다이어그램만 비우고, 적히지 않은 SVG·설명은 남긴다", () => {
    const s = richSubject();
    const { state } = importSubject(s, SUBJECT(['과목: 수학', '다이어그램: (지움)']));
    assert.equal(state.subjects.S.diagramCode, null);
    assert.equal(state.subjects.S.svgCode, s.subjects.S.svgCode);
    assert.equal(state.subjects.S.description, '과목 설명');
  });

  it('SVG: (지움) 은 SVG 만 비운다', () => {
    const s = richSubject();
    const { state } = importSubject(s, SUBJECT(['과목: 수학', 'SVG: (지움)']));
    assert.equal(state.subjects.S.svgCode, null);
    assert.equal(state.subjects.S.diagramCode, s.subjects.S.diagramCode);
  });

  it('적힌 항목은 예전처럼 덮어쓴다 (설명·다이어그램·SVG)', () => {
    const s = richSubject();
    const text = SUBJECT(['과목: 수학', '설명:', '새 설명', '다이어그램:', '```mermaid', 'graph LR', ' X-->Y', '```', 'SVG:', '<svg></svg>']);
    const { state } = importSubject(s, text);
    assert.equal(state.subjects.S.description, '새 설명');
    assert.equal(state.subjects.S.diagramCode, 'graph LR\n X-->Y');
    assert.equal(state.subjects.S.svgCode, '<svg></svg>');
    assert.equal(state.subjects.S.deadline, '2026-12-01');
  });

  it('블록 목록을 적으면 없는 이름만 만든다 (기존 블록은 건드리지 않음)', () => {
    const s = richSubject();
    const { state, planned } = importSubject(s, SUBJECT(['과목: 수학', '블록 목록:', '1주차', '3주차']));
    assert.equal(planned.summary.blocksAdded, 1);
    assert.deepEqual(planned.summary.skipped, ['1주차']);
    assert.deepEqual(state.blocks.B1, s.blocks.B1);
    assert.equal(state.subjects.S.diagramCode, s.subjects.S.diagramCode);
  });
});

// ─── 설명: (지움) 거부 ────────────────────────────────────

describe("설명: (지움) 은 오류로 거부한다", () => {
  const MSG = /설명을 지우려면 과목\/블록 설정 화면에서 직접 지워주세요/;

  it('BLOCK·SUBJECT 둘 다, 한 줄·여러 줄·공백 섞인 모양 모두', () => {
    const shapes = [['설명: (지움)'], ['설명:', '(지움)'], ['설명:   (지움)   '], ['설명:', '', '(지움)', '']];
    for (const shape of shapes) {
      const b = st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차', ...shape]));
      assert.equal(b.ok, false, JSON.stringify(shape));
      assert.match(b.errors[0], MSG);
      const sj = st.parseSubjectText(SUBJECT(['과목: 수학', ...shape]));
      assert.equal(sj.ok, false, JSON.stringify(shape));
      assert.match(sj.errors[0], MSG);
    }
  });

  it('여러 문서 중 하나라도 그러면 줄 번호를 붙여 전부 멈추고 아무것도 바뀌지 않는다', () => {
    const r = st.parseDocuments(
      `${BLOCK(['과목: 수학', '블록: 1주차', '마감: 2026-10-31'])}\n${BLOCK(['과목: 수학', '블록: 2주차', '설명: (지움)'])}`
    );
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /^---BLOCK--- \(6번째 줄\): /);
    assert.match(r.errors[0], MSG);
  });

  it("설명 문장 속의 '(지움)' 은 그대로 설명이다", () => {
    const b = st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차', '설명:', '다이어그램은 (지움) 으로 지운다']));
    assert.ok(b.ok);
    assert.equal(b.value.description, '다이어그램은 (지움) 으로 지운다');
  });

  it('다른 항목의 (지움) 은 예전처럼 지운다', () => {
    const b = st.parseBlockText(BLOCK(['과목: 수학', '블록: 1주차', '진행률: (지움)', '다이어그램: (지움)', 'SVG: (지움)']));
    assert.ok(b.ok);
    assert.equal(b.value.progressPercent, null);
    assert.equal(b.value.diagramCode, '');
    assert.equal(b.value.svgCode, '');
  });
});

// ─── 왕복 ─────────────────────────────────────────────────

describe('내보내기 → 가져오기 왕복', () => {
  it('설명이 빈 블록·과목도 왕복된다 (예전 버그)', () => {
    let s = createInitialState();
    s = reducer(s, { type: ACTIONS.SUBJECT_ADD, id: 'S', name: '수학' });
    s = reducer(s, { type: ACTIONS.BLOCK_ADD, id: 'B1', subjectId: 'S', name: '빈 블록' });

    const blockText = st.buildBlockInfoText(s.subjects.S, s.blocks.B1);
    assert.ok(st.parseBlockText(blockText).ok, '블록 정보');
    assert.ok(st.parseSubjectText(st.buildSubjectInfoText(s.subjects.S, [s.blocks.B1])).ok, '과목 정보');

    const bundle = exportBundle(s);
    const { state } = importSubject(s, bundle);
    assert.equal(state.blocks.B1.description, '');
    assert.equal(exportBundle(state), bundle);
  });

  it('마감·설명이 섞인 과목 전체가 글자 하나까지 같게 돌아온다', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.SUBJECT_UPDATE, id: 'S', patch: { deadline: '2026-12-20' } });
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B1', patch: { deadline: '2026-10-31', progressPercent: 70 } });
    const bundle = exportBundle(s);
    assert.match(bundle, /과목: 수학\n마감: 2026-12-20/);
    assert.match(bundle, /진행률: 70\n마감: 2026-10-31/);

    const { state } = importSubject(s, bundle);
    assert.equal(exportBundle(state), bundle);
    assert.equal(state.subjects.S.deadline, '2026-12-20');
    assert.equal(state.blocks.B1.deadline, '2026-10-31');
    assert.equal(state.blocks.B2.description, '');
  });

  it("'마감: 없음' 으로 지우면 내보내기에서도 빠진다", () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B1', patch: { deadline: '2026-10-31' } });
    s = reducer(s, { type: ACTIONS.SUBJECT_UPDATE, id: 'S', patch: { deadline: '2026-12-20' } });
    const { state } = importSubject(
      s,
      `${SUBJECT(['과목: 수학', '마감: 없음'])}\n${BLOCK(['과목: 수학', '블록: 1주차', '마감: 없음'])}`
    );
    assert.equal(state.subjects.S.deadline, null);
    assert.equal(state.blocks.B1.deadline, null);
    assert.doesNotMatch(exportBundle(state), /마감:/);
  });
});

// ─── 마감 없는 기존 데이터 · JSON 백업 ─────────────────────

describe('기존 데이터와 JSON 백업', () => {
  it('deadline 키가 없는 예전 데이터: 내보내기에 마감이 없고 백업 검증 경고도 없다', () => {
    const s = seed();
    assert.ok(!('deadline' in s.blocks.B1));
    assert.doesNotMatch(exportBundle(s), /^마감:/m);
    const v = validateBackup(buildBackup(s));
    assert.ok(v.ok);
    assert.equal(v.warnings.length, 0);
  });

  it('백업 왕복·병합에 deadline 이 실리고, id 중복 건너뛰기는 그대로다', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B2', patch: { deadline: '2026-10-10' } });
    const v = validateBackup(JSON.parse(JSON.stringify(buildBackup(s))));
    assert.ok(v.ok);
    const merged = mergeStates(createInitialState(), v.backup.data);
    assert.equal(merged.state.blocks.B2.deadline, '2026-10-10');
    const again = mergeStates(merged.state, v.backup.data);
    assert.equal(again.report.added.blocks, 0);
    assert.equal(again.report.skipped.blocks, 2);
  });

  it('백업 속 잘못된 마감은 경고만 하고, 내보내기는 마감 없음으로 취급한다', () => {
    const s = seed();
    const bk = JSON.parse(JSON.stringify(buildBackup(s)));
    bk.data.blocks.B1.deadline = '2026-13-45';
    const v = validateBackup(bk);
    assert.ok(v.ok);
    assert.match(v.warnings.at(-1).message, /마감일을 읽을 수 없어/);
    assert.doesNotMatch(st.buildBlockInfoText(s.subjects.S, bk.data.blocks.B1).split('---END---')[0], /마감:/);
  });

  it('폼 편집: 마감 설정·삭제, 다른 항목만 바꾸면 마감 유지', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B1', patch: { deadline: '2026-11-11' } });
    assert.equal(s.blocks.B1.deadline, '2026-11-11');
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B1', patch: { name: '1주차!' } });
    assert.equal(s.blocks.B1.deadline, '2026-11-11');
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B1', patch: { deadline: null } });
    assert.equal(s.blocks.B1.deadline, null);
  });
});
