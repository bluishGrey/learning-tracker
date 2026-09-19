# 다른 PC에서 작업 재개하기 (공용 PC 체크리스트)

> **매번 초기화되는 공용 PC**에서 이 프로젝트를 이어서 작업할 때의 절차.
> 위에서부터 순서대로 따라가면 된다.

## 먼저 이것부터: 동기화할 게 두 개다

가장 많이 하는 실수는 이 둘을 하나로 착각하는 것이다. **경로가 완전히 다르다.**

| | 무엇 | 어디에 있나 | 어떻게 옮기나 |
|---|---|---|---|
| **코드** | 앱 소스 | GitHub 레포 | `git clone` / `git pull` → `git push` |
| **학습 기록** | 실제 공부한 내용 | 그 브라우저의 localStorage | 앱의 **내보내기 / 불러오기** (JSON 파일) |

**`git pull` 을 해도 학습 기록은 따라오지 않는다.** 기록은 레포에 없다.
(`.gitignore` 가 백업 JSON 을 일부러 제외한다 — 개인 기록을 공개 이력에 남기지 않기 위해)

백업 JSON 은 **공용 PC가 아니라 본인 저장소**(개인 클라우드, 메일 등)에 둔다.

---

## 시작할 때

### 1. GitHub 인증

공용 PC에는 인증 정보가 남아 있지 않으므로 매번 다시 로그인한다.

```bash
gh auth login
```

- `GitHub.com` → `HTTPS` → `Login with a web browser` 순서로 고른다.
- `Authenticate Git with your GitHub credentials?` 에 **Yes**.
  이렇게 하면 git 이 gh 를 통해 인증하므로 Windows 자격 증명 관리자에 따로 남지 않는다.
  → **나중에 `gh auth logout` 한 번이면 흔적이 지워진다.**

### 2. 바탕화면에 clone

경로 규칙은 하나로 통일한다. **어떤 PC에서든 바탕화면.**

```bash
cd ~/Desktop && git clone https://github.com/bluishGrey/learning-tracker.git
```

이미 clone 되어 있다면:

```bash
cd ~/Desktop/learning-tracker && git pull
```

### 3. 의존성 설치

`node_modules` 는 레포에 없다. 매번 설치해야 한다.

```bash
npm install
npm run dev
```

> Node 가 없고 설치도 못 하는 PC라면: **https://bluishgrey.github.io/learning-tracker/ 로
> 브라우저에서 바로 접속해 쓴다.**
> 앱을 쓰는 데에는 clone 도 Node 도 필요 없다 — 위 1~3번은 *코드를 고칠 때*의 절차다.
> (학습 기록은 어느 쪽으로 열든 그 브라우저 안에만 있으므로 4번은 똑같이 해야 한다)

### 4. 학습 기록 불러오기 ★

**여기를 빼먹으면 빈 앱을 보게 된다.**

1. 앱 상단의 **불러오기** 를 누른다.
2. 가지고 온 `learning-tracker-backup-*.json` 중 **가장 최신 날짜** 파일을 고른다.
3. 초기화된 PC라면 기존 데이터가 없으므로 바로 들어온다.
   기존 데이터가 남아 있으면 **덮어쓰기 / 병합** 을 묻는다.
   - **병합** — 두 PC 양쪽에서 각각 기록했을 때. 겹치는 건 건너뛰고 새 것만 추가한다.
   - **덮어쓰기** — 이 PC의 기록을 버리고 파일 상태로 되돌릴 때.
   - 헷갈리면 **병합**을 고른다. 기존 기록이 사라지지 않는 쪽이다.

---

## 끝낼 때 (퇴실 전)

### 5. 학습 기록 내보내기 ★

1. 앱 상단의 **내보내기** 를 누른다.
2. 받은 `learning-tracker-backup-YYYY-MM-DD.json` 을 **본인 저장소로 옮긴다.**
   공용 PC의 다운로드 폴더에 두고 나오면 다음에 없다.

> 상단 배너에 `이후 기록 N개` 가 떠 있으면 아직 안 한 것이다.
> 내보내지 않은 변경이 있는 채로 탭을 닫으려 하면 브라우저가 한 번 더 경고한다.

### 6. 코드 push 확인

```bash
git status
git add -A
git commit -m "작업 내용"
git push
```

**`git push` 까지 끝났는지 반드시 확인한다.** 커밋만 하고 push 를 안 하면
PC가 초기화되는 순간 작업이 사라진다. 아래로 확인:

```bash
git status -sb
```

`## main...origin/main` 만 보이고 `[ahead N]` 이 없으면 push 완료다.

### 7. 흔적 지우기

```bash
gh auth logout
```

그 다음:

- 바탕화면의 `learning-tracker` 폴더 삭제
- 브라우저에서 GitHub 로그아웃
- 다운로드 폴더에 남은 백업 JSON 삭제 (**본인 저장소로 옮긴 뒤에**)

> 백업 JSON 을 공용 PC에 남기지 않는다. 학습 기록 전체가 평문으로 들어 있는 파일이다.

---

## 요약 카드

시작:

```bash
gh auth login
cd ~/Desktop && git clone https://github.com/bluishGrey/learning-tracker.git
cd learning-tracker && npm install && npm run dev
# → 앱에서 '불러오기'로 최신 백업 JSON 넣기
```

끝:

```bash
# → 앱에서 '내보내기' 후 파일을 본인 저장소로 옮기기
git add -A && git commit -m "..." && git push
git status -sb          # [ahead N] 이 없어야 함
gh auth logout
# → 바탕화면 폴더 삭제
```

---

## 자주 겪는 문제

**앱을 열었는데 기록이 하나도 없다**
→ 정상이다. 기록은 브라우저 안에만 있다. 4번(불러오기)을 하지 않았다.

**불러오기를 눌렀더니 "학습 트래커 백업 파일이 아닙니다"**
→ 다른 JSON 파일을 골랐다. `learning-tracker-backup-` 으로 시작하는 파일인지 확인한다.

**"파일이 일부 손실된 것 같습니다"**
→ 파일이 전송 중 잘렸다. 다른 백업본으로 시도한다. **기존 데이터는 건드려지지 않았다.**

**덮어쓰기를 실수로 눌렀다**
→ 가져오기 직전 상태가 자동으로 스냅샷에 남는다. 설정 화면에서 되돌릴 수 있다.
다만 **그 브라우저를 닫고 PC가 초기화되면 스냅샷도 사라진다.** 바로 확인할 것.

**`git push` 가 인증을 요구한다**
→ 1번의 `gh auth login` 을 안 했거나 `Authenticate Git...` 에 No 를 눌렀다.
`gh auth setup-git` 을 실행하면 된다.

**두 PC에서 같은 과목을 각각 만들었다**
→ id 가 다르므로 병합하면 **과목이 둘로 나뉜다.** 앱에서 한쪽 기록을 옮기고 빈 과목을 지워야 한다.
피하려면: 새 과목은 한쪽에서만 만들고, 다른 쪽에서는 백업을 불러온 뒤에 기록을 추가한다.
