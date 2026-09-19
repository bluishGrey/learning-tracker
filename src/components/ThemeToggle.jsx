import { useEffect, useState } from 'react';
import {
  THEME_MODES,
  THEME_LABELS,
  readThemeMode,
  writeThemeMode,
  resolveTheme,
  applyTheme,
  watchSystemTheme,
} from '../lib/theme.js';

/**
 * 시스템 / 주간 / 야간 선택.
 *
 * 세 칸을 한 번에 보여주는 쪽을 택했다. 한 버튼을 눌러 돌려 쓰는 방식이면
 * 지금 무엇이 켜져 있는지 보이지 않고, 원하는 상태까지 몇 번 눌러야 하는지도
 * 눌러 봐야 안다.
 *
 * '시스템'이 따로 있는 이유: 라이트/다크 둘만 두면 시스템을 따르던 상태로
 * 되돌아갈 방법이 없어진다. 한 번 고정하면 영영 고정이다.
 *
 * 아이콘을 붙이지 않는다. ☀/☾ 같은 기호는 글꼴이 없는 PC에서 두부(□)가 되는데,
 * 이 앱은 글꼴을 고를 수 없는 공용 PC에서도 써야 한다. '시스템·주간·야간' 세 글자면
 * 아이콘 없이도 충분히 구별된다.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState(readThemeMode);

  // 고른 값을 화면에 반영한다. (첫 페인트는 index.html 의 인라인 스크립트가
  // 이미 끝냈으므로, 여기서는 사용자가 바꿨을 때만 실제로 달라진다)
  useEffect(() => {
    applyTheme(resolveTheme(mode));
  }, [mode]);

  // 시스템을 따르기로 했을 때만 OS 설정 변화를 쫓아간다.
  // 고정해 둔 사용자에게는 따라갈 이유가 없다.
  useEffect(() => {
    if (mode !== 'system') return undefined;
    return watchSystemTheme((theme) => applyTheme(theme));
  }, [mode]);

  const choose = (next) => {
    setMode(next);
    writeThemeMode(next);
  };

  return (
    <div className="themetoggle" role="group" aria-label="테마">
      {THEME_MODES.map((value) => (
        <button
          key={value}
          type="button"
          className={`themetoggle__btn${mode === value ? ' themetoggle__btn--on' : ''}`}
          onClick={() => choose(value)}
          aria-pressed={mode === value}
        >
          {THEME_LABELS[value]}
        </button>
      ))}
    </div>
  );
}
