import Sheet from './Sheet.jsx';
import { SHORTCUTS, shortcutKeys, isMac } from '../lib/hotkeys.js';

/**
 * 단축키 안내.
 *
 * 단축키는 **아무도 모르면 없는 것과 같다.** 사이드바 바닥의 '단축키' 버튼과
 * `?` 키 두 경로로 열린다.
 *
 * 목록은 lib/hotkeys.js 의 SHORTCUTS 하나만 본다. 안내와 실제 동작이 다른 곳을
 * 보면 언젠가 "적힌 대로 눌렀는데 안 되는" 상태가 된다.
 */
export default function ShortcutHelp({ open, onClose }) {
  const mac = isMac();

  return (
    <Sheet
      open={open}
      title="단축키"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          닫기
        </button>
      }
    >
      <dl className="shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <div className="shortcuts__row" key={shortcut.id}>
            <dt className="shortcuts__keys">
              {shortcutKeys(shortcut, mac).map((key) => (
                <kbd className="kbd" key={key}>
                  {key}
                </kbd>
              ))}
            </dt>
            <dd className="shortcuts__label">
              {shortcut.label}
              {shortcut.note && <span className="shortcuts__note">{shortcut.note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <p className="field__hint shortcuts__foot">
        글을 쓰는 중(입력칸·textarea 안)에는 단독 키 단축키가 동작하지 않습니다. 쓰던 글자가
        단축키로 먹히면 안 되기 때문입니다.
      </p>
    </Sheet>
  );
}
