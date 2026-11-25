# 물리 2.0 시험 페이지 `/physics2/` (11/25)

> 사장님 11/25 '내가 테스트해볼 방법은?' → '아까 말한 1번도 동시에 수행해'.
> 새 다리(넷째 판)를 본판에 넣지 않고, 앱의 하위 주소에서 사장님이 직접 해 보는 판이다. 생사전 시험판(`/saengsa/`)과 같은 방식이다.

## 1. 무엇인가

- 주소(본판에 붙은 뒤): `https://yoonjl-svg.github.io/halfsword/physics2/test.html` (무기 · 인물을 골라 바로 싸움) · `…/physics2/` (게임 처음부터).
- 내용: 이 가지(`physics-2`)의 게임에 새 다리 패치 `physics2_proto/legs_b4.patch` 의 `src` 몫만 붙여 빌드한 것. 독립 검증을 받은 합친 나무와 `src` 가 같다(파일 해시로 견줌).
- 본판은 그대로다. 게임 코드에 켬/끔이 생기지 않고, 이 가지의 `src/` 도 안 바뀐다. 패치는 빌드 때 임시 사본(`.tmp/physics2_src`)에만 붙는다.
- 이 가지는 main `8864f7c0` 에서 갈렸다. 그 뒤 main 에 들어간 것(11/25 현재 커밋 2 개 · `src` 3 줄)은 시험 페이지에 없다.

## 2. 시험 페이지에서만 다른 것 (모두 `tools/physics2_page/build.mjs` 가 빌드 때 한다)

| 무엇 | 어떻게 | 까닭 |
|---|---|---|
| 저장 가르기 | 네 페이지 머리에 `trial_storage.js` 를 그대로 넣어 `localStorage` 열쇠 앞에 `stillness.p2trial.` 을 붙인다 | 같은 출처라 본 게임 저장(금화 · 스킬트리 · 여정 · 계정)과 섞이면 안 된다 |
| 서비스 워커 등록 안 함 | `src/pwa.js` 가 생사전 시험판에 쓰는 '등록 안 함' 갈래를 늘 타게 한다(그 줄이 없어지면 빌드가 멈춘다) | 설치 · 오프라인 없이 웹으로만 |
| 매니페스트 링크 뺌 | 페이지 머리에서 지운다 | 또 하나의 'Stillness' 앱으로 설치되지 않게 |
| 표시 | 탭 제목 끝과 화면 아래 가운데에 '물리 2.0 시험판' | 본판과 헷갈리지 않게 |

## 3. 본판(main)에 붙이는 법 — 디렉터 몫

`physics2_proto/trial_page_main.patch` 를 main 에 붙인다(`origin/main d6ea393c` 에 `git apply --check` 통과). 세 곳이다.

1. `.github/workflows/deploy.yml`: `physics-2` 가지를 `.p2` 로 따로 받아 `node tools/physics2_page/build.mjs` 를 돌리고, 다 지은 뒤에 `public/physics2` 로 옮긴다. 두 걸음 모두 `continue-on-error` 라 실패해도 본판 배포는 간다(시험 페이지만 빠진다).
2. `tools/pwa/build.mjs`: `EXCLUDED_DIRS` 에 `physics2` 를 더한다(본 게임 오프라인 목록에서 뺌 — 서비스 워커는 목록 밖 주소를 가로채지 않는다).
3. `.gitignore`: `public/physics2/` · `.p2/`.

- 그 뒤로는 main 이 배포될 때마다 `physics-2` 의 그때 머리로 시험 페이지가 다시 지어진다.
- 걷는 법: 위 세 곳을 되돌리면 다음 배포에서 `/physics2/` 가 사라진다. 시험판 저장(`stillness.p2trial.*`)은 폰에 남지만 본판은 읽지 않는다.

## 4. 확인한 것 (11/25 · 선임이 직접)

- 배포 리허설: `origin/main` 의 깨끗한 사본에 위 패치를 붙이고 배포와 같은 차례로 돌렸다(생사전 시험판 → `.p2` 에서 시험 페이지 → `npm run build`). `dist/physics2/` 가 생기고, `pwa-build.json` 의 뺀 폴더에 `physics2` 가 들며, `sw.js` 안에 `physics2` 는 0 번 나온다.
- 같은 출처 · 같은 브라우저 프로필 점검(`tools/physics2_page/isolation_check.mjs` · 폰 가로 844 × 390 · 터치): **PASS**.
  - 본판은 지금 다리 · 시험 페이지는 새 다리(`player.legDrive`).
  - 시험 페이지는 본판 열쇠를 못 읽는다. 시험 페이지에서 싸우고 `localStorage.clear()` 까지 한 뒤에도 본판 열쇠 넷은 값까지 그대로다.
  - 서비스 워커 등록은 본판 것 하나 그대로 · 시험 페이지에 매니페스트 없음 · 콘솔 에러 0.
- 새 다리 빌드를 따로 띄워 롱소드 · 레이피어 · 츠바이핸더로 17 초쯤씩 서고 걷고 싸움: 예외 0.
- 다시 재는 법:

```
# 본판 사본(패치 붙임)에서
git clone … && cd halfsword && git apply <trial_page_main.patch>
git worktree add --detach .p2 origin/physics-2 && (cd .p2 && npm ci && node tools/physics2_page/build.mjs /tmp/p2out && cp -r /tmp/p2out ../public/physics2)
npm ci && npm run build
mkdir -p /tmp/pages && ln -s "$PWD/dist" /tmp/pages/halfsword && python3 -m http.server 4188 --directory /tmp/pages &
node .p2/tools/physics2_page/isolation_check.mjs http://127.0.0.1:4188/halfsword/ /tmp/p2shots
```

## 5. 안 한 것 · 알아 둘 것

- 폰에서의 프레임 속도는 재지 않았다. 계산기에서는 새 다리의 물리 한 걸음이 지금 게임보다 22 % 쯤 더 든다(롱소드 AI 싸움 12 판: 40.4 s 대 49.5 s).
- 시험 페이지의 게임은 나쁜 점이 그대로다: 싸우다 스스로 자주 넘어지고, 뛰기가 느리고, 걸으며 런지하면 뒷발이 나가고, 마무리 찌르기가 잘 안 들어간다(`physics2_round4_2026-11-25.md` §2 · §5 · §10).
- 시험판 저장은 본판과 따로라 처음 열면 새 게임이다(공지 → 첫 화면). 계정 연결도 따로다.
- 생사전 시험판(`/saengsa/`)과는 열쇠 앞이 달라 저장이 서로 안 섞인다.
