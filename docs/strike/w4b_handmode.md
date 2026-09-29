# R2 W4b 칼 든 손 몫 방식 — 메모

설계: docs/strike/r2_impl_spec.md §6, §10. 코드: src/strike/drive_arm.js (armStep·govern·phiDotMax·fingerFrame·fingerGain1·mixHandFinger), src/config.js DRIVE.handMode. 잰 것: b3ba671, chain.mjs --modes=arm --set=ARM.lead=false, 장검, 120 Hz 물리. 맨 팔 = 같은 커밋 DRIVE.on=false. §10 값 그대로 (튜닝 없음).

## 세 방식 (DRIVE.handMode, 드라이브 w > 0 스텝에서만 읽는다)

- **track (기본).** W4 그대로: 긋는 동안도 클립 손 길을 목표로 쫓는다.
- **finger.** 감기는 클립 손, 베기부터 R1 손가락 → 손 매핑을 명령 가슴 틀로 돌린 것. 들뜸은 carryPhi 로 푼다.
- **governed.** track 이지만 손 위상 φH 가 팔이 지금 닫을 수 있는 빠르기 (Hill·관성·IK 민감도) 보다 앞서지 않는다.

## 맨 팔 베기와 견줌 (v12 in60 air, 칼끝 tc m/s / tc 운동에너지 J — 괄호 = 맨 팔)

- horizR: track 5.98/20.9, finger 5.98/20.9 (베기에 안 들어감), governed 5.70/17.1 (19.5/43.7)
- diagR: track 4.10/2.2, finger 8.22/6.4, governed **18.73/55.9** (16.65/36.7). hit 첫 상처 governed 팔 113 J @575 ms (맨 팔 116 J @292), track·finger 모든 무리 없음
- vert: track 0.92/0.3, finger 3.94/1.5, governed 3.91/1.8 (16.03/41.4). riseR: 1.51/0.6, 1.51/0.6, **11.36/16.1** (7.92/10.9)
- 기준 (1) (모든 행 ≥ 맨 팔 × 0.95) 빠진 행: track 34/44, finger 35/44, governed 27/44. 추적 게이트 S1 x1 셋 다 실패. 모양 통과: track zornhau 만, finger 없음 (mittelhau 넘어짐), governed mittelhau·unterhau (넘어짐 없음).
- 손가락 빠르기 v3→v20: track diagR 11.5 → 2.7 m/s (손가락이 빠를수록 칼끝이 느려진다). finger·governed 는 오르내림.
  손 추적 끔 (DRIVE.hands=false) 은 horizR 23.36/57.9, vert 19.32/51.7 로 맨 팔보다 크다 (diagR 0.947 배, riseR 2.75 모자람).

## 고른 것: 'track' 그대로 — 이긴 방식 없음

- 셋 다 (1) 에서 빠졌다. 기본은 W4 와 같은 'track'. finger·governed 코드는 A/B 스위치로 둔다. governed 가 참고 순위 1 (빠진 행 가장 적음).
- 공통 원인: 손가락 빠르기로 클립 손을 쫓는 것 자체가 손실이다. 목표가 팔보다 멀리 앞서면 PD/IK 팔이 짧고 느린 길로 간다
  (R1 ARM.lead 와 같은 병). governed 의 "닿을 수 있는 빠르기는 안 뺏는다" 는 거짓: 한 걸음 지평이 멈춘 팔을 묶는다 (아래).
- S = 0: fights12 SEED0=1·live_battery 기본 ↔ DRIVE.on=false 바이트 같음 (fights12 sha 3d9b04f9 = W4 바탕 B). 기본 chain 행 = 'track' 잰 행.

## 새 가드 (newGuards) — 모두 사장님 확인 전 설계 기본값

- **governed φH 빠르기 = min(어깨, 팔꿈치) (|ω·ê| + τ_Hill·dt/I) / |dθ/dφ|.** 상수 없음, 물리에서 셈. 그러나 한 걸음 지평이라
  멈춘 팔은 한 걸음 가속만큼만 목표를 받는다: x1 에서 241 걸음 중 74-140 걸음 묶임, φ̇max 0.15-0.27/s (φ̇B 3/s). T 동안 닿는 빠르기 τT/I 를 T/dt 배 작게 본다.
- **finger 들뜸 배율 g1 = 큰 클립 손 들뜸 / 손가락 매핑 들뜸** (무리·쪽마다 아틀라스에서 한 번). 맞춘 값 아님, 위 한도 없음. 배율로 커진 손 이동도 기존 closeReach 가 자른다. fingerFF 끔 (끔이 diagR 19.0 vs 17.0 m/s, 42.7 vs 30.3 J 로 컸다).

## 사장님께 물을 것

1. governed 지평: 한 걸음 Hill 지평을 물리로 볼 것인가, 남은 시간 동안 온 힘으로 닫을 수 있는 위상 앞섬 (상수 없음) 으로 바꿀 것인가?
2. cocontract 0.5·ffGain 0.8 의 잰 손실 (손 끄면 diagR +7 m/s, ff 켜면 어깨 Hill 상한 77 %) 을 "반동과 허점" 으로 받는가, §10 을 다시 여는가?
3. finger 는 베기 중 클립 목표가 없어 추적 게이트가 정의상 실패한다. 감기만의 DTW·모양 게이트·손가락 따르기 중 무엇으로 볼 것인가?
4. (1) 을 tc 한 점 대신 칼끝 정점·첫 상처 에너지와 시각으로 볼 것인가? 늦게 온 정점 (governed vert in60 3.91, in120 16.17) 을 손실로 칠 것인가?
5. 손 추적 끈 몸통만 (DRIVE.hands=false) 을 후보 방식이나 임시 기본으로 올릴 것인가? (v12 in60 에서만 잼, 8 행 중 2 행 모자람)
6. φB 미분이 안 걸러진다 (φ̇B 최대 44.7/s, α_des 70k rad/s², v12). 거르기는 시간 창 상수를 넣는다: 규칙 안에서 허용되는가, 아니면 손 목표를 φ 대신 손가락에서 바로 풀 것인가?
