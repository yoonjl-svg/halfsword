# 외형 PM 상태 (늘 최신으로 — 디렉터 규칙 ④)

세션 `session_01HNkUuYHag8VSg6xpgbkGVR` · 브랜치 `claude/pm-character-looks` · 갱신 2026-09-29

## 맡은 일
- 캐릭터 겉모습(`src/outfits.js`·`src/looks.js`), 스테이지 배경(`src/stage_*.js`, `src/stages.js`), 픽셀 카드 뒷면(`tools/cardbacks/`), 겉모습 효과(`src/gun_fx.js` 권총 섬광·연기·궤적·레이저, `src/mad_eyes.js` 광기의 하인리히 안광, `src/sword_trail.js` 칼 잔상 띠).
- 온몸 타격 화면 신호의 모양·색(잔상 띠, 금색·회색 흔적, 맞은 느낌 — 뜻은 디렉터). 갑옷 뚫림 점검·수정. 카메라는 디렉터 코드(의견만).

## 끝남 (main 에 있음)
- 칼 잔상 띠 v1: `src/sword_trail.js` + `CONFIG.SWORD_TRAIL` + main.js 네 줄(아래). 사진 `docs/handoff/sword_trail_{cut,cut_zoom,cut_day,rest}.png`.
- 광기의 하인리히 붉은 안광(핏빛·밝기 낮춤·빛꼬리), 권총 효과, 밤의 포세이돈·화전 개간지 스테이지, 판금 밑 속옷, 마르그레테 곁 판, 픽셀 카드 뒷면.

## 열린 요청
- (사장님) 안광 밝기를 게임에서 보시고 더 줄일지 — 대기.
- (디렉터 R4) `trail.setTone('gold'|'grey')` 호출은 디렉터가 넣는다. `swordTrails.attach([player, enemy])` 가 돌려주는 손잡이 두 개(검객 순)에 `setTone` 이 있다 — main.js 에서 잡아 두려면 `const trailHandles = swordTrails.attach(...)`.
- 브랜치에만 남은 것: 픽셀 카드 앞면 실험 파일(되돌리기 결정, main 에 올리지 않음).

## 칼 잔상 띠 — main.js 줄 (병합 확인용)
```
import { createSwordTrails } from './sword_trail.js';
const swordTrails = createSwordTrails(scene);            // 모듈 상단 (installGunFx 바로 위)
  swordTrails.attach([player, enemy]);                   // newRound, madEyes 줄 다음
      swordTrails.sample(PHYSICS.timestep);              // 물리 루프, combat.afterStep 다음
    swordTrails.update();                                // 프레임, auras update 다음
```

## 재현 명령
- 시뮬 3종(main 과 바이트 동일해야): `node tools/sim/fights12.mjs` · `node tools/sim/hybrid.mjs fights12.mjs` · `node tools/sim/live_battery.mjs` (main 은 별도 worktree 에서 같은 명령, `cmp`).
- 스모크: `npx vite --port 5183 --host 127.0.0.1` 뒤 `node tools/browser/smoke.mjs http://127.0.0.1:5183` (콘솔 에러 0).
- 잔상 사진·비용: 스테이지 `?stage=poseidon_night&foe=heinrich&weapon=longsword` 로 싸움을 열고, `scene` 의 `name==='swordTrail'` 메시 `drawRange.count>0` 인 프레임을 저장. 비용은 `createSwordTrails(new Scene())` 를 따로 만들어 `sample(1/120)` 2만 번: 스텝당 0.002~0.004 ms, `update()` 0.001~0.003 ms (스위프트셰이더 헤드리스 기준).
- 안광: `?stage=poseidon_night&foe=heinrich&madEyes=1`.

## 다음 할 일
- (계획만, 디렉터 2번) 동작 연구 PM 클립의 극단 자세에서 마르그레테 뿔 투구·어깨받이·판금 뚫림 점검: 클립(`docs/motion/clips`, large 벌)이 나오면 (가) 클립의 관절 각을 `f.groups` 에 직접 넣고 물리 없이 그리는 자세 뷰어(`tools/browser/`)를 만들어 — 손 머리 위 +0.15 m, 칼끝 등 뒤 1.4 m, 지나가기(손이 반대 엉덩이 옆) — 세 자세에서 (나) 팔·칼 메시와 투구·어깨받이·판금 메시의 바운딩 상자 겹침을 세고 (다) 겹친 곳을 근접 사진으로 찍는다. 실제 확인은 R2 시험판 뒤.
- 사장님 안광 피드백 반영.
