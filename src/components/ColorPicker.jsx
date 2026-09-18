import { useId } from 'react';
import { PRESET_COLORS, hueToHex, normalizeHex } from '../lib/color.js';

/**
 * 과목 색 선택.
 *
 * 기본값은 골든 앵글로 자동 배정된 색이고, 원하면 프리셋이나 색상 피커로 덮어쓴다.
 * '자동으로 되돌리기'를 누르면 customColor 가 null 이 되어 다시 자동 배정 색을 쓴다.
 *
 * @param {{ value: string|null, autoHue: number, onChange: (hex: string|null) => void }} props
 */
export default function ColorPicker({ value, autoHue, onChange }) {
  const inputId = useId();
  const autoHex = hueToHex(autoHue);
  const effective = value ?? autoHex;
  const isAuto = value === null;

  return (
    <div className="colorpicker">
      <div className="colorpicker__row">
        <span className="colorpicker__preview" style={{ background: effective }} aria-hidden="true" />
        <label className="btn btn--sm colorpicker__native" htmlFor={inputId}>
          직접 고르기
          <input
            id={inputId}
            type="color"
            value={effective}
            onChange={(e) => onChange(normalizeHex(e.target.value))}
            className="visually-hidden"
          />
        </label>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => onChange(null)}
          disabled={isAuto}
        >
          자동으로
        </button>
      </div>

      <div className="colorpicker__swatches" role="group" aria-label="프리셋 색상">
        <button
          type="button"
          className={`swatch swatch--auto${isAuto ? ' swatch--on' : ''}`}
          style={{ background: autoHex }}
          onClick={() => onChange(null)}
          title={`자동 배정 (hue ${Math.round(autoHue)}°)`}
          aria-pressed={isAuto}
        >
          <span className="swatch__label">자동</span>
        </button>

        {PRESET_COLORS.map((preset) => {
          const on = !isAuto && value?.toLowerCase() === preset.hex.toLowerCase();
          return (
            <button
              key={preset.hex}
              type="button"
              className={`swatch${on ? ' swatch--on' : ''}`}
              style={{ background: preset.hex }}
              onClick={() => onChange(preset.hex)}
              title={preset.name}
              aria-label={preset.name}
              aria-pressed={on}
            />
          );
        })}
      </div>

      <p className="field__hint">
        {isAuto
          ? `자동 배정 색을 씁니다 (hue ${Math.round(autoHue)}°). 골든 앵글로 다른 과목과 겹치지 않게 정해집니다.`
          : `직접 고른 색 ${value} 을 씁니다. 자동 배정 순서에는 영향을 주지 않습니다.`}
      </p>
    </div>
  );
}
