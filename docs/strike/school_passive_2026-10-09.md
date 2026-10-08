# 유파 패시브 고유 동작 — 구현·재기 기록 (2026-10-09, 2 등급 작업자)

가지 `…/school-passive-2q36ha` (d79a5b1 위). main 푸시 없음. 지시서 `docs/strike/school_passive_design_2026-10-09.md`(디렉터 02:3x).
시계: 시작 10/9 02:40 KST → 끝 03:18 KST (38 분).

**한 줄**: 유파마다 상황이 오면 저절로 나오는 반응(`TRADITIONS[t].passives`)을 넣었다 — 독일 3(**끔**, `ai:false`) · 이탈리아 2 + 물러남 자료(Ritirata) · 이베리아 3 · 일본 3 · 중국 3. ai.js 의 지금 판단 자리 열 곳에 `passiveFor(사건)` 을 끼웠고, 그 유파에 그 사건의 패시브가 없으면 난수도 코드 길도 전과 같다 → 롱소드 관문 다섯 바이트 같음. 48 판 재기에서 **켠 12 개 모두 한 번 넘게 냈고 무너진 것(−20)은 없다** → 넷 유파 모두 켬으로 낸다. 독일 셋은 결정표(§5)만.

## 1. 구조

| 칸 | 어디 | 무엇 |
|---|---|---|
| 자료 | `src/schools.js` `GERMAN_PASSIVES`·`ITALIAN_PASSIVES`·`IBERIAN_PASSIVES`·`JAPANESE_PASSIVES`·`CHINESE_PASSIVES` → `TRADITIONS[t].passives` (무유파 `[]`) | `{ name, nameKo, when, cond?, do, p, src, ai? }` — `when` 은 사건 하나 또는 목록, `cond` 는 사건 안 조건(`thrust`·`cut`·`line`·`myThrust`) |
| 목록 | `src/ai.js` 생성자 `this.passives` | 이 AI 유파(`this.art.tradition`)의 passives 가운데 `ai !== false` (SKILL.schoolArt 1 일 때). 꾸러미(pack)에는 들어가지 않는다 — 꾸러미 열쇠는 그대로 |
| 찾기 | `passiveFor(사건, ctx)` | 목록에서 when·cond 가 맞는 첫 것, 없으면 null(난수 없음) |
| 굴림 | `passiveRoll(P)` | `Math.random() < p × (0.5 + 0.5 × L.read)` — 사건마다 한 번 |
| 하기 | `passiveGo`(prefer·tech·chain·feint) · `passiveThreat`(counter·parry·void) · afterStrike 안 withdraw · startWithdraw 안 withdraw/at:'end' | tech·chain 은 지금 손에서 곧장(skipChamber·fastChamber·noFeint). 이름이 목록이면 손에서 가까운 것(`far` 면 먼 것), 꾸러미에 없으면 `alt`, 그것도 없으면 건너뜀(`stats.passiveSkipped`) |
| 재기 | `stats.passives[이름]`(낸 수) · `stats.passiveRolls[이름]`(굴린 수) · `stats.passiveSkipped` | 처음 쓸 때 만든다(통계 객체 모양은 패시브 없는 AI 에서 전과 같다) |
| 도구 | `tools/sim/motion_lab.mjs` duel | `SCHOOL_PASSIVE=off\|all\|이름,…`(시험 쪽 X 만) · `SCHOOL_PASSIVE_GERMAN=1`(독일 셋을 X 만 켬 — 상대 롱소드 AI 는 그대로) · `SCHOOL_RITIRATA=0`(이탈리아 물러남 자세를 전 값으로) · 셋째 줄에 `패시브 [목록]: 이름 낸 수/굴린 수` |

### 발동 자리 (ai.js, 이 가지의 줄 번호)
| 사건 | 자리 | 줄 | 한 번의 기준 |
|---|---|---|---|
| `landed`·`parried`·`missed` | `afterStrike()` 이어 치기 굴림 앞 | 1014~1031 | afterStrike 한 번 부름 (`hitLanded` → landed, `bound` → parried, 그 밖 missed). tech·chain 은 `canChain`(거리·차례) 안에서만 |
| `threat` | `respond()` guardChance 굴림 뒤, Indes 굴림 앞 | 1210~1213 | threatSeen 번호 (respond 가 위협마다 한 번만 지난다) |
| `foeRaise`·`foeCharge` | `preThreat()` guardChance 굴림 뒤 | 1348~1354 | preArmed 걸쇠 (몰아침 한 번에 한 번) |
| `foeRecover` | `seize()` 굴림 앞 | 719~721 | seize 굴림과 같은 박자 — 지금 목록엔 이 사건의 패시브가 없다(자리만) |
| `bindDef` | `defend()` checkBind 뒤, flowRiposte 앞 → `passiveBindDef` | 1245~1247 | 막기 한 번(respond 가 `defBindSeen` 을 끈다)의 처음 맞닿음 (checkBind 와 같은 기하 0.07 m) |
| `foeStepIn` | `watch()` 판단 박자 → `passiveWatch` | 513 | 기회 종류가 'stepin' 인 동안 한 번 (`stepinArmed`) |
| `standoff` | `watch()` 판단 박자 → `passiveWatch` | 513 | 위협 없음 > 2 s · 상대 손 < 1 m/s · d < holdDist + 0.3 이 이어지는 동안 한 번 (`standoffArmed`, 공격을 시작하면 다시 걸림) |
| `pressed` | `startWithdraw()` 몰린 물러남 가지(foeAggro > 0.3 굴림이 pressed 를 고른 때) | 1131~1143 | startWithdraw 한 번. 패시브가 낸 공격 끝의 물러남엔 같은 패시브를 다시 굴리지 않는다(`passiveAtk`) |
| `pressed` at:'end' | `withdraw()` 끝(간 보기로 돌아가는 순간) | 1160~1170 | 굴림은 startWithdraw 에서. 막기·되물러남이 끼어도 남고, 공격을 시작하면 지워진다 |

- `prefer` 는 `pickTech(s, why, prefer)` 의 그 한 번만 곱한다(`thrust`·`fast`·`presses`). prefer 를 안 주면 전과 같은 셈.
- `counter` 는 그 respond 부름의 맞받아치기 목록을 바꾸고 Indes 굴림 없이 곧장 친다. 준비 자세 거리 규칙(`counterTech` 0.3 m)은 그대로 — 멀면 보통 판단으로 돌아간다.
- `withdraw` 는 이름으로 자세를 고른다. 꾸러미 간 보는 자세에 없으면 바탕 `WATCH_GUARDS` 의 그 자세를 빌린다(`passiveGuard`) — **일본 높은 자세 목록에 긴 자세(langort)가 없어** 残心은 이 빌림을 쓴다. 이탈리아 Ritirata 의 `langort` 는 레이피어 간 보는 자세(WATCH_GUARDS)에 있어 빌림이 필요 없다.
- 결정성: 새 `Math.random()` 은 모두 `passiveRoll` 하나이고, `passiveFor` 가 패시브를 돌려줄 때만 부른다. 있던 굴림의 차례는 바꾸지 않았다(startWithdraw 의 두 굴림은 같은 단락 평가 그대로 변수로만 뺐다).

## 2. 지시서와 다르게 정한 것 (해석)
1. **contratempo 의 기술 고르기 셈**: 지시서 `why: 'stop'` 그대로 공격 까닭은 stop(조금 일찍 치고 내딛지 않음)이지만, pickTech 의 'stop' 셈은 찌르기를 0.3 으로 깎아 ×3 을 곱해도 0.9 — 무거운 베기를 고른다(뜻과 반대). 그래서 prefer 패시브의 고르기 셈은 'windup'(짧은 순간 — 빠른 기술 ×1.6)으로 했다.
2. **cavazione 의 "반대쪽"**: stichPflug·stichPflugL 가운데 지금 손에서 **먼** 쪽(`far: true`).
3. **Duplieren 의 zwerch**: zwerch·zwerchL 가운데 손에서 가까운 쪽. 이베리아 돌려 물러남·중국 斂翅·看守도 같다.
4. **이어 돌기 "흐름이 이미 있으면 1"**: 하지 않았다 — AI 의 흐름(flowOn)은 SKILL.flow 가 검술 층 update 안에서만 켜져 AI 판단엔 닿지 않는다. p 0.9 그대로.
5. **刺→擊 고리 fallback**: 지시서대로 `alt: 'zwerch'`(yaoji 가 없을 때). 청강검 꾸러미엔 yaoji 가 있다.
6. **斂翅 pending**: 처음엔 물러남마다 지웠더니 48 판에 0 번(굴림 30 번 — 몰아치는 상대라 물러나는 도중 막기가 늘 끼었다). 막기·되물러남에도 남기고 공격을 시작할 때만 지우게 고쳤다 → 1 번. 청강검이 판마다 빨리 지는 쪽이라 물러남 끝까지 가는 일이 드물다.
7. **이름 겹침**: 패시브 `duplieren`(독일)·`cavazione`(이탈리아)·`lianchi`(중국)는 같은 이름의 고유 동작(unique)과 따로 있는 목록이다(손잡이도 따로 — `SCHOOL_UNIQUE` / `SCHOOL_PASSIVE`).

## 3. 재기 (48 판 = `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main`, 같은 씨앗, 상대 = 롱소드 AI)

읽기: 48 판 띠 ±14. 발동 0 = 자리나 조건이 틀림. 몰리넬로처럼 −20 넘게 무너지면 끔. 작게 오르내리는 것은 "소음 폭 안".
발동 칸 = 낸 수 / 굴린 수 (48 판 합). 기준 줄(`SCHOOL_PASSIVE=off`)이 고유 동작 기록(school_unique §3)의 수와 같은지 먼저 봤다.

| 무기 · 유파 | 줄 | 승 / 패 / 무 | 승률 (95 % 띠) | 발동 (낸 / 굴림) | 읽기 |
|---|---|---|---|---|---|
| 롱소드 · 독일 | 기준 (끔 = 기본) | 21 / 23 / 4 | 44 % (31~58) | — | 고유 동작 기록 21/23/4 와 같음 |
| | 독일 셋 (`SCHOOL_PASSIVE_GERMAN=1`) | 21 / 23 / 4 | 44 % (31~58) | absetzen 0/5 · duplieren 26/61 · ueberlaufen 9/154 | 같음 |
| | absetzen 혼자 | 20 / 24 / 4 | 42 % (29~56) | 0/7 | **발동 0** — §4 |
| | duplieren 혼자 | 21 / 20 / 7 | 44 % (31~58) | 29/63 | 소음 폭 안 (패 −3) |
| | ueberlaufen 혼자 | 19 / 26 / 3 | 40 % (27~54) | 7/174 | 소음 폭 안 (−2), 굴려 나와도 거의 못 냄 — §4 |
| 레이피어 · 이탈리아 | 전 기준 (`SCHOOL_RITIRATA=0`, 패시브 끔) | 22 / 22 / 4 | 46 % (33~60) | — | 고유 동작 기록 22/22/4 와 같음 |
| | Ritirata 만 (새 기준 = 패시브 끔) | 23 / 19 / 6 | 48 % (34~62) | — | 소음 폭 안 (+1) |
| | 패시브 둘 + Ritirata | **26 / 19 / 3** | 54 % (40~67) | contratempo 47/69 · cavazione 55/159 | +3 (전 기준 +4) 소음 폭 안 |
| | contratempo 혼자 | 20 / 24 / 4 | 42 % (29~56) | 45/69 | −3 소음 폭 안 |
| | cavazione 혼자 | 25 / 20 / 3 | 52 % (38~66) | 49/157 | +2 소음 폭 안 |
| 츠바이핸더 · 이베리아 | 기준 | 13 / 25 / 10 | 27 % (17~41) | — | 고유 동작 기록과 같음 |
| | 셋 | **16 / 23 / 9** | 33 % (22~47) | talhoParry 36/312 · seguirRoda 205/340 · rodaRetirada 0/10 | +3 소음 폭 안 |
| | talhoParry 혼자 | 16 / 24 / 8 | 33 % (22~47) | 37/298 | +3 |
| | seguirRoda 혼자 | 10 / 28 / 10 | 21 % (12~34) | 221/347 | −3 소음 폭 안 (가장 자주 남 — 뒤에 볼 것) |
| | rodaRetirada 혼자 | 12 / 23 / 13 | 25 % (15~39) | 1/17 | −1, 드묾(몰린 물러남 자체가 드묾) |
| 모노호시자오 · 일본 | 기준 | 26 / 21 / 1 | 54 % (40~67) | — | 고유 동작 기록과 같음 |
| | 셋 | 26 / 21 / 1 | 54 % (40~67) | zanshin 82/98 · debana 21/22 · kaeshi 34/64 | 같은 수(판 내용은 다름) |
| | zanshin 혼자 | 28 / 19 / 1 | 58 % (44~71) | 75/88 | +2 |
| | debana 혼자 | 25 / 21 / 2 | 52 % (38~66) | 19/23 | −1 |
| | kaeshi 혼자 | 21 / 26 / 1 | 44 % (31~58) | 34/59 | −5 소음 폭 안 |
| 청강검 · 중국 | 기준 | 0 / 40 / 8 | 0 % (0~7) | — | 고유 동작 기록과 같음(바닥) |
| | 셋 | 0 / 37 / 11 | 0 % (0~7) | lianchi 1/26 · ciji 12/20 · kanshou 13/39 | 바닥 그대로, 무 +3 |
| | lianchi 혼자 | 0 / 40 / 8 | 0 % (0~7) | 1/27 | 드묾 (§2-6) |
| | ciji 혼자 | 0 / 38 / 10 | 0 % (0~7) | 19/28 | 바닥 |
| | kanshou 혼자 | 0 / 36 / 12 | 0 % (0~7) | 10/33 | 바닥 |

## 4. 켬 / 끔
- **켬 (기본)**: 이탈리아 contratempo·cavazione + Ritirata 자료 · 이베리아 talhoParry·seguirRoda·rodaRetirada · 일본 zanshin·debana·kaeshi · 중국 lianchi·ciji·kanshou — 12 개 모두 한 번 넘게 냈고 −20 무너짐 없음. 유파 셋 모두 켠 줄이 기준보다 같거나 높다(레이피어 +4 · 츠바이핸더 +3 · 모노호시자오 0 · 청강검 0).
- **끔**: 독일 셋(`ai:false`, 롱소드 AI = 사장님 주 상대) — 결정표 §5.
- **맞받아치기 꼴(counter)은 잘 안 나온다**: 굴려 나온 뒤 맞받아칠 기술의 준비 자세가 손에서 멀다(`counterTech` 0.3 m 규칙). 진단(커밋 안 함, 롱소드 12 판): 굴려 나온 21 번 가운데 간격 밖 7 · 준비 자세 멂 12(손에서 지붕까지 중앙 0.49 m) · 됨 2. talhoParry 36/312·ueberlaufen 9/154·absetzen 0 이 같은 까닭. 규칙을 넓히는 것(패시브만 0.5 m 등)은 새 문턱이라 하지 않았다 — 사장님·디렉터 결정 후보.
- seguirRoda 는 가장 자주 나는 패시브(판마다 4~5 번)인데 혼자 켜면 −3 이다. 소음 폭 안이라 켬으로 두되, 셋을 같이 켜면 +3 이라 조합이 낫다.

## 5. 독일 결정표 (사장님 아침 결정용 — 기본 끔)

| 패시브 | p | 혼자 켬 (기준 21/23/4) | 발동 | 디렉터·작업자 의견 |
|---|---|---|---|---|
| Absetzen 받아 찌르기 (`threat` 찌르기 → stichPflug·stichOchs) | 0.7 | 20 / 24 / 4 | 0/7 | 발동 0 — 롱소드 상대는 찌르기가 드물고(48 판 7 번), 나와도 쟁기·황소 자리가 손에서 멀다. 켜도 판이 바뀌지 않는다 → **끔 유지** 또는 counter 거리 규칙을 같이 정할 때 다시 |
| Duplieren 겹치기 (`parried` → zwerch/zwerchL) | 0.6 | 21 / 20 / 7 | 29/63 | 판마다 0.6 번. 승 그대로·패 −3·무 +3 — 소음 폭 안. 켤 수 있음 |
| Überlaufen 넘어 치기 (`threat` lowL/lowR → oberhau·zornhau) | 0.6 | 19 / 26 / 3 | 7/174 | 굴림은 많고 낸 것은 적다(지붕이 손에서 멂). −2 소음 폭 안 |
| 셋 같이 | — | 21 / 23 / 4 | 0·26·9 | 판 수가 기준과 같다 — 켜도 끄도 롱소드 상대 체감은 Duplieren 정도 |

켜는 법: `schools.js GERMAN_PASSIVES` 에서 그 줄의 `ai: false` 를 지운다(상대 AI 도 롱소드라 양쪽이 같이 바뀐다 — 재는 것은 `SCHOOL_PASSIVE_GERMAN=1` 로 시험 쪽만).

## 6. 관문 (독일 끔 기본)
| 관문 | 기대 | 결과 |
|---|---|---|
| `node tools/sim/fights12.mjs` | `578402e1` | `578402e1` |
| `node tools/sim/live_battery.mjs` | `c2072cd1` | `c2072cd1` |
| `node tools/sim/finish_thrust.mjs 1 --stand` | `d65cc1df` | `d65cc1df` |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | IDENTICAL 12/12 |
| `node tools/sim/weapon_smoke.mjs` | OK 16/16 | OK 16/16 (출력은 달라짐 — 레이피어·츠바이핸더·모노호시자오·청강검 기본 AI 가 패시브를 쓴다) |
| `npx vite build` | 됨 | 됨 |
| `motion_lab duel longsword 24 main` (기본) | 21/23/4 | 21/23/4 |

## 7. 남은 것
- 맞받아치기 꼴 패시브의 준비 자세 거리(0.3 m)를 패시브에만 넓힐지 — 새 문턱이라 결정 후보로만(§4).
- 이어 돌기 "흐름이 있으면 1" 은 AI 흐름이 판단에 닿지 않아 안 했다(§2-4).
- foeRecover·parry·void·feint 꼴은 자리·실행만 있고 지금 목록에 쓰는 패시브가 없다(시험 안 됨).
- 斂翅·돌려 물러남은 드물다(48 판 1 번) — 몰린 물러남이 끝까지 가는 일이 적다.
- p 값은 모두 사장님 확인 전(확인표 220~236).
- 시계: 시작 02:40 KST · 끝 03:18 KST · 38 분.
