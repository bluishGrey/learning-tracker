import { createContext, useCallback, useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useActions } from '../state/StoreContext.jsx';
import PasteImportSheet from './PasteImportSheet.jsx';
import BlockInfoDiff from './BlockInfoDiff.jsx';
import SubjectDot from './SubjectDot.jsx';
import { parseDocuments } from '../lib/structuredText.js';
import { planDailyImport, describePlan } from '../lib/importPlan.js';
import { deriveTitleFromContent } from '../lib/entryTitle.js';
import { todayKey, formatMonthDay } from '../lib/date.js';

/**
 * 오늘 기록 붙여넣기 — 이 앱의 평소 사용 흐름의 입구.
 *
 * 공부하던 claude.ai 채팅에서 "오늘 하루치 공부한 내용 기록 남겨줘"로 받은 텍스트
 * (ENTRY + 그 블록의 BLOCK, 블록을 넘나들면 여러 쌍)를 통째로 붙여넣으면
 * 읽기 → 미리보기 → 반영 한 번으로 끝난다. 폼을 거치지 않는다.
 *
 * 어느 화면에서든 열 수 있도록 앱 껍데기에 하나만 두고, 여는 함수는 context 로 나눠 준다.
 */
const OpenContext = createContext(() => {});

export function useOpenDailyImport() {
  return useContext(OpenContext);
}

export function DailyImportProvider({ children }) {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);

  return (
    <OpenContext.Provider value={openSheet}>
      {children}
      <DailyImportSheet open={open} onClose={() => setOpen(false)} />
    </OpenContext.Provider>
  );
}

function DailyImportSheet({ open, onClose }) {
  const { state } = useStore();
  const actions = useActions();
  const navigate = useNavigate();

  const read = (text) => {
    const parsed = parseDocuments(text);
    if (!parsed.ok) return { ok: false, value: null, errors: parsed.errors, warnings: [] };
    const planned = planDailyImport(state, parsed.docs, todayKey());
    if (!planned.ok) return { ok: false, value: null, errors: planned.errors, warnings: [] };
    return { ok: true, value: planned, errors: [], warnings: [...parsed.warnings, ...planned.warnings] };
  };

  const apply = (planned) => {
    actions.applyBundles(planned.plans);
    actions.setNotice({ level: 'success', message: `오늘 기록 반영 — ${describePlan(planned.summary)}` });

    // 기록이 하나면 바로 그 기록을 연다. 여럿이면 지금 화면(대개 홈 캘린더)에서 라벨로 확인한다.
    const entryItems = planned.plans.flatMap((plan) =>
      plan.entries.map((e) => ({ subjectId: plan.subjectId, ...e }))
    );
    if (entryItems.length === 1) {
      const e = entryItems[0];
      navigate(`/subjects/${e.subjectId}/${e.blockId}/e/${e.id}`);
    }
  };

  return (
    <PasteImportSheet
      open={open}
      onClose={onClose}
      title="오늘 기록 붙여넣기"
      hint="공부하던 claude.ai 채팅에서 받은 기록 텍스트(---ENTRY--- 와 ---BLOCK---)를 통째로 붙여넣으세요. 블록이나 과목이 여러 개 섞여 있어도 됩니다. 같은 날짜·제목의 기록은 새로 만들지 않고 갱신합니다."
      placeholder={'---ENTRY---\n날짜: 2026-10-03\n과목: …\n블록: …\n제목: …\n\n내용:\n…\n\n진행률: 60\n---END---\n\n---BLOCK---\n과목: …\n블록: …\n\n설명:\n…\n\n진행률: 60\n---END---'}
      parse={read}
      applyLabel="반영"
      onApply={apply}
      renderPreview={(planned) => <DailyPreview planned={planned} state={state} />}
    />
  );
}

/** 무엇이 어디로 들어가는지 — 기록 목록, 새 블록, 블록 정보 변경 */
function DailyPreview({ planned, state }) {
  const entries = planned.items.filter((i) => i.kind === 'entry');
  const blocks = planned.items.filter((i) => i.kind === 'block');
  const newBlocks = [...new Map(planned.items.filter((i) => i.isNewBlock).map((i) => [i.blockId, i])).values()];

  return (
    <div className="daily">
      <p className="daily__summary">{describePlan(planned.summary)}</p>

      {newBlocks.length > 0 && (
        <div className="callout callout--warn">
          <strong>새로 생성됨:</strong> {newBlocks.map((b) => `${b.subject.name} / ${b.blockName}`).join(', ')}
          <p className="field__hint">
            기존 블록과 이름이 맞지 않아 새 블록으로 만듭니다. 오타라면 취소하고 이름을 고쳐 주세요.
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="daily__list">
          {entries.map((item, i) => (
            <li key={i} className="daily__row">
              <SubjectDot subject={item.subject} size={8} />
              <span className="daily__title">
                {item.data.title || deriveTitleFromContent(item.data.content) || '(제목 없음)'}
              </span>
              <span className="daily__meta">
                {formatMonthDay(item.data.date)} · {item.subject.name} / {item.blockName}
                {item.data.progressPercent != null && ` · ${item.data.progressPercent}%`}
              </span>
              <span className={`daily__badge${item.isNewEntry ? '' : ' daily__badge--update'}`}>
                {item.isNewEntry ? '추가' : '갱신'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {blocks.map((item) =>
        item.isNewBlock ? (
          <p key={item.blockId} className="field__hint">
            새 블록 &apos;{item.blockName}&apos; 은 붙여넣은 블록 정보로 만들어집니다.
          </p>
        ) : (
          <BlockInfoDiff key={item.blockId} block={state.blocks[item.blockId]} patch={item.patch} />
        )
      )}
    </div>
  );
}
