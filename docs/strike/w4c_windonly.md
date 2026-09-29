# R2 W4c 큰 감기·앞먹임 거르기·온몸 몫 — 메모

설계: docs/strike/r2_impl_spec.md §5, §6, §10. 코드: src/strike/drive_arm.js (windOnly 손·겨눔 이어받기), drive.js (ffFilter), src/config.js DRIVE. 잰 것: bf4a457, chain.mjs (감기 1.2 m/s + 1 s 머묾) 와 chainW (감기 3 m/s + 반전 베기, 머묾 0), --modes=arm air+hit, 무리 horizR·diagR·vert·riseR, 입력 60·120 Hz, 손가락 3·6·12·20 m/s, --set=ARM.lead=false, 장검, 120 Hz 물리. 맨 팔 = 같은 커밋 DRIVE.on=false. §10 값 그대로 (튜닝 없음).

## 세 방식

- **A trunkOnly (새 기본).** DRIVE.hands=false: 몸통·다리·걸음 (W3) 은 켜고, 칼 든 손은 R1 팔 베기 손가락 매핑 (실제 가슴 틀).
- **B windOnly.** DRIVE.handMode 'windOnly': 감기만 클립 감기 자세를 c(S) 로 쫓고 (큰 감기), tCut 부터는 A 와 같은 손가락 매핑 + tCut 손 차이 들고 감.
- **C windOnlyFF.** B + DRIVE.ffFilter: 앞먹임이 한 점 곡률 대신 스텝 평균 가속을 쓴다 (φB 미분 잡음 고침, 새 상수 없음). 셋 다 cocontract=0 도 잼 (측정만).

## 맨 팔 베기와 견줌 (in60 v12, 칼끝 정점 m/s @ms / 첫 상처 J @ms — 괄호 = 맨 팔)

| 무리 / 변형 | air 정점 | hit 정점 · 첫 상처 |
|---|---|---|
| horizR chain | 23.36 @217 (20.61 @300) | 23.28, 상처 없음 (20.32, 없음) |
| diagR chain | 18.78 @275 (19.27 @283) | 18.81, 20 J @742 (19.28, 116 J @292) |
| vert chain | 20.39 @308 (17.96 @317) | 20.05, 129 J @317 (18.31, 19 J @458) |
| riseR chain | 8.50 @258 (10.61 @292) | 7.10, 6 J @675 (10.97, 47 J @300) |
| diagR chainW | 16.34 @317 (15.74 @358) | 16.14, 12 J @783 (15.79, 12 J @783) |
| vert chainW | 15.33 @333 (14.21 @317) | 4.37, 상처 없음 (12.37, 55 J @258) |

- 기준 (1) (280 쌍마다 칼끝 정점 ≥ 0.95 × 맨 팔, 맨 팔이 상처 낸 hit 행은 상처 J ≥ 0.95 ×, 시각 ≤ /0.95, air 정점 시각 ≤ /0.95, 값 없으면 빠짐) 빠진 항목 (행 · 항목): A **84** (chain 43, chainW 41), C 141 (105, 36), B 152 (113, 39). cocontract 0 이면 79 / 146 / 144.
- A 빠진 84: vert 40 (chainW vert hit — 칼이 감기 중에 표적에 먼저 닿는다, 정점 26-72 %), diagR 24 (chain hit 상처 J 16-58 %, 시각 39-80 %; v20 정점 78-91 %), riseR 12, horizR 8 (chain in120 v3·chainW in120 v6 hit 상처 없음, chain in60 v3 상처 J 55 %).
- (2) 큰 감기 (S1 x1 손 머리 위·몸 뒤, 손 길 ≥ 1.8 m): 셋 다 4 컷 모두 빠짐. A 는 감기 자세가 없어 구조적 (top −0.64~−0.67, 길 0.23-0.38 m). B/C 길 0.95-2.47 m, 그러나 zornhau top 0.00, back −0.12.
- (3) 온몸 몫: 셋 다 몸통·다리·걸음 작동 (Smax 1). in60 v12 air 칼끝 / 운동에너지 비: A 1.046 / 1.79, B 0.967 / 1.92, C 1.053 / 2.13.
- 감기 손 되돌아감 (hitch, 게이트 0.5 m/s, v3/6/12): A 0.21/0.21/0.26 통과, B 6.18/5.97/6.23, C 6.26/6.25/6.08 빠짐. 넘어짐 A 0.

## 고른 것: A trunkOnly — (1) 을 통과한 방식 없음, 가장 안전한 기본

- 판정: 이긴 방식 없음. DRIVE.hands 기본을 거짓으로 (handMode 'track'·ffFilter 거짓 그대로). A 는 빠진 항목이 가장 적고, 되돌아감 게이트를 통과하며 넘어짐이 없다.
  in60 v12 chain horizR·vert 는 맨 팔보다 크다 (칼끝 +2.8·+2.4 m/s, 상처 129 vs 19 J). 그러나 **맨 팔보다 약하지 않다는 약속은 못 한다** (위 84 행).
- 왜 B/C 가 아닌가: C 는 큰 감기 (chainW) 에서 A 보다 덜 빠지고 (36 vs 41) (2)·(3) 도 낫지만, 제스처가 CUT 에 안 드는 chain horizR·riseR 에서 스트로크 내내 손을 쫓아 무너지고 (chain horizR 11.84 @417 vs 맨 팔 20.61 @300), 되돌아감이 6 m/s 다.
- S = 0: fights12 SEED0=1·live_battery 기본 ↔ DRIVE.on=false 바이트 같음 (fights12 sha 3d9b04f9 = W4 바탕 B). 기본 chain·chainW in60 v12 행 = 판정의 trunkOnly 행.
- 새 상수 제한 없음. hands=false 는 기존 분기 (armStep·mixHand 가 일찍 돌아감) 만 탄다. 기존 한계는 그대로 닿는다 (몸통 ff 최고 ffAbd 500·ffChest 440 N·m, closeReach 0.03-0.07 m).
- **실험으로 남는 것:** DRIVE.handMode 'windOnly'·'finger'·'governed' (DRIVE.hands=true 일 때만 뜻), DRIVE.ffFilter (잡음 고침은 유효: 감기 α_des 38970 → 12000 rad/s² chain v12, 106600 → 10200 v20; 기본 끔), DRIVE.cocontract=0 (측정만).

## 사장님께 물을 것

1. riseR: Pflug 에서 riseR chamber 양옆 섹터 폭 81.1°·127.7° 가 GESTURE.sectorMax 80° 를 넘어 riseR 를 감을 수 없다. sectorMax 나 패드 자리를 바꿀 것인가?
2. (1) 표본: 제스처가 CUT 에 안 드는 chain horizR·riseR (1.2 m/s 감기 + 1 s 머묾) 을 '베기' 로 판정할 것인가? chainW 만 보면 C 36 < A 41 이다.
3. 되돌아감 게이트: 큰 감기에서 chamber 를 φ 0 손으로 둔 계측이 맞는가? (B/C 약 6 m/s, 손 ↔ chamber 0.85 m — 뒤로 감은 손이 앞으로 베는 것을 되돌아감으로 센다)
4. chainW vert hit: 감기 중 칼이 먼저 닿는 장면 (A 정점 50-425 ms) 을 손실로 칠 것인가?
5. A 는 (2) 큰 감기를 원리상 못 한다. 큰 감기를 CUT 이 확정된 스트로크에서만 켜는 windOnly (chain 손실 제거) 를 다음 일로 할 것인가, (1) 을 풀 것인가?
6. chain diagR hit (A 상처 20 J @742 vs 116 J @292): 몸통 앞먹임이 기존 한계에 붙어 있다. 이 손실을 '반동과 허점' 으로 받는가?
