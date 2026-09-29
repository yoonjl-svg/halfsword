# 사운드 PM 상태 (늘 최신으로)

갱신: 2026-09-29 (29차). 브랜치 `claude/pm-sound-impact`. 디렉터 `session_014nJCzE4hyxiYc9innhSUng`. 자세한 규칙은 `sound_pm_handoff.md`, 작업 기록은 `pm-sound-impact.md`.

## 맡은 일
- 모든 소리: `src/sound.js`(엔진·합성·녹음 로딩·BodySounds), `src/soundgen.js`(일꾼), `src/soundlab.js` + `sounds.html`(들어보기), `public/sfx/**`(CC0 위주, 출처 `LICENSE.txt`), `config.js` SOUND 블록.
- `src/main.js`는 디렉터 요청 시 사운드 호출 줄만. `src/fighter.js`·`src/gun.js`·`src/debris.js`는 건드리지 않는다.
- 역할 분담안(main `docs/pm_roles_charter.md` 부록 B): 에너지 눈금(150 J과 500 J이 다르게), 디딤 소리(동작 PM의 딛는 시각 φc·gait onTouchdown 'strike'), 센 타격·딛기가 소리에 맞는지 확인, 라운드 판정에 소리 의견.

## 진행 중 / 끝남 (2026-09-29)
- [끝남] 세기 눈금 준비: `sound.hitWeight(energy, e0)` — 베기·찌르기·강철 충돌 공통. `SOUND.hitScale`('legacy' 기본 = 지금 소리, 'log' = 200 J 위로 로그 무게). `sounds.html` "세기 눈금 A/B" 3행(150/300/500 J). 게임 호출은 안 바꿈.
- [끝남] 디딤 훅: `sound.footStrike(strength 0~1, pos)`. 아직 부르는 곳 없음(디렉터 R2/R4). `sounds.html` "디딤" 행.
- [안 함] 총성 후보: 디렉터 보류(사장님이 원하실 때).

## 열린 요청 / 기다리는 것
- 화전 터(clearing) 소리: 사장님 실제 플레이 피드백 대기.
- R3 에서 디렉터가 `sound.hitScale = 'log'`(또는 config `SOUND.hitScale`)로 넘기고, 타격 호출에 온몸 타격 에너지를 준다.
- R2/R4 에서 디렉터가 gait 딛는 순간에 `sound.footStrike(strength, pos)`를 잇는다.

## 재현 명령
- 시뮬 3종(main과 바이트 동일해야 함): `node tools/sim/live_battery.mjs`, `node tools/sim/fights12.mjs`, `node tools/sim/hybrid.mjs fights12.mjs` — main 워크트리와 `cmp`.
- 스모크: `npx vite --port 5179 --strictPort --host 127.0.0.1` 뒤 `node tools/browser/smoke.mjs http://127.0.0.1:5179` → "ZERO console errors".
- 들어보기: `sounds.html` (같은 vite). 오프라인 렌더는 `window.lab.render({dur, events:[{t, call, args}], samples:true, returnAudio:'b64', seed})`.

## 관문 (최근)
- 29차: 시뮬 3종 main `940f665`와 바이트 동일, 스모크 콘솔 에러 0, 실제 게임 hitScale 'legacy'·w=0 확인.

## 다음 할 일
- 디렉터 지시 대기. 매일 18:00 KST 10줄 보고(끝남/진행 중/안 함 + 커밋 해시).
