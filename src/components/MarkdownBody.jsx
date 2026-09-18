import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 실제 마크다운 렌더러.
 * 무거운 의존성이라 Markdown.jsx 에서 지연 로딩으로 감싼다.
 */

/** 외부 링크는 새 탭으로 열고 referrer 를 넘기지 않는다 */
const components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

export default function MarkdownBody({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
