import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import { selectBlocks, selectTagSuggestions } from '../state/selectors.js';
import Breadcrumb from '../components/Breadcrumb.jsx';
import TagInput from '../components/TagInput.jsx';
import SvgEmbed from '../components/SvgEmbed.jsx';
import NotFound from './NotFound.jsx';
import { todayKey, isValidDateKey } from '../lib/date.js';
import { deriveTitleFromContent } from '../lib/entryTitle.js';

/**
 * 기록 작성 / 수정.
 *
 * 어디로 돌아갈지는 ?from= 쿼리로 받는다. 상세 화면에서 '수정'을 누르면
 * 그때의 경로(캘린더 경로였는지 과목 경로였는지)가 실려 오므로,
 * 저장 후 사용자가 있던 자리로 정확히 되돌아간다.
 */
export default function EntryEditor() {
  const { entryId } = useParams();
  const [searchParams] = useSearchParams();
  const { state, index } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const isEdit = Boolean(entryId);
  const existing = isEdit ? state.entries[entryId] : null;

  const returnTo = searchParams.get('from');

  // ── 초기값 ──
  const [form, setForm] = useState(() => {
    if (existing) {
      const block = state.blocks[existing.blockId];
      return {
        date: existing.date,
        subjectId: block?.subjectId ?? '',
        blockId: existing.blockId,
        title: existing.title ?? '',
        tags: existing.tags ?? [],
        content: existing.content ?? '',
        svgCode: existing.svgCode ?? '',
      };
    }

    const queryDate = searchParams.get('date');
    const queryBlock = searchParams.get('block');
    const block = queryBlock ? state.blocks[queryBlock] : null;
    const subjectId = block?.subjectId ?? state.subjectOrder[0] ?? '';
    const fallbackBlock = block ? null : selectBlocks(index, subjectId)[0];

    return {
      date: isValidDateKey(queryDate) ? queryDate : todayKey(),
      subjectId,
      blockId: block?.id ?? fallbackBlock?.id ?? '',
      title: '',
      tags: [],
      content: '',
      svgCode: '',
    };
  });

  const [newBlockName, setNewBlockName] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [showSvgPreview, setShowSvgPreview] = useState(false);

  if (isEdit && !existing) return <NotFound />;

  const patch = (next) => setForm((prev) => ({ ...prev, ...next }));

  const subjects = state.subjectOrder.map((id) => state.subjects[id]).filter(Boolean);
  const blocks = form.subjectId ? selectBlocks(index, form.subjectId) : [];
  const suggestions = selectTagSuggestions(index);

  const derivedTitle = deriveTitleFromContent(form.content);
  const canSave =
    form.blockId && (form.content.trim().length > 0 || form.svgCode.trim().length > 0);

  // ── 인라인 생성 ──
  const createSubject = () => {
    const name = newSubjectName.trim();
    if (!name) return;
    const id = actions.addSubject({ name, totalBlocks: 0 });
    patch({ subjectId: id, blockId: '' });
    setNewSubjectName('');
    setAddingBlock(true);
  };

  const createBlock = () => {
    const name = newBlockName.trim();
    if (!name || !form.subjectId) return;
    const id = actions.addBlock({ subjectId: form.subjectId, name });
    patch({ blockId: id });
    setNewBlockName('');
    setAddingBlock(false);
  };

  // ── 저장 ──
  const submit = (event) => {
    event.preventDefault();
    if (!canSave) return;

    const payload = {
      date: form.date,
      blockId: form.blockId,
      title: form.title.trim() || null,
      tags: form.tags,
      content: form.content,
      svgCode: form.svgCode.trim() || null,
    };

    if (isEdit) {
      actions.updateEntry(entryId, payload);
      navigate(returnTo ?? `/subjects/${form.subjectId}/${form.blockId}/e/${entryId}`, {
        replace: true,
      });
    } else {
      const id = actions.addEntry(payload);
      navigate(`/subjects/${form.subjectId}/${form.blockId}/e/${id}`, { replace: true });
    }
  };

  const cancel = () => navigate(returnTo ?? -1);

  return (
    <main className="page">
      <Breadcrumb
        items={[{ label: '홈', to: '/' }, { label: isEdit ? '기록 수정' : '새 기록' }]}
      />
      <h1 className="page__title">{isEdit ? '기록 수정' : '새 기록'}</h1>

      <form onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="entry-date">
            날짜
          </label>
          <input
            id="entry-date"
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => patch({ date: e.target.value || todayKey() })}
            required
          />
        </div>

        {/* 소속 선택 */}
        {subjects.length === 0 ? (
          <div className="field">
            <span className="field__label">과목</span>
            <div className="callout callout--info">
              아직 과목이 없습니다. 먼저 과목을 하나 만드세요.
            </div>
            <div className="inline-add">
              <input
                className="input"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="예: CS50x"
              />
              <button
                type="button"
                className="btn"
                onClick={createSubject}
                disabled={!newSubjectName.trim()}
              >
                과목 만들기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="field">
              <label className="field__label" htmlFor="entry-subject">
                과목
              </label>
              <select
                id="entry-subject"
                className="select"
                value={form.subjectId}
                onChange={(e) => {
                  const subjectId = e.target.value;
                  // 과목이 바뀌면 블록도 그 과목의 첫 블록으로 옮긴다.
                  const first = selectBlocks(index, subjectId)[0];
                  patch({ subjectId, blockId: first?.id ?? '' });
                  setAddingBlock(false);
                }}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="entry-block">
                블록
              </label>

              {blocks.length > 0 && !addingBlock && (
                <select
                  id="entry-block"
                  className="select"
                  value={form.blockId}
                  onChange={(e) => patch({ blockId: e.target.value })}
                >
                  {blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.name}
                      {block.isCompleted ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              )}

              {(blocks.length === 0 || addingBlock) && (
                <div className="inline-add">
                  <input
                    className="input"
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                    placeholder="예: Week 5"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        createBlock();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={createBlock}
                    disabled={!newBlockName.trim()}
                  >
                    추가
                  </button>
                </div>
              )}

              <div className="row">
                {blocks.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setAddingBlock((v) => !v)}
                  >
                    {addingBlock ? '기존 블록에서 고르기' : '+ 새 블록 만들기'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="field">
          <label className="field__label" htmlFor="entry-content">
            내용 (마크다운)
          </label>
          <textarea
            id="entry-content"
            className="textarea"
            value={form.content}
            onChange={(e) => patch({ content: e.target.value })}
            placeholder={'# 오늘 한 것\n\n- 해시테이블 구현\n- `#`, `-`, `**굵게**` 등 마크다운을 씁니다'}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="entry-title">
            제목 <span className="field__hint">(선택)</span>
          </label>
          <input
            id="entry-title"
            className="input"
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={derivedTitle || '비워두면 내용 첫 줄이 제목이 됩니다'}
          />
          <p className="field__hint">
            {form.title.trim()
              ? '직접 지정한 제목을 씁니다.'
              : derivedTitle
                ? `현재 자동 제목: "${derivedTitle}"`
                : '내용을 적으면 첫 줄이 자동으로 제목이 됩니다.'}
          </p>
        </div>

        <div className="field">
          <span className="field__label">태그</span>
          <TagInput
            value={form.tags}
            onChange={(tags) => patch({ tags })}
            suggestions={suggestions}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="entry-svg">
            참고 SVG 코드 <span className="field__hint">(선택)</span>
          </label>
          <textarea
            id="entry-svg"
            className="textarea textarea--code"
            value={form.svgCode}
            onChange={(e) => patch({ svgCode: e.target.value })}
            placeholder="<svg ...> ... </svg> 코드를 그대로 붙여넣으세요"
            spellCheck={false}
          />
          <p className="field__hint">
            파일 업로드가 아니라 코드를 텍스트로 붙여넣는 방식입니다. 붙여넣은 코드는 원문 그대로
            보관하고, 화면에 그릴 때마다 스크립트를 제거한 뒤 렌더링합니다.
          </p>

          {form.svgCode.trim() && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowSvgPreview((v) => !v)}
              >
                {showSvgPreview ? '미리보기 접기' : '미리보기'}
              </button>
              {showSvgPreview && <SvgEmbed code={form.svgCode} />}
            </>
          )}
        </div>

        <div className="editor__actions">
          <button type="button" className="btn" onClick={cancel}>
            취소
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            {isEdit ? '저장' : '기록 추가'}
          </button>
        </div>

        {!canSave && (
          <p className="field__hint editor__hint">
            {!form.blockId
              ? '먼저 소속 블록을 고르거나 새로 만드세요.'
              : '내용이나 SVG 코드 중 하나는 채워야 합니다.'}
          </p>
        )}
      </form>
    </main>
  );
}
