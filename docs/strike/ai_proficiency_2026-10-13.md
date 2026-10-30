# AI 숙련도 — '난이도'를 숙련도로 (10/13)

브랜치 `…/ai-proficiency-2q36ha` (origin/main 15c6625 위).

## 사장님 결정 (10/13 22:4x~23:2x)

- "AI 상대는 숙련도 수치에 따라 쓸지 말지를 결정하게 하자. 지금 '난이도'를 그렇게 개편하는 거지. 각 검술의 숙련도가 있고 캐릭터마다 숙련도가 달라."
- "상대 난이도는 메뉴에서 빼자." · "AI는 인장 표시 안 해도 돼. 지금처럼 칭호가 보이는 게 더 재밌어." (칭호 표시는 그대로)
- 인물 숙련도: 브란 1 · 이졸데 1 · 오마리 1 · 마야(samira) 1 · 김씨(renji) 2 · 투야나(eira) 2 · 하인리히 2 · 토메 2 · 랴오 3 · 미나미 3(→ **5**, 10/14 03:5x '미나미 숙련도 5로 해줘') · 마르그레테 3 · 아르토리아 4.
- "'광기의'는 궁극적으로 모든 캐릭터들에게 다 만들려고 해. 기본 캐릭터+1의 숙련도와 추가 파워를 주자." — 추가 힘은 지금의 '실력 숫자 +20%'(사장님 9/28 확정)를 그대로 쓴다(디렉터 해석).
- (23:1x~23:2x) "숙련도 5단계를 만들고 거기서 비기를 배우게 하자." · "AI는 숙련도 5만 비기 씀." — 숙련도 범위 0~5. 플레이어 인장 25개(250번 깨기), 21~25번째 인장이 각 유파 5단계(비기).
- (23:1x~23:2x) 단계 이름 1 견습생 · 2 숙련자 · 3 전문가 · 4 마스터 · 5 신. 인장 알림 '「{유파 이름} 유파 {단계 이름}」 인장' ("독일 신은 이상하고 독일 유파 신 이렇게 하면 되지").

## 자료 꼴

- 인물 시트 `ai.proficiency` (src/characters.js) = 자기 유파의 숙련도. 자기 유파 = 시트 무기(`weapon`)의 유파(schools.js `traditionOf`), 다른 유파 = 0.
- `aiAtProficiency(인물, 숙련도)` 가 AI 에 넘길 두 값을 만든다 (시트 기본값과 시험 주소가 같은 함수):
  - `ai.level` = 실력 숫자 이름 (`AI_PROFICIENCY.levels[숙련도]` — config.js). 도구는 지금처럼 `ch.ai.level`·`ch.ai.persona` 를 읽는다.
  - `ai.persona.proficiency` = `{ 유파: 숙련도 }` (예: 랴오 `{ chinese: 3 }`). AI 는 손에 든 무기의 유파(sword_art.js `art.tradition`) 값을 읽고, 표에 없는 유파는 0.
  - 인물별 `persona.level` 덮어쓰기는 그 위에 그대로 얹는다(ai.js setLevel 병합 그대로).
- 무유파 무기(나뭇가지·권총·모르겐슈테른)를 든 인물은 고유 동작·비기가 없고 숙련도는 실력 숫자에만 쓰인다.
- 브란이 10 % 로 주워 든 칼(다른 유파)은 그 유파 숙련도 0 → 고유 동작·비기 없음(실력 숫자는 브란 1 = easy 그대로).
- 숙련도를 받지 않은 AI(인물 시트 없이 난이도 이름만 받는 도구·기본 상대): 난이도 이름에서 `AI_PROFICIENCY.ofLevel` (easy 1 · normal 2 · hard 3). 기본 상대(`?foe=default`) = normal = 2.
- 변형(`mad: true` — 변형 표시 하나): 숙련도 = 원본 + 1 (상한 5 — 사장님 10/29 22:4x '상한 6으로 올려' 부터 6 · `AI_PROFICIENCY.max`) · 실력 숫자 = 그 숙련도에서 원본이 받을 실효값(AI_LEVELS[이름] 위에 원본 persona.level) × 1.2 (`MAD_SCALE`, 시간 값은 ÷1.2, 확률은 1 에서 자름 — 9/28 규칙 그대로). 다른 인물에게 변형을 만들 때 `madVariantAI(원본)` + `mad: true` 로 같은 규칙이 붙는다.

## 매핑

| 숙련도 | 실력 숫자 (AI_LEVELS) | 고유 동작 (손에 든 유파) | 비기 |
|---|---|---|---|
| 0 | easy (시험 주소로만) | 없음 | 없음 |
| 1 | easy | 1 단계 | 없음 |
| 2 | normal | 1~2 단계 | 없음 |
| 3 | hard | 1~3 단계 | 없음 |
| 4 | hard (hard 보다 센 수가 없다 — 3 과의 차이는 네 번째 고유 동작뿐) | 1~4 단계 | 없음 |
| 5 | hard (4 와 같음) | 1~4 단계 (모두) | 그 유파 비기 |

실력 숫자 매핑(0·4·5 = 위와 같음)은 **사장님 확인 전**. 5 에서 비기·AI 는 5 만 비기는 **사장님 결정 10/13**.

### 고유 동작 거르기

- 단계 표는 src/unique_assist.js `PLAYER_UNIQUE`(사장님 확정 표) 한 곳 — AI 쪽은 `aiUniqueStages(유파)` 로 읽는다(표를 복사하지 않음).
  독일 zwerchAbtritt 1·krumphau 2·duplieren 3·schielhau 4 / 이탈리아 inquartata 1·imbroccata 2·cavazione 3·passataSotto 4 /
  이베리아 talhoRodeado 1·altibaixo 2·redondo 3·talhoRevezBaixo 4 / 일본 hirakiGiri 1·kote 2·tsubameGaeshi 3·kokoRenda 4 / 동방 chebuYaoji 1·zuoyi 2·lianchi 3·자→격 4.
- 동방 4 단계 '자→격'은 AI 쪽에서 yaoji 단독 동작과 ciji(刺→擊) 패시브(yaoji 이음) 둘 다 — 표의 `path` 로 길을 빌린 항목 규칙(빌린 길 + 같은 이름의 패시브).
- 거르는 곳: sword_art.js `applySchoolArt`(AI 꾸러미 — 길·속임수 고유 동작) · ai.js 생성자(`uniqueByName` 기술 알림 표, `passives`).
- 표에 없는 것은 그대로: 이베리아 rodaCounter(맞받아치기 목록), 그 밖의 패시브(이탈리아 cavazione 패시브·독일 duplieren 패시브 등 — 이름이 같아도 `path` 항목이 아니면 거르지 않는다).
- 고유 동작 이름을 부르던 곳은 꾸러미에 없으면 원래 있던 대체로 간다(새 분기 없음):
  - 일본 패시브 kaeshi(返し) `tsubameGaeshi` → 숙련도 3 아래에선 `alt` 정수리 베기 oberhau.
  - 독일 칼 맞물림 이어 치기(ai.js 자연 맞물림 `uniqueByName.get('duplieren')`) → 숙련도 3 아래에선 zwerch.

### 비기

- AI: 손에 든 유파의 숙련도가 `AI_PROFICIENCY.secretAt`(= `UNIQUE_ASSIST.secretStage` 5) 아래면 `ai.secret = null` (무유파처럼 비기 자리들이 전 코드 그대로 지나간다). 5 에선 고유 동작이 다 열려 비기가 찾는 기술 이름(passataSotto·krumphau·schielhau·duplieren·yaoji…)이 모두 꾸러미에 있다.
  지금 인물 값으로는 아무도 비기를 쓰지 않는다(최고 아르토리아 4). 광기 변형은 기본 4 인 인물의 변형부터 5.
- 플레이어: 손에 든 무기 유파의 숙련도(본판 = 그 유파 인장 수 · 테스트 경로 5 · `?uniqueStage`)가 5 일 때만 비기 창(secret.js `PlayerSecretWatch`)을 연다 — 그 전엔 `locked` → `S = null`(스위치 끔·무유파와 같은 길: 창·준비 표시·발동 모두 없음). 플레이어 비기가 시작되는 곳은 main.js 의 `player.skill.secret(playerSecret.fire…)` 두 자리뿐이라 창 하나로 막힌다.
- 인장: `sealMax` 25 · 인장 k 의 단계 = ⌊(k−1)/5⌋+1 → 21~25 번째(210·220·230·240·250 번 깨기)가 독일 → 이베리아 → 이탈리아 → 일본 → 동방 5 단계. 알림 예: 「독일 유파 견습생」 인장 — 비껴 딛는 가로베기 열림 · 「동방 유파 신」 인장 — 비기 연환삼격 열림 (비기 이름은 TRADITIONS[유파].secret.nameKo 의 괄호 앞).

## 인물별 전 / 후

전 = main 15c6625 (모든 AI 가 손에 든 유파의 고유 동작 넷 + 비기). 후 = 이 브랜치. 고유 동작은 단계 차례.

| 인물 | 무기 (유파) | 전 실력 | 후 숙련도 | 후 실력 | 후 고유 동작 | 후 비기 |
|---|---|---|---|---|---|---|
| 브란 오소리 | 나뭇가지 (무유파) | easy | 1 | easy | 없음 (주운 칼: 그 유파 0 — 전엔 그 유파 넷+비기) | 없음 |
| 이졸데 | 롱소드 (독일) | easy | 1 | easy | zwerchAbtritt | 없음 (전 받아 베기) |
| 오마리 | 츠바이핸더 (이베리아) | normal | 1 | **easy** | talhoRodeado (+ rodaCounter 그대로) | 없음 (전 길목 지키기) |
| 마야 (samira) | 권총 (무유파) | hard | 1 | **easy** | 없음 | 없음 |
| 김씨 (renji) | 모르겐슈테른 (무유파) | normal | 2 | normal | 없음 | 없음 |
| 투야나 (eira) | 레이피어 (이탈리아) | normal | 2 | normal | inquartata · imbroccata | 없음 (전 박자 밑 찌르기) |
| 토메 | 레이피어 (이탈리아) | normal | 2 | normal | inquartata · imbroccata | 없음 (전 박자 밑 찌르기) |
| 하인리히 | 엑스칼리버 복제품 (독일) | normal | 2 | normal | zwerchAbtritt · krumphau | 없음 (전 받아 베기) |
| 랴오 | 청강검 (동방) | normal | 3 | **hard** | chebuYaoji · zuoyi · lianchi (yaoji·ciji 패시브 빠짐) | 없음 (전 연환삼격) |
| 미나미 | 모노호시자오 (일본) | normal | ~~3~~ **5** (10/14) | **hard** | 넷 다 (10/13 판 3: hirakiGiri · kote · tsubameGaeshi) | **고노센** (5 — 10/14 되찾음) |
| 마르그레테 | 롱소드 (독일) | hard | 3 | hard | zwerchAbtritt · krumphau · duplieren | 없음 (전 받아 베기) |
| 아르토리아 | 엑스칼리버 (독일) | normal | 4 | **hard** | 넷 다 | 없음 (전 받아 베기) |
| 광기의 하인리히 | 엑스칼리버 복제품 (독일) | normal +20% | 3 | **hard +20%** | zwerchAbtritt · krumphau · duplieren | 없음 (전 받아 베기) |
| 기본 상대 (`?foe=default`) | 롱소드 (독일) | 메뉴 (기본 normal) | 2 | normal | zwerchAbtritt · krumphau | 없음 (전 받아 베기) |

바뀌는 인물: 쉬워짐 — 오마리 normal → 1(easy) · 마야 hard → 1(easy). 어려워짐 — 랴오·미나미 normal → 3(hard) · 아르토리아 normal → 4(hard) · 광기의 하인리히 normal+20% → 3(hard)+20%.
모든 유파 인물은 비기를 잃고(5 아래), 숙련도 1~3 인물은 위 단계 고유 동작을 잃는다.

광기의 하인리히 실력 숫자 (하인리히 persona.level 이 덮지 않는 셋만 바뀜): chamberSpeed 3.6 → 4.56 · parrySpeed 5.4 → 6.6 · predict 0.9 → 1 (나머지 reaction .175 · windup .375 · strikeSpeed 15.6 · guardChance .792 · counter .384 · feint .552 · followUp .864 · read .864 · discipline .9 · strength 1.38 · aggression 1.15 · skill .984 그대로).

## 메뉴

- index.html 설정 창의 '상대 난이도' 줄을 뺐다(남은 줄 '화면 60 fps 제한' 하나). main.js `settings` 에서 difficulty 읽기·쓰기·`ai.setLevel` 호출을 뺐다 — 저장된 옛 `difficulty` 값은 읽지 않는다.
- AI 칭호 표시는 그대로(인장 표시 없음).

## 시험 주소

- `?foeProficiency=0..5` — 그 판 상대의 숙련도를 덮어쓴다(실력 숫자 이름·고유 동작·5 비기 모두, 변형이면 +20% 도 그 숙련도 위에서). 인물 없는 기본 상대에도 듣는다. 범위 밖이면 무시.
- `?uniqueStage=0..5` — 플레이어 해금 단계(5 = 비기까지). 테스트 경로(`?test=1`)는 5.
- `?clears=N` — 깬 수 덮어쓰기(예: 210 = 독일 5 단계).

## 확인 (출력: /tmp/ai-proficiency-2q36ha/)

관문 (main 15c6625 · 이 브랜치):

| 관문 | main | 브랜치 | 까닭 |
|---|---|---|---|
| `node tools/sim/fights12.mjs` (deprecated 줄 뺀 sha256 앞 8자) | d5a4d113 | **7c95ba21** | 의도한 변화: 도구의 AI 둘은 `new AI(…, 'normal')`(인물 없음) = 숙련도 2 → 독일 3·4 단계(duplieren·schielhau)·자연 맞물림 겹치기·비기(받아 베기)가 빠짐. 같은 브랜치에서 기본 숙련도를 5 로 덮으면 **d5a4d113 (main 과 바이트 같음)**, 4 로 덮으면(비기만 끔) e43112be — 바뀐 몫은 모두 숙련도 규칙 |
| `node tools/sim/live_battery.mjs` | e7ee3d96 | e7ee3d96 | 같음 (기본 묶음에 AI 싸움 fights 가 없다) |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 433ac984 | 433ac984 | 같음 |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12 | IDENTICAL 12 | 같음 |
| `node tools/sim/weapon_smoke.mjs` | OK 21 | OK 21 | 모두 OK (끝 자세 몇 줄은 AI 행동이 바뀌어 다름) |
| `npx vite build` | — | 종료 0 | |

망가짐 확인 (인물마다 30 초 × 3 판, 상대 = 기본 롱소드 AI — /tmp/ai-proficiency-2q36ha/uq_check.mjs): 오류 0. 쓴 고유 동작은 모두 숙련도 단계 안
(예: 이졸데 zwerchAbtritt 만 · 오마리 talhoRodeado 만 · 랴오 zuoyi·chebuYaoji · 미나미 hirakiGiri·kote·tsubameGaeshi(패시브 kaeshi 포함) · 토메 inquartata·imbroccata), 비기 낸 수 0.
`?foeProficiency` 꼴로 0 을 주면 고유 동작 0, 5 를 주면 넷 다 + 비기(받아 베기·박자 밑 찌르기·길목 지키기·고노센·연환삼격 꾸러미, 짧은 판에서 실제로 냄).

플레이어 비기 (헤드리스 — 같은 판 AI 둘이 플레이어·상대를 조종, 브랜치 AI 는 숙련도 5 로 main 과 같은 행동, 20 초 × 4 판, /tmp/ai-proficiency-2q36ha/psecret.mjs):
롱소드 — main 창 4·3·0·4 / 브랜치 숙련도 5 4·3·0·4 (같음) / 브랜치 잠김(5 아래) S 없음·0. 츠바이핸더 — main 0·1·0·0 / 숙련도 5 0·1·0·0 / 잠김 0.

브라우저 (vite 개발 서버, 실제 index.html — /tmp/ai-proficiency-2q36ha/browser_check.mjs · 설정 창 menu_settings.png): 오류 0.

| 주소 | 상대 숙련도·실력·비기 | 플레이어 단계·비기 창 |
|---|---|---|
| 설정 창 | — | 줄 '화면 60 fps 제한' 하나 (상대 난이도 없음) |
| `?foe=artoria&foeWeapon=excalibur` (본판 인장 0) | 4 · hard · 없음 | 0 · 없음 |
| 같은 + `uniqueStage=4` | 4 · hard · 없음 | 4 · 없음 |
| 같은 + `uniqueStage=5` | 4 · hard · 없음 | 5 · 받아 베기 |
| `?foe=margarethe&clears=210` 롱소드 | 3 · hard · 없음 | 독일 5 · 받아 베기 |
| 같은 · 츠바이핸더 | 3 · hard · 없음 | 이베리아 4 · 없음 |
| `?test=1` 롱소드 | 4 · hard · 없음 | 5 · 받아 베기 (8 초 안에 창 1 번 열림) |
| `?foe=default` | 2 · normal · 없음 | 0 · 없음 |
| `?foe=liao&foeWeapon=qinggang&foeProficiency=5` | 5 · hard · 연환삼격 | — |
| `?foe=heinrich_mad` | 3 · hard(+20%: reaction .175 · chamberSpeed 4.56) · 없음 | — |
| 같은 + `foeProficiency=1` | 1 · easy(+20%: chamberSpeed 2.64) · 없음 | — |

`?weapon=X` 는 상대 무기도 X 로 바꾼다(본판 FIXED_WEAPON) — 그래서 위 확인은 `foeWeapon=` 으로 인물 무기를 들렸다. 다른 유파 무기를 든 인물은 그 유파 숙련도 0 이다(예: `?foe=liao&weapon=longsword` → 랴오 숙련도 0, 실력 hard).

## 남은 문제

- 인물 없이 `'normal'` 로 AI 를 만드는 도구(motion_lab·secret_trace·gilmok_pair_probe·parry_combo_probe·cn_combo_speed·브라우저 비기 스크린샷 도구 등)는 이제 숙련도 2 라 AI 비기·3~4 단계 고유 동작이 안 나온다. 그 도구로 AI 비기·고유 동작을 재려면 `persona.proficiency: 5`(브라우저는 `?foeProficiency=5`)를 넘겨야 한다 — 이번엔 도구를 고치지 않았다.
- 실력 숫자 매핑(0·4·5 = easy·hard·hard)과 '숙련도 없는 AI = 난이도 이름에서'는 사장님 확인 전(확인표 1060·1061).
- 밸런스는 재지 않았다(사장님: 나중에 한꺼번에).

## 10/16 22:3x 얼터 숙련도 +1 (사장님)

- 사장님: "나는 미나미가 고노센을 쓰는 게 마음에 드는데, 다라이시는 기본은 안 쓰고 얼터는 쓰게 하고 싶어. 얼터가 숙련도+1을 하기로 했으니까 그에 맞춰 조정하면 될 듯. 모든 얼터에 숙련도+1을 잊지 말고 적용해 두도록 해."
- 샛별 얼터 9명(외양만 — `appearanceOnly`)도 숙련도 +1(`madVariantAI`). 빼는 것은 실력 숫자 +20%(광기의 하인리히만 가진 것) 하나. `src/characters.js` '얼터 숙련도 맞춤'이 모든 변형을 원본 +1(상한 5)로 맞춘다 — 새 얼터가 시트를 복사해 들어와도 빠지지 않음.
- 값: 광기의 하인리히 3(그대로) · 브론 1→2 · 이졸데 1→2 · 토메 2→3 · 마르그레테 3→4 · 오마리 1→2 · 라트나 2→3 · 미나미 5→5(상한) · 랴오 3→4 · 투야나 2→3.
- 미나미 5(고노센) 그대로 — 앞 제안 5→3 은 접음. 다라이시 4(비기 안 씀) 그대로 — 다라이시 얼터는 아직 없음(생기면 5 = 고노센).
- 검사 `tools/browser/night_variants_check.mjs` 를 새 규칙(숙련도만 +1, 그 숙련도의 AI 는 원본과 같음)으로 고침.

## 10/25 18:5x 투야나 3 · 광기의 하인리히 이탈리아 (사장님)
- "투야나 숙련도 1 올려. 광기의 투야나도 자동으로 1 오르게 됨." → 투야나(eira) 2 → **3**(실력 숫자 normal → hard · 반응 0.25 → 0.2 s · 유파 몫 배율 1 → 1.15 · 이탈리아 고유 동작에 칼끝 돌려 빼기 더함). 광기의 투야나는 위 '얼터 숙련도 맞춤' 그대로 3 → **4**(시트에 따로 적지 않음 — 실력 숫자 hard 그대로 · 반응 0.2 → 0.15 s · 배율 1.15 → 1.3 · 패시브 칸 곧은 선(4 부터) 켜짐 · 비기 없음).
- "파펜하이머 들어오면 광기의 하인리히가 파펜하이머를 들고 이탈리아 유파로 싸우게 해." → 광기의 하인리히 숙련도 3 은 그대로이고 유파가 독일 → **이탈리아**(시트 무기의 유파 — `aiAtProficiency`). 실력 숫자(hard 위 낮의 하인리히 +20 %)는 무기와 상관없이 그대로. 낮의 하인리히 독일 2 그대로.
- 시험 `tools/sim/heinrich_mad_papp.test.mjs` · 확인표 2547 · 2548 · 기록 `docs/decisions.md` 10/25 18:5x.
