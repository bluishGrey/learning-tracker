/**
 * 블록 단위 텍스트 내보내기.
 *
 * 이 결과물은 claude.ai 같은 곳에 그대로 붙여넣어 쓰는 용도라,
 * 마크다운이나 JSON 으로 감싸지 않고 기록을 있는 그대로 이어 붙인다.
 *
 * 형식:
 *   날짜
 *   태그
 *   내용
 *
 *   날짜
 *   태그
 *   내용
 *
 *   --- 참고 SVG ---
 *   (svgCode 가 있는 기록들을 날짜순으로 나열)
 *
 * 태그가 없는 기록은 태그 줄을 아예 비운다. 빈 줄을 남기면 붙여넣었을 때
 * 기록 사이의 구분이 흐려진다.
 */

export const SVG_SECTION_HEADER = '--- 참고 SVG ---';

export function buildBlockExportText(entries) {
  const blocks = entries.map((entry) => {
    const lines = [entry.date];
    if (entry.tags?.length > 0) lines.push(entry.tags.join(', '));
    lines.push(entry.content ?? '');
    return lines.join('\n').trimEnd();
  });

  const withSvg = entries.filter((entry) => entry.svgCode?.trim());

  let text = blocks.join('\n\n');

  if (withSvg.length > 0) {
    const svgParts = withSvg.map((entry) => `${entry.date}\n${entry.svgCode.trim()}`);
    text += `\n\n${SVG_SECTION_HEADER}\n${svgParts.join('\n\n')}`;
  }

  return `${text}\n`;
}

/** 복사 결과 안내 문구용 요약 */
export function summarizeBlockExport(entries) {
  const svgCount = entries.filter((entry) => entry.svgCode?.trim()).length;
  return svgCount > 0
    ? `기록 ${entries.length}개 (SVG ${svgCount}개 포함)`
    : `기록 ${entries.length}개`;
}
