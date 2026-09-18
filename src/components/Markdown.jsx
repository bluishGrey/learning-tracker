import { lazy, Suspense } from 'react';

/**
 * react-markdown + remark-gfm 은 번들의 큰 덩어리를 차지하는데,
 * 첫 화면(캘린더)에서는 전혀 쓰이지 않는다. 기록 상세를 열 때 받아온다.
 *
 * 네트워크가 느린 곳에서도 내용은 바로 읽을 수 있어야 하므로,
 * 로딩 중에는 원문을 그대로 보여준다 (빈 화면이나 스피너 대신).
 */
const MarkdownBody = lazy(() => import('./MarkdownBody.jsx'));

export default function Markdown({ children }) {
  if (!children?.trim()) return null;

  return (
    <div className="markdown">
      <Suspense fallback={<pre className="markdown__raw">{children}</pre>}>
        <MarkdownBody>{children}</MarkdownBody>
      </Suspense>
    </div>
  );
}
