import { useMemo } from 'react';
import DOMPurify from 'dompurify';

/**
 * 붙여넣은 SVG 코드를 렌더링한다.
 *
 * 내가 붙여넣은 내 데이터지만 그대로 innerHTML 에 넣지는 않는다.
 * claude.ai 등에서 복사해 온 코드에 script 나 이벤트 핸들러가 섞여 있으면
 * 앱 전체가 영향을 받기 때문에, 항상 정제한 뒤 렌더한다.
 */
export default function SvgEmbed({ code }) {
  const html = useMemo(() => {
    if (!code?.trim()) return null;
    const clean = DOMPurify.sanitize(code, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['use'],
    });
    return clean.trim().length > 0 ? clean : null;
  }, [code]);

  if (html === null) {
    return <p className="svg-embed__error">SVG 코드를 표시할 수 없습니다.</p>;
  }

  return (
    <div
      className="svg-embed"
      // 위에서 DOMPurify 로 정제한 결과만 들어간다.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
