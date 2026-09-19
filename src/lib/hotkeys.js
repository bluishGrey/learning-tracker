/**
 * 전역 단축키.
 *
 * ─ 왜 조합키인가 ──────────────────────────────────────────
 *
 * 알파벳 단독 키는 쓰지 않는다. 이 앱은 화면 대부분이 글을 쓰는 자리라,
 * 단독 키를 전역에서 가로채면 기록을 쓰다가 엉뚱한 화면으로 튄다.
 *
 * 새 기록은 **Ctrl(⌘) + Alt(⌥) + N** 이다. Ctrl+N 은 브라우저의 새 창,
 * Ctrl+Shift+N 은 시크릿 창으로 이미 예약되어 있어 가로챌 수 없다.
 * (가로채도 브라우저가 먼저 먹는다)
 *
 * 글자 키는 `event.code` 로 본다. Mac 에서 Option+N 은 글자가 아니라
 * 조합용 데드키라 `event.key` 가 'n' 이 아니다. 자판 배열과 무관한 물리 키
 * 위치를 봐야 한다.
 *
 * ─ 단독 키(/ 와 ?)의 조건 ─────────────────────────────────
 *
 * 두 키는 **입력 중이 아닐 때만** 동작한다. 이 판단을 한 곳(isTypingTarget)에
 * 모아 둔 것이 이 파일의 핵심이다. 리스너마다 각자 판단하게 두면 언젠가
 * 한 군데가 빠지고, 그러면 사용자는 '/' 를 칠 수 없는 입력칸을 만나게 된다.
 */

/** 글자를 받는 자리에 포커스가 있는가 */
export function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;

  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;

  if (tag === 'INPUT') {
    // 체크박스·버튼류는 글자를 받지 않으므로 단축키를 막을 이유가 없다
    const type = String(el.type ?? 'text').toLowerCase();
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
      type
    );
  }

  // 열린 대화상자 안이면 그 창의 맥락이 우선이다 (Esc 로 닫는 게 먼저다)
  return Boolean(el.closest?.('[role="dialog"]'));
}

/** 조합키가 하나도 눌리지 않았는가 (단독 키 판정용) */
export function isBareKey(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey;
}

/** Ctrl(Windows/Linux) 또는 ⌘(Mac) */
export function hasMod(event) {
  return event.ctrlKey || event.metaKey;
}

/** 안내 화면과 실제 처리가 같은 목록을 보도록 한곳에 둔다 */
export const SHORTCUTS = [
  {
    id: 'new-entry',
    keys: ['Ctrl', 'Alt', 'N'],
    macKeys: ['⌘', '⌥', 'N'],
    label: '새 기록 쓰기',
    note: 'Ctrl+N · Ctrl+Shift+N 은 브라우저가 이미 쓰고 있어 피했습니다',
  },
  {
    id: 'search',
    keys: ['/'],
    label: '검색창으로 이동',
    note: '글을 쓰는 중에는 동작하지 않습니다',
  },
  {
    id: 'sidebar',
    keys: ['Ctrl', 'B'],
    macKeys: ['⌘', 'B'],
    label: '사이드바 열기 / 닫기',
  },
  {
    id: 'help',
    keys: ['?'],
    label: '이 안내 열기',
    note: '글을 쓰는 중에는 동작하지 않습니다',
  },
  {
    id: 'close',
    keys: ['Esc'],
    label: '열린 창 닫기',
  },
];

/** Mac 이면 ⌘/⌥ 로 보여준다 — 안내에 Ctrl 이라 적혀 있으면 Mac 사용자는 눌러도 안 된다 */
export function isMac() {
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
}

export function shortcutKeys(shortcut, mac = isMac()) {
  return mac && shortcut.macKeys ? shortcut.macKeys : shortcut.keys;
}
