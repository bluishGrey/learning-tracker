/**
 * 검색어 하이라이트 — 대소문자를 무시하고 걸린 부분만 <mark> 로 감싼다.
 * 정규식을 쓰지 않는다 (검색어의 특수문자를 이스케이프하다 실수할 여지를 없앤다).
 */
export default function Highlight({ text, query }) {
  const source = String(text ?? '');
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle || !source) return source;

  const lower = source.toLowerCase();
  const parts = [];
  let from = 0;
  let at = lower.indexOf(needle);
  while (at >= 0) {
    if (at > from) parts.push(source.slice(from, at));
    parts.push(
      <mark key={at} className="hl">
        {source.slice(at, at + needle.length)}
      </mark>
    );
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < source.length) parts.push(source.slice(from));
  return <>{parts}</>;
}
