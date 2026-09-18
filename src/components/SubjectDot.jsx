import { layeredBackground } from '../lib/color.js';

/**
 * 과목 색 점.
 *
 * subject 를 통째로 받는다 — 사용자 지정 색(customColor)이 있으면 그것을,
 * 없으면 자동 배정된 colorHue 를 쓰는 판단이 한곳에 모여 있어야 하기 때문이다.
 *
 * alpha 를 넘기지 않으면 불투명이다. 캘린더 점은 항상 불투명하게 찍고,
 * 활성도 알파는 과목 목록과 간트 라벨에서만 넘긴다.
 */
export default function SubjectDot({ subject, alpha = 1, size = 10, title, className = '' }) {
  return (
    <span
      className={`subject-dot ${className}`}
      style={{ ...layeredBackground(subject, alpha), width: size, height: size }}
      title={title}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
    />
  );
}
