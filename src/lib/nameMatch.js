/**
 * 가져오기에서 과목·블록 이름을 맞춰 보는 규칙 — 한곳에 둔다.
 *
 * claude.ai 가 돌려준 텍스트는 이름이 미묘하게 흔들린다. 'Week 5' 가 'week 5',
 * 'Week  5', 'Week5' 로 오는 식이다. 정확히 같은 이름만 받으면 그때마다 가져오기가
 * 멈추고, 블록을 만들어 주는 화면에서는 같은 블록이 둘로 쪼개진다.
 *
 * 그래서 두 단계로 찾는다.
 *   1. 앞뒤 공백만 걷어낸 **정확한 이름**이 하나 있으면 그것.
 *   2. 없으면 공백을 전부 빼고 대소문자를 무시한 **정규화 이름**으로 다시 찾는다.
 * 정규화로 찾은 후보가 둘 이상이면 고르지 않고 모호하다고 알린다 —
 * 아무거나 골라 넣으면 엉뚱한 블록이 조용히 오염된다.
 */

/** 비교용 키: 유니코드 정규화(NFC) + 공백 제거 + 소문자 */
export function nameKey(name) {
  return String(name ?? '')
    .normalize('NFC')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * @template T
 * @param {T[]} items
 * @param {string} wanted
 * @param {(item: T) => string} nameOf
 * @returns {{ match: T|null, ambiguous: T[], loose: boolean }}
 *   loose = 정확히 같지는 않고 정규화로 찾았다 (화면에서 알려줄 때 쓴다)
 */
export function findByName(items, wanted, nameOf = (item) => item.name) {
  const exactWanted = String(wanted ?? '').trim();
  const exact = items.filter((item) => String(nameOf(item) ?? '').trim() === exactWanted);
  if (exact.length === 1) return { match: exact[0], ambiguous: [], loose: false };
  if (exact.length > 1) return { match: null, ambiguous: exact, loose: false };

  const key = nameKey(wanted);
  if (!key) return { match: null, ambiguous: [], loose: false };
  const loose = items.filter((item) => nameKey(nameOf(item)) === key);
  if (loose.length === 1) return { match: loose[0], ambiguous: [], loose: true };
  return { match: null, ambiguous: loose, loose: loose.length > 0 };
}
