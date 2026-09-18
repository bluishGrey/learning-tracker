import { useEffect, useState } from 'react';

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
 */
export default function SvgEmbed({ code }) {
  const [html, setHtml] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!code?.trim()) {
      setHtml(null);
      setStatus('empty');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    import('dompurify')
      .then(({ default: DOMPurify }) => {
        if (cancelled) return;
        const clean = DOMPurify.sanitize(code, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['use'],
        });
        setHtml(clean.trim().length > 0 ? clean : null);
        setStatus(clean.trim().length > 0 ? 'ready' : 'invalid');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (status === 'empty') return null;
  if (status === 'loading') return <div className="svg-embed svg-embed--loading">SVG 불러오는 중…</div>;
  if (status === 'invalid') return <p className="svg-embed__error">SVG 코드를 표시할 수 없습니다.</p>;
  if (status === 'failed') {
    return <p className="svg-embed__error">SVG 렌더러를 불러오지 못했습니다. 새로고침해 주세요.</p>;
  }

  return (
    <div
      className="svg-embed"
      // 위에서 DOMPurify 로 정제한 결과만 들어간다.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
