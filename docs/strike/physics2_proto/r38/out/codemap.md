# r38 지도 — 찌르기 닿음 하나가 지금 코드에서 흐르는 길 (11/28 · 코드 읽기 + r36 기록 다시 읽기 · 게임 코드 안 바꿈)

표시: [잰] 대본이 기록에서 셈 · [읽은] 코드 · 주석 · 있는 결과 · [어림] 손셈. 줄 번호는 지금 physics-2 작업 트리.

## 0. 결과 먼저
- 길은 **둘**이다. (P) 닿기 전에 '가를 수 있다'고 예측하면 엔진 닿음을 끄고(0) 판정이 끌림 · 박힘 충격량을 직접 건다. (C) 예측이 '못 가름'이면 엔진이 굳게 부딪히고, 힘 사건(contact force event)에서 판정만 한 번 한다(같은 상처 식 · 끌림 · 박힘 없음). [읽은 combat.js 245–251 · 620–641]
- 두 길 모두 상처는 **첫 닿음 한 번의 운동 에너지**(스텝 전 빠르기)로만 정한다. 그 뒤 몸이 미는 동안은 상처를 다시 세지 않는다(같은 부위 0.25 s 쉼 · 빠르기 < 0.5 m/s 면 셈 안 함). [읽은 978–989 · 286]
- 판정이 나면 사람 탭의 '뻗은 채 머묾'이 곧장 거둬진다(drive.landed · it.landed) — 몸이 계속 미는 시간 자체를 코드가 끊는다. [읽은 990–991 · skill.js 461 · 468]
- (P) 길의 구멍: 예측은 가름이었는데 실제 닿음에서 판정이 null(에너지 < 6 J)이면 끌림 0 · 닿음은 꺼진 채 → **칼이 몸을 저항 없이 지나감**. r36 기록에서 이런 줄 [잰]: N 레이피어 7 · L2 레이피어 15 / 장검 11 · F 레이피어 22 / 장검 11 (모든 닿음 줄 · `$S/r38/peek4.mjs`).

## 1. 한 스텝의 차례 (찌르기 닿음 하나)
```
[스텝 전] fighter.cache* (칼·부위 p,q,v,w 저장) ── 걸이는 엔진을 못 부르니 이 값만 씀
  │
world.step 안: filterContactPair(c1,c2)               combat.js 223
  ├ 제 몸 · 칼날 아닌 쌍 → 1(부딪힘)                    225–230
  ├ holdGhost/instantGhost(비기 운동학 찌름 뒤) → 0       228
  ├ cutting 장부에 있음 → 0 (다 쓴 박힘이면 지우고 1)      233–243
  └ 처음: predict(pr) — 칼날 위 '부위 무게중심에 가장 가까운 점'을 닿는 점으로 가정 261–274
        → analyze(…, predicting=true) → pass 면 장부 set · 0 / 아니면 1   245–251
  │
afterStep(world, eq)                                   combat.js 523
  1) cutting 장부마다 (P 길)                            529–616
     ├ 2 스텝 넘게 안 겹침 → 지움                        530
     ├ 실제 닿는 점(contactDist < 0.004) 찾기           538–546
     ├ 첫 닿음: strike(pr, point, passing=true)  ← 상처 한 번   553
     │    Eleft = min(physE∨energy, absorb)/energyScale · stuck · mFree   555–559
     ├ 끌림: Estep=min(Eleft, dragC·s²·dt) · J=min(Estep/s, dragCap·mFree·s)  581–583
     ├ 박힘: s<0.5 이거나 Eleft 다 씀 & stuck → stuckT=0.25 s ·
     │       J=min(min(150·s,500)·dt, 0.8·(mFree+0.3)·s)      570–590
     └ J ≤ s/(1/m칼손 + 1/m부위) (뒤집지 않게) · 칼 −J · 몸 +J 같은 점(칼날 중심선)  600–609
  2) 힘 사건 (C 길): drainContactForceEvents (임계 1 N · fighter.js 963)  620–641
     ├ 장부에 있는 쌍은 건너뜀                           635
     └ strike(pr, 접점, passing=false) → rebound(뼈·투구·판금만 되튐)   638–639
strike(): 0.25 s 쉼 → analyze → physE<6 이면 null → landed 표시 → applyWound   970–1015
```
analyze 안의 판정 (combat.js 280–520):
1. 상대 빠르기 s = |v칼 − v부위| (그 점 · 스텝 전) · s<0.5 또는 >60 → null. 286–288
2. 갈래: 칼날 · 칼 축 성분 along > stabAlign − window 이고 t > 0.8 − window → stab. 331
3. 질량: mFree(강체 칼의 그 점 유효 질량) + armAssist 0.3 · **thrustPush 이고 서 있음/무릎** 이면 mFree + thrustAssist 3.5. 302–303 · 337–342
4. 에너지: ephys = ½ m s² · energy = ephys × 2.0 × hk(비기 · 손가락 · 이탈리아 배율). 304 · 312–314
5. 문턱: thr = ANATOMY[zone].stab × guard(옷 0.55+0.45×옷, 찌르기 무기 gap 이 깎음) · 판금 max(47×판막음) · 투구 max. 395–447
6. eff = energy × power × mThrust × 감정 · 마무리 찍기면 × FINISH.power. 448–449
7. eff > thr → severity = (eff−thr)/60 · pass = eff×physK > thr×1.25. 아니면(예측 아닐 때) blunt 로 바꾸고 팔 몫을 되돌림. 450–464
8. 뒤에 곱하는 것(상처 · 둔타에만): 동방 막기 · 흘림 0.3 · 바위 몸 · 막아찌르기 0.6 · 유파 · 비검. 457–489
applyWound (fighter.js 2009–): 아픔 += 0.8 sev + E/150 · 균형 −= 0.5×E · 옷 찢김 · 출혈 = sev × bleed × **1.6(찌르기)** 2058 · 목 sev>0.5 죽음 · 머리 찌르기 sev>0.5 죽음 · 팔다리 기능 −0.7×sev.

## 2. 값의 표 (찌르기에 걸리는 것)
| 이름 | 수 | 뜻 | 누가 · 언제 [읽은] |
|---|---|---|---|
| STRIKE.thrustAssist · armAssist | 3.5 · 0.3 kg | thrustPush 동안 칼끝 뒤 팔 몫 · 그 밖 닿음(박힘 상한에도) | 감독(8라운드 검토) · 날짜 없음 · 3.5 는 r36 엔진 2.9–4.2 와 맞음 [잰] |
| STRIKE.energyScale | 2.0 | 판정 에너지 = 실제 × 2 | 'AI 12판 사망 비율' 맞춤 · 날짜 없음 |
| STRIKE.minEnergy · stabAlign | 6 J · 0.75 | 이 밑은 판정 없음(physE 로) · 찌르기 갈래 cos | 날짜 없음 |
| THRUST_STYLE.rapier · mThrust | gap 0.6 · window 0.12 · 레이피어 1.3 · 장검 1 | 틈 파고듦 · 갈래 폭 · 무기 찌르기 배율 | gap 사장님 11/14 · weapons.js 419 · 676 |
| ANATOMY.*.stab | 머리 20 · 목 16 · 가슴 25 · 배 18 · 골반 22 · 팔 18 · 다리 20 J | 찌르기 문턱 | 날짜 없음 |
| ANATOMY.*.absorb | 가슴 110 · 배 90 … | 박힘 갈림(physE ≤ absorb → stuck) · Eleft 상한 | 날짜 없음 |
| ARMOR.plate.stab · limb | 47 J · ×0.65 | 판금 찌르기 문턱 | 사장님(판금 막음) · 수는 armor_eval 맞춤 |
| 1.25 · 60 | 손 박음 | 가름 여유 · 찌르기 심각도 나눗수 | combat.js 451–452 · 설정 밖 |
| IT_OUTBOX.thrustMul | 0.8 | 이탈리아 보통 찌르기 상처 배율(사람 · AI 이탈리아 둘 다 — itBody 는 유파만 봄) | 사장님 11/14 · 확인표 23 |
| IT_OUTBOX.stop · inqMul · SECRET.risolutoHitMul · hitMul | 0.3 · 0.5 · 0.5 · 1.3 | 맞박자 · 비껴서며 · 리솔루토 · 비기 | 사장님 11/14 · 11/16 · 11/11 · [확인 전] |
| FINISH.power | 2.5 | 마무리 찍기 | 사장님 10/12 |
| dragC · dragCap · stuckTime · stuckDamp · stuckForce | 44 · 0.35 · 0.25 s · 150 · 500 N | 끌림 · 박힘 붙잡기 · 다 쓰면 풀기 | 풀기만 사장님 11/15 · 11/16 · 나머지 날짜 없음 |
| hitCooldown | 0.25 s | 같은 부위 다음 판정까지 쉼 | 날짜 없음 |
| THRUST aim/extend/hold/recover | 0.11 · 0.14 · 0.05 · 0.18 s | thrustPush = aim ≤ t < aim+extend+hold (skill.js 500) | 날짜 없음 |
| THRUST.driveChamber · driveStep · 출혈 ×1.6 · LIMB_LOSS | 0.3 · 0.45 m · 1.6 · 0.7 | 몸 싣기 런지 · 찌르기 출혈 · 팔다리 기능 | 사장님 11/16 · fighter.js 2058 · 78 |

손셈 [어림 · 위 값]: 레이피어 가슴(thr 18.25 · ×2.6 · mFree 가운데 0.23 [잰 N]) 상처 ≈ 1.94 m/s · 가름 ≈ 2.16 m/s · 판정 자체(6 J) ≈ 1.27 m/s. 장검 가슴(thr 25 · ×2.0 · mFree 0.71 [잰 N]) 상처 ≈ 2.44 · 가름 ≈ 2.72 m/s. 이탈리아 × 0.8 이면 상처 문턱이 가름 문턱과 같아짐(둘 다 ≈ 2.16 — physK 가 가름만 되곱하므로).
mFree 10/50/90 % [잰 r36 기록]: 레이피어 0.11–0.13 / 0.23–0.44 / 0.74–1.07 · 장검 0.40–0.45 / 0.71–0.98 / 1.27–1.39 kg.

## 3. 엔진의 닿는 힘을 읽는 자리
| 경우 | 읽을 수 있나 | 어디서 |
|---|---|---|
| C 길(닿음 켬) | 예 | `world.contactPair(...).contactImpulse(i)` × nIter/(nIter+1)=6/7(main.js 550 · r36 rescore 112–129) · 힘 사건 `drainContactForceEvents`(지금은 방아쇠로만 씀) |
| P 길(장부 · 닿음 0) | 아니오 — 엔진 충격량 0 | 판정이 건 끌림 · 박힘만 있음(`applyImpulseAtPoint` 를 감싸 읽음 · rescore 116) · 닿는 점만 manifold 로 |
| 박힘 풀린 뒤 | 예(다시 1) | 칼이 밀려 나오는 힘 |
닿음을 켠 채 두면 [어림 · 코드]: 첫 닿음 판정은 같음(스텝 전 빠르기) · 끌림 · 박힘 · '박혀 안 뽑힘' 없음 · 뼈 · 판 자리면 rebound 가 더 걸림 · 칼끝이 한 스텝에 멎고 뒤 미는 힘이 엔진 기록에 남음 · 몸 겹침(가슴 0.4 m 까지 붙음 — 11/15 기록) 없음 · 참수 · 절단은 passing 을 요구하나(fighter.js 2067 · 2134) 베기만이라 찌르기는 영향 없음 · 닿아 있는 스텝마다 힘 사건이 strike 를 다시 부름(0.25 s 쉼 · s<0.5 가 막음).

## 4. 같은 길을 쓰는 것 (바꾸면 같이 움직임)
- **베기**: predict · analyze · cutting 장부 · 끌림 · 박힘 · 힘 사건이 모두 같은 함수. 찌르기만 가르려면 type==='stab' 갈림이 analyze 331 과 filterContactPair 둘에 다 있어야 함.
- **멍(둔타)**: 못 든 찌르기는 blunt 로 바뀌고 팔 몫을 되돌림(463) → 아픔 · 균형 · 옷 · 기절.
- **갑옷**: thr 에 판금 · 투구 max · applyWound 의 판 닳음(에너지 기준) · rebound(STEEL.steel).
- **방패**: combat.js 에 방패 판정 없음(ai.js 'shieldOpp' 은 무리 싸움 몰이 이름) [읽은 grep].
- **끝내기 찌르기**: finishPower(382) — tap.down · go · thrustPush 에 묶임.
- **비기 순간 베기**: secret_instant.js 362–380 이 combat.analyze 를 직접 불러 applyWound(엔진 닿음 없음).
- **AI 판단**: 상처 예측 안 씀(ai.js 에 analyze · ANATOMY 없음 · 4127 은 비기 기록용 energy) [읽은 grep]. AI 레이피어 찌르기도 skill.thrust → 같은 thrustPush.
- **재는 도구 · 시험**(찌르기 판정 값을 읽거나 박음):
  - weapon_anatomy.mjs: eff/thr 비 · **팔 몫을 thrustPose.w>0.5 로 다시 셈(게임은 thrustPush — 조건이 다름)** 43
  - armor_eval.mjs: r.thr · r.eff · severity · type 115 · 303 · 359
  - r36/rescore.mjs: analyze 감쌈 · 판정 식 다시 셈 · contactImpulse × KC / thrust_stuck.test: physE = energy/0.8 · stuck = physE ≤ absorb 56–62
  - it_outbox.test: thrustMul === 0.8 · 배율 1 견줌 40 · 67 / it_tone.test: inqMul / blade_step.test: mEff 덧몫 = armAssist 또는 thrustAssist 92 · 에너지 식 85
  - 그 밖 onWound · severity 를 읽는 시험 약 20 개(italian_risoluto · finger_cut · gyeoksal · mordschlag · saengsa …) · wb_gate/wb_measure 의 맞음 셈(onWound 수).

## 5. '몸이 계속 미는' 동안 지금 코드가 하는 일
| 갈래 | 그동안 |
|---|---|
| P · 박힘(physE ≤ absorb — 찌르기는 거의 늘) | 끌림이 Eleft 를 먹음(상한 0.35·mFree·s 라 레이피어는 스텝당 작음) → s<0.5 면 0.25 s 붙잡음(≤500 N) → 장부 지움 → 닿음 다시 켜져 칼이 밀려 나옴 |
| P · 가름(physE > absorb) | Eleft(≤absorb/2 J) 다 쓰면 **저항 0 으로 겹친 채 지나감** — 미는 힘이 아무 일도 안 함 |
| P · 판정 null | 처음부터 저항 0(위 0 의 구멍) |
| C | 굳은 벽 · 엔진이 미는 힘을 받아 냄 · 상처 다시 안 셈 |
| 사람 탭 | 판정(≥6 J)이 나면 landed → 거둠(recover 0.18 s). 6 J 밑이면 런지 발이 뜬 동안 뻗은 채 머묾 계속(skill.js 468) |

## 6. 건드리면 넓게 번지는 자리
1. filterContactPair 의 predict(245) — 베기 · 참수 · 절단 · 박힘 기록(11/15–16 사장님 결정) · 보정 v2 bladeTouch 가 다 여기에 걸림.
2. analyze 의 반환 값(thr · eff · physE · mFree · stuck) — 도구 · 시험 · secret_instant · rescore 가 읽음. 이름 · 뜻을 바꾸면 조용히 어긋남.
3. physK(318) — 약화 배율을 가름 · 문턱 · 박힘에서 빼는 장치. 새 셈이 '깊이'로 상처를 정하면 0.8 · 0.5 를 어디에 걸지 다시 정해야(확인표 23).
4. landed 표시(990–991) — 판정 시점이 바뀌면(깊이 셈은 여러 스텝) 탭이 거두는 때 · 런지 길이가 바뀜.
5. hitCooldown 열쇠 `att.index:part` — 여러 스텝 셈은 쉼과 겹침.
6. thrustPush 하나가 팔 몫 · 마무리 · 학교 패시브(school_passive 413) · 기력(stamina 450) · 총(gun 372)에 쓰임.
7. analyze 머리 주석 '사람 이탈리아가 아니면 null' 은 11/15 이후 낡음 — AI 이탈리아도 itThrust 를 받음(italian_outbox.js 40–48 · 84).
8. 모르는 것: P 길에서 예측과 실제가 갈리는 까닭의 몫(닿는 점 가정 · 스텝 차이) · C 길 찌르기 상처가 전체의 몇 할인지(r36 기록 찌르기 줄: L1 장검 상처 9 중 5 · N 장검 8 중 2 가 C 길 · 레이피어는 0 [잰 `$S/r38/peek3.mjs`]).
