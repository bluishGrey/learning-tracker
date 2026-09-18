import { Link } from 'react-router-dom';
import { useStore } from '../state/StoreContext.jsx';
import {
  selectSubjectList,
  selectEntriesOfDate,
  selectSubjectsOnDate,
} from '../state/selectors.js';
import SubjectDot from '../components/SubjectDot.jsx';
import { todayKey, monthKeyOf, formatFullDate } from '../lib/date.js';

/**
 * 홈. 두 갈래 경로(캘린더 / 과목)의 출발점이다.
 * 연간 활동 요약 위젯은 4단계에서 이 아래에 붙는다.
 */
export default function Dashboard() {
  const { state, index } = useStore();
  const today = todayKey();

  const subjects = selectSubjectList(state, index, today);
  const todayEntries = selectEntriesOfDate(index, today);
  const todaySubjects = selectSubjectsOnDate(state, index, today);
  const activeSubjects = subjects.filter((row) => row.alpha > 0);

  return (
    <main className="page">
      <h1 className="page__title">{formatFullDate(today)}</h1>
      <p className="page__sub">
        {todayEntries.length > 0
          ? `오늘 ${todayEntries.length}개 기록 · ${todaySubjects.map((s) => s.name).join(', ')}`
          : '오늘은 아직 기록이 없습니다'}
      </p>

      <Link to="/new" className="btn btn--primary btn--block">
        + 새 기록
      </Link>

      <nav className="section navcards">
        <Link to={`/calendar/${monthKeyOf(today)}`} className="card navcard">
          <span className="navcard__title">캘린더</span>
          <span className="navcard__desc">날짜별로 그날 뭘 했는지 되짚어 보기</span>
        </Link>

        <Link to="/subjects" className="card navcard">
          <span className="navcard__title">과목</span>
          <span className="navcard__desc">과목별 진도와 블록 진행 상황 보기</span>
          {subjects.length > 0 && (
            <span className="navcard__dots">
              {subjects.map((row) => (
                <SubjectDot
                  key={row.subject.id}
                  hue={row.subject.colorHue}
                  alpha={row.alpha}
                  size={9}
                  title={row.subject.name}
                />
              ))}
            </span>
          )}
        </Link>
      </nav>

      {subjects.length === 0 ? (
        <div className="section">
          <div className="empty">
            아직 과목이 없습니다.
            <br />
            <Link to="/subjects" className="btn btn--sm" style={{ marginTop: 'var(--sp-3)' }}>
              첫 과목 만들기
            </Link>
          </div>
        </div>
      ) : (
        <section className="section">
          <div className="section__head">
            <h2 className="section__title">최근 활동</h2>
            <Link to="/subjects" className="btn btn--ghost btn--sm">
              전체 보기
            </Link>
          </div>

          {activeSubjects.length === 0 ? (
            <p className="page__sub">
              최근 {state.settings.inactivityDays}일 동안 활동한 과목이 없습니다.
            </p>
          ) : (
            <ul className="stack recent">
              {activeSubjects.map((row) => (
                <li key={row.subject.id}>
                  <Link to={`/subjects/${row.subject.id}`} className="card recent__item">
                    <SubjectDot hue={row.subject.colorHue} alpha={row.alpha} size={10} />
                    <span className="recent__name">{row.subject.name}</span>
                    <div className="spacer" />
                    <span className="card__meta">
                      {row.progress.hasTarget ? `${row.progress.percent}%` : '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
