# 막기 연환 — 중국 '연환' · 독일 '감아 들기 (Indes)' (10/11)

가지 `…/parry-combo-2q36ha` · 바탕 main `dfcdc70` · 커밋 `ae9e9b2`(공통 장치 + 중국) · `8ff0d37`(독일 켬) · 이 기록. 값은 모두 **사장님 확인 전** (확인표 891~898).

## 1. 컨셉

사장님 10/11 18:3x (원문): "중국 안2로 가자. 거정세나 표두세 막기가 성공하면 n초 이내로 커맨드 입력 시 빠른 연환 공격.(모든 막기에 터지면 너무 자주임. 연격에 적합한 특정 자세로 막을 때 발동해야 자연스러움) 세 수가 너무 길어서 어색하면 막기 1수로 치고 2연격 나가게. 중국과 독일 이런 컨셉으로 가자."
19:0x: "일본이베리아가 미묘한 비슷한 원리이지만 컨셉 차가 있는 것처럼 독일중국도 그래야 함" · 19:1x(독일): "두 수면 너무 비슷하니까 한 수로. 몇 초(0.n초?) 이상 붙어있으면 붙어있는 한 계속 발동 가능, 오래 붙어 있었을 수록 깊고 강한 공격?"

공통 원리 = **유파가 정한 자세로 한 막기가 성공하면, 짧은 기회 안의 공격 입력 하나(AI 는 곧장)가 그 막기를 첫 수로 친 비기.** 아무 막기에나 터지지 않고(정한 자세만), 놓치면 보통 공격, 내면 끝에 경직(SECRET.stiff 0.5 s — 그대로).

| | 독일 — 붙어서 이긴다 | 중국 — 쳐 내고 흘려 연달아 |
|---|---|---|
| 원리 말 | Fühlen · Indes (맞붙은 그 사이) | 格 → 連擊 · 「滾手連環」 |
| 정한 막기 | 황소 걸이(highR, G.ochsR) · 왼 걸이(highL, [−0.3, 0.1]) | 거정세(highC — 머리 위 가로 든 칼) · 표두세(highR — 칼을 세운 자리) |
| 조건 | 막기 뒤 칼이 **맞붙은 채** deBindMin 0.3 s 이어짐 | 막은 칼을 쳐 내어 **칼이 갈라짐** |
| 창 | **붙어 있는 동안 계속** (떨어지면 닫힘) | 갈라진 순간부터 **playerWindow 0.5 s** |
| 동작 | **한 수** — 받은 칼을 타고 감아 듦 (황소 → Duplieren · 왼 걸이 → Mutieren) | **두 수** — 반걸음씩(進步) 빈 곳으로 빠르게 |
| 어드밴티지 | **붙은 시간만큼 강해짐** — 판정 배율·힘 창 × 1 → 1.4 (붙음 1.0 s 에 최대, 화면 다섯 칸 차오름) | 빠르기·걸음 — 이음새 고리 없이 앞 수 끝에서 곧장 |
| 표시 이름 | 감아 들기 (Indes) | 연환 (連環) |

## 2. 원전 근거

**중국** (무비지 국역 쪽/원서 쪽 — `docs/motion/schools/choseon_sebeop.md`)
- 擧鼎勢 「卽擧鼎格, 法能鼎格上殺 … 向前掣擊中殺」 쪽154/0568 [원문] — 솥 들듯 올려 막고(格) 앞으로 당겨 베어(掣擊) 가운데를 친다 → 첫 수 **요격(腰擊)** (中殺 = 가운데·허리 [해석]).
- 腰擊勢 「向前進步逆鱗」 쪽166/0580 [원문] → 둘째 수 **역린자(逆鱗刺)** (腰擊 끝 왼쪽에서 목을 올려 찌름 — 길 [추정]).
- 豹頭勢 「… 寃步挑刺」 쪽157/0571 [원문] — 높이 든 칼에서 올려 찌름 = **역린자** [해석] → 逆鱗勢 「掣步左翼擊」 쪽173/0587 [원문] → **좌익격(左翼擊)**.
- 검결가 「滾手連環」 쪽151 [원문] — 연달아 굴려 잇는 이름.
- 쳐 낸 뒤 '갈라짐'을 조건으로 둔 것: 格(쳐서 막음)과 掣(당겨 뗌) 뒤에 치는 차례 [해석].

**독일** (Ringeck 주해 영역 — thearma.org Ringeck 영역(1389~1440 주해), Wiktenauer Duplieren 항목)
- Vor·Nach: "make the displacement simultaneously (Indes) and from the bind strike immediately at his nearest opening" [원전 2차 영역] — 맞붙음에서 곧장.
- Duplieren: "… immediately thrust the pommel of your sword under your right arm … strike him behind his blade" [원전 2차 영역] · Meyer: 맞붙은 칼을 떼지 않고 곧장 다른 쪽으로 [원전 2차].
- Mutieren: "wind the short edge at his sword, raise your arms and thrust at the lower opening from the outside along his blade" [원전 2차 영역].
- 걸이 = 황소: 원문에서 '황소로 받아 감는다'는 말은 찾지 못했다(Ringeck 영역에 Hengen 은 목록뿐). 맞붙음이 생기는 높은 걸이 막기를 지금 독일 막기 자리에서 고른 것이 황소 둘 [해석]. 왕관(Kron — 「this displacement is called "the crown". From there you can rush in」)은 원문이 가장 가까우나 AI 막기 자리가 아니라(덮는 자세) 고르지 않음 — 여쭐 것 3.
- 자리별 한 수 표(오른 황소 → Duplieren 위 빈틈 · 왼 걸이 → Mutieren 아래 빈틈)와 길의 수 [추정].

## 3. 조건 (AI·플레이어 같은 뜻 — secret.js parrySlotOf · PlayerSecretWatch.parryTick · ai.js parryCombo)

- **막기 성공**: 막는 동안 칼끼리 새로 맞닿음(bladesTouch — fighter.feel.touching 또는 checkBind 기하 0.07 m) + 그 막기에서 내 몸 상처 없음.
  - AI: 막기(defend, 피하기 아님)에 든 뒤 처음 맞닿은 스텝, 막기에 든 때부터 상처 수가 늘지 않음.
  - 플레이어(막기 모드가 없음): 휘두르거나 찌르지 않는 동안, 상대 칼끝이 지난 0.6 s 안에 3.5 m/s 넘게 들어오던 중 새 맞닿음, 그 0.6 s 안 내 상처 없음 (3.5 = threatNow 칼끝 하한 · 0.6 = 일본 헛침 셈 span — 새 값 아님).
- **정한 자세**: 손 패드가 그 자리 패드(꾸러미 parry[줄]) 0.15 안 (v5·v6 '이미 그 자세' 판정 폭). AI 는 막은 줄(defLine)이 정한 줄이어야. 플레이어는 가장 가까운 정한 자리 — 중국 거정세·표두세는 패드가 같아(G.tag) 그때 들어오던 칼의 줄(highC → 거정 · 그 밖 → 표두)로 고른다.
- 기다리는 동안(중국 갈라짐 · 독일 0.3 s 붙음) AI 는 맞닿음에 거는 버릇(bindDef)·흐름 되받기를 걸지 않는다 — 막기 연환이 그 자리를 맡음. 상처가 나면 없던 일.

## 4. 동작

`do.combo[자리].seq` — 연환삼격 seq 꼴, `pre: []`(이음새 고리 없음). 실행은 AI secretGo·플레이어 skill.secret 의 같은 흐름(flowInto · secretNextMove). 결정타 SECRET.hitMul 1.3 · 손 빠르기 handSpeed 1.5 · 힘 창 power 1.3 · 경직 0.5 s 그대로. 중국 수마다 반걸음 chineseStep 0.25.

빠르기 (`node tools/sim/parry_combo_probe.mjs` — AI 가 서 있는 롱소드 몸 앞에서 직접 냄, 씨앗 6 가운데 낸 3):

| | 수 | 칼끝 최고 m/s | 낸 때부터 끝 s |
|---|---|---|---|
| 중국 거정 | 요격 · 역린자 | 12.3 · 9.4 | 0.14 · 0.49 |
| 중국 표두 | 역린자 · 좌익격 | 7.1 · 12.7 | 0.07 · 0.41 |
| 청강검 보통 | yaoji · stichOchs · zuoyi · zwerch | 14.4 · 11.3 · 12.2 · 20.6 | 0.73 · 0.51 · 0.48 · 0.80 |
| 독일 황소 → Duplieren | (붙은 0 · 0.7 s) | 17.8 · 17.7 | 0.40 · 0.38 |
| 독일 왼 걸이 → Mutieren | | 17.1 | 0.40 |
| 롱소드 보통 | zornhau · stichPflug | 18.0 · 16.0 | 0.83 · 0.38 |

- **시간으로는 빠르다**: 중국 두 수가 0.41~0.49 s 에 끝남 — 보통 한 수(준비 포함 0.48~0.73 s)와 같거나 짧다.
- **칼끝 최고는 보통 베기보다 낮다**: 첫 수가 0.07~0.14 s 에 닿아 멈춰 칼끝이 다 오르기 전 (가까운 자리에서 곧장 치는 꼴). 사장님 10/9 '훨씬 빨라야' 원칙을 칼끝 빠르기로 보면 못 미침 — 여쭐 것 4.
- 독일 붙은 시간 어드밴티지는 빠르기를 올리지 않는다(서보 포화) — 판정 배율·힘 창만.

## 5. 48 판 전/후 (`node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main` · 전 = dfcdc70 · 상대 롱소드 AI)

| 무기 | 승률 전 → 후 | 막기 성공 | 정한 자세 | 창 | 낸 | 맞힘 | 비기 경직·뒤 1 s 맞은 상처 (전 → 후) | 전 비기 낸/맞힘 |
|---|---|---|---|---|---|---|---|---|
| 청강검 (중국) | 46 → 42 % | 20 | 2 | 1 | 1 | 1 | 12+33 → 2+2 | 32 / 23 |
| 간장 (중국) | 54 → 48 % | 44 | 6 | 5 | 2 | 1 | 21+34 → 2+2 | 35 / 28 |
| 에스톡 (독일) | 46 → 52 % | 36 | 7 | 1 | 0 | 0 | 18+110 → 0+0 | 79 / 27 |
| 세이버 (독일) | 50 → 50 % | 28 | 6 | 0 | 0 | 0 | 6+69 → 0+0 | 49 / 4 |
| 롱소드 (독일 대 독일) | 42 → 42 % | 26 | 2 | 0 | 0 | 0 | 17+67 → 0+0 | 49 / 9 |

- 모두 95 % 띠 안. **승률을 보고 고른 값은 없다.** 독일 무기와 롱소드 줄은 상대 롱소드 AI(독일)도 함께 바뀐다(옛 Versetzen 이 빠짐).
- 중국 창이 '정한 자세'보다 적은 것: 맞닿은 뒤 갈라지기 전에 막기(defend)가 끝나거나 거리 밖 — 낸 수가 창보다 적은 것은 거리(흐름 되받기 창 reach + 0.25) 밖.
- **AI 는 거의 내지 않는다** — 정한 줄로 막아 칼이 그 자리에서 맞닿는 일이 드물다(청강검 판마다 0.04). 사장님 '아무 때나 터지지 않음'에는 맞으나 AI 비기로는 거의 보이지 않음 — 여쭐 것 2.
- 독일 정한 자세 맞닿음 길이(창 전에 떨어진 것): 에스톡 p50 0.01 · p90 0.09 s, 세이버 p50 0.01 · p75 0.18 s, 간장(중국, 갈라지기까지) p50 0.00 · p90 0.15 s — **AI 끼리는 맞붙음이 0.3 s 를 거의 못 넘는다.**

## 6. 플레이어 확인 (브라우저 — `tools/browser/parry_combo_probe.mjs`, preview 4197 · 상대 롱소드 AI 살아 있음 · 콘솔 에러 0)

대본: 손가락을 댄 채 손을 패드에 두고 버팀(slot = 정한 자리 · other = 정한 자리 아님) · press = 맞붙어 0.35 s 마다 좌우 휘두르기. 창이 열리면 **0.25 s 뒤**(사람이 보고 누르기 [추정]) 창이 남아 있으면 냄(main.js 와 같은 함수 fire → skill.secret).

| 무기 · 대본 | 시간 s | 막기 성공 | 정한 자세 | 창 | 낸 | 맞힘 | 놓침 | 막기 맞닿음 길이 |
|---|---|---|---|---|---|---|---|---|
| 청강검 · slot (G.tag) | 35 | 6 | 6 | 2 | 2 | 1 | 0 | p50 0.01 · 최대 0.04 s |
| 청강검 · other (긴 자세) | 33 | 33 | 0 | **0** | 0 | 0 | 0 | p50 0.02 · p90 0.26 · 최대 0.97 s |
| 청강검 · press | 36 (휘두르기 1153) | 3 | 0 | **0** | 0 | 0 | 0 | 최대 0.28 s |
| 롱소드 · slot (황소) | 20 | 4 | 4 | **0** | 0 | 0 | 0 | p50 0.03 · 최대 0.03 s |
| 롱소드 · other (쟁기) | 23 | 7 | 0 | 0 | 0 | 0 | 0 | p50 0.02 · p90 0.68 s |
| 롱소드 · press | 15 (휘두르기 261) | 0 | 0 | 0 | 0 | 0 | 0 | — |

- ① 중국 거정세 꼴(G.tag)로 막아 낸 뒤 창(표시 '연환 連環 · 내 중국 · 비기') → 0.25 s 뒤 입력 → 두 수: 거정 → 요격 13.6 · 역린자 16.2 m/s, 표두 → 역린자 5.4 · 좌익격 14.2 m/s. 창 0.5 s 안에 0.25 s 반응으로 모두 냄(놓침 0) → **n = playerWindow 0.5 s 그대로**(iberianWindow 1.5 로 늘릴 까닭 없음).
- ② 다른 꼴(긴 자세)로 막으면 33 번 막아도 창 0. ③ 계속 휘두르기 1153 번에 창 0 — 자주 안 터짐.
- ④ 독일: 황소로 4 번 막았으나 맞붙음이 최대 0.03 s — **deBindMin 0.3 s 에 닿지 않아 창 0**. 장치 확인만 하려고 그 판에서 deBindMin 0 으로(값 아님, `DEMO_MIN=0`) 돌리면 창 → Duplieren 한 수가 나간다(그림 `pcombo_longsword_demo_min0.png`).
- 그림: `docs/handoff/parry_combo/pcombo_qinggang_slot_1.png`(막기 → 창 '연환') · `_2.png`(연격 둘째 수 역린자) · `pcombo_longsword_demo_min0.png`(독일 장치 — 값 아닌 판).
- 진동은 창마다 부른다(다른 비기 창과 같은 줄 — main.js updateTechCue). 탐침의 진동 수는 맞음 진동이 섞여 따로 세지 않았다.

## 7. 관문

| 관문 | 기대 | 중국 커밋 ae9e9b2 | 독일 커밋 8ff0d37 | 독일만 옛 판(SECRET.deSecret=v1) |
|---|---|---|---|---|
| fights12 | cc4e62b1 | cc4e62b1 ✓ | **d666c902** (새 기준) | cc4e62b1 ✓ |
| live_battery | e7ee3d96 | e7ee3d96 ✓ | e7ee3d96 ✓ | e7ee3d96 ✓ |
| finish_thrust 1 --stand | 433ac984 | ✓ | ✓ | — |
| corr_s0 --limits=on,off --scenes=a,b | IDENTICAL 12/12 | ✓ | ✓ | — |
| weapon_smoke | OK 21/21 | ✓ | ✓ | — |
| vite build · name_policy | 0 · 위반 0 | ✓ | ✓ | — |
| duel 24 main 츠바이핸더 · 모노호시자오 · 레이피어 | d8eec475 · 4304b1f5 · ca7ce481 | 같음 ✓ | 65e59eb5 · 776427a7 · 09c8f971 (상대 롱소드 AI 의 독일 비기가 바뀜) | d8eec475 · 4304b1f5 · ca7ce481 ✓ |
| duel 에스톡 · 세이버 · 롱소드 | 16e2d20d · e1659bd5 · 86029ced | 같음 ✓ | 6a5ff887 · f5f381e8 · bf1ca122 | 같음 ✓ |
| duel 청강검 | e2e4294a | 512ddf29 (중국 비기) · `cnSecret=v1` 이면 e2e4294a ✓ | bc0ba3a5 | — |

- fights12 와 이베리아·일본·이탈리아 duel 이 독일 커밋에서 바뀐 까닭은 **상대(롱소드 AI, 독일)의 비기뿐**: 독일 비기만 옛 판으로 돌리면 모두 기대값으로 돌아온다. live_battery 는 바뀌지 않았다.

## 8. 바뀐 파일

| 파일 | 무엇 |
|---|---|
| `src/schools.js` | CHINESE_SECRET_PARRY · GERMAN_SECRET_PARRY · 중국·독일 secret 게터(cnSecret·deSecret) |
| `src/config.js` | SECRET.cnSecret · deSecret · deBindMin · deBindFull · deBindGain |
| `src/secret.js` | parrySlotOf · bindGain · foeRecentTipSp · PlayerSecretWatch.parryTick (막기 성공 · 정한 자세 · 창 · 재기 pc) |
| `src/ai.js` | parryComboReset · parryCombo · parryComboGo (defend 안, 버릇보다 먼저) · secretGo combo 갈래 · 힘 창·판정 배율 × run.gain |
| `src/skill.js` | 플레이어 secret combo 갈래 · × run.gain |
| `src/main.js` | `?cnSecret=` · `?deSecret=` · 독일 창 차오름(다섯 칸) |
| `src/test_pick.js` · `test.html` | 중국·독일 비기 고르기 (이베리아와 같은 꼴) |
| `tools/sim/motion_lab.mjs` | '막기 연환' 줄 (비기가 막기 연환일 때만 찍음 — 다른 무기 출력 바이트 그대로) |
| `tools/sim/parry_combo_probe.mjs` · `tools/browser/parry_combo_probe.mjs` | 빠르기 · 플레이어 확인 |

## 9. 사장님께 여쭐 것

1. **독일 '붙어 있는 동안'이 지금 물리에서는 거의 생기지 않는다.** 황소로 받은 맞닿음이 AI 끼리 p90 0.09~0.18 s, 브라우저 최대 0.03 s — 상대 칼이 맞고 튕겨 나가거나 미끄러져 지나간다(상대 AI 는 베기를 끝까지 휘두르고, 누르며 버티는 바인드를 만들지 않는다). deBindMin 0.3 s 로는 창이 열리지 않는다. 고를 길: (가) 상대 AI 가 막히면 칼을 누르며 버티는 바인드(Ringeck 'remains strong at the sword')를 따로 만든다(AI 동작 일 — 별도 작업) · (나) 창을 '맞닿은 순간부터 playerWindow 0.5 s'로(붙음 조건은 '맞닿음'으로 낮아져 중국과 컨셉 차가 줄어든다) · (다) 독일은 옛 Versetzen 으로 두고 다시 설계.
2. **AI 가 막기 연환을 거의 내지 않는다** (중국 48 판 1~2 번 · 독일 0). 정한 줄로 막고 손이 그 자리에서 맞닿는 일이 드물다. 플레이어가 노리는 기술로는 맞으나, AI 비기가 보이지 않아도 되는지.
3. 독일 정한 막기 = 황소 둘([해석]). 원문이 가장 분명한 '받아 곧장'은 왕관(Kron — Ringeck 「this displacement is called "the crown". From there you can rush in」)인데 지금 AI 막기 자리가 아니다(덮는 자세). 왕관을 막기 자리(highC)로 넣을지.
4. 비기 빠르기: 막기 연환은 시간으로는 빠르나(두 수 0.41~0.49 s) 칼끝 최고는 보통 베기보다 낮다(가까이서 곧장 닿음). 칼끝을 더 올려야 하는지.
5. 중국 창 0.5 s(확인표 892) · 독일 deBindMin 0.3 · deBindFull 1.0 · deBindGain 1.4(895·896).
