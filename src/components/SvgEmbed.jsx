import { useEffect, useState } from 'react';
import { validateSvgCode, SVG_ISSUE } from '../lib/svgValidate.js';

/**
 * 붙여넣은 SVG 코드를 렌더링한다.
 *
 * 내가 붙여넣은 내 데이터지만 그대로 innerHTML 에 넣지는 않는다.
 * claude.ai 등에서 복사해 온 코드에 script 나 이벤트 핸들러가 섞여 있으면
 * 앱 전체가 영향을 받기 때문에, 항상 정제한 뒤 렌더한다.
 * (저장은 원문 그대로 하고, 화면에 그릴 때마다 정제한다)
 *
 * DOMPurify 는 SVG 가 있는 기록에서만 필요하므로 지연 로딩한다.
 * 정제가 끝나기 전에는 아무것도 렌더하지 않는다 — 원본을 잠깐이라도
 * DOM 에 넣으면 지연 로딩의 의미가 없어진다.
 *
 * 검사는 세 겹이다. 실패의 원인이 서로 달라서 한 문장으로 뭉뚱그릴 수 없다.
 *   1. 형식(svgValidate)  — 애초에 SVG 가 아니거나 잘린 코드. 렌더를 시도하지 않는다.
 *   2. 문법(DOMParser)    — XML 로는 깨졌지만 브라우저가 그리긴 하는 코드. 경고만 하고 그린다.
 *   3. 정제(DOMPurify)    — 정제 후 남는 게 없으면 그제야 "표시할 수 없다".
 */
export default function SvgEmbed({ code }) {
  const [view, setView] = useState({ status: 'loading', html: null, message: null, warnings: [] });

  useEffect(() => {
    const checked = validateSvgCode(code);

    if (checked.issue === SVG_ISSUE.EMPTY) {
      setView({ status: 'empty', html: null, message: null, warnings: [] });
      return undefined;
    }
    if (checked.blocking) {
      setView({ status: 'invalid', html: null, message: checked.message, warnings: [] });
      return undefined;
    }

    let cancelled = false;
    setView({ status: 'loading', html: null, message: null, warnings: [] });

    import('dompurify')
      .then(({ default: DOMPurify }) => {
        if (cancelled) return;

        const clean = DOMPurify.sanitize(checked.code, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['use'],
        });

        if (clean.trim().length === 0) {
          setView({
            status: 'invalid',
            html: null,
            message:
              'SVG 코드에서 표시할 수 있는 내용이 없습니다. 스크립트나 허용되지 않는 태그만 들어 있었을 수 있습니다.',
            warnings: [],
          });
          return;
        }

        setView({
          status: 'ready',
          html: clean,
          message: null,
          warnings: [...checked.warnings, ...findSyntaxWarnings(checked)],
        });
      })
      .catch(() => {
        if (!cancelled) setView({ status: 'failed', html: null, message: null, warnings: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (view.status === 'empty') return null;
  if (view.status === 'loading') {
    return <div className="svg-embed svg-embed--loading">SVG 불러오는 중…</div>;
  }
  if (view.status === 'failed') {
    return <p className="svg-embed__error">SVG 렌더러를 불러오지 못했습니다. 새로고침해 주세요.</p>;
  }
  if (view.status === 'invalid') {
    return <p className="svg-embed__error">{view.message ?? 'SVG 코드를 표시할 수 없습니다.'}</p>;
  }

  return (
    <>
      {view.warnings.length > 0 && (
        <ul className="svg-embed__warnings">
          {view.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      <div
        className="svg-embed"
        // 위에서 DOMPurify 로 정제한 결과만 들어간다.
        dangerouslySetInnerHTML={{ __html: view.html }}
      />
    </>
  );
}

/**
 * XML 로 파싱해 문법이 깨졌는지 본다. 깨졌어도 렌더는 막지 않는다 —
 * 브라우저의 HTML 파서는 관대해서 어지간한 SVG 는 그려내기 때문이다.
 * 대신 "그림이 이상하면 이것 때문"이라고 미리 알려준다.
 *
 * 앞에 설명 문장이 섞인 경우는 이미 별도 경고가 나가므로 건너뛴다.
 * 같은 원인으로 두 줄이 겹쳐 뜨면 읽는 사람만 헷갈린다.
 */
function findSyntaxWarnings(checked) {
  if (checked.warnings.length > 0) return [];
  if (typeof DOMParser === 'undefined') return [];

  try {
    const doc = new DOMParser().parseFromString(checked.code, 'image/svg+xml');
    const error = doc.querySelector('parsererror');
    if (!error) return [];

    const detail = (error.textContent ?? '').split('\n').map((s) => s.trim()).filter(Boolean)[0];
    return [
      `SVG 문법에 문제가 있습니다${detail ? `: ${detail}` : ''}. 일부가 제대로 보이지 않을 수 있습니다.`,
    ];
  } catch {
    return [];
  }
}
