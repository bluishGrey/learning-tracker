// 서버 주소. 서버를 켠 터미널의 "Running on ..." 줄에서 본인 것을 복사해 넣는다. 끝에 / 는 붙이지 않는다.
export const SERVER_URL = 'https://orange-goldfish-qv7rpw7xqpv7f49rx-5000.app.github.dev';

// 로그인해서 서버에게 받은 증표(세션 ID)를 들고 있는 칸. null 이면 로그인 안 한 상태다.
// 이 변수는 열린 탭 안에만 있어서, 새로고침하거나 탭을 닫으면 사라진다 (그러면 다시 로그인한다).
let sessionId = null;

// 지금 증표를 들고 있는지 알려주는 함수. 버튼을 누를 때 "로그인 창을 띄워야 하나?"를 판단하는 데 쓴다.
export function isLoggedIn() {
  return sessionId !== null;
}

// 비밀번호를 서버의 /login 길로 보내고, 맞으면 돌려받은 증표를 위 칸에 보관한다.
export async function login(password) {
  try {
    // 비밀번호를 요청 몸통에 글자 그대로 싣는다 (서버의 login()이 몸통을 비밀번호로 읽는다).
    const res = await fetch(`${SERVER_URL}/login`, { method: 'POST', body: password });

    // 401: 서버가 "비밀번호가 틀렸다"고 답한 경우 (연결 실패와는 다르다)
    if (res.status === 401) {
      return { ok: false, error: '비밀번호가 맞지 않습니다.' };
    }
    if (!res.ok) {
      return { ok: false, error: `서버가 로그인을 거절했습니다. (상태 ${res.status})` };
    }

    sessionId = await res.text(); // 서버가 응답 몸통으로 준 긴 무작위 글자 = 증표. 보관해 둔다.
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: '서버에 연결하지 못했습니다. 서버가 켜져 있는지 확인해 주세요.' };
  }
}

// 봉투 글자를 서버에 올리는 함수. 결과를 { ok: 성공했나, error: 실패 이유 } 모양으로 돌려준다.
export async function uploadToServer(text) {
  try {
    // 서버의 /upload 길로 POST 요청을 보낸다 (몸통은 봉투 글자).
    // headers 의 Authorization 칸에 증표를 실어 보낸다. 서버는 이걸 보고 "로그인한 사람"인지 확인한다.
    // (이 헤더가 붙으면 브라우저가 본 요청 전에 사전 확인(OPTIONS)을 자동으로 보낸다.
    //  서버의 after_request 에 넣은 Access-Control-Allow-Headers 가 그 질문에 대한 허락이다.)
    const res = await fetch(`${SERVER_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: sessionId },
      body: text,
    });

    // 401: 서버가 이 증표를 모른다 (서버가 재시작됐거나 증표가 틀림). 증표를 비워서 "로그인 안 한 상태"로 되돌린다.
    if (res.status === 401) {
      sessionId = null;
      return { ok: false, error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    }
    // 서버가 답은 했는데 200번대가 아니면 실패로 돌려준다.
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
    // 서버의 /download 길로 GET 요청을 보낸다. 여기도 증표를 Authorization 칸에 실어 보낸다.
    // cache: 'no-store' 는 "예전에 받은 답을 재사용하지 말고 매번 서버에 새로 물어봐라"는 뜻이다.
    const res = await fetch(`${SERVER_URL}/download`, {
      cache: 'no-store',
      headers: { Authorization: sessionId },
    });

    // 401: 업로드와 같은 이유로 증표를 비우고 로그인을 다시 요청하게 한다.
    if (res.status === 401) {
      sessionId = null;
      return { ok: false, text: null, error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
    }
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
