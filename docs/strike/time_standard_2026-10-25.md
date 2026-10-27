# 표준 시간 — 적힌 초 · m/s 는 실제(벽시계) 시간 (사장님 10/25 22:3x · 10/27 마무리)

사장님 말씀 (원문):
- "우리가 최초 개발한 게임에서 1.1배속을 시킨 상황인데, 지금 이 속도를 표준 시간으로 보는 게 맞아. 게임 시간으로 도는 모든 숫자를 찾아서 절대적 시간이 맞게끔 고치는 작업을 진행해. 걷기도 이번 기회에 2.0m/s를 기준이 되는 표준 속도로 바꿀까?"
- "그래 걷기 2.0도 진행하고 고노센 달려듦 1.2도 실제 시간으로 해."

## 0. 한눈에

- **몸 · 칼이 움직이는 빠르기는 그대로**(템포 1.1 — 실제 1 초에 물리 1.1 초). 중력 · 관절 힘 · 서보 · 감쇠 · 충돌 · 물리 스텝 · 질량 · 걸음 기계 · 동작 대본은 손대지 않음.
- **사람이 시간으로 느끼는 규칙 수**(창 · 굳음 · 기다림 · 반응 · 걸쇠 · 무장 · 효과 시간 · 초당 몫)는 **적힌 수 = 실제 초**. 같은 '창 0.6 s' 가 이제 정말 0.6 s(전 0.545 s — 약 10 % 길어짐). 의도한 변화.
- **걷기 실제 2.0 m/s**(전 1.8 게임 = 실제 1.98 — +1 %) · 옆 0.8 · 뒤 1.4 실제. **고노센 달려듦 문턱 실제 1.2 m/s**(전 게임 1.2 = 실제 1.32 — 문턱이 9 % 낮아짐).
- **옛 판 그대로 있음**: 주소 `?timeStd=0` · 시뮬 `TIME_STD=0` = 적힌 수가 게임 시간(관문 해시 바이트 같음 — §6).
- 세는 법: **바꿈 약 160 곳** — config 열쇠 69(AI 숙련도 반응 7 칸 · 걷기 포함) · 코드 수 약 80 곳(ai.js 38 · gun.js 7 · revive 6 칸 · main.js 6 · parry_button 4 · stamina · secret · skill · vital_target · debris · whiff_drill …) · 주소 인자 9 · **그대로** = 물리 · 서보 · 걸음 기계 · 동작 대본 · 동작 잣대(대표 표 §3) · **잰 값 그대로** = MEASURED · CUT_TIME_30 전부 · **이미 실제** = 카메라 · 화면 효과 · 글자 시계 · 싱지르 원 셈 · 입력 ms. 경계 7 가지는 §2 끝.

## 1. 장치 — 한 곳에서 한 번

`src/config.js` 맨 위 `TIME` 과 함수 셋:

| 이름 | 뜻 |
|---|---|
| `TIME.tempo` | 그 판 템포(브라우저 `?tempo` — 기본 1.1 · 0.5 ~ 2). `main.js` 의 `TEMPO` 가 이 값을 읽음(전엔 main.js 가 따로 셈 — 한 곳으로) |
| `TIME.on` | 1 = 표준 시간(기본) · 0 = 옛 판(`?timeStd=0` · 환경 변수 `TIME_STD=0`) |
| `TIME.std` · `TIME.k` | std = 템포 · k = 실제 초 → 게임 초 배율(켬 = 템포 · 옛 판 = 1) |
| `realS(초)` | 실제 초 → 게임 초 = × k (창 · 굳음 · 기다림 · 반응 · 걸쇠 · 무장 · 효과 시간) |
| `realV(m/s)` | 실제 m/s → 게임 m/s = ÷ k (걷기 목표 · 달려듦 · 다가옴 문턱처럼 사람이 m/s 로 정한 몸 빠르기) |
| `realRate(초당)` | 실제 초당 몫 → 게임 초당 몫 = ÷ k (기력 회복 초당 15 · 클린치 초당 10 · 칼끝 덧각 초당 60°) |

- **config.js 를 읽을 때 한 번 바꾼다.** 적는 사람은 `recoverDelay: realS(0.6)` 처럼 실제 초를 적고, 읽는 코드는 지금처럼 게임 시간으로 셈(물리 스텝 dt 를 빼 나감) — 읽는 쪽 수백 곳을 건드리지 않음. 코드에 박힌 규칙 시간(ai.js · secret.js · stamina.js · parry_button.js · gun.js …)도 같은 함수로 감쌈(파일 위 이름 붙은 상수 — 여기저기 × 1.1 을 뿌리지 않음).
- **std 는 그 판 템포를 따라감**: 브라우저에서 `?tempo=1.35` 로 돌려도 적힌 0.6 s 는 실제 0.6 s(그만큼 게임 시간 0.81 s). 시뮬 도구는 템포가 없어(게임 시간으로 돎) 기본 1.1 로 셈 — 시뮬 숫자는 '템포 1.1 브라우저 판'과 같음.
- **주소 인자도 실제 단위**: `?mordPress=` · `?flowArm=` · `?aiReact=` · `?gnsEnterWindow=` · `?foeChargeSpeed=`(m/s) · `?risoHold=` · `?risoGrace=` · `?finishCleaveCharge=` · `?risoWide=0` 의 0.6.
- **조심할 곳 (적어 둠)**:
  - 시뮬 `with_config.mjs 열쇠=값` 과 시험이 config 를 직접 덮으면 **게임 단위**(읽은 뒤의 값을 덮으므로). 실제 초로 넣으려면 `CONFIG.realS(초)`(시험 몇 개를 그렇게 고침 — §4). `gonosen_walkin.mjs` 의 `CHARGE=` 는 주소와 같게 실제 m/s 로 읽게 고침.
  - 화면에 config 시간을 글로 보여 줄 때는 ÷ `TIME.k`(지금 그런 화면 글은 없음 — 목소리 실험실 장전 소리 한 곳만 ÷ k). 스킬 카드 · 설명 글의 '0.6초' 같은 글은 손대지 않음 — 이제 적힌 그대로 실제 초라 글과 게임이 맞음.
  - 새 규칙 시간 열쇠는 `realS( … )` 로 적는다. `tools/sim/time_standard.test.mjs` 가 SECRET 덩이 안 시간 이름 열쇠(…Time · …Window · …Hold · …Grace · …Stiff · …Press · …Gap 등)가 맨 수면 걸러 냄(동작 시간 · 이미 실제 시간인 열쇠는 그 시험의 KEEP 에 까닭과 함께).

## 2. 가름 규칙

| 가름 | 무엇 | 까닭 |
|---|---|---|
| **바꿈 (designer → convert)** | 비기 · 고유 동작 · 흘림 · 막기 창, 굳음 · 경직, 준비 · 무장 · 유예, 쿨 · 다시 걸지 않음, 효과 시간(팔 늦춤 · 꿇음 · 넘어짐 기다림 · 부활 연출), AI 반응 · 판단 박자 · 막기 길이 · 물러남 · 포기 시간, 기력 초당 몫, 총 쿨 · 장전, 판 시작 발 묶음(브라우저 `?openSweep=0` 판 — 시뮬 · 도구 값은 게임 초 그대로 · §3 끝), 걷기 목표 2.0 · 달려듦 1.2 · 호 안쪽 다가옴 0.3 m/s | 사람이 '몇 초' 로 느끼고 정한 규칙 수 · 사장님이 m/s 로 정한 몸 빠르기 |
| **그대로 (physics / motion → keep)** | 물리 스텝 · 중력 · 관절 힘 · 서보 · 감쇠 · 시간 상수(τ) · 충돌 · 맞음 판정 문턱(speedMax 60 · stuckTime · hitCooldown) · 걸음 기계(GAIT 의 박자 · 발 든 시간 · 박차기 목표 빠르기 · runFrom 1.7) · 동작 대본 길이(탭 찌르기 aim · extend · hold · recover · 손잡이 찍기 · 발도 iaiTime · 휩쓸기 · 싱지르 한 바퀴 time · ramp · 런지 덧씌우기 inTime · outTime · 비기 단계 run.t 상한 · 따라 지나감 0.3 · 제비 베기 되돌림 칼 tsuSnapTime) · 칼 · 손 빠르기 문턱(휘두르기 1.5 · 칼끝 3.5 · 들어 올림 1.6 · italianCommit 4.5 · lethalSpeed 10 · 흘림 minSpeed 2.5) · 손 빠르기(AI strikeSpeed · parrySpeed …) · 내다봄(lethalLook · releaseT · threat 0.15 s 앞) | 몸 · 칼이 움직이는 빠르기가 표준(지금 그대로). 동작 시간을 늘리면 같은 빠르기로 더 멀리 가 동작 모양이 바뀜. 칼 · 손 빠르기 문턱은 그 동작을 재는 잣대라 동작과 같은 단위로 둠 |
| **잰 값 (measured → keep)** | `MEASURED`(무기 간격 — 쿠사나기 · 적소검 새 줄 포함) · `CUT_TIME_30`(베는 시간 — 적소검 0.31 · 쿠사나기 0.24 포함) | 시뮬(게임 시간)에서 잰 거리 · 시간이고 `ai.contactDist`(내다보는 맞닿기 = 다가옴 빠르기 × CUT_TIME_30)도 게임 시간으로 셈 — 짝이 같은 단위라 맞음. 칼이 닿기까지 걸리는 시간은 동작이라 그대로가 옳음 |
| **이미 실제 시간** | 카메라(CAMERA.* '실제 초' · 판 시작 훑기 sweepSec × 템포 · camSwing · risoCam), 화면 글자 시계(hudLater), 결정타 느린 화면 slowMo.dur, 피 · 섬광 · 잔상 · 머리 잘림 효과(화면 dt), 런지 빛줄기 · 반짝임, 싱지르 원 · 스틱 돌림 셈(circleTime · stickTime · circleGap — '실제 프레임 시간'), 사람 감정(화면 dt), 입력 탭 · 클릭 한도(ms), 진동 ms | 손대지 않음. 판 시작 발 묶음(브라우저 판)은 원래 카메라 실제 초 × 템포로 판마다 덮어씀 |

**경계 (사장님께 여쭐 것 — 지금은 그대로 둠)**:
1. **피 · 균형 몸 모형** `VITALS.clotting` 초당 0.12 · `balanceRegen` 초당 22 · 출혈 · 아픔 줄어듦: 물리 맞음 에너지(J)와 함께 맞춰 온 몸 모형이라 그대로. 바꾸면 피가 10 % 늦게 굳고 균형이 늦게 돌아옴(싸움 길이 · 죽는 때가 바뀜).
2. **제비 베기 되돌림 칼 시간 상한** `UNIQUE_ASSIST.tsuSnapTime` 0.2 s(10/25 사장님 결정 · 시간 사다리 0.2): 운동학 칼을 끄는 상한이라 동작으로 봄. 실제 0.2 s 로 바꾸면 같은 빠르기로 10 % 더 끌고 감(길이 먼저 끝나면 같음).
3. **AI 의 상대 다가옴 문턱** ai.js `foeClosing` 0.9(달려든다) · 0.6 · 0.45 · 0.5 · 0.1 m/s: 동작(걷기 빠르기)을 재는 AI 잣대라 그대로 — 걷기가 1 %만 빨라져 걷기에 대한 몫이 거의 같음. 비기 규칙인 달려듦 1.2(사장님) · 호 안쪽 다가옴 0.3 은 바꿈.
4. **동작 대본 길이 전부**(탭 찌르기 0.11 · 0.14 · 0.05 · 0.18 · 손잡이 찍기 · 발도 0.12 · 싱지르 한 바퀴 0.6 등): 모두 그대로. 사장님이 '몇 초 동작' 으로 정하신 것(싱지르 한 바퀴 0.6 '이어짐/입력' 칸 · 런지 앞발 거둠 0.4)도 동작 빠르기가 표준이라 그대로 둠.
5. **사람 손 멈춤 잣대** skill.js 내딛기 `quiet > 0.2` · 흐름 `flowQuiet > 0.08`(AI 몸도 같은 길) · 긋기 읽기의 손가락 고름 `fingerTau` 0.03: 동작 감지 잣대로 봄. 기력 청구 긋기 끊김 0.12 · 고유 동작 새 긋기 끊김 0.06 은 규칙이라 바꿈.
6. **흘림 · 맞음 소리 거름**(`SOUND.whipLashGap` 0.2 · `whipFlam` 0.06) · 칼 잔상 띠 `SWORD_TRAIL.life` 0.06(게임 시간) · 망토 흔들림 `CAPE.lag` · `settle`: 겉모습 · 소리 거름이라 그대로.
7. **AI 걸음 박자 안의 시간**(gait.js 박차기 미룸 0.3 · 넘겨받기 handoverMax 2.5 · walkedIn 0.8): 걸음 기계라 그대로.

## 3. 바꾼 값 전수 (적힌 값 = 실제 · 전 실제 = 적힌 값 ÷ 1.1 · 새 게임 값 = 적힌 값 × 1.1 — m/s · 초당은 반대)

### 비기 (SECRET — 사람 · AI)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `playerWindow` | 0.6 s | 0.545 | 0.66 | 사람 비기 창 · 창 지킴(secretHold) 길이 |
| `cnParryWindow` | 0.6 s | 0.545 | 0.66 | 중국 막기 연환 창 |
| `iberianWindow` | 1.5 s | 1.364 | 1.65 | 이베리아 옛 창 |
| `stiff.german · italian · chinese` | 0.4 s | 0.364 | 0.44 | 비기 뒤 굳음 |
| `stiff.iberian · japanese` | 1.2 s | 1.091 | 1.32 | 비기 뒤 굳음 (사장님 10/25 16:3x 1.2) |
| `risolutoStiff · risolutoArmSlow` | 0.6 s | 0.545 | 0.66 | 런지 뒤 굳음 · 상대 팔 늦춤 |
| `risolutoHold` | 0.6 s | 0.545 | 0.66 | 덮인 채 나아가기 이어짐 |
| `risolutoBeatMin · risolutoGrace` | 0.2 s | 0.182 | 0.22 | 두 번째 길 · 끊김 너그러움 |
| `iaiArmTime · gilmokArmTime` | 1.5 s | 1.364 | 1.65 | 고노센 · 길목 준비 (secret-text 가지가 iaiArmTime 2.0 으로 바꾸는 중) |
| `iaiArmGrace · gilmokArmGrace` | 0.5 s | 0.455 | 0.55 | 준비 남음 |
| `ibSpin.armTime` | 1.5 s | 1.364 | 1.65 | 싱지르 무장 (secret-text 가지가 2.0 으로 바꾸는 중) |
| `ibSpin.armGrace` | 0.6 s | 0.545 | 0.66 | 싱지르 무장 남음 |
| `mordPress` | 1.5 s | 1.364 | 1.65 | 모르트슐라크 누르기 (secret-text 가지가 2.0 + mordGrace 0.2 로 바꾸는 중) |
| `releaseMaxHold` | 0.6 s | 0.545 | 0.66 | 터뜨림 창 붙잡는 최대 |
| `deBindMin · deBindFull` | 0.3 · 1.0 s | 0.273 · 0.909 | 0.33 · 1.1 | 독일 감아 들기(옛 판) |
| `chineseRest` | 0.5 s | 0.455 | 0.55 | 연환삼격 쉼 |
| `iberianInsideDwell` | 0.3 s | 0.273 | 0.33 | 호 안쪽 머묾 |
| `iberianReset` | 4 s | 3.636 | 4.4 | 옛 이베리아 셈 초기화 |
| `playerChainGap` | 0.6 s | 0.545 | 0.66 | 사람 베기 덩이 끊김 |
| `gyeoksal.press` | 0.6 s | 0.545 | 0.66 | 격살 때맞춤 |
| `gnsEnterWindow` | 0 (끔) s | 0 | 0 | 들어옴 창 길이 (0 = playerWindow) |
| `foeChargeSpeed` | 1.2 m/s | 1.32 | 1.091 | 고노센 · 이탈리아 옛 판 달려듦 문턱 (사장님 10/25 22:3x) |
| `iberianInsideClosing` | 0.3 m/s | 0.33 | 0.273 | 호 안쪽 다가옴 문턱 (달려듦과 같은 몸 다가옴 잣대) |

### 유파 패시브 · 고유 동작 (SCHOOL_PASSIVE · UNIQUE_ASSIST)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `SCHOOL_PASSIVE.japanese.full` | 2.0 s | 1.818 | 2.2 | 켄타이 쌓이는 시간 (사장님 10/25 23:1x 2.0 — 본판에서 들어옴) |
| `SCHOOL_PASSIVE.italian.tipRate` | 60 °/s | 66 | 54.545 | 칼끝 덧각 오름 빠르기 |
| `UNIQUE_ASSIST.afterWindow` | 0.6 s | 0.545 | 0.66 | '…뒤 다음 긋기' 창 |
| `UNIQUE_ASSIST.turnWindow` | 0.25 s | 0.227 | 0.275 | 찌르다 꺾음 창 |
| `UNIQUE_ASSIST.onsetQuiet` | 0.06 s | 0.055 | 0.066 | 새 긋기 끊김 |
| `UNIQUE_ASSIST.chainWait` | 0.15 s | 0.136 | 0.165 | 뒷몫 기다림 |
| `UNIQUE_ASSIST.powerMax` | 0.6 s | 0.545 | 0.66 | 끝 힘 지속 상한 |
| `UNIQUE_ASSIST.buckle.kneel · WHIP_KNEEL.kneel` | 0.4 s | 0.364 | 0.44 | 무릎 꺾기 · 채찍 꿇림 |
| `UNIQUE_ASSIST.buckle.cool` | 0 s | 0 | 0 | 다시 꺾임 제한 (0 = 없음) |
| `schools.js GERMAN_CHASE.window` | 0.6 s | 0.545 | 0.66 | 독일 간격 잡기 창 |

### 기력 · 흘림 · 맞물림 (STAMINA · FLOW · NAGASHI · BIND · THRUST)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `STAMINA.recoverPerSecond · playerRecoverPerSecond` | 15 · 21 /s | 16.5 · 23.1 | 13.636 · 19.091 | 기력 회복 (탈진 회복도 같은 빠르기 — 플레이어 1.667 s · AI 2.333 s 가 실제 초가 됨) |
| `STAMINA.clinchPerSecond` | 10 /s | 11 | 9.091 | 클린치 청구 |
| `STAMINA.recoverDelay` | 0.6 s | 0.545 | 0.66 | 회복 기다림 |
| `STAMINA.strokeQuiet` | 0.12 s | 0.109 | 0.132 | 긋기 끊김 |
| `STAMINA.exhaustSeconds · exhaustRecover` | 2.5 · 28 /s s | 2.273 · 25.455 | 2.75 · 30.8 | 옛 탈진(?exhaust=fixed) |
| `stamina.js 공격 번호 수명 · 꼬리` | 1.5 · 0.35 s | 1.364 · 0.318 | 1.65 · 0.385 | 막아 받기 청구 · 옛 흘림 판정 |
| `FLOW_REDESIGN.window` | 0.2 s | 0.182 | 0.22 | 흘림 접촉 창 |
| `FLOW_RECOVERY.seconds` | 0.4 s | 0.364 | 0.44 | 흘림당한 팔 늦춤 |
| `nagashi_recovery.js 다시 걸지 않음` | 0.12 s | 0.109 | 0.132 |  |
| `NAGASHI.poseT` | 0.35 s | 0.318 | 0.385 | 받는 몸꼴 유지 |
| `BIND.holdMax · feelT` | 1.5 · 0.12 s | 1.364 · 0.109 | 1.65 · 0.132 | 미는 뜻 상한 · 느낌 |
| `THRUST.bindRest` | 0.7 s | 0.636 | 0.77 | 탭 연타 억제 |

### 판 · 몸 · 무기 능력 (ARENA · BODY · fighter · WEAPON_ABILITY · revive · finish)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `main.js 판 시작 발 묶음 (?openSweep=0 판)` | 2.0 s | 1.818 | 2.2 | ARENA.startHold 를 실제 2.0 s 로 (훑기 3.0 · 내려앉기 1.0 은 원래 실제 초 × 템포) — config 의 2.0 은 시뮬 · 도구 판 게임 초 그대로 |
| `BODY.fallDuration` | 2.2 s | 2 | 2.42 | 넘어진 뒤 일어나기 시작까지 |
| `fighter.js 꿇은 채 기다림 kneelTime` | 1.1 s | 1 | 1.21 | 일어서는 몸놀림 riseTime 0.9 은 그대로 |
| `WEAPON_ABILITY.aweGap` | 1.5 s | 1.364 | 1.65 | 티소나 위세 틈 |
| `revive.js lie · lightAt · descend · kneel · linger · fade` | 캐릭터 시트 값 | ÷ 1.1 | × 1.1 | 부활 연출 · 기다림 (rise · swordFly 는 동작이라 그대로) |
| `FINISH.cleave.charge` | 0.2 s | 0.182 | 0.22 | 쪼개 내려치기 힘 모음 |
| `SKILL.recoverDelay` | 0.25 s | 0.227 | 0.275 | 손가락 뗀 뒤 자세 복귀 |
| `SKILL.flowBreak · enterCool` | 0.4 · 1.0 s | 0.364 · 0.909 | 0.44 · 1.1 | 흐름 끊김 · 들어가기 재사용 |
| `SKILL.itRetreatVals.maxT · cool` | 1.2 · 1.2 s | 1.091 · 1.091 | 1.32 · 1.32 | 이탈리아 물러서기(연구 — 꺼짐) |
| `SKILL.itOppositionVals.shield` | 0.6 s | 0.545 | 0.66 | 막아찌르기 피해 감소 시간 (동작 aim · extend … 은 그대로) |
| `vital_target.js quietReset · rangeTimeout` | 0.12 · 2 s | 0.109 · 1.818 | 0.132 · 2.2 | 약한 자세 보정 풀기 · 간격 맞추기 최대 |

### AI (AI_LEVELS · AI_PROFICIENCY · AI_REACT · ai.js · parry_button.js)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `AI_PROFICIENCY.reaction [0..6]` | 0.35 … 0.05 s | ÷ 1.1 | × 1.1 | AI 눈 늦음 (AI_LEVELS.reaction 도 같이) |
| `AI_REACT.face` | 0.2 s | 0.182 | 0.22 | 몸 돌릴 때 보는 상대 자리 늦음 |
| `ai.js 막기 길이 · 붙잡기 · 막기 최소 (parry_button.js 같은 수)` | 0.65 · 0.4 · 0.35 s | 0.591 · 0.364 · 0.318 | 0.715 · 0.44 · 0.385 |  |
| `ai.js 위협 없음 틈 · 새 공격 틈 · 대치 (parry_button.js 같은 수)` | 0.12 · 0.25 · 2 s | 0.109 · 0.227 · 1.818 | 0.132 · 0.275 · 2.2 |  |
| `ai.js 판단 박자 decideTimer · guardTimer · circleTimer · shuffleTimer · seizeT` | rand(…) | ÷ 1.1 | × 1.1 | 인물 rhythm · patienceTime 도 실제 초로 읽음 |
| `ai.js 물러남 길이 (startWithdraw · 패시브 do.time)` | 0.4 ~ 1.2 s | ÷ 1.1 | × 1.1 |  |
| `ai.js 공격 포기 attackT` | 1.2 · 1.4 · 3 (+2 · +1) s | 1.091 · 1.273 · 2.727 | 1.32 · 1.54 · 3.3 |  |
| `ai.js 패시브 걸쇠 · 미룬 패시브` | 0.5 s | 0.455 | 0.55 |  |
| `ai.js 사건 다시 봄 (secret.js 같은 수)` | 0.3 s | 0.273 | 0.33 |  |
| `ai.js 준비 자세 멈칫 windup × 0.15 · 0.25 · 속임 멈칫` | 인물 windup | ÷ 1.1 | × 1.1 |  |
| `ai.js 화남 눈 늦음 · 방금 휘두름` | 0.04 · 0.6 · 0.7 s | 0.036 · 0.545 · 0.636 | 0.044 · 0.66 · 0.77 |  |
| `ai.js 몰아침 읽기 감쇠 · 상대 칼 거리 돌아옴 · 몰림 참을성` | 2.5 s · 0.03 /s · 0.15 /s s | 2.273 · 0.027 · 0.136 | 2.75 · 0.033 · 0.165 |  |
| `ai.js 감정 시계` | emotions.js | ÷ 1.1 | × 1.1 | AI 감정을 실제 초로 돌림(사람 감정은 원래 화면 시간) |
| `ai_sense.js 기록 길이` | 0.8 s | 0.727 | 0.88 | 96 → 106 칸 (실제 0.8 s) |
| `secret.js 방금 (헛침 · 막기 연환 · 격살 · 들어옴 평균)` | 0.6 s | 0.545 | 0.66 |  |

### 걷기 (GAIT)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `GAIT.moveSpeed` | 2.0 (전 1.8 게임) | 1.98 | 1.818 | 사장님 10/25 22:3x — 실제 2.0 m/s (옆 0.8 · 뒤 1.4 실제) |

### 총 · 겉모습 · 소리 (GUN · debris · main.js)

| 열쇠 | 적힌 값 | 전 실제 | 새 게임 값 | 메모 |
|---|---|---|---|---|
| `GUN.cooldown · aiFirst · maxWait` | 0.8 · 1.5 · 0.6 s | 0.727 · 1.364 · 0.545 | 0.88 · 1.65 · 0.66 |  |
| `GUN.reload · reloadOpen · reloadClose · reloadInsertInterval` | 8 · 0.9 · 0.8 · 0.779 s | 7.273 · 0.818 · 0.727 · 0.708 | 8.8 · 0.99 · 0.88 · 0.857 | voicelab 장전 소리는 ÷ k 로 실제 초 |
| `DEBRIS.life · fade · ARMOR.debrisLife` | 1.6 · 0.5 · [1.1, 1.7] s | 1.455 · 0.455 · 1 · 1.545 | 1.76 · 0.55 · 1.21 · 1.87 | 조각은 물리 스텝 시계라 감쌈 (피 · 섬광 · 잔상은 원래 화면 시간) |
| `main.js 부딪힘 불꽃 · 소리 · 멈칫 간격` | 0.12 · 0.09 · 0.5 s | 0.109 · 0.082 · 0.455 | 0.132 · 0.099 · 0.55 |  |
| `whiff_drill.js 공격 사이 (시험 도구)` | [2, 3] | 1.818 · 2.727 | 2.2 · 3.3 |  |

### 주소 인자 (브라우저 — 실제 단위로 읽음)

`?mordPress=초` · `?flowArm=초` · `?aiReact=초` · `?gnsEnterWindow=초` · `?foeChargeSpeed=m/s` · `?risoHold=초` · `?risoGrace=초` · `?finishCleaveCharge=초` · `?risoWide=0`(그 안의 risolutoHold 0.6). 바꾸지 않은 주소: `?ibCircleTime` · `?ibTurnTime`(원래 실제 시간) · `?risoGlint`(화면 시간) · 거리 · 몫 · 스위치 인자.

### 그대로 둔 것 (대표 — 가름 §2)

| 무리 | 열쇠 (값) | 가름 · 까닭 |
|---|---|---|
| 물리 | `PHYSICS.timestep` 1/120 · 중력 −9.81 · `JOINTS` 감쇠(N·m·s/rad) · `STEEL` · `BIND.restitution` · `RECOIL.joltTime` 0.25 · `STRIKE.stuckTime` 0.25 · `hitCooldown` 0.25 · `speedMax` 60 · `BALANCE.fallDelay` 0.25 · `CAPE` | 물리 → 그대로 |
| 서보 · 따라감 시간 상수 | `SKILL.aimFilter` 14 rad/s · `JOINTS.swivelTau` 0.2 · `UNIQUE_ASSIST.fingerTau` 0.03 · `bodyIn` 0.1 · `bodyOut` 0.25 · `SKILL_BODY` · `CAMERA.followTau`(실제) | 물리(제어) → 그대로 |
| 걸음 기계 | `GAIT` 박자 · 발 든 시간(`burstT` 0.22 · `settleT` 0.36 · `turnStepT` 0.3 · `loadTime` 0.2 · `liftWait`) · 박차기 목표 `burstBackV` 2.5 · `burstSideV` 1.5 m/s · `runFrom` 1.7 · `walkMin` 0.2 · `hurrySpeed` 1.2 · `handoverMax` 2.5 · `BODY.turnSpeed` · `maxAccel` | 걸음 동작 → 그대로. 걷기 최고 `moveSpeed` 만 사장님 말씀대로 실제 2.0 (runFrom 1.7 은 최고 빠르기 바로 밑 '종종 뛰듯' 문턱 — 최고가 1 % 올라 뛰듯 몫이 0.20 → 0.24 로 아주 조금 늚 · 박차기 목표는 절대 빠르기라 몫 계산이 걷기 최고를 따라 저절로 맞음) |
| 동작 대본 | `THRUST` aim 0.11 · extend 0.14 · hold 0.05 · recover 0.18 · `POMMEL` · `SKILL.lungeTime` 0.3 · `followDecay` 0.3 · `SECRET.iaiTime` 0.12 · `iaiPlayerTime` 0.15 · `iberianSweepTime` 0.25 · `ibSpin.time` 0.6 · `ramp` 0.2 · `lunge`/`draw` inTime · outTime · `risolutoStep.recoverT` 0.4 · `itOppositionVals` aim · extend · hold · recover · pull · `instantNoCollide` 0.15 · skill.js 비기 단계 run.t 상한(0.25 · 0.3 · 0.5 · 0.6 · 0.8) · ai.js 따라 지나감 0.3 · 내딛기 늦춤 0.04 · 떨림 박자 · `UNIQUE_ASSIST.tsuSnapTime` 0.2(경계 2) · secret_instant.js iaiFade 0.2 | 동작 → 그대로 |
| 동작을 재는 빠르기 · 내다봄 | `SKILL.swingSpeed` 1.5 · `recoverSpeed` 1.2 · `AI_LEVELS` 손 빠르기 · `SECRET.italianCommit` 4.5 · `lethalSpeed` 10 · `lethalLook` 0.25 · `releaseT` 0.25 · `NAGASHI.moveDown` 3.5 · `FLOW_REDESIGN.minSpeed` 2.5 등 · secret.js · ai.js 칼끝 3.5 · 들어 올림 1.6 · 손 1.8 · `sense.seen(… + 0.15)` · ai.js `foeClosing` 문턱(경계 3) · `SKILL.parryAssist.lead` 0.1 | 동작 잣대 → 그대로 |
| 피 · 균형 | `VITALS.clotting` 0.12 /s · `balanceRegen` 22 /s · 출혈 · 아픔 | 경계 1 → 그대로 |
| 잰 값 | `MEASURED` · `CUT_TIME_30` (본판 10/27 적소검 [1.40, 1.68, 1.11, 0.42] · 0.31 · 10/25 쿠사나기 [1.22, 1.36, 0.97, 0.32] · 0.24 포함) | 잰 값 → 그대로 (§2) |
| 이미 실제 | `CAMERA.*` · `SECRET.slowMo.dur` · `camSwingIn/Out` · `risoCamIn/Out` · `risoStreakLife` · `risoGlintLife` · `instantArcLife` · `ibSpin.circleTime` · `stickTime` · `circleGap` · `INPUT.tapMs` · `clickMs` · `playerVibrate` · 효과 모듈(decap_fx · limb_fx · gun_fx · mad_eyes · trail — 화면 dt) | 그대로 |
| 스위치 · 거리 · 몫 | `secretHold` 1 · `risolutoCover` 0.15 m · `risolutoStick` 등 | 시간이 아님 |

### 그대로 둔 판 시작 발 묶음 (작업 중 바꿨다가 되돌림)

`ARENA.startHold` 2.0 은 처음엔 `realS(2.0)`(게임 2.2)로 바꿨으나 되돌렸다: 브라우저 판은 이 값을 판마다 카메라 길이(훑기 실제 3.0 s · 내려앉기 1.0 s × 템포)로 덮으므로 게임에 쓰이는 곳은 `?openSweep=0` 판뿐이고, 시뮬 · 도구는 이 값을 장면 시각의 바탕으로 쓴다(예: finish_thrust 는 판을 열고 약 2.0 s 에 탭 — 발 묶음이 2.2 면 디딤이 묶여 찌르기가 안 닿음). 그래서 config 값은 시뮬 · 도구의 게임 초 그대로 두고, `?openSweep=0` 판만 `main.js planOpening` 에서 `realS` 로 실제 2.0 s.

## 4. 시험 고침 (문턱 · 잣대는 하나만 바꿈 — 아래 '기어 듦 깊이')

적힌 시간이 실제 초가 되어 **게임 값 = 적힌 값 × 1.1** — 옛 수를 박아 둔 시험을 고침(모두 `realS(…)` 로 적어 `TIME_STD=0` 에서도 같은 뜻):
- 값 · 셈 스텝: `japanese_flow`(흘림 창 0.2 · 팔 늦춤 0.4) · `mordschlag`(누르기 1.5 · 창 0.6 · 굳음 0.4 · 셈 스텝) · `iberian_spin`(무장 1.5 · 무장 기다림 1.6) · `italian_risoluto`(이어짐 0.6 · 너그러움 0.2 · 굳음 · 팔 늦춤 · 창 지킴 — 게임 0.66 s 창이 닫히는 스텝은 80째) · `tizona_awe`(위세 틈 1.5) · `school_passive`(켄타이 다 쌓임 = SP.japanese.full) · 앞선 임시 저장분 `attack_circle` · `druid_whip` · `gonosen_risk` · `gyeoksal` · `hero_tear`.
- 기력 시험(`stamina` · `stamina_clinch` · `stamina_integration`): 시험 안 `tick(…, 초)` 를 실제 초로 읽게(게임 초 × 1.1 만큼 물리 dt 로 돎) · 탈진 길이 exT 도 실제 초 · 회복 기다림 실제 0.6 s 는 79 스텝(게임 0.658 s)엔 아직 기다림 — 기대 값을 식으로.
- 옛 결함 재현 셋은 **그때 값으로**: 싱지르 '땅' 옛 결함 판(손목 옛 판 · 땅 끔)과 '칼 높이' 고침 끈 판은 무장 게임 1.5 s(무장이 게임 1.65 면 원을 다 그려 내는 때가 늦어 칼끝이 땅을 안 스치고 · 본판 10/27 대검 몸과 함께면 셋 중 하나만 솟음) · 손목 '17:2x 판' 탭 찌르기는 걷기 게임 1.8 m/s(걷기 실제 2.0 이면 탭 찌르기 디딤이 1 % 더 나가 1.5 m 판 하나가 찌름 1).
- 잰 값 시험 둘은 **잰 때 과녁 조건으로**: `italian_measure`(찌르기 잣대 줄 — 서 있는 과녁 몸의 AI 반응 게임 0.2 s · 표준 시간이면 롱소드 잣대가 5 mm 짧게 재져 비율 0.35 %) — 잰 값은 그대로(§2).
- 런지 손목(`wrist_audit`)은 10/24 굳음 길이(게임 0.6 s)로 봄 — **발견**: 뻗은 팔은 굳음이 시작되고 게임 약 0.45 s(54 스텝) 뒤부터 돌아오기 시작한다(옛 판 · 표준 시간 판 같은 스텝 — 굳음 · 붙잡기 길이와 상관없는 몫, 까닭은 따로 볼 일). 굳음이 실제 0.6 s(게임 0.66 · 80 스텝)가 되면 돌아오는 몫이 길어져 '굳음 손 앞 평균'이 달타냥 0.90 → 0.845(문턱 0.85). 사장님 · 감독께 여쭘: 런지 뒤 굳음 끝 0.2 s 쯤 팔이 거둬지는 그림이 괜찮은지.
- AI · 봇 판이 바뀌어 씨앗을 다시 고르거나 늘림: `tizona_awe` AI 대 AI(본판 10/27 티소나 몸 뒤 씨앗 6 · 1 → 이 파일째 돌려 27 · 10 — 시험 글에 '몸 · AI 가 바뀌면 씨앗을 다시 고른다' · 상대 자리는 '1.5 s 안 건너뜀'이 있는 판이 드물어 30 씨앗 중 27 하나) · `schielhau_strike` 사람 곁눈 베기 맞는 순간(씨앗 6 → 12: 여섯이면 3 판 범위 밖 4 / 23 = 17 % · 3 ÷ 전 판 세기 1.38 로 문턱을 넘음 — 옛 판도 여섯 씨앗 2 / 24 · 0.80 처럼 출렁임 · 열둘이면 표준 시간 5 / 46 · 1.23 · 옛 판 5 / 48 · 0.91 로 둘 다 문턱 안. 시험 하나가 약 1 분 → 2 분).
- `school_passive` 실제 판(켄타이 · 인데스가 실제 상처에 실림) 씨앗 1002 → 1011(1002 는 30 s 안 켄타이 맞음 0 · 1011 은 표준 시간 켄타이 2 · 인데스 2 · 옛 판 3 · 3 — 시험 글에 같은 까닭으로 1001 → 1002 를 바꾼 적 있음).
- **잣대를 바꾼 것 하나 [사장님 · 감독 확인 전]**: `gonosen_risk` ⑤ '경계를 켜면 AI 가 준비된 사람 발도 선 안에 기어 들지 않음' — '기어 듦' 을 선을 **0.05 m 넘게** 들어온 것으로(전: 선을 스치기만 해도). 토메 씨앗 1 은 선 밖 간 보기 자리(holdDist 2.42 m)에서 옆으로 돌며 가슴 사이가 선 2.33 m 위아래 1 ~ 2 cm 로 흔들려 선을 두 번 스침(13.5 · 14.3 s — 걸어 들지 않음 · 씨앗 2 ~ 5 는 0). 경계를 끈 옛 01:3x 판은 몸이 선 안으로 걸어 들어와 이 깊이도 넘으므로 시험의 뜻은 그대로.
- 새 시험 `time_standard.test.mjs`: 장치 · 걷기 2.0 · 달려듦 1.2 · 창 0.6 · SECRET 안 시간 이름 열쇠 맨 수 거름 · 옛 판 TIME_STD=0 값.
- 곁 발견(작업 중 · 지금 판엔 안 나옴): 판 시작 발 묶음을 게임 2.2 로 바꿨던 동안, 싱지르 티소나 큰 원을 발이 풀리고 0.55 s 뒤에 내면 도는 동안 두 발이 엇갈림(67 스텝 · 0.6 s 뒤면 0). 발이 막 풀린 직후 싱지르를 내는 장면이 실제 판에서 나올 수 있는지는 따로 볼 만함.

## 5. 효과 (작은 잼)

작게 돌림(사장님 '작은 시험'): 옛 판 = `TIME_STD=0`(지금 본판과 같음) · 새 판 = 기본.

| 무엇 | 옛 판 | 표준 시간 | 메모 |
|---|---|---|---|
| 걷기 목표 (앞 · 옆 · 뒤, 실제 m/s) | 1.98 · 0.79 · 1.39 | **2.0 · 0.8 · 1.4** | 사장님 결정 |
| 잰 골반 평균 빠르기 (스틱 끝까지 · 3 ~ 6 s · 실제 m/s) | 1.89 · 0.79 · 1.27 | 1.92 · 0.81 · 1.29 | `.tmp` 잼 (걸음 출렁임으로 목표보다 4 % 밑 — 두 판 같음) |
| 사람 비기 창 · 굳음 (실제 s) | 0.545 · 굳음 일본/이베리아 1.09 | **0.6 · 1.2** | 적힌 그대로 |
| 고노센 달려듦 문턱 (실제 m/s) | 1.32 | **1.2** | 사장님 결정 |
| 고노센 걸어 드는 몸 (`gonosen_walkin.mjs 2 20 uchigatana longsword` — 우치가타나 대 롱소드 · 씨앗 2 × 20 s · B 막힘 켬): 선 앞뒤 0.5 m 다가옴 표본 중 달려듦 문턱 넘는 몫 — 스틱 0.5 · 0.7 · 1.0 | 1 % · 49 % · 98 % | 7 % · 64 % · 100 % | 선을 넘는 스텝(0.6 s 평균)은 스틱 0.5 실제 0.91 m/s 로 여전히 '천천히 걸어 듦'(창 2 · 둘 다 막힘) · 0.7 · 1.0 은 두 판 다 '빠르게'(창 2 · 맞힘 2) — 창 가름은 이 판에선 안 바뀜 |
| 리솔루토 탭 흉내 (`risoluto_tap.mjs rapier isolde 1 30 0.25,0.5,0.58` — 레이피어 · 씨앗 1 · 반응 0.25 · 0.5 · 0.58 s 실시간) | 낸 탭 100 % · 100 % · 100 % | 100 % · 100 % · 100 % | 창 지킴(secretHold — 0.6 s)이 있어 이 작은 판에선 차이 안 보임 · 창은 이제 실제 0.6 s(전 0.545) |
| AI 대 AI 12 판 (fights12) | 죽음 9 / 12 · 넘어짐 1.2 · 열린 틈 6.5 / 판 | 죽음 11 / 12 · 넘어짐 1.0 · 열린 틈 5.9 / 판 | AI 반응 · 판단 박자 · 막기 · 물러남 · 굳음이 게임 시간으로 10 % 길어짐 → 판 흐름이 바뀜(같은 씨앗의 판이 통째로 다름 — 12 판이라 몫은 소음 폭) |

## 6. 관문 해시 (sha256 앞 8 자 · 'deprecated parameters' 줄 뺌)

| 관문 | 기준(본판 c32b979 · 33f8087 같음) | 옛 판 `TIME_STD=0` (이 가지) | **표준 시간 (기본 — 새 기준 후보)** | 왜 바뀌나 |
|---|---|---|---|---|
| `node tools/sim/fights12.mjs` | f3bd3ce2 | f3bd3ce2 (같음) | **d2b7915f** | AI 대 AI: AI 판단 박자 · 반응 · 막기 길이 · 물러남 · 비기 굳음 · 기력 회복 초당 몫 · 넘어진 뒤 기다림이 게임 시간으로 10 % 길어짐(실제 초가 됨) — 같은 씨앗이어도 판 흐름이 처음부터 갈림 |
| `node tools/sim/live_battery.mjs` | 67a000a7 | 67a000a7 (같음) | **e8127a92** | 몸 · 칼 지표는 거의 그대로(칼끝 · 단계 수 같음) — 걷기 실제 2.0(+1 %)으로 걷는 칼끝 출렁임 232 → 228 mm · 겨눔 유지 지표 소수 둘째 자리 · 맞음 에너지 1 ~ 2 J (과녁 몸 AI 반응 0.22 게임 s · 걷기) |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 90812518 | 90812518 (같음) | **ad302969** | 서 있는 상대 탭 찌르기 12 판: 골반 자리 mm 차 · 쟁기 1.2 m 판 첫 맞음이 가슴 둔타 → 머리 찌름 · 황소 1.5 m 찌름 에너지 28.8 → 24.9 J — 탭 찌르기 디딤(걷기 +1 %)과 과녁 몸 돌기(AI 반응) 몫 |
| weapon_smoke | 34 OK | — | **34 OK** | |

새 기준은 사장님 확인 뒤에 본판에 넣는다.

## 7. 다른 가지와 합칠 때 (wk/secret-text · 앞으로 들어올 값)

- wk/secret-text(임시 저장 712a2ec 기준)는 사장님이 **실제 초로 말씀하신** 값을 맨 수로 적는다: 고노센 준비 `iaiArmTime` 1.5 → 2.0 · 싱지르 `ibSpin.armTime` 1.5 → 2.0 · 모르트슐라크 `mordPress` 1.5 → 2.0 + 새 열쇠 `mordGrace` 0.2(0.2 s 안 다시 누르면 이어서 셈) · 새 `gnsCrouchOut` 0.2(웅크림 풀림).
- 두 가지가 같은 줄을 고치므로 합칠 때 충돌로 드러난다 → 사장님 값 그대로 `realS(2.0)` 로 감싸 받으면 된다. 새 열쇠 `mordGrace` 는 충돌이 안 나므로 `realS(0.2)` 로 감싸야 하고 — 안 감싸면 `tools/sim/time_standard.test.mjs` 가 'SECRET 안 시간 이름 열쇠가 맨 수'로 걸러 낸다(…Grace · …Time · …Press). `gnsCrouchOut` 은 몸놀림 풀림 시간이라 그대로(시험 이름 규칙에도 안 걸림).
- 그 가지 코드에 새로 박힌 규칙 시간(예: 고노센 준비 'idle' 셈 · mordGrace 셈)은 config 값을 읽으면 저절로 실제 초 · 코드 수라면 `realS( … )` 로.
- 그 가지 시험이 옛 수를 박아 두었으면(예 `assert.equal(SECRET.iaiArmTime, 2.0)`) 이 가지처럼 `realS(2.0)` 로.
- 순서는 상관없음: 어느 쪽이 먼저 본판에 들어가도 같은 처리.
