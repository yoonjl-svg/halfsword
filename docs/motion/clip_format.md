# 기준 동작 클립 형식 — `stillness-motion-clip/2` (동작 연구 PM)

- 작성: 2026-09-29. 이 형식은 동작 연구 PM 이 정하고, 바꿀 때는 버전 번호를 올린다. 읽는 쪽은 `format` 을 먼저 본다.
- **clip/2 (9/29 오후)** = clip/1 에 채널·필드만 더한 것이다(지운 것 없음). clip/1 을 읽던 코드는 새 칸을 무시하면 그대로 읽힌다. 바뀐 점은 §3-6·§6.
- 파일은 크기별로 둔다(`<베기>_<쪽>_<크기>.json` + `index.json`) — 디렉터 결정(9/29): 게임 atlas.js 가 index.json 으로 세 벌을 읽는다.
- 만드는 곳: `tools/motion/build_clips.mjs` (키프레임 `tools/motion/lib/cuts.mjs`, 몸 모형 `lib/body.mjs`, 표본·측정 `lib/clip.mjs`).
- 읽는 곳: 게임의 클립 추적(재설계 §2-2 atlas), 비교 화면 `tools/motion/viewer.html`, 비교표 `tools/motion/compare.mjs`.

## 1. 파일

| 경로 | 내용 |
|---|---|
| `docs/motion/clips/<베기>_<right\|left>_<small\|medium\|large>.json` | 클립 한 벌. 베기: zornhau, oberhau, zwerchhau, schielhau, unterhau, scheitelhau, krumphau, mittelhau |
| `docs/motion/clips/index.json` | `{ format: 'stillness-motion-index/1', generated, clips: [{ id, cut, nameKo, nameDe, family, desc, side, size, file, summary }] }` |
| `docs/motion/records/<id>.json` | 게임 기록 (§5) |
| `docs/motion/records/index.json` | `{ format: 'stillness-motion-records/1', records: [{ id, cut, kind, file, source, summary }] }` |

## 2. 좌표·부호

- **월드(땅) 틀**: 클립 시작 때 골반 밑 땅이 원점. x = 앞(상대 쪽), y = 위, z = 칼 든 쪽. 오른손잡이(z+ = 오른쪽). 단위 m.
- **가슴 틀**: 원점 = 가슴 가운데(게임 `guards.js` 손 목표 원점과 같은 점), 축 = 가슴 상자(돌림·숙임·옆굽힘을 따라 돈다). `[앞, 위, 칼 쪽]`.
- **돌림(yaw) +** = 칼 든 쪽 어깨·골반이 뒤로 빠짐(칼 쪽으로 감음) — 게임 `guards.js` 부호. **숙임 +** = 앞으로. **옆굽힘 +** = 칼 쪽으로.
- 왼쪽에서 베기(`left`)는 오른쪽을 거울에 비춘 것이다. 손은 그대로 오른손이 앞손(코등이 쪽)이고, 작은 벌은 게임의 왼쪽 자세 값을 쓴다.
- 발 이름 L/R 은 해부학적 왼발·오른발. 게임 `F`/`B` 는 칼 쪽 발/반대 발(오른손잡이면 F = 오른발).

## 3. 한 벌의 구조

```text
{
  format: 'stillness-motion-clip/2',
  id: 'zornhau_right_large', cut: 'zornhau', side: 'right', size: 'large',
  nameKo, nameDe, family, desc,
  hz: 120, weapon: 'longsword', handedness: 'right',
  marks:    { t0, tw, tr, tc, tf, tg },      // 초
  phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
  sources:  [{ id, kind, cite, url, read, license }],
  provenance: '…',                          // 작게 = 게임 자세표, 크게 = 저작, 보통 = 섞음
  summary:  { … },                           // 측정 요약 (spec_table.md 와 같은 값)
  step:     { foot, from, to, liftT, landT, liftPhi, landPhi },  // clip/2: 옮기는 발 (흐름은 베기마다 하나씩 배열)
  startFrom, startPose,                      // clip/2: 시작 목표 자세 id · 가장 가까운 게임 자세 { nearest, handError, next }
  recoverTo, endPose,                        // clip/2: 복귀 목표 자세 id · 끝 자세에 가장 가까운 게임 자세
  recovery: { from, to, samples },           // clip/2: 복귀 구간(tf → tg) 표본 수
  joints:   ['hipC', …, 'pommel', 'tip'],   // J 의 관절 순서
  bones:    [['hipC','waist','spine'], …],  // 막대 인형 뼈 (표시용)
  data: { n, width: { 채널: 폭 }, cols: { 채널: [표본 n × 폭] } }
}
```

### 3-1. 표시(marks)와 위상 φ

| 표시 | φ | 뜻 |
|---|---|---|
| `t0` | −1 | 준비 자세(게임 자세표 쟁기) |
| `tw` | 0 | 감기 끝 — 되돌아 풀기 시작 |
| `tr` | 0.55 | 손목 풀림 — 칼이 아래팔에 대해 가장 늦은 무렵 |
| `tc` | 0.85 | **칼이 겨눈 선을 지남** (칼 방향이 그 베기의 겨눈 방향과 같아지는 때). 걸음이 땅에 닿는 때 |
| `tf` | 1.6 | 지나가기 끝 |
| `tg` | 2.2 | 복귀 끝 |

- φ 는 표시 사이에서 시간에 선형이다(`data.cols.phi`). 크기가 달라도 같은 φ 는 같은 동작 단계라서 **φ 로 벌끼리 섞을 수 있다**.
- 크기별 시간: 작게 tw 0.20 · tc 0.48 · tg 1.00 s, 크게 tw 0.36 · tc 0.65 · tg 1.50 s, 보통은 그 사이.

### 3-2. 채널 (`data.cols`, 120 Hz)

| 채널 | 폭 | 틀 | 뜻 |
|---|---|---|---|
| `t` · `phi` | 1 | — | 시각 s · 위상 |
| `pelvis.yaw` · `pelvis.pitch` · `pelvis.drop` | 1 | 월드 | 골반 돌림° · 숙임° · 낮춤 m |
| `chest.yaw` · `chest.xFactor` · `chest.lean` · `chest.side` | 1 | 월드 | 가슴 돌림° · 척추 비틀림(가슴−골반)° · 몸 숙임 합° · 옆굽힘° |
| `handS` · `handO` | 3 | 가슴 | 앞손(코등이 쪽)·뒷손(폼멜 쪽) 자리 m |
| `sword` | 3 | 가슴 | 칼 방향 단위 벡터(손 → 칼끝) |
| `edge` | 3 | 가슴 | 앞날이 향하는 쪽 — 칼끝 속도에서 칼 축 성분을 뺀 방향(느릴 때는 앞 값). 저작 값이 아니라 결과 |
| `elbowPoleS` · `elbowPoleO` | 3 | 가슴 | 칼 든 팔 · 빈 팔 팔꿈치가 향하는 쪽 (어깨-손 가운데 → 팔꿈치). `elbowPoleO` 는 clip/2 |
| `girdleS` · `girdleO` | 2 | 가슴 | 어깨띠 [들림, 내밂] m — 팔을 60° 넘게 들면 최대 0.06 m 오르고, 뻗으면 최대 0.04 m 앞으로 (clip/2) |
| `guardGap` · `openness` | 1 | 월드 | 칼(자루 끝 → 칼끝)이 가슴 앞 0.45 m 세로 띠에서 떨어진 거리 m · 틈 0~1 (0.2 → 0.4 m, summary 의 '앞이 빈 시간'과 같은 띠) (clip/2) |
| `feet.L.yaw` · `feet.L.lift` (R 도) | 1 | 월드 | 발끝 돌림° · 뒤꿈치 들림 0~1 |
| `com` | 3 | 월드 | 무게중심 (게임 부위 무게 + 칼) |
| `ang.*` | 1 | — | 관절각°: pelvisYaw, chestYaw, xFactor, lean, shoulderElevS(가슴 아래와 위팔 사이), elbowS, elbowO(굽힘, 0 = 곧음), wrist(아래팔-칼), kneeL, kneeR |
| `w.pelvis` · `w.chest` · `w.shoulder` · `w.wrist` | 1 | — | 각속도 rad/s (골반·가슴 = 수직축 둘레, 어깨·손목 = 방향 변화율 — 흔들림 큼) |
| `speed.tip` · `speed.hand` | 1 | 월드 | m/s |
| `J` | 69 | 월드 | `joints` 순서 관절 23개 × [x, y, z] (막대 인형, 발 자리, 칼 양끝) |

- 벡터 채널은 평면 배열이다: 표본 i 의 값 = `cols[ch].slice(i * 폭, i * 폭 + 폭)`.
- 발 딛기 시각은 `J` 의 발목 높이(`ankleL`·`ankleR` y 가 0.08 m 로 돌아오는 때)로 읽는다.

### 3-3. 요약 (`summary`)

`time`(단계 길이) · `tipPeak`·`tipAtLine`·`handPeak` · `sequence`(골반·가슴·어깨·손·손목·칼끝 최고 시각 ms, tc 기준 · 최고값) · `ordered` · `trunkCarry` · `shareAtTipPeak` · `wind`(손 높이·앞뒤·어깨 들림) · `followThrough`(지나가기: `handSideChest` = 가슴 가운데 기준 머리 방향 틀 옆 거리, 디렉터 `mx.mjs` 의 hand_side_min 과 같은 식 · `handSidePelvis`·`handSideRoot` 참고 · `handHeightOverHip`) · `range`(가슴·골반 회전, 척추 비틀림, 손·칼끝 길, 무게중심 옮김) · `opening`(앞이 빈 시간, 칼끝이 몸 뒤, 돌아선 각) · `checks`(팔·다리 넘침, 칼끝 최저 높이, 손목 각) · `keyPoses`(t0·tw·tr·tc·tf 의 관절각·자리).

### 3-4. 흐름 클립 (`flow_*`, `build_flow.mjs`)

베기 둘을 멈추지 않고 이은 클립이다. 형식은 같고 몇 가지를 더 가진다.

| 필드 | 뜻 |
|---|---|
| `cut` · `base` | `flow_zornhau8` · 바탕 베기(`zornhau`). 크게 벌만 있다 — 비교 화면은 없는 크기를 바탕 베기 클립으로 채워 "작게 대비" 숫자에만 쓴다 |
| `marks` | 전체: t0 · 첫 베기 tw·tr·tc · 둘째 베기 tf·tg |
| `marks1` · `marks2` | 베기마다 표시. `marks1.tf` = `marks2.tw` (첫 지나가기 끝 = 둘째 감기 끝, 몸통이 반대로 가장 많이 감긴 때) |
| `summary` · `summary2` | 첫 베기(marks1 창) · 둘째 베기(marks2 창) 측정 |
| `flow` | 두 겨눈 선 사이: `contactGap`(s), `tipMin`·`handMin`(m/s, 첫 겨눈 선 뒤 시각), `bladeRateMin`(rad/s), `tipLow`, `wristMax`, `chestTurn`, 걸음(`pelvisAdvance`·`stepR`·`stepL`) |
| `data.cols.phi` | 첫 베기 φ 가 `marks2.tw` 에서 1.6 에 닿고, 거기서 둘째 베기 φ 0 으로 새로 시작한다 |

### 3-5. 런지 클립 (`lunge_*`, `build_lunge.mjs`)

찌르기라 베기 표시를 이렇게 읽는다: `tw` = 팔이 움직이기 시작, `tr` = 앞발이 뜨기 직전, `tc` = 칼끝이 겨눈 선(앞발 딛기와 같은 때), `tf` = 골반이 가장 낮음, `tg` = 쟁기 자세로 돌아옴. 크게 벌만 있고 바탕 베기(`base`)가 없다.
`lunge` 필드: `handFirst`(ms, + = 손이 먼저), `footLand`(s, 앞발 딛기 − tc), `pelvisDrop`(m), `lowAfterLand`(s), `stanceEnd`(m), `kneeFront`·`kneeBack`(°, 180 = 곧게), `lean`(°), `advance`(m), `legOver`.

### 3-6. 재설계 §2-2 (2) atlas 채널과 대조 (clip/2)

| 재설계 atlas 채널 | clip/2 | 비고 |
|---|---|---|
| 위상 표시 φ0 φw φr φc φf φg, 구간 기본 시간 | `marks`(t0 tw tr tc tf tg, s) · `phiMarks` · `data.cols.phi` · `summary.time` | 있음 |
| 양손 위치 | `handS` · `handO` (가슴 틀) | 있음 |
| 칼 방향과 날 방향 | `sword` · `edge` (가슴 틀) | 있음. `edge` 는 저작 값이 아니라 칼끝 빠르기에서 얻은 결과 |
| 골반 yaw·pitch·내림 | `pelvis.yaw` · `pelvis.pitch` · `pelvis.drop` | 있음 |
| 골반에 대한 가슴 yaw (X-factor) · 숙임 | `chest.xFactor` · `chest.lean` (+ `chest.side`) | 있음 |
| 팔꿈치 방향 (pole) | `elbowPoleS` · `elbowPoleO` | 있음 (빈 팔은 clip/2) |
| 어깨띠 들림과 내밂 (최대 0.06 m) | `girdleS` · `girdleO` | clip/2 에서 채움 |
| 빈손이 칼자루 끝을 당기는 점 | `handO` | 있음 — 뒷손(폼멜 쪽) 쥔 자리, 앞손에서 칼 축으로 0.14 m 뒤 |
| 딛은 발의 앞꿈치 돌림 | `feet.L.yaw` · `feet.R.yaw` (+ 뒤꿈치 `lift`) | 있음 |
| 앞발 딛기 목표와 시각 | `step` { foot, to, landT, landPhi } | clip/2 에서 채움 |
| 복귀 목표 자세 id | `recoverTo` (+ 확인용 `endPose`) | clip/2 에서 채움. 16벌 모두 끝 자세 = 목표 자세 (손 오차 0 cm) |
| balanceAssist | **없음** | 균형 서보를 얼마나 풀지는 게임 쪽 값이다(사람 자료로 정할 수 없음) |
| openness | `openness` · `guardGap` | clip/2 에서 채움 |
| 크기 세 벌 | 파일 셋 + `index.json` | 있음 |
| 보간 (min-jerk, squad) | **없음** — 120 Hz 표본이다. 보간은 atlas.js 몫 | |
| 출처와 사용권 | `sources` (칸마다 `license`) · `provenance` | 있음 |

## 4. 쓸 때 주의

- **몸 모형은 표시·검사용이다.** 팔·다리 IK 와 날개뼈는 `lib/body.mjs` 의 단순한 규칙이다. 게임은 자기 IK(재설계 §7-2 `src/strike`)로 `handS`·`sword`·몸통 채널을 따라가면 되고, `J` 의 팔꿈치 자리를 그대로 강요할 필요는 없다.
- 뼈대 치수는 게임(`src/fighter.js`: 팔 0.30 + 0.265 m, 어깨 가슴 틀 (0, 0.1, ±0.2))과 같다. 사람 팔(약 0.63~0.66 m)보다 짧다.
- **크기를 섞을 때**: 작은 벌과 큰 벌을 곧게(선형) 섞으면 사이 자세의 손목이 사람 어림(약 160°)을 넘는다(v0 보통 벌에서 165~177°). 보통 벌(크게 벌을 겨눈 선 자세 쪽으로 줄인 것)을 사이에 두고 두 구간으로 섞기를 권한다(작게↔보통, 보통↔크게).
- **칼 방향을 섞을 때**: 성분마다 섞지 말고 큰 원을 따라(slerp) 섞는다. 성분으로 섞으면 칼이 뒤집히는 곳에서 헛돈다(v0 저작 중에 겪음: 칼끝 50~70 m/s).
- 사람 값(칼끝 빠르기, 관절 범위)은 **참고이지 한도가 아니다**. 게임이 기준보다 빠르거나 큰 것은 문제가 아니다.

## 5. 게임 기록 — `stillness-motion-record/1`

```text
{
  format: 'stillness-motion-record/1',
  id, cut, kind: 'game-arm' | 'wbs-arm' | 'wbs-commit',
  source: '어느 코드·조건으로 쟀나 (사람이 읽는 한 줄)',
  cond: {                                       // 같은 조건을 기계가 읽는 꼴로 (compare_game.md '기록 조건' 표)
    code,                                       // 'src/ 001249b' | 'claude/wbs-impl d781ab9' ('+고침' = 안 올린 고침이 있었음)
    seed, physicsHz, recordHz, inputHz,         // 시드 · 물리 스텝 · 기록 · 손가락 입력 Hz
    weapon, gait, skill,                        // 'longsword' · BODY.weightMode · 숙련도
    gap,                                        // 두 사람 거리 m (null = 상대 치움)
    commit,                                     // WHOLE.commit ('끔' | '켬 (결심 n번)' | null = 그런 설정 없음)
    input,                                      // 손가락을 어떻게 움직였나
  },
  hz: 120,
  marks: { swingStart | cutStroke, tipPeak },   // 기록마다 있는 시각 표시 (s)
  summary: { tipPeak, handPeak, tipPeakT, … },
  joints, bones,                                // 클립과 같은 23 관절
  data: { n, cols: { t, 'speed.tip', 'speed.hand', J } }
}
```

- 좌표는 클립과 같다(기록 시작 때 골반 밑 땅 원점). 랙돌 관절 자리 = 붙은 몸체 자세 × (관절 기준점 − 몸체 처음 자리) — `tools/motion/lib/game_joints.mjs`.
- 만드는 곳: `record_game.mjs`(main), `record_wbs.mjs --root=<체크아웃>`(다른 브랜치). 디렉터 도구가 같은 형식으로 내면 비교 화면·비교표가 그대로 읽는다.

## 6. 바뀐 기록

| 버전 | 날짜 | 바뀐 것 |
|---|---|---|
| clip/1, record/1 | 2026-09-29 | 처음 (같은 날 보통 벌 만드는 법을 섞기 → 크게 벌 줄이기로 바꿈 — 형식은 같음) |
| record/1 | 2026-09-29 | `cond`(기록 조건: 커밋·시드·Hz·무기·걸음·skill·거리·결심·입력) 더함 — 없어도 읽힌다, 디렉터 요청 |
| clip/1 | 2026-09-29 | `summary.followThrough.handSideChest` 더함(형식은 같음). 크게 Zornhau 지나가기 손 자리 고침(손을 배 앞으로 끌어들이지 않음) |
| clip/1 | 2026-09-29 | 흐름 클립(§3-4) 더함 — 베기 클립은 그대로 |
| clip/1 | 2026-09-29 | 런지 클립(§3-5) 더함 |
| **clip/2** | 2026-09-29 | 디렉터 요청(재설계 atlas 채널 대조): 채널 `elbowPoleO`·`girdleS`·`girdleO`·`guardGap`·`openness`, 필드 `step`·`startFrom`·`startPose`·`recoverTo`·`endPose`·`recovery` 더함. 게임 자세 키를 게임과 같은 틀(바라보는 틀, 가슴 가운데 원점)로 옮기게 고쳐 시작·끝 자세 손이 자세표와 같아짐(전에는 숙임만큼 3~4 cm 어긋남). balanceAssist 는 없음 |
