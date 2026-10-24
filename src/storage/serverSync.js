// 서버 주소. 서버를 켠 터미널의 "Running on ..." 줄에서 본인 것을 복사해 넣는다. 끝에 / 는 붙이지 않는다.
export const SERVER_URL = 'https://orange-goldfish-qv7rpw7xqpv7f49rx-5000.app.github.dev';

// 봉투 글자를 서버에 올리는 함수. 결과를 { ok: 성공했나, error: 실패 이유 } 모양으로 돌려준다.
export async function uploadToServer(text) {
  try {
    // 서버의 /upload 길로 POST 요청을 보내고, 응답이 올 때까지 기다린다 (몸통은 봉투 글자).
    // Content-Type 은 일부러 적지 않는다. 적으면 브라우저가 사전 확인 요청을 먼저 보내서 일이 늘어난다.
    const res = await fetch(`${SERVER_URL}/upload`, { method: 'POST', body: text });

    // 서버가 답은 했는데 200번대가 아니면(상태 번호가 이상하면) 실패로 돌려준다.
    if (!res.ok) {
      return { ok: false, error: `서버가 올리기를 거절했습니다. (상태 ${res.status})` };
    }
    return { ok: true, error: null }; // 성공
  } catch {
    // 답 자체가 안 온 경우: 서버가 꺼졌거나, 주소가 틀렸거나, 브라우저가 막았을 때
    return { ok: false, error: '서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.' };
  }
}