import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectBlockEntries, selectBlockProgress, selectBlockTrend } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import EntryRow from '../components/EntryRow.jsx';
import Markdown from '../components/Markdown.jsx';
import DiagramEmbed from '../components/DiagramEmbed.jsx';
import SvgEmbed from '../components/SvgEmbed.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ProgressTrend from '../components/ProgressTrend.jsx';
import PasteImportSheet from '../components/PasteImportSheet.jsx';
import Sheet from '../components/Sheet.jsx';
import NotFound from './NotFound.jsx';
import { copyText } from '../lib/clipboard.js';
import { buildBlockExportText, summarizeBlockExport } from '../lib/exportBlock.js';
import { parseBlockText, resolveTarget, buildBlockInfoText, summarizeBlockInfo } from '../lib/structuredText.js';

/**
 * 경로 B의 세 번째 단계 — 블록 하나.
 *
 * 이 화면에는 성격이 다른 두 덩어리가 있다.
 *   1. **블록 자체의 정보** — 설명·진행률·다이어그램·SVG. claude.ai 가 만들어 준
 *      것을 통째로 받아 두는 자리다.
 *   2. **블록에 속한 기록들** — 날짜순 목록.
 *
 * 그래서 내보내기 버튼도 둘이다. 이름을 '기록 내보내기'와 '블록 정보 내보내기'로
 * 갈라 둔 이유가 여기 있다 — 무엇이 클립보드에 담기는지 버튼 이름만 보고 알아야 한다.
 */
export default function BlockView() {
  const { subjectId, blockId } = useParams();
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  // 클립보드가 막힌 환경(file:// 등)에서 직접 복사할 수 있도록 원문을 띄운다
  const [manualCopy, setManualCopy] = useState(null);

  const subject = state.subjects[subjectId];
  const block = state.blocks[blockId];

  // 주소를 직접 고쳤거나 다른 과목의 블록을 가리키는 경우를 막는다.
  if (!subject || !block || block.subjectId !== subjectId) return <NotFound />;

  const entries = selectBlockEntries(index, blockId);
  const progress = selectBlockProgress(block);
  const trend = selectBlockTrend(index, blockId);

  const copyOrShow = async (text, successMessage) => {
    const result = await copyText(text);
    if (result.ok) {
      actions.setNotice({ level: 'success', message: successMessage });
    } else {
      // 조용히 실패하지 않는다. 직접 복사할 수 있게 원문을 보여준다.
      setManualCopy(text);
    }
  };

  const exportEntries = () => {
    if (entries.length === 0) return;
    copyOrShow(
      buildBlockExportText(entries),
      `${block.name} — ${summarizeBlockExport(entries)}를 클립보드에 복사했습니다.`
    );
  };

  const exportBlockInfo = () =>
    copyOrShow(
      buildBlockInfoText(subject, block),
      `${block.name} 블록 정보를 클립보드에 복사했습니다. (${summarizeBlockInfo(block)})`
    );

  /**
   * 붙여넣은 ---BLOCK--- 텍스트를 읽는다.
   *
   * 형식이 맞아도 끝이 아니다. 적힌 과목·블록이 **지금 보고 있는 이 블록**인지까지
   * 확인한다. 다른 블록의 정보를 여기에 덮어쓰는 사고가 조용히 일어나면
   * 어느 블록이 오염됐는지조차 알 수 없게 된다.
   */
  const readBlockInfo = (text) => {
    const parsed = parseBlockText(text);
    if (!parsed.ok) return parsed;

    const target = resolveTarget(state, parsed.value);
    if (!target.ok) return { ...parsed, ok: false, errors: target.errors };

    if (target.blockId !== blockId) {
      const other = state.blocks[target.blockId];
      return {
        ...parsed,
        ok: false,
        errors: [
          `이 텍스트는 '${parsed.value.subjectName} / ${other?.name ?? parsed.value.blockName}' 블록의 정보입니다. 지금 보고 있는 '${subject.name} / ${block.name}' 에는 반영할 수 없습니다.`,
        ],
      };
    }

    return parsed;
  };

  const applyBlockInfo = (value) => {
    actions.updateBlock(blockId, {
      description: value.description,
      progressPercent: value.progressPercent,
      diagramCode: value.diagramCode,
      svgCode: value.svgCode,
    });
    actions.setNotice({
      level: 'success',
      message: `${block.name} 블록 정보를 갱신했습니다.`,
    });
  };

  const hasFigures = Boolean(block.diagramCode?.trim() || block.svgCode?.trim());

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
        {subject.name} · 기록 {entries.length}개 · {block.isCompleted ? '완료' : '진행 중'}
      </p>

      {progress.hasValue && (
        <div className="blockhead__progress">
          <ProgressBar
            percent={progress.percent}
            subject={subject}
            label={`${block.name} 진행률`}
          />
          <p className="page__sub">
            블록 진행률 {progress.percent}%{' '}
            <span className="field__hint">— claude.ai 가 계산해 보내준 값입니다</span>
          </p>
        </div>
      )}

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
          onClick={exportEntries}
          disabled={entries.length === 0}
          title={entries.length === 0 ? '내보낼 기록이 없습니다' : '이 블록의 기록들을 클립보드로'}
        >
          ⧉ 기록 내보내기
        </button>
        <button
          type="button"
          className="btn"
          onClick={exportBlockInfo}
          title="블록 자체 정보(설명·진행률·다이어그램·SVG)를 클립보드로"
        >
          ⧉ 블록 정보 내보내기
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setImporting(true)}
          title="claude.ai 가 만들어 준 ---BLOCK--- 텍스트를 붙여넣기"
        >
          ⤓ 블록 정보 가져오기
        </button>
        <button type="button" className="btn" onClick={() => setEditing(true)}>
          블록 설정
        </button>
      </div>

      {block.description?.trim() && (
        <section className="section blockdesc">
          <Markdown>{block.description}</Markdown>
        </section>
      )}

      <div className="section">
        <Link to={`/new?block=${blockId}`} className="btn btn--block">
          + 이 블록에 기록 추가
        </Link>
      </div>

      {/* 블록 자체의 그림 — 다이어그램이 위, SVG 가 아래 */}
      {hasFigures ? (
        <>
          {block.diagramCode?.trim() && (
            <section className="section">
              <h2 className="section__title">다이어그램</h2>
              <DiagramEmbed code={block.diagramCode} />
            </section>
          )}
          {block.svgCode?.trim() && (
            <section className="section">
              <h2 className="section__title">SVG</h2>
              <SvgEmbed code={block.svgCode} />
            </section>
          )}
        </>
      ) : (
        <p className="empty empty--quiet">
          이 블록의 다이어그램과 SVG 가 여기에 표시됩니다. <strong>블록 정보 가져오기</strong> 로
          claude.ai 가 만들어 준 텍스트를 붙여넣거나, 블록 설정에서 직접 입력하세요.
        </p>
      )}

      {trend.length > 0 && (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">진행률 추이</h2>
          </div>
          <ProgressTrend points={trend} subject={subject} />
        </section>
      )}

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

      {/* 블록 설정 — 블록 자체 정보를 손으로 고치는 자리 */}
      <BlockSettings
        open={editing}
        block={block}
        subjects={state.subjectOrder.map((id) => state.subjects[id]).filter(Boolean)}
        onClose={() => setEditing(false)}
        onSave={({ subjectId: nextSubjectId, ...patch }) => {
          actions.updateBlock(blockId, patch);
          setEditing(false);

          // 과목을 옮겼으면 지금 주소(/subjects/옛과목/블록)는 더 이상 맞지 않는다.
          if (nextSubjectId !== subjectId) {
            actions.moveBlock(blockId, nextSubjectId);
            navigate(`/subjects/${nextSubjectId}/${blockId}`, { replace: true });
            actions.setNotice({
              level: 'success',
              message: `'${block.name}' 블록을 '${state.subjects[nextSubjectId]?.name}' 과목으로 옮겼습니다. 소속 기록 ${entries.length}개도 함께 옮겨졌습니다.`,
            });
          }
        }}
        onRequestDelete={() => {
          setEditing(false);
          setConfirmDelete(true);
        }}
      />

      {/* 블록 정보 가져오기 */}
      <PasteImportSheet
        open={importing}
        onClose={() => setImporting(false)}
        title="블록 정보 가져오기"
        hint={`claude.ai 가 만들어 준 ---BLOCK--- 형식 텍스트를 그대로 붙여넣으세요. '${subject.name} / ${block.name}' 의 설명·진행률·다이어그램·SVG 를 덮어씁니다.`}
        placeholder={'---BLOCK---\n과목: ' + subject.name + '\n블록: ' + block.name + '\n\n설명:\n…\n---END---'}
        parse={readBlockInfo}
        applyLabel="블록 정보 갱신"
        onApply={applyBlockInfo}
        renderPreview={(value) => <BlockInfoPreview value={value} />}
      />

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
          브라우저가 클립보드 접근을 막았습니다. (파일을 직접 열었거나 권한이 거부된 경우) 아래
          내용을 전체 선택해 복사하세요.
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

/** 가져오기 직전에 보여줄 요약 — 무엇이 덮어써지는지 한눈에 */
function BlockInfoPreview({ value }) {
  const rows = [
    ['설명', `${value.description.split('\n').length}줄`],
    ['진행률', value.progressPercent == null ? '없음 (지움)' : `${value.progressPercent}%`],
    ['다이어그램', value.diagramCode ? `${value.diagramCode.split('\n').length}줄` : '없음 (지움)'],
    ['SVG', value.svgCode ? `${value.svgCode.length}자` : '없음 (지움)'],
  ];

  return (
    <dl className="paste__preview">
      {rows.map(([label, detail]) => (
        <div key={label} className="paste__previewrow">
          <dt>{label}</dt>
          <dd>{detail}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 블록 설정.
 *
 * 가져오기가 있는데도 손으로 고치는 폼을 함께 두는 이유: 가져오기는 통째로
 * 덮어쓰는 동작이라, 숫자 하나·오타 하나를 고치려고 claude.ai 를 다시 다녀올 수는 없다.
 */
function BlockSettings({ open, block, subjects, onClose, onSave, onRequestDelete }) {
  const [form, setForm] = useState(() => toForm(block));
  const [preview, setPreview] = useState({ diagram: false, svg: false });

  // 다시 열 때마다 현재 값으로 초기화한다.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(toForm(block));
      setPreview({ diagram: false, svg: false });
    }
  }

  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

  return (
    <Sheet
      open={open}
      title="블록 설정"
      onClose={onClose}
      footer={
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!form.name.trim()}
            onClick={() =>
              onSave({
                name: form.name,
                subjectId: form.subjectId,
                description: form.description,
                // 빈칸은 0% 가 아니라 '미설정'이다
                progressPercent: form.progressPercent.trim() === '' ? null : form.progressPercent,
                diagramCode: form.diagramCode,
                svgCode: form.svgCode,
              })
            }
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
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="block-edit-subject">
          소속 과목
        </label>
        <select
          id="block-edit-subject"
          className="select"
          value={form.subjectId}
          onChange={(e) => patch({ subjectId: e.target.value })}
        >
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
        <p className="field__hint">
          바꾸면 이 블록과 소속 기록이 통째로 그 과목으로 옮겨갑니다. 잘못 만든 과목을 정리할 때
          쓰세요.
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="block-edit-progress">
          블록 진행률 <span className="field__hint">(선택, 0~100)</span>
        </label>
        <input
          id="block-edit-progress"
          className="input"
          type="number"
          inputMode="numeric"
          min="0"
          max="100"
          value={form.progressPercent}
          onChange={(e) => patch({ progressPercent: e.target.value })}
          placeholder="비워두면 표시하지 않습니다"
        />
        <p className="field__hint">
          트래커가 계산하지 않는 값입니다. claude.ai 가 계산해 보내준 값을 그대로 적어 두는
          자리입니다. (과목 진도율은 완료한 블록 수로 따로 계산됩니다)
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="block-edit-desc">
          블록 설명 <span className="field__hint">(마크다운)</span>
        </label>
        <textarea
          id="block-edit-desc"
          className="textarea"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="이 블록이 무엇을 다루는 단위인지"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="block-edit-diagram">
          다이어그램 <span className="field__hint">(선택, Mermaid 문법)</span>
        </label>
        <textarea
          id="block-edit-diagram"
          className="textarea textarea--code"
          value={form.diagramCode}
          onChange={(e) => patch({ diagramCode: e.target.value })}
          placeholder={'graph TD\n  A[강의 시청] --> B[과제]'}
          spellCheck={false}
        />
        {form.diagramCode.trim() && (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPreview((p) => ({ ...p, diagram: !p.diagram }))}
            >
              {preview.diagram ? '미리보기 접기' : '미리보기'}
            </button>
            {preview.diagram && <DiagramEmbed code={form.diagramCode} />}
          </>
        )}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="block-edit-svg">
          SVG <span className="field__hint">(선택)</span>
        </label>
        <textarea
          id="block-edit-svg"
          className="textarea textarea--code"
          value={form.svgCode}
          onChange={(e) => patch({ svgCode: e.target.value })}
          placeholder="<svg ...> ... </svg>"
          spellCheck={false}
        />
        {form.svgCode.trim() && (
          <>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setPreview((p) => ({ ...p, svg: !p.svg }))}
            >
              {preview.svg ? '미리보기 접기' : '미리보기'}
            </button>
            {preview.svg && <SvgEmbed code={form.svgCode} />}
          </>
        )}
      </div>

      <hr className="divider" />

      <button type="button" className="btn btn--danger btn--block" onClick={onRequestDelete}>
        이 블록 삭제
      </button>
    </Sheet>
  );
}

function toForm(block) {
  return {
    name: block.name ?? '',
    subjectId: block.subjectId,
    description: block.description ?? '',
    progressPercent: block.progressPercent == null ? '' : String(block.progressPercent),
    diagramCode: block.diagramCode ?? '',
    svgCode: block.svgCode ?? '',
  };
}
