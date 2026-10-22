# 이탈리아 비기 — 거침없이 나아가 찌르기 (안다레 리솔루토) · 사람 먼저 (2026-10-22)

- 사장님(10/22 저녁, 원문): "칼로 상대 칼을 누른채 다가간다는 건 칼이 서로 긁히면서 얽혀 있는데(막기나 휘두름 x) 내가 앞으로 나아가는 상황을 얘기하는 거지?" → 감독 '맞다' · "리솔루토 덮음은 모양으로 재고 사람 먼저".
- 바탕: 감독 커밋 1636579(`SECRET.aiOpenSchools` — AI 는 이것만 본다, 일본 그대로). 이 작업은 사람 쪽 `SECRET.openSchools` 에 `'italian'` 을 더하고 사람 길만 바꾼다.
- 값 · 규칙은 모두 **사장님 확인 전**(사장님 결정 = 모양 판정 · 사람 먼저) — 확인표 2190~2196.
- AI 끼리 판 바이트 그대로: fights12 `05b9c6f2` · live_battery `289eeb43` · finish_thrust 1 --stand `015fdd7c`.

## 1. 원전 — 파브리스 『Lo Schermo, overo Scienza d'Arme』(1606) 둘째 책 '결연히 나아가기'

Wiktenauer 'Salvator Fabris' — 1606 전사(Michael Chidester) · A. F. Johnson 영역(ca. 1900). 쪽 = 1606 판 쪽.

| 자리 | 원문 | 영역 (Johnson) | 쓰임 |
|---|---|---|---|
| [153] 첫머리 | 「DISCORSO SOPRA L'ANDARE DI RISOLVTIONE」 · 우위를 얻은 자가 박자를 기다리다 잃는 것은 용서 못 할 잘못 — 「molto meglio sarebbe stato, hauendo il uantaggio, lo andare senza aspettare」 | 'it would have been better, having the advantage to proceed without waiting, secure that your adversary's sword cannot hit in its present line' | 비기 이름 · 덮은 채 멈추지 않음 |
| [153] | 「…in qualunque guardia … ò faccia tempo, ò non lo faccia, ò pari, ò ferisca, ò uada inanzi, ò in dietro…」(요약) | 'whether he offers a Time or not, parries or hits, advances or retires; the object is to hit him inevitably' | 상대가 무엇을 하든 |
| [155] | 「che quando la nimica si moue para essere legata dalla propria, & che una non possa andare senza essere seguita dall'altra, & in somma, che siano sempre unite」 | 'so near your adversary's sword that it appears to be bound to it when it moves … in brief so that the swords are always united' | 덮음 — 칼이 늘 붙어 있음 |
| [155]~[156] | 「quanto più uicina sarà alla lama nimica tanto meglio sarà, douendosi però guardare di toccarla niente」 | 'the nearer you are to his blade the better, taking care not to touch it' | **닿음이 아니라 가까움** — 모양 판정의 근거 |
| [156] | 「la sua sia alquanto disopra, & tale che si conosca hauerla più forte」 | 'your point is somewhat higher and stronger' | 내 강한 쪽이 상대 약한 쪽 위 |
| [156] | 「tenendo fermo il braccio andare scorrendo il filo di detta nimica sino al corpo auerso senza mai abbandonarla」 | 'Keeping your arm steady you should glide along his blade to his body, without ever leaving the blade' | **칸 오의(lore)** |
| [156] | 「con continouare sempre inanzi senza mai ritirare il braccio, & senza slanzare mai spada, ne corpo」 | 'accompanied by a continued advance, without withdrawing the arm, thrusting with violence or rushing' | 휘두르지 않고 나아감 |
| [157] 그림 풀이 | 「se nelo andare il detto nimico farà tempo si dourà pigliare … con seguire senza fermarsi sino al corpo nimico」 | 'If on your approach the adversary offers a Time, you should take it … following on to the body without stopping' | 두 번째 길(상대 박자) |

- 이름: 감독 안 그대로 **'거침없이 나아가 찌르기 (안다레 리솔루토)'** · 원어 `andare risoluto`(원전의 낱말은 'andare di risolutione' — 이 연구에서 흔히 쓰는 꼴을 원어 칸에). 판 칸(12 자)은 두 줄로 접혀 들어가고, 상세 카드는 제목이 두 줄이 되지만 넘치지 않는다(아래 §6).
- 칸 오의: **'팔을 굳게 두고 상대 칼날을 놓지 말고, 따라 미끄러져 몸까지 가라'** — [156] 원문을 옮김([원문] · 37 자). 출처 '살바토르 파브리스 『Lo Schermo』(1606) — 결연히 나아가기'(처음 '— 둘째 책 결연히 나아가기' 는 680 × 360 카드가 8 px 넘쳐 줄임). 지어낸 구절 없음.

## 2. 무엇을 만들었나 (사람만)

| 무엇 | 어떻게 | 코드 |
|---|---|---|
| 덮음 (모양) | 내 칼 **손 쪽 절반**(칼날 0 ~ 0.5) 선분 ↔ 상대 칼 **칼끝 쪽 절반**(0.5 ~ 1) 선분 가장 가까운 거리 ≤ `SECRET.risolutoCover` **0.07 m** | `src/italian_risoluto.js` `coverDist` |
| 덮인 채 나아가기 | 덮음 · 나는 안 휘두름(`school_passive.js swingingNow` + 손 휘두르기 + 막기 단추 아님) · 상대도 안 휘두름(swingingNow — AI 는 공격의 긋기 · 지나감) · 스틱 앞(상대 쪽 90° 부채꼴 `stickY > |stickX|` — fighter.js 밀치기 걸쇠와 같은 기하, 새 수 없음) · 가슴 사이가 줄어듦(지난 스텝보다 가까움) | `RisolutoWatch.tick` |
| 창 | 덮인 채 나아가기가 `SECRET.risolutoHold` **0.6 s**(사다리 0.6 이어짐) 이어지면 창 `SECRET.playerWindow` 0.6 s · 금색 '!'(strike_cue.js — 비기 창이면 저절로) · 창을 열면 셈은 0 부터 | `secret.js PlayerSecretWatch.risoTick` |
| 두 번째 길 (기본 끔) | `SECRET.risolutoBeat` 1 이면: 덮인 채 나아가기가 `risolutoBeatMin` **0.2 s**(사다리 0.2 반응) 넘게 이어지던 중 상대가 칼을 내거나(휘두름 시작) 덮음이 풀리면 곧장 창 — 내가 휘두르거나 스틱을 놓아 끝난 것은 아님 | `RisolutoWatch.tick` |
| 입력 | 창 안의 **탭(찌르기 입력)** 하나가 비기 · 끌기(베기)는 보통 베기로 나가고, 내가 베기를 시작하면 창이 닫힘 | `main.js` `secSwipe` · `schools.js ITALIAN_RISOLUTO.do.tapOnly` · `risoTick` |
| 결과 | **탭 찌르기 그대로**(`skill.js thrust` — 내딛음 · 겨눔 · 시간 · 기력은 비기 값 하나) + 찌르기가 시작될 때 **상대 두 팔 늦춤**(흘림 장치 `nagashi_recovery.js beginFlowRecovery` · `FLOW_RECOVERY` 0.4 s · 바닥 0.25 — 같은 공격에 한 번 규칙도 그대로) + 찌르는 동안 **비기 배율** `SECRET.power` 1.3(서보 힘) · `hitMul` 1.3(판정) → 끝나면 굳음 `SECRET.stiff.italian` 0.4 s. 새 힘 · 새 문턱 없음. `handSpeed` 는 손 목표 길 빠르기라 탭 찌르기엔 없음(탭 시간을 줄이면 팔이 못 따라와 덜 뻗는다 — skill.js thrust 주석의 측정) | `skill.js secret` · `updateSecret('riso')` |
| 패시브 곧은 선 | 비기에는 안 실림 — 규칙 그대로(`school_passive.js thrustTarget` 이 `skill.sec` 면 null) | 시험 |
| 사람 길만 | `schools.js playerSecretDef('italian')` = 이 비기(`SECRET.itSecret` 'risoluto') · `TRADITIONS.italian.secret` 는 옛 엇박 찌르기 그대로(AI 칸 — `aiOpenSchools` 로 닫힘) · `?itSecret=contratempo` = 사람도 옛 판 | `schools.js` · `secret.js playerSecretOf` · `skill_tree.js nodeTitle` |
| 스킬트리 I4 | '준비 중' 풀림(값 · 머리 그대로 금화 400 · 머리 20 · 앞 칸 I8) · 칸 이름 · 효과 '상대 칼을 덮은 채 걸어 들어가 찌르면, 묶인 칼을 누르고 곧게 찌른다' · lore · src | `skill_tree_data.js` · 설계 `data.mjs` I4 `closed` 뺌 |
| 주소 | `?itSecret=contratempo\|risoluto` · `?risoHold=1.5` · `?risoBeat=1` · `?risoCover=0.1` | `main.js` |

## 3. 덮음 거리 d 고르기 — 잰 장면

운전(§4 와 같은 노리는 사람 흉내 — 창 없이 걷기만) · 레이피어 · 달타냥 × 다섯 인물 × 씨앗 3 × 30 s. 나아갈 수 있던 때(둘 다 안 휘두름 · 스틱 앞 · 가슴 사이 줄어듦) 167 s 에서:

| 덮음 거리 (손 쪽 절반 ↔ 칼끝 쪽 절반) | 그때의 시간 | 그 스텝에 실제로 칼끼리 닿아 있던 몫(`feel.touching`) |
|---|---|---|
| 0 ~ 0.02 m | 1.3 s | 95 % |
| 0.02 ~ 0.03 | 1.1 | 76 |
| 0.03 ~ 0.05 | 5.3 | 90 |
| 0.05 ~ 0.07 | 3.3 | 64 |
| 0.07 ~ 0.1 | 5.2 | 56 |
| 0.1 ~ 0.15 | 6.0 | 42 |
| 0.15 ~ 0.2 | 5.4 | 49 |

- 0.05 m 안은 거의 늘 실제로 긁히는 중(76~95 %) · 0.05 ~ 0.07 은 '가깝되 닿기도 하고 떨어지기도' — 원전 [156] '닿지 않을 만큼 가까이'가 이 띠 · 0.07 너머는 닿음 몫이 바탕(칼의 다른 곳끼리 닿는 42~56 %)으로 떨어져 강한 쪽 ↔ 약한 쪽 덮음이라 부를 까닭이 없다 → **d = 0.07 m**. 이 수는 이미 있는 맞물림 기하(`ai.js checkBind` · `secret.js bladesTouch` 의 0.07 m)와 같다 — 새 문턱을 짓지 않고 그 수를 다시 씀(확인표 2191).
- d 별 덮인 채 나아가기(≥ 0.2 s): 0.03 m 5 번 · 0.05 m 14 · **0.07 m 19** · 0.1 m 29 · 0.15 m 37 / 0.6 s 넘음 0 · 2 · **2** · 4 · 7 / 1.5 s 넘음 모두 0.
- 견줌: 같은 때 실제 칼끼리 닿음(칼 어디든)이 이어진 나아가기 ≥ 0.2 s 55 번 · p50 0.28 s · 가장 김 0.86 s · 0.6 s 넘음 3 — 닿음은 덮는 쪽(강한 쪽이 약한 쪽 위)을 가르지 못하고 끊겼다 이어진다(10/11 자연 바인드 기록과 같은 꼴).

## 4. 측정 — 노리는 사람 손맛 (`tools/sim/risoluto_play.mjs`)

운전: 상대 칼끝 쪽 절반이 보이면 내 칼 손 쪽 절반을 그 위 3 cm 로 옮김(손 0.6 패드 m/s — 휘두르기 문턱 1.5 아래) · 스틱 앞으로 걸어 들어감(맞붙는 거리 clinch 에서 멈춤) · 창이 열리면 **0.25 s 뒤 탭** 하나(main.js 와 같은 차례) · 그 밖엔 치지 않음(막기 단추도 안 씀). 상대 = 인물 AI(시트 숙련도 · 성격): 이졸데 반 아커러(독일 · 롱소드) · 토메 비달(이탈리아 · 레이피어) · 오마리(이베리아 · 츠바이핸더) · 미나미(일본 · 모노호시자오) · 랴오 쓰위엔(동방 · 청강검). 무기 레이피어 · 달타냥 × 인물 다섯 × 씨앗 3 × 30 s = **30 판씩**.

| | T 0.6 · 두 번째 길 끔 (기본) | T 1.5 · 끔 | T 0.6 · 켬 | T 1.5 · 켬 | 대조: T 0.6 · 켬 · 팔 늦춤 · 비기 배율 끔 |
|---|---|---|---|---|---|
| 덮인 채 나아가기 ≥ 0.2 s (판당) | 17 (0.57) | 18 (0.60) | 17 (0.57) | 16 (0.53) | 21 (0.70) |
| 그 길이 p50 · 가장 김 | 0.37 · 0.60 s | 0.38 · 0.69 | 0.33 · 0.60 | 0.36 · 0.69 | 0.32 · 0.60 |
| 창 — 이어짐 · 상대 박자 (판당) | **2 · 0 (0.07)** | **0 · 0 (0)** | 2 · 12 (0.47) | 0 · 13 (0.43) | 2 · 9 (0.37) |
| 탭 = 리솔루토 찌르기 | 2 | 0 | 14 | 13 | 11 (보통 탭) |
| 맞힘 (상대 아픔 + 0.05) · 막힘 | 2 · 0 | 0 · 0 | 11 · 1 | 9 · 2 | 9 · 0 |
| 상대 팔 늦춤 걸림 | 2 | 0 | 14 | 13 | — |
| 준 상처 심각도 합 (찌르기 하나당) | 0.3 (0.15) | 0 | 4.9 (0.35) | 4.6 (0.35) | 2.6 (0.24) |
| 입은 심각도 합 · 내 죽음 · 상대 죽음 | 112.4 · 20 · 0 | 111.9 · 20 · 0 | 110.9 · 18 · 0 | 110.7 · 18 · 0 | 110.1 · 19 · 0 |

- 인물마다(T 0.6 · 켬): 이졸데 판당 덮인 채 나아가기 1.0~1.3 · 창 7(레이피어 4 · 달타냥 3) · 토메 1.3~1.7 · 창 6 · 오마리 0~0.3 · 창 1 · **미나미 0**(덮음이 한 번도 안 생김 — 나아갈 수 있던 때 덮음 거리 가운데값 3.1 m: 칼끼리 가까워지기 전에 들어오며 치거나 멀리 섬 · 내가 판마다 죽음) · **랴오 0**(덮음은 생기나 0.2 s 를 못 넘음).
- 덮인 채 나아가기가 끝난 까닭(T 1.5 · 끔 — 창에 끊기지 않은 판, 0 초 넘는 71 번): 덮음 풀림 26 · 가슴 사이가 안 줄어듦 17 · **맞붙는 거리에 닿음(운전이 스틱을 놓음) 17** · 상대 휘두름 시작 11 · 내 휘두름 0.
- 운전이 치지 않아 내가 많이 죽는다(30 판에 18~20) — 비기 기회를 세는 운전이지 싸움 운전이 아님. 대조(보통 탭)와 견준 찌르기 하나당 상처는 0.24 → 0.35 이나 표본이 작아(찌르기 11~14) 우연 범위.

### 왜 덮음이 오래 안 이어지나 (T 0.6 에서 거의 안 열리는 까닭)
1. **상대가 그 거리에서 곧 친다**: 덮음은 가슴 사이 2.3 ~ 1.7 m 쯤에서 생기는데 AI 는 그 거리에 들면 0.4 s 안팎에 공격을 시작한다(레이피어 대 토메 한 판 들여다보기: 덮음 4.05 s · 2.30 m 시작 → 4.49 s · 1.73 m 토메 공격 시작 — 0.44 s).
2. **걸어 들어가는 길 자체가 짧다**: 덮음이 생기는 2.3 m 에서 맞붙는 1.19 m(레이피어 clinch)까지 약 1.1 m — 상대가 서 있어도 걷는 빠르기로 1 s 남짓이라 **T 1.5 는 몸으로 닿을 수 없다**(0 번). 덮음이 맞붙는 거리까지 이어진 17 번이 '다 붙었을 때'인데 그때까지 0.6 s 를 못 채운 판이 대부분.
3. 가슴 사이 줄어듦은 스텝마다 본다 — 상대가 같이 물러서거나 몸이 맞닿아 멈추면 끊김(17 번).
4. 인물: 미나미(모노호시자오)와는 칼끼리 가까워지는 장면이 거의 없고, 랴오(청강검)와는 덮음이 생겨도 0.2 s 를 못 넘는다(덮음 풀림 · 가슴 사이 · 상대 휘두름이 고루 끊음).

### 사다리 안 다른 값 (값을 바꾸지 않음 — 보고만)
- 위 분포로 보면 T 0.2(반응)는 판당 0.57 번 · T 0.4(짧은 효과)는 그 절반쯤(덮인 채 나아가기 p50 0.33 ~ 0.38 s). 일본 고노센 손맛 기준(노리면 한 판 2~3 번)에는 어느 T 도 못 미침.
- 두 번째 길을 켜면 판당 0.43 ~ 0.47 번(맞힘 9~11 / 찌르기 13~14) — 다만 상대 공격이 이미 나가는 중이라 사람 반응(0.25 s) 뒤 탭은 상대 칼이 먼저 닿는 판이 있다(같은 판: 창 4.50 s → 토메 찌르기 4.62 · 4.67 s 내 팔 → 탭 4.75 s → 리솔루토 찌르기는 팔 · 배에 둔타).

## 5. 브라우저 그림 (`tools/browser/risoluto_shots.mjs` — `docs/handoff/risoluto/`)

| 그림 | 무엇 |
|---|---|
| `1_cover_advance.png` | 덮인 채 나아가는 중(덮음 0.032 m · 이어진 0.3 s · 가슴 사이 1.94 m) |
| `2_window_gold.png` | 이어짐 0.6 s → 창: 상대 머리 위 금색 '!' · 오른쪽 위 '거침없이 나아가 찌르기 · 안다레 리솔루토 · 내 이탈리아 · 비기' |
| `3_thrust.png` | 화면 톡(진짜 탭 입력) 뒤 찌르는 중 — 상대 팔 늦춤 남은 0.27 s |
| `4_skill_card_I4_680x360.png` | 대기실 스킬 이탈리아 I4 상세 카드(배울 수 있음 · 넘침 0) |

- 그림 1~3 은 **시연**: 상대 AI 를 그 자리 자세에 세워 두었다(`STILL_FOE=1` — 상대가 치지 않음). 운전은 측정과 같은 함수 꼴 · 탭은 진짜 입력. 싸우는 AI 로 300 s(게임 22 s — 소프트웨어 GL) 돌린 판에서는 덮인 채 나아가기 0.3 s 를 넘는 장면이 안 나왔다(측정의 드묾과 같음).
- 스킬트리 칸 넘침 점검 `tools/browser/skill_tree_layout.mjs` — 5 유파 × 6 화면 PASS(출처 줄을 줄이기 전에는 680 × 360 에서 I4 카드 +8 px).

## 6. 시험 · 관문

- `tools/sim/italian_risoluto.test.mjs`(6): 모양 덮음 거리 · 덮인 채 나아가기 셈(조건 하나라도 빠지면 0) · 두 번째 길(끔 · 켬 · 내가 끊음 · 짧은 덮음) · 사람 길만(이탈리아 무기 셋 · `?itSecret=contratempo` · AI 숙련도 5 도 비기 없음) · 실제 몸 실행(탭 하나 · 비기 기력 하나 · 상대 팔 늦춤 0.4 · 비기 배율 · 곧은 선 안 실림 · 굳음 0.4) · 창 안의 베기는 창을 닫음.
- `tools/sim/skill_tree.test.mjs`: 닫힌 칸 B7 · C9 · G10 · J8(I4 열림) · 실제 몸 I4 = 비기 칸.
- `node --test tools/sim/*.test.mjs` 182 통과 · `node tools/text/name_policy.mjs` 위반 0(사람 비기 판 이름도 모음 — `tools/text/texts.mjs`) · `npx vite build` 통과 · AI 끼리 판 바이트 같음(위).

## 7. 남은 걱정 · 다음

- **드묾**: 기본(T 0.6 · 두 번째 길 끔)은 판당 0.07 번 — 사장님 손맛 기준에 크게 못 미친다. T 1.5 는 걸어 들어가는 길보다 길어 0 번. 사장님께 여쭐 것: ① 두 번째 길을 켤지(판당 ~0.45) ② '다 붙었을 때'(덮인 채 맞붙는 거리에 닿음 — 17 번 있었음)를 창으로 삼는 길을 시험할지(새 규칙 · 새 수 없이 무기 실측 거리로) ③ T 를 사다리 0.4 로.
- 가슴 사이 줄어듦을 스텝마다 보므로 몸이 맞닿아 멈추는 순간 끊긴다(위 17 번) — '내가 나아가는 중'을 내 몸 빠르기로 볼지(상대가 물러나도 셈)는 사장님 뜻 확인 필요.
- 결과 장치(팔 늦춤 · 비기 배율)의 득은 표본이 작아 아직 우연 범위. 들어간 찌르기 다수가 둔타(관통 못 함) — 맞붙은 거리의 탭 찌르기 자체가 약한 몫.
- `?flowArm=0`(흘림 팔 늦춤 끔)은 이 비기의 팔 늦춤도 끈다(같은 장치).
- 운전은 사람 흉내일 뿐 — 실제 손가락으로 덮음을 얼마나 잘 유지하는지는 사장님 플레이로 확인 필요.
