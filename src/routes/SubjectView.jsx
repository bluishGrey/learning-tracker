import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectBlocks, selectProgress, selectDaysSinceActive } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import BlockRow from '../components/BlockRow.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import SubjectDot from '../components/SubjectDot.jsx';
import Sheet from '../components/Sheet.jsx';
import NotFound from './NotFound.jsx';
import { activityAlpha } from '../lib/color.js';
import { formatRelativeDay } from '../lib/date.js';

/** 경로 B의 두 번째 단계 — 그 과목의 블록 목록 */
export default function SubjectView() {
  const { subjectId } = useParams();
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const [addingBlock, setAddingBlock] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const subject = state.subjects[subjectId];
  if (!subject) return <NotFound />;

  const blocks = selectBlocks(index, subjectId);
  const progress = selectProgress(state, index, subjectId);
  const daysSince = selectDaysSinceActive(index, subjectId);
  const alpha = activityAlpha(daysSince, state.settings.inactivityDays);
  const lastActive = index.lastActiveBySubject.get(subjectId) ?? null;

  const entryTotal = blocks.reduce(
    (sum, b) => sum + (index.entriesByBlock.get(b.id)?.length ?? 0),
    0
  );

  const submitBlock = (event) => {
    event.preventDefault();
    const trimmed = blockName.trim();
    if (!trimmed) return;
    actions.addBlock({ subjectId, name: trimmed });
    setBlockName('');
    setAddingBlock(false);
  };

  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: subject.name || '(이름 없음)' }]} />

      <div className="subjecthead">
        <SubjectDot hue={subject.colorHue} alpha={alpha} size={14} />
        <h1 className="page__title">{subject.name || '(이름 없음)'}</h1>
      </div>

      <ProgressBar
        percent={progress.percent}
        hue={subject.colorHue}
        alpha={alpha}
        label={`${subject.name} 진도율`}
      />

      <p className="page__sub subjecthead__stats">
        {progress.hasTarget
          ? `${progress.percent}% · ${progress.completed} / ${progress.total} 블록 완료`
          : '전체 진도 단위 수가 설정되지 않았습니다'}
        {' · '}
        기록 {entryTotal}개 · {lastActive ? formatRelativeDay(lastActive) : '기록 없음'}
      </p>

      {progress.overflow && (
        <div className="callout callout--warn">
          만든 블록({progress.created})이 설정한 전체 진도 단위({progress.total})보다 많습니다. 진도율은
          100%에서 멈춥니다.
        </div>
      )}

      <div className="row subjecthead__actions">
        <button type="button" className="btn btn--primary" onClick={() => setAddingBlock(true)}>
          + 블록 추가
        </button>
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          과목 설정
        </button>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">블록 {blocks.length}개</h2>
        </div>

        {blocks.length === 0 ? (
          <div className="empty">
            블록이 없습니다. 블록은 &quot;Week 5&quot;, &quot;React 기초 1부&quot; 같은 진도 단위입니다.
          </div>
        ) : (
          <ul className="stack">
            {blocks.map((block) => (
              <li key={block.id}>
                <BlockRow
                  block={block}
                  to={`/subjects/${subjectId}/${block.id}`}
                  entryCount={index.entriesByBlock.get(block.id)?.length ?? 0}
                  onToggle={() => actions.toggleBlock(block.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 블록 추가 */}
      <Sheet
        open={addingBlock}
        title="블록 추가"
        onClose={() => setAddingBlock(false)}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setAddingBlock(false)}>
              취소
            </button>
            <button
              type="submit"
              form="block-add-form"
              className="btn btn--primary"
              disabled={!blockName.trim()}
            >
              추가
            </button>
          </div>
        }
      >
        <form id="block-add-form" onSubmit={submitBlock}>
          <div className="field">
            <label className="field__label" htmlFor="block-name">
              블록 이름
            </label>
            <input
              id="block-name"
              className="input"
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="예: Week 5"
              autoFocus
            />
            <p className="field__hint">완료 체크는 블록 목록에서 직접 토글합니다.</p>
          </div>
        </form>
      </Sheet>

      {/* 과목 설정 */}
      <SubjectSettings
        open={editing}
        subject={subject}
        onClose={() => setEditing(false)}
        onSave={(patch) => {
          actions.updateSubject(subjectId, patch);
          setEditing(false);
        }}
        onRequestDelete={() => {
          setEditing(false);
          setConfirmDelete(true);
        }}
      />

      {/* 삭제 확인 */}
      <Sheet
        open={confirmDelete}
        title="과목을 삭제할까요?"
        onClose={() => setConfirmDelete(false)}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
              취소
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                actions.removeSubject(subjectId);
                navigate('/subjects', { replace: true });
              }}
            >
              삭제
            </button>
          </div>
        }
      >
        <div className="callout callout--danger">
          <strong>
            블록 {blocks.length}개와 기록 {entryTotal}개가 함께 삭제됩니다.
          </strong>
          <p>되돌릴 수 없습니다. 필요하면 먼저 내보내기로 백업하세요.</p>
        </div>
      </Sheet>
    </main>
  );
}

function SubjectSettings({ open, subject, onClose, onSave, onRequestDelete }) {
  const [name, setName] = useState(subject.name);
  const [totalBlocks, setTotalBlocks] = useState(String(subject.totalBlocks ?? 0));

  // 다시 열 때마다 현재 값으로 초기화한다.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(subject.name);
      setTotalBlocks(String(subject.totalBlocks ?? 0));
    }
  }

  return (
    <Sheet
      open={open}
      title="과목 설정"
      onClose={onClose}
      footer={
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!name.trim()}
            onClick={() => onSave({ name, totalBlocks: Number(totalBlocks) || 0 })}
          >
            저장
          </button>
        </div>
      }
    >
      <div className="field">
        <label className="field__label" htmlFor="subject-edit-name">
          과목 이름
        </label>
        <input
          id="subject-edit-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="subject-edit-total">
          전체 진도 단위 수
        </label>
        <input
          id="subject-edit-total"
          className="input"
          type="number"
          inputMode="numeric"
          min="0"
          value={totalBlocks}
          onChange={(e) => setTotalBlocks(e.target.value)}
        />
        <p className="field__hint">진도율의 분모입니다. 0이면 진도율을 표시하지 않습니다.</p>
      </div>

      <div className="field">
        <span className="field__label">색상</span>
        <div className="row">
          <SubjectDot hue={subject.colorHue} size={14} />
          <span className="field__hint">
            hue {Math.round(subject.colorHue)}° — 만든 순서대로 자동 배정되며 바뀌지 않습니다.
          </span>
        </div>
      </div>

      <hr className="divider" />

      <button type="button" className="btn btn--danger btn--block" onClick={onRequestDelete}>
        이 과목 삭제
      </button>
    </Sheet>
  );
}
