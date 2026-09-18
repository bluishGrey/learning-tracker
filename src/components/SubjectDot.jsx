import { layeredBackground } from '../lib/color.js';

/**
 * 과목 색 점 / 색 띠.
 *
 * alpha 를 넘기지 않으면 불투명이다. 캘린더 점은 항상 불투명하게 찍고,
 * 활성도 알파는 과목 목록과 간트 라벨에서만 넘긴다.
 */
export default function SubjectDot({ hue, alpha = 1, size = 10, title, className = '' }) {
  return (
    <span
      className={`subject-dot ${className}`}
      style={{ ...layeredBackground(hue, alpha), width: size, height: size }}
      title={title}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
