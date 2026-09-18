import { Link } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';

export default function NotFound() {
  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: '없는 경로' }]} />
      <h1 className="page__title">찾을 수 없는 화면입니다</h1>
      <p className="page__sub">주소가 잘못되었거나 해당 항목이 삭제되었습니다.</p>
      <Link to="/" className="btn btn--primary">
        홈으로
      </Link>
    </main>
  );
}
