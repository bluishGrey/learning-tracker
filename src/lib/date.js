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

/** 파일명 중복 방지용 시각 접미사 'HHmm' */
export function timeSuffix(date = new Date()) {
  return `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
}
