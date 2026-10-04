/**
 * 마감 모아 보기 — 캘린더 깃발 · 홈 '마감 일정' · 그날 화면이 쓰는 셀렉터와 날짜 묶음.
 * 실행: npm test  (시간대를 바꿔 보려면 TZ=Pacific/Kiritimati npm test)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { deadlineBucket, addDays } from '../src/lib/date.js';
import { reducer, ACTIONS } from '../src/state/reducer.js';
import { createInitialState } from '../src/storage/schema.js';
import {
  buildIndex,
  selectDeadlineItems,
  selectUpcomingDeadlines,
  groupDeadlinesByDate,
  UPCOMING_DEADLINE_DAYS,
} from '../src/state/selectors.js';

// 2026-10-04 는 일요일, 2026-10-08 은 목요일
const SUN = '2026-10-04';
const THU = '2026-10-08';

describe('deadlineBucket — 주는 일요일에 시작', () => {
  it('일요일 기준: 토요일까지 이번 주, 다음 토요일까지 다음 주', () => {
    assert.equal(deadlineBucket('2026-10-03', SUN), 'overdue');
    assert.equal(deadlineBucket(SUN, SUN), 'thisWeek');
    assert.equal(deadlineBucket('2026-10-10', SUN), 'thisWeek'); // 토
    assert.equal(deadlineBucket('2026-10-11', SUN), 'nextWeek'); // 다음 일
    assert.equal(deadlineBucket('2026-10-17', SUN), 'nextWeek'); // 다음 토
    assert.equal(deadlineBucket('2026-10-18', SUN), 'later');
  });

  it('목요일 기준: 이번 주는 사흘(목·금·토)', () => {
    assert.equal(deadlineBucket(THU, THU), 'thisWeek');
    assert.equal(deadlineBucket('2026-10-10', THU), 'thisWeek');
    assert.equal(deadlineBucket('2026-10-11', THU), 'nextWeek');
    assert.equal(deadlineBucket('2026-10-18', THU), 'later');
  });

  it('토요일 기준: 오늘 하루가 이번 주', () => {
    assert.equal(deadlineBucket('2026-10-10', '2026-10-10'), 'thisWeek');
    assert.equal(deadlineBucket('2026-10-11', '2026-10-10'), 'nextWeek');
  });

  it('마감이 없거나 읽을 수 없으면 null', () => {
    assert.equal(deadlineBucket(undefined, SUN), null);
    assert.equal(deadlineBucket('2026-13-45', SUN), null);
  });
});

/**
 * 통계(S1, 과목 마감 10/31): Week 4(완료, 10/1) · Week 5(10/4) · Week 6(10/16) · Week 7(마감 없음)
 * 영어(S2, 블록 0개, 과목 마감 10/2) · 알고리즘(S3): 그래프(10/9) · 먼 블록(11/20)
 */
function seed() {
  let s = createInitialState();
  const d = (a) => (s = reducer(s, a));
  d({ type: ACTIONS.SUBJECT_ADD, id: 'S1', name: '통계' });
  d({ type: ACTIONS.SUBJECT_ADD, id: 'S2', name: '영어' });
  d({ type: ACTIONS.SUBJECT_ADD, id: 'S3', name: '알고리즘' });
  d({ type: ACTIONS.SUBJECT_UPDATE, id: 'S1', patch: { deadline: '2026-10-31' } });
  d({ type: ACTIONS.SUBJECT_UPDATE, id: 'S2', patch: { deadline: '2026-10-02' } });
  const blocks = [
    ['B4', 'S1', 'Week 4', '2026-10-01', true],
    ['B5', 'S1', 'Week 5', SUN, false],
    ['B6', 'S1', 'Week 6', '2026-10-16', false],
    ['B7', 'S1', 'Week 7', null, false],
    ['G1', 'S3', '그래프', '2026-10-09', false],
    ['G2', 'S3', '먼 블록', '2026-11-20', false],
  ];
  for (const [id, subjectId, name, deadline, done] of blocks) {
    d({ type: ACTIONS.BLOCK_ADD, id, subjectId, name });
    if (deadline) d({ type: ACTIONS.BLOCK_UPDATE, id, patch: { deadline } });
    if (done) d({ type: ACTIONS.BLOCK_TOGGLE, id });
  }
  d({ type: ACTIONS.BLOCK_UPDATE, id: 'B5', patch: { progressPercent: 70 } });
  return s;
}

describe('selectDeadlineItems', () => {
  it('마감 있는 과목·블록만, 마감 이른 순', () => {
    const s = seed();
    const items = selectDeadlineItems(s, buildIndex(s), SUN);
    assert.deepEqual(
      items.map((i) => i.key),
      ['b:B4', 's:S2', 'b:B5', 'b:G1', 'b:B6', 's:S1', 'b:G2']
    );
  });

  it('완료 판정: 블록은 완료 체크, 과목은 블록 전부 완료 (블록 0개 과목은 미완료)', () => {
    const s = seed();
    const byKey = new Map(selectDeadlineItems(s, buildIndex(s), SUN).map((i) => [i.key, i]));
    assert.equal(byKey.get('b:B4').done, true);
    assert.equal(byKey.get('b:B5').done, false);
    assert.equal(byKey.get('s:S2').done, false); // 블록 0개
    assert.equal(byKey.get('s:S1').done, false);
    assert.equal(byKey.get('b:B5').progressPercent, 70);
    assert.equal(byKey.get('s:S1').progressPercent, 25); // 블록 4개 중 1개 완료
    assert.equal(byKey.get('b:B5').info.label, 'D-day');
    assert.equal(byKey.get('s:S2').info.label, 'D+2(지남)');
  });

  it('마감이 없는 예전 데이터면 빈 목록', () => {
    let s = createInitialState();
    s = reducer(s, { type: ACTIONS.SUBJECT_ADD, id: 'S', name: '수학' });
    s = reducer(s, { type: ACTIONS.BLOCK_ADD, id: 'B', subjectId: 'S', name: '1주차' });
    assert.deepEqual(selectDeadlineItems(s, buildIndex(s), SUN), []);
    assert.deepEqual(selectUpcomingDeadlines(s, buildIndex(s), SUN), []);
  });

  it('읽을 수 없는 마감값(백업에서 들어온 것)은 건너뛴다', () => {
    const s = seed();
    const broken = { ...s, blocks: { ...s.blocks, B7: { ...s.blocks.B7, deadline: '2026-13-45' } } };
    assert.ok(!selectDeadlineItems(broken, buildIndex(broken), SUN).some((i) => i.key === 'b:B7'));
  });

  it('groupDeadlinesByDate — 캘린더 깃발용 날짜 묶음', () => {
    const s = seed();
    s.blocks.G1 = { ...s.blocks.G1, deadline: SUN }; // 같은 날 두 개
    const byDate = groupDeadlinesByDate(selectDeadlineItems(s, buildIndex(s), SUN));
    assert.deepEqual(byDate.get(SUN).map((i) => i.key), ['b:B5', 'b:G1']);
    assert.equal(byDate.get('2026-10-05'), undefined);
  });
});

describe('selectUpcomingDeadlines — 홈 마감 일정', () => {
  it(`완료 제외, 지난 것 전부 + ${UPCOMING_DEADLINE_DAYS}일 이내, 묶음 표시`, () => {
    const s = seed();
    const items = selectUpcomingDeadlines(s, buildIndex(s), SUN);
    assert.deepEqual(
      items.map((i) => [i.key, i.bucket]),
      [
        ['s:S2', 'overdue'],
        ['b:B5', 'thisWeek'],
        ['b:G1', 'thisWeek'],
        ['b:B6', 'nextWeek'],
        ['s:S1', 'later'],
      ]
    );
    // B4(완료)와 G2(47일 뒤)는 빠진다
    assert.ok(!items.some((i) => i.key === 'b:B4' || i.key === 'b:G2'));
  });

  it('30일째는 들어가고 31일째는 빠진다', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B7', patch: { deadline: addDays(SUN, 30) } });
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'G2', patch: { deadline: addDays(SUN, 31) } });
    const keys = selectUpcomingDeadlines(s, buildIndex(s), SUN).map((i) => i.key);
    assert.ok(keys.includes('b:B7'));
    assert.ok(!keys.includes('b:G2'));
  });

  it('아주 오래 지난 미완료도 빠지지 않는다', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_UPDATE, id: 'B7', patch: { deadline: '2025-01-01' } });
    const first = selectUpcomingDeadlines(s, buildIndex(s), SUN)[0];
    assert.equal(first.key, 'b:B7');
    assert.equal(first.bucket, 'overdue');
  });

  it('블록을 완료로 표시하면 목록에서 사라진다', () => {
    let s = seed();
    s = reducer(s, { type: ACTIONS.BLOCK_TOGGLE, id: 'B5' });
    assert.ok(!selectUpcomingDeadlines(s, buildIndex(s), SUN).some((i) => i.key === 'b:B5'));
  });
});
