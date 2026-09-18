import { Link } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import { selectEntriesOfDate, selectSubjectsOnDate } from '../state/selectors.js';
import CalendarPanel from '../components/CalendarPanel.jsx';
import SubjectDot from '../components/SubjectDot.jsx';
import { todayKey, monthKeyOf, formatFullDate } from '../lib/date.js';

/**
 * 홈 = 이번 달 캘린더.
 *
 * 앱을 열면 곧바로 "무슨 날에 뭘 했는지"가 보이는 게 이 도구의 기본 용도라,
 * 캘린더로 한 번 더 들어가게 하지 않는다.
 * 과목 쪽 탐색은 사이드바가 맡는다.
 *
 * 연간 활동 요약 위젯은 4단계에서 캘린더 아래에 붙는다.
 */
export default function Home() {
  const { state, index } = useStore();
  const today = todayKey();

  const todayEntries = selectEntriesOfDate(index, today);
  const todaySubjects = selectSubjectsOnDate(state, index, today);

  return (
    <main className="page">
      <div className="home__head">
        <div>
          <h1 className="page__title">{formatFullDate(today)}</h1>
          <p className="page__sub home__sub">
            {todayEntries.length > 0 ? (
              <>
                오늘 {todayEntries.length}개 기록
                <span className="home__dots">
                  {todaySubjects.map((subject) => (
                    <SubjectDot key={subject.id} subject={subject} size={8} title={subject.name} />
                  ))}
                </span>
                {todaySubjects.map((s) => s.name).join(', ')}
              </>
            ) : (
              '오늘은 아직 기록이 없습니다'
            )}
          </p>
        </div>
        <Link to={`/new?date=${today}`} className="btn btn--primary">
          + 새 기록
        </Link>
      </div>

      <CalendarPanel monthKey={monthKeyOf(today)} />

      {state.subjectOrder.length === 0 && (
        <div className="section">
          <div className="empty">
            아직 과목이 없습니다. 기록을 남기려면 먼저 과목과 진도 단위(블록)를 만드세요.
            <br />
            <Link to="/subjects" className="btn btn--sm" style={{ marginTop: 'var(--sp-3)' }}>
              첫 과목 만들기
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
