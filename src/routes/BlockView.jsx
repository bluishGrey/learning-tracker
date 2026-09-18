import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectBlockEntries } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import EntryRow from '../components/EntryRow.jsx';
import Sheet from '../components/Sheet.jsx';
import NotFound from './NotFound.jsx';
import { copyText } from '../lib/clipboard.js';
import { buildBlockExportText, summarizeBlockExport } from '../lib/exportBlock.js';

/** 경로 B의 세 번째 단계 — 블록에 속한 기록 (날짜순) */
export default function BlockView() {
  const { subjectId, blockId } = useParams();
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 클립보드가 막힌 환경(file:// 등)에서 직접 복사할 수 있도록 원문을 띄운다
  const [manualCopy, setManualCopy] = useState(null);

  const subject = state.subjects[subjectId];
  const block = state.blocks[blockId];

  // 주소를 직접 고쳤거나 다른 과목의 블록을 가리키는 경우를 막는다.
  if (!subject || !block || block.subjectId !== subjectId) return <NotFound />;

  const entries = selectBlockEntries(index, blockId);

  const openEditor = () => {
    setName(block.name);
    setEditing(true);
  };

  const handleExport = async () => {
    if (entries.length === 0) return;
    const text = buildBlockExportText(entries);
    const result = await copyText(text);

    if (result.ok) {
      actions.setNotice({
        level: 'success',
        message: `${block.name} — ${summarizeBlockExport(entries)}를 클립보드에 복사했습니다.`,
      });
    } else {
      // 조용히 실패하지 않는다. 직접 복사할 수 있게 원문을 보여준다.
      setManualCopy(text);
    }
  };

  return (
    <main className="page">
      <Breadcrumb
        items={[
          { label: '홈', to: '/' },
          { label: subject.name || '(이름 없음)', to: `/subjects/${subjectId}` },
          { label: block.name || '(이름 없음)' },
        ]}
      />

      <h1 className="page__title">{block.name || '(이름 없음)'}</h1>
      <p className="page__sub">
        {subject.name} · 기록 {entries.length}개 ·{' '}
        {block.isCompleted ? '완료' : '진행 중'}
      </p>

      <div className="row blockhead__actions">
        <button
          type="button"
          className={`btn ${block.isCompleted ? '' : 'btn--primary'}`}
          onClick={() => actions.toggleBlock(blockId)}
          aria-pressed={block.isCompleted}
        >
          {block.isCompleted ? '✓ 완료됨 — 해제' : '완료로 표시'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={handleExport}
          disabled={entries.length === 0}
          title={entries.length === 0 ? '내보낼 기록이 없습니다' : undefined}
        >
          ⧉ 내보내기
        </button>
        <button type="button" className="btn" onClick={openEditor}>
          블록 설정
        </button>
      </div>

      <div className="section">
        <Link to={`/new?block=${blockId}`} className="btn btn--block">
          + 이 블록에 기록 추가
        </Link>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">기록</h2>
        </div>

        {entries.length === 0 ? (
          <div className="empty">아직 이 블록에 기록이 없습니다.</div>
        ) : (
          <ul className="stack">
            {entries.map((entry) => (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  showDate
                  to={`/subjects/${subjectId}/${blockId}/e/${entry.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 블록 설정 */}
      <Sheet
        open={editing}
        title="블록 설정"
        onClose={() => setEditing(false)}
        footer={
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              취소
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!name.trim()}
              onClick={() => {
                actions.updateBlock(blockId, { name });
                setEditing(false);
              }}
            >
              저장
            </button>
          </div>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="block-edit-name">
            블록 이름
          </label>
          <input
            id="block-edit-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <hr className="divider" />

        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={() => {
            setEditing(false);
            setConfirmDelete(true);
          }}
        >
          이 블록 삭제
        </button>
      </Sheet>

      {/* 삭제 확인 */}
      <Sheet
        open={confirmDelete}
        title="블록을 삭제할까요?"
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
                actions.removeBlock(blockId);
                navigate(`/subjects/${subjectId}`, { replace: true });
              }}
            >
              삭제
            </button>
          </div>
        }
      >
        <div className="callout callout--danger">
          <strong>이 블록의 기록 {entries.length}개가 함께 삭제됩니다.</strong>
          <p>되돌릴 수 없습니다. 필요하면 먼저 내보내기로 백업하세요.</p>
        </div>
      </Sheet>

      {/* 클립보드가 막힌 경우의 수동 복사 */}
      <Sheet
        open={manualCopy !== null}
        title="직접 복사해 주세요"
        onClose={() => setManualCopy(null)}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => setManualCopy(null)}
          >
            닫기
          </button>
        }
      >
        <div className="callout callout--warn">
          브라우저가 클립보드 접근을 막았습니다. (파일을 직접 열었거나 권한이 거부된 경우)
          아래 내용을 전체 선택해 복사하세요.
        </div>
        <textarea
          className="textarea textarea--code"
          readOnly
          value={manualCopy ?? ''}
          onFocus={(e) => e.target.select()}
          style={{ minHeight: '220px' }}
        />
      </Sheet>
    </main>
  );
}
