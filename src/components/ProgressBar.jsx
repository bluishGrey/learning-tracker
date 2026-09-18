import { layeredBackground } from '../lib/color.js';

/**
 * 진도율 막대. 색은 과목 색, 채움 비율은 진도율.
 * alpha 는 활성도라서 오래 손대지 않은 과목은 막대도 흐려진다.
 */
export default function ProgressBar({ percent, subject, alpha = 1, label }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="progress__fill"
        style={{ ...layeredBackground(subject, alpha), width: `${percent}%` }}
      />
    </div>
  );
}
