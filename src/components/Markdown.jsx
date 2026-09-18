import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** 외부 링크는 새 탭으로 열고 referrer 를 넘기지 않는다 */
const components = {
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
};

export default function Markdown({ children }) {
  if (!children?.trim()) return null;
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
