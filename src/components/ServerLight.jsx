import { useEffect, useState } from 'react';
import { checkServer } from '../storage/serverSync.js';

// 서버에 몇 초마다 물어볼지 (밀리초). 30초면 서버가 꺼져도 최대 30초 안에 알아챈다.
const POLL_MS = 30000;

// 상태 글자 → 불빛 색(CSS 클래스)과 설명 문구
const LOOK = {
  checking: { cls: 'serverlight__dot--check', text: '서버 확인 중…' },
  login: { cls: 'serverlight__dot--ok', text: '서버 연결됨 · 로그인됨' },
  nologin: { cls: 'serverlight__dot--warn', text: '서버 연결됨 · 로그인 필요' },
  down: { cls: 'serverlight__dot--down', text: '서버에 연결할 수 없음' },
};

/**
 * 서버 상태 표시등.
 * 초록 = 켜져 있고 로그인됨 / 노랑 = 켜져 있지만 로그인 필요 / 빨강 = 연결 안 됨.
 * 색만으로 뜻을 전하지 않도록 마우스를 올리면(title) 글자로도 알려준다.
 *
 * refreshKey 가 바뀌면 30초를 기다리지 않고 즉시 다시 확인한다
 * (로그인한 직후, 올리기·받기를 끝낸 직후).
 */
export default function ServerLight({ refreshKey }) {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let alive = true; // 이 효과가 정리된 뒤에 늦게 도착한 답으로 화면을 바꾸지 않기 위한 표시

    const run = async () => {
      const result = await checkServer();
      if (alive) setState(result);
    };

    run(); // 나타날 때와 refreshKey 가 바뀔 때 즉시 한 번

    // 그 뒤로는 30초마다. 탭이 가려져 있으면(다른 탭을 보는 중이면) 묻지 않는다.
    const timer = setInterval(() => {
      if (!document.hidden) run();
    }, POLL_MS);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [refreshKey]);

  const look = LOOK[state];

  return (
    <span className="serverlight" role="status" title={look.text} aria-label={look.text}>
      <span className={`serverlight__dot ${look.cls}`} aria-hidden="true" />
    </span>
  );
}
