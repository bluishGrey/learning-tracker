/**
 * Entry 의 표시용 제목.
 *
 * entry.title 이 있으면 그것을 쓰고, 비어 있으면 content 첫 줄에서 뽑아낸다.
 * (스키마에는 title 이 nullable 로 존재하고, 편집 화면에서 자동 추출값을
 *  기본값으로 채워주되 사용자가 직접 고칠 수 있다)
 */

const MAX_LENGTH = 40;

/** content 첫 줄에서 마크다운 기호를 떼고 제목 후보를 만든다 */
export function deriveTitleFromContent(content) {
  if (typeof content !== 'string') return '';

  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !isFenceOrRule(line));

  if (!firstLine) return '';

  const cleaned = firstLine
    .replace(/^#{1,6}\s+/, '') // 헤딩
    .replace(/^>\s*/, '') // 인용
    .replace(/^[-*+]\s+(\[[ xX]\]\s*)?/, '') // 리스트 / 체크박스
    .replace(/^\d+\.\s+/, '') // 번호 목록
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 이미지 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 → 텍스트
    .replace(/`([^`]+)`/g, '$1') // 인라인 코드
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // 굵게
    .replace(/(\*|_)(.*?)\1/g, '$2') // 기울임
    .replace(/~~(.*?)~~/g, '$1') // 취소선
    .trim();

  return truncate(cleaned, MAX_LENGTH);
}

/** 목록·breadcrumb 에 실제로 찍히는 최종 제목 */
export function entryTitle(entry) {
  if (!entry) return '';

  const explicit = typeof entry.title === 'string' ? entry.title.trim() : '';
  if (explicit) return truncate(explicit, MAX_LENGTH);

  const derived = deriveTitleFromContent(entry.content);
  if (derived) return derived;

  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    return truncate(String(entry.tags[0]), MAX_LENGTH);
  }

  return entry.date || '(제목 없음)';
}

function isFenceOrRule(line) {
  return /^```/.test(line) || /^(-{3,}|\*{3,}|_{3,})$/.test(line);
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
