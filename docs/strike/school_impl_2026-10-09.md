# 유파 자료 ②③ 구현 — 일본·중국 (2026-10-09, 2 등급 작업자)

가지 `…/school-impl-2q36ha` (c2308b4 위). main 푸시 없음. 설계 `docs/strike/sword_art_layers_design_2026-10-08.md` §3·§9·§13, 자료 `docs/motion/schools/school_japanese_draft.md`·`school_chinese_draft.md`.

**한 줄**: 두 초안을 `src/schools.js TRADITIONS` 의 일본·중국 칸에 자료로 넣고, 스위치 하나(`SKILL.schoolArt`, 기본 0)로 이었다. 끄면 판은 바이트까지 같다(관문 다섯 + 결투 네 줄). 켜면 바뀌는 것은 AI 의 기술 고르기(가중치)와 중국 맞받아치기뿐이고, 48 판에서 그 차이는 모두 소음 폭(±14 점) 안이다 — 아래 §4.

## 1. 무엇을 이었고 무엇은 자료만인가

| 칸 | 어디 | 기본(스위치 0) | 스위치 1 | 비고 |
|---|---|---|---|---|
| 자세 이름 `names` 14 자리 | schools.js `JAPANESE_NAMES`·`CHINESE_NAMES` → sword_art.js `schoolNames` → `art.names` | **늘 켬** (HUD 이름·설명만) | 같음 | 바탕 자리 이름 `GUARDS[i].name` 으로 맞춘다(틀 표의 보이는 이름이 아니라). 표(`table`)는 고치지 않는다 — frames.js 가 바탕 이름을 열쇠로 표를 덮기 때문. `.names` 를 읽는 곳은 main.js HUD 하나(grep), 표 이름을 읽는 곳은 hands.js 레이피어 손 돌림(겉모습)과 도구뿐 — 판에 닿지 않는다 |
| 기술 가중치 `techK` | sword_art.js `applySchoolArt` (꾸러미 lazy, 라이브러리 병합 뒤) | 안 씀 | 씀 (`SCHOOL_ART.weights`) | 열쇠 '몸 틀:싸움 방식' → '몸 틀:*' → '*' 처음 맞는 칸 하나, `thrust` = 찌르기 기술 모두. 받은 꾸러미를 고치지 않고 새 꾸러미 |
| 쉴 자세 `rest` | sword_art.js `restGuardOf` → `art.restGuard.pad` → skill.js ③ 되돌아옴 | `SKILL.homeGuard` | 유파 rest 패드 (`SCHOOL_ART.rest`) | 일본·중국 기본 `'pflugR'`(안 B) = homeGuard 와 같은 자리 → 켜도 바이트 그대로. 안 A `'langort'` 는 확인표 198 |
| 맞받아치기 `counterArt` (중국만) | sword_art.js `applySchoolArt` | 안 씀 | 씀 (`SCHOOL_ART.counter`) | `{ default: ['stichPflug', 'zwerch', 'zornhau'] }` (초안 §8). 열쇠를 `counter` 로 두지 않았다: 꾸러미 조립(`pack`)이 유파의 `counter` 를 그대로 가져가 끔에서도 판이 바뀐다 |
| 새 기술 `newTech` (→ 10/9 고유 동작 단계에서 `unique` 로 이름 바꿈, `school_unique_2026-10-09.md`) | schools.js `JAPANESE_NEW_TECH`(tsubameGaeshi·omote5·kote)·`CHINESE_NEW_TECH`(yaoji·zuoyi) — 지금 `JAPANESE_UNIQUE`·`JAPANESE_SPARE`·`CHINESE_UNIQUE` | **자료만** | 자료만 | 모두 `ai: false` + `src`. 어디에도 이어 두지 않았고 재지 않았다. kote 길 = zuoyi 길(한 길, 이름만 둘) |
| 한 칼 자세(높은 자세 간 보기·물러남) | `WEAPON_OVER.monohoshizao` → `TRADITIONS.japanese.guards·withdraw` | 늘 (전과 같음) | 같음 | 일본 무기가 모노호시자오 하나라 바이트 그대로. **뒤에 오는 카타나는 이것을 물려받는다 — 넣을 때 48 판으로 다시 잰다.** `WEAPON_OVER` 는 빈 객체로 자리만 남김 |
| 중국 가중치 안 B | `CHINESE_TECHK_B` (내보내기만) | 안 씀 | 안 씀 (도구만 바꿔 끼움) | 안 A + 찌르기 ×1.87 |
| 스위치 | config.js `SKILL.schoolArt: 0` · main.js `?schoolArt=` · schools.js `SCHOOL_ART = { weights, rest, counter }`(재기 전용, 기본 모두 true) | | | 도구: motion_lab `SCHOOL_ART=1`·`SCHOOL_ART_PARTS=weights,rest,counter`·`SCHOOL_REST=langort`·`SCHOOL_TECHK=B` (src 기본은 건드리지 않음) |

어느 유파의 가중치를 덮나 = `art.tradition` — 인물이 꾸러미를 골랐으면 그 꾸러미의 유파, 아니면 무기의 유파. 그래서 인물 없는 기본 AI 가 모노호시자오를 쥐면 독일 꾸러미 위에 일본 가중치가 얹힌다. 기본 AI 가 무기 유파 꾸러미를 통째로 쥐게 하는 것은 하지 않았다(오늘 그대로, 사장님 확인 전).

### 1-1. 실제 기술 base (라이브러리 본판, 결투의 꾸러미 그대로)

| 무기 | 기술 | 끔 | 켬 |
|---|---|---|---|
| 모노호시자오 (heavy:cut, 일본) | zwerch · zwerchL | 0.25 · 0.20 | 0.20 · 0.16 (나머지 같음: 내리치기는 틀 ×1.4, 찌르기는 라이브러리 ×0.5 그대로) |
| 청강검 (one:versatile, 중국 안 A) | zwerch · zwerchL · unterhau · unterhauL · wristCut | 0.25 · 0.20 · 0.60 · 0.35 · 0.70 | 0.50 · 0.40 · 0.72 · 0.42 · 0.84 |
| 청강검 안 B | 위 + 찌르기 다섯 | stichPflug 0.525 … | × 1.87 (stichPflug 0.98) |
| 롱소드·레이피어 (독일·이탈리아) | — | | 바뀜 없음(유파 자료 없음) |

일본 'two:*' 칸(真向 ×1.3·袈裟 ×1.2·胴 ×0.8·突き ×0.8)은 지금 일본 두손 보통 무기가 없어 아무 데도 걸리지 않는다 — 카타나가 오면 걸린다.

### 1-2. skill.js ③ 되돌아옴 — 바꾼 곳과 둔 곳
- 바꿈(깨끗한 그 자리 바꿈): 보정 v2 목적지 `recoverDest`(한손 가지·pad* 섞기 둘 다)와 옛 보정 되돌아옴(목표·도착) — `SKILL.homeGuard` → `f.swordArt?.restGuard?.pad ?? SKILL.homeGuard`. 끄면 같은 값.
- 둠: skill.js `padStar` 첫 줄의 `SKILL.homeGuard`(겨눔 각을 푸는 반복의 출발점일 뿐 목적지가 아님), fighter.js 768 쉼 어깨 기하(v2 쉼 몸 돌림의 고정점 — 같은 목적지인지 분명하지 않아 손대지 않음).
- 주의 1: 한손 가지(청강검)는 사장님 탐색판 3·4차 지적('팔을 쭉 편 채 고정') 때문에 homeGuard 로 보내던 자리다. 안 A('langort')를 켜면 청강검은 바로 그 3번 자세(팔 뻗음)로 돌아간다 — 안 A 를 고르시면 한손만 안 B 로 둘지 함께 여쭌다.
- 주의 2: ③ 은 플레이어만 쓴다(`autoGuard` 는 main.js 플레이어만 true). AI 대 AI 결투에서는 쉴 자세가 판에 닿지 않는다 — 아래 '쉴 자세만' 줄이 끔과 같은 까닭.

## 2. 관문 (스위치 0)

| 관문 | 기대 | 결과 |
|---|---|---|
| `node tools/sim/fights12.mjs` | `578402e1` | `578402e1` |
| `node tools/sim/live_battery.mjs` | `c2072cd1` | `c2072cd1` |
| `node tools/sim/finish_thrust.mjs 1 --stand` | `d65cc1df` | `d65cc1df` |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | IDENTICAL 12/12 |
| `node tools/sim/weapon_smoke.mjs` | OK 16/16 | OK 16/16, 출력 sha `15f442ee` = 시작 커밋 사본 |
| `motion_lab duel <무기> 24 main` 승/패/무 (시작 커밋 c2308b4 사본 → 이 가지, 스위치 0) | 롱소드 21/23/4 · 레이피어 19/24/5 · 모노호시자오 25/21/2 · 청강검 0/40/8 | 같음 — 네 줄 출력 바이트 같음(쓴 기술 횟수까지) |
| 결정 덤프 (`SCHOOLS` 16 열쇠 + 무기 16 × 인물 없음/무기 꾸러미 × 라이브러리 끔/켬: 꾸러미·간격·쉴 자리·자세표) | 시작 커밋 사본 | 80 줄 바이트 같음 (`tradition` 열쇠만 뺌) |
- 세 기준선 장면은 롱소드뿐이라 일본·중국 자료가 닿지 않는다. 그래서 '스위치 0 = 같음' 의 실제 증거는 결투 네 줄(모노호시자오·청강검)과 스모크다.

## 3. 결투 표 (AI(무기) 대 AI(롱소드), 자리 바꿔 24+24 = 48 판, 같은 씨앗, `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main`)

48 판의 95 % 띠는 ±14 점쯤이다. 그 안의 차이는 '달라졌다' 고 말할 수 없다.

| 줄 | 무엇을 켰나 | 승 | 패 | 무 | 승률 | 끔 대비 | 쓴 기술 (상위) |
|---|---|---|---|---|---|---|---|
| 모노호시자오 끔 | `SKILL.schoolArt 0` | 25 | 21 | 2 | 52 % (38~66) | — | zornhau 174 · zornhauL 114 · unterhau 44 · unterhauL 32 · oberhau 17 · talhoReves 9 |
| 모노호시자오 켬 | 셋 다 (일본: 가중치 heavy:cut + 쉴 자세 안 B) | 25 | 21 | 2 | 52 % | **같음 (바이트)** | 같음 |
| 모노호시자오 쉴 자세만 안 A | `rest` + `SCHOOL_REST=langort` | 25 | 21 | 2 | 52 % | 같음 (바이트) | 같음 |
| 청강검 끔 | `SKILL.schoolArt 0` | 0 | 40 | 8 | 0 % (0~7) | — | zornhau 103 · zornhauL 52 · stichPflug 40 · unterhau 30 · unterhauL 22 · oberhau 14 · wristCut 10 |
| 청강검 켬 (안 A) | 가중치 안 A + 맞받아치기 + 쉴 자세 안 B | 2 | 38 | 8 | 4 % (1~14) | +2 승 (+4 점) — 소음 폭 안 | zornhau 104 · zornhauL 48 · stichPflug 47 · unterhau 34 · unterhauL 28 · stichOchs 14 · wristCut 13 |
| 청강검 가중치만 (안 A) | `weights` | 1 | 37 | 10 | 2 % | +1 승 — 소음 폭 안 | zornhau 111 · zornhauL 48 · stichPflug 34 · unterhau 32 · unterhauL 27 · oberhau 16 · wristCut 14 |
| 청강검 가중치만 (안 B) | `weights` + `SCHOOL_TECHK=B` | 0 | 43 | 5 | 0 % | 같은 0 승, 무 8 → 5 — 소음 폭 안 | stichPflug 81 · zornhau 74 · zornhauL 36 · stichOchs 23 · stichPflugL 19 · stichOchsL 18 |
| 청강검 맞받아치기만 | `counter` | 1 | 38 | 9 | 2 % | +1 승 — 소음 폭 안 | zornhau 102 · zornhauL 60 · stichPflug 43 · unterhau 31 · unterhauL 23 |
| 청강검 쉴 자세만 안 A | `rest` + `SCHOOL_REST=langort` | 0 | 40 | 8 | 0 % | 같음 (바이트) | 같음 |
| 롱소드 켬 | 셋 다 (독일: 자료 없음) | 21 | 23 | 4 | 44 % | 같음 (바이트) — 기대대로 | 같음 |
| 레이피어 켬 | 셋 다 (이탈리아: 자료 없음) | 19 | 24 | 5 | 40 % | 같음 (바이트) — 기대대로 | 같음 |

괄호 안은 윌슨 95 % 띠(도구 출력). 읽는 법:
- **모노호시자오는 켜도 판이 하나도 안 바뀐다.** 일본 앞무게 몫은 가로베기 ×0.8 하나뿐인데, 모노호시자오는 한 칼 자세(높은 자세 넷)에서만 간을 봐 가로베기(옆 자세에서 시작)가 후보에 들지 않는다 — 끔·켬 모두 가로베기 0 번. 일본 가중치가 실제로 일하는 칸은 'two:*'(카타나) 이고, 그 무기는 아직 없다.
- **청강검은 기술 빈도가 움직인다**(안 A: 가로베기는 여전히 거의 안 나오지만 올려베기·손목 베기가 조금 늘고, 안 B: 찌르기가 stichPflug 40 → 81 로 두 배). 그러나 승률은 0 % 바닥에 붙어 있어 0~2 승 차이는 48 판에서 아무 말도 못 한다. 롱소드 상대 청강검 0 % 는 유파와 상관없는 지금 판의 문제(간격·한손 틀)로 보이며 이번 범위 밖이다.
- **쉴 자세는 AI 결투에 닿지 않는다**(③ 은 플레이어만) — 안 A 줄이 끔과 바이트 같은 것이 그 확인이다. 플레이어 쪽 효과는 재지 않았다(§5).
- 롱소드·레이피어는 유파 자료가 없어 켜도 바이트 같다 — 스위치가 다른 유파로 새지 않는다는 확인.

## 4. 사장님 답 기다리는 것 (한 줄로 바꾸는 법)

| 여쭘 | 지금 기본 | 바꾸려면 |
|---|---|---|
| 유파 가중치·맞받아치기를 켤지 (확인표 195~197·200) | 끔 (`SKILL.schoolArt: 0`) | config.js `schoolArt: 1` (또는 `?schoolArt=1`) |
| 쉴 자세 안 A(긴 자세 = 中段·中平) / 안 B(쟁기 = homeGuard) (198) | 안 B `rest: 'pflugR'` | schools.js 일본·중국 `rest: 'langort'` + 스위치 1 |
| 중국 쉴 자세 이름 中平(창 이름) / 劍 원전 直符送書·看守 (199) | '중평 (中平)' | schools.js `CHINESE_NAMES['긴 자세 (Langort)'].name` |
| 중국 찌르기 가중치 안 A / 안 B (197) | 안 A | schools.js `chinese.techK: CHINESE_TECHK_B` |
| 燕返し 를 새 길로 / 지금 이음(袈裟 → 逆袈裟)에 이름만 (201) | 새 길 자료만(`ai: false`), 이음 이름은 안 붙임 | 새 길: `ai: false` 를 지우고 NEW_TECH 처럼 잇기(측정 필요) · 이름만: 일본 techK 에 unterhauL ×1.3 (초안 §6 안 3-나) |
| 인물 없는 기본 AI 가 무기 유파 꾸러미를 쥘지 | 아니오 (독일 꾸러미 + 무기 간격) | sword_art.js `school` lazy 에서 `schoolOf(persona?.school ?? w.id)` — 판이 바뀐다, 48 판 필요 |
| 일본 맞받아치기(초안 §12 `['oberhau', 'zornhau', 'zornhauL']`) | 넣지 않음(지시 범위 밖) | schools.js `japanese.counterArt` 한 줄 |

## 5. 손대지 않은 것과 까닭
- 燕返し 길: 초안 안 3-가(지붕 → 바보까지 곧장 내려벤 뒤 오른 황소로 퍼올림)를 그대로 넣었다. 지시서의 꼴(왼쪽 바꿈을 지나 왼 황소로)은 '곧장 내려벰' 이 아니라 사선이라 초안과 어긋나 후보로만 적는다.
- 새 기술 다섯은 재지 않았다(지시대로). AI 에도 열지 않았다.
- 플레이어 쪽 쉴 자세(③) 효과는 AI 대 AI 결투로 잴 수 없다 — 사람 손 대본(corr_s0 장면처럼 플레이어 보정을 켠 장면)에 모노호시자오·청강검을 쥐어 보는 것이 다음 측정 후보.
- docs/decisions.md·director_state.md 는 건드리지 않았다.

## 6. 시간 (시계, KST)
- 00:32 시작 — 읽기(설계서 §13·초안 둘·코드 지도), 시작 커밋 사본에서 결투 네 줄 기준(00:33~00:36, 배경)
- 00:36~00:40 자료·스위치·이음(schools.js·sword_art.js·skill.js·config·main·motion_lab)
- 00:40~00:46 관문 다섯 + 결투 13 줄(동시 4, 결투 한 줄 ≈ 90 s) — 첫 시도는 작업 폴더에 node_modules 고리가 없어 바로 실패, 고리를 걸고 다시
- 00:42~00:49 문서(이 글·확인표 195~202·설계서 §14·schools README), 결정 덤프, vite build 통과, 커밋
- 실제 약 17 분 (측정 포함, 목표 75 분 안)
