# 걸음 사다리 — 기술 걸음 길이 한 표 (사장님 10/29 14:4x · 14:5x)

사장님 말씀:
- 14:4x — 날개 접기(염시) 걸음 **0.45 m** 확인. 다른 가지에서 이미 `UNIQUE_ASSIST.lianStep` 0.45 로 넣었으므로 이 가지에서는 손대지 않는다.
- 14:5x (원문) — "걸음 테이블도 통합할 수 있는 건 최대한 그렇게 해. 0.25는 0.3으로 합치자."

## 0. 한눈에

- **바꿈 (사장님 결정)**: 앞 걸음 0.25 m 셋을 **0.3**(사다리 0.3 칸 '반걸음')으로 바꿨다. 새 열쇠는 만들지 않았고, 값은 지금 열쇠 한 곳에만 있다.
  - `SECRET.chineseStep` 0.25 → 0.3 (`src/config.js:968`): 동방 반걸음 칸 하나를 다섯 곳이 함께 읽는다. 연환삼격 수마다 반걸음 · 막기 연환과 3 연격 수마다 반걸음(`step25`) · 3 연격 마지막 수의 반걸음 물러남(`stepBack25` → −0.3) · 격살(`GK_CUT` · 허파 찌르기) · 독일 왕관 뛰어들기(`deStep`).
  - `POMMEL.step` 0.25 → 0.3 (`src/config.js:1522`): 손잡이 찍기에서 내딛는 걸음.
  - `CHINESE_BOW.tech.oberhau.fwd` 0.25 → 0.3 (`src/schools.js:402`): 표두격 반걸음. 가까운 거리(맞닿기 − 0.1 m 안)에서 AI 가 내딛는 걸음 길이다(`ai.js:1455` · `:3001` · `:3123~3125` → `gait.requestStep` fwd).
- **관문 해시는 그대로다** (§5). fights12 `d2b7915f` · live_battery `e8127a92` · finish_thrust `ad302969` · corr 12 · smoke 34 · 시험 472/472 · 빌드 0. 까닭: 세 장면이 모두 롱소드 AI 끼리 싸우는 판이고, 기본 판의 AI 는 이 세 걸음을 한 번도 부탁하지 않는다(걸음 셈 0 — §5-2).
- **판에서 실제로 바뀌는 곳**: 사람이 내는 동방 비기 격살, 손잡이 찍기(하인리히 AI가 붙었을 때 · `?pommel=`), 표두격을 가까이서 낼 때(AI), 옛 판들(`?gyeoksal=0` 막기 연환 · 3 연격, `?cnSecret=v1` 연환삼격, `?deMord=0&deSecret=parry` 왕관 뛰어들기).
- **사장님 여쭘 — 넣지 않음** (§6): 0.35 → 0.3 · 0.5 → 0.45 · 0.7 → 0.6. 0.15 는 그대로 두기를 권한다(옆걸음에 섞인 앞 몫이라서).

## 1. 사다리 (제안)

| 칸 | 이름 | 뜻 | 이번에 이 칸에 있는 값 |
|---|---|---|---|
| **0.3** | 반걸음 | 붙은 거리에서 앞발만 조금 내딛는 걸음. 칼과 함께 나간다 | 찌르기 걸음 · 비껴 베기 · 나선 걸음 베기 · 올려 맞받기 · 길목 · 흐르는 긋기 걸음 · **동방 반걸음 · 손잡이 찍기 · 표두격(이번)** |
| **0.45** | 들어감 | 막은 칼을 덮은 채 안으로 한 걸음 | 들어가며 막기 · 싱지르 한 바퀴 나아감 · 날개 접기(염시 — 다른 가지) |
| **0.6** | 한 걸음 | 보통 한 걸음(보폭 0.62 와 같은 크기) | 순간 베기 · 발도 미끄러짐 · AI 보통 베기 걸음 · 런지 덧씌우기 · 옛 고노센 |
| **0.9** | 런지 | 앞발을 멀리, 몸이 따라 실린다 | 이탈리아 런지 |

뒤 걸음(음수)은 이번 말씀 범위 밖이라 사다리에 넣지 않고 §2 끝에 따로 적었다(3 연격 물러남은 같은 열쇠라 함께 −0.3 이 됨).

## 2. 기술 걸음 길이 전수 (앞, m)

줄 번호는 이 커밋 기준이다. **굵게** 적은 줄이 이번에 바꾼 값이다.

| 값 | 열쇠 | 기술 | 파일:줄 | 사다리 / 메모 |
|---|---|---|---|---|
| 0.15 | `inquartata.step.fwd` (옆 lat 0.3) | 이탈리아 비껴서며 찌르기 (I2) | src/schools.js:490 | 사다리 밖. 옆 0.3 에 앞 몫 0.15 가 섞인 비켜서기 — 그대로 두기를 권함 |
| **0.25 → 0.3** | **`SECRET.chineseStep`** | 연환삼격 세 수 lianhuanYao · Liao · Tanfu(`?cnSecret=v1`) | src/config.js:968 · 읽는 곳 src/schools.js:796 · :798 · :799 | 0.3 반걸음 |
| | 같은 칸 `step25` | 동방 막기 연환 반걸음 pcYao · pcNiLinL · pcNiLin · pcZuoyi · pcFengCi · pcFengJian · 3 연격 가운데 수(CN3_CUT · CN3_THRUST 기본) | src/schools.js:820 · :850 · :851 · :882 · :883 · :886 · :887 · :898 · :899 | 0.3 |
| | 같은 칸 `stepBack25` (back — −0.3) | 3 연격 마지막 수 물러남 pcYaoBack · pcZuoyiBack · pcFengSha | src/schools.js:821 · :907 · :914 · :921 | 뒤 −0.3 (부르는 쪽이 음수로 품 — ai.js:2320 · skill.js:723) |
| | 같은 칸 `GK_CUT` · gkLung | 격살 (사람 동방 비기 — 기본 판) | src/schools.js:939 · :960 | 0.3 (몸 미끄러짐 한도 — secret_instant.js:1656) |
| | 같은 칸 `deStep` | 독일 왕관 → 뛰어들기 pcKronEinlauf (`?deMord=0&deSecret=parry`) | src/schools.js:973 · :987 | 0.3 (주석: 같은 값을 빌려 씀 — 고침) |
| **0.25 → 0.3** | **`POMMEL.step`** | 손잡이 찍기 내딛는 걸음 | src/config.js:1522 · 읽는 곳 src/skill.js:527 | 0.3 |
| **0.25 → 0.3** | **`CHINESE_BOW.tech.oberhau.fwd`** | 표두격 반걸음 (활 자세 · 가까울 때) | src/schools.js:402 · 읽는 곳 src/ai.js:1455 · :3001 · :3124 | 0.3 |
| 0.3 | `THRUST.step` | 탭 찌르기 내딛는 걸음 | src/config.js:1475 · src/skill.js:282 | 0.3 |
| 0.3 | `hirakiGiri.step.fwd` (옆 0.3) | 일본 비껴 베기 (J6) | src/schools.js:214 | 0.3 |
| 0.3 | `talhoRodeado.step.fwd` (옆 0.35) | 이베리아 나선 걸음 베기 (B3) | src/schools.js:543 | 0.3 |
| 0.3 | `contraBaixo` do.step.fwd | 이베리아 올려 맞받기 | src/schools.js:590 | 0.3 |
| 0.3 | 길목 `step.fwd` | 이베리아 길목 한 칼 (talhoRodeado 앞 값을 다시 씀) | src/schools.js:735 | 0.3 |
| 0.3 | 코드 수 | 흐르는 긋기 내딛기 (pass) | src/skill.js:1514 | 0.3 |
| 0.35 | `chebuYaoji.step.fwd` (옆 −0.05) | 동방 끌어 딛고 허리 베기 (체보요격) | src/schools.js:447 | **여쭘 0.35 → 0.3** |
| 0.35 | `zwerchAbtritt.step.fwd` (옆 −0.3) | 독일 비껴 딛는 가로베기 (G8) | src/schools.js:477 | **여쭘 0.35 → 0.3** |
| 0.35 (옆) | `talhoRodeado.step.lat` | 이베리아 나선 걸음 베기 옆 몫 | src/schools.js:543 | **여쭘** — 옆 몫도 사다리로 볼지 |
| 0.45 | `SKILL.enterStep` | 들어가며 막기 (짧은 한손 칼) | src/config.js:882 | 0.45 |
| 0.45 | `SECRET.ibSpin.advance` | 싱지르 한 바퀴에 골반이 나아가는 거리 상한 | src/config.js:1085 | 0.45 |
| 0.45 | `UNIQUE_ASSIST.lianStep` (다른 가지) | 날개 접기 (염시) — 사장님 14:4x | (다른 가지) | 0.45 — 이 가지에는 없음 |
| 0.5 | `SECRET.stance.iai.step` | AI 발도 대기에 들어갈 때 앞발 | src/config.js:992 · src/secret_instant.js:792 | **여쭘 0.5 → 0.45** |
| 0.5 | `*_GAIT.cutStep.fwd` (이탈리아 · 동방 · 일본) | 유파 걸음의 AI 베기 걸음 (앞발 lunge + 끌어붙임 — 표두격이 멀 때 이 값) | src/schools.js:389 · :407 · :427 · 읽는 곳 src/ai.js:3124 | **여쭘 0.5 → 0.45** (이번에 찾음) |
| 0.5 | `requestStep` 기본값 | fwd 를 안 주면 0.5 (부르는 곳은 모두 fwd 를 줌) | src/gait.js:340 | 사다리 밖 (기본값) |
| 0.6 | `SECRET.japaneseStep` | 옛 고노센 앞발 (`?iai=0` 만) · 길목 상한(secret.js:576 주석 — 지금 꺼짐) | src/config.js:951 · src/schools.js:772 | 0.6 |
| 0.6 | `SECRET.instantStep` | 순간 베기 몸 평행 이동 최대 | src/config.js:971 · src/secret_instant.js:246 | 0.6 |
| 0.6 | `SECRET.iaiStep` | 발도 동안 몸 미끄러짐 최대 · 리솔루토 미끄러짐 | src/config.js:1000 · src/secret_instant.js:621 · src/config.js:1244 | 0.6 |
| 0.6 | 코드 수 | 사람 비기에 기술 걸음 칸이 없을 때 한 걸음 | src/skill.js:810 | 0.6 |
| 0.6 | 코드 수 | 채널 B 베기 걸음 (`GAIT.cutStep` 0 — 꺼짐) | src/skill.js:1745 | 0.6 |
| 0.6 | 코드 수 | AI 보통 베기 걸음 · 이탈리아 찌르기 걸음 상한 | src/ai.js:3129 | 0.6 |
| 0.6 | `OVERLAY.thrust.lunge.step` | 찌르기 무기 런지 덧씌우기 | src/frames.js:269 | 0.6 |
| 0.7 | `SECRET.iaiDrawStep` | 발도 순간 앞발 | src/config.js:995 · src/secret_instant.js:641 | **여쭘 0.7 → 0.6** |
| 0.9 | `SECRET.italianStep` | 이탈리아 런지 (passataSotto · 리솔루토 앞발) | src/config.js:946 · src/schools.js:635 · src/config.js:1244 | 0.9 |

거리로 정하는 걸음 (값이 없어 사다리에 넣지 않음):
- 밀치기 걸음 `L = clamp(d − 0.55, 0, GAIT.maxReach 0.5)` (src/fighter.js:1307) · 길목 간격 디딤 `gilmokStep`(src/secret.js:579 — max 를 두지 않아 지금은 fwd 0.3 그대로) · 이탈리아 찌르기 ③ 거리만큼(≤ 0.6 — src/skill.js:283 · src/ai.js:3129) · 운동학 비기 몸 미끄러짐 `clamp(d − 맞닿기, 0, fwd)`(src/secret_instant.js:1656).

뒤 걸음 (이번 범위 밖 — 사다리에 넣을지 여쭘):
- `SECRET.japaneseBack` −0.15 (src/config.js:950 — 일본 ① 짧은 백스텝) · `SECRET.iberianBack` −0.3 (src/config.js:959 — 이베리아 휘돌림 옆걸음 뒤) · `stepBack25` −0.3 (이번에 같은 칸이라 함께 바뀜) · `SECRET.iberianSweepBack` 0.25 (src/config.js:1108 — 옛 휩쓸기 `iberianSecret 'v4'` 의 뒤로 미끄러짐 한도, §7).

## 3. 사다리 밖 — 걸음 기계 · 걷기 값 (사다리가 아님)

걷는 보폭과 걸음 기계의 값이다. 기술이 내딛는 걸음 길이가 아니라서 손대지 않았다.

| 값 | 열쇠 | 무엇 | 파일:줄 |
|---|---|---|---|
| 0.62 | `GAIT.maxStride` | 한 걸음 최대 길이 (보폭 규칙 0.62 × k) | src/config.js:298 |
| 0.5 | `GAIT.maxReach` | 몸 중심에서 발을 딛는 최대 거리 | src/config.js:354 |
| 0.68 | `BODY.stepLength` | 옛 한 걸음 보폭 | src/config.js:159 |
| 0.62 | `STAMINA.stepDistance` | 걷기 기력: 골반이 0.62 m 갈 때마다 청구 | src/config.js:59 |
| 0.45 · 0.5 · 0.68 · 0.5 | `*_GAIT.maxStride` (이탈리아 · 동방 · 이베리아 · 일본) | 유파 보폭 | src/schools.js:389 · :407 · :417 · :427 |
| 0.85 · 0.9 · 1.2 · 0.8 | `*_GAIT.strideK` | 보폭 규칙 k | 같은 줄 |
| 0.58 · 0.55 · 0.62 · 0.45 | `*_GAIT.guardLength` | 자세 두 발 앞뒤 | 같은 줄 |
| 0.7 | `JAPANESE_GAIT.reachMax` | 넓게 벌린 발 그대로 두는 거리 | src/schools.js:427 |
| 0.85 | `*_GAIT.passAs.fwdK` | 지나 딛는 걸음을 lunge 로 바꿀 때 몫 (비율) | src/schools.js:389 · :407 · :427 |
| 0.42 | `*_GAIT.trailReach` | 뒷발 끌어붙임 닿는 거리 | 같은 줄 |
| 2 · 1.5 | `GERMAN_CHASE.steps` · `mul` | 간격 잡기 빠른 디딤 셈 · 배율 | src/schools.js:382 |
| (m/s) | `GAIT.burst*` | 첫 걸음 박차기 빠르기 · 시간 | src/config.js:259~278 |

## 4. 이번에 바꾼 것

| 열쇠 | 전 → 이제 | 바꾼 곳 | 주석 |
|---|---|---|---|
| `SECRET.chineseStep` | 0.25 → **0.3** | src/config.js:968 | 걸음 사다리 0.3 칸 · 사장님 10/29 14:5x '0.25는 0.3으로 합치자' |
| `POMMEL.step` | 0.25 → **0.3** | src/config.js:1522 | 같음 |
| `CHINESE_BOW.tech.oberhau.fwd` | 0.25 → **0.3** | src/schools.js:402 | 같음 |
| (주석만) `step25` · `deStep` 설명 | '0.25' → '0.3' | src/schools.js:820 · :972 | 같음 |
| (도구) `tools/sim/risoluto_play.mjs` | 여유 칸 '≥ 0.25(chineseStep)' 이 이제 `SECRET.chineseStep` 을 읽음 | :293 | 수를 따로 적지 않게 |

그대로 둔 것: 염시(날개 접기 — 다른 가지 `lianStep` 0.45) · 옆(lat) 값 · 걸음 기계 · 걷기 값 · 시간 값.

## 5. 재기

### 5-1. 관문 (바꾸기 전 = 이 가지의 바탕 `e4f9d61a`)

| 관문 | 전 | 후 | 메모 |
|---|---|---|---|
| `fights12.mjs` sha | d2b7915f | **d2b7915f** | 그대로 |
| `live_battery.mjs` sha | e8127a92 | **e8127a92** | 그대로 |
| `finish_thrust.mjs 1 --stand` sha | ad302969 | **ad302969** | 그대로 |
| `corr_s0.mjs --limits=off,on` IDENTICAL | 12 | **12** | |
| `weapon_smoke.mjs` OK | 34 | **34** | |
| `school_ai_fights.mjs` sha (유파 무기 여섯 × 씨앗 둘) | 7ade96f7 | **7ade96f7** | 청강검 판도 그대로 |
| `node --test tools/sim/*.test.mjs` | | **472 / 472** | 0.25 를 박은 시험 없음 |
| `npm run -s build` | | **0** | |

열쇠마다 하나씩 되돌린 판(그 열쇠만 0.25, 나머지 둘은 0.3)도 위 네 해시가 모두 같다. 어느 열쇠도 어느 관문을 움직이지 않는다. 되돌리는 법: `with_config.mjs SECRET.chineseStep=0.25 <도구>` · `with_config.mjs POMMEL.step=0.25 <도구>`. 표두격은 CONFIG 밖(schools.js)이라 `TRADITIONS.chinese.gait.bow.tech.oberhau.fwd` 를 도구 안에서만 0.25 로 덮는 감싸개로 쟀다(저장소에 넣지 않음). 셋을 모두 되돌린 감싸개 판이 바탕 커밋 판과 바이트가 같은 것도 확인했다(school_ai_fights 7ade96f7).

### 5-2. 왜 관문이 안 움직이나 — 걸음 셈

`gait.requestStep` 이 받아들인 걸음을 길이별로 셌다(읽기만 하는 갈고리).
- 동방 대 독일 인물 맞대결 `duel_pair.mjs` (12 판 × 45 s): 랴오 대 하인리히 · 찬다 대 마르그레테 · 병마용 대 아르토리아. 전 · 후 모두 **0.25 · 0.3 걸음 0 번**. 표두격은 늘 먼 쪽 베기 걸음(`cutStep` 0.5 — 3 · 1 · 4 번)이었고, 하인리히는 붙지 않아 손잡이 찍기를 한 번도 하지 않았다. 승패도 판마다 같다 — 랴오 1/12 · 찬다 0/12 · 병마용 2/12 (전 · 후 같음).
- 동방 AI 비기는 닫혀 있다(`SECRET.aiOpenSchools` 에 chinese 없음). 독일 AI 비기는 죽음의 일격이라 왕관 뛰어들기를 타지 않는다(`SECRET.deMord` 1).
- 그래서 기본 판에서 이 값을 읽는 것은 **사람 격살 · 손잡이 찍기 · 표두격을 가까이서 낼 때**뿐이다.

### 5-3. 영향 (전 0.25 → 후 0.3)

| 도구 | 전 | 후 |
|---|---|---|
| `pommel_trial.mjs probe` (18 번 찍기, 가만히 선 상대) | lunge 0.25 × 18 · 폼멜 맞음 4 · 폼멜 14.2 J · 칼날 6 J 넘음 10 · 폼멜-머리 틈 중앙 20 cm | lunge 0.3 × 18 · 폼멜 맞음 4 · 14.2 J · 칼날 6 J 넘음 10 · 틈 19.8 cm — **같은 그림** |
| `pommel_trial.mjs duel --then=pommel --N=12 --gap=0.9` (하인리히 24 판, 붙은 채 시작) | 승 · 패 · 무 13 · 8 · 3 · 찍기 164 · 맞음 97 · 폼멜로 넘어뜨림 5 · 폼멜 중앙 9.8 J · 0.25 걸음 157 | 16 · 3 · 5 · 찍기 155 · 맞음 88 · 넘어뜨림 8 · 9.8 → 9.9 J · 0.3 걸음 151 — 승패는 판 소음 폭 안 |
| `gyeoksal_strike.mjs` (사람 격살 한 칼, 4 자세 × 겉모습 3 × 배율 2 = 24 줄 × 12 번) | 맞힘 234 · 칼에 막힘 48 · 죽음 60 · 절단 69 · 깊은 출혈 195 · 심각도 평균 3.70 | 맞힘 234 · 막힘 48 · 죽음 60 · 절단 65 · 깊은 출혈 191 · 3.66 — 맞힘은 같고 세기만 조금 흔들림 |
| `cn_combo_speed.mjs 6` (막기 연환 3 연격, 도구 안에서만 AI 동방 비기를 엶) | 물러남 retreat −0.25 × 15 · pcYaoBack 칼끝 1.194 m · pcFengSha 46 J | −0.30 × 15 · 1.181 m · 48 J — **앞 수는 바이트 같음**(이미 맞닿기 거리라 미끄러짐이 거리로 잘림) · 마지막 물러남만 5 cm 더 |

손잡이 찍기와 연환 동작은 그대로 멀쩡하다. 맞는 부위 · 빠르기 · 수의 시간이 전과 같고, 걸음만 5 cm 길어졌다.

### 5-4. 도구에서 찾은 것 (이번에 고치지 않음)

- `tools/sim/cn_combo_speed.mjs` 는 지금 바탕에서 바로 멈춘다(`A.secret` null — 10/22 뒤로 AI 동방 비기가 닫혔고 숙련도 5 문턱도 있음). 위 숫자는 도구 안에서만 `aiOpenSchools` 에 chinese 를 더하고 `AI_PROFICIENCY.secretAt` 을 0 으로 내려 쟀다.
- 같은 도구 판에서 3 연격 앞 반걸음(lunge)은 gait 가 받지 않는다(AI 가 붙은 거리에서 스틱을 뒤로 당기는 동안 `requestStep` 이 앞 걸음을 거절 — gait.js:339). 물러남(retreat)은 예외라 받는다.

## 6. 사장님께 여쭐 것 — 아직 넣지 않음

| 합치기 | 값 | 열쇠 · 기술 | 디렉터 의견 |
|---|---|---|---|
| 0.35 → 0.3 | 앞 0.35 | 체보요격 `chebuYaoji` (src/schools.js:447) · 비껴 딛는 가로베기 `zwerchAbtritt` (:477) | 0.3 칸 반걸음과 5 cm 차이. 합칠 수 있음 |
| 0.35 → 0.3 (옆) | 옆 0.35 | 나선 걸음 베기 `talhoRodeado.lat` (:543) | 옆 몫은 앞 사다리와 따로 볼지 먼저 정하셔야 함 |
| 0.5 → 0.45 | 0.5 | AI 발도 대기 앞발 `SECRET.stance.iai.step` (src/config.js:992) · 유파 AI 베기 걸음 `cutStep.fwd` 셋 (src/schools.js:389 · :407 · :427) | 0.45 '들어감' 칸과 합칠 수 있음. cutStep 은 AI 베기마다 쓰여 판이 크게 바뀜 |
| 0.7 → 0.6 | 0.7 | 발도 순간 앞발 `SECRET.iaiDrawStep` (src/config.js:995) | 0.6 '한 걸음'과 합칠 수 있음. 10/10 캡처에서 0.4 는 좁았음 — 0.6 은 다시 볼 것 |
| 0.15 | 0.15 | 비껴서며 찌르기 `inquartata` (src/schools.js:490) | **그대로 권함** — 옆 0.3 비켜서기에 섞인 앞 몫이고, 앞으로 나가는 걸음이 아님 |
| 뒤 걸음 | −0.15 · −0.3 | `japaneseBack` · `iberianBack` | 뒤 걸음도 사다리(0.15? · 0.3)로 묶을지 |

## 7. 그대로 둔 0.25 (앞 걸음 길이가 아니거나 모호함)

| 값 | 어디 | 까닭 |
|---|---|---|
| `SECRET.iberianSweepBack` 0.25 | src/config.js:1108 · src/secret_instant.js:925 | **모호** — 걸음이 아니라 옛 휩쓸기(`iberianSecret 'v4'` 일 때만)에서 뒤로 미끄러지는 한도. 뒤 걸음이라 그대로 둠 |
| `clamp(…, 0.25, …)` | src/ai.js:2976 · :2985 | 스틱 값(0 ~ 1)이라 m 가 아님 |
| `Math.min(-0.25, …)` | src/ai.js:3021 | 스틱 값 |
| `run.t < 0.25` | src/ai.js:2535 · src/skill.js:931 | 시간 (s) |
| `CHINESE_BOW.hold` 0.25 | src/schools.js:402 | 활 자세 버팀 시간 (s) |
| `JAPANESE_GAIT.steady` 0.25 · `dsFrac` 0.25 | src/schools.js:427 | 걸음 기계 몫 |
| `POMMEL.pull` [0.2, 0.25] | src/config.js:1517 | 손 자리 (m — 걸음 아님) |
| `SECRET.releaseT` 0.25 | src/config.js:963 | 시간 (s) |
