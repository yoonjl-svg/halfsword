# 열째 판 뛰기 — 다리 코드 지도 (뒤 일꾼은 코드 대신 이것을 먼저 읽는다)

줄 번호는 이 지도를 마지막으로 고친 커밋의 것이다(고치면 같은 커밋에서 지도도 고친다). 마지막: 뛰기 1 단계 셋째 시도(제자리 뜀 짓는 중 — 뜬 발 땅 위 틈 · 일찍 펴기 · 늦은 발 내리기 · 높이 되먹임 · 충격량 몫 고침 kJ · 공중 반작용 상한). gait.js · fighter.js 줄 번호는 둘째 시도 그대로(안 바뀜).

## 1. 한 스텝의 차례 (fighter.js 가 부름 — fighter.js 는 이 판에서 안 바뀜)

`Fighter.step` 안 (src/fighter.js 1784 ~ 1810):
1. `runStep(f, dt)` (src/run.js 74 ~ 187) — 사람 몸 · `runReach` 둔 AI 만. `f.run` 의 `on`(뛰기 켜짐) · `fast` · `k`(섞임 0 ~ 1) · `brake`.
2. `driveBalance(dt)` (fighter.js 2926 ~ 3013) — `want` 를 짓고(`runWant` run.js 206 ~ 226) → `updateFooting` (3018 ~ 3095 · `f.com` · `f.comVel` · 넘어짐 셈 · `G.fly` 갈래) → **`gait.update(dt, want, fwd, rgt)`** → `legDrive.intent = { want, aLim, h, yaw, yawRate }`.
3. `gait.footLoads()` (gait.js 2495 ~ 2515) — 딛은 발(`l.stance`)의 땅 힘 `l.N` · 미끄러진 딛은 자리 따라 옮김.
4. `applyPose` (fighter.js 3110 ~) → 서 있으면 **`gait.poseLegs()`**.
5. `driveJoints()` (3232 ~) — 관절 모터(목표 속도 ± 15 rad/s · 스프링 몫 상한 `max × cap` · 감쇠 몫은 상한 없음) 뒤 **`legDrive.drive()`**.
6. `driveAid()` (2858 ~) — `legDrive.rem` 을 상한 안에서 골반에 밖 토크로.

## 2. 뛰는 길이 갈리는 곳 (뛰는 몸만 — 시뮬 대본 몸 · 1:1 AI 는 `f.run` 이 없어 안 탄다)

| 어디 | 줄 | 갈림 |
|---|---|---|
| `gait.js update` | 859 | `this.runG \|\| f.run?.on` 이면 `runGaitStep` — 참이면 그 스텝은 걷는 걸음 셈(860 ~ 1624)을 건너뜀. 이 앞(813 ~ 858)의 `rk` · `runCapTick` · 유파 배율 · `enter/sense` 는 그대로 돈다 |
| `gait.js poseLegs` | 2271 | `this.runG` 이면 `runPose` 로 |
| `gait.js exit` | 314 | `this.runG = null` |
| `gait.js` 끝 | 2623 | `legLen · minJerk · ANKLE_H` 내보냄 (run_gait.js 가 씀) |
| `legs_vmc.js drive` | 593 · 633 | 593 `f.gait?.runG` 면 이끄는 힘 반작용 상한(디딤 `swReact` · 공중 `swReactAir`) · 633 `RP = gait.runG.plan`(디딘 발이 있을 때) — 아래 §4 의 뛰는 디딤 갈래 |
| 옛 날기 (지울 것 · 지금도 그대로) | gait.js 986 `this.fly` · 1024 `Tc` · 1366 `flyAir` · poseLegs `RUN.flySwingV` · fighter.js 2997 `RUN.flyPush` · 3081 `G.fly` | 뛰는 몸은 이제 run_gait 가 맡아 이 길은 뛰기가 끝나 줄어드는 동안(`f.run.fast`)에만 탈 수 있다 |

## 3. src/run_gait.js — 뛰는 걸음 장치 (새 파일 · 330 줄)

| 함수 | 줄 | 하는 일 · 읽는 값 |
|---|---|---|
| `runShape · shapeAt` | 25 ~ 42 | 수직 힘 꼴 sin(πs)^`forceP`(1 + `forceSkew` cos πs) · 넓이 A · 힘 평균 때 ū |
| `contactT` | 48 | 디딤 시간 = `contactLen ÷ v` (`contactMin ~ contactMax`) |
| `lift` | 51 ~ 63 | 뗌: `stance=false` · `kind='run'` · `t=0 · T` · 길 처음 `p0 = 발목` · `runFix=false` |
| `plan(g, l, frac)` | 66 ~ 103 | 디딜 때 충격량 계획 → `g.runG.plan = { k, t, Tc, Tf, J, A, vy0, vp, cs, cn, capMin, Jc }`. Tc = contactT × frac(들어가기가 걷는 디딤 가운데면 0.5) · Tf = 1 ÷ `cadence` − Tc (`flightMin ~ flightMax` · `rampSteps` 걸음에 올림) · **vto = g Tf ÷ 2 + `hGain` × rec** — rec = 제 높이(`tdKnee` 다리)보다 낮게 닿은 몫 `hLow` 를 ± `hRec` 로 자름(셋째 시도 · 잰 Δh 는 안 씀) · J = M(vto − vy0) + M g Tc · 계획 최고 > `capUse` × 지난 디딤 힘 한도 최소 ÷ `kJ` 면 먼저 rec = 0, 그래도 넘으면 Tf 를 줄임(93 ~ 100) |
| `runGaitStep` | 106 ~ 227 | 112 ~ 120 들어가기 미룸(`legVmax` · `enterDv`) · 121 ~ 139 들어가기 · 142 ~ 154 가려는 속도 `R.vdes`(`GAIT.goAccel · stopDecel`) · **162 ~ 176 디딤 끝(`plan.t ≥ Tc`): `cbar` · `capMin` · 168 ~ 173 충격량 몫 고침 `R.kJ` = 시킨(`P.Jc`) ÷ 몸에 닿은(M Δvy + M g t) 의 반씩 옮김(1 ~ `kJMax`) → `lift`** · 178 ~ 189 튕긴 발(`tdLoad` · `lostT`) · 191 ~ 203 나가기 · 205 ~ 225 디딤 판단(`tdEarly` · `tdLoad`) · `bias`(`placeKi · placeBiasMax`) |
| `placeOf` | 230 ~ 241 | 디딤 자리 = 닿을 때 무게중심 + 앞 (v ū Tc − c̄ + `placeGain`(v − vdes) + bias, `placeMin ~ placeMax`) + 옆 (side × `width` + v ū Tc + `placeGain` v, ± `catchReach`) |
| `lead` | 248 ~ 262 | 뜬 발목 이끄는 힘 (`GAIT.swingMass` · `swingHz` · `swingZeta` · 어긋남 한도 `RUN.swingErr` · 상한 `GAIT.swingFmax` — 앞먹임 없음) → `legDrive.legs[k].pull` |
| `runPose` | 265 ~ 330 | 270 ~ 273 디딤 ↔ 뜸이 바뀐 스텝에 모터 목표 속도 기록(`prevRV`)을 지움 · 모터 배율: 디딘 다리 = `GAIT.stance*` · 목표 = 지금 다리 꼴 / 뜬 다리 = 모두 `GAIT.swingHip*`. 292 뜬 발의 닿을 때 `T` = 다른 발 디딤 남은 시간 + 그 계획의 Tf (스텝마다) · 길 `p0 → p1`(placeOf · 닿기 0.04 s 앞에 못박음) minJerk · **302 ~ 316 높이(셋째 시도): 무릎 접기 `tdKnee → fold → tdKnee` 를 닿기 `extT` 앞에 끝냄 · 편 뒤로는 발을 땅 위 `tdClr` 보다 높이 안 붙듦 · 땅 위 틈 = `tdClr` × min(뗀 뒤 시간, 남은 시간) ÷ `tdTau` · 닿을 때가 지나면 땅 밑 `lateDip` 까지** · `GAIT.swingVmax` → `lead` → `legIK` |

## 4. src/legs_vmc.js — 다리 구동 `LegDrive`

| 함수 | 줄 | 하는 일 · 읽는 값 |
|---|---|---|
| `senseLeg · footContact` | 228 ~ 279 | 관절 자리 · 발 틀 · 압력 중심 범위 |
| `legTorques` | 301 ~ 338 | `legRaw` 로 자르기 앞 값 → `LEGS.limit × 근력 몫` 자르기 · 장부 · 쌍으로 걸기 (걷기와 같은 수) |
| `legRaw` | 344 ~ 387 | 자르기 앞 관절 토크 → `L.raw` (`ax ay az` 발목 · `k` 무릎(− 폄) · `hx hy hz` 엉덩이) · 걸지 않음 |
| `trunkShare(…, ny)` | 393 ~ 412 | 뛰는 디딤: 압력 중심 · N · 비틀기 ny 를 둔 채 기울기 몸통 토크(Mx, Mz)를 σ 배로 낼 때 모든 축이 한도 안인 가장 큰 σ (yaw 는 σ 로 안 줄임) |
| `runTwist` | 419 ~ 436 | 뛰는 디딤의 비틀기 ny 미리 자르기(§3-6): 마찰 원뿔 ∩ 발목 비틀기 · 엉덩이 돌림이 한도 × 근력 × `capUse` 안인 범위 (ny = 0 · 1 두 점 일차식) |
| `airTrunk` | 442 ~ 459 | 공중(뛰는 걸음 · 딛은 발 없음): 바란 몸통 토크(되먹임 − 내딛는 다리 반작용)를 `RUN.airTilt` 로 자르고 두 엉덩이에 반씩 — 이끄는 힘이 이미 쓴 몫(`L.pulled` · `L.raw`) 위로 축 한도 안만 · 관절 안 쌍 |
| `forceCap` | 465 ~ 485 | 뛰는 디딤 힘 한도 · `this.capAxis`(0 발목 안팎 · 1 비틀기 · 2 굽힘 · 3 무릎 · 4 엉덩이 벌림 · 5 돌림 · 6 굽힘폄) |
| `drive` | 568 ~ 918 | 584 ~ 610 든 다리 이끄는 힘 → 토크 · `swM` — **593 ~ 600 뛰는 걸음(`runG`)이면 반작용 크기를 디딤 `RUN.swReact` · 공중 `RUN.swReactAir` 로 자름** / 611 서 있지 않으면 끝 / 613 ~ 626 딛은 발 / 633 ~ 650 수직 힘 (`RP` 면 계획 꼴 × **`runG.kJ`** + `vyGain` · 아니면 높이 스프링) / 651 ~ 700 몸통 토크 M / 704 딛은 발 없음 → 뛰는 걸음이면 `airTrunk` / 713 ~ 776 압력 중심 / 777 ~ 787 뛰는 디딤 압력 중심 / 797 ~ 810 칼 팔 몫(뛰는 디딤은 안 셈) / 815 ~ 842 뛰는 디딤: `runTwist` → `trunkShare` → `forceCap` → 깎음 `dbg.capCut` — **832 계획이 읽는 `capMin` 은 디딤 가운데 `RUN.capWin` 몫 안만** / 844 마찰 / **849 `RP.Jc` += 시킨 N dt** / 851 ~ 896 발마다 (한 발 뛰는 디딤은 `A.ny = nyRun`) / 897 ~ 914 `rem` — 뛰는 디딤 0 / 915 관절 토크 |

`legDrive.plan`(디딘 스텝만 · 재는 도구가 `J` 를 읽음) · `dbg.capCut` · `dbg.trunkShare` 는 스텝마다 다시 둠. 걷는 길이 지나는 새 줄은 `L.pulled` 표시(588 · 591) 하나뿐 — 수는 안 바뀜(593 의 갈래는 `runG` 가 없는 걷는 몸에서 안 탄다).

## 5. config.js RUN 의 뛰는 걸음 값 (486 ~ 525)

`contactLen · cadence · contactMin · contactMax · flightMin · flightMax · rampSteps · forceP · forceSkew · loadMax · capUse · vyGain · copMean · placeGain · placeKi · placeBiasMax · placeMin · placeMax · catchReach · width · tdKnee · fold · swingHz · swingZeta · tdEarly · tdLoad` + 둘째 시도 `lostT · hRec · swingErr · swReact · airTilt · enterDv` + 셋째 시도 `swReactAir · extT · hGain · capWin · kJMax · tdClr · lateDip · tdTau` (`hRec` 의 뜻이 바뀜 — 높이 되먹임의 오차 한도 0.05). 옛 `RUN.stride … flyReach`(지울 20 칸)는 아직 그대로.
