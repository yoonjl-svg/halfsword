# 열째 판 뛰기 — 다리 코드 지도 (뒤 일꾼은 코드 대신 이것을 먼저 읽는다)

줄 번호는 이 지도를 마지막으로 고친 커밋의 것이다(고치면 같은 커밋에서 지도도 고친다). 마지막: 뛰기 1 단계 다섯째 시도(뛰는 걸음 모터 감쇠 값 `stDamp · swDamp · swCap` · 옆 기울이기 `abdUse · sideMu` · 힘 한도 축 몫 `capAx` · 뗌이 계획 속도를 기다림 `liftV` · 정직 재는 창 = runG). 앞: 넷째 시도(닿기 직전 디딘 모터 값 · 같은 다리 길이에서 뗌 · km). gait.js · fighter.js 줄 번호는 둘째 시도 그대로(안 바뀜).

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
| `tools/sim/honesty.mjs` 도움 장부 | 288 · 435 | (다섯째 시도) 뛰는 동안 도움(aidRun)과 그 시간(runT)은 `f.gait.runG` 가 있을 때 + 뛰다 줄이는 동안(`f.run.fast && !f.run.on`)만. 들어가기 미룸(`f.run.on` · runG 없음)의 걷는 걸음 몫은 `aidRun.entryPeak` 로 재기만 |
| `gait.js update` | 859 | `this.runG \|\| f.run?.on` 이면 `runGaitStep` — 참이면 그 스텝은 걷는 걸음 셈(860 ~ 1624)을 건너뜀. 이 앞(813 ~ 858)의 `rk` · `runCapTick` · 유파 배율 · `enter/sense` 는 그대로 돈다 |
| `gait.js poseLegs` | 2271 | `this.runG` 이면 `runPose` 로 |
| `gait.js exit` | 314 | `this.runG = null` |
| `gait.js` 끝 | 2623 | `legLen · minJerk · ANKLE_H` 내보냄 (run_gait.js 가 씀) |
| `legs_vmc.js drive` | 593 · 633 | 593 `f.gait?.runG` 면 이끄는 힘 반작용 상한(디딤 `swReact` · 공중 `swReactAir`) · 633 `RP = gait.runG.plan`(디딘 발이 있을 때) — 아래 §4 의 뛰는 디딤 갈래 |
| 옛 날기 (지울 것 · 지금도 그대로) | gait.js 986 `this.fly` · 1024 `Tc` · 1366 `flyAir` · poseLegs `RUN.flySwingV` · fighter.js 2997 `RUN.flyPush` · 3081 `G.fly` | 뛰는 몸은 이제 run_gait 가 맡아 이 길은 뛰기가 끝나 줄어드는 동안(`f.run.fast`)에만 탈 수 있다 |

## 3. src/run_gait.js — 뛰는 걸음 장치 (343 줄)

| 함수 | 줄 | 하는 일 · 읽는 값 |
|---|---|---|
| `runShape · shapeLeft · shapeAt` | 25 ~ 55 | 수직 힘 꼴 sin(πs)^`forceP`(1 + `forceSkew` cos πs) · 넓이 A · 힘 평균 때 ū · **`shapeLeft(s)` = s 뒤 남은 넓이 몫(표 200 칸 · 넷째 시도)** |
| `contactT` | 61 | 디딤 시간 = `contactLen ÷ v` (`contactMin ~ contactMax`) |
| `lift` | 64 ~ 76 | 뗌: `stance=false` · `kind='run'` · `t=0 · T` · 길 처음 `p0 = 발목` · `runFix=false` |
| `plan(g, l, frac)` | 79 ~ 116 | 디딜 때 충격량 계획 → `g.runG.plan = { k, t, Tc, Tf, J, A, vy0, vto, km, cs, cn, capMin, Jc }`. Tc = contactT × frac · Tf = 1 ÷ `cadence` − Tc (`flightMin ~ flightMax` · `rampSteps`) · vto = g Tf ÷ 2 + `hGain` × rec(± `hRec`) · J = M(vto − vy0) + M g Tc · 계획 최고 > `capUse` × 지난 디딤 힘 한도 최소면 rec = 0, 그래도 넘으면 Tf 를 줄임 (kJ 나눔 지움) |
| `runGaitStep` | 119 ~ 239 | 125 ~ 134 들어가기 미룸 · 135 ~ 153 들어가기 · 156 ~ 168 가려는 속도 `R.vdes` · **175 ~ 189 디딤 끝: `plan.t ≥ Tc` 또는 `t ≥ Tc/2` · vy ≥ `liftV` × vto (다섯째 시도) · vy > 0 · 디딘 엉덩이 ~ 발목 ≥ `legLen(tdKnee)` → `lift` · 뜬 발 `T` = 이제 + Tf 로 당김** · 190 ~ 201 튕긴 발(`tdLoad` · `lostT`) · 203 ~ 215 나가기 · 217 ~ 237 디딤 판단(`tdEarly` · `tdLoad` 0.035 = 엔진 첫 닿음) · `bias` |
| `placeOf` | 242 ~ 253 | 디딤 자리 = 닿을 때 무게중심 + 앞 (v ū Tc − c̄ + `placeGain`(v − vdes) + bias, `placeMin ~ placeMax`) + 옆 (side × `width` + v ū Tc + `placeGain` v, ± `catchReach`) |
| `lead` | 260 ~ 274 | 뜬 발목 이끄는 힘 (`GAIT.swingMass` · `swingHz` · `swingZeta` · `swingErr` · `GAIT.swingFmax`) → `legDrive.legs[k].pull` |
| `runPose` | 277 ~ 345 | **284 `pre` = 뜬 발이 계획한 닿을 때 `preTD` 앞(늦어도 계속) → 디딘 모터 값(굳기 `GAIT.stanceGain · stanceAnkleGain` · 상한 `GAIT.stanceCap · stanceAnkleCap` · **감쇠 `RUN.stDamp`**)을 먼저 검 · 뜬 다리는 굳기 `GAIT.swingHipGain` · **감쇠 `RUN.swDamp` · 상한 `RUN.swCap`**(290 ~ 298 · 다섯째 시도) · 모드 1 디딤 / 2 뜸 / 3 닿기 직전(바뀔 때 `prevRV` 지움)** · 300 디딘 다리 목표 = 지금 다리 꼴 · 306 뜬 발 닿을 때 `T` = 다른 발 남은 디딤 + Tf · 길 `p0 → p1` minJerk · 317 ~ 320 무릎 접기 `tdKnee → fold → tdKnee`(닿기 `extT` 앞에 끝) · **323 ~ 330 땅 위 틈 `tdClr` · `tdTau` · 늦으면 `lateDip` — 단 발 목표는 엉덩이에서 `legLen(kn)` 보다 멀리 안 둠(넷째 시도 · 다 편 다리로 닿지 않게)** · `GAIT.swingVmax` → `lead` → `legIK` |

## 4. src/legs_vmc.js — 다리 구동 `LegDrive`

| 함수 | 줄 | 하는 일 · 읽는 값 |
|---|---|---|
| `senseLeg · footContact` | 228 ~ 279 | 관절 자리 · 발 틀 · 압력 중심 범위 |
| `legTorques` | 301 ~ 338 | `legRaw` 로 자르기 앞 값 → `LEGS.limit × 근력 몫` 자르기 · 장부 · 쌍으로 걸기 (걷기와 같은 수) |
| `legRaw` | 344 ~ 387 | 자르기 앞 관절 토크 → `L.raw` (`ax ay az` 발목 · `k` 무릎(− 폄) · `hx hy hz` 엉덩이) · 걸지 않음 |
| `trunkShare(…, ny)` | 393 ~ 412 | 뛰는 디딤: 압력 중심 · N · 비틀기 ny 를 둔 채 기울기 몸통 토크(Mx, Mz)를 σ 배로 낼 때 모든 축이 한도 안인 가장 큰 σ (yaw 는 σ 로 안 줄임) |
| `runTwist` | 419 ~ 436 | 뛰는 디딤의 비틀기 ny 미리 자르기(§3-6): 마찰 원뿔 ∩ 발목 비틀기 · 엉덩이 돌림이 한도 × 근력 × `capUse` 안인 범위 (ny = 0 · 1 두 점 일차식) |
| `airTrunk` | 442 ~ 459 | 공중(뛰는 걸음 · 딛은 발 없음): 바란 몸통 토크(되먹임 − 내딛는 다리 반작용)를 `RUN.airTilt` 로 자르고 두 엉덩이에 반씩 — 이끄는 힘이 이미 쓴 몫(`L.pulled` · `L.raw`) 위로 축 한도 안만 · 관절 안 쌍 |
| `forceCap` | 465 ~ 486 | 뛰는 디딤 힘 한도 — 축 한도 × 근력 × **`RUN.capAx`**(다섯째 시도) · `this.capAxis`(0 발목 안팎 · 1 비틀기 · 2 굽힘 · 3 무릎 · 4 엉덩이 벌림 · 5 돌림 · 6 굽힘폄) |
| `drive` | 569 ~ 941 | 585 ~ 614 든 다리 이끄는 힘 → 토크 · `swM` — 597 뛰는 걸음이면 반작용 상한(디딤 `swReact` · 공중 `swReactAir`) / 610 서 있지 않으면 끝 / 617 ~ 630 딛은 발 / **634 ~ 648 뛰는 디딤 수직 힘: 계획 꼴 Np × `km` — km = (M(vto − 잰 vy) + M g 남은 Tc) ÷ (J × `shapeLeft`) (0.3 ~ 2.5 · 남은 넓이 < `momWin` 이면 묶음 · 넷째 시도: kJ · vyGain 지움)** · 아니면 높이 스프링 / 655 ~ 704 몸통 토크 M / 708 딛은 발 없음 → `airTrunk` / 717 ~ 780 압력 중심 / 781 ~ 791 뛰는 디딤 압력 중심 / 820 ~ 865 뛰는 디딤: `runTwist` → `trunkShare` → **834 ~ 852 옆 기울이기(다섯째 시도): 디딘 엉덩이 벌림 > 한도 × `RUN.abdUse` 이면 몸 옆 축(`runG.rgt`) 힘 df 를 더해(|df| ≤ `RUN.sideMu` × N) 벌림을 그 몫으로 · 몫 sx · sz = df ÷ N 은 forceCap 의 N 일차식에 들어감 · `dbg.side`** → `forceCap` → 깎음(옆 몫 그대로 N 배) `dbg.capCut` · 855 `capMin`(`capWin`) / 872 `RP.Jc` += N dt / 874 ~ 937 발마다 · `rem` (뛰는 디딤 0) / 938 관절 토크 |

`legDrive.plan`(디딘 스텝만 · 재는 도구가 `J` 를 읽음 · `km` 은 흔적 `s4/trace7.mjs` 가 읽음) · `dbg.capCut` · `dbg.trunkShare` 는 스텝마다 다시 둠. 걷는 길이 지나는 새 줄은 `L.pulled` 표시(588 · 591) 하나뿐 — 수는 안 바뀜(596 의 갈래는 `runG` 가 없는 걷는 몸에서 안 탄다).

## 5. config.js RUN 의 뛰는 걸음 값 (443 ~ 534 · `[찾기 es3 · 다섯째 시도]` 표시 24 칸은 다섯째 시도 찾기 값)

`contactLen · cadence · contactMin · contactMax · flightMin · flightMax · rampSteps · forceP · forceSkew · loadMax · capUse · vyGain · copMean · placeGain · placeKi · placeBiasMax · placeMin · placeMax · catchReach · width · tdKnee · fold · swingHz · swingZeta · tdEarly · tdLoad` + 둘째 시도 `lostT · hRec · swingErr · swReact · airTilt · enterDv` + 셋째 시도 `swReactAir · extT · hGain · capWin · tdClr · lateDip · tdTau` + 넷째 시도 `momWin · preTD` + 다섯째 시도 `stDamp · swDamp · swCap · capAx · abdUse · sideMu · liftV`(525 ~ 531) (지움: `kJMax` · `vyGain` · 뜻 바뀜: `tdLoad` 0.1 → 0.035) (`hRec` 의 뜻이 바뀜 — 높이 되먹임의 오차 한도 0.05). 옛 `RUN.stride … flyReach`(지울 20 칸)는 아직 그대로.
