import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectSubjectList, selectNextAutoHue } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import SubjectCard from '../components/SubjectCard.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import Sheet from '../components/Sheet.jsx';

/** 경로 B의 첫 단계 — 과목 목록 (진도율·활성도) */
export default function SubjectListView() {
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [totalBlocks, setTotalBlocks] = useState('');
  const [customColor, setCustomColor] = useState(null);

  const rows = selectSubjectList(state, index);
  // 이 과목이 받게 될 자동 배정 색 — 피커의 기본값으로 미리 보여준다.
  const nextAutoHue = selectNextAutoHue(state);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = actions.addSubject({
      name: trimmed,
      totalBlocks: Number(totalBlocks) || 0,
      customColor,
    });
    setAdding(false);
    setName('');
    setTotalBlocks('');
    setCustomColor(null);
    navigate(`/subjects/${id}`);
  };

  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: '과목' }]} />

      <h1 className="page__title">과목</h1>
      <p className="page__sub">
        진도율 = 완료한 블록 ÷ 전체 진도 단위. 색이 흐릴수록 오래 손대지 않은 과목입니다.
      </p>

      <button type="button" className="btn btn--primary btn--block" onClick={() => setAdding(true)}>
        + 과목 추가
      </button>

      <section className="section">
        {rows.length === 0 ? (
          <div className="empty">
            아직 과목이 없습니다. 먼저 과목을 만들고, 그 안에 진도 단위(블록)를 추가하세요.
          </div>
        ) : (
          <ul className="stack">
            {rows.map((row) => (
              <li key={row.subject.id}>
                <SubjectCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={adding}
        title="과목 추가"
        onClose={() => setAdding(false)}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setAdding(false)}>
              취소
            </button>
            <button
              type="submit"
              form="subject-add-form"
              className="btn btn--primary"
              disabled={!name.trim()}
            >
              추가
            </button>
          </div>
        }
      >
        <form id="subject-add-form" onSubmit={submit}>
          <div className="field">
            <label className="field__label" htmlFor="subject-name">
              과목 이름
            </label>
            <input
              id="subject-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: CS50x"
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="subject-total">
              전체 진도 단위 수
            </label>
            <input
              id="subject-total"
              className="input"
              type="number"
              inputMode="numeric"
              min="0"
              value={totalBlocks}
              onChange={(e) => setTotalBlocks(e.target.value)}
              placeholder="예: 11"
            />
            <p className="field__hint">
              전체 커리큘럼 기준 총 개수입니다. 진도율 계산의 분모가 됩니다. 나중에 바꿀 수 있습니다.
            </p>
          </div>

          <div className="field">
            <span className="field__label">색상</span>
            <ColorPicker value={customColor} autoHue={nextAutoHue} onChange={setCustomColor} />
          </div>
        </form>
      </Sheet>
    </main>
  );
}
