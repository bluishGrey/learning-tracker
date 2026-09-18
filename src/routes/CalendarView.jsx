import { useParams, Navigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb.jsx';
import CalendarPanel from '../components/CalendarPanel.jsx';
import { isValidMonthKey, formatMonthLabel, monthKeyOf, todayKey } from '../lib/date.js';

/** 캘린더 전용 화면 — 이번 달이 아닌 달을 볼 때 쓴다 (홈은 항상 이번 달) */
export default function CalendarView() {
  const { monthKey } = useParams();

  if (!isValidMonthKey(monthKey)) {
    return <Navigate to={`/calendar/${monthKeyOf(todayKey())}`} replace />;
  }

  return (
    <main className="page">
      <Breadcrumb items={[{ label: '홈', to: '/' }, { label: formatMonthLabel(monthKey) }]} />
      <h1 className="page__title">캘린더</h1>
      <CalendarPanel monthKey={monthKey} />
    </main>
  );
}
