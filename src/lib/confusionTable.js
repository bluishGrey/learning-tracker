/**
 * 기록 본문의 '헷갈렸던 부분 정리' 표 → 행 목록.
 *
 * 저장은 하지 않는다. 표는 기록 본문(마크다운) 안에 그대로 있고, 검색·복습 카드가
 * 필요할 때마다 여기서 읽어낸다. 그래야 기록을 고치면 결과도 저절로 따라온다.
 *
 *   ## 헷갈렸던 부분 정리
 *
 *   | # | 헷갈린 것 | 정답 요약 | 키워드 |     ← 키워드 열은 없어도 된다 (3열 / 4열)
 *   |---|-----------|-----------|--------|
 *   | 1 | …         | …         | …      |
 *
 * 규칙
 *   - 제목 줄은 단계(#~######)와 앞뒤 공백을 가리지 않는다.
 *   - 제목 아래 **첫 번째 표**만 읽는다. 표보다 같거나 높은 단계의 다른 제목이 먼저 나오면 표가 없는 것.
 *   - 코드펜스(```) 안의 줄은 제목·표로 보지 않는다.
 *   - 열은 머리글 이름으로 찾고(헷갈린 것/정답·요약/키워드/#), 못 찾으면 자리로 정한다.
 *   - 형식이 어긋나도 오류를 내지 않는다. 읽을 수 있는 만큼만 돌려주고, 없으면 빈 배열.
 *
 * 반환하는 rowIndex 는 표 본문(tbody)에서 몇 번째 행인지(0부터)다. 기록 화면에서
 * 렌더링된 표의 같은 행을 찾아 스크롤할 때 그대로 쓴다.
 */

const HEADING_RE = /^(#{1,6})\s*헷갈렸던\s*부분\s*정리\s*#*\s*$/;
const ANY_HEADING_RE = /^(#{1,6})\s+\S/;
const SEPARATOR_CELL_RE = /^:?-{1,}:?$/;

/** @typedef {{ rowIndex: number, num: string, question: string, answer: string, keywords: string }} ConfusionRow */

/** 엔트리 객체 → 행 목록. 엔트리는 불변으로 다루므로 객체 자체를 키로 캐시한다. */
const cache = new WeakMap();

/** @returns {ConfusionRow[]} */
export function confusionRowsOf(entry) {
  if (!entry || typeof entry !== 'object') return [];
  const hit = cache.get(entry);
  if (hit && hit.content === entry.content) return hit.rows;
  const rows = parseConfusionRows(entry.content);
  cache.set(entry, { content: entry.content, rows });
  return rows;
}

/** @returns {ConfusionRow[]} */
export function parseConfusionRows(content) {
  if (typeof content !== 'string' || !content.includes('헷갈렸던')) return [];
  const lines = content.replace(/\r\n?/g, '\n').split('\n');

  let inFence = false;
  let level = 0;
  let i = 0;

  // 1) 제목 찾기
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const m = HEADING_RE.exec(line);
    if (m) {
      level = m[1].length;
      i += 1;
      break;
    }
  }
  if (level === 0) return [];

  // 2) 그 아래 첫 표 찾기
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line.startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const h = ANY_HEADING_RE.exec(line);
    if (h && h[1].length <= level) return [];
    if (line.startsWith('|') && isSeparator(lines[i + 1])) break;
  }
  if (i >= lines.length) return [];

  const header = splitRow(lines[i]);
  const cols = mapColumns(header);

  // 3) 본문 행
  const rows = [];
  for (let j = i + 2; j < lines.length; j += 1) {
    const line = lines[j].trim();
    if (!line.startsWith('|') && !line.includes('|')) break;
    if (line === '') break;
    const cells = splitRow(line);
    const cell = (k) => (k >= 0 && k < cells.length ? cleanCell(cells[k]) : '');
    const row = {
      rowIndex: rows.length,
      num: cell(cols.num),
      question: cell(cols.question),
      answer: cell(cols.answer),
      keywords: cell(cols.keywords),
    };
    rows.push(row);
  }
  // 내용이 전혀 없는 행(빈 칸만)은 검색·복습에 쓸모가 없다. 단 rowIndex 는 원래 자리를 유지한다.
  return rows.filter((r) => r.question || r.answer || r.keywords);
}

function isSeparator(line) {
  if (typeof line !== 'string') return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c.replace(/\s+/g, '')));
}

/** '| a | b \| c |' → ['a', 'b | c'] — 이스케이프된 파이프는 칸 구분자가 아니다 */
function splitRow(line) {
  let text = String(line ?? '').trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let k = 0; k < text.length; k += 1) {
    const ch = text[k];
    if (ch === '\\' && text[k + 1] === '|') {
      cur += '|';
      k += 1;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** 머리글 이름으로 열을 찾고, 못 찾은 것은 자리로 채운다 */
function mapColumns(header) {
  const norm = header.map((h) => cleanCell(h).replace(/\s+/g, ''));
  const find = (pred) => norm.findIndex(pred);

  let num = find((h) => h === '#' || h === '번호' || h === 'No' || h === 'no.');
  let question = find((h) => h.includes('헷갈'));
  let answer = find((h) => h.includes('정답') || h.includes('요약'));
  let keywords = find((h) => h.includes('키워드') || h.toLowerCase().includes('keyword'));

  // 자리로 정하기: 4열 = #, 헷갈린 것, 정답 요약, 키워드 / 3열 = #, 헷갈린 것, 정답 요약 / 2열 = 헷갈린 것, 정답 요약
  const n = header.length;
  const offset = n >= 3 ? 1 : 0;
  if (num < 0 && n >= 3) num = 0;
  if (question < 0) question = offset;
  if (answer < 0) answer = offset + 1;
  if (keywords < 0 && n >= 4) keywords = 3;

  return { num, question, answer, keywords };
}

/** 표 칸 안의 가벼운 마크다운 기호를 걷어 읽기 좋게 */
function cleanCell(text) {
  return String(text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

/** 검색용 — 모든 열 중 하나라도 걸리면 */
export function rowMatches(row, needle) {
  return [row.num, row.question, row.answer, row.keywords].some(
    (t) => typeof t === 'string' && t.toLowerCase().includes(needle)
  );
}
