# 본판 빌드 브라우저 스모크 (2026-10-09 04시, HEAD 7f84051)

**결론: 12 주소 모두 콘솔 에러 0 · 잡히지 않은 예외 0 · 두 사람 모두 살아 있음 · 자세 이름 보임. 설정 패널에 '검술 보정'(`[data-setting="skill"]`) 없음. 고칠 결함 없음.**

## 방법
- `npx vite build` → `npx vite preview --port 4173` (dist/ 그대로)
- `node tools/browser/build_smoke.mjs http://127.0.0.1:4173 <스크린샷 폴더>` (Playwright, 크롬 headless + swiftshader, 화면 480×840)
- 주소마다: 로드 → `window.game.player.sword` 준비 → '싸움 시작' (`?weapon=` 없으면 무기 뽑기에서 내 카드 1번) → `game.state === 'fight'` → 0.5 초마다 20 번(10 초) `#guardName` 글자 읽기, 8 초째 스크린샷(무기 주소만)
- 에러로 세는 것: console.error, pageerror, 요청 실패, HTTP 400 이상

## 결과

| 주소 | 콘솔 에러 | 예외 | 내 무기 / 상대 무기 | 둘 다 살아 있음 | 본 자세 이름 |
|---|---|---|---|---|---|
| `?weapon=longsword` | 0 | 0 | longsword / longsword | 예 | 긴 자세 (Langort) |
| `?weapon=qinggang` | 0 | 0 | qinggang / qinggang | 예 | 직부송서 (直符送書) |
| `?weapon=monohoshizao` | 0 | 0 | monohoshizao / monohoshizao | 예 | 중단 (中段) |
| `?weapon=zweihander` | 0 | 0 | zweihander / zweihander | 예 | 곧은 자세 (postura recta) |
| `?weapon=sabre` | 0 | 0 | sabre / sabre | 예 | 긴 자세 (Langort) · 막기가 끝나는 자리 |
| `?weapon=frozen_tuna` | 0 | 0 | frozen_tuna / frozen_tuna | 예 | 앞으로 겨눔 |
| `?weapon=rapier` | 0 | 0 | rapier / rapier | 예 | 3번 자세 (Terza) |
| `?schoolArt=0` | 0 | 0 | zweihander / excalibur_replica (뽑기) | 예 | 곧은 자세 (postura recta) |
| `?schoolRest=pflugR&weapon=qinggang` | 0 | 0 | qinggang / qinggang | 예 | 직부송서 (直符送書) |
| `?oneVersatile=thrust&weapon=qinggang` | 0 | 0 | qinggang / qinggang | 예 | 직부송서 (直符送書) |
| `?pommel=1` | 0 | 0 | lightsaber / excalibur_replica (뽑기) | 예 | 긴 자세 (Langort) |
| `?motionLib=0` | 0 | 0 | sabre / excalibur_replica (뽑기) | 예 | 긴 자세 (Langort) · 막기가 끝나는 자리 |

설정 패널: `[data-setting="skill"]` 0 개. 보이는 줄 = 상대 난이도 · 조작 흔적 보기 · 자세 이름 보기(켜짐) · 픽셀 모드 · 60 fps 묶기 · 피 표현 · 소리. '이동 방식'·'기울기 반대로'는 `touchOnly` 줄이라 데스크톱 headless 에서 숨김(정상).

## 스크린샷 (저장소 밖)
`<작업 임시 폴더>/browser_smoke_0410/{longsword,qinggang,monohoshizao,zweihander,sabre,frozen_tuna,rapier}.png`
— longsword·rapier·frozen_tuna 세 장 눈으로 확인: 두 사람·칼·배경·일시정지 버튼·조이스틱·자세 이름이 그려짐.

## 한계 (읽을 때 주의)
- swiftshader(소프트웨어 GL)라 느려서 벽시계 10 초 동안 물리 시간은 1.1~2.4 초만 흘렀다. 두 사람은 아직 다가가는 중(둘 다 `stand`)이고 칼이 맞닿는 장면·쓰러짐·폼멜 찍기·hands.js 의 접촉 경로까지는 닿지 않았다. "로드와 첫 2 초에 터지는 것 없음"까지만 확인한 것.
- `?schoolRest=pflugR` 인데 청강검 자세 이름이 직부송서 그대로인 것은 정상: 이 손잡이는 플레이어가 휘두른 뒤 ③ 되돌아오는 자리만 바꾼다(src/config.js:525, src/sword_art.js:82). 이번 스모크는 손을 대지 않아 되돌아옴이 없었다.
