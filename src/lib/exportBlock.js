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
 *   --- 참고 다이어그램 ---
 *   (diagramCode 가 있는 기록들을 날짜순으로 나열)
 *
 *   --- 참고 SVG ---
 *   (svgCode 가 있는 기록들을 날짜순으로 나열)
 *
 * 태그가 없는 기록은 태그 줄을 아예 비운다. 빈 줄을 남기면 붙여넣었을 때
 * 기록 사이의 구분이 흐려진다.
 *
 * 그림 두 종류를 본문이 아니라 뒤쪽 구획으로 몰아 두는 이유: 코드가 길어서
 * 기록 사이사이에 끼면 "무슨 공부를 했는지"의 흐름이 끊긴다.
 * 해당 코드가 있는 기록이 하나도 없으면 그 구획 자체를 만들지 않는다.
 *
 * 이 형식은 claude.ai 에 붙여넣는 **입력**이다. 돌려받는 답은
 * lib/structuredText.js 의 ---ENTRY--- 형식으로 가져온다.
 */

export const DIAGRAM_SECTION_HEADER = '--- 참고 다이어그램 ---';
export const SVG_SECTION_HEADER = '--- 참고 SVG ---';

export function buildBlockExportText(entries) {
  const blocks = entries.map((entry) => {
    const lines = [entry.date];
    if (entry.tags?.length > 0) lines.push(entry.tags.join(', '));
    lines.push(entry.content ?? '');
    return lines.join('\n').trimEnd();
  });

  let text = blocks.join('\n\n');
  text += section(entries, 'diagramCode', DIAGRAM_SECTION_HEADER, true);
  text += section(entries, 'svgCode', SVG_SECTION_HEADER, false);

  return `${text}\n`;
}

/**
 * 그림 구획 하나. 다이어그램은 코드펜스로 감싼다 —
 * claude.ai 가 어느 문법으로 읽어야 하는지 바로 알아보게 하기 위함이다.
 */
function section(entries, field, header, fenced) {
  const rows = entries.filter((entry) => entry[field]?.trim());
  if (rows.length === 0) return '';

  const parts = rows.map((entry) => {
    const code = entry[field].trim();
    return fenced
      ? `${entry.date}\n\`\`\`mermaid\n${code}\n\`\`\``
      : `${entry.date}\n${code}`;
  });

  return `\n\n${header}\n${parts.join('\n\n')}`;
}

/** 복사 결과 안내 문구용 요약 */
export function summarizeBlockExport(entries) {
  const counts = [];
  const diagrams = entries.filter((entry) => entry.diagramCode?.trim()).length;
  const svgs = entries.filter((entry) => entry.svgCode?.trim()).length;
  if (diagrams > 0) counts.push(`다이어그램 ${diagrams}개`);
  if (svgs > 0) counts.push(`SVG ${svgs}개`);

  return counts.length > 0
    ? `기록 ${entries.length}개 (${counts.join(', ')} 포함)`
    : `기록 ${entries.length}개`;
}
