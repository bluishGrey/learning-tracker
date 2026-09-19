/**
 * 테마 — 시스템 / 주간 / 야간.
 *
 * 기존에는 `prefers-color-scheme` 하나로만 갈렸다. 시스템이 라이트면 라이트,
 * 아니면 다크. 사용자가 끼어들 자리가 없었다.
 *
 * ─ 왜 학습 데이터와 따로 보관하나 ──────────────────────────
 *
 * 이 값은 `settings` 가 아니라 **별도 localStorage 키**에 둔다. 이유 셋:
 *
 *  1. 화면이 뜨기 전에 정해져야 한다. store 가 부팅된 뒤에 정하면 잘못된 색이
 *     한 번 번쩍인다. index.html 의 인라인 스크립트가 첫 페인트 전에 읽는다.
 *  2. 백업 JSON 에 섞이면 안 된다. 한 PC에서 야간으로 쓰던 설정이 다른 PC로
 *     따라가 덮어쓰는 건 학습 기록 동기화와 아무 상관이 없다.
 *  3. 브라우저마다 다른 게 자연스러운 값이다. 기록은 기기를 따라다녀야 하지만
 *     화면 밝기 취향은 그 화면의 것이다.
 *
 * ─ 해석한 값만 DOM 에 쓴다 ─────────────────────────────────
 *
 * `data-theme` 에는 'system' 을 쓰지 않는다. 항상 'light' 나 'dark' 중 하나로
 * **해석해서** 쓴다. 그래야 CSS 가 미디어 쿼리 없이 한 가지 규칙만 보면 되고,
 * mermaid 처럼 색을 직접 읽어 가는 쪽도 이 속성 하나만 보면 된다.
 */

export const THEME_MODES = ['system', 'light', 'dark'];

/** index.html 의 인라인 스크립트도 이 키를 읽는다. 한쪽만 고치지 말 것. */
export const THEME_STORAGE_KEY = 'learning-tracker:theme';

export const THEME_LABELS = {
  system: '시스템',
  light: '주간',
  dark: '야간',
};

/** 저장된 선택. 없거나 망가졌으면 시스템을 따른다. */
export function readThemeMode() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(value) ? value : 'system';
  } catch {
    // 시크릿 모드 등에서 저장소가 막혀 있어도 테마는 동작해야 한다
    return 'system';
  }
}

export function writeThemeMode(mode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // 저장만 실패한 것이고 이번 세션의 화면은 이미 바뀌었다. 조용히 넘어간다.
  }
}

/** 지금 이 브라우저의 시스템 설정 */
export function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** 'system' 을 실제 색으로 풀어 준다 */
export function resolveTheme(mode) {
  return mode === 'system' ? systemTheme() : mode;
}

/** 해석된 값을 문서에 적용한다 (CSS 와 mermaid 가 이것만 본다) */
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

/**
 * 시스템 설정이 바뀌는 것을 지켜본다.
 * 'system' 모드일 때만 구독하면 된다 — 고정해 둔 사용자에게는 바뀔 일이 없다.
 *
 * @returns {Function} 구독 해제
 */
export function watchSystemTheme(onChange) {
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  if (!mq?.addEventListener) return () => {};

  const handle = () => onChange(systemTheme());
  mq.addEventListener('change', handle);
  return () => mq.removeEventListener('change', handle);
}
