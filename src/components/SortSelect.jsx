/**
 * 목록 정렬 선택 — '기본순'(저장된 순서) / '마감일순'.
 * 과목 목록과 블록 목록이 같이 쓴다. 보여주는 순서만 바꾸고 저장된 순서는 건드리지 않는다.
 */
export default function SortSelect({ value, onChange, label }) {
  return (
    <select
      className="select select--inline"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      <option value="order">기본순</option>
      <option value="deadline">마감일순</option>
    </select>
  );
}
