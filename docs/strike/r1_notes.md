# R1 팔 놀림 지연 — 메모

설계: docs/whole_body_redesign.md 3-2 (b)(c)(d)(g), 3-3, §8 R1. 코드: src/skill.js (readFinger·leadVel), src/input.js (FingerTrace.rawVel), src/config.js ARM, src/fighter.js updateBodyPose.

## 새 가드 (newGuards) — 모두 사장님 확인 전 설계 기본값

- **ARM.lead = false (앞섬 보정 꺼 둠).** 켜면 실제 휘두르기가 느려진다: horizR 팔 베기 칼끝 19.7 → 12.6 m/s (−36 %),
  diagR 첫 상처 144 J @300 ms → 37 J @717 ms. 끄고 나머지 R1 만 켜면 20.6 m/s, 첫 상처 @292 ms
  (상대 몸 holdSpeed 0.6 이면 가슴 156 J, 아래처럼 AI 0.3 이면 팔 116 J — 상대 자세에 따라 맞는 곳이 바뀐다).
  코드는 둔다. 켤지는 사장님이 정한다. W4 팔 앞먹임이 본디 고칠 길.
  (chain.mjs --fams=horizR,diagR --modes=arm --scenes=air,stop,hit --input=60)
- **holdSpeed 0.6 — 손가락 파이터만** (ARM.holdSpeedFinger, skill.trace 가 있는 파이터 = 플레이어). AI 는 SKILL_BODY.holdSpeed 0.3 그대로.
  전역 0.6 은 AI 몸도 바꿨다 (fights12 판당 쓰러짐 1.6 → 1.0). AI 에도 줄지는 사장님 표 한 줄이 정한다.
- **SKILL.swingSpeed 1.5 m/s 를 목줄 건너뛰기·원 속도 swinging 의 문턱으로 다시 씀.** 한도가 아니라 문턱이다.
  그 아래에서는 예전 2 cm 목줄(inputDeadRadius)이 떨림을 거른다.
- **rawVel minSpan = 물리 한 스텝.** 실제 조각 두 개가 한 스텝 이상 떨어져야 기울기를 잰다.
- **원 속도 멈춤 창 = max(두 조각 사이, COMMIT.stillGap 40 ms, COMMIT.stillFrames 2.4 × 프레임).** 마지막 조각 뒤 이 창을 넘으면 0.

## 사장님께 물을 것 (고침 담당이 남김)

1. 고른 지연 ≤ 20 ms (3-3) 는 swingSpeed 아래 느린 끌기에도 드는가? 지금은 그 아래에서 2 cm 목줄이 그대로라 느린 끌기 지연이 남는다.
2. 멈춤 창에 결심 판정의 COMMIT.stillGap·stillFrames 를 다시 써도 되는가, 따로 둘 것인가.

## 알림만 (고치지 않음)

- 멈춤 넘침: 팔 베기를 멈춘 뒤 손이 멈춘 자세를 0.073 ~ 0.102 m 지나간다 (앞섬 켬, 60/120 Hz, 3·8 m/s). 설계 3-3 은 0.07 m.
  앞섬 끈 새 기본 0.067 ~ 0.086 m, R1 끔 0.064 ~ 0.076 m.
- 120 Hz 시작 +8.3 ms: rawVel 의 span ≥ minSpan 검사 때문에 120 Hz 입력에서 원 속도가 한 조각(8.3 ms) 늦게 선다.

## 앞섬 끈 새 기본의 지연 (정보, 고르지 않음)

- 고른 지연 aimRaw → aim: 80 ~ 82 ms @3 m/s, 65 ~ 69 ms @8 m/s — 필터 앞섬이 없어 R1 끔과 같다 (앞섬 켬 18 ~ 30 ms, 설계 ≤ 20 ms).
  손가락 → aim: 38 ~ 40 ms @3 m/s (끔 44 ~ 46), 45 ~ 49 ms @8 m/s (끔 46), 1 m/s 146 ms (문턱 아래라 끔과 같다).
- 손가락 → 손 목표 2 cm: 35 ~ 43 ms @3 m/s, 23 ~ 31 ms @8 m/s — R1 끔과 거의 같다 (설계 ≤ 33/25 ms).
- 떨림 3 mm 8 Hz: 몸 손 1.12 mm (R1 끔 2.17 mm), swinging 0 스텝.
