import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import {
  selectBlocks,
  selectBlockEntries,
  selectProgress,
  selectDaysSinceActive,
  selectSubjectEntries,
} from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import BlockRow from '../components/BlockRow.jsx';
import EntryRow from '../components/EntryRow.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import SubjectDot from '../components/SubjectDot.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import Markdown from '../components/Markdown.jsx';
import DiagramEmbed from '../components/DiagramEmbed.jsx';
import SvgEmbed from '../components/SvgEmbed.jsx';
import FigurePair from '../components/FigurePair.jsx';
import ExchangeBar from '../components/ExchangeBar.jsx';
import PasteImportSheet from '../components/PasteImportSheet.jsx';
import ManualCopySheet, { useTextExport } from '../components/ManualCopySheet.jsx';
import Sheet from '../components/Sheet.jsx';
import NotFound from './NotFound.jsx';
import { activityAlpha } from '../lib/color.js';
import { formatRelativeDay } from '../lib/date.js';
import {
  parseSubjectText,
  parseBlockListText,
  parseDocuments,
  buildSubjectInfoText,
  buildSubjectBundleText,
  summarizeSelfInfo,
} from '../lib/structuredText.js';
import { planSubjectImport, planBlockListImport, describePlan } from '../lib/importPlan.js';

/** 과목 상세에 함께 보여줄 최근 기록 수 — 목록 화면이 되지 않을 만큼만 */
const RECENT_LIMIT = 8;

/**
 * 경로 B의 두 번째 단계 — 과목 하나.
 *
 * 주고받기가 세 갈래다. 라벨만으로 구분되게 묶어 둔다.
 *   - **과목 정보** — 이 과목 자체의 설명·다이어그램·SVG
 *   - **과목 전체** — 그 아래 블록과 기록 전부
 *   - **블록 목록** — 이름만 나열된 커리큘럼 뼈대 (가져오기만)
 */
export default function SubjectView() {
  const { subjectId } = useParams();
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const [addingBlock, setAddingBlock] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(null); // 'info' | 'bundle' | 'blocklist'

  const { exportText, manualCopyProps } = useTextExport(actions.setNotice);

  const subject = state.subjects[subjectId];
  if (!subject) return <NotFound />;

  const blocks = selectBlocks(index, subjectId);
  const progress = selectProgress(state, index, subjectId);
  const daysSince = selectDaysSinceActive(index, subjectId);
  const alpha = activityAlpha(daysSince, state.settings.inactivityDays);
  const lastActive = index.lastActiveBySubject.get(subjectId) ?? null;

  const recent = selectSubjectEntries(index, subjectId, RECENT_LIMIT);
  const entryTotal = recent.total;

  const submitBlock = (event) => {
    event.preventDefault();
    const trimmed = blockName.trim();
    if (!trimmed) return;
    actions.addBlock({ subjectId, name: trimmed });
    setBlockName('');
    setAddingBlock(false);
  };

  /**
   * 내보내기는 누를 때마다 **지금의 블록·기록을 새로 훑어** 조립한다.
   * 과목이나 블록에 하위 요약본을 따로 저장해 두지 않는다 — 그랬다면 기록을
   * 고치거나 지운 뒤에 내보낸 결과가 화면과 어긋난다.
   */
  const exportInfo = () =>
    exportText(
      buildSubjectInfoText(subject),
      `${subject.name} 과목 정보를 복사했습니다. (${summarizeSelfInfo(subject)})`
    );

  const exportBundle = () =>
    exportText(
      buildSubjectBundleText(subject, selectBlocks(index, subjectId), (blockId) =>
        selectBlockEntries(index, blockId)
      ),
      `${subject.name} 전체를 복사했습니다. (블록 ${blocks.length}개 · 기록 ${entryTotal}개)`
    );

  // ─ 가져오기: 읽기 단계에서 대상이 이 과목인지까지 확인한다 ─
  const readInfo = (text) => {
    const parsed = parseSubjectText(text);
    if (!parsed.ok) return parsed;
    const want = String(parsed.value.subjectName ?? '').trim();
    if (want !== String(subject.name).trim()) {
      return {
        ...parsed,
        ok: false,
        errors: [
          `이 텍스트는 '${want}' 과목의 정보입니다. 지금 보고 있는 '${subject.name}' 에는 반영할 수 없습니다.`,
        ],
      };
    }
    return parsed;
  };

  const readBundle = (text) => {
    const parsed = parseDocuments(text);
    if (!parsed.ok) return { ok: false, value: null, errors: parsed.errors, warnings: [] };

    const planned = planSubjectImport(state, parsed.docs, { subjectId });
    if (!planned.ok) return { ok: false, value: null, errors: planned.errors, warnings: [] };
    return { ok: true, value: planned, errors: [], warnings: parsed.warnings };
  };

  const readBlockList = (text) => {
    const parsed = parseBlockListText(text);
    if (!parsed.ok) return parsed;

    const planned = planBlockListImport(state, parsed.value, { subjectId });
    if (!planned.ok) return { ...parsed, ok: false, errors: planned.errors };
    return { ok: true, value: planned, errors: [], warnings: parsed.warnings };
  };

  const applyInfo = (value) => {
    actions.updateSubject(subjectId, {
      description: value.description,
      diagramCode: value.diagramCode,
      svgCode: value.svgCode,
    });
    actions.setNotice({ level: 'success', message: `${subject.name} 과목 정보를 갱신했습니다.` });
  };

  const applyPlan = (planned) => {
    actions.applyBundle(planned.plan);
    actions.setNotice({ level: 'success', message: `가져오기 완료 — ${describePlan(planned.summary)}` });
  };

  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: subject.name || '(이름 없음)' }]} />

      <div className="subjecthead">
        <SubjectDot subject={subject} alpha={alpha} size={14} />
        <h1 className="page__title">{subject.name || '(이름 없음)'}</h1>
      </div>

      <ProgressBar
        percent={progress.percent}
        subject={subject}
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

      <ExchangeBar
        groups={[
          {
            label: '이 과목 정보',
            hint: '설명 · 다이어그램 · SVG',
            actions: [
              { kind: 'export', label: '과목 정보 내보내기', onClick: exportInfo },
              { kind: 'import', label: '과목 정보 가져오기', onClick: () => setImporting('info') },
            ],
          },
          {
            label: '과목 전체',
            hint: `블록 ${blocks.length}개 · 기록 ${entryTotal}개`,
            actions: [
              {
                kind: 'export',
                label: '과목 전체 내보내기',
                onClick: exportBundle,
                disabled: blocks.length === 0,
                title: blocks.length === 0 ? '내보낼 블록이 없습니다' : undefined,
              },
              { kind: 'import', label: '과목 전체 가져오기', onClick: () => setImporting('bundle') },
            ],
          },
          {
            label: '블록 목록',
            hint: '이름만 나열된 뼈대',
            actions: [
              { kind: 'import', label: '블록 목록 가져오기', onClick: () => setImporting('blocklist') },
            ],
          },
        ]}
      />

      {subject.description?.trim() && (
        <section className="section blockdesc">
          <Markdown>{subject.description}</Markdown>
        </section>
      )}

      <FigurePair
        unit={subject}
        emptyHint="이 과목의 다이어그램과 SVG 가 여기에 표시됩니다. 과목 정보 가져오기로 붙여넣거나, 과목 설정에서 직접 입력하세요."
      />

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

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">최근 기록</h2>
          {entryTotal > RECENT_LIMIT && (
            <span className="section__note">전체 {entryTotal}개 중 {RECENT_LIMIT}개</span>
          )}
        </div>

        {recent.rows.length === 0 ? (
          <div className="empty">아직 이 과목에 기록이 없습니다.</div>
        ) : (
          <ul className="stack">
            {recent.rows.map(({ entry, block }) => (
              <li key={entry.id}>
                <EntryRow
                  entry={entry}
                  block={block}
                  showDate
                  to={`/subjects/${subjectId}/${block.id}/e/${entry.id}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─ 가져오기 창 세 개 ─ */}
      <PasteImportSheet
        open={importing === 'info'}
        onClose={() => setImporting(null)}
        title="과목 정보 가져오기"
        hint={`claude.ai 가 만들어 준 ---SUBJECT--- 형식 텍스트를 붙여넣으세요. '${subject.name}' 의 설명·다이어그램·SVG 를 덮어씁니다.`}
        placeholder={`---SUBJECT---\n과목: ${subject.name}\n\n설명:\n…\n---END---`}
        parse={readInfo}
        applyLabel="과목 정보 갱신"
        onApply={applyInfo}
        renderPreview={(value) => (
          <FieldSummary
            rows={[
              ['설명', `${value.description.split('\n').length}줄`],
              ['다이어그램', value.diagramCode ? `${value.diagramCode.split('\n').length}줄` : '없음 (지움)'],
              ['SVG', value.svgCode ? `${value.svgCode.length}자` : '없음 (지움)'],
            ]}
          />
        )}
      />

      <PasteImportSheet
        open={importing === 'bundle'}
        onClose={() => setImporting(null)}
        title="과목 전체 가져오기"
        hint="---SUBJECT--- / ---BLOCK--- / ---ENTRY--- 문서가 이어진 텍스트를 통째로 붙여넣으세요. 같은 이름의 블록과 같은 날짜·제목의 기록은 갱신하고, 없는 것은 새로 만듭니다."
        placeholder={`---SUBJECT---\n과목: ${subject.name}\n…\n---END---\n\n---BLOCK---\n…\n---END---\n\n---ENTRY---\n…\n---END---`}
        parse={readBundle}
        applyLabel="전체 반영"
        onApply={applyPlan}
        renderPreview={(planned) => <PlanSummary planned={planned} />}
      />

      <PasteImportSheet
        open={importing === 'blocklist'}
        onClose={() => setImporting(null)}
        title="블록 목록 가져오기"
        hint="블록 이름만 한 줄에 하나씩 적힌 ---BLOCKLIST--- 텍스트를 붙여넣으세요. 이미 있는 이름은 건너뜁니다."
        placeholder={`---BLOCKLIST---\n과목: ${subject.name}\n\n블록 목록:\nWeek 0\nWeek 1\nWeek 2\n---END---`}
        parse={readBlockList}
        applyLabel="블록 만들기"
        onApply={applyPlan}
        renderPreview={(planned) => <PlanSummary planned={planned} />}
      />

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
            />
            <p className="field__hint">
              완료 체크는 블록 목록에서 직접 토글합니다. 여러 개를 한 번에 만들려면 위의
              <strong> 블록 목록 가져오기</strong> 를 쓰세요.
            </p>
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

      <ManualCopySheet {...manualCopyProps} />
    </main>
  );
}

/** 반영 전 요약 — 무엇이 덮어써지는지 */
function FieldSummary({ rows }) {
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

/** 일괄 가져오기 계획 요약 — 몇 개가 생기고 몇 개가 바뀌는지 먼저 읽게 한다 */
function PlanSummary({ planned }) {
  const { summary, plan } = planned;
  const newBlocks = plan.blocks.filter((b) => b.isNew).map((b) => b.name);

  return (
    <>
      <FieldSummary
        rows={[
          ['과목 정보', summary.subjectUpdated ? '갱신' : '그대로'],
          ['블록', `추가 ${summary.blocksAdded} · 갱신 ${summary.blocksUpdated}`],
          ['기록', `추가 ${summary.entriesAdded} · 갱신 ${summary.entriesUpdated}`],
        ]}
      />
      {newBlocks.length > 0 && (
        <p className="field__hint paste__note">새로 만들 블록: {newBlocks.join(', ')}</p>
      )}
      {summary.skipped?.length > 0 && (
        <p className="field__hint paste__note">
          이미 있어 건너뜀: {summary.skipped.join(', ')}
        </p>
      )}
    </>
  );
}

function SubjectSettings({ open, subject, onClose, onSave, onRequestDelete }) {
  const [form, setForm] = useState(() => toForm(subject));
  const [preview, setPreview] = useState({ diagram: false, svg: false });

  // 다시 열 때마다 현재 값으로 초기화한다.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(toForm(subject));
      setPreview({ diagram: false, svg: false });
    }
  }

  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

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
            disabled={!form.name.trim()}
            onClick={() =>
              onSave({
                name: form.name,
                totalBlocks: Number(form.totalBlocks) || 0,
                customColor: form.customColor,
                description: form.description,
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
        <label className="field__label" htmlFor="subject-edit-name">
          과목 이름
        </label>
        <input
          id="subject-edit-name"
          className="input"
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
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
          value={form.totalBlocks}
          onChange={(e) => patch({ totalBlocks: e.target.value })}
        />
        <p className="field__hint">진도율의 분모입니다. 0이면 진도율을 표시하지 않습니다.</p>
      </div>

      <div className="field">
        <span className="field__label">색상</span>
        <ColorPicker
          value={form.customColor}
          autoHue={subject.colorHue}
          onChange={(customColor) => patch({ customColor })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="subject-edit-desc">
          과목 설명 <span className="field__hint">(마크다운)</span>
        </label>
        <textarea
          id="subject-edit-desc"
          className="textarea"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="이 과목이 무엇을 다루는지"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="subject-edit-diagram">
          다이어그램 <span className="field__hint">(선택, Mermaid 문법)</span>
        </label>
        <textarea
          id="subject-edit-diagram"
          className="textarea textarea--code"
          value={form.diagramCode}
          onChange={(e) => patch({ diagramCode: e.target.value })}
          placeholder={'graph TD\n  A[기초] --> B[심화]'}
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
        <label className="field__label" htmlFor="subject-edit-svg">
          SVG <span className="field__hint">(선택)</span>
        </label>
        <textarea
          id="subject-edit-svg"
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
        이 과목 삭제
      </button>
    </Sheet>
  );
}

function toForm(subject) {
  return {
    name: subject.name ?? '',
    totalBlocks: String(subject.totalBlocks ?? 0),
    customColor: subject.customColor ?? null,
    description: subject.description ?? '',
    diagramCode: subject.diagramCode ?? '',
    svgCode: subject.svgCode ?? '',
  };
}
