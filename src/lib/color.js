/**
 * 색상 규칙.
 *
 * 과목 색은 두 갈래다.
 *   1. 자동 배정 — colorHue. 골든 앵글로 순차 배정되며 한 번 정해지면 변하지 않는다.
 *   2. 사용자 지정 — customColor(hex). 있으면 렌더링에서 이것이 우선한다.
 *
 * customColor 가 있어도 colorHue 는 그대로 남겨둔다. 골든 앵글 순서와 색 충돌
 * 판정은 계속 colorHue 로만 하므로, 직접 고른 색이 자동 배정 순서를 흐트러뜨리지
 * 않는다.
 *
 * 활성도는 어느 쪽이든 알파 하나로만 표현한다. 회색 배경판 위에 색 레이어를
 * 얹어서, 알파가 0이 되면 아래 회색이 드러나 무채색이 된다.
 *
 *   [ 위 ]   과목색 / 알파 α
 *   [ 아래 ] INACTIVE_GRAY
 */

/** 골든 앵글. 순차 배정 시 색이 최대한 고르게 퍼진다. */
export const GOLDEN_ANGLE = 137.5;

/**
 * 첫 과목의 hue.
 *
 * 0도(빨강)에서 시작하면 첫 과목이 곧바로 UI 포인트 컬러(테라코타, 약 15도)와
 * 헷갈린다. 파랑 계열에서 출발해 충분히 떨어뜨린다.
 */
export const HUE_START = 205;

/**
 * UI 포인트 컬러가 차지한 hue — Terracotta #c96442 ≈ 15도, Coral #d97757 ≈ 15도.
 * 이 근처는 과목 색으로 배정하지 않는다. 버튼·강조 요소와 구별되지 않기 때문이다.
 */
export const RESERVED_HUE = 15;
export const RESERVED_HUE_RADIUS = 22;

export const SUBJECT_SATURATION = 70;
export const SUBJECT_LIGHTNESS = 50;

/** 색 레이어 아래에 항상 깔리는 회색 배경판 */
export const INACTIVE_GRAY = 'var(--inactive-gray)';

/**
 * 간트 밀도 → 알파 변환 곡선의 지수.
 * 1보다 크면 저활동 구간은 완만하게, 고활동 구간으로 갈수록 급격히 진해진다.
 * 취향에 따라 이 값 하나만 조절하면 된다. (1.0 = 선형, 클수록 대비 강함)
 */
export const DENSITY_EXPONENT = 1.8;
export const DENSITY_MIN_ALPHA = 0.2;

/** 같은 색으로 취급할 hue 오차 (부동소수점 누적 대비) */
const HUE_EPSILON = 0.5;

/**
 * 색상 피커의 프리셋.
 * 테라코타 대역을 피하면서 서로 충분히 구별되는 색들로 골랐다.
 */
export const PRESET_COLORS = [
  { name: '블루', hex: '#3b82f6' },
  { name: '틸', hex: '#14b8a6' },
  { name: '그린', hex: '#22c55e' },
  { name: '라임', hex: '#84cc16' },
  { name: '옐로', hex: '#eab308' },
  { name: '퍼플', hex: '#a855f7' },
  { name: '마젠타', hex: '#ec4899' },
  { name: '인디고', hex: '#6366f1' },
  { name: '슬레이트', hex: '#94a3b8' },
];

// ─── hue 배정 ──────────────────────────────────────────────

/** 색상환 위의 두 hue 사이 거리 (0~180) */
export function hueDistance(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 180;
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** 두 hue 가 사실상 같은 색인지 */
export function isSameHue(a, b) {
  return hueDistance(a, b) < HUE_EPSILON;
}

/** UI 포인트 컬러와 헷갈리는 구간인지 */
export function isReservedHue(hue) {
  return hueDistance(hue, RESERVED_HUE) < RESERVED_HUE_RADIUS;
}

/** 순번 → hue. HUE_START 에서 시작해 137.5도씩 회전. */
export function hueForIndex(index) {
  return (((HUE_START + index * GOLDEN_ANGLE) % 360) + 360) % 360;
}

/**
 * 이미 쓰이고 있는 색과도, UI 포인트 컬러와도 겹치지 않는 다음 순번을 찾는다.
 * 과목 생성과 백업 병합 양쪽에서 쓴다. (무한루프 방지를 위해 상한을 둔다)
 */
export function nextFreeHueIndex(usedHues, startIndex = 0) {
  const limit = startIndex + 1000;
  for (let i = startIndex; i < limit; i += 1) {
    const hue = hueForIndex(i);
    if (isReservedHue(hue)) continue;
    if (!usedHues.some((used) => isSameHue(used, hue))) {
      return { index: i, hue };
    }
  }
  return { index: startIndex, hue: hueForIndex(startIndex) };
}

// ─── 색 문자열 ─────────────────────────────────────────────

/** 자동 배정 색 — 채도·명도는 고정이고 hue 와 알파만 변한다 */
export function subjectColor(hue, alpha = 1) {
  const a = clamp01(alpha);
  return `hsl(${round2(hue)} ${SUBJECT_SATURATION}% ${SUBJECT_LIGHTNESS}% / ${round3(a)})`;
}

/**
 * 과목의 실제 표시색.
 * customColor 가 있으면 그 색을, 없으면 자동 배정된 hue 를 쓴다.
 */
export function subjectPaint(subject, alpha = 1) {
  const custom = subject?.customColor;
  if (typeof custom === 'string' && custom.trim()) {
    const rgb = hexToRgb(custom);
    if (rgb) return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${round3(clamp01(alpha))})`;
  }
  return subjectColor(Number(subject?.colorHue) || 0, alpha);
}

/**
 * 회색 배경판 + 색 레이어를 한 요소에 합성한 인라인 스타일.
 *
 * background-color 로 회색을 깔고, 그 위에 알파를 가진 단색 gradient 를 얹는다.
 * 알파가 0이 되면 아래 회색이 그대로 드러나 무채색이 된다 —
 * 채도를 건드리지 않고 무채색을 만드는 방법이다.
 */
export function layeredBackground(subject, alpha = 1) {
  const layer = subjectPaint(subject, alpha);
  return {
    backgroundColor: INACTIVE_GRAY,
    backgroundImage: `linear-gradient(${layer}, ${layer})`,
  };
}

// ─── 알파 곡선 ─────────────────────────────────────────────

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
 * 간트 막대의 밀도 알파.
 * normalized 는 전체 과목 중 최대 밀도로 나눈 0~1 값.
 */
export function densityAlpha(normalized) {
  const n = clamp01(normalized);
  const eased = Math.pow(n, DENSITY_EXPONENT);
  return DENSITY_MIN_ALPHA + (1 - DENSITY_MIN_ALPHA) * eased;
}

// ─── hex 유틸 ──────────────────────────────────────────────

/** '#rgb' / '#rrggbb' → {r,g,b}. 형식이 아니면 null */
export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let body = m[1];
  if (body.length === 3) {
    body = body
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

/** 유효한 hex 색이면 '#rrggbb' 로 정규화, 아니면 null */
export function normalizeHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const to2 = (n) => n.toString(16).padStart(2, '0');
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

/** hue → '#rrggbb' (색상 피커의 기본값을 자동 배정 색으로 채울 때) */
export function hueToHex(hue) {
  const s = SUBJECT_SATURATION / 100;
  const l = SUBJECT_LIGHTNESS / 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to2 = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to2(f(0))}${to2(f(8))}${to2(f(4))}`;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

const round2 = (n) => Math.round(n * 100) / 100;
const round3 = (n) => Math.round(n * 1000) / 1000;
