import { Fragment } from 'react';
import { Link } from 'react-router-dom';

/**
 * 파일 탐색기 주소창처럼 현재 진입 경로를 보여준다.
 *
 * 경로는 URL 자체에 인코딩돼 있으므로(캘린더 경로 / 과목 경로) 이 컴포넌트는
 * 각 화면이 넘겨준 items 를 그리기만 한다. 새로고침이나 뒤로가기 후에도
 * 같은 경로가 그대로 복원되는 이유가 이것이다.
 *
 * @param {{ items: Array<{ label: string, to?: string }> }} props
 */
export default function Breadcrumb({ items }) {
  return (
    <nav className="crumbs scroll-x" aria-label="현재 위치">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <span className="crumbs__sep" aria-hidden="true">
                ›
              </span>
            )}
            {isLast || !item.to ? (
              <span className="crumbs__current" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link className="crumbs__link" to={item.to}>
                {item.label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
