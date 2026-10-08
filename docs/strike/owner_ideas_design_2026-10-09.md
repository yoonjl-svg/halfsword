# 사장님 아이디어 셋 — 비껴 들어가 베기 · 다리 걸기 · 손잡이 찍기 (설계 메모, 2026-10-09, 2 등급 작업자)

가지 `…/idea-memos-2q36ha` (ef44edd 위). **설계만** — src/·tools/ 는 한 줄도 바꾸지 않았다(다른 작업자가 ai.js·schools.js·sword_art.js·motion_lab.mjs 를 고치는 중이라 읽기만). 수는 모두 **사장님 확인 전**.

사장님 10/9 02:4x (원문): "1] 대각선 옆으로 빠르게 살짝 돌아 걸어들어가면서 옆쪽에서 베는 것도 멋있고 강한 고유 기술일 거 같아. 2] 다리 걸거나 베어서 자세 무너뜨리기? 3] 근접 상황에서 칼 손잡이로 찍기? 아이디어 차원에서 가지고 있어. 물론 구현해도 좋고."

디렉터 분류(decisions.md 10/9 02:4x): 1] = 기술에 걸음 칸, 2] = 다리 베기는 이미 있음 + 다리 걸기는 밀치기의 낮은 변형, 3] = 자루 충돌이 둔타로 셈되는지 확인 뒤 붙은 거리 기술. 이 글은 그 셋을 코드로 확인하고 구현 계획을 적는다.

**한 줄 결론**
- 1] **가장 싸고 가장 잘 될 것.** 다리(gait.js)의 기술 걸음 `requestStep` 은 이미 **옆으로(side, m) 딛는 칸**을 받는다 — AI 가 늘 0 을 넘길 뿐이다. 기술 꼴에 `step` 칸 하나 + gaitStep 이 그것을 넘기는 몇 줄 + 몸이 옆으로도 따라가게 하는 한 줄이면 된다. 유파 다섯 모두 하나씩(같은 수).
- 2] 다리 **베기**는 지금도 된다(낮은 베기 → 다리 상처 → 다리 기능 ↓ → 0.25 아래면 주저앉음). 다만 한 번 베어 넘어뜨리기는 어렵다. 다리 **걸기**는 몸 충돌 그룹상 **내 발이 상대 몸·발에 닿지 않는다**(발은 땅·상대 칼과만 부딪힘) → 진짜 발 걸기는 충돌 그룹을 바꾸는 큰 일. 정강이끼리·칼날로 다리 뒤 걸기는 지금 닿는다. 밀치기(closeStep)의 낮은 변형으로 설계 — 그다음 차례.
- 3] **자루(코등이·손잡이·폼멜)는 지금도 상대 몸에 맞으면 둔타로 셈된다**(combat.js 접촉힘 사건 → analyze 에서 `isBlade` 거짓 → `type 'blunt'`). 새 `kind`·combat 변경은 필요 없다. 막는 것은 **손 길**: 패드 자리가 칼 방향까지 정하므로 손만 앞으로 내밀면 칼끝이 앞으로 돌아 베기가 된다. 찌르기 덧씌우기(guards.js `guardAt` 의 `th`)와 같은 꼴의 "폼멜 덧씌우기"가 필요하다(skill.js·guards.js — 롱소드 관문에 닿지 않게 기본 끔).

---

## 1. 비껴 들어가 베기 (1])

### 1-1. 지금 발놀림 (코드)
| 무엇 | 어디 | 내용 |
|---|---|---|
| 스틱 → 걷기 속도 | `src/fighter.js:1979-1982` driveBalance | `want = fwd·(move.y·speed) + rgt·(move.x·speed·GAIT.sideFactor)`. 다리 걸음(hybrid)일 때 speed = `GAIT.moveSpeed` 2.3 m/s(`config.js:207`), 옆은 × `sideFactor` 0.31(`config.js:204`) → **스틱 옆 최고 ≈ 0.71 m/s**(다리 기능·무기 moveMul·판금 곱 전) |
| 걸음 박자 | `src/gait.js:323-327` | 옆걸음은 `sideStride` 0.5 m 넘으면 박자가 빨라진다. 옆으로 0.3 m 를 스틱만으로 가면 가속 포함 **약 0.45~0.6 s** [추정 — 잰 값 아님] |
| 기술 걸음 | `src/gait.js:215-222` `requestStep({ kind, fwd, side, duration, leg })` | `side`(오른쪽 +, m) 칸이 **이미 있다**. 발 목표: `src/gait.js:674-681` — pass 는 앞발 앞으로 `max(0.3, fwd−0.1)`, 옆은 `side + 발쪽×guardWidth(0.22)`. duration 0.28~0.7 s(기본 0.4) |
| 몸 따라가기 | `src/gait.js:467` | 기술 걸음 동안 몸 목표 속도에 **앞(fwd)만** 더한다: `want += fwd · req.fwd·0.8/(T+0.15)`. **옆(side)은 더하지 않는다** → 지금 side 를 넘기면 발만 옆에 딛고 골반은 덜 따라간다 |
| AI 베며 내딛기 | `src/ai.js:857-895` startStrike → `stepDelay 0.04`·`requestedStep=false`·`stepT = stepTime()` | 손이 먼저, 0.04 s 뒤 발 |
| 내딛는 시간 | `src/ai.js:898-903` stepTime | 'stop'·pointBlocked 이면 0, 아니면 `clamp((contactDist − contact − reach)·0.8, 0, 0.3)` — **닿는 거리면 안 딛는다** |
| 발 명령 | `src/ai.js:1378-1397` moveFeet strike 가지 | stepT 동안 `fwd = 1` + `gaitStep()`. `why === 'stop'` 만 `side = circleDir·0.6`(달려드는 상대를 비켜 받기 — **오늘 유일한 옆걸음 베기**) |
| 걸음 부탁 | `src/ai.js:1465-1477` gaitStep | `requestStep({ kind: thrust ? 'lunge' : 'pass', fwd: 0.6, hold: 0.3, leg })` — `side` 를 넘기지 않음(0). `leg` 는 GAIT.cutStep(기본 0)일 때만 |
| 간 보며 돌기 | `src/ai.js:1423-1429` | `circle` = 0 / ±circleRate(0.15~0.4, `ai.js:100`), 0.8~2.2 s 마다 다시 굴림, `d < hold + 0.6` 일 때만 |
| 잔걸음 | `src/ai.js:1411-1420` | `shuffle` 앞뒤만 |
| 몸 돌기 | `src/fighter.js:711-723` updateHeading | 늘 상대 쪽으로, 최고 `BODY.turnSpeed` 2.4 rad/s(`config.js:51`) × muscle, 딛은 발이 허락하는 만큼(gait.limitTurn) |
| 밀치기 걸음 | `src/fighter.js:1111` closeStep | `requestStep({ kind: closeStepKind, fwd: L, duration: 0.3 })` — 랴오(persona.close.kind 'kick')만 `closeStepKind = 'pass'`(`ai.js:58`). 역시 side 0 |

**읽기**: "대각선으로 빠르게 살짝 돌아 들어가기"는 스틱 옆걸음으로는 느리다(0.71 m/s). 그러나 기술 걸음은 duration 0.28~0.4 s 짜리 **한 발 딛기**이고 side 칸이 이미 있으니, 그 칸을 쓰면 0.3~0.4 s 에 비스듬히 0.25~0.35 m 옮겨 딛는 것이 된다 [추정]. 상대는 2.4 rad/s 로만 돌아서므로, 1.5 m 간격에서 옆 0.3 m ≈ 11° 를 0.3 s 에 만들면 상대는 그 사이 최대 0.72 rad(41°) 돌 수 있어 **다 따라온다** — 옆에서 베는 이득은 각도 자체보다 **상대 칼끝 줄(겨눔)에서 벗어나는 것**과 **상대 막는 길이 어긋나는 것**에서 나온다 [해석]. 그래서 측정은 승률보다 '겨눔에서 벗어남·막힘 비율'로 먼저 본다(§1-6).

### 1-2. 제안 — 기술 꼴에 `step` 칸
```js
// 유파 고유 동작(TECH 꼴)에 칸 하나. 없으면 오늘 그대로(바이트 동일)
step: { lat: 0.3, fwd: 0.4, when: 'strike' }   // lat: 오른쪽 + (m, 몸 기준) · fwd: 앞 (m) · when: 'strike' | 'approach'
```
- `lat` 부호는 **기술 길의 반대쪽**이 원전 꼴이다(Meyer: 오른쪽에서 Zwerch 를 칠 때 왼발을 왼쪽 앞으로 비켜 딛음 [원전 2차]). 그래서 자료는 부호를 적고, `lat: 'away'` 같은 자동 규칙은 두지 않는다(새 규칙 = 새 수).
- `when: 'strike'` — 베기 시작 0.04 s 뒤 걸음(지금 내딛기 자리). `when: 'approach'` — 다가가는 끝(phase approach → strike 직전)에 먼저 비껴 딛고 그다음 벰(이탈리아 inquartata·일본 体捌き 꼴, '먼저 비키고 친다').
- `circleDir` 를 곱하지 않는다(그 사람이 즐겨 도는 쪽과 기술의 쪽은 다르다). 다만 거울 기술(`zwerch`/`zwerchL`)이 이미 있어 좌우는 기술 고르기가 정한다.

### 1-3. 코드 바꿀 곳 (구현 담당용 — 지금 바꾸지 않음)
1. `src/ai.js` **gaitStep()** (`:1465-1477`): `const st = this.tech?.step;` 이 있고 `st.when === 'strike'` 면 `requestStep({ kind, fwd: st.fwd, side: st.lat, duration: STEP_T, leg })`. `leg` 는 옆으로 가는 쪽 발(`lat > 0` → 오른발이 나가는 꼴: pass 면 뒷발이 앞발을 지나 오른쪽 앞으로) — 기존 채널 B(`GAIT.cutStep`) 규칙과 겹치면 step 이 이김.
2. `src/ai.js` **stepTime()** (`:898-903`): step 이 있는 기술은 '이미 닿는 거리면 안 딛는다'를 건너뛴다 — 옆으로 딛는 건 거리를 줄이려는 게 아니라 줄에서 벗어나려는 것. `return st ? STEP_T : …`. 단 `pointBlocked`·`why==='stop'` 은 그대로 0.
3. `src/ai.js` **moveFeet()** strike 가지 (`:1385-1397`): stepping 동안 `side = sign(st.lat) · 1`(스틱도 같은 쪽 — gait 의 `want` 가 옆으로도 가게), `fwd = st.fwd > 0 ? 1 : fwd`. `d < clinch → fwd −0.7` 줄은 그대로(붙으면 물러남).
4. `src/ai.js` **approach** (`:812-829`): `when === 'approach'` 면 `contactDist() <= need + st.fwd` 에서 먼저 `requestStep` 한 번(phase 'sidestep', 새 상태 아님 — `this.sideStepDone` 깃발 하나), 다리 착지(gait.req 가 지워짐) 뒤 startStrike.
5. `src/gait.js:467` **몸 따라가기**: `want.addScaledVector(rgt, (req.side·0.8)/(swing.T+0.15))` 한 줄. side 0 이면 0 이라 오늘과 바이트 같다(곱 0 — 그래도 부동소수점 더하기 순서는 관문으로 확인).
6. `src/schools.js` 각 유파 `*_UNIQUE` 에 줄 하나씩(§1-4). `sword_art.js mergeUnique` 는 그대로(TECH 꼴 칸을 통째로 복사하므로 step 도 따라온다).
7. 사람(플레이어) 쪽: 없음. 플레이어는 이미 스틱을 비스듬히 밀고 베면 된다(skill.js 자동 내딛기). 패드 새로 없음.

### 1-4. 유파별 — 한 유파 하나씩 (같은 수: 고유 셋 → 넷)
| 유파 · 무기 | 이름 | 길 (지금 패드 그대로) | step | 출처 |
|---|---|---|---|---|
| 독일 · 롱소드 | `zwerchAbtritt` 비껴 가로베기 | 공용 zwerch 길(오른 어깨 → 가로) | `{ lat: −0.3, fwd: 0.35, when: 'strike' }` (왼쪽 앞으로) | Meyer 1570 삼각 걸음(Triangel)·Zwerch 에 걸음 [원전 2차] · Zettel 「Zwerch benimmt…」 [원전 2차] · 거리 수 [추정] · **기본 끔**(독일 셋과 같은 까닭 — 롱소드 AI) |
| 이탈리아 · 레이피어 | `inquartata` | 공용 stichPflug 길(찌르기) | `{ lat: +0.3, fwd: 0.15, when: 'approach' }` (오른쪽으로 비키며 — 뒷발을 돌림) | Capo Ferro 1610 inquartata(몸을 상대 칼 줄에서 빼며 찌름) [원전 2차 — 원문 쪽 못 찾음, 용어 풀이 53쪽 다시 볼 것] |
| 이베리아 · 츠바이핸더 | `talhoRodeado` 돌아 들며 탈류 | 공용 zornhau(talho) 길 | `{ lat: +0.35, fwd: 0.3, when: 'strike' }` | 몬탄테 규칙의 둥근 걸음(원을 그리며 나아감) — Godinho 1599·Figueiredo 1651 요약 [원전 2차] · 쪽 [추정] |
| 일본 · 모노호시자오 | `hirakiGiri` 開き斬り (体捌き) | 공용 zornhauL(逆袈裟 쪽) 길 | `{ lat: +0.3, fwd: 0.3, when: 'approach' }` | 体捌き·斜めに開く [전승] · 오륜서에 「足づかひ」(陰陽の足) 항목 있음 [원문 — 쪽 확인 전] |
| 중국 · 청강검 | `chebuYaoji` 掣步 腰擊 | 공용 zwerch(腰擊) 길 | `{ lat: −0.25, fwd: 0.25, when: 'strike' }` | 조선세법 걸음 용어 掣步 [원문 확인 전 — 무비지 쪽 번호 아직 못 찾음] · 腰擊 「向前進步腰擊」 쪽158/0572 [원문] |

- 수(lat·fwd)는 모두 [추정], 사장님 확인 전. 범위 근거: 발 목표가 `GAIT.maxReach` 0.5 m(`config.js:188`) 안이어야 하고, pass 는 이미 guardWidth 0.22 를 옆으로 더한다 → `|lat| ≤ 0.35` 이면 √(0.35²+0.35²)≈0.49 로 그 안 [계산].
- **base(고를 가중치)**: 같은 길의 공용 동작 base 와 같게 둔다(따로 쓰이게 하려면 올려야 하는데 그건 유파 맛을 바꾸는 일 — redondo 기록 참고). 처음 48 판에서 안 고르면 base 를 그 공용 동작 × 1.1 로 [추정].
- 숫자: 유파마다 넷 = 20. 독일은 넷 다 끔.

### 1-5. 위험
| 위험 | 무엇을 보나 | 되돌림 |
|---|---|---|
| **베는 중 옆으로 한 발** — 몸통을 돌리는 베기(가로베기)와 옆 걸음이 같은 때라 골반이 한 발 위에서 비틀림 → 넘어짐·휘청 | 걸음 부탁 뒤 1 s 안 내 knockDown/getup 수, offBalance 최대 | step 칸 지움 = 오늘 |
| 'approach' 비껴 딛기 동안 **상대가 먼저 침**(손이 놀고 발만 움직임) | 비껴 딛는 동안 맞은 수 | when 'strike' 로 |
| **간격 셈** `contactDist()`(`ai.js:964-968`)는 정면 거리만 본다 — 옆으로 0.3 m 가면 실제 가슴 거리는 √(d²+0.3²)로 약간 늘어 칼끝이 덜 닿음(1.5 m 에서 +0.03 m) [계산] | 헛친 비율(missed) | fwd 를 0.05 늘림 |
| 기술 걸음은 **뒤로 당긴 스틱(move.y < −0.1)이면 거절**(`gait.js:219`) — strike 가지가 stepDelay 동안 −0.21 을 넣는다(`ai.js:1392`) → 첫 프레임 거절 후 다음 프레임 다시(gaitStep 주석의 그 꼴) | requestStep 거절 수 | 지금도 같은 규칙이라 새 위험 아님 |
| 벽 처리(`ai.js:1436-1448`)는 strike 중엔 꺼져 있다 → 울타리 옆에서 옆 걸음이 바깥으로 | 울타리 4.6 m 밖 걸음 | rA > 4.4 면 lat 부호를 가운데 쪽으로 |
| 롱소드 관문 | step 칸 없는 기술은 코드 길이 같아야 함 | gait.js:467 줄은 `if (req.side)` 로 감싸 0 이면 아예 더하지 않기 |

### 1-6. 측정 계획 (48 판)
- 기준: `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main` (AI 무기 대 롱소드 AI, 자리 바꿔 24+24, 같은 씨앗). 그 유파 넷 켬 vs 셋 켬(새 것 끔). 윌슨 95 % 띠 ±14 점 = 소음 폭.
- 새 계기(도구 쪽만, motion_lab duel 둘째 줄에 덧붙임 — 다른 작업자 일 끝난 뒤): step 기술마다 ① 쓴 횟수 ② 걸음 받아짐/거절 ③ **베는 순간 상대 칼끝 줄에서 벗어난 거리**(상대 칼 선분과 내 가슴의 수평 거리, 걸음 전 → 칼이 닿는 때) ④ 상대 heading 과 '상대→나' 방향의 각 차(옆에서 들어갔나) ⑤ 맞음/막힘/헛침 ⑥ 걸음 뒤 1 s 안 내 넘어짐.
- 홀로 탐침(48 판 전, 5 분): `tools/sim/step_strike.mjs` 꼴 — 가만히 선 상대에게 zwerch 를 (a) 걸음 없이 (b) 앞 걸음 (c) step 걸음으로, 에너지·넘어짐·heading 차. 새 파일 `tools/sim/side_step_probe.mjs` 로(step_strike 는 건드리지 않음).
- 관문: fights12 · live_battery · finish_thrust · corr_s0 12/12 · weapon_smoke 16/16 · vite build — 독일 끔이므로 바이트 같아야 한다(기준 sha 는 그때 main 의 것).

### 1-7. 시간 (2 등급, 시계 예상)
- 코드 7 곳 30 분 · 탐침 10 분 · 48 판 넷(독일 제외) + 혼자 줄 = 결투 8~10 줄(동시 4) 약 20 분 · 관문 10 분 · 기록 10 분 → **약 80 분**.

---

## 2. 다리 걸기 · 다리 베기 — 자세 무너뜨리기 (2])

### 2-1. 지금 있는 것 (코드)
| 무엇 | 어디 | 내용 |
|---|---|---|
| 낮은 베기 | `ai_techniques.js` unterhau/unterhauL (빈틈 'LL'·'LR') | 공용, 모든 유파. 중국 이름 跨左擊은 zornhauL 에 붙어 있음(school_unique §2) |
| 다리 상처 → 다리 기능 | `src/fighter.js:1379` | 다리 부위(thigh·shin·foot)를 날이 가르면 `limbs.legF/legB −= severity × 0.7` |
| 다리 기능의 쓰임 | `fighter.js:675` legHealth = 두 다리 평균 · `:1970` 걷는 속도 × (0.45+0.55·legHealth) · `:2040` 다리 힘 · `:2330-2334` 다리 근육 × (0.4+0.6·limb) · `:2279` 절뚝 · `:1218` 일어나는 시간 ÷ legHealth | |
| 주저앉음 | `fighter.js:1229` | **legHealth < 0.25 면 knockDown(false)**(무릎 꿇기 → 일어남 시도, `:1235` 여전히 < 0.25 면 무릎 꿇은 채) |
| 균형 게이지 | `fighter.js:1322` | 모든 상처(부위 상관없이) `balance −= energy × 0.5`(`config.js:439`), 회복 22/s(`:440`), 0 이면 knockDown(`:1228`) |
| 다리 절단 | `fighter.js:1512-1524` (10/8 절단 본판) | `limbs[leg] = 0`, `missingLeg`, knockDown(true), 서지 않음 |
| 넘어짐(물리) | `fighter.js:1226-1228` | 기울기 > 55°(`config.js:54`) 또는 발 밖으로 벗어남 0.25 s(lostFooting) |
| 밀치기 | `fighter.js:1060-1130` closeStep · `ai.js:911-961` closeQuarters · `characters.js:77·139·207·273·336` persona.close | 닿는 거리 `CLOSE.reach = 0.53+0.11+hiltLength`(롱소드 0.77, `config.js:106-108`) 안에서 딛고(requestStep) 몸·칼자루로 누름 + legDrive 400 N. 넘어짐은 상대 균형이 정함. 설계 기록: 70 번 중 넘어짐 0(shove_design §상대 반응) |
| **충돌 그룹** | `fighter.js:374-376` | 몸(허벅지·정강이 포함) = 땅·상대 몸·상대 칼. **발 = 땅·상대 칼만**(상대 몸·발과 안 부딪힘). 칼 = 땅·상대 몸·상대 칼·**상대 발** |

**읽기 (b — 다리 베기가 넘어뜨리나)**: 한 번에는 거의 아니다. severity 0.5 다리 베기 한 번 = 그 다리 −0.35 → legHealth 0.825 [계산]. 주저앉으려면 두 다리 합이 0.5 아래 — 한 다리를 다 잃어도(0) 다른 다리가 1 이면 평균 0.5 라 안 주저앉는다. 대신 그 다리 근육 ×0.4~1, 속도 ↓, 절뚝. 균형 게이지는 부위와 상관없이 에너지만 본다(다리라고 더 깎이지 않음). **"자세 무너뜨리기"를 다리 베기로 만들려면** 다리에 맞은 둔타·베기의 균형 몫이 커야 한다 — pole_strike_effects.md ①-3 의 '정강이·무릎 둔기 E ≥ 40 J → legHealth −E/300' 제안(R3, 미구현)과 같은 자리.

**읽기 (a — 다리 걸기)**: 내 **발** 콜라이더는 상대 다리에 닿지 않는다(그룹). 그래서 '발을 걸어 넘기기'는 물리로 지금 불가능. 닿는 것: 내 정강이·허벅지 ↔ 상대 정강이·허벅지(몸끼리), 내 **칼날** ↔ 상대 발·다리.

### 2-2. 제안 (a) — 밀치기의 낮은 변형 `kind: 'sweep'`
꼴: 붙은 거리(밀치기와 같은 `CLOSE.reach` 안, 같은 걸쇠·같은 사건 E1/E2/E4)에서 **내 뒷발이 상대 앞발 바깥 뒤로 지나 딛고(pass + side)**, 누르기 동안 골반 대신 **상대 가슴을 비스듬히 뒤-옆으로**, 동시에 **상대 앞발 정강이를 내 쪽으로** 당긴다(두 힘의 짝 = 걸어 넘기기의 회전) [해석].
- 걸음: `closeStep` 의 `requestStep({ kind: 'pass', fwd: L, side: ±SW_SIDE, duration: 0.3 })` — §1 과 같은 side 칸을 쓴다(1] 을 먼저 하면 거의 공짜).
- 힘: 누르기(press) 동안 legDrive 와 같은 꼴의 땅 반작용 한 쌍 — (i) 상대 `chest` 에 수평 `SW_PUSH`(N, 방향 = 상대 뒤 + 내 걸음 쪽), (ii) 상대 앞 `shin` 에 수평 `SW_HOOK`(N, 방향 = 내 쪽). **다리 걸림 조건은 기하**: 내 req 발의 착지점이 상대 앞발 뒤 `SW_GAP` 안 — 아니면 (ii) 없음(그냥 밀치기). 발 충돌을 켜지 않고 '걸렸다'를 기하로 판정하는 것 — 물리 접촉이 아닌 힘이라 사장님 방침(물리로 정함)에 반 걸음 어긋남 → **사장님께 여쭐 것 1**.
- 대안(물리 그대로): 발 충돌 그룹에 상대 몸(정강이)을 더함(`fighter.js:375` footGroups 에 `otherBody`). 위험이 크다 — 모든 붙은 장면·밀치기·잡기 걸음에서 발이 상대 정강이에 걸려 둘 다 넘어지는 일이 생기고, 관문 sha 가 다 바뀐다. 시험 스위치(`CLOSE.footHit`, 기본 끔) 로만.
- 끝: 상대 넘어짐(getup/down) · 떨어짐 · 0.6 s(시간값 — 여쭘) 중 먼저.
- AI 연결: `persona.close = { rate, kind: 'sweep', then }` — closeQuarters 는 kind 를 몸 쪽(`me.closeStepKind`, `me.closeSweep`)에 넘기기만. 유파 기본 close(아래)를 두면 persona 가 덮는다.
- 값(모두 사장님 확인 전): `SW_SIDE` 0.2 m · `SW_PUSH` 250 N · `SW_HOOK` 300 N · `SW_GAP` 0.15 m · 끝 0.6 s · rate 는 유파·인물 표 [모두 추정]. 근거: legDrive 400 N(밀기 최대 300~500 N 자료)보다 작게, 둘 합은 그 안.

### 2-3. 제안 (b) — "자세 무너뜨리기" 고유 동작 (다리 베기 쪽)
- **길**: 새 길 없이 공용 낮은 베기(unterhau)로 되므로 고유 동작으로 치지 않는다. 고유로 만들려면 **패시브**가 맞다(school_passive 꼴): `when: 'landed'` 이고 맞은 부위가 다리 → `do: { chain: ['oberhau'] }` "다리를 베어 낮춘 뒤 머리" [해석]. 새 수 = p 하나.
- **판정 쪽(효과가 있게 하려면)**: 다리 베기의 균형 몫 `balance −= energy × 0.5 × LEG_STAGGER`(다리면 ×LEG_STAGGER, 기본 1 = 오늘). 또는 R3 둔기 부위표(정강이)와 한 묶음. → 판정 변경이라 롱소드 관문이 바뀜 = **사장님 여쭐 것 2**(LEG_STAGGER 값, 기본 1 이면 아무 일 없음).

### 2-4. 유파
| 유파 | 무엇 | 출처 |
|---|---|---|
| 일본 | 足払い(발 쓸기) — (a) sweep | [전승] 유술·검술 교류 기법. 원문 없음 |
| 중국 | 跨左擊 「掃掠下殺」 — 쓸어 아래를 벰 → (b) 패시브 '낮게 베고 머리' | 무비지 쪽171/0585 [원문] |
| 독일 | Ringen am Schwert 다리 걸기 — (a) sweep, **기본 끔** | Ringeck·Dobringer 계열 칼 씨름 [원전 2차] |
| 이탈리아·이베리아 | 없음 (레이피어·몬탄테 원전에서 다리 걸기 근거를 찾지 못함) | — |
→ 셋(일·중·독). 수 맞추기는 §4 표.

### 2-5. 측정
- (a) `tools/sim/shove_check.mjs` 꼴 칸 측정(새 파일 `sweep_check.mjs`, shove_check 는 그대로): 시작 거리 3 × 상대 2(기본 AI·꼭두각시 버팀) × 무기 3, 칸마다 N=10, 같은 대본을 sweep 끔(=밀치기)으로도. 보는 것: 상대 넘어짐(getup/down) 1.5 s 안, **내 넘어짐**, 걸림 판정 수, 떨어진 거리.
- 그다음 48 판: sweep 을 가진 인물/유파 vs 없음 (`duel <무기> 24 main`), 둘째 줄에 sweep 시도·걸림·넘어뜨림.
- (b) 패시브는 school_passive 측정 꼴(혼자 줄 48 판, 발동 횟수).

### 2-6. 위험과 시간
- 위험: 내 쪽도 한 발로 서서 비튼다 → 내가 먼저 넘어짐. 밀치기 70 번 넘어짐 0 의 기록이 있어 힘이 모자랄 수도 있음(그러면 값을 올리는 게 아니라 '걸림' 기하·방향을 다시 봄). 시간값(0.6 s)·기하 판정 = 사장님 방침 확인 필요.
- 시간: (a) 몸 쪽 closeStep 가지 + AI 연결 40 분 · sweep_check 새 도구 30 분 · 칸 측정 20 분 · 48 판·관문·기록 30 분 → **약 2 시간**. (b) 패시브 한 줄 = 패시브 구현이 끝난 뒤 **20 분**, LEG_STAGGER 는 사장님 답 뒤 **30 분**.

---

## 3. 손잡이 찍기 (3])

### 3-1. 지금 자루가 맞나 (코드)
| 무엇 | 어디 | 내용 |
|---|---|---|
| 자루 콜라이더 | `src/fighter.js:568-597` | 무기 부품마다 콜라이더. 칼날 아니면 `colliderInfo { kind: 'weapon', part: 'hilt' }`. 롱소드 부품(`weapons.js:361-370`): 손잡이 상자 · **폼멜 공 r 0.03 m, y −0.12, 0.418 kg** · 코등이 상자 0.11 m. 무기 전체 1.60 kg(docs/weapons.md 표) |
| 충돌 그룹 | `fighter.js:376·384` | 칼(자루 포함) = 땅·상대 몸·상대 칼·상대 발 → **자루는 상대 몸에 부딪힌다** |
| 사건 | 모든 무기 부품 `CONTACT_FORCE_EVENTS`, 문턱 1(`fighter.js:590-591`). 가르고 지나가기 훅(FILTER_CONTACT_PAIRS)은 칼날만 | |
| 판정 | `combat.js:412-428` 접촉힘 사건 → `pairOf`(`:82-93`, 자루도 'weapon') → `strike(pr, 점, false)`(`:585-608`) → `analyze` — `isBlade = part === 'blade' && …`(`:152`) 거짓 → **`type = 'blunt'`**(`:163`), 에너지 = ½·(freeMass + armAssist 0.3)·속도²·2(energyScale) × power × mBlunt(`:284`). 6 J 미만 무시(`config.js:287`) |
| 효과 | `fighter.js:1315-1357` applyWound 둔타 가지 | 아픔 · 균형 −E×0.5 · 옷 닳음 · **머리·목이면 의식 −E/140, E×투구계수 > 45 J 면 주저앉음(> 90 쓰러짐)**, 멍함 +E/100 |
| 같이 쓰는 쿨다운 | `combat.js:588` 키 `공격자:부위` 0.25 s | 자루로 친 부위는 0.25 s 동안 칼날 상처도 안 받음 — 찍고 곧장 베기에 걸림 |

**결론: 폼멜은 지금도 맞으면 둔타로 셈된다. 새 `kind`·combat 변경은 필요 없다.** 이미 붙은 장면(밀치기 누르기 '코등이·팔뚝이 상대 몸통에 버팀으로 닿는다', `fighter.js:1054-1059` 주석)에서 자루 둔타가 난다 — 몇 번인지는 아직 안 쟀다 [측정 전].

**세기 셈** [계산 — 측정 전]: 폼멜을 칼 축 방향으로 밀어 넣으면 맞는 점이 축 위라 freeMass ≈ 칼 전체 1.6 kg(`combat.js:622-628`, 회전 몫 0) → mEff 1.9 kg → **E ≈ 1.9·v² J**. 4 m/s = 30 J, 5 m/s = 48 J, 6 m/s = 68 J. 맨 얼굴에 **약 4.9 m/s 넘으면 지금 규칙만으로 주저앉음**(45 J). 투구면 helmetBlunt 로 깎임. 폼멜 손 속도 4~6 m/s 는 [추정 — 붙은 거리 팔 뻗기].

### 3-2. 막는 것 — 손 길
- 패드 자리(x, y) → 손 위치 **와 칼 방향**이 함께 정해진다(`guards.js:188` guardAt: hand·dir 을 섞음). TECH 길은 패드 점의 줄이므로, 손을 앞으로 내미는 길은 **칼끝도 앞으로 돌아** 찌르기·베기가 된다 — 폼멜이 앞장서는 꼴(칼끝 뒤·위, 손 앞)을 길로 그릴 수 없다.
- 이미 있는 탈출구: **덧씌우기 `th`**(`guards.js:271-292` overlay — 탭 찌르기 thrustPose 가 섞은 자세 위에 hand·dir·몸 돌림을 w 만큼 덧씌움). 같은 꼴로 **폼멜 덧씌우기**를 만들면 된다: `hand` = 가슴 앞·약간 위로 뻗음, `dir` = 칼끝이 뒤-위(지붕 자리의 dir 그대로), 몸 = 앞으로 숙임 약간.
- 그래서 TECH 꼴만으로는 안 되고, **skill.js 에 `pommel()` 동작**(thrust() 와 같은 틀: 겨눔 → 뻗기 → 버팀 → 돌아옴, 약 0.35 s [추정])이 필요하다. AI 는 `this.me.skill.pommel()` 를 부른다(ai.js 가 `skill.thrust({ step: false })` 를 부르는 `:894` 와 같은 자리 꼴).

### 3-3. 제안 — `knaufschlag` (붙은 거리 기술)
```js
{ name: 'knaufschlag', kind: 'pommel', from: G.tag, close: true, base: 0.6, src: '…' }   // path 없음 — skill.pommel() 가 손을 맡는다
```
- 고르는 자리: 보통 기술 고르기(`opportunity`·`pickTech`)는 `d < clinch` 에서 안 친다(`ai.js:1394` 붙으면 베며 물러남(공격 중) · `:1432` 공격 밖이면 떨어짐, 롱소드 clinch 1.25 m — `weapon_measured.js:25`). 폼멜 거리는 **CLOSE.reach 0.77 m 안**이라 보통 고르기와 겹치지 않는다 → **closeQuarters 의 `then` 하나로 단다**: `persona.close.then = 'pommel'` (밀치기 끝 → 곧장 찍기), 그리고 E2(칼 맞물림) 사건에서 `kind: 'pommel'` 이면 밀치지 않고 바로 찍기.
- `kind: 'pommel'` 은 **AI 기술 꼴 표시**일 뿐 combat 의 type 이 아니다(combat 은 지금처럼 자루 접촉을 blunt 로). ai.js 가 pommel 기술을 고르면 path 대신 skill.pommel() 을 부르고, follow 를 0.2 s 로.
- Mordschlag(칼날을 거꾸로 쥐고 코등이·폼멜로 망치처럼)는 **쥠을 바꿀 수 없어**(두 손이 손잡이에 고정, hands.js) 지금 판에선 못 함 → 보류.
- 값(사장님 확인 전): pommel 뻗기 시간 0.35 s · 뻗는 거리(손 앞으로 +0.25 m) · 덧씌우기 무게 w 최대 1 · base 0.6 · close.rate 유파/인물 표 [모두 추정].

### 3-4. 롱소드 관문에 대한 위험
- skill.pommel() 은 부르지 않으면 코드 길이 같다 → 기본 AI·플레이어 그대로. persona.close 가 'pommel' 인 인물만 바뀜. **combat 변경 없음** → 판정 sha 위험 없음.
- 쿨다운 공유(`combat.js:588`): 찍은 부위 0.25 s 칼날 무효 — '찍고 베기' 이음이 그 부위를 바로 못 벤다. 바꾸려면 키에 `pr.w.part` 를 넣음 = combat 변경 = 관문 영향(자루가 닿는 장면이 지금도 있으면 sha 바뀜) → 그대로 두는 것을 권함.
- 붙은 거리에서 칼이 내 몸통과 부딪히는 그룹(`fighter.js:384`, HL 일 때 myTorso) — 폼멜을 당겨 뻗는 동안 내 가슴에 걸릴 수 있음 → 탐침에서 볼 것.
- 사람 쪽(플레이어): 버튼/몸짓이 없다. 붙은 거리에서 탭 = 찌르기 자리라, 플레이어 몫은 따로 여쭘(이 글은 AI 만).

### 3-5. 유파
| 유파 | 무엇 | 출처 |
|---|---|---|
| 독일 | Knaufschlag(폼멜 치기) — **기본 끔** | Zettel 계열 주해·Talhoffer 1459/1467 그림 [원전 2차] |
| 일본 | 柄当て(つかあて, 자루 끝 치기) | [전승] 고류 형. 원문 쪽 없음 |
| 이탈리아 | (레이피어) Capo Ferro 의 presa(빈손 잡기) 뒤 폼멜 — 근거 약함 | [추정] — 넣지 않음 |
→ 둘(독·일).

### 3-6. 측정
- **오늘 값부터**(코드 안 바꿈, 5 분): 기본 48 판에서 자루 둔타 횟수·에너지·부위 — combat 훅 `onWound` 에서 `pr.w.part === 'hilt'` 세기(도구만, `tools/sim/hilt_hits.mjs` 새 파일). 이 수가 0 에 가까우면 3] 은 '찍기 동작'을 만드는 일이고, 많으면 이미 있는 효과를 이름 붙이는 일.
- 홀로 탐침: 가만히 선 상대(맨머리·투구) 앞 0.6 m 에서 skill.pommel() 10 번 — 손 속도·에너지·주저앉음·내 칼이 내 몸에 걸림.
- 48 판: knaufschlag 가진 인물(하인리히 close then 'pommel' 시험판) vs 오늘, 둘째 줄에 찍기 시도·맞음.

### 3-7. 시간
- 오늘 값 세기 10 분 · skill.pommel + 덧씌우기 50 분 · ai 연결(closeQuarters then·E2) 20 분 · 탐침 15 분 · 48 판·관문·기록 30 분 → **약 2 시간**.

---

## 4. 유파 수 맞추기 ("얼추 비슷")
| 유파 | 지금 고유 | +1] | +2] | +3] | 합 |
|---|---|---|---|---|---|
| 독일 | 3 (끔) | 1 (끔) | sweep (끔) | knaufschlag (끔) | 6 |
| 이탈리아 | 3 | inquartata | — | — | 4 |
| 이베리아 | 3 | talhoRodeado | — | — | 4 |
| 일본 | 3 | hirakiGiri | 足払い | 柄当て | 6 |
| 중국 | 3 | chebuYaoji | 掃掠 패시브 | — | 5 |
- 2]·3] 은 근거가 있는 유파만이라 4~6 으로 벌어진다. 맞추려면 (i) 2]·3] 을 유파가 아니라 **인물(persona.close)** 몫으로 두거나(오늘 밀치기와 같은 자리 — 권함), (ii) 이탈리아·이베리아에 1] 을 둘씩(inquartata + 찌르기 쪽 비켜 딛기 / 둥근 걸음 둘). → **사장님 여쭐 것 3**.

## 5. 사장님께 여쭐 것 (모두 확인 전)
1. 다리 걸기의 '걸림'을 **기하로 판정하고 힘을 거는 것**(발 충돌은 끈 채) 괜찮으신가, 아니면 발 충돌을 켜는 시험판(관문 다 바뀜)으로 갈까.
2. 다리 베기 균형 몫 `LEG_STAGGER`(기본 1 = 오늘) — 올리면 롱소드 판도 바뀜.
3. 2]·3] 을 유파 몫으로 할지 인물 몫으로 할지(수 맞추기 §4).
4. 1] 의 lat·fwd(0.25~0.35 m)·when, 2] 의 SW_* 다섯, 3] 의 뻗기 0.35 s·+0.25 m·base 0.6.

## 6. 권하는 순서
**1] 비껴 들어가 베기를 먼저** 한다: 다리에 옆 딛기 칸이 이미 있어 코드가 가장 적고(7 곳, 대부분 몇 줄), 다섯 유파에 하나씩이라 수가 맞고, 롱소드 관문은 독일만 끄면 바이트 그대로 지킬 수 있으며, 2] 의 다리 걸기 걸음(pass + side)이 이 일을 그대로 다시 쓴다(약 80 분). 둘째로 **3] 손잡이 찍기의 '오늘 값 세기'(10 분)** 를 해서 자루 둔타가 이미 얼마나 나는지 본 뒤 skill.pommel 덧씌우기로 간다 — combat 변경이 없어 판정 위험이 없다(약 2 시간). **2] 는 마지막**: 다리 베기는 이미 되고, 다리 걸기는 '기하 판정 대 발 충돌' 사장님 방침 답이 먼저 필요하며 밀치기 70 번 넘어짐 0 기록상 힘 맞추기가 가장 불확실하다(약 2 시간 + 답 대기). 2](b) 다리-베고-머리 패시브는 패시브 구현이 끝나면 20 분짜리로 끼운다.

## 7. 시간 (시계, KST)
- 03:19 시작 — 읽기(설계서 셋 · ai.js 발놀림·closeQuarters · gait.js requestStep·target · fighter.js driveBalance·closeStep·applyWound·충돌 그룹 · combat.js 판정 · guards.js 덧씌우기 · weapons.js 롱소드 부품)
- 03:2x 글쓰기 · 줄 번호 다시 맞춤 · 커밋 — 끝 03:28, 실제 약 9 분(시계 기준, 목표 40 분 안). 측정은 하지 않았다(설계만 — 모든 수는 [계산]·[추정])
