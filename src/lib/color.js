/**
 * 색상 규칙.
 *
 * 설계 원칙: Subject 의 Hue 는 한 번 정해지면 절대 변하지 않는다.
 * 채도(70%)와 명도(50%)도 고정이다. 변하는 것은 알파 하나뿐이다.
 *
 * "7일 이상 미활동 시 무채색"은 채도를 낮춰서가 아니라, 회색 배경판 위에
 * 색 레이어를 알파로 겹쳐서 만든다. 알파가 0이 되면 아래의 회색이 그대로
 * 드러나므로 결과적으로 무채색이 되지만, 색조 자체는 건드리지 않는다.
 *
 *   [ 위 ] hsl(H 70% 50% / α)   ← H 는 불변
 *   [ 아래 ] INACTIVE_GRAY       ← 항상 깔려 있음
 */

/** 골든 앵글. 순차 배정 시 색이 최대한 고르게 퍼진다. */
export const GOLDEN_ANGLE = 137.5;

export const SUBJECT_SATURATION = 70;
export const SUBJECT_LIGHTNESS = 50;

/** 색 레이어 아래에 항상 깔리는 회색 배경판 */
export const INACTIVE_GRAY = 'hsl(0 0% 72%)';

/**
 * 간트 밀도 → 알파 변환 곡선의 지수.
 * 1보다 크면 저활동 구간은 완만하게, 고활동 구간으로 갈수록 급격히 진해진다.
 * 취향에 따라 이 값 하나만 조절하면 된다. (1.0 = 선형, 클수록 대비 강함)
 */
export const DENSITY_EXPONENT = 1.8;
export const DENSITY_MIN_ALPHA = 0.2;

/** 같은 색으로 취급할 hue 오차 (부동소수점 누적 대비) */
const HUE_EPSILON = 0.5;

/** 순번 → hue. 0번째가 0도, 이후 137.5도씩 회전. */
export function hueForIndex(index) {
  return (((index * GOLDEN_ANGLE) % 360) + 360) % 360;
}

/** hsl 문자열 생성. alpha 를 생략하면 완전 불투명. */
export function subjectColor(hue, alpha = 1) {
  const a = clamp01(alpha);
  return `hsl(${round2(hue)} ${SUBJECT_SATURATION}% ${SUBJECT_LIGHTNESS}% / ${round3(a)})`;
}

/**
 * 활성도 알파. 마지막 활동일로부터 며칠 지났는지로만 결정한다.
 *
 * - 오늘 활동      → 1
 * - D일 이상 미활동 → 0 (배경 회색이 그대로 드러남)
 * - 활동 기록 없음  → 0
 *
 * 캘린더에는 쓰지 않는다. 캘린더는 "그날 뭘 했나"를 보는 화면이라
 * 활성도 개념이 필요 없고, 점은 항상 불투명하게 찍는다.
 * 이 값은 과목 목록 카드와 간트 차트의 과목 라벨에만 적용된다.
 */
export function activityAlpha(daysSinceLastActivity, inactivityDays) {
  if (daysSinceLastActivity == null) return 0;
  const d = Math.max(0, daysSinceLastActivity);
  const span = Number(inactivityDays);
  if (!Number.isFinite(span) || span <= 0) return d === 0 ? 1 : 0;
  return clamp01(1 - Math.min(d, span) / span);
}

/**
 * 회색 배경판 + 색 레이어를 한 요소에 합성한 인라인 스타일.
 *
 * background-color 로 회색을 깔고, 그 위에 알파를 가진 단색 gradient 를 얹는다.
 * alpha 가 0이 되면 아래 회색이 그대로 드러나 무채색이 된다 —
 * 채도를 건드리지 않고 무채색을 만드는 방법이다.
 */
export function layeredBackground(hue, alpha = 1) {
  const layer = subjectColor(hue, alpha);
  return {
    backgroundColor: 'var(--inactive-gray)',
    backgroundImage: `linear-gradient(${layer}, ${layer})`,
  };
}

/**
 * 간트 막대의 밀도 알파.
 * normalized 는 전체 과목 중 최대 밀도로 나눈 0~1 값.
 */
export function densityAlpha(normalized) {
  const n = clamp01(normalized);
  const eased = Math.pow(n, DENSITY_EXPONENT);
  return DENSITY_MIN_ALPHA + (1 - DENSITY_MIN_ALPHA) * eased;
}

/** 두 hue 가 사실상 같은 색인지 (색상환의 원형 거리로 비교) */
export function isSameHue(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const raw = Math.abs(a - b) % 360;
  const distance = raw > 180 ? 360 - raw : raw;
  return distance < HUE_EPSILON;
}

/**
 * 이미 쓰이고 있는 hue 들과 겹치지 않는 다음 순번을 찾는다.
 * 병합 후 색 충돌을 해소할 때 쓴다. (무한루프 방지를 위해 상한을 둔다)
 */
export function nextFreeHueIndex(usedHues, startIndex = 0) {
  const limit = startIndex + 1000;
  for (let i = startIndex; i < limit; i += 1) {
    const hue = hueForIndex(i);
    if (!usedHues.some((used) => isSameHue(used, hue))) {
      return { index: i, hue };
    }
  }
  return { index: startIndex, hue: hueForIndex(startIndex) };
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;
