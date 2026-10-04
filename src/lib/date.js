/**
 * 날짜 유틸.
 *
 * 앱 전체에서 날짜는 'YYYY-MM-DD' 문자열(= dateKey) 하나로만 다룬다.
 * 중요: new Date('2026-09-18') 은 UTC 자정으로 파싱되어 한국 시간대에서
 * 하루가 밀린다. 그래서 문자열 파싱은 전부 아래 헬퍼를 거치고,
 * Date 객체를 만들 때는 항상 연/월/일을 명시적으로 넘긴다.
 */

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' 형식이고 실존하는 날짜인지 (2026-02-30 같은 값을 걸러낸다) */
export function isValidDateKey(key) {
  if (typeof key !== 'string') return false;
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
}

/** { year, month(1-12), day } 로 분해 */
export function parseDateKey(key) {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Date 객체 → 'YYYY-MM-DD' (로컬 시간 기준) */
export function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 오늘의 dateKey (로컬 시간 기준) */
export function todayKey() {
  return toDateKey(new Date());
}

/** dateKey → 로컬 자정의 Date 객체 */
export function dateKeyToDate(key) {
  const p = parseDateKey(key);
  if (!p) return null;
  return new Date(p.year, p.month - 1, p.day);
}

/**
 * 날짜 차이 계산용 정수.
 * UTC 로 정규화해 일 단위로 떨어뜨리므로 서머타임 영향을 받지 않는다.
 */
function toDayNumber(key) {
  const p = parseDateKey(key);
  if (!p) return null;
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / MS_PER_DAY);
}

/** toKey - fromKey (일 단위). 미래면 양수. 잘못된 키면 null */
export function daysBetween(fromKey, toKey) {
  const a = toDayNumber(fromKey);
  const b = toDayNumber(toKey);
  if (a === null || b === null) return null;
  return b - a;
}

/** key 로부터 n일 뒤(음수면 이전)의 dateKey */
export function addDays(key, n) {
  const p = parseDateKey(key);
  if (!p) return null;
  return toDateKey(new Date(p.year, p.month - 1, p.day + n));
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function monthKeyOf(dateKey) {
  return dateKey.slice(0, 7);
}

/** 'YYYY-MM' 이 유효한지 */
export function isValidMonthKey(key) {
  return typeof key === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
}

/** 'YYYY-MM' → { year, month } */
export function parseMonthKey(key) {
  if (!isValidMonthKey(key)) return null;
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/** 'YYYY-MM' 로부터 n개월 이동 */
export function addMonths(monthKey, n) {
  const p = parseMonthKey(monthKey);
  if (!p) return null;
  const d = new Date(p.year, p.month - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 해당 월의 일수 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 해당 월 1일의 요일 (0=일요일) */
export function firstWeekdayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/** 윤년 포함 연간 일수 */
export function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** 그 해의 몇 번째 날인지 (1월 1일 = 1) */
export function dayOfYear(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return null;
  return daysBetween(`${p.year}-01-01`, dateKey) + 1;
}

/** 연간 간트 가로 위치용: 그 해 안에서의 진행 비율 0~1 */
export function yearFraction(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return null;
  return (dayOfYear(dateKey) - 1) / daysInYear(p.year);
}

// ─── 표시용 포맷 ───────────────────────────────────────────

/** '9월 18일' */
export function formatMonthDay(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey;
  return `${p.month}월 ${p.day}일`;
}

/** '2026년 9월 18일 (금)' */
export function formatFullDate(dateKey) {
  const p = parseDateKey(dateKey);
  if (!p) return dateKey;
  const w = WEEKDAY_LABELS[new Date(p.year, p.month - 1, p.day).getDay()];
  return `${p.year}년 ${p.month}월 ${p.day}일 (${w})`;
}

/** '2026년 9월' */
export function formatMonthLabel(monthKey) {
  const p = parseMonthKey(monthKey);
  if (!p) return monthKey;
  return `${p.year}년 ${p.month}월`;
}

/** '오늘' / '어제' / 'N일 전' / 'N일 후' */
export function formatRelativeDay(dateKey, referenceKey = todayKey()) {
  const diff = daysBetween(dateKey, referenceKey);
  if (diff === null) return dateKey;
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === -1) return '내일';
  return diff > 0 ? `${diff}일 전` : `${-diff}일 후`;
}

// ─── 마감일 ────────────────────────────────────────────────
//
// 마감(deadline)은 Subject/Block 의 선택 필드이고 dateKey 와 같은 'YYYY-MM-DD' 문자열이다.
// D-day 계산·정렬은 전부 여기 두 함수만 거친다 — 화면마다 따로 계산하면
// new Date('YYYY-MM-DD') 의 UTC 해석 같은 하루 어긋남이 어딘가에 다시 숨어든다.

/**
 * 마감까지 남은 날 → D-day 표시 정보. 마감이 없거나 형식이 틀리면 null.
 *
 * 오늘은 로컬 날짜(todayKey)이고, 차이는 daysBetween 이 날짜 숫자끼리 뺀다.
 *   'D-5' (5일 남음) · 'D-day' (오늘) · 'D+2(지남)' (이틀 지남)
 *
 * @returns {{ days: number, overdue: boolean, label: string } | null}
 */
export function deadlineInfo(deadline, referenceKey = todayKey()) {
  if (!isValidDateKey(deadline)) return null;
  const days = daysBetween(referenceKey, deadline);
  if (days === null) return null;
  const label = days > 0 ? `D-${days}` : days === 0 ? 'D-day' : `D+${-days}(지남)`;
  return { days, overdue: days < 0, label };
}

/**
 * 마감 모아 보기의 묶음 — 'overdue'(지남) · 'thisWeek' · 'nextWeek' · 'later'. 마감이 없으면 null.
 *
 * 주는 캘린더와 같이 **일요일에 시작**한다. 오늘이 목요일이면 이번 주는 토요일까지 사흘 남는다.
 * (오늘부터 7일씩 끊으면 캘린더의 줄과 '이번 주'가 어긋난다)
 */
export function deadlineBucket(deadline, referenceKey = todayKey()) {
  const info = deadlineInfo(deadline, referenceKey);
  if (!info) return null;
  if (info.overdue) return 'overdue';
  const leftThisWeek = 6 - dateKeyToDate(referenceKey).getDay(); // 오늘 ~ 이번 주 토요일
  if (info.days <= leftThisWeek) return 'thisWeek';
  if (info.days <= leftThisWeek + 7) return 'nextWeek';
  return 'later';
}

/** 마감일순 정렬 비교 함수 — 이른 마감이 앞, 마감이 없는(또는 읽을 수 없는) 항목은 맨 뒤 */
export function compareDeadline(a, b) {
  const ka = isValidDateKey(a) ? a : null;
  const kb = isValidDateKey(b) ? b : null;
  if (ka === kb) return 0;
  if (ka === null) return 1;
  if (kb === null) return -1;
  return ka < kb ? -1 : 1;
}

/** 파일명 중복 방지용 시각 접미사 'HHmm' */
export function timeSuffix(date = new Date()) {
  return `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}
