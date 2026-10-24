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

// 서버에 보관된 봉투 글자를 받아오는 함수. 결과를 { ok, text, error } 모양으로 돌려준다.
export async function downloadFromServer() {
  try {
    // 서버의 /download 길로 GET 요청을 보낸다 (방식을 안 적으면 GET이다).
    // cache: 'no-store' 는 "예전에 받은 답을 재사용하지 말고 매번 서버에 새로 물어봐라"는 뜻이다.
    const res = await fetch(`${SERVER_URL}/download`, { cache: 'no-store' });

    // 404: 서버가 "보관한 게 없어요"라고 정상적으로 답한 경우 (연결 실패와는 다르다)
    if (res.status === 404) {
      return { ok: false, text: null, error: '서버에 보관된 백업이 아직 없습니다. 먼저 "서버에 올리기"를 해 주세요.' };
    }
    // 그 밖에 200번대가 아닌 답
    if (!res.ok) {
      return { ok: false, text: null, error: `서버가 받기를 거절했습니다. (상태 ${res.status})` };
    }

    const text = await res.text(); // 응답 몸통을 글자로 꺼낸다 (이것도 기다려야 한다)
    return { ok: true, text, error: null }; // 성공: 받은 봉투 글자를 함께 돌려준다
  } catch {
    // 답 자체가 안 온 경우: 서버가 꺼졌거나, 주소가 틀렸거나, 브라우저가 막았을 때
    return { ok: false, text: null, error: '서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.' };
  }
}