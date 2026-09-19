/**
 * claude.ai 와 주고받는 버튼 묶음.
 *
 * 화면마다 따로 배치하면 라벨과 순서가 금방 어긋난다. 과목·블록·기록 세 화면이
 * 같은 구조를 쓰므로 한 곳에서 모양을 정한다.
 *
 * **'자기 자신'과 '하위 전체'를 묶음으로 갈라 놓는 것**이 이 컴포넌트의 전부다.
 * 버튼 넷이 한 줄에 늘어서 있으면 "과목 정보 내보내기"와 "과목 전체 내보내기"가
 * 무엇이 다른지 매번 라벨을 읽어야 한다. 묶음 제목이 그 구분을 대신한다.
 *
 * @param {{ groups: Array<{
 *   label: string,
 *   hint?: string,
 *   actions: Array<{ kind: 'export'|'import', label: string, onClick: Function,
 *                    disabled?: boolean, title?: string }>
 * }> }} props
 */
export default function ExchangeBar({ groups }) {
  return (
    <div className="exchange">
      {groups.map((group) => (
        <div className="exchange__group" key={group.label}>
          <p className="exchange__label">
            {group.label}
            {group.hint && <span className="exchange__hint">{group.hint}</span>}
          </p>
          <div className="exchange__actions">
            {group.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className="btn btn--sm"
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.title}
              >
                {action.kind === 'export' ? '⧉' : '⤓'} {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
