# 유파 패시브 고유 동작 — 설계 (2026-10-09 02:3x, 디렉터)

사장님 10/9 02:1x: "어떤 고유 동작은 패시브여도 좋을 거 같아. 어떤 조건이나 경로나 막기 상황, 대치 상황 등에서 자동 발동된다거나." 검술보정 v2 완성도 목표 95 %.
이 글은 구현 담당(2 등급)의 지시서다. 값은 모두 **사장님 확인 전**(확인표에 줄을 더한다). 새 상한·문턱은 두지 않는다 — 발동 조건은 이미 AI 가 읽는 상황(아래 사건)만 쓴다.

## 1. 뜻
- **능동 고유 동작**(`TRADITIONS[t].unique`, 01:5x 작업): AI 가 빈틈을 보고 **고르는** 베기·찌르기 길.
- **패시브 고유 동작**(`TRADITIONS[t].passives`, 이 글): 상황이 오면 **저절로 나오는** 반응. 길을 고르는 게 아니라 "이 유파 검객은 이 상황에서 이렇게 한다".
- 둘 다 유파 층 자료다. 틀(자세 자리·칼끝 각·몸 돌림)은 건드리지 않는다. 공용 동작(공용 풀)은 그대로 공유한다.

## 2. 자료 모양
```js
passives: [
  { name: 'zanshin', nameKo: '残心', when: 'landed', do: { withdraw: 'langort', time: 1.2 }, p: 1.0, src: '兵法家伝書 p18/18 「殘心之事 懸待ともに用」 [원문] · 검도형 각 本 끝 残心 [원문]' },
]
```
- `when` — 사건 하나(아래 §3 표의 열쇠). 같은 사건에 패시브가 둘이면 앞의 것부터 본다.
- `do` — 한 가지: `{ tech: '기술이름', why }`(지금 손에서 그 길로 곧장, skipChamber·fastChamber) · `{ chain: ['a','b'] }`(이어 치기 차례 강제) · `{ withdraw: '자세이름', time }`(그 자세로 겨누며 물러남) · `{ counter: ['a','b'] }`(이 위협에 쓸 맞받아치기 목록) · `{ parry: true }` / `{ void: true }`(막기/피하기 강제) · `{ feint: { fake, real } }` · `{ prefer: { thrust: 2.0 } }`(이 사건의 기술 고르기 가중치).
- `p` — 발동 확률(0~1). 실력에 곱한다: `p × (0.5 + 0.5 × L.read)`(읽는 눈이 좋은 검객이 더 자주 낸다). 값은 확인표.
- **한 사건에 한 번만 굴린다**(threatSeen·readRollId 와 같은 방식 — 매 스텝 다시 굴리지 않는다).
- **RNG 규칙(결정적 시뮬 지키기)**: 이 검객의 유파에 그 사건의 패시브가 **없으면 Math.random() 을 한 번도 부르지 않고**, 코드 길도 전과 같다. 그래야 롱소드 기준선(독일 패시브 기본 끔)이 바이트까지 같다. 패시브가 있을 때만 굴린다.

## 3. 발동 자리 (ai.js — 지금 있는 판단 자리에 끼운다, 새 상태 기계 없음)
| 사건 열쇠 | 뜻 | ai.js 자리 | 기본 행동(지금) |
|---|---|---|---|
| `landed` | 내 베기가 맞았다 | `afterStrike()` 머리(hitLanded) | 이어 치기 굴림 → 아니면 물러남 0.9 s |
| `missed` | 헛쳤다(안 맞고 안 막힘) | `afterStrike()` | 같음 |
| `parried` | 내 베기가 칼에 막혔다(bound && !hitLanded) | `afterStrike()` / `attack()` strike 중 `checkBind()` 가 bound 를 켠 스텝 | 같음(foeParried++) |
| `bindDef` | 막는 중 칼이 맞닿았다 | `defend()` checkBind 뒤(flowRiposte 자리) | SKILL.flow 면 되받아 벰 |
| `threat` | 상대 칼이 들어온다 (th.line·th.thrust) | `respond()` 첫머리(threatSeen 뒤) | Indes 굴림 → 막기/피하기 |
| `foeRaise` | 상대가 칼을 든다(준비) | `preThreat()` raising 가지 | windup 치기 or 물러남 |
| `foeCharge` | 상대가 달려든다 | `preThreat()` charging 가지 | stop 치기 or 물러남 |
| `foeRecover` | 상대가 헛치고 자세 잡기 전 | `seize()` recovering 가지 | recover 치기 굴림 |
| `foeStepIn` | 상대가 간격 안으로 걸어 들어온다 | `opportunity()` kind 'stepin' 이 뽑힌 뒤 `watch()` | 보통 공격 |
| `pressed` | 몰아치는 상대에게 물러난다 | `startWithdraw()` (foeAggro > 0.3) · `withdraw()` 끝 | 황소로 물러남 |
| `standoff` | 둘 다 간 보기, 위협 없음 2 s 이상, 상대 손 느림 | `watch()` decideTimer 분기 | 기회 점수로 공격 |
각 자리에서: `const P = this.passiveFor('열쇠')` → 없으면 전과 같은 코드. 있으면 한 번 굴려 `do` 를 실행하고 `this.stats.passives[name]++`(재기용).

## 4. 유파별 패시브 (각 2~3, 무유파 0) — 값은 전부 확인표
### 독일 (리히테나워·마이어) — **기본 끔**(롱소드 AI = 사장님 주 상대. 수치만 재서 아침 결정)
1. **Absetzen**(받아 찌르기) — `threat` 이고 th.thrust: 피하지 않고 쟁기/황소 자리로 받으며 그대로 찌른다 → `do: { counter: ['stichPflug','stichOchs'] }`, p 0.7. [원전 2차 Zettel 「Absetzen」]
2. **Duplieren**(겹치기) — `parried`(막혔다, 칼 맞물림): 물러나지 않고 상대 칼 뒤로 곧장 두 번째 베기 → `do: { tech: 'zwerch', why: 'follow' }`(지금 손에서 가까운 쪽 zwerch/zwerchL 을 고르는 규칙은 구현이 정함), p 0.6. [원전 2차]
3. **Überlaufen**(넘어 치기) — `threat` 이고 line lowL/lowR: 낮은 베기는 막지 않고 위에서 내려친다 → `do: { counter: ['oberhau','zornhau'] }`, p 0.6. [원전 2차]
### 이탈리아 (카포 페로, 레이피어)
1. **Contratempo** — `foeRaise`·`foeCharge`: 상대 박자에 찌른다(무거운 베기 말고) → `do: { prefer: { thrust: 3.0 }, why: 'stop' }` 치기 가지 확률을 올림(p 0.8). [원전 2차 Capo Ferro 「contratempo」]
2. **Cavazione** — `parried`/`bindDef`(칼이 맞물림): 빼서 반대편으로 찌른다 → `do: { tech: '반대쪽 stich' }`(stichPflug ↔ stichPflugL, 지금 손 쪽에서 먼 쪽), p 0.7. [원전 2차]
3. **Ritirata** — `pressed`: 칼끝을 겨눈 채(테르차 = langort) 물러난다 → 자료 `withdraw: { pressed: 'langort', calm: ['langort','pflugR'] }` (패시브가 아니라 유파 withdraw 값 — 함께 적용). [원전 2차]
### 이베리아 (몬탄테, 츠바이핸더)
1. **베어서 막기** — `threat`(베기): 가만히 받지 않고 들어오는 칼 쪽으로 탈류를 친다 → `do: { counter: ['zornhau','zornhauL','talhoReves'] }` + Indes 확률 ↑(p 0.8). [원전 2차 몬탄테 규칙: 받기보다 베기]
2. **이어 돌기** — `missed`·`parried`: 멈추지 않고 반대 어깨로 흘러 벤다 → `do: { chain: ['talhoReves'] }` p 0.9 (흐름이 이미 있으면 그 확률을 1 로). [원전 2차 규칙 1]
3. **돌려 물러남** — `pressed`: 가로로 한 바퀴 베며 물러난다 → `do: { tech: 'zwerch', why: 'press' }` 뒤 물러남, p 0.5. [해석]
### 일본 (카타나 가족, 모노호시자오)
1. **残心** — `landed`: 이어 치지 않고 中段(langort)으로 칼끝을 겨눈 채 길게 물러난다 → `do: { withdraw: 'langort', time: 1.2 }`, p 1.0. [원문 兵法家伝書 p18/18 · 검도형]
2. **出端**(데바나) — `foeRaise`·`foeStepIn`: 상대가 움직이는 순간 먼저 친다(기다렸다 한 칼) → 치기 가지 확률 1, `do: { prefer: { fast: 2.0, presses: 1.5 } }`. [원문 兵法家伝書 p16/15 「一ッ上れば、つけて打」 · 오륜서 表4]
3. **返し**(카에시) — `bindDef`: 받은 칼을 그대로 되받아 벤다(燕返し 길 우선) → `do: { tech: 'tsubameGaeshi' }`(없으면 oberhau), p 0.8. [원문 오륜서 表2]
### 중국 (조선세법, 청강검)
1. **斂翅**(패한 척) — `pressed`: 물러나다가 갑자기 들어가며 腰擊 → 물러남 끝에 `do: { tech: 'zwerch', why: 'press' }`, p 0.5. [원문 무비지 쪽174/0588 「佯北誘賺… 倒退進步腰擊」]
2. **刺→擊 고리** — `missed`·`landed` 이고 내 기술이 찌르기: 곧장 腰擊(yaoji 길 있으면 그것) → `do: { chain: ['yaoji'] }`(없으면 zwerch), p 0.8. [원문 쪽158/0572 「向前進步腰擊」]
3. **看守**(간수) — `standoff`: 상대가 머뭇거리면 기미를 따라 굴려 친다 → `do: { tech: 'zwerch', why: 'open' }` p 0.4. [원문 무도 권2 p039/31 「相機隨勢滾殺」]
### 무유파 — 없음(공용만)

## 5. 재기
- 무기: 롱소드(독일, 기본 끔 → 켬 줄만 따로) · 레이피어 · 츠바이핸더 · 모노호시자오 · 청강검. `node tools/sim/hybrid.mjs motion_lab.mjs duel <w> 24 main` 48 판, 같은 씨앗.
- 줄: 기준(능동 고유만) → 패시브 전부 → 패시브 하나씩. **발동 횟수**(stats.passives)를 승/패/무 옆에 적는다. 발동 0 이면 자리나 조건이 틀린 것 — 고치거나 기록.
- 읽기: 48 판 띠 ±14. 몰리넬로처럼 무너지면(−20 넘게) 끔으로 두고 수치를 남긴다. 작게 오르는 것은 "소음 폭 안" 이라 적는다.
- 관문(독일 끔 기본): fights12 578402e1 · live c2072cd1 · ft d65cc1df · corr 12/12 · smoke 16/16 — **바이트 같아야 한다**(RNG 규칙).
- 도구: motion_lab 환경 변수 `SCHOOL_PASSIVE=off|all|이름,…`, 독일 켬 `SCHOOL_PASSIVE_GERMAN=1`.

## 6. 문서·확인표
- 기록 `docs/strike/school_passive_2026-10-09.md`(구현 담당): 자리별 코드 줄, 유파별 표(발동 수·승률), 켬/끔, 독일 결정표.
- 확인표: 패시브마다 p 값 한 줄(사장님 확인 전), 독일 기본 끔 한 줄.
