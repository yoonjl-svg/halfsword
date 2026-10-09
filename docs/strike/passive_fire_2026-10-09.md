# 패시브 확정 · 독일 재편 · 고유 동작 상황 선호 (2026-10-09, 2 등급 작업자)

가지 `…/passive-fire-2q36ha` (83fae62 위). main 푸시 없음. 지시: 디렉터 10/9 13:2x (사장님 10/9 12:5x 실제로 해 본 뒤 — "패시브가 만나는 상대에게 거의 안 나온다(인물 다섯 가운데 셋이 독일), 고유 동작도 잘 안 보인다, 개념이 서로 달라야").
시계: 시작 10/9 13:28 KST → 끝 13:5x KST (보고서에 적음).

**한 줄**: 굴려 나온 패시브는 이제 **확정**이다(맞받아치기 꼴의 준비 자세 0.3 m 문턱을 패시브에서만 걷어 냄 + 0.5 s 걸쇠 + 미룬 패시브가 지워지지 않음). 독일 패시브를 **받기·따라가기·겹치기**(Indes·Nachreisen·Duplieren)로 다시 짰다. 48 판에서 **Indes 116 · Nachreisen 178 · 베어서 막기 136 번**(전 Überlaufen 9 · Absetzen 1 · 베어서 막기 19). 여섯 무기 모두 띠(±14) 안 — 레이피어 +10 승이 가장 크게 움직였다. 고유 동작에 상황 선호 `fit` 을 더해 Krumphau·Schielhau·passata sotto 가 두 배쯤 더 나온다(`UNIQUE_FIT=0` 대조).

## 1. 바꾼 것

### A. 패시브 확정 (ai.js)
| 무엇 | 어디 | 전 | 뒤 |
|---|---|---|---|
| 맞받아치기 꼴(counter) 기술 고르기 | `passiveThreat` | `counterTech` — 준비 자세가 손에서 0.3 m 안일 때만, 아니면 보통 판단으로(Überlaufen 174 굴림 → 7 번) | 목록(줄마다 목록이면 이 위협의 줄 것)에서 손에서 가까운 것을 **문턱 없이** (`passiveTech`), `fastChamber: true`·`skipChamber: false` — 멀면 준비 자세를 빠르게 거친다 |
| 맞받아치기 꼴 간격 | `respond` | 굴린 뒤 간격 밖이면 못 냄(진단: 굴려 나온 21 번 가운데 7) | 간격(`counterRange` = 간격 끝 + 0.3 m 안 · clinch + 0.1 밖)을 **굴리기 전에** 본다 → 굴림이 곧 기회 |
| 걸쇠 | `passiveFired` → `this.passiveLock = { left: 0.5, name }` · `update` 머리에서 줄임 · getter `passiveLocked` | 준비·다가가는 동안 새 위협이 오면 숙련자는 공격을 거두고 막았다(패시브 공격도) | 패시브가 낸 공격은 0.5 s 동안 `attack()`(windup·approach)·`approachStep` 의 respond 확인을 건너뛴다. 맞으면 물러나는 것(`hurt` → startWithdraw)은 그대로 — 물리·싸움 규칙은 안 건드림. `preThreat` 는 간 보기에서만 불려 공격 중엔 원래 닿지 않는다 |
| 미룬 패시브 | `pendingPassive = { P, why, left }` · `passivePending` · `startAttack` 머리 · `withdraw` 끝 · `watch` | 斂翅(물러남 끝)는 그 사이 어떤 공격이든 시작하면 지워졌다(48 판 0/15). 돌려 물러남은 간격 밖이면 사라짐 | 나기 전에 내 공격 기회(되받기·seize·맞받기 — 이어 치기·흐름·패시브 공격은 아님)가 오면 그 기회를 **패시브가 가져간다**. 물러남 끝에 못 내면 0.5 s 동안 간 보기에서 다시 본다(상대가 서 있고 간 보는 거리 + 0.4 m 안). 간격 밖에서 굴려 나온 돌려 물러남도 0.5 s 남는다 |
| tech 꼴 `chamber` 칸 | `passiveGo` | tech 꼴은 늘 지금 손에서 곧장(skipChamber) | `do.chamber: true` 면 준비 자세를 빠르게 거친다(독일 Nachreisen — 보통 'recover' 공격처럼, 내디딤은 stepTime 그대로) |

보통(패시브 아닌) 맞받아치기는 0.3 m 문턱·굴림 차례 그대로다(`counterRange` 로 식만 뺐다 — 같은 단락 평가).

### B. 독일 패시브 재편 (schools.js `GERMAN_PASSIVES`)
| 이름 | 사건 | 하는 것 | p | 근거 |
|---|---|---|---|---|
| **Indes (맞받기)** `indes` | `threat` | 줄마다 맞받아치기: thrust → stichPflug·stichOchs (옛 Absetzen) · lowL/lowR → oberhau·zornhau (옛 Überlaufen) · highL/highR/highC → zornhau·zornhauL·oberhau | 0.7 | Zettel 「Indes」·「Absetzen」·「Überlaufen」 · Ringeck [원전 2차] |
| **Nachreisen (따라 들어가기)** `nachreisen` | `foeRecover` (seize 의 recovering 가지 — 설계 §3 의 자리, 처음 씀) | zornhau·oberhau·stichPflug 가운데 가까운 것, why 'recover', 준비 자세 거침(chamber) + 보통 내디딤 | 0.8 | Zettel 「Nachreisen」 · Ringeck [원전 2차] |
| Duplieren (겹치기) `duplieren` | `parried` | zwerch·zwerchL 가까운 쪽 (그대로) | 0.6 | Ringeck [원전 2차] |

받기(상대 칼이 올 때) · 따라가기(상대가 헛친 뒤) · 겹치기(내 칼이 막혔을 때) — 사건이 겹치지 않는다. 셋 다 nameKo 있음.

### C. 고유 동작 상황 선호 (`fit` 칸)
TECH 꼴 고유 동작에 `fit: { 열쇠: 곱 }` — `pickTech` 가 `foeClass` 의 열쇠(online·high·low·left·right)가 참이면 fit 에 곱한다(칸이 없으면 셈 그대로). `parried` = 바로 앞 내 공격이 막혔나(`bound && !hitLanded` — 다음 startAttack 이 지우기 전이라 값싸다).

| 유파 | 고유 동작 | fit | 까닭 |
|---|---|---|---|
| 독일 | Krumphau | online 2.0 · high 1.3 | 「Krump auf behende, wirf den Ort auf die Hände」 — 황소·뻗은 손을 깬다 |
| 독일 | Schielhau | online 2.2 | 「Schieler bricht, was Büffel schlägt oder sticht」 — 긴 자세·찌르기를 깬다 |
| 독일 | Duplieren(고유) | parried 1.5 | 맺힘 뒤 거듭 치기 |
| 이탈리아 | passata sotto | high 1.6 | 높은 자세 밑으로 들어간다 |
| 일본 | 小手 | online 1.4 | 겨눈 손을 친다 |
| 중국 | 左翼擊 | online 1.4 | 小手와 같은 길 |

수는 모두 사장님 확인 전 — 작게 뒀다.

### D. 알림 시점 · 디버그
- 고유 동작 알림을 `startAttack`(결정)에서 `startStrike`(칼이 실제로 나감)로 옮기고 **1.5 s**(`ai.js strikeCue`). 패시브 알림은 결정 때 그대로 1.2 s. 패시브가 낸 공격은 칼이 나갈 때 고유 동작 이름으로 덮지 않는다(예: 返し → 燕返し 는 '返し' 그대로).
- 설정 **'모든 기술 이름 표시 (디버그)'** `techCueAll`(기본 끔, '유파 기술 알림' 아래 줄): 그 밖의 기술도 칼이 나갈 때 흐리게 1.0 s — 공용 동작은 `TECH_NAMES[유파]` 말 이름(예 독일 '분노의 베기 (Zornhau)'), 속임수는 속임수 이름, 없으면 코드 이름. `me.techAll` 에 따로 적어 패시브·고유 알림이 떠 있는 동안은 덮지 않는다. 난수·판단과 상관없음.

### 도구
- `tools/sim/motion_lab.mjs` duel: 넷째 줄 `고유 동작 [유파]: 이름 쓴 수…`(속임수 꼴은 속임수 쓴 수) · `UNIQUE_FIT=0` = 모든 고유 동작의 fit 칸을 지운 대조(양쪽 AI).

## 2. 재기 (48 판 = `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main`, 같은 씨앗, 상대 = 롱소드 AI)

읽기: 띠 ±14. **상대 롱소드 AI(독일)도 바뀌었다** — 모든 줄의 변화에 상대 쪽 변화가 섞여 있다. 발동 칸 = 낸 수 / 굴린 수(48 판 합). 굴림 = p × (0.5 + 0.5 × 읽는 눈) 의 난수 한 번이라, 확정 뒤 '낸/굴린' 은 그 확률(대략 0.5~0.65)에 가깝다. 전 = 83fae62 를 따로 풀어 같은 명령으로 다시 잼(지시서의 수와 모두 같음).

| 무기 · 유파 | 전 승/패/무 | 뒤 승/패/무 | 패시브 전 (낸/굴린) | 패시브 뒤 | 고유 동작 전 → 뒤 (쓴 수) |
|---|---|---|---|---|---|
| 롱소드 · 독일 (새 기준) | 19 / 22 / 7 | **23 / 22 / 3** (+4) | Absetzen 1/3 · Duplieren 32/83 · Überlaufen 9/153 | **Indes 116/217 · Nachreisen 178/370** · Duplieren 38/99 | Krumphau 2→3 · Schielhau 15→9 · Duplieren 9→7 · Zwerch mit Abtritt 2→2 |
| 레이피어 · 이탈리아 | 18 / 20 / 10 | 28 / 19 / 1 (+10) | contratempo 39/65 · cavazione 57/192 | contratempo 41/60 · cavazione 55/149 | imbroccata 42→24 · passata sotto 5→**18** · cavazione 5→2 · inquartata 80→75 |
| 츠바이핸더 · 이베리아 | 21 / 24 / 3 | 15 / 26 / 7 (−6) | 베어서 막기 19/243 · 이어 돌기 156/272 · 돌려 물러남 0/13 | **베어서 막기 136/222** · 이어 돌기 202/344 · 돌려 물러남 0/6 | redondo 8→3 · altibaixo 1→2 · talho rodeado 113→121 |
| 모노호시자오 · 일본 | 23 / 24 / 1 | 21 / 26 / 1 (−2) | 残心 88/108 · 出端 16/20 · 返し 34/66 | 残心 96/119 · 出端 17/22 · 返し 32/61 | 燕返し 36→31 · 小手 45→57 · 跨虎 5→3 · 開き斬り 52→50 |
| 청강검 · 중국 | 24 / 23 / 1 | 23 / 22 / 3 (−1) | 斂翅 0/15 · 刺→擊 13/39 · 看守 4/26 | 斂翅 **3**/9 · 刺→擊 19/35 · 看守 6/28 | 腰擊 16→23 · 左翼擊 65→84 · 斂翅(속임수) 5→3 · 掣步 腰擊 4→5 |
| 打刀 · 일본 | 15 / 26 / 7 | 18 / 26 / 4 (+3) | 残心 108/126 · 出端 29/38 · 返し 35/75 | 残心 77/87 · 出端 13/21 · 返し 18/49 | 燕返し 25→15 · 小手 62→62 · 跨虎 6→5 · 開き斬り 50→26 |

맞받아 베기(why 'counter' 로 칼을 낸 수, 둘째 줄): 롱소드 18 → **101** · 츠바이핸더 20 → **123** — 맞받아치기 꼴 패시브가 실제로 칼을 낸다.

### fit 대조 (`UNIQUE_FIT=0` — 뒤 코드에서 fit 칸만 지움, 양쪽 AI)
| 무기 | fit 끔 승/패/무 | fit 켬 (위 '뒤') | 고유 동작 fit 끔 → 켬 |
|---|---|---|---|
| 롱소드 | 20 / 24 / 4 | 23 / 22 / 3 | Krumphau 1→3 · Schielhau 4→9 · Duplieren 5→7 |
| 레이피어 | 23 / 19 / 6 | 28 / 19 / 1 | passata sotto 9→18 |
| 모노호시자오 | 24 / 21 / 3 | 21 / 26 / 1 | 小手 47→57 |
| 청강검 | 24 / 22 / 2 | 23 / 22 / 3 | 左翼擊 76→84 |

### 읽기
- **목표 지표(발동 수)**: Indes 116 · Nachreisen 178 · 베어서 막기 136 — 셋 다 48 판에 백 번 넘게(판마다 2~4 번). 斂翅 0 → 3. 돌려 물러남은 여전히 0(굴림 6 — 몰린 물러남 자체가 드묾).
- **무너짐 없음**: 여섯 모두 띠 안(가장 큰 것 레이피어 +10, 츠바이핸더 −6). 롱소드(독일 대 독일) 19 → 23 승.
- **독일 고유 동작은 전보다 조금 줄었다**(Schielhau 15 → 9): 독일 AI 가 맞받기·따라 들어가기로 칼을 내는 일이 많아져 pickTech 로 고르는 공격이 줄었다. fit 은 같은 코드 안에서 Krumphau·Schielhau 를 두세 배로 올린다(대조 표). 더 보이게 하려면 fit 을 키우는 것보다 Indes·Nachreisen p 를 낮추는 쪽이 판을 덜 흔든다(결정 후보).
- 打刀 開き斬り 50 → 26 · 残心 108 → 77: 상대(독일)가 맞받기·따라 들어가기로 들어와 주고받는 꼴이 바뀐 것으로 읽는다(打刀 쪽 코드 변화는 小手 fit 과 확정 규칙뿐).

## 3. 관문
| 관문 | 기대 | 결과 |
|---|---|---|
| `node tools/sim/fights12.mjs` (stdout sha256 앞 8) | 바뀜(독일 AI 바뀜) — 전 `64a21f64`(83fae62 를 이 컨테이너에서 다시 재어 같음) | **`e5517952`** (dead 6/12 · downs 1.7 · opened 8.3; 전 8/12 · 1.4 · 10.2) — **새 기준** |
| `node tools/sim/live_battery.mjs` | `c2072cd1` | `c2072cd1` 그대로 |
| `node tools/sim/finish_thrust.mjs 1 --stand` | `d65cc1df` | `d65cc1df` 그대로 |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | IDENTICAL 12/12 |
| `node tools/sim/weapon_smoke.mjs` | OK 17/17 | OK 17/17 |
| `npx vite build` | 됨 | 됨 |

## 4. 남은 것 · 결정 후보
- p 값(Indes 0.7 · Nachreisen 0.8)과 fit 곱은 모두 사장님 확인 전(확인표 254~257).
- 독일 AI 가 이제 판마다 맞받기 2~3 번 · 따라 들어가기 3~4 번을 낸다 — 사장님이 '너무 자주'라고 느끼면 p 를 0.5 쯤으로.
- 돌려 물러남(이베리아)은 여전히 0 — 몰린 물러남(foeAggro) 자체가 드물다. 사건을 넓히는 것은 따로.
- 걸쇠 0.5 s 동안 패시브 공격은 새 위협에 거두지 않는다 → 맞받기가 늦으면 서로 베이는 일이 늘 수 있다. 물리 쪽은 안 건드렸다.
- 브라우저로 '모든 기술 이름 표시' 화면은 보지 않았다(빌드만) — 사장님 검토 때 확인.
