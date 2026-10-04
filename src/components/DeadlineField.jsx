/**
 * 마감일 입력 — 과목 설정·블록 설정이 같이 쓴다.
 *
 * <input type="date"> 의 값은 처음부터 'YYYY-MM-DD' 문자열이라 Date 로 바꾸지 않고 그대로 저장한다.
 * 빈 값('')은 '마감 없음'이다. 지우기 버튼은 날짜 선택기마다 지우는 방법이 달라서 따로 둔다.
 */
export default function DeadlineField({ id, value, onChange, hint }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        마감일 <span className="field__hint">(선택)</span>
      </label>
      <div className="row deadlinefield">
        <input
          id={id}
          className="input"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange('')}>
            마감 지우기
          </button>
        )}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}
