import { normalizeDiagram, normalizePercent, normalizeSvg } from '../storage/schema.js';

/**
 * 블록 정보가 어떻게 바뀌는지 — 기록 가져오기에 ---BLOCK--- 가 함께 들어왔을 때 보여준다.
 *
 * 기록을 가져오는 줄 알았는데 블록 설명까지 덮어써지면 놀란다. 무엇이 바뀌는지
 * 항목별로 먼저 보여주고, 그 화면의 반영 버튼을 눌러야 실제로 바뀐다.
 * 비교는 저장할 때와 같은 정규화를 거친 값끼리 한다 (공백만 다른 SVG 를 '바뀜'으로 보지 않게).
 * 블록 정보에 적히지 않은 항목(undefined)은 바뀌지 않는다. '(지움)'으로 적힌 항목만 비워진다.
 */
const FIELDS = [
  { key: 'description', label: '설명', norm: (v) => String(v ?? ''), show: (v) => (v ? `${v.split('\n').length}줄` : '없음') },
  { key: 'progressPercent', label: '진행률', norm: normalizePercent, show: (v) => (v == null ? '없음' : `${v}%`) },
  { key: 'diagramCode', label: '다이어그램', norm: normalizeDiagram, show: (v) => (v ? `${v.split('\n').length}줄` : '없음') },
  { key: 'svgCode', label: 'SVG', norm: normalizeSvg, show: (v) => (v ? `${v.length}자` : '없음') },
];

/** 바뀌는 항목 이름들 — 안내 문구에 쓴다 */
export function changedBlockFields(block, patch) {
  return FIELDS.filter((f) => patch?.[f.key] !== undefined && f.norm(block?.[f.key]) !== f.norm(patch[f.key])).map(
    (f) => f.label
  );
}

export default function BlockInfoDiff({ block, patch }) {
  const changed = changedBlockFields(block, patch);

  return (
    <div className="blockdiff">
      <div className={`callout ${changed.length > 0 ? 'callout--warn' : 'callout--info'}`}>
        {changed.length > 0 ? (
          <>
            <strong>
              &apos;{block?.name}&apos; 블록의 {changed.join(' · ')}
              {changed.length === 1 ? '이(가)' : '이'} 바뀝니다.
            </strong>
            <p className="field__hint">같은 텍스트에 블록 정보(---BLOCK---)가 함께 들어 있습니다.</p>
          </>
        ) : (
          <strong>블록 정보는 지금과 같습니다. 갱신 시각만 새로 기록합니다.</strong>
        )}
      </div>
      <dl className="paste__preview">
        {FIELDS.map((f) => {
          const before = f.norm(block?.[f.key]);
          // 블록 정보에 적히지 않은 항목은 바꾸지 않는다
          const omitted = patch?.[f.key] === undefined;
          const after = omitted ? before : f.norm(patch[f.key]);
          const same = before === after;
          return (
            <div key={f.key} className="paste__previewrow">
              <dt>{f.label}</dt>
              <dd>
                {same ? (
                  <span className="blockdiff__same">
                    그대로 ({f.show(after)}){omitted ? ' · 적히지 않음' : ''}
                  </span>
                ) : (
                  <>
                    {f.show(before)} → <strong>{after == null || after === '' ? '없음 (지움)' : f.show(after)}</strong>
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
