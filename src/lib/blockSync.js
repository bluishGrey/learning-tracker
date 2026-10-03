/**
 * 블록 정보 동기화 규칙 검사 — 기록 가져오기에 함께 온 ---BLOCK--- 를 미리보기에서 짚어 준다.
 *
 * claude.ai 쪽 지침(docs/CLAUDE_AI_GUIDE.md, 스킬)은 기록을 정리할 때마다 ENTRY 바로 뒤에
 * 그 블록의 BLOCK 을 함께 내고, 다음을 지키도록 정해 두었다.
 *   - 과목·블록 이름은 ENTRY 와 글자 하나까지 같게
 *   - 진행률은 방금 만든 ENTRY 의 진행률과 같은 값
 *   - 아는 항목만 적는다. 적히지 않은 항목은 트래커가 그대로 둔다. 지울 때만 '(지움)'
 *
 * 여기서는 그 약속이 어긋났을 때 **경고만** 한다. 막지는 않는다 — 이름은 공백·대소문자를
 * 무시하고 이미 맞춰 읽었고, 지우는 것도 일부러일 수 있다. 다만 모르고 지나가면 기록과 다른
 * 숫자가 남거나 그림이 사라지므로, 반영 버튼을 누르기 전에 보이게 한다.
 * 계산은 하지 않는다 — 숫자는 비교만 한다.
 */

/**
 * @param {object}   args
 * @param {Array<{ date: string, subjectName: string, blockName: string, progressPercent: number|null }>} args.entries
 *        같은 텍스트의 ENTRY 값들 (텍스트에 나온 순서)
 * @param {object|null} args.block   함께 온 BLOCK 값 (없으면 null)
 * @param {object|null} args.current 지금 트래커에 있는 그 블록
 * @returns {string[]}
 */
export function blockSyncWarnings({ entries, block, current }) {
  if (!block) {
    return ['이번 텍스트에 블록 정보(---BLOCK---)가 없습니다. 블록 정보는 그대로 두고 기록만 가져옵니다.'];
  }

  const warnings = [];

  // ─ 이름: 글자 하나까지 같은가 (읽기는 이미 공백·대소문자 무시로 맞췄다) ─
  const differs = entries.find(
    (e) =>
      String(e.subjectName ?? '').trim() !== String(block.subjectName ?? '').trim() ||
      String(e.blockName ?? '').trim() !== String(block.blockName ?? '').trim()
  );
  if (differs) {
    warnings.push(
      `블록 정보의 이름 '${block.subjectName} / ${block.blockName}' 이(가) 기록의 '${differs.subjectName} / ${differs.blockName}' 와 글자가 다릅니다. 같은 블록으로 읽었지만, 글자까지 똑같이 적도록 claude.ai 에 알려 주세요.`
    );
  }

  // ─ 진행률: 기록(가장 늦은 날짜, 같은 날이면 텍스트에서 뒤쪽)의 값과 같은가 ─
  let ref = null;
  for (const e of entries) {
    if (e.progressPercent == null) continue;
    if (!ref || e.date >= ref.date) ref = e;
  }
  if (ref) {
    if (block.progressPercent === undefined) {
      warnings.push(
        `블록 정보에 진행률이 없어 블록 진행률은 그대로 둡니다. 기록의 진행률은 ${ref.progressPercent}% 입니다.`
      );
    } else if (block.progressPercent === null) {
      warnings.push(`블록 정보가 진행률을 '(지움)'으로 적어 블록 진행률이 지워집니다. 기록의 진행률은 ${ref.progressPercent}% 입니다.`);
    } else if (Number(block.progressPercent) !== Number(ref.progressPercent)) {
      warnings.push(
        `블록 정보의 진행률(${block.progressPercent}%)이 기록의 진행률(${ref.progressPercent}%, ${ref.date})과 다릅니다.`
      );
    }
  }

  // ─ '(지움)': 지금 값이 있는데 지우라고 적었으면 짚어 준다 (빠진 항목은 그대로 두므로 경고하지 않는다) ─
  const clearing = [];
  if (String(current?.diagramCode ?? '').trim() && block.diagramCode === '') clearing.push('다이어그램');
  if (String(current?.svgCode ?? '').trim() && block.svgCode === '') clearing.push('SVG');
  if (clearing.length > 0) {
    warnings.push(`블록 정보가 ${clearing.join(' · ')}을(를) '(지움)'으로 적어, 지금 있는 ${clearing.join(' · ')}이(가) 지워집니다.`);
  }

  return warnings;
}
