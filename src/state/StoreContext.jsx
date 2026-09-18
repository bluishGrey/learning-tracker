/**
 * 앱 전역 store.
 *
 * reducer(순수) + persist(부수효과) + import/export 를 한곳에서 엮는다.
 * 컴포넌트는 useStore() 로 읽고 useActions() 로 쓴다.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
} from 'react';

import { reducer, ACTIONS } from './reducer.js';
import { buildIndex, selectExportStatus } from './selectors.js';
import { newId } from '../lib/id.js';
import {
  loadState,
  createDebouncedSaver,
  getStorageUsage,
  restoreSnapshot,
  listSnapshots,
} from '../storage/persist.js';
import { downloadBackup } from '../storage/exportData.js';
import {
  readFileAsText,
  parseBackupText,
  previewImport,
  applyImport,
  IMPORT_MODE,
} from '../storage/importData.js';
import { formatErrors } from '../storage/validate.js';

const StoreContext = createContext(null);
const ActionsContext = createContext(null);

export function StoreProvider({ children }) {
  // 최초 1회만 저장소를 읽는다. 읽기 실패 통지도 함께 받는다.
  const [boot] = useState(() => loadState());
  const [state, dispatch] = useReducer(reducer, boot.state);
  const [notice, setNotice] = useState(boot.notice);

  // 콜백이 낡은 state 를 보지 않도록 최신값을 ref 로 들고 있는다.
  const stateRef = useRef(state);
  stateRef.current = state;

  const index = useMemo(() => buildIndex(state), [state]);
  const exportStatus = useMemo(() => selectExportStatus(state), [state]);

  // ─── 저장 ────────────────────────────────────────────────
  const saverRef = useRef(null);
  if (saverRef.current === null) {
    saverRef.current = createDebouncedSaver((result) => {
      if (!result.ok) setNotice({ level: 'error', message: result.error });
    });
  }

  // 초기 로드 직후의 상태까지 저장하면 불필요한 쓰기가 생기므로 변경분만 저장한다.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saverRef.current.save(state);
  }, [state]);

  // ─── 탭 종료 시: 저장 밀어넣기 + 미내보내기 경고 ───────────
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // 디바운스 대기 중인 저장이 있으면 먼저 확정한다.
      saverRef.current.flush();

      if (exportStatus.hasChanges) {
        // 브라우저는 자체 문구를 보여준다. 값 설정은 프롬프트를 띄우기 위한 관례.
        event.preventDefault();
        event.returnValue = '';
        return '';
      }
      return undefined;
    };

    // 모바일에서는 beforeunload 가 잘 뜨지 않으므로 화면이 숨을 때 저장만이라도 확정한다.
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') saverRef.current.flush();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [exportStatus.hasChanges]);

  // ─── 액션 ────────────────────────────────────────────────
  const actions = useMemo(() => {
    const withId = (type, payload) => {
      const id = newId();
      dispatch({ type, id, ...payload });
      return id;
    };

    /**
     * 사용자가 덮어쓰기/병합을 고른 뒤 실제 적용.
     * prepareImport 도 이 함수를 직접 부르므로 객체 메서드가 아닌 지역 함수로 둔다.
     * (구조 분해로 꺼내 써도 깨지지 않게)
     */
    const commitImport = (backup, mode) => {
      const result = applyImport(stateRef.current, backup, mode);
      if (!result.ok) {
        setNotice({ level: 'error', message: `${result.error} 기존 데이터는 그대로입니다.` });
        return result;
      }
      dispatch({ type: ACTIONS.DATA_REPLACE, state: result.state });
      return result;
    };

    return {
      // Subject
      addSubject: (input) => withId(ACTIONS.SUBJECT_ADD, input),
      updateSubject: (id, patch) => dispatch({ type: ACTIONS.SUBJECT_UPDATE, id, patch }),
      removeSubject: (id) => dispatch({ type: ACTIONS.SUBJECT_REMOVE, id }),
      reorderSubjects: (order) => dispatch({ type: ACTIONS.SUBJECT_REORDER, order }),

      // Block
      addBlock: (input) => withId(ACTIONS.BLOCK_ADD, input),
      updateBlock: (id, patch) => dispatch({ type: ACTIONS.BLOCK_UPDATE, id, patch }),
      toggleBlock: (id) => dispatch({ type: ACTIONS.BLOCK_TOGGLE, id }),
      removeBlock: (id) => dispatch({ type: ACTIONS.BLOCK_REMOVE, id }),
      reorderBlocks: (subjectId, orderedIds) =>
        dispatch({ type: ACTIONS.BLOCK_REORDER, subjectId, orderedIds }),
      moveBlock: (id, subjectId) => dispatch({ type: ACTIONS.BLOCK_MOVE, id, subjectId }),

      // Entry
      addEntry: (input) => withId(ACTIONS.ENTRY_ADD, input),
      updateEntry: (id, patch) => dispatch({ type: ACTIONS.ENTRY_UPDATE, id, patch }),
      removeEntry: (id) => dispatch({ type: ACTIONS.ENTRY_REMOVE, id }),
      moveEntry: (id, blockId) => dispatch({ type: ACTIONS.ENTRY_MOVE, id, blockId }),

      // 설정
      updateSettings: (patch) => dispatch({ type: ACTIONS.SETTINGS_UPDATE, patch }),

      // 통지
      setNotice,
      dismissNotice: () => setNotice(null),

      /** 내보내기 — 성공하면 lastExportedAt 을 갱신해 배너를 끈다 */
      exportBackup() {
        const result = downloadBackup(stateRef.current);
        if (result.ok) {
          dispatch({ type: ACTIONS.EXPORT_MARK, at: result.exportedAt });
          setNotice({
            level: 'success',
            message: `${result.filename} 파일로 내보냈습니다.`,
          });
        } else {
          setNotice({ level: 'error', message: result.error });
        }
        return result;
      },

      /**
       * 파일을 읽고 검증만 한다. 이 시점까지 저장소는 건드리지 않는다.
       * @returns {{ ok, needsChoice, pending, message }}
       */
      async prepareImport(file) {
        const read = await readFileAsText(file);
        if (!read.ok) {
          setNotice({ level: 'error', message: `${read.error} 기존 데이터는 그대로입니다.` });
          return { ok: false, needsChoice: false, pending: null };
        }

        const parsed = parseBackupText(read.text);
        if (!parsed.ok) {
          setNotice({
            level: 'error',
            message: `가져오기를 중단했습니다. 기존 데이터는 그대로입니다.\n\n${formatErrors(parsed.errors)}`,
          });
          return { ok: false, needsChoice: false, pending: null };
        }

        const preview = previewImport(stateRef.current, parsed.backup);

        // 기존 데이터가 없으면 물어볼 게 없다 (초기화된 공용 PC 시나리오).
        if (preview.isEmpty) {
          commitImport(parsed.backup, IMPORT_MODE.OVERWRITE);
          return { ok: true, needsChoice: false, pending: null };
        }

        return {
          ok: true,
          needsChoice: true,
          pending: { backup: parsed.backup, preview, warnings: parsed.warnings },
        };
      },

      commitImport,

      /** 가져오기 직전 스냅샷으로 되돌리기 */
      restoreLatestSnapshot() {
        const [latest] = listSnapshots();
        if (!latest) {
          setNotice({ level: 'error', message: '되돌릴 스냅샷이 없습니다.' });
          return { ok: false };
        }
        const result = restoreSnapshot(latest);
        if (!result.ok) {
          setNotice({ level: 'error', message: result.error });
          return result;
        }
        dispatch({ type: ACTIONS.DATA_REPLACE, state: result.state });
        setNotice({ level: 'success', message: '가져오기 직전 상태로 되돌렸습니다.' });
        return result;
      },

      resetAll: () => dispatch({ type: ACTIONS.DATA_RESET }),

      /** 저장 대기분을 즉시 확정 (내보내기 직전 등) */
      flushSave: () => saverRef.current.flush(),
    };
  }, []);

  const storeValue = useMemo(
    () => ({ state, index, exportStatus, notice, settings: state.settings }),
    [state, index, exportStatus, notice]
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StoreContext.Provider value={storeValue}>{children}</StoreContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useStore() {
  const value = useContext(StoreContext);
  if (value === null) throw new Error('useStore 는 StoreProvider 안에서만 쓸 수 있습니다.');
  return value;
}

export function useActions() {
  const value = useContext(ActionsContext);
  if (value === null) throw new Error('useActions 는 StoreProvider 안에서만 쓸 수 있습니다.');
  return value;
}

/** 저장소 사용률 — 설정 화면에서 표시 */
export function useStorageUsage() {
  const { state } = useStore();
  return useMemo(() => getStorageUsage(), [state]);
}

export { IMPORT_MODE };
