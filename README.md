# 데블스 플랜 1vs1 Game

모바일(Android / iOS)에서 1대1 보드게임을 하는 **게임 팩토리 플랫폼**입니다.
PWA라서 앱스토어 없이 홈 화면에 설치해 앱처럼 쓸 수 있습니다.

- **방 만들기**: 방장이 게임 목록에서 게임을 골라 방을 만듦
- **자동 풀방**: 한 명이 들어오면 방이 꽉 참 (트랜잭션 처리라 동시에 눌러도 1명만 입장)
- **READY → 자동 시작**: 두 명 모두 READY 하는 순간 게임 시작 (선공은 무작위)
- **초대 링크**: 방 안의 🔗 버튼으로 링크 공유 → 받은 사람은 바로 입장
- **재대결 / 기권 / 접속 끊김 표시 / 방장이 나가면 방 삭제**

## 기술 구성

| 영역 | 선택 |
| --- | --- |
| 앱 | React + TypeScript + Vite, PWA (`vite-plugin-pwa`) |
| 서버 | **없음.** Firebase Realtime Database + 익명 로그인 (무료 Spark 플랜) |
| 호스팅 | Firebase Hosting(무료) / GitHub Pages 등 아무 정적 호스팅 |

게임 로직은 모두 클라이언트에서 돌아가고, DB는 **방 정보 + 현재 게임 상태**만 저장합니다.
방 하나가 몇 KB 수준이고 게임이 끝나면 지워지므로 무료 한도(저장 1GB, 다운로드 월 10GB)에 넉넉히 들어갑니다.
무료 플랜의 실제 제약은 **동시 접속 100명**입니다.

## 실행

```bash
npm install
npm run dev
```

Firebase 설정이 없으면 **로컬 테스트 모드**로 동작합니다. 같은 브라우저에서 탭을 두 개 열면 서로 대전할 수 있습니다.

## Firebase 연결 (5분)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다.
2. **Authentication → 로그인 방법 → 익명** 을 사용 설정합니다.
3. **Realtime Database** 를 만듭니다. 위치는 `asia-southeast1` 이 한국에서 가장 가깝습니다.
4. **프로젝트 설정 → 내 앱 → 웹 앱 추가** 후 설정값을 `.env.example` 형식대로 `.env.local` 에 넣습니다.
5. 보안 규칙을 배포하고 호스팅에 올립니다.

```bash
npm i -g firebase-tools && firebase login
firebase use --add
npm run build && firebase deploy
```

배포된 주소를 폰에서 엽니다.
- **Android(Chrome)**: 메뉴 → "앱 설치"
- **iOS(Safari)**: 공유 → "홈 화면에 추가"

## 새 게임 추가하기

1. `src/games/<게임이름>/index.tsx` 를 만들고 `GameDefinition` (`src/games/types.ts`) 을 구현합니다.
   - `setup()` : 초기 상태
   - `currentTurn()` : 누구 차례인지 (동시 진행 게임이면 `null`)
   - `applyMove()` : 수를 검증하고 다음 상태를 반환하는 **순수 함수**
   - `getResult()` : 승패 판정
   - `Board` : 화면 컴포넌트
2. `src/games/registry.ts` 의 `GAMES` 배열에 추가합니다. 그러면 방 만들기 목록에 자동으로 나타납니다.

선택 기능:
- `options` : 방 만들 때 방장이 고르는 설정 (선택지 / 슬라이더). `setup()`, `rules()`, `Guide` 에 그대로 전달됩니다.
- `Guide` : 대기실·게임 중 [룰] 버튼으로 여는 그림 가이드
- `scoreOf` : 선수 카드에 보이는 점수 (라운드제 게임)
- 시간제 게임은 `BoardProps.now()` (서버 시계)와 `{ type: 'tick' }` 같은 수를 이용해 단계를 넘깁니다. `src/games/memoryPoker` 참고.

들어 있는 게임: `기억 포커`, `틱택토`, `사목`(4개 잇기)

## 알아둘 점

- **숨겨진 정보가 있는 게임**(손패, 비밀 숫자 등): 서버가 없으므로 상태가 DB에 그대로 저장됩니다. 따라서 마음먹으면 상대 정보를 볼 수 있습니다.
  친구끼리 하는 수준이면 화면에서만 가리면 충분합니다. 더 엄격하게 하려면 커밋-리빌 방식(선택을 해시로 먼저 제출하고 나중에 공개)을 쓰면 됩니다. 이 방식도 무료 플랜에서 가능합니다.
  Cloud Functions는 유료(Blaze) 플랜이 필요합니다.
- 방장의 연결이 10분 이상 끊긴 방, 또는 24시간이 지난 방은 로비에 접속한 다른 사용자가 자동으로 정리합니다.
