# 게임 화면 문구 규칙 — 자세 · 패시브·비기 · 이름·칭호 · 시스템 · 대사 · 카드 · 창 (2026-10-10)

- 지시: 사장님 10/10 16:3x "게임 화면 레이아웃 정리부터 하고가자. 지금 메시지 출력 방식에 규율이 없어 보여. 글자 폰트 크기 색 위치 등을 정렬해. … 디자이너와 편집자 모두 필요한데. / 우측 상단에 자세 이름 뜨잖아. 그 아래에 영역을 지정해서 패시브와 비기는 따로 뜨게해. 모든 서식 통일하고 색만 다르게. … 캐릭터 이름, 칭호, 시스템 메시지와 캐릭터 대사도 마찬가지로 정리해." · 16:4x "카드와 설정 창까지 전부 다 넣어. 편집해서 문구도 고쳐도 돼."
- 맡은 몫: 편집자(문구·표기). 화면 배치·글자 크기·색은 디자이너 몫, 둘을 합쳐 구현하는 것은 구현자 몫.
- 가지 `…/hud-copy-2q36ha` (시작 db2eaea). 고친 것은 **글자만**: 화면에 보이는 칸(`nameKo`, 자세표 `name`·`desc` 중 desc 와 화면 전용 이름, 인물 대사, 메시지·안내 리터럴, index.html 의 글·aria-label). 열쇠(바탕 자세 열쇠 `'지붕 (Vom Tag)'`, 기술 열쇠, `feint.name`, 이탈리아 표 칸 이름의 Prima·Seconda·Terza·Quarta — hands.js 가 읽음, `data-setting` 값)는 하나도 건드리지 않았다. 구조·CSS·서식 코드(꼬리표를 합치는 틀 등)도 그대로 — 그건 §4 규칙으로 정하고 구현자가 넣는다.
- 결과: 화면 글 **610 줄** 전수 목록(부록) · 문제 **12 갈래** · 규칙 · **고친 문구 53** (꼭 6 · 권장 46 · 취향 1) · 남은 제안 **19** (꼭 4 · 권장 10 · 취향 5, 그 밖에 그대로 둘 것 3) · 사장님 확인 **12** (§10).

## 1. 역할 이름 (디자이너와 같은 이름을 쓴다)

| 역할 | 무엇 | 지금 DOM 자리 | 지금 글자 |
|---|---|---|---|
| **자세** | 내 지금 자세 이름 + 한 줄 설명 | `#guardName` b / span (오른쪽 위) | 15 px 굵게 / 11.5 px |
| **패시브·비기** | 유파 패시브 · 고유 동작 · 비기 이름 + 꼬리표('상대 독일 · 패시브') | `#techCue` b / small (가운데 위 31 %) → 사장님 지시로 **자세 아래 칸**으로 | 18~26 px(비기 22~34 px) / 13~14 px |
| **이름·칭호** | 상대 이름 · 칭호(epithet) | `#foeIntro` b / i | 20 px / 12.5 px |
| **대사** | 상대 시작·승리·부활 대사 | `#foeIntro` span, 결과 창 부제 | 13.5 px |
| **시스템** | 감정 한 줄(`#emoMsg`) · 큰 글자(`#toast` Battle·승리·패배) · 안내(`#hint`, `#foeIntro` em) · 상태 알림(경직·비기 준비 — 지금 `#techCue`) | 여러 곳 | 12.5~64 px |
| **카드** | 무기 카드 이름·부제·등급·설명·능력 · 칸 표시('내 무기'·'상대 무기'·'상대') | `#draw .wface` | 11~20 px |
| **창** | 시작·일시정지·결과 창 제목·부제·설정 줄·단추·조작 안내 · 세로 폰 가림막 | `.overlay`, `#rotate` | 12~26 px |

- '시스템' 안의 갈래 이름: **감정 한 줄 · 큰 글자 · 안내 · 상태 알림**. 디자이너 문서에도 이 넷을 쓰자(색은 감정 한 줄만 감정 색, 나머지는 시스템 색).
- '패시브·비기' 안의 종류 낱말(꼬리표 끝): **패시브 · 고유 동작 · 비기**(그리고 디버그 '기술'). '필살'·'스킬'·'특기' 따위는 쓰지 않는다 — 지금 화면에도 없다(grep 0).

## 2. 문구 수 (역할별, 부록 목록 기준)

| 역할 | 줄 | 화면에 실제로 뜨는 것 |
|---|---|---|
| 자세 (이름) | 104 | 유파 이름표 6 벌 × 14 + 바탕 16 + 몸 틀 표 |
| 자세 (설명) | 102 | 같은 자리의 desc |
| 패시브·비기 | 43 | 고유 동작 19 · 패시브 10 · 비기 8(수 이름 3 은 안 보임) · 속임수 6 |
| 패시브·비기 (디버그) | 90 | 공용 기술 이름 — 설정 '모든 기술 이름 보기'(기본 끔)에서만 |
| 꼬리표 | 6 | 유파 이름(독일·이탈리아·이베리아·일본·중국·무유파) |
| 이름·칭호 | 16 | 인물 9 (칭호 빈칸 2 — 오마리·미나미) |
| 대사 | 49 | 시작(intro)·승리(win)·부활(revive)·taunt |
| 대사 (안 보임) | 53 | attack·hurt·winning·losing·lose — 지금 화면에 띄우는 코드 없음 |
| 시스템 | 41 | 감정 한 줄 · 큰 글자 · 안내 · 상태 알림 · 꼬리표 낱말 |
| 카드 | 51 | 무기 17 × 이름·설명(+능력 3) · 등급 6 · 칸 표시 |
| 창 | 54 | 설정 줄 · 단추 · 조작 안내 · 결과 원인 · 가림막 |
| 기타 | 1 | 두삭 가지 이름(화면에 안 뜸) |
| **합계** | **610** | (개발자용 ?fps=1 글 9 줄은 뺐다) |

## 3. 가장 큰 문제 (지금 문구 → 무엇이 어긋나나)

1. **원어 병기 순서가 둘로 갈린다.** 자세·공용 기술은 '한국어 (원어)' — `지붕 (Vom Tag)` · `분노의 베기 (Zornhau)` · `머리 위 (altibaxo)` · `표두세 (豹頭勢)` — 인데, 서양 세 유파의 고유 동작·패시브·비기만 '원어 (한국어)' — `Krumphau (굽은 베기)` · `imbroccata (위에서 내려 찌르기)` · `talho e revez de baxo (규칙 Ⅰ 올려 베기)` · `Versetzen (받아 베기)`. 사장님이 처음 보는 상대 패시브가 독일어로 크게 뜬다. → **고침**(18 곳, §5-1).
2. **같은 원어를 철자 셋으로.** 이베리아 한 유파 안에서 `altibaxo`(자세) · `altibaixo`(고유 동작) · `altabaixo`(공용 기술), `baxo` · `baixo`, `revez` · `revés`. 사장님 결정은 '포르투갈어 철자(피게이레두)' → 피게이레두 철자(altibaxo · baxo · revez)로 **고침**(8 곳).
3. **나와 상대를 가르는 말이 들쭉날쭉.** 꼬리표가 내 것은 `내 일본 · 비기`, 상대 경직은 `상대 일본 · 비기 뒤`인데 상대 패시브·고유 동작·비기는 `일본 · 패시브`로 '상대'가 없다. 사장님 지시대로 패시브·비기를 내 자세 바로 아래 칸에 두면 상대 것과 내 것이 한자리에 뜨므로 '상대'가 빠지면 내 패시브로 읽힌다(플레이어는 패시브가 없다). → 규칙 §4-4, 구현자 몫(서식 코드).
4. **HUD 에 너무 긴 글.** 자세 설명 102 줄 중 40 줄이 35 자를 넘는다(가장 긴 것 `칼끝으로 상대 눈을 찌를 듯 겨누며 손을 오른 어깨 앞으로 끌어 상대 칼을 흘려 받는다 · 왼쪽에서 올려벤 칼이 끝나는 자리` 71 자 — 11.5 px 로 세 줄, 1.6 초). 패시브·비기 이름은 `비켜 서며 크게 가로베기 (talho de través) · 가칭` 37 자. → §4-6 길이 한도, §6 제안 4(짧은 설명 칸)·1(괄호 앞/안 두 줄).
5. **화면에 작업 메모가 보인다.** `고노센 · 가칭` · `연환삼격 (連環三擊) · 가칭` · `… (talho de través) · 가칭` · 일본 자세 `왼 어깨 (자세 아님)` · 이베리아 고유 동작 `규칙 Ⅰ 올려 베기`(원전 규칙 번호). 플레이어에겐 뜻 없는 말. → '규칙 Ⅰ' 은 고침(`번갈아 올려베기`), '가칭'·'(자세 아님)' 은 사장님 확인(§6).
6. **감정 한 줄의 때가 섞임.** `공포에 잠식되었다`(과거) · `분노가 폭발한다` · `집념이 생긴다` · `투지로 다시 일어선다`(현재). → 현재형 `공포에 잠식된다`로 **고침**(사장님 확인 표시). 상대 집념은 `집념을 보인다`로 주어가 없어 누구 것인지 모른다(사장님 결정 문구 — 제안만).
7. **안내 문장의 끝맺음이 제각각.** 같은 `#hint` 자리에 `…바꿨어요.`(해요체 + 마침표) · `…맞췄어요.` · `클릭해서 마우스 잠금 · WASD 이동 · 클릭하면 찌르기`(명사 · 명사 · 서술) · `끌어서 칼 휘두르기 · 톡 치면 찌르기 · …`. → 해요체 문장은 마침표 없이, 조작 요약은 '…기' 명사형 셋으로 **고침**.
8. **같은 기술을 다르게 부름.** `분노의 베기`(공용 기술) ↔ `분노 베기`(두삭 설명) · `가로베기` ↔ `가로 베기` · 이탈리아 설명 끝 `여기서 stoccata`(원어만 덩그러니). → **고침**(3 곳). 붙여 쓰는 기술 낱말은 다섯(내려베기·올려베기·가로베기·내려치기·올려치기)만으로 정함(§4-2).
9. **독일 롱소드 HUD 에 독일어 괄호가 반쯤.** 독일 유파는 유파 이름표가 없어 바탕 표가 그대로 뜬다: `지붕 (Vom Tag)` · `어깨 지붕 (Vom Tag)`(다른 자세 둘이 같은 원어) · `왼쪽 어깨 지붕`(원어 없음) · `옆 자세`(원어 없음). 바탕 이름은 열쇠라 못 고친다 → 화면 전용 이름표가 필요(§6 제안 5, 구현자·원전 작업자).
10. **맞춤법·띄어쓰기.** `막대기 뿐이라니` → `막대기뿐이라니`(조사 '뿐'은 붙임, 2 곳) · `장작패기보다` → `장작 패기보다` · `얼어 붙은 참치` → `얼어붙은 참치`(한 낱말) · `돌려주세요` → `돌려 주세요` · `W A S D (또는 방향키) 로` → `WASD 또는 방향키로` · 설명 속 괄호 앞 띄어쓰기 4 곳. → **고침**.
11. **따옴표·느낌표.** 조작 안내 `"똑바로"`(곧은 따옴표) — 대사는 굽은 `“ ”` 인데 섞임 → `‘똑바로’`로 **고침**. 같은 목록에 `머리가 약점!` 만 반말 느낌표 → `머리가 약점이에요.`
12. **설정 줄 이름의 꼴.** `조작 흔적 보기` · `자세 이름 보기` 옆에 `모든 기술 이름 표시 (디버그)` · `화면 갱신 60 fps 묶기`('묶기'는 뜻이 안 잡힘) · 단추 읽기 이름 `기울기 반전` ↔ 화면 `기울기 방향 반대로`. → **고침**(§5-6).

## 4. 규칙

### 4-1. 역할별 문체 (끝맺음)

| 역할 | 끝맺음 | 마침표 | 예 |
|---|---|---|---|
| 자세 이름 · 패시브·비기 이름 · 이름·칭호 · 카드 이름 · 설정 줄 · 단추 | **명사(구)** | 없음 | `조단` · `받아 베기 (Versetzen)` · `브루게의 견습생` · `다시 싸우기` |
| 자세 설명 · 카드 능력 | 명사구 또는 '~다' 서술, 마디는 ` · `로 | 없음 | `칼끝을 오른쪽 아래로 · 올려베기 준비` |
| 카드 설명 | '~다.' 문장 | **있음** (머무는 글) | `두 손으로 쥐는 균형 잡힌 장검.` |
| 감정 한 줄 | **'~다' 현재형** 서술 (해라체, 이야기하는 목소리) | 없음 | `공포에 잠식된다` · `오소리 브란의 분노가 폭발한다` |
| 결과 원인 | '~다' **과거형** (이미 끝난 일) | 없음 | `목을 베었다` · `피를 너무 흘렸다` |
| 큰 글자 | 명사 한두 낱말 | 없음 | `승리` · `패배` (사장님: 부호 없음) |
| 안내(`#hint`·카드 안내 em) · 창 부제 | **해요체**('~요'/'~세요') | 잠깐 뜨는 한 줄 = 없음 · 창 안 목록(조작 안내) = 있음 | `지금 각도를 기준으로 맞췄어요` · `무기 카드를 한 장 고르세요` · `설정을 바꾸거나 계속할 수 있어요.` |
| 조작 요약(`#hint` 싸움 시작) | '~기' 명사형 셋을 ` · `로 | 없음 | `조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기` |
| 상태 알림 | 명사 한 낱말(+ '준비') | 없음 | `경직` · `고노센 준비` |
| 대사 | 인물 말투 그대로(§7). 문장부호는 대사 안의 것을 살린다 | 대사대로 | `“…참 잘 드는군.”` |

- 존댓말(합쇼체 '~습니다')은 시스템 글에 쓰지 않는다. 대사(이졸데)에만.
- '~함' · '~음' 끝(메모체)은 쓰지 않는다 — 지금 화면에 없음(유지).

### 4-2. 문장부호·띄어쓰기

- **가운뎃점 ` · `**(앞뒤 한 칸) = 한 줄 안에서 마디를 나눌 때 하나뿐인 구분 기호. 쉼표로 마디를 나누지 않는다(문장 안 쉼표는 그대로).
- **괄호 ` (…)`** = 이름 병기에만, **앞에 한 칸**(검사기 name_policy 와 같은 꼴). 설명 속 덧붙임 괄호도 한 칸 띄움으로 통일(`내려벤다 (오모테 5)`). 괄호는 이름 끝에 하나만 — 괄호 뒤에 다른 말을 잇지 않는다(`… (talho de través) · 가칭` 같은 꼴은 §6 제안 1의 두 줄 나누기를 깬다).
- **따옴표**: 대사 = `“ ”`(코드가 붙인다), 강조·인용 낱말 = `‘ ’`. 곧은 따옴표 `" "` `' '` 는 화면에 쓰지 않는다.
- **말줄임표**: `…`(한 글자, U+2026) 하나. 점 셋 `...` 금지. 말 끊김은 줄표 `—`(대사만).
- **느낌표**: 대사·큰 글자에만. 시스템·창 글에 쓰지 않는다.
- **화살표 `→`**: 속임수 이름처럼 '이것에서 저것으로'에만, 앞뒤 한 칸.
- 기술 낱말 붙여 쓰기: **내려베기 · 올려베기 · 가로베기 · 내려치기 · 올려치기** 다섯은 붙임(굳은 기술 이름). 그 밖은 띄움(`돌려 베기` · `손 베기` · `받아 베기`). 서술은 띄움(`가로로 벤다`).
- 보조 용언은 띄움(`돌려 주세요`). 조사 '뿐'·'로'는 붙임.

### 4-3. 이름·칭호 순서와 구분 기호

- 인물: **이름이 위(크게), 칭호가 아래(작게)**. 한 줄에 모을 때는 `이름 · 칭호`(예 `하인리히 도른 · 미치광이`) — 지금 낮은 가로 화면 CSS 가 ` · ` 를 붙이는 것과 같다.
- 이름 칸에 별명이 붙은 것(`오소리 브란` · `광기의 하인리히 도른`)은 사장님 확정 이름 그대로 이름 칸에 둔다. 칭호를 이름 앞에 붙이지 않는다.
- 대사를 이름과 한 줄에 쓸 때(결과 창 부제): `원인 · 이름: “대사”`(지금 그대로).
- 칭호가 없는 인물(오마리·미나미)은 칭호 줄을 비운다(빈 괄호·대시 금지) — 칭호를 정할지는 §6 사장님 확인.

### 4-4. 꼬리표 낱말 — 나와 상대를 가르는 법

- 꼬리표 꼴 하나: **`[누구] [유파] · [종류]`**
  - 누구 = **`내`** 또는 **`상대`** — **늘 붙인다**(지금 상대 패시브·고유 동작·비기엔 빠져 있음 → 구현자: `ai.js setTechCue` 가 적는 `schoolKo` 또는 `main.js showTechCue` 서식에서 '상대 ' 를 앞에).
  - 유파 = `독일 · 이탈리아 · 이베리아 · 일본 · 중국 · 무유파`(TRADITIONS.nameKo 그대로).
  - 종류 = `패시브` · `고유 동작` · `비기` · (디버그) `기술`. 상태 알림의 꼬리표는 그 상태를 낳은 종류(`비기`)를 쓴다 — 지금 `비기 뒤` 는 본문 `경직` 과 겹쳐 `상대 일본 · 비기` 로 줄이길 권장.
- 예: `상대 독일 · 패시브` / `내 이탈리아 · 비기` / `상대 일본 · 비기` + 본문 `경직`.
- 색은 디자이너 몫이지만 **글로도 갈라야 한다**(색맹·흐린 화면). 그래서 '내'/'상대'는 색과 별도로 늘 쓴다.
- 무기 카드의 칸 표시도 같은 낱말: `내 무기` · `상대 무기` · 배지 `상대`(지금 그대로 — 맞음).
- 감정 한 줄: 상대는 **이름을 주어로**(`오소리 브란이 공포에 잠식된다`), 나는 **주어 없이**(`공포에 잠식된다`). '나'·'당신'을 쓰지 않는다. (예외: 상대 집념 `집념을 보인다` — 사장님 결정, §6 제안 11.)

### 4-5. 한자·원어 병기

| 갈래 | 데이터 꼴 (`nameKo`·자세 `name`) | 화면 — 큰 줄 | 화면 — 작은 줄 / 설명 칸 |
|---|---|---|---|
| 일본 유파 | 일본 독음 한글만 (사장님 방침) | `조단` · `츠바메가에시` | 없음 |
| 중국 유파 | `한글 독음 (漢字)` (사장님 방침) | `표두세` | `豹頭勢` |
| 독일·이탈리아·이베리아 | **`한국어 (원어)`** — 한국어가 앞 | `받아 베기` | `Versetzen` |
| 무유파 | 한국어만 | `머리 위` | 없음 |
| 무기 이름 | `이름 (부제)` | `츠바이핸더` | `대형 양손검` (지금 카드가 이미 이렇게 나눔) |

- 큰 줄/작은 줄 나누기는 무기 카드가 이미 쓰는 방식(괄호 앞 = 이름, 괄호 안 = 부제, `main.js` 무기 카드 `nameKo.match(/^(.*?)\s*\((.*)\)\s*$/)`)을 **자세·패시브·비기 칸에도 똑같이** 쓰자는 것(구현자 몫, §6 제안 1). 그러면 원어·한자는 지우지 않고(사장님 방침 그대로) 이름 줄 길이만 짧아진다.
- 원어 표기: 독일어 명사는 대문자(Krumphau), 이탈리아·포르투갈어는 소문자(imbroccata · talho) — 원어 맞춤법대로. 이베리아는 피게이레두 철자(altibaxo · baxo · revez · orizontal).
- 설명 칸 안에서 원어 낱말을 쓸 때도 `한국어 (원어)` 꼴(`여기서 찌른다 (stoccata)`). 원어만 덩그러니 두지 않는다.
- 숫자 자세: 이탈리아 `1번 자세 (Prima)` 꼴 유지(표 칸 이름 — hands.js 가 Prima 따위를 읽으므로 손대지 않음).

### 4-6. 길이 한도 (글자 수)

기준 폭: **358 px**(세로 390 px − 좌우 16 px). 게임은 가로로만 돌지만(세로 폰은 `#rotate` 가림막) 가로 844 px 폰의 오른쪽 위 칸(`#guardName` max-width 42 vw)이 354 px 로 거의 같아서 이 값 하나로 두 경우를 덮는다. 작은 가로 폰 568 px 에서는 그 칸이 238 px 라 아래 값 × 0.66.
셈법: 한글·한자 = 1, 로마자·숫자·공백 = 0.5, `·`·괄호 = 0.5. 글자 크기는 **지금 값** — 디자이너가 크기를 정하면 `358 ÷ 글자 크기(px)` 로 다시 셈한다(이 표의 숫자는 그때 고칠 값).

| 역할 | 지금 크기 | 한 줄에 드는 수 | **한도** | 줄 | 지금 가장 긴 것 |
|---|---|---|---|---|---|
| 자세 이름 (큰 줄) | 15 px | 23 | **12** | 한 줄 | `왼 비낀 자세 (postura obtusa)` 24 → 큰 줄만 `왼 비낀 자세` 6 |
| 자세 설명 | 11.5 px | 31 | **28** (짧은 설명) | 한 줄 | 71 (40 줄이 35 넘음) |
| 패시브·비기 이름 (큰 줄) | 자세 이름과 같게 (사장님 '서식 통일') | 23 | **12** | 한 줄 | 큰 줄만 `비켜 서며 크게 가로베기` 13 |
| 꼬리표 | 13 px | 27 | **14** | 한 줄 | `상대 이베리아 · 고유 동작` 15.5 → '고유 동작'만 넘음, 허용 16 |
| 이름 | 20 px | 17 | **12** | 한 줄 | `광기의 하인리히 도른` 10.5 |
| 칭호 | 12.5 px | 28 | **14** | 한 줄 | `아르키진나시오의 사서` 10.5 |
| 대사 | 13.5 px | 26 | **26** (최대 두 줄 48) | 한두 줄 | `기어서 살려 달라 하랬지. …아, 이제 못 기는군.` 25 |
| 감정 한 줄 (이름 포함) | 16 px | 22 | **22** | 한 줄(nowrap) | `광기의 하인리히 도른의 분노가 폭발한다` 19.5 |
| 큰 글자 | 최대 64 px | 5 | **4** | 한 줄 | `Battle` 3 · `승리` 2 |
| 안내 `#hint` | 13 px | 25 | **26** | 두 줄까지 | `조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기` 24.5 |
| 카드 안내 em | 12.5 px | 28 | **20** | 한 줄 | `무기 카드를 한 장 고르세요 (1 · 2)` 18 |
| 상태 알림 | 22~34 px | 10 | **6** | 한 줄 | `고노센 준비` 5.5 |
| 카드 이름 / 부제 | 16~20 px / 12 px | 카드 폭 따라 | **8 / 10** | 한 줄 | `건슬링어의 리볼버` 8 / `대형 양손검` 5.5 |
| 카드 설명 | 12~14 px | 카드 폭 따라 | **두 문장, 40** | 두세 줄 | 건슬링어 인용문 49 (fitCardText 가 줄임 — 사장님 확정 문구) |
| 설정 줄 | 14 px | 22(토글 자리 빼고) | **14** | 한 줄 | `모든 기술 이름 보기 (디버그)` 14 |

### 4-7. 숫자·단위

- 아라비아 숫자, 숫자와 단위 사이 한 칸: `60 fps` · `1.2 s`(화면에 초를 쓸 일이 생기면 `1.2초` — 한글 단위는 붙임).
- 키 이름은 원래 글자대로 붙여: `WASD` · `Esc` · `P` · 카드 번호 `1 · 2`.
- 원전 번호는 원전 표기 그대로: `규칙 Ⅰ`(로마 숫자) · `오모테 5` · `7본`. 다만 플레이어가 보는 이름 줄에는 원전 번호를 넣지 않는다(설명 칸·자료에만).
- 대사 속 수는 말로(`은화 열 닢`).

## 5. 고친 문구 (이 가지에서 실제로 바꾼 것 · 53)

급: 꼭 = 틀림·규칙 위반 / 권장 = 통일 / 취향. **확인** = 사장님 확인 필요(내용·말투가 바뀜).

### 5-1. 패시브·비기 — 서양 유파 이름 순서 '한국어 (원어)' (18) · 권장

| # | 위치 (src/schools.js) | 옛 문구 | 새 문구 | 비고 |
|---|---|---|---|---|
| 1 | german.unique[krumphau] | Krumphau (굽은 베기) | 굽은 베기 (Krumphau) | |
| 2 | german.unique[schielhau] | Schielhau (곁눈 베기) | 곁눈 베기 (Schielhau) | |
| 3 | german.unique[duplieren] | Duplieren (겹치기) | 겹치기 (Duplieren) | |
| 4 | german.unique[zwerchAbtritt] | Zwerch mit Abtritt (비껴 딛는 가로베기) | 비껴 딛는 가로베기 (Zwerch mit Abtritt) | |
| 5 | german.passives[indes] | Indes (맞받기) | 맞받기 (Indes) | |
| 6 | german.passives[nachreisen] | Nachreisen (따라 들어가기) | 따라 들어가기 (Nachreisen) | |
| 7 | german.passives[duplieren] | Duplieren (겹치기) | 겹치기 (Duplieren) | |
| 8 | german.secret | Versetzen (받아 베기) | 받아 베기 (Versetzen) | 확인(비기 이름이 크게 뜸) |
| 9 | italian.unique[imbroccata] | imbroccata (위에서 내려 찌르기) | 위에서 내려 찌르기 (imbroccata) | |
| 10 | italian.unique[passataSotto] | passata sotto (밑으로 들어가 찌르기) | 밑으로 들어가 찌르기 (passata sotto) | |
| 11 | italian.unique[inquartata] | inquartata (비껴서며 찌르기) | 비껴서며 찌르기 (inquartata) | |
| 12 | italian.passives[cavazione] | cavazione (맞물림에서 빼 찌름) | 맞물림에서 빼 찌르기 (cavazione) | '찌름' → '찌르기'(다른 이름과 같은 '~기') |
| 13 | italian.secret | Passata in contratempo (박자 밑 찌르기) | 박자 밑 찌르기 (passata in contratempo) | 확인 · 이탈리아어 소문자 |
| 14 | iberian.unique[redondo] | redondo (머리 위 돌려 베기) | 머리 위 돌려 베기 (redondo) | |
| 15 | iberian.unique[altibaixo] | altibaixo (위아래 사슬) | 위아래 사슬 (altibaxo) | 철자 피게이레두(자세표와 같게) |
| 16 | iberian.unique[talhoRevezBaixo] | talho e revez de baxo (규칙 Ⅰ 올려 베기) | 번갈아 올려베기 (talho e revez de baxo) | **확인** — '규칙 Ⅰ'(원전 번호) 대신 뜻('항상 아래에서 위로, 탈류와 레베스를 번갈아' — src 원문) |
| 17 | iberian.unique[talhoRodeado] | talho rodeado (둥근 걸음 탈류) | 둥근 걸음 탈류 (talho rodeado) | |
| 18 | iberian.secret | Talho de través (비켜 서며 크게 가로 베기 · 가칭) | 비켜 서며 크게 가로베기 (talho de través) · 가칭 | 확인 · '가칭'은 그대로 두었다(§6 제안 3) |

### 5-2. 패시브·비기(디버그) — 이베리아 공용 기술 철자 (6) · 권장

`revés (왼쪽 사선)` → `revez (왼쪽 사선)` · `altabaixo (위에서 아래로)` → `altibaxo (위에서 아래로)` · `revés horizontal` → `revez horizontal` · `talho de baixo (올려베기)` → `talho de baxo (올려베기)` · `revés de baixo` → `revez de baxo` · `talho e revés (규칙 1)` → `talho e revez (규칙 Ⅰ)` (src/schools.js TECH_NAMES.iberian). `estocada baixa` 는 피게이레두 철자를 확인 못 해 그대로.

### 5-3. 자세(설명) (7) · 권장

| # | 위치 | 옛 | 새 | 까닭 |
|---|---|---|---|---|
| 1 | schools.js DUSSACK '옆 자세' desc | 가로로 벤다(가운데 베기) | 가로로 벤다 (가운데 베기) | 괄호 앞 한 칸 |
| 2 | schools.js DUSSACK '왼쪽 옆 자세' desc | 가로 베기가 끝나 … | 가로베기가 끝나 … | 기술 낱말 붙임 |
| 3 | schools.js DUSSACK '왼쪽 바꿈' desc | … 분노 베기가 끝나는 자리 | … 분노의 베기가 끝나는 자리 | 같은 기술은 같은 이름 |
| 4 | schools.js 일본 '옆 자세' desc | 곧장 내려벤다(오모테 5) | 곧장 내려벤다 (오모테 5) | 괄호 |
| 5 | schools.js 일본 '왼쪽 옆 자세' desc | 비스듬히 벤다(오모테 4) | 비스듬히 벤다 (오모테 4) | 괄호 |
| 6 | schools.js 일본 '바꿈' desc | 올려베거나(키리아게) | 올려베거나 (키리아게) | 괄호 |
| 7 | schools.js 이탈리아 '쟁기' desc · frames.js heavy '왼쪽 어깨 지붕' desc | 여기서 stoccata · 반대쪽 사선 베기(revés) | 여기서 찌른다 (stoccata) · 반대쪽 사선 베기 (revez) | 원어만 두지 않기 · 철자 · 괄호 (2 곳) |

### 5-4. 대사 (3) · 꼭

| 위치 (src/characters.js) | 옛 | 새 | 까닭 |
|---|---|---|---|
| bran.taunt · bran.lines.intro[0] | 젠장! 이런 막대기 뿐이라니. | 젠장! 이런 막대기뿐이라니. | 조사 '뿐' 붙임 (2 곳) |
| bran.lines.win[2] | 장작패기보다 쉽구나, 널 패는 게. | 장작 패기보다 쉽구나, 널 패는 게. | '장작패기'는 한 낱말 아님 |

### 5-5. 카드 (1) · 꼭

| weapons.js frozen_tuna.desc | 얼어 붙은 참치. | 얼어붙은 참치. | '얼어붙다' 한 낱말 |
|---|---|---|---|

### 5-6. 시스템 · 창 (17)

| # | 위치 | 옛 | 새 | 급 |
|---|---|---|---|---|
| 1 | main.js EMO_TEXT.fear | 공포에 잠식되었다 | 공포에 잠식된다 | 권장 · **확인** (감정 줄 모두 현재형) |
| 2 | main.js 기울기 대체 안내 | 기울기 센서를 쓸 수 없어서 조이스틱으로 바꿨어요. | 기울기 센서를 쓸 수 없어 조이스틱으로 바꿨어요 | 권장 (잠깐 뜨는 한 줄 = 마침표 없음) |
| 3 | main.js ◎ 영점 안내 | 지금 각도를 기준으로 맞췄어요. | 지금 각도를 기준으로 맞췄어요 | 권장 |
| 4 | main.js 싸움 시작 안내 (PC) | 클릭해서 마우스 잠금 · WASD 이동 · 클릭하면 찌르기 | 클릭해서 마우스 잠그기 · WASD로 걷기 · 클릭으로 찌르기 | 권장 ('~기' 셋) |
| 5 | main.js 싸움 시작 안내 (기울기) | 끌어서 칼 휘두르기 · 톡 치면 찌르기 · 앞뒤/좌우로 기울여서 걷기 | 끌어서 휘두르기 · 톡 쳐서 찌르기 · 기울여서 걷기 | 권장 · 확인 (짧게 — '앞뒤/좌우로' 뺌) |
| 6 | main.js 싸움 시작 안내 (조이스틱) | 왼쪽 아래 조이스틱으로 걷기 · 나머지 화면을 끌어서 휘두르고 톡 쳐서 찌르기 | 조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기 | 권장 · 확인 (35 → 24.5 자, 두 줄 → 한 줄) |
| 7 | main.js 조작 안내(폰) | 지금 각도를 "똑바로"로 다시 맞춰요. | 지금 각도를 ‘똑바로’로 다시 맞춰요. | 꼭 (따옴표) |
| 8–9 | main.js 조작 안내(폰·PC) | 머리가 약점! | 머리가 약점이에요. | 권장 (2 곳) |
| 10 | main.js 조작 안내(PC) | W A S D (또는 방향키) 로 걸어요. | WASD 또는 방향키로 걸어요. | 꼭 (띄어쓰기) |
| 11 | main.js 조작 안내(PC) | Esc 로 마우스 잠금 해제, P 로 일시정지. | Esc로 마우스 잠금을 풀고, P로 일시정지해요. | 권장 (해요체) |
| 12–13 | index.html 설정 줄 + aria-label | 모든 기술 이름 표시 (디버그) | 모든 기술 이름 보기 (디버그) | 권장 ('~보기' 통일) |
| 14–15 | index.html 설정 줄 + aria-label | 화면 갱신 60 fps 묶기 | 화면 60 fps 제한 | 권장 · 확인 (뜻 분명히) |
| 16 | index.html aria-label | 기울기 반전 | 기울기 방향 반대로 | 권장 (화면 글과 같게) |
| 17 | index.html `#rotate` | 폰을 가로로 돌려주세요 | 폰을 가로로 돌려 주세요 | 취향 (보조 용언 띄움) |
| 18–20 | (주석) main.js 감정 알림 머리말 | — | 새 문구로 맞춤 | — |

- 합계: 패시브·비기 18 · 디버그 기술 6 · 자세 설명 8(5-3 의 7 행, 7 번이 2 곳) · 대사 3 · 카드 1 · 시스템 6 (5-6 의 1~6) · 창 11 (5-6 의 7~17) → **53** (주석 제외. 한 리터럴에 든 조작 안내 목록은 낱줄로 셈).
- 옛 표기는 `public/*/index.html`(예전 빌드 사본)에 남아 있다 — 배포 사본이라 손대지 않음.

## 6. 남은 제안 (코드 서식·설정·사장님 결정이 걸려 이 가지에서 고치지 않은 것 · 19 + 그대로 3)

| # | 무엇 | 지금 | 제안 | 급 | 누가 |
|---|---|---|---|---|---|
| 1 | 자세·패시브·비기 이름 두 줄 나누기 | 이름 전체가 한 줄(`#techCue b` 넘치면 … 으로 자름) | 괄호 앞 = 큰 줄, 괄호 안 = 작은 줄(꼬리표 줄 앞). 무기 카드와 같은 정규식 | **꼭** | 구현자 + 디자이너 |
| 2 | 상대 꼬리표에 '상대' | `일본 · 패시브` | `상대 일본 · 패시브` (§4-4) | **꼭** | 구현자 |
| 3 | 화면의 '가칭' | `고노센 · 가칭` · `연환삼격 (連環三擊) · 가칭` · `비켜 서며 크게 가로베기 (talho de través) · 가칭` | 화면에선 빼고 주석으로 (`고노센` · `연환삼격 (連環三擊)` · `비켜 서며 크게 가로베기 (talho de través)`). 검토 중 표시가 필요하면 디버그 설정에서만 | 권장 | **사장님 확인** |
| 4 | 자세 짧은 설명 칸 | desc 최대 71 자, 40 줄이 35 넘음 | 자세표 칸에 `short`(28 자 이하)를 더해 HUD 는 그것, 긴 desc 는 자료·도감용으로 남김. 예: 일본 '황소' → `흘려 받는 자세 · 올려벤 칼 끝`, 중국 '옆 지킴' → `웅크려 지키다 굴려 친다`, 이탈리아 '지붕' → `손을 얼굴 높이로 뻗어 겨눔`, 이베리아 '바보' → `모든 규칙의 처음과 끝` | **꼭**(길이) | 원전 작업자(문구) · 구현자 · **사장님 확인** |
| 5 | 독일 롱소드 HUD 이름 | 바탕 표 그대로: `지붕 (Vom Tag)`·`어깨 지붕 (Vom Tag)` 같은 원어 둘, 왼쪽 자세·옆 자세는 원어 없음 | 화면 전용 독일 이름표(두삭 가지처럼) — 예 `어깨 지붕 (Zornhut)`? 원어는 원전 작업자가 정함. 한손 몸 틀 표(`바깥 막기 (Seconda)`)가 독일 유파 무기에 뜨는지도 확인 | 권장 | 원전 작업자 · 구현자 |
| 6 | 일본 `왼 어깨 (자세 아님)` | 괄호 메모가 이름에 | 이름 `왼 어깨`, '(원전 자세 아님)'은 설명에 이미 있음 | 권장 | 원전 작업자 |
| 7 | 속임수 이름이 화면에 그대로 | `cavazione (위 찌르는 척 → 밑으로 돌려 찌름)` · `염시 (斂翅) · 찌르는 척 → 거둬 요격` (`feint.name` = 열쇠라 안 고침) | 화면용 칸(`feint.nameKo`)을 따로: `돌려 찌르는 척 (cavazione)` · `염시 (斂翅)`. 풀이는 설명 쪽 | 권장 | 구현자 |
| 8 | `고노센 준비` 하드코딩 | main.js 리터럴 | 비기 이름(`S.nameKo`) + ` 준비` 로 만들기 — 이름이 바뀌어도 따라감 | 권장 | 구현자 |
| 9 | 내 비기 창이 열림 / 실행 꼬리표가 같음 | 둘 다 `내 독일 · 비기` | 창 열림 = `내 독일 · 비기 — 지금 공격` 처럼 할 일을 말로 (디자이너는 흐림으로 이미 가름) | 권장 | 디자이너 · 구현자 |
| 10 | 경직 꼬리표 | `상대 일본 · 비기 뒤` | `상대 일본 · 비기` (본문 `경직` 과 겹침 줄이기) | 취향 | 구현자 |
| 11 | 상대 집념 주어 없음 | `집념을 보인다` (나는 `집념이 생긴다`) | `오소리 브란이 집념을 보인다` — 다른 감정과 같게 이름을 주어로 | 권장 | **사장님 확인**(사장님 결정 문구) |
| 12 | 칭호·대사 없는 인물 | 오마리·미나미 칭호 빈칸, 토메·오마리·미나미 대사 없음 | 칭호·시작·승리 대사 각 1~3 (캐릭터 PM) | 권장 | **사장님 확인** |
| 13 | 브란이 진짜 칼을 들 때(10 %) | 시작 대사 `젠장! 이런 막대기뿐이라니.` 가 칼을 들고도 나옴 | 무기에 따라 대사 고르기(구현) 또는 칼 든 판 대사 하나 더 | 권장 | 구현자 · **사장님 확인** |
| 14 | 큰 글자 `Battle` | 영어 한 낱말, 결과는 `승리`·`패배` | `결투` 또는 그대로(제목 `Stillness` 처럼 영어를 멋으로 쓴 것이면 유지) | 취향 | **사장님 확인** |
| 15 | 무기 등급 이름 | `쓰레기 · 커먼 · 레어 · 에픽 · 레전드 · ???` | 외래어 넷 + 우리말 하나가 섞임. 게임 관용(커먼…)으로 두려면 `쓰레기` → `정크`, 우리말로 가려면 `흔함 · 귀함 · 영웅 · 전설` | 취향 | **사장님 확인** |
| 16 | 중국 패시브 `자→격 (刺→擊) 고리` | 괄호가 가운데 → 제안 1의 나누기가 안 먹음 | 방침 검사기(괄호 앞 음절 수 = 한자 수)와 맞는 꼴을 원전 작업자와 정함 (예 `자격 고리 (刺擊)`?) | 취향 | 원전 작업자 |
| 17 | 이탈리아 유파 HUD 의 독일 이름 | 이탈리아 이름표가 5 자리뿐 — 나머지 자리에 바탕 이름(`어깨 지붕 (Vom Tag)` 등)이 뜰 수 있음 | 레이피어가 그 자리에 실제로 서는지 확인 후, 서면 이탈리아 이름 또는 무유파 쉬운 말 | 권장 | 구현자 · 원전 작업자 |
| 18 | 감정 한 줄 길이 | 이름이 길면 nowrap 으로 넘칠 수 있음(지금 최장 19.5 — 한도 안) | 이름 12 자 한도를 지키면 그대로 | — | 디자이너 |
| 19 | 결과 창 부제 | `원인 · 이름: “대사”` | 그대로(규칙과 맞음) | — | — |
| 20 | 랴오 안 보이는 대사 | losing `…이 철검, 생각보다 무겁군.` — 지금 무기는 청강검 | 화면에 띄울 날이 오면 무기에 맞게 | 취향 | 캐릭터 PM |
| 21 | 시작 화면 부제 · 제목 | `길 위에선 이름을 묻지 않는다.` · `Stillness` | 그대로(사장님 배포 문구) | — | — |
| 22 | 상태 알림 자리 | 경직·비기 준비·고노센 준비가 패시브·비기 칸과 같은 `#techCue` | 사장님 지시의 '패시브와 비기 칸'과 상태 알림을 가를지 디자이너가 정함 — 글은 §4-1 상태 알림 꼴 | **꼭**(배치 결정) | 디자이너 |

- 꼭 4: 1 · 2 · 4 · 22. 권장 10: 3 · 5 · 6 · 7 · 8 · 9 · 11 · 12 · 13 · 17. 취향 5: 10 · 14 · 15 · 16 · 20. 그대로 둘 것 3: 18 · 19 · 21 (규칙과 맞음 — 확인용으로 적음).

## 10. 사장님 확인이 필요한 것 (12)

- 이미 고친 것(되돌리기 쉬움): ① 서양 유파 패시브·고유 동작·비기 이름을 '한국어 (원어)' 순서로(18 곳 — 특히 비기 `받아 베기 (Versetzen)` · `박자 밑 찌르기 (passata in contratempo)` · `비켜 서며 크게 가로베기 (talho de través) · 가칭`) ② 이베리아 고유 동작 `규칙 Ⅰ 올려 베기` → `번갈아 올려베기` ③ 감정 한 줄 `공포에 잠식되었다` → `공포에 잠식된다` ④ 싸움 시작 조작 안내를 짧게(`조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기`) ⑤ 설정 줄 `화면 갱신 60 fps 묶기` → `화면 60 fps 제한`.
- 제안만 한 것: ⑥ 화면의 '가칭' 빼기(§6-3) ⑦ 자세 짧은 설명 칸(§6-4) ⑧ 상대 집념 `집념을 보인다` 에 이름 주어(§6-11) ⑨ 오마리·미나미 칭호, 토메·오마리·미나미 대사(§6-12) ⑩ 브란이 칼을 든 판의 시작 대사(§6-13) ⑪ 큰 글자 `Battle`(§6-14) ⑫ 무기 등급 이름(§6-15).

## 7. 대사와 인물 설정 (characters.js 인물 설명과 말투 대조)

| 인물 | 설정 (characters.js) | 말투 | 화면에 뜨는 대사 판정 |
|---|---|---|---|
| 오소리 브란 | 34, 화전민 나무꾼, 단순·다혈질, 은화 | 반말 · 느낌표 · 사투리 없음 | 맞음. `막대기뿐` 맞춤법만 고침. 10 % 칼 든 판과 시작 대사 어긋남(§6-13) |
| 이졸데 반 아커러 | 21, 길드 신입, 교본·사범, 침착 | 상대에겐 존댓말(`…입니다`·`갈게요`), 혼잣말은 짧은 반말 | 맞음(시작·승리 모두 존댓말, 부활 `한 번만 더. 정확하게.` 혼잣말) |
| 랴오 쓰위엔 | 40, 방랑, 심드렁·여유 | 낮춘 반말 `~군`·`~지`, 말줄임 | 맞음 |
| 하인리히 도른 | 46, 광인, 상대를 '버러지' | 하대 `~라`·`~구나`, 웃음 | 맞음(감독 확정) |
| 마르그레테 슈바르츠 | 58, 노장, 한없이 차분 | 짧은 평서 `~다`·`~군`, 물음 `~는가` | 맞음 |
| 광기의 하인리히 도른 | 밤의 왕 | 더 짧고 차가운 하대 | 맞음(사장님 확정 1종씩) |
| 토메 비달 · 오마리 · 미나미 | 샛별 저장소 — 설정 문구 안 가져옴 | — | 대사 없음(§6-12) |

- 대사 문장부호: 말줄임 `…` 한 글자 · 끊김 `—` · 물음표·느낌표 — 모두 규칙과 맞음. 대사 끝 마침표는 인물 말투의 일부라 그대로 둔다(대사만 예외).

## 8. 디자이너와 맞출 것

1. **역할 이름 다섯 + 둘**: 자세 / 패시브·비기 / 이름·칭호 / 시스템(감정 한 줄 · 큰 글자 · 안내 · 상태 알림) / 대사 + 카드 / 창. 두 문서가 같은 낱말을 쓴다.
2. **서식 통일(사장님 '모든 서식 통일하고 색만 다르게')**: 자세 칸과 패시브·비기 칸은 같은 두 줄 틀 — 큰 줄(이름, 괄호 앞) + 작은 줄(괄호 안 원어 · 꼬리표). 색만 종류(자세 / 패시브 / 고유 동작 / 비기 / 상태)와 누구(내 / 상대)로.
3. **길이 한도(§4-6)**는 지금 글자 크기 기준. 디자이너가 크기를 정하면 `358 ÷ px` 로 다시 셈해 이 문서 표를 고친다(편집자 몫). 한 줄 칸: 자세 이름 · 패시브·비기 이름 · 꼬리표 · 이름 · 칭호 · 감정 한 줄 · 상태 알림 · 큰 글자. 두 줄 허용: 대사 · 안내 · 카드 설명.
4. **줄 넘침 처리**: 한 줄 칸은 한도를 문구로 지키고, 넘치면 … 으로 자르기보다 작은 줄로 내리기(괄호 안). 자세 설명은 짧은 설명(28 자) 한 줄.
5. **꼬리표 꼴 `[내|상대] 유파 · 종류`** 는 디자이너가 꼬리표 자리·색을 정할 때 함께 넣는다(구현자에게 넘길 서식).

## 9. 관문 (고친 뒤 작업 트리)

| 관문 | 기대 | 결과 |
|---|---|---|
| `node tools/sim/fights12.mjs` (deprecated 줄 뺀 sha256 앞 8) | 5480fbd3 | **5480fbd3** |
| `node tools/sim/live_battery.mjs` | e7ee3d96 | **e7ee3d96** |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 433ac984 | **433ac984** |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | **12/12** |
| `node tools/sim/weapon_smoke.mjs` | OK 17/17 | **17/17** |
| `node tools/text/name_policy.mjs` | 위반 0 | **위반 0** (619 줄) |
| `npx vite build` | 통과 | **통과** |

- 교열 시트용 새 CSV·JSON: `node tools/text/extract_texts.mjs <경로>` — 경로는 보고에 적음(저장소엔 넣지 않음). 카드·설정 창 글은 `tools/text/texts.mjs` 가 이미 모으고 있어(메뉴·설정·무기 갈래) 도구는 고치지 않았다.

## 부록. 화면 글 전수 목록 (610 줄)

- `tools/text/texts.mjs` 의 `collectTexts()` 로 모은 줄(개발자용 ?fps=1 글 9 줄 뺌)에 역할·파일:줄·글자 수를 붙였다. 글자 수 = 코드 포인트 수(§4-6 셈법과 다름 — 로마자도 1). 줄 번호는 이 가지(고친 뒤) 기준이고, 바탕 표가 여러 표에 되풀이되는 줄은 첫 자리만.
- 역할 '대사(안 보임)' = 데이터엔 있지만 지금 화면에 띄우는 코드가 없는 줄. ⏎ = 줄바꿈.

| # | 파일:줄 | 열쇠 | 지금 문구 | 역할 | 글자 |
|---|---|---|---|---|---|
| 1 | src/weapons.js:350 | `longsword.nameKo` | 롱소드 | 카드 | 3 |
| 2 | src/weapons.js:351 | `longsword.desc` | 두 손으로 쥐는 균형 잡힌 장검. / 베기도 찌르기도 두루 잘한다. | 카드 | 37 |
| 3 | src/weapons.js:399 | `zweihander.nameKo` | 츠바이핸더 (대형 양손검) | 카드 | 14 |
| 4 | src/weapons.js:400 | `zweihander.desc` | 정예 용병이 쓰던 거대한 양손검. / 느리지만 맞으면 묵직하게 부순다. | 카드 | 39 |
| 5 | src/weapons.js:459 | `estoc.nameKo` | 에스톡 (찌르기검) | 카드 | 10 |
| 6 | src/weapons.js:460 | `estoc.desc` | 갑옷 틈을 파고드는 찌르기검. / 찌르기로 싸워야 제값을 한다. | 카드 | 35 |
| 7 | src/weapons.js:495 | `sabre.nameKo` | 세이버 (기병도) | 카드 | 9 |
| 8 | src/weapons.js:496 | `sabre.desc` | 가볍게 휘어진 기병의 한손 칼. / 빠르게 베고 빠지기 좋다. | 카드 | 34 |
| 9 | src/weapons.js:541 | `rapier.nameKo` | 레이피어 | 카드 | 4 |
| 10 | src/weapons.js:542 | `rapier.desc` | 길고 가는 르네상스 결투검. / 가장 빨리 찌르지만 베기는 약하다. | 카드 | 37 |
| 11 | src/weapons.js:585 | `falchion.nameKo` | 팔쉬온 (반달칼) | 카드 | 9 |
| 12 | src/weapons.js:586 | `falchion.desc` | 끝이 넓고 무거운 외날 칼. / 내려찍듯 베면 도끼처럼 들어간다. | 카드 | 36 |
| 13 | src/weapons.js:637 | `monohoshizao.nameKo` | 모노호시자오 | 카드 | 6 |
| 14 | src/weapons.js:638 | `monohoshizao.desc` | 사사키 코지로의 노다치. / 빨랫줄 장대라 불린 칼, 매섭게 벤다. (제비 베기: 출혈) | 카드 | 49 |
| 15 | src/weapons.js:642 | `monohoshizao.ability` | 제비 베기: 출혈 | 카드 | 9 |
| 16 | src/weapons.js:792 | `qinggang.nameKo` | 청강검 | 카드 | 3 |
| 17 | src/weapons.js:805 | `qinggang.desc` | 쇠도 진흙처럼 벤다던 전설의 검. / 가볍고 빠른 한손 양날검. (창천: 무기 절단) | 카드 | 47 |
| 18 | src/weapons.js:810 | `qinggang.ability` | 창천: 무기 절단 | 카드 | 9 |
| 19 | src/weapons.js:913 | `excalibur.nameKo` | 엑스칼리버 | 카드 | 5 |
| 20 | src/weapons.js:914 | `excalibur.desc` | 금빛 기운이 감도는 진짜 왕의 검. | 카드 | 19 |
| 21 | src/weapons.js:913 | `excalibur_replica.nameKo` | 엑스칼리버 | 카드 | 5 |
| 22 | src/weapons.js:931 | `excalibur_replica.desc` | 일단은 왕의 검 엑스칼리버, 라고 쓰여 있다. | 카드 | 25 |
| 23 | src/weapons.js:948 | `lightsaber.nameKo` | 라이트세이버 | 카드 | 6 |
| 24 | src/weapons.js:949 | `lightsaber.desc` | 먼 은하에서 온 빛의 칼. / 무게가 없어 맞대면 밀린다. (고온 플라스마: 갑옷 무시) | 카드 | 49 |
| 25 | src/weapons.js:959 | `lightsaber.ability` | 고온 플라스마: 갑옷 무시 | 카드 | 14 |
| 26 | src/weapons.js:1002 | `tree_branch.nameKo` | 나뭇가지 | 카드 | 4 |
| 27 | src/weapons.js:1003 | `tree_branch.desc` | 길에서 주운 나뭇가지. 날이 없다. / 세게 부딪히면 부러진다. 행운을 빈다. | 카드 | 43 |
| 28 | src/weapons.js:1032 | `rubber_chicken.nameKo` | 고무 닭 | 카드 | 4 |
| 29 | src/weapons.js:1033 | `rubber_chicken.desc` | 누르면 삑 소리 나는 고무 닭. | 카드 | 17 |
| 30 | src/weapons.js:1066 | `frozen_tuna.nameKo` | 냉동 참치 | 카드 | 5 |
| 31 | src/weapons.js:1067 | `frozen_tuna.desc` | 얼어붙은 참치. / 절대 부서지지 않는다. | 카드 | 23 |
| 32 | src/weapons.js:1102 | `pistol.nameKo` | 건슬링어의 리볼버 | 카드 | 9 |
| 33 | src/weapons.js:1103 | `pistol.desc` | 어느 왕의 검을 녹여 총신을 만들었다. / “검은 옷의 사내는 사막을 가로질러 달아났고, 총잡이는 그 뒤를 쫓았다.” | 카드 | 65 |
| 34 | src/weapons.js:1165 | `morgenstern.nameKo` | 모르겐슈테른 (가시 철퇴) | 카드 | 14 |
| 35 | src/weapons.js:1166 | `morgenstern.desc` | 가시 박은 쇠 공을 자루 끝에 단 둔기. / 갑옷 위로도 충격이 들어가고 투구를 벗긴다. | 카드 | 49 |
| 36 | src/weapons.js:728 | `uchigatana.nameKo` | 우치가타나 | 카드 | 5 |
| 37 | src/weapons.js:729 | `uchigatana.desc` | 무사가 허리에 꽂던 보통 크기의 카타나. / 한 칼에 내려벤다. | 카드 | 35 |
| 38 | src/weapons.js:51 | `TIER_LABEL.trash` | 쓰레기 | 카드 | 3 |
| 39 | src/weapons.js:51 | `TIER_LABEL.common` | 커먼 | 카드 | 2 |
| 40 | src/weapons.js:51 | `TIER_LABEL.rare` | 레어 | 카드 | 2 |
| 41 | src/weapons.js:51 | `TIER_LABEL.epic` | 에픽 | 카드 | 2 |
| 42 | src/weapons.js:51 | `TIER_LABEL.legend` | 레전드 | 카드 | 3 |
| 43 | src/weapons.js:51 | `TIER_LABEL.mystery` | ??? | 카드 | 3 |
| 44 | src/schools.js:641 | `TRADITIONS.german.nameKo` | 독일 | 꼬리표 | 2 |
| 45 | src/schools.js:641 | `TRADITIONS.german.branches['one:cut'].nameKo` | 두삭 (한손 베기) | 기타 | 10 |
| 46 | src/schools.js:245 | `TRADITIONS.german.branches['one:cut'].names['지붕 (Vom Tag)'].name` | 망루 (Wacht) | 자세 | 10 |
| 47 | src/schools.js:245 | `TRADITIONS.german.branches['one:cut'].names['지붕 (Vom Tag)'].desc` | 칼을 머리 위로 · 위에서 곧게 내려벤다 | 자세(설명) | 22 |
| 48 | src/schools.js:246 | `TRADITIONS.german.branches['one:cut'].names['어깨 지붕 (Vom Tag)'].name` | 분노 자세 (Zornhut) | 자세 | 15 |
| 49 | src/schools.js:246 | `TRADITIONS.german.branches['one:cut'].names['어깨 지붕 (Vom Tag)'].desc` | 칼을 오른 어깨에 메어 칼날은 뒤로 · 비스듬히 내려벤다 | 자세(설명) | 31 |
| 50 | src/schools.js:247 | `TRADITIONS.german.branches['one:cut'].names['황소 (Ochs)'].name` | 황소 (Stier) | 자세 | 10 |
| 51 | src/schools.js:247 | `TRADITIONS.german.branches['one:cut'].names['황소 (Ochs)'].desc` | 칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴 · 위에서 찌른다 | 자세(설명) | 33 |
| 52 | src/schools.js:121 | `TRADITIONS.german.branches['one:cut'].names['긴 자세 (Langort)'].name` | 긴 자세 (Langort) | 자세 | 14 |
| 53 | src/schools.js:248 | `TRADITIONS.german.branches['one:cut'].names['긴 자세 (Langort)'].desc` | 팔을 쭉 뻗어 칼끝으로 겨눈다 · 막기가 끝나는 자리 | 자세(설명) | 29 |
| 54 | src/schools.js:249 | `TRADITIONS.german.branches['one:cut'].names['옆 자세'].name` | 가운데 지킴 (Mittelhut) | 자세 | 18 |
| 55 | src/schools.js:249 | `TRADITIONS.german.branches['one:cut'].names['옆 자세'].desc` | 칼을 오른 옆 뒤로 눕힌다 · 가로로 벤다 (가운데 베기) | 자세(설명) | 32 |
| 56 | src/schools.js:250 | `TRADITIONS.german.branches['one:cut'].names['쟁기 (Pflug)'].name` | 멧돼지 (Eber) | 자세 | 10 |
| 57 | src/schools.js:250 | `TRADITIONS.german.branches['one:cut'].names['쟁기 (Pflug)'].desc` | 칼자루를 오른 허리 아래에, 칼끝은 상대 얼굴 · 아래에서 찌르고 올려벤다 | 자세(설명) | 41 |
| 58 | src/schools.js:128 | `TRADITIONS.german.branches['one:cut'].names['바꿈 (Wechsel)'].name` | 바꿈 (Wechsel) | 자세 | 12 |
| 59 | src/schools.js:251 | `TRADITIONS.german.branches['one:cut'].names['바꿈 (Wechsel)'].desc` | 칼끝을 오른쪽 아래 땅으로 · 올려베기 준비 | 자세(설명) | 24 |
| 60 | src/schools.js:130 | `TRADITIONS.german.branches['one:cut'].names['옆 지킴 (Nebenhut)'].name` | 옆 지킴 | 자세 | 4 |
| 61 | src/schools.js:234 | `TRADITIONS.german.branches['one:cut'].names['옆 지킴 (Nebenhut)'].desc` | 칼을 오른 허리 뒤로 숨긴다 | 자세(설명) | 15 |
| 62 | src/schools.js:253 | `TRADITIONS.german.branches['one:cut'].names['바보 (Alber)'].name` | 보루 (Bastei) | 자세 | 11 |
| 63 | src/schools.js:253 | `TRADITIONS.german.branches['one:cut'].names['바보 (Alber)'].desc` | 칼끝을 앞 땅으로 멀리 · 아래를 막고 올려친다 | 자세(설명) | 26 |
| 64 | src/schools.js:254 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 어깨 지붕'].name` | 왼 분노 자세 (Zornhut) | 자세 | 17 |
| 65 | src/schools.js:254 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 어깨 지붕'].desc` | 칼을 왼 어깨에 메어 칼날은 뒤로 · 왼쪽에서 비스듬히 내려벤다 | 자세(설명) | 35 |
| 66 | src/schools.js:255 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 황소'].name` | 왼 황소 (Stier) | 자세 | 12 |
| 67 | src/schools.js:255 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 황소'].desc` | 칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴 | 자세(설명) | 22 |
| 68 | src/schools.js:256 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 옆 자세'].name` | 왼 가운데 지킴 (Mittelhut) | 자세 | 20 |
| 69 | src/schools.js:256 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 옆 자세'].desc` | 가로베기가 끝나 칼이 왼 옆에 눕는다 · 되받아 가로로 | 자세(설명) | 30 |
| 70 | src/schools.js:141 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 쟁기'].name` | 왼 허리 겨눔 | 자세 | 7 |
| 71 | src/schools.js:257 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 쟁기'].desc` | 칼자루를 왼 허리에, 칼끝은 상대 얼굴 | 자세(설명) | 21 |
| 72 | src/schools.js:258 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 바꿈'].name` | 왼 바꿈 (Wechsel) | 자세 | 14 |
| 73 | src/schools.js:258 | `TRADITIONS.german.branches['one:cut'].names['왼쪽 바꿈'].desc` | 칼끝을 왼쪽 아래로 · 분노의 베기가 끝나는 자리 | 자세(설명) | 27 |
| 74 | src/schools.js:601 | `TRADITIONS.german.techNames.zornhau` | 분노의 베기 (Zornhau) | 패시브·비기(디버그) | 16 |
| 75 | src/schools.js:601 | `TRADITIONS.german.techNames.zornhauL` | 왼 분노의 베기 | 패시브·비기(디버그) | 8 |
| 76 | src/schools.js:601 | `TRADITIONS.german.techNames.oberhau` | 정수리 베기 (Oberhau·Scheitelhau 꼴) | 패시브·비기(디버그) | 30 |
| 77 | src/schools.js:601 | `TRADITIONS.german.techNames.zwerch` | 가로베기 (Zwerchhau) | 패시브·비기(디버그) | 16 |
| 78 | src/schools.js:601 | `TRADITIONS.german.techNames.zwerchL` | 왼 가로베기 | 패시브·비기(디버그) | 6 |
| 79 | src/schools.js:602 | `TRADITIONS.german.techNames.unterhau` | 올려베기 (Unterhau) | 패시브·비기(디버그) | 15 |
| 80 | src/schools.js:602 | `TRADITIONS.german.techNames.unterhauL` | 왼 올려베기 | 패시브·비기(디버그) | 6 |
| 81 | src/schools.js:602 | `TRADITIONS.german.techNames.stichPflug` | 쟁기 찌르기 (Pflug) | 패시브·비기(디버그) | 14 |
| 82 | src/schools.js:602 | `TRADITIONS.german.techNames.stichPflugL` | 왼 쟁기 찌르기 | 패시브·비기(디버그) | 8 |
| 83 | src/schools.js:602 | `TRADITIONS.german.techNames.stichOchs` | 황소 찌르기 (Ochs) | 패시브·비기(디버그) | 13 |
| 84 | src/schools.js:602 | `TRADITIONS.german.techNames.stichOchsL` | 왼 황소 찌르기 | 패시브·비기(디버그) | 8 |
| 85 | src/schools.js:602 | `TRADITIONS.german.techNames.stichAlber` | 바보 찌르기 (Alber) | 패시브·비기(디버그) | 14 |
| 86 | src/schools.js:603 | `TRADITIONS.german.techNames.talhoReves` | 분노의 베기 좌우 이어 (Zornhau 8자) | 패시브·비기(디버그) | 25 |
| 87 | src/schools.js:603 | `TRADITIONS.german.techNames.wristCut` | 손 베기 (Abschneiden 꼴) | 패시브·비기(디버그) | 20 |
| 88 | src/schools.js:603 | `TRADITIONS.german.techNames.molinello` | 돌려 베기 (Radschlag 꼴) | 패시브·비기(디버그) | 19 |
| 89 | src/schools.js:370 | `TRADITIONS.german.unique[krumphau].nameKo` | 굽은 베기 (Krumphau) | 패시브·비기 | 16 |
| 90 | src/schools.js:372 | `TRADITIONS.german.unique[schielhau].nameKo` | 곁눈 베기 (Schielhau) | 패시브·비기 | 17 |
| 91 | src/schools.js:374 | `TRADITIONS.german.unique[duplieren].nameKo` | 겹치기 (Duplieren) | 패시브·비기 | 15 |
| 92 | src/schools.js:380 | `TRADITIONS.german.unique[zwerchAbtritt].nameKo` | 비껴 딛는 가로베기 (Zwerch mit Abtritt) | 패시브·비기 | 31 |
| 93 | src/schools.js:458 | `TRADITIONS.german.passives[indes].nameKo` | 맞받기 (Indes) | 패시브·비기 | 11 |
| 94 | src/schools.js:460 | `TRADITIONS.german.passives[nachreisen].nameKo` | 따라 들어가기 (Nachreisen) | 패시브·비기 | 20 |
| 95 | src/schools.js:374 | `TRADITIONS.german.passives[duplieren].nameKo` | 겹치기 (Duplieren) | 패시브·비기 | 15 |
| 96 | src/schools.js:507 | `TRADITIONS.german.secret.nameKo` | 받아 베기 (Versetzen) | 패시브·비기 | 17 |
| 97 | src/schools.js:645 | `TRADITIONS.italian.nameKo` | 이탈리아 | 꼬리표 | 4 |
| 98 | src/schools.js:684 | `TRADITIONS.italian.names['지붕 (Vom Tag)'].name` | 1번 자세 (Prima) | 자세 | 13 |
| 99 | src/schools.js:684 | `TRADITIONS.italian.names['지붕 (Vom Tag)'].desc` | 팔을 앞·위로 뻗어 손을 얼굴 높이에, 칼끝은 곧게 상대에게 · 몸을 숙인다 · 팔이 쉬 지친다 | 자세(설명) | 53 |
| 100 | src/schools.js:686 | `TRADITIONS.italian.names['황소 (Ochs)'].name` | 2번 자세 (Seconda) | 자세 | 15 |
| 101 | src/schools.js:686 | `TRADITIONS.italian.names['황소 (Ochs)'].desc` | 팔을 뻗어 손을 어깨 높이에, 손바닥을 아래로 · 칼끝은 곧게 상대에게 | 자세(설명) | 39 |
| 102 | src/schools.js:688 | `TRADITIONS.italian.names['쟁기 (Pflug)'].name` | 3번 자세 (Terza) | 자세 | 13 |
| 103 | src/schools.js:688 | `TRADITIONS.italian.names['쟁기 (Pflug)'].desc` | 칼 팔을 조금 굽혀 손을 몸 가운데 높이에, 칼끝은 상대 몸 가운데 · 몸을 옆으로 세워 뒤로 기댄다 · 여기서 찌른다 (stoccata) | 자세(설명) | 77 |
| 104 | src/schools.js:690 | `TRADITIONS.italian.names['긴 자세 (Langort)'].name` | 뻗은 3번 자세 (Terza) | 자세 | 16 |
| 105 | src/schools.js:690 | `TRADITIONS.italian.names['긴 자세 (Langort)'].desc` | 팔을 곧게 뻗어 칼끝으로 상대 얼굴을 겨눈다 · 찌르기가 끝나는 자리 | 자세(설명) | 38 |
| 106 | src/schools.js:692 | `TRADITIONS.italian.names['왼쪽 쟁기'].name` | 4번 자세 (Quarta) | 자세 | 14 |
| 107 | src/schools.js:692 | `TRADITIONS.italian.names['왼쪽 쟁기'].desc` | 손바닥을 위로 돌려 팔을 안쪽 줄로 뻗는다 · 칼끝은 곧게 상대에게 | 자세(설명) | 37 |
| 108 | src/schools.js:606 | `TRADITIONS.italian.techNames.zornhau` | mandritto squalembrato (오른쪽 사선 내려베기) | 패시브·비기(디버그) | 36 |
| 109 | src/schools.js:606 | `TRADITIONS.italian.techNames.zornhauL` | riverso squalembrato (왼쪽 사선) | 패시브·비기(디버그) | 28 |
| 110 | src/schools.js:606 | `TRADITIONS.italian.techNames.oberhau` | fendente (곧게 내려베기) | 패시브·비기(디버그) | 18 |
| 111 | src/schools.js:606 | `TRADITIONS.italian.techNames.zwerch` | mandritto tondo (가로) | 패시브·비기(디버그) | 20 |
| 112 | src/schools.js:606 | `TRADITIONS.italian.techNames.zwerchL` | riverso tondo | 패시브·비기(디버그) | 13 |
| 113 | src/schools.js:607 | `TRADITIONS.italian.techNames.unterhau` | montante (올려베기 — 이탈리아 말) | 패시브·비기(디버그) | 24 |
| 114 | src/schools.js:607 | `TRADITIONS.italian.techNames.unterhauL` | riverso montante | 패시브·비기(디버그) | 16 |
| 115 | src/schools.js:607 | `TRADITIONS.italian.techNames.stichPflug` | stoccata (terza 에서 아래로부터) | 패시브·비기(디버그) | 25 |
| 116 | src/schools.js:607 | `TRADITIONS.italian.techNames.stichPflugL` | punta riversa (quarta 에서) | 패시브·비기(디버그) | 25 |
| 117 | src/schools.js:608 | `TRADITIONS.italian.techNames.stichOchs` | punta dritta alta (seconda) | 패시브·비기(디버그) | 27 |
| 118 | src/schools.js:608 | `TRADITIONS.italian.techNames.stichOchsL` | punta riversa alta | 패시브·비기(디버그) | 18 |
| 119 | src/schools.js:608 | `TRADITIONS.italian.techNames.stichAlber` | stoccata bassa | 패시브·비기(디버그) | 14 |
| 120 | src/schools.js:609 | `TRADITIONS.italian.techNames.talhoReves` | mandritto e riverso | 패시브·비기(디버그) | 19 |
| 121 | src/schools.js:609 | `TRADITIONS.italian.techNames.wristCut` | stramazzone (손목 끝 베기) | 패시브·비기(디버그) | 21 |
| 122 | src/schools.js:609 | `TRADITIONS.italian.techNames.molinello` | molinello | 패시브·비기(디버그) | 9 |
| 123 | src/schools.js:386 | `TRADITIONS.italian.unique[imbroccata].nameKo` | 위에서 내려 찌르기 (imbroccata) | 패시브·비기 | 23 |
| 124 | src/schools.js:389 | `TRADITIONS.italian.unique[passataSotto].nameKo` | 밑으로 들어가 찌르기 (passata sotto) | 패시브·비기 | 27 |
| 125 | src/schools.js:391 | `TRADITIONS.italian.unique[cavazione].feint.name` | cavazione (위 찌르는 척 → 밑으로 돌려 찌름) | 패시브·비기 | 31 |
| 126 | src/schools.js:393 | `TRADITIONS.italian.unique[inquartata].nameKo` | 비껴서며 찌르기 (inquartata) | 패시브·비기 | 21 |
| 127 | src/schools.js:468 | `TRADITIONS.italian.passives[cavazione].nameKo` | 맞물림에서 빼 찌르기 (cavazione) | 패시브·비기 | 23 |
| 128 | src/schools.js:518 | `TRADITIONS.italian.secret.nameKo` | 박자 밑 찌르기 (passata in contratempo) | 패시브·비기 | 33 |
| 129 | src/schools.js:648 | `TRADITIONS.iberian.nameKo` | 이베리아 | 꼬리표 | 4 |
| 130 | src/schools.js:227 | `TRADITIONS.iberian.names['지붕 (Vom Tag)'].name` | 머리 위 (altibaxo) | 자세 | 15 |
| 131 | src/schools.js:227 | `TRADITIONS.iberian.names['지붕 (Vom Tag)'].desc` | 칼을 이마 위로 들고 칼끝은 뒤로 · 곧게 내려친다 | 자세(설명) | 28 |
| 132 | src/schools.js:228 | `TRADITIONS.iberian.names['어깨 지붕 (Vom Tag)'].name` | 탈류 준비 (talho) | 자세 | 13 |
| 133 | src/schools.js:228 | `TRADITIONS.iberian.names['어깨 지붕 (Vom Tag)'].desc` | 칼을 오른 어깨에 메어 칼끝은 뒤로 · 오른쪽 위에서 비스듬히 내려벤다 | 자세(설명) | 39 |
| 134 | src/schools.js:229 | `TRADITIONS.iberian.names['황소 (Ochs)'].name` | 귀 앞 겨눔 (orelha direyta) | 자세 | 23 |
| 135 | src/schools.js:229 | `TRADITIONS.iberian.names['황소 (Ochs)'].desc` | 칼자루를 오른 귀 앞 높이에, 칼끝은 오른 대각으로 들어 · 올려 벤 레베스가 멈추는 자리 | 자세(설명) | 50 |
| 136 | src/schools.js:230 | `TRADITIONS.iberian.names['긴 자세 (Langort)'].name` | 곧은 자세 (postura recta) | 자세 | 21 |
| 137 | src/schools.js:230 | `TRADITIONS.iberian.names['긴 자세 (Langort)'].desc` | 칼을 얼굴 앞 가운데에 곧게 · 베기마다 여기 멈춘다 | 자세(설명) | 29 |
| 138 | src/schools.js:231 | `TRADITIONS.iberian.names['옆 자세'].name` | 가로 탈류 (talho orizontal) | 자세 | 23 |
| 139 | src/schools.js:231 | `TRADITIONS.iberian.names['옆 자세'].desc` | 칼을 오른쪽에 가로로 눕힌다 · 가로로 벤다 | 자세(설명) | 24 |
| 140 | src/schools.js:232 | `TRADITIONS.iberian.names['쟁기 (Pflug)'].name` | 비낀 자세 (postura obtusa) | 자세 | 22 |
| 141 | src/schools.js:232 | `TRADITIONS.iberian.names['쟁기 (Pflug)'].desc` | 오른손을 허리띠 앞에, 칼은 오른 대각으로 비껴 · 찌르기를 받아 탈류로 쳐낸다 | 자세(설명) | 44 |
| 142 | src/schools.js:233 | `TRADITIONS.iberian.names['바꿈 (Wechsel)'].name` | 아래 탈류 (talho de baxo) | 자세 | 21 |
| 143 | src/schools.js:233 | `TRADITIONS.iberian.names['바꿈 (Wechsel)'].desc` | 칼끝을 오른쪽 아래로 · 아래에서 위로 탈류를 올린다 | 자세(설명) | 29 |
| 144 | src/schools.js:234 | `TRADITIONS.iberian.names['옆 지킴 (Nebenhut)'].name` | 뒤 탈류 (talho por detras) | 자세 | 23 |
| 145 | src/schools.js:234 | `TRADITIONS.iberian.names['옆 지킴 (Nebenhut)'].desc` | 칼을 오른 허리 뒤로 숨긴다 · 뒤에서 앞으로 탈류 | 자세(설명) | 28 |
| 146 | src/schools.js:235 | `TRADITIONS.iberian.names['바보 (Alber)'].name` | 칼끝 땅에 (ponta no chão) | 자세 | 21 |
| 147 | src/schools.js:235 | `TRADITIONS.iberian.names['바보 (Alber)'].desc` | 몸을 곧게, 칼끝을 앞 땅으로 · 모든 규칙이 여기서 시작해 여기로 끝난다 | 자세(설명) | 41 |
| 148 | src/schools.js:236 | `TRADITIONS.iberian.names['왼쪽 어깨 지붕'].name` | 레베스 준비 (revez) | 자세 | 14 |
| 149 | src/schools.js:236 | `TRADITIONS.iberian.names['왼쪽 어깨 지붕'].desc` | 머리 위로 넘긴 칼을 왼 어깨에 떨군다 · 왼쪽에서 감아 벤다 | 자세(설명) | 34 |
| 150 | src/schools.js:237 | `TRADITIONS.iberian.names['왼쪽 황소'].name` | 왼 높이 비낌 (linha obtusa) | 자세 | 22 |
| 151 | src/schools.js:237 | `TRADITIONS.iberian.names['왼쪽 황소'].desc` | 칼을 머리 앞 왼쪽 높이에 비껴 멈춘다 | 자세(설명) | 21 |
| 152 | src/schools.js:238 | `TRADITIONS.iberian.names['왼쪽 옆 자세'].name` | 가로 레베스 (revez orizontal) | 자세 | 24 |
| 153 | src/schools.js:238 | `TRADITIONS.iberian.names['왼쪽 옆 자세'].desc` | 칼을 왼쪽에 가로로 · 왼쪽에서 가로로 벤다 | 자세(설명) | 24 |
| 154 | src/schools.js:239 | `TRADITIONS.iberian.names['왼쪽 쟁기'].name` | 왼 비낀 자세 (postura obtusa) | 자세 | 24 |
| 155 | src/schools.js:239 | `TRADITIONS.iberian.names['왼쪽 쟁기'].desc` | 칼을 왼 대각으로 비껴 · 찌르기를 레베스로 쳐낸다 | 자세(설명) | 28 |
| 156 | src/schools.js:240 | `TRADITIONS.iberian.names['왼쪽 바꿈'].name` | 아래 레베스 (revez de baxo) | 자세 | 22 |
| 157 | src/schools.js:240 | `TRADITIONS.iberian.names['왼쪽 바꿈'].desc` | 칼끝을 왼쪽 아래로 · 아래에서 위로 레베스를 올린다 | 자세(설명) | 29 |
| 158 | src/schools.js:612 | `TRADITIONS.iberian.techNames.zornhau` | talho (오른쪽 사선) | 패시브·비기(디버그) | 14 |
| 159 | src/schools.js:612 | `TRADITIONS.iberian.techNames.zornhauL` | revez (왼쪽 사선) | 패시브·비기(디버그) | 13 |
| 160 | src/schools.js:612 | `TRADITIONS.iberian.techNames.oberhau` | altibaxo (위에서 아래로) | 패시브·비기(디버그) | 18 |
| 161 | src/schools.js:612 | `TRADITIONS.iberian.techNames.zwerch` | talho horizontal | 패시브·비기(디버그) | 16 |
| 162 | src/schools.js:612 | `TRADITIONS.iberian.techNames.zwerchL` | revez horizontal | 패시브·비기(디버그) | 16 |
| 163 | src/schools.js:613 | `TRADITIONS.iberian.techNames.unterhau` | talho de baxo (올려베기) | 패시브·비기(디버그) | 20 |
| 164 | src/schools.js:613 | `TRADITIONS.iberian.techNames.unterhauL` | revez de baxo | 패시브·비기(디버그) | 13 |
| 165 | src/schools.js:613 | `TRADITIONS.iberian.techNames.stichPflug` | estocada | 패시브·비기(디버그) | 8 |
| 166 | src/schools.js:613 | `TRADITIONS.iberian.techNames.stichPflugL` | estocada (왼쪽) | 패시브·비기(디버그) | 13 |
| 167 | src/schools.js:613 | `TRADITIONS.iberian.techNames.stichOchs` | estocada alta | 패시브·비기(디버그) | 13 |
| 168 | src/schools.js:613 | `TRADITIONS.iberian.techNames.stichOchsL` | estocada alta (왼쪽) | 패시브·비기(디버그) | 18 |
| 169 | src/schools.js:613 | `TRADITIONS.iberian.techNames.stichAlber` | estocada baixa | 패시브·비기(디버그) | 14 |
| 170 | src/schools.js:614 | `TRADITIONS.iberian.techNames.talhoReves` | talho e revez (규칙 Ⅰ) | 패시브·비기(디버그) | 20 |
| 171 | src/schools.js:614 | `TRADITIONS.iberian.techNames.wristCut` | talho curto (손 베기) | 패시브·비기(디버그) | 18 |
| 172 | src/schools.js:526 | `TRADITIONS.iberian.techNames.molinello` | molinete | 패시브·비기(디버그) | 8 |
| 173 | src/schools.js:428 | `TRADITIONS.iberian.unique[redondo].nameKo` | 머리 위 돌려 베기 (redondo) | 패시브·비기 | 20 |
| 174 | src/schools.js:430 | `TRADITIONS.iberian.unique[altibaixo].nameKo` | 위아래 사슬 (altibaxo) | 패시브·비기 | 17 |
| 175 | src/schools.js:437 | `TRADITIONS.iberian.unique[talhoRevezBaixo].nameKo` | 번갈아 올려베기 (talho e revez de baxo) | 패시브·비기 | 32 |
| 176 | src/schools.js:438 | `TRADITIONS.iberian.unique[talhoRodeado].nameKo` | 둥근 걸음 탈류 (talho rodeado) | 패시브·비기 | 24 |
| 177 | src/schools.js:474 | `TRADITIONS.iberian.passives[talhoParry].nameKo` | 베어서 막기 (talho) | 패시브·비기 | 14 |
| 178 | src/schools.js:476 | `TRADITIONS.iberian.passives[seguirRoda].nameKo` | 이어 돌기 | 패시브·비기 | 5 |
| 179 | src/schools.js:527 | `TRADITIONS.iberian.secret.nameKo` | 비켜 서며 크게 가로베기 (talho de través) · 가칭 | 패시브·비기 | 36 |
| 180 | src/schools.js:653 | `TRADITIONS.japanese.nameKo` | 일본 | 꼬리표 | 2 |
| 181 | src/schools.js:113 | `TRADITIONS.japanese.names['지붕 (Vom Tag)'].name` | 조단 | 자세 | 2 |
| 182 | src/schools.js:113 | `TRADITIONS.japanese.names['지붕 (Vom Tag)'].desc` | 두 손을 이마 위로 들고 칼끝은 뒤로 비스듬히, 왼발 앞 · 상대가 치려는 박자에 한 칼로 내려벤다 | 자세(설명) | 55 |
| 183 | src/schools.js:115 | `TRADITIONS.japanese.names['어깨 지붕 (Vom Tag)'].name` | 핫소 | 자세 | 2 |
| 184 | src/schools.js:115 | `TRADITIONS.japanese.names['어깨 지붕 (Vom Tag)'].desc` | 조단에서 오른 주먹을 오른 어깨까지 내린 꼴 · 날밑은 입 높이, 칼은 서고 날은 상대 쪽, 왼발 앞 | 자세(설명) | 56 |
| 185 | src/schools.js:118 | `TRADITIONS.japanese.names['황소 (Ochs)'].name` | 히키나가시 | 자세 | 5 |
| 186 | src/schools.js:118 | `TRADITIONS.japanese.names['황소 (Ochs)'].desc` | 칼끝으로 상대 눈을 찌를 듯 겨누며 손을 오른 어깨 앞으로 끌어 상대 칼을 흘려 받는다 · 왼쪽에서 올려벤 칼이 끝나는 자리 | 자세(설명) | 69 |
| 187 | src/schools.js:121 | `TRADITIONS.japanese.names['긴 자세 (Langort)'].name` | 추단 | 자세 | 2 |
| 188 | src/schools.js:121 | `TRADITIONS.japanese.names['긴 자세 (Langort)'].desc` | 칼끝을 상대 두 눈 사이에 두고 두 손은 배꼽 앞 · 오른발 앞, 몸은 바로 · 자세의 본뜻, 쉴 자세 | 자세(설명) | 57 |
| 189 | src/schools.js:123 | `TRADITIONS.japanese.names['옆 자세'].name` | 미기와키 | 자세 | 4 |
| 190 | src/schools.js:123 | `TRADITIONS.japanese.names['옆 자세'].desc` | 칼을 오른 어깨 높이에 가로로 눕힌다 · 받아서 조단으로 올려 곧장 내려벤다 (오모테 5) · 위나 옆이 막힌 곳의 자세 | 자세(설명) | 67 |
| 191 | src/schools.js:126 | `TRADITIONS.japanese.names['쟁기 (Pflug)'].name` | 히라세이간 | 자세 | 5 |
| 192 | src/schools.js:126 | `TRADITIONS.japanese.names['쟁기 (Pflug)'].desc` | 추단에서 손을 조금 오른쪽·아래로 내리고 칼끝은 상대 왼눈 · 칼날을 오른쪽으로 비튼다 | 자세(설명) | 48 |
| 193 | src/schools.js:128 | `TRADITIONS.japanese.names['바꿈 (Wechsel)'].name` | 우게조 | 자세 | 3 |
| 194 | src/schools.js:128 | `TRADITIONS.japanese.names['바꿈 (Wechsel)'].desc` | 친 칼을 오른쪽 아래로 감춘다 · 여기서 올려베거나 (키리아게) 다시 머리 위로 든다 | 자세(설명) | 47 |
| 195 | src/schools.js:130 | `TRADITIONS.japanese.names['옆 지킴 (Nebenhut)'].name` | 와키가마에 | 자세 | 5 |
| 196 | src/schools.js:130 | `TRADITIONS.japanese.names['옆 지킴 (Nebenhut)'].desc` | 오른발을 뒤로 왼 반신, 칼을 오른 옆에 두고 칼끝은 뒤 아래로 · 칼 길이를 상대에게 감춘다 | 자세(설명) | 52 |
| 197 | src/schools.js:133 | `TRADITIONS.japanese.names['바보 (Alber)'].name` | 게단 | 자세 | 2 |
| 198 | src/schools.js:133 | `TRADITIONS.japanese.names['바보 (Alber)'].desc` | 손은 추단 그대로 두고 칼끝을 상대 무릎 조금 아래로 내린다 · 아래에서 상대 손을 친다 | 자세(설명) | 49 |
| 199 | src/schools.js:135 | `TRADITIONS.japanese.names['왼쪽 어깨 지붕'].name` | 왼 어깨 (자세 아님) | 자세 | 12 |
| 200 | src/schools.js:135 | `TRADITIONS.japanese.names['왼쪽 어깨 지붕'].desc` | 칼을 왼 어깨에 세운다 · 왼쪽 사선 베기가 지나는 자리 (원전 자세 아님) | 자세(설명) | 42 |
| 201 | src/schools.js:138 | `TRADITIONS.japanese.names['왼쪽 황소'].name` | 우케나가시 | 자세 | 5 |
| 202 | src/schools.js:138 | `TRADITIONS.japanese.names['왼쪽 황소'].desc` | 몸을 왼쪽으로 열며 칼을 왼쪽 위로 들어 상대 칼을 칼 옆면으로 흘린다 · 오른쪽 아래에서 올려벤 칼이 끝나는 자리 | 자세(설명) | 64 |
| 203 | src/schools.js:140 | `TRADITIONS.japanese.names['왼쪽 옆 자세'].name` | 히다리와키 | 자세 | 5 |
| 204 | src/schools.js:140 | `TRADITIONS.japanese.names['왼쪽 옆 자세'].desc` | 칼을 왼 옆구리에 가로로 · 아래에서 상대 손을 치고 내 어깨 위로 비스듬히 벤다 (오모테 4) | 자세(설명) | 53 |
| 205 | src/schools.js:142 | `TRADITIONS.japanese.names['왼쪽 쟁기'].name` | 사사에 | 자세 | 3 |
| 206 | src/schools.js:142 | `TRADITIONS.japanese.names['왼쪽 쟁기'].desc` | 두 손을 뻗어 칼끝을 왼쪽 아래로 비스듬히 · 칼 옆면으로 상대 찌르기를 받친다 (7본) | 자세(설명) | 49 |
| 207 | src/schools.js:144 | `TRADITIONS.japanese.names['왼쪽 바꿈'].name` | 사조 | 자세 | 2 |
| 208 | src/schools.js:144 | `TRADITIONS.japanese.names['왼쪽 바꿈'].desc` | 칼끝을 왼쪽 아래로 감춘다 · 케사가 끝나는 자리, 여기서 갸쿠케사로 되올린다 | 자세(설명) | 43 |
| 209 | src/schools.js:617 | `TRADITIONS.japanese.techNames.zornhau` | 케사기리 | 패시브·비기(디버그) | 4 |
| 210 | src/schools.js:617 | `TRADITIONS.japanese.techNames.zornhauL` | 히다리케사 | 패시브·비기(디버그) | 5 |
| 211 | src/schools.js:617 | `TRADITIONS.japanese.techNames.oberhau` | 맛코 (정수리 베기) · 쇼멘우치 | 패시브·비기(디버그) | 18 |
| 212 | src/schools.js:617 | `TRADITIONS.japanese.techNames.zwerch` | 도 | 패시브·비기(디버그) | 1 |
| 213 | src/schools.js:617 | `TRADITIONS.japanese.techNames.zwerchL` | 갸쿠도 | 패시브·비기(디버그) | 3 |
| 214 | src/schools.js:618 | `TRADITIONS.japanese.techNames.unterhau` | 키리아게 | 패시브·비기(디버그) | 4 |
| 215 | src/schools.js:618 | `TRADITIONS.japanese.techNames.unterhauL` | 갸쿠케사 | 패시브·비기(디버그) | 4 |
| 216 | src/schools.js:618 | `TRADITIONS.japanese.techNames.stichPflug` | 츠키 (세이간에서) | 패시브·비기(디버그) | 10 |
| 217 | src/schools.js:618 | `TRADITIONS.japanese.techNames.stichPflugL` | 츠키 (왼 허리에서) | 패시브·비기(디버그) | 11 |
| 218 | src/schools.js:618 | `TRADITIONS.japanese.techNames.stichOchs` | 츠키 (머리 옆에서) | 패시브·비기(디버그) | 11 |
| 219 | src/schools.js:618 | `TRADITIONS.japanese.techNames.stichOchsL` | 츠키 (왼 머리 옆에서) | 패시브·비기(디버그) | 13 |
| 220 | src/schools.js:618 | `TRADITIONS.japanese.techNames.stichAlber` | 츠키 (게단에서) | 패시브·비기(디버그) | 9 |
| 221 | src/schools.js:619 | `TRADITIONS.japanese.techNames.talhoReves` | 사유스이켄다 | 패시브·비기(디버그) | 6 |
| 222 | src/schools.js:619 | `TRADITIONS.japanese.techNames.wristCut` | 카타테코테 | 패시브·비기(디버그) | 5 |
| 223 | src/schools.js:619 | `TRADITIONS.japanese.techNames.molinello` | 손목 돌려 베기 (원전 없음) | 패시브·비기(디버그) | 16 |
| 224 | src/schools.js:186 | `TRADITIONS.japanese.unique[tsubameGaeshi].nameKo` | 츠바메가에시 | 패시브·비기 | 6 |
| 225 | src/schools.js:188 | `TRADITIONS.japanese.unique[kote].nameKo` | 코테 | 패시브·비기 | 2 |
| 226 | src/schools.js:191 | `TRADITIONS.japanese.unique[kokoRenda].nameKo` | 코코 연타 | 패시브·비기 | 5 |
| 227 | src/schools.js:195 | `TRADITIONS.japanese.unique[hirakiGiri].nameKo` | 히라키기리 | 패시브·비기 | 5 |
| 228 | src/schools.js:199 | `TRADITIONS.japanese.spare[omote5].nameKo` | 오모테 5 | 패시브·비기 | 5 |
| 229 | src/schools.js:481 | `TRADITIONS.japanese.passives[zanshin].nameKo` | 잔신 | 패시브·비기 | 2 |
| 230 | src/schools.js:483 | `TRADITIONS.japanese.passives[debana].nameKo` | 데바나 | 패시브·비기 | 3 |
| 231 | src/schools.js:485 | `TRADITIONS.japanese.passives[kaeshi].nameKo` | 카에시 | 패시브·비기 | 3 |
| 232 | src/schools.js:545 | `TRADITIONS.japanese.secret.nameKo` | 고노센 · 가칭 | 패시브·비기 | 8 |
| 233 | src/schools.js:204 | `TRADITIONS.chinese.nameKo` | 중국 | 꼬리표 | 2 |
| 234 | src/schools.js:206 | `TRADITIONS.chinese.names['지붕 (Vom Tag)'].name` | 표두세 (豹頭勢) | 자세 | 9 |
| 235 | src/schools.js:206 | `TRADITIONS.chinese.names['지붕 (Vom Tag)'].desc` | 높이 든 손에서 벼락같이 위로부터 친다 | 자세(설명) | 21 |
| 236 | src/schools.js:207 | `TRADITIONS.chinese.names['어깨 지붕 (Vom Tag)'].name` | 우익세 (右翼勢) | 자세 | 9 |
| 237 | src/schools.js:207 | `TRADITIONS.chinese.names['어깨 지붕 (Vom Tag)'].desc` | 오른 날개 — 오른 어깨 높이에서 친다 | 자세(설명) | 21 |
| 238 | src/schools.js:208 | `TRADITIONS.chinese.names['황소 (Ochs)'].name` | 역린세 (逆鱗勢) | 자세 | 9 |
| 239 | src/schools.js:208 | `TRADITIONS.chinese.names['황소 (Ochs)'].desc` | 손을 어깨 높이에, 칼끝은 상대 목 줄로 곧게 · 비늘을 거슬러 목구멍·목을 곧게 찌른다 | 자세(설명) | 49 |
| 240 | src/schools.js:209 | `TRADITIONS.chinese.names['긴 자세 (Langort)'].name` | 직부송서 (直符送書) | 자세 | 11 |
| 241 | src/schools.js:209 | `TRADITIONS.chinese.names['긴 자세 (Langort)'].desc` | 팔을 뻗어 칼끝을 가운데 높이로 곧게 보낸다 · 쉴 자세 | 자세(설명) | 31 |
| 242 | src/schools.js:210 | `TRADITIONS.chinese.names['옆 자세'].name` | 요격세 (腰擊勢) | 자세 | 9 |
| 243 | src/schools.js:210 | `TRADITIONS.chinese.names['옆 자세'].desc` | 칼을 오른 허리 높이에 옆으로 눕혀 든다 · 허리를 가로질러 가운데를 친다 — 검 중 으뜸 치기 | 자세(설명) | 53 |
| 244 | src/schools.js:211 | `TRADITIONS.chinese.names['쟁기 (Pflug)'].name` | 탄복세 (坦腹勢) | 자세 | 9 |
| 245 | src/schools.js:211 | `TRADITIONS.chinese.names['쟁기 (Pflug)'].desc` | 칼자루를 오른 허리에, 칼끝은 상대 배 높이로 수평 · 산이 무너지듯 나아가 가운데(배)를 찌른다 · 쉴 자세 안 B | 자세(설명) | 65 |
| 246 | src/schools.js:212 | `TRADITIONS.chinese.names['바꿈 (Wechsel)'].name` | 요략세 (撩掠勢) | 자세 | 9 |
| 247 | src/schools.js:212 | `TRADITIONS.chinese.names['바꿈 (Wechsel)'].desc` | 칼을 낮게 앞으로 수평, 칼끝을 왼쪽으로 비껴 왼쪽을 가린다 · 걷어 올려 막고 아래로 친다 | 자세(설명) | 51 |
| 248 | src/schools.js:213 | `TRADITIONS.chinese.names['옆 지킴 (Nebenhut)'].name` | 간수세 (看守勢) | 자세 | 9 |
| 249 | src/schools.js:213 | `TRADITIONS.chinese.names['옆 지킴 (Nebenhut)'].desc` | 호준 (虎蹲) — 웅크린 범처럼 몸을 낮추고 칼을 오른 아래에, 칼끝은 앞 아래로 · 굳게 지키며 살피다 기미를 따라 굴려 친다 | 자세(설명) | 71 |
| 250 | src/schools.js:214 | `TRADITIONS.chinese.names['바보 (Alber)'].name` | 점검세 (點劍勢) | 자세 | 9 |
| 251 | src/schools.js:214 | `TRADITIONS.chinese.names['바보 (Alber)'].desc` | 점 찍듯 찌른다 — 칼끝을 낮게 겨눈다 | 자세(설명) | 21 |
| 252 | src/schools.js:215 | `TRADITIONS.chinese.names['왼쪽 어깨 지붕'].name` | 좌익세 (左翼勢) | 자세 | 9 |
| 253 | src/schools.js:215 | `TRADITIONS.chinese.names['왼쪽 어깨 지붕'].desc` | 치켜 올렸다 눌러 상대 손아귀인 호구 (虎口)를 바로 친다 | 자세(설명) | 32 |
| 254 | src/schools.js:216 | `TRADITIONS.chinese.names['왼쪽 황소'].name` | 봉두세 (鳳頭勢) | 자세 | 9 |
| 255 | src/schools.js:216 | `TRADITIONS.chinese.names['왼쪽 황소'].desc` | 칼을 머리 높이에 비껴 든다 · 씻어 찌르고 얽어 친다 | 자세(설명) | 30 |
| 256 | src/schools.js:217 | `TRADITIONS.chinese.names['왼쪽 옆 자세'].name` | 왼 요격세 (腰擊勢) | 자세 | 11 |
| 257 | src/schools.js:217 | `TRADITIONS.chinese.names['왼쪽 옆 자세'].desc` | 왼쪽에서 허리를 가로질러 친다 — 오른쪽 요격 (腰擊)과 번갈아 | 자세(설명) | 35 |
| 258 | src/schools.js:218 | `TRADITIONS.chinese.names['왼쪽 쟁기'].name` | 좌협세 (左夾勢) | 자세 | 9 |
| 259 | src/schools.js:218 | `TRADITIONS.chinese.names['왼쪽 쟁기'].desc` | 칼자루를 왼 허리에 끼고 칼끝은 배 높이로 수평 · 가운데를 찌른다 | 자세(설명) | 37 |
| 260 | src/schools.js:219 | `TRADITIONS.chinese.names['왼쪽 바꿈'].name` | 과좌세 (跨左勢) | 자세 | 9 |
| 261 | src/schools.js:219 | `TRADITIONS.chinese.names['왼쪽 바꿈'].desc` | 왼편을 걸쳐 쓸어 아래로 친다 | 자세(설명) | 16 |
| 262 | src/schools.js:622 | `TRADITIONS.chinese.techNames.zornhau` | 과우격 (跨右擊) | 패시브·비기(디버그) | 9 |
| 263 | src/schools.js:622 | `TRADITIONS.chinese.techNames.zornhauL` | 과좌격 (跨左擊) | 패시브·비기(디버그) | 9 |
| 264 | src/schools.js:622 | `TRADITIONS.chinese.techNames.oberhau` | 표두격 (豹頭擊) | 패시브·비기(디버그) | 9 |
| 265 | src/schools.js:349 | `TRADITIONS.chinese.techNames.zwerch` | 요격 (腰擊) | 패시브·비기(디버그) | 7 |
| 266 | src/schools.js:622 | `TRADITIONS.chinese.techNames.zwerchL` | 좌요격 (左腰擊) | 패시브·비기(디버그) | 9 |
| 267 | src/schools.js:581 | `TRADITIONS.chinese.techNames.unterhau` | 요략 (撩掠) | 패시브·비기(디버그) | 7 |
| 268 | src/schools.js:623 | `TRADITIONS.chinese.techNames.unterhauL` | 흔격 (掀擊) | 패시브·비기(디버그) | 7 |
| 269 | src/schools.js:582 | `TRADITIONS.chinese.techNames.stichPflug` | 탄복자 (坦腹刺) | 패시브·비기(디버그) | 9 |
| 270 | src/schools.js:623 | `TRADITIONS.chinese.techNames.stichPflugL` | 좌협자 (左夾刺) | 패시브·비기(디버그) | 9 |
| 271 | src/schools.js:624 | `TRADITIONS.chinese.techNames.stichOchs` | 역린자 (逆鱗刺) | 패시브·비기(디버그) | 9 |
| 272 | src/schools.js:624 | `TRADITIONS.chinese.techNames.stichOchsL` | 우협자 (右夾刺) | 패시브·비기(디버그) | 9 |
| 273 | src/schools.js:624 | `TRADITIONS.chinese.techNames.stichAlber` | 점검 (點劍) | 패시브·비기(디버그) | 7 |
| 274 | src/schools.js:625 | `TRADITIONS.chinese.techNames.talhoReves` | 과좌·과우 (跨左·跨右) 번갈아 | 패시브·비기(디버그) | 17 |
| 275 | src/schools.js:625 | `TRADITIONS.chinese.techNames.wristCut` | 어거 (御車) 손 깎기 | 패시브·비기(디버그) | 12 |
| 276 | src/schools.js:625 | `TRADITIONS.chinese.techNames.molinello` | 살화개정 (撒花蓋頂) | 패시브·비기(디버그) | 11 |
| 277 | src/schools.js:349 | `TRADITIONS.chinese.unique[yaoji].nameKo` | 요격 (腰擊) | 패시브·비기 | 7 |
| 278 | src/schools.js:351 | `TRADITIONS.chinese.unique[zuoyi].nameKo` | 좌익격 (左翼擊) | 패시브·비기 | 9 |
| 279 | src/schools.js:354 | `TRADITIONS.chinese.unique[lianchi].feint.name` | 염시 (斂翅) · 찌르는 척 → 거둬 요격 | 패시브·비기 | 23 |
| 280 | src/schools.js:357 | `TRADITIONS.chinese.unique[chebuYaoji].nameKo` | 체보요격 (掣步腰擊) | 패시브·비기 | 11 |
| 281 | src/schools.js:491 | `TRADITIONS.chinese.passives[ciji].nameKo` | 자→격 (刺→擊) 고리 | 패시브·비기 | 12 |
| 282 | src/schools.js:570 | `TRADITIONS.chinese.secret.nameKo` | 연환삼격 (連環三擊) · 가칭 | 패시브·비기 | 16 |
| 283 | src/schools.js:349 | `TRADITIONS.chinese.secret.do.seq[lianhuanYao].nameKo` | 요격 (腰擊) | 패시브·비기 | 7 |
| 284 | src/schools.js:581 | `TRADITIONS.chinese.secret.do.seq[lianhuanLiao].nameKo` | 요략 (撩掠) · 걷어 올려 베기 | 패시브·비기 | 18 |
| 285 | src/schools.js:582 | `TRADITIONS.chinese.secret.do.seq[lianhuanTanfu].nameKo` | 탄복자 (坦腹刺) | 패시브·비기 | 9 |
| 286 | src/schools.js:660 | `TRADITIONS.none.nameKo` | 무유파 | 꼬리표 | 3 |
| 287 | src/schools.js:227 | `TRADITIONS.none.names['지붕 (Vom Tag)'].name` | 머리 위 | 자세 | 4 |
| 288 | src/schools.js:262 | `TRADITIONS.none.names['지붕 (Vom Tag)'].desc` | 머리 위로 높이 든다 · 내려친다 | 자세(설명) | 18 |
| 289 | src/schools.js:263 | `TRADITIONS.none.names['어깨 지붕 (Vom Tag)'].name` | 오른 어깨 메기 | 자세 | 8 |
| 290 | src/schools.js:263 | `TRADITIONS.none.names['어깨 지붕 (Vom Tag)'].desc` | 오른 어깨에 메어 끝을 뒤로 · 비스듬히 내려친다 | 자세(설명) | 27 |
| 291 | src/schools.js:117 | `TRADITIONS.none.names['황소 (Ochs)'].name` | 머리 옆 겨눔 | 자세 | 7 |
| 292 | src/schools.js:264 | `TRADITIONS.none.names['황소 (Ochs)'].desc` | 손을 머리 오른쪽에, 끝은 상대 얼굴 | 자세(설명) | 20 |
| 293 | src/schools.js:265 | `TRADITIONS.none.names['긴 자세 (Langort)'].name` | 앞으로 겨눔 | 자세 | 6 |
| 294 | src/schools.js:265 | `TRADITIONS.none.names['긴 자세 (Langort)'].desc` | 끝을 상대에게 곧게 겨눈다 · 쉴 때 돌아오는 자리 | 자세(설명) | 28 |
| 295 | src/schools.js:266 | `TRADITIONS.none.names['옆 자세'].name` | 오른쪽 젖히기 | 자세 | 7 |
| 296 | src/schools.js:266 | `TRADITIONS.none.names['옆 자세'].desc` | 오른쪽 뒤로 젖혀 둔다 · 옆으로 후려친다 | 자세(설명) | 23 |
| 297 | src/schools.js:267 | `TRADITIONS.none.names['쟁기 (Pflug)'].name` | 허리 겨눔 | 자세 | 5 |
| 298 | src/schools.js:267 | `TRADITIONS.none.names['쟁기 (Pflug)'].desc` | 손을 오른 허리에, 끝은 상대 얼굴 | 자세(설명) | 19 |
| 299 | src/schools.js:268 | `TRADITIONS.none.names['바꿈 (Wechsel)'].name` | 오른 아래로 내림 | 자세 | 9 |
| 300 | src/schools.js:268 | `TRADITIONS.none.names['바꿈 (Wechsel)'].desc` | 끝을 오른쪽 아래로 · 올려친다 | 자세(설명) | 17 |
| 301 | src/schools.js:269 | `TRADITIONS.none.names['옆 지킴 (Nebenhut)'].name` | 오른 뒤로 숨김 | 자세 | 8 |
| 302 | src/schools.js:269 | `TRADITIONS.none.names['옆 지킴 (Nebenhut)'].desc` | 오른 허리 뒤로 숨겨 길이를 감춘다 | 자세(설명) | 19 |
| 303 | src/schools.js:270 | `TRADITIONS.none.names['바보 (Alber)'].name` | 앞으로 늘어뜨림 | 자세 | 8 |
| 304 | src/schools.js:270 | `TRADITIONS.none.names['바보 (Alber)'].desc` | 끝을 앞 아래로 늘어뜨린다 · 머리를 비워 끌어들인다 | 자세(설명) | 29 |
| 305 | src/schools.js:271 | `TRADITIONS.none.names['왼쪽 어깨 지붕'].name` | 왼 어깨 메기 | 자세 | 7 |
| 306 | src/schools.js:271 | `TRADITIONS.none.names['왼쪽 어깨 지붕'].desc` | 왼 어깨에 메어 끝을 뒤로 · 반대쪽으로 비스듬히 내려친다 | 자세(설명) | 32 |
| 307 | src/schools.js:137 | `TRADITIONS.none.names['왼쪽 황소'].name` | 왼 머리 옆 겨눔 | 자세 | 9 |
| 308 | src/schools.js:272 | `TRADITIONS.none.names['왼쪽 황소'].desc` | 손을 머리 왼쪽에, 끝은 상대 얼굴 | 자세(설명) | 19 |
| 309 | src/schools.js:273 | `TRADITIONS.none.names['왼쪽 옆 자세'].name` | 왼쪽 젖히기 | 자세 | 6 |
| 310 | src/schools.js:273 | `TRADITIONS.none.names['왼쪽 옆 자세'].desc` | 왼쪽 뒤로 젖혀 둔다 · 반대쪽으로 후려친다 | 자세(설명) | 24 |
| 311 | src/schools.js:141 | `TRADITIONS.none.names['왼쪽 쟁기'].name` | 왼 허리 겨눔 | 자세 | 7 |
| 312 | src/schools.js:274 | `TRADITIONS.none.names['왼쪽 쟁기'].desc` | 손을 왼 허리에, 끝은 상대 얼굴 | 자세(설명) | 18 |
| 313 | src/schools.js:275 | `TRADITIONS.none.names['왼쪽 바꿈'].name` | 왼 아래로 내림 | 자세 | 8 |
| 314 | src/schools.js:275 | `TRADITIONS.none.names['왼쪽 바꿈'].desc` | 끝을 왼쪽 아래로 · 내려친 끝, 여기서 되올린다 | 자세(설명) | 27 |
| 315 | src/schools.js:628 | `TRADITIONS.none.techNames.zornhau` | 사선 내려치기 | 패시브·비기(디버그) | 7 |
| 316 | src/schools.js:628 | `TRADITIONS.none.techNames.zornhauL` | 왼 사선 내려치기 | 패시브·비기(디버그) | 9 |
| 317 | src/schools.js:628 | `TRADITIONS.none.techNames.oberhau` | 내려치기 | 패시브·비기(디버그) | 4 |
| 318 | src/schools.js:628 | `TRADITIONS.none.techNames.zwerch` | 가로 휘두르기 | 패시브·비기(디버그) | 7 |
| 319 | src/schools.js:628 | `TRADITIONS.none.techNames.zwerchL` | 왼 가로 휘두르기 | 패시브·비기(디버그) | 9 |
| 320 | src/schools.js:628 | `TRADITIONS.none.techNames.unterhau` | 올려치기 | 패시브·비기(디버그) | 4 |
| 321 | src/schools.js:628 | `TRADITIONS.none.techNames.unterhauL` | 왼 올려치기 | 패시브·비기(디버그) | 6 |
| 322 | src/schools.js:629 | `TRADITIONS.none.techNames.stichPflug` | 허리에서 찌르기 | 패시브·비기(디버그) | 8 |
| 323 | src/schools.js:629 | `TRADITIONS.none.techNames.stichPflugL` | 왼 허리에서 찌르기 | 패시브·비기(디버그) | 10 |
| 324 | src/schools.js:629 | `TRADITIONS.none.techNames.stichOchs` | 머리 옆에서 찌르기 | 패시브·비기(디버그) | 10 |
| 325 | src/schools.js:629 | `TRADITIONS.none.techNames.stichOchsL` | 왼 머리 옆에서 찌르기 | 패시브·비기(디버그) | 12 |
| 326 | src/schools.js:629 | `TRADITIONS.none.techNames.stichAlber` | 아래에서 찌르기 | 패시브·비기(디버그) | 8 |
| 327 | src/schools.js:630 | `TRADITIONS.none.techNames.talhoReves` | 좌우 이어 치기 | 패시브·비기(디버그) | 8 |
| 328 | src/schools.js:630 | `TRADITIONS.none.techNames.wristCut` | 손 치기 | 패시브·비기(디버그) | 4 |
| 329 | src/schools.js:630 | `TRADITIONS.none.techNames.molinello` | 돌려 치기 | 패시브·비기(디버그) | 5 |
| 330 | src/ai_techniques.js:81 | `FEINTS[oberhau]` | 위→다리 | 패시브·비기 | 4 |
| 331 | src/ai_techniques.js:83 | `FEINTS[zornhau]` | 오른쪽→왼쪽 | 패시브·비기 | 6 |
| 332 | src/ai_techniques.js:84 | `FEINTS[zornhauL]` | 왼쪽→오른쪽 | 패시브·비기 | 6 |
| 333 | src/ai_techniques.js:86 | `FEINTS[stichPflug]` | 찌르기→베기 | 패시브·비기 | 6 |
| 334 | src/guards.js:25 | `GUARDS['지붕 (Vom Tag)'].name · guardBaseOne('versatile') · guardBaseOne` | 지붕 (Vom Tag) | 자세 | 12 |
| 335 | src/guards.js:25 | `GUARDS['지붕 (Vom Tag)'].desc · guardBaseOne('versatile') · guardBaseOne` | 칼을 머리 위로 세운 자세 · 위에서 내려베기 준비 | 자세(설명) | 28 |
| 336 | src/guards.js:27 | `GUARDS['어깨 지붕 (Vom Tag)'].name · guardBaseOne('versatile') · guardBase` | 어깨 지붕 (Vom Tag) | 자세 | 15 |
| 337 | src/guards.js:27 | `GUARDS['어깨 지붕 (Vom Tag)'].desc · guardBaseOne('versatile') · guardBase` | 칼을 오른 어깨에 얹은 자세 · 사선 베기 준비 | 자세(설명) | 26 |
| 338 | src/guards.js:28 | `GUARDS['황소 (Ochs)'].name · guardBaseOne('versatile') · guardBaseOne('c` | 황소 (Ochs) | 자세 | 9 |
| 339 | src/guards.js:28 | `GUARDS['황소 (Ochs)'].desc · guardBaseOne('versatile') · guardBaseOne('c` | 칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비 | 자세(설명) | 29 |
| 340 | src/guards.js:29 | `GUARDS['긴 자세 (Langort)'].name · guardBaseOne('versatile') · guardBaseO` | 긴 자세 (Langort) | 자세 | 14 |
| 341 | src/guards.js:29 | `GUARDS['긴 자세 (Langort)'].desc · guardBaseOne('versatile') · guardBaseO` | 팔을 쭉 뻗어 칼끝으로 겨눈 자세 | 자세(설명) | 18 |
| 342 | src/guards.js:31 | `GUARDS['옆 자세'].name · guardBaseOne('versatile') · guardBaseOne('cut') ` | 옆 자세 | 자세 | 4 |
| 343 | src/guards.js:31 | `GUARDS['옆 자세'].desc · guardBaseOne('versatile') · guardBaseOne('cut') ` | 칼을 옆으로 눕혀 뒤로 뺀 자세 · 가로베기 준비 | 자세(설명) | 27 |
| 344 | src/guards.js:32 | `GUARDS['쟁기 (Pflug)'].name · guardBaseOne('versatile') · guardBaseOne('` | 쟁기 (Pflug) | 자세 | 10 |
| 345 | src/guards.js:32 | `GUARDS['쟁기 (Pflug)'].desc · guardBaseOne('versatile') · guardBaseOne('` | 칼자루는 허리, 칼끝은 상대 얼굴 · 기본 자세 | 자세(설명) | 26 |
| 346 | src/guards.js:33 | `GUARDS['바꿈 (Wechsel)'].name · guardBaseOne('versatile') · guardBaseOne` | 바꿈 (Wechsel) | 자세 | 12 |
| 347 | src/guards.js:33 | `GUARDS['바꿈 (Wechsel)'].desc · guardBaseOne('versatile') · guardBaseOne` | 칼끝을 오른쪽 아래로 · 올려베기 준비 | 자세(설명) | 21 |
| 348 | src/guards.js:34 | `GUARDS['옆 지킴 (Nebenhut)'].name · guardBaseOne('versatile') · guardBase` | 옆 지킴 (Nebenhut) | 자세 | 15 |
| 349 | src/guards.js:34 | `GUARDS['옆 지킴 (Nebenhut)'].desc · guardBaseOne('versatile') · guardBase` | 칼을 오른쪽 뒤 아래로 숨긴 자세 | 자세(설명) | 18 |
| 350 | src/guards.js:35 | `GUARDS['바보 (Alber)'].name · guardBaseOne('versatile') · guardBaseOne('` | 바보 (Alber) | 자세 | 10 |
| 351 | src/guards.js:35 | `GUARDS['바보 (Alber)'].desc · guardBaseOne('versatile') · guardBaseOne('` | 칼끝을 땅으로 내린 자세 · 상대를 끌어들인다 | 자세(설명) | 25 |
| 352 | src/guards.js:37 | `GUARDS['왼쪽 어깨 지붕'].name · guardBaseOne('versatile') · guardBaseOne('cu` | 왼쪽 어깨 지붕 | 자세 | 8 |
| 353 | src/guards.js:37 | `GUARDS['왼쪽 어깨 지붕'].desc · guardBaseOne('versatile') · guardBaseOne('cu` | 칼을 왼 어깨에 얹은 자세 · 반대쪽 사선 베기 준비 | 자세(설명) | 29 |
| 354 | src/guards.js:38 | `GUARDS['왼쪽 황소'].name · guardBaseOne('versatile') · guardBaseOne('cut')` | 왼쪽 황소 | 자세 | 5 |
| 355 | src/guards.js:38 | `GUARDS['왼쪽 황소'].desc · guardBaseOne('versatile') · guardBaseOne('cut')` | 칼자루는 머리 왼쪽, 칼끝은 상대 얼굴 | 자세(설명) | 21 |
| 356 | src/guards.js:39 | `GUARDS['왼쪽 옆 자세'].name · guardBaseOne('versatile') · guardBaseOne('cut` | 왼쪽 옆 자세 | 자세 | 7 |
| 357 | src/guards.js:39 | `GUARDS['왼쪽 옆 자세'].desc · guardBaseOne('versatile') · guardBaseOne('cut` | 칼을 왼쪽으로 눕혀 뒤로 뺀 자세 · 반대쪽 가로베기 준비 | 자세(설명) | 32 |
| 358 | src/guards.js:40 | `GUARDS['왼쪽 쟁기'].name · guardBaseOne('versatile') · guardBaseOne('cut')` | 왼쪽 쟁기 | 자세 | 5 |
| 359 | src/guards.js:40 | `GUARDS['왼쪽 쟁기'].desc · guardBaseOne('versatile') · guardBaseOne('cut')` | 칼자루는 왼 허리, 칼끝은 상대 얼굴 | 자세(설명) | 20 |
| 360 | src/guards.js:41 | `GUARDS['왼쪽 바꿈'].name · guardBaseOne('versatile') · guardBaseOne('cut')` | 왼쪽 바꿈 | 자세 | 5 |
| 361 | src/guards.js:41 | `GUARDS['왼쪽 바꿈'].desc · guardBaseOne('versatile') · guardBaseOne('cut')` | 칼끝을 왼쪽 아래로 · 사선 베기가 끝나는 자리 | 자세(설명) | 26 |
| 362 | src/guards.js:62 | `GUARDS['내려찍기 겨눔'].name` | 내려찍기 겨눔 | 자세 | 7 |
| 363 | src/guards.js:62 | `GUARDS['내려찍기 겨눔'].desc` | 두 손을 머리 위로 들고 칼날을 아래로 돌려 쥐어 쓰러진 상대를 겨눈다 | 자세(설명) | 39 |
| 364 | src/guards.js:62 | `GUARDS['내려찍기'].name` | 내려찍기 | 자세 | 4 |
| 365 | src/guards.js:63 | `GUARDS['내려찍기'].desc` | 쓰러진 상대를 칼끝이 땅에 닿도록 찍는다 · 위에서 오면 내려베기 | 자세(설명) | 36 |
| 366 | src/frames.js:71 | `FRAME_GUARDS.heavy['지붕 (Vom Tag)'].name` | 조단 | 자세 | 2 |
| 367 | src/frames.js:71 | `FRAME_GUARDS.heavy['지붕 (Vom Tag)'].desc` | 칼자루를 이마 위로, 칼끝은 뒤로 눕힌다 · 한 칼로 내려벤다 | 자세(설명) | 34 |
| 368 | src/frames.js:72 | `FRAME_GUARDS.heavy['어깨 지붕 (Vom Tag)'].name` | 핫소 · 어깨 메기 | 자세 | 10 |
| 369 | src/frames.js:72 | `FRAME_GUARDS.heavy['어깨 지붕 (Vom Tag)'].desc` | 칼자루를 오른 어깨 앞에 세우고 칼끝을 뒤로 · 사선으로 내려벤다 | 자세(설명) | 36 |
| 370 | src/frames.js:73 | `FRAME_GUARDS.heavy['왼쪽 어깨 지붕'].name` | 왼 핫소 · 레베스 준비 | 자세 | 13 |
| 371 | src/frames.js:73 | `FRAME_GUARDS.heavy['왼쪽 어깨 지붕'].desc` | 칼을 왼 어깨에 세운 자세 · 반대쪽 사선 베기 (revez) | 자세(설명) | 34 |
| 372 | src/frames.js:77 | `FRAME_GUARDS.heavy['긴 자세 (Langort)'].name` | 추단 | 자세 | 2 |
| 373 | src/frames.js:77 | `FRAME_GUARDS.heavy['긴 자세 (Langort)'].desc` | 칼끝을 상대 목에 두고 손은 배꼽 앞 · 무거운 칼을 오래 뻗지 않는다 | 자세(설명) | 39 |
| 374 | src/frames.js:78 | `FRAME_GUARDS.heavy['옆 지킴 (Nebenhut)'].name` | 와키가마에 | 자세 | 5 |
| 375 | src/frames.js:78 | `FRAME_GUARDS.heavy['옆 지킴 (Nebenhut)'].desc` | 칼을 오른 허리 뒤로 숨겨 칼끝을 뒤 아래로 · 길이를 감춘다 | 자세(설명) | 34 |
| 376 | src/frames.js:84 | `FRAME_GUARDS.one['긴 자세 (Langort)'].name` | 3번 자세 (Terza) | 자세 | 13 |
| 377 | src/frames.js:84 | `FRAME_GUARDS.one['긴 자세 (Langort)'].desc` | 팔을 곧게 뻗어 칼끝으로 겨누고 몸을 옆으로 세운다 · 런지로 찌른다 | 자세(설명) | 38 |
| 378 | src/frames.js:85 | `FRAME_GUARDS.one['쟁기 (Pflug)'].name` | 바깥 막기 (Seconda) | 자세 | 15 |
| 379 | src/frames.js:85 | `FRAME_GUARDS.one['쟁기 (Pflug)'].desc` | 손을 허리 바깥에, 칼끝은 상대 얼굴 · 바깥 선을 닫는다 | 자세(설명) | 32 |
| 380 | src/frames.js:87 | `FRAME_GUARDS.one['왼쪽 쟁기'].name` | 안쪽 막기 (Quarta) | 자세 | 14 |
| 381 | src/frames.js:87 | `FRAME_GUARDS.one['왼쪽 쟁기'].desc` | 손바닥을 위로 돌려 안쪽 선에, 칼끝은 상대 얼굴 · 안쪽 선을 닫는다 | 자세(설명) | 39 |
| 382 | src/frames.js:84 | `STYLE_GUARDS['one:thrust']['긴 자세 (Langort)'].name` | 3번 자세 (Terza) | 자세 | 13 |
| 383 | src/frames.js:105 | `STYLE_GUARDS['one:thrust']['긴 자세 (Langort)'].desc` | 팔을 뻗어 칼끝으로 상대 얼굴을 겨누고 몸을 옆으로 세운다 · 런지로 찌른다 | 자세(설명) | 42 |
| 384 | src/frames.js:106 | `STYLE_GUARDS['one:thrust']['쟁기 (Pflug)'].name` | 2번 자세 (Seconda) | 자세 | 15 |
| 385 | src/frames.js:106 | `STYLE_GUARDS['one:thrust']['쟁기 (Pflug)'].desc` | 손을 어깨 높이로 뻗고 손바닥을 아래로 · 칼끝은 상대 가슴 | 자세(설명) | 33 |
| 386 | src/frames.js:117 | `COVERS.one.highC.name` | 머리 막기 (St. George) | 자세 | 18 |
| 387 | src/frames.js:118 | `COVERS.one.highR.name` | 걸친 막기 (Hanging guard) | 자세 | 21 |
| 388 | src/gun.js:19 | `GUN_STANCE.name` | 사격 자세 | 자세 | 5 |
| 389 | src/gun.js:19 | `GUN_STANCE.desc` | 총이 저절로 상대를 겨누며 흔들린다 · 레이저가 몸에 걸린 순간 탭으로 쏜다 | 자세(설명) | 42 |
| 390 | src/characters.js:23 | `bran.name` | 오소리 브란 | 이름·칭호 | 6 |
| 391 | src/characters.js:24 | `bran.epithet` | 나무꾼 | 이름·칭호 | 3 |
| 392 | src/characters.js:82 | `bran.taunt` | 젠장! 이런 막대기뿐이라니. | 대사 | 15 |
| 393 | src/characters.js:82 | `bran.lines.intro[0]` | 젠장! 이런 막대기뿐이라니. | 대사 | 15 |
| 394 | src/characters.js:85 | `bran.lines.intro[1]` | 은화 열 닢! 열 닢이라고 했지? | 대사 | 18 |
| 395 | src/characters.js:85 | `bran.lines.intro[2]` | 자세? 힘이 최고야. | 대사 | 11 |
| 396 | src/characters.js:86 | `bran.lines.attack[0]` | 받아라아! | 대사(안 보임) | 5 |
| 397 | src/characters.js:86 | `bran.lines.attack[1]` | 이거나 먹어! | 대사(안 보임) | 7 |
| 398 | src/characters.js:86 | `bran.lines.attack[2]` | 장작이다, 장작! | 대사(안 보임) | 9 |
| 399 | src/characters.js:87 | `bran.lines.hurt[0]` | 아야… 아야! 이거 진짜 칼이잖아! | 대사(안 보임) | 19 |
| 400 | src/characters.js:87 | `bran.lines.hurt[1]` | 피… 피 난다… | 대사(안 보임) | 8 |
| 401 | src/characters.js:87 | `bran.lines.hurt[2]` | 야, 야, 잠깐만— | 대사(안 보임) | 10 |
| 402 | src/characters.js:88 | `bran.lines.winning[0]` | 하하! 봤지? 봤냐고! | 대사 | 12 |
| 403 | src/characters.js:88 | `bran.lines.winning[1]` | 검객이라며! 검객이라며! | 대사 | 13 |
| 404 | src/characters.js:89 | `bran.lines.losing[0]` | 그, 그만… 은화는 됐어… | 대사(안 보임) | 14 |
| 405 | src/characters.js:89 | `bran.lines.losing[1]` | 오지 마. 오지 말라고. | 대사(안 보임) | 13 |
| 406 | src/characters.js:89 | `bran.lines.losing[2]` | 엄마… | 대사(안 보임) | 3 |
| 407 | src/characters.js:90 | `bran.lines.win[0]` | 은화! 은화 어딨어! | 대사 | 11 |
| 408 | src/characters.js:90 | `bran.lines.win[1]` | …내가 이겼나? 내가 이겼다! | 대사 | 16 |
| 409 | src/characters.js:90 | `bran.lines.win[2]` | 장작 패기보다 쉽구나, 널 패는 게. | 대사 | 20 |
| 410 | src/characters.js:91 | `bran.lines.lose[0]` | …장작이나 팰걸. | 대사(안 보임) | 9 |
| 411 | src/characters.js:91 | `bran.lines.lose[1]` | 회초리… 부러졌나… | 대사(안 보임) | 10 |
| 412 | src/characters.js:98 | `isolde.name` | 이졸데 반 아커러 | 이름·칭호 | 9 |
| 413 | src/characters.js:99 | `isolde.epithet` | 브루게의 견습생 | 이름·칭호 | 8 |
| 414 | src/characters.js:149 | `isolde.taunt` | 사범님… 보고 계신가요. 정확하게 갈게요. | 대사 | 23 |
| 415 | src/characters.js:149 | `isolde.lines.intro[0]` | 사범님… 보고 계신가요. 정확하게 갈게요. | 대사 | 23 |
| 416 | src/characters.js:151 | `isolde.lines.intro[1]` | 브루게 검술 길드, 이졸데 반 아커러입니다. | 대사 | 24 |
| 417 | src/characters.js:151 | `isolde.lines.intro[2]` | 잘 부탁드립니다. …정말로요. | 대사 | 16 |
| 418 | src/characters.js:152 | `isolde.lines.attack[0]` | 하압! | 대사(안 보임) | 3 |
| 419 | src/characters.js:152 | `isolde.lines.attack[1]` | 여기! | 대사(안 보임) | 3 |
| 420 | src/characters.js:152 | `isolde.lines.attack[2]` | 지금— | 대사(안 보임) | 3 |
| 421 | src/characters.js:153 | `isolde.lines.hurt[0]` | …거리를 잘못 쟀어. | 대사(안 보임) | 11 |
| 422 | src/characters.js:153 | `isolde.lines.hurt[1]` | 괜찮아. 배운 대로. | 대사(안 보임) | 11 |
| 423 | src/characters.js:153 | `isolde.lines.hurt[2]` | 한 번 더. | 대사(안 보임) | 6 |
| 424 | src/characters.js:154 | `isolde.lines.winning[0]` | 서두르지 말자. 서두르지 말자. | 대사 | 17 |
| 425 | src/characters.js:154 | `isolde.lines.winning[1]` | …보고 계셨으면. | 대사 | 9 |
| 426 | src/characters.js:155 | `isolde.lines.losing[0]` | 물러나… 물러나서 다시. | 대사(안 보임) | 13 |
| 427 | src/characters.js:155 | `isolde.lines.losing[1]` | 교본엔 이런 게 없었는데. | 대사(안 보임) | 14 |
| 428 | src/characters.js:155 | `isolde.lines.losing[2]` | 선배들 말이… 아니야, 아직. | 대사(안 보임) | 16 |
| 429 | src/characters.js:156 | `isolde.lines.win[0]` | …감사합니다. | 대사 | 7 |
| 430 | src/characters.js:156 | `isolde.lines.win[1]` | 사범님, 이제 이르지 않죠? | 대사 | 15 |
| 431 | src/characters.js:156 | `isolde.lines.win[2]` | 교본대로였어요. 그것뿐이에요. | 대사 | 16 |
| 432 | src/characters.js:157 | `isolde.lines.lose[0]` | 아직… 이르네요. | 대사(안 보임) | 9 |
| 433 | src/characters.js:157 | `isolde.lines.lose[1]` | 다음엔 정확하게. | 대사(안 보임) | 9 |
| 434 | src/characters.js:158 | `isolde.lines.revive[0]` | 한 번만 더. 정확하게. | 대사 | 13 |
| 435 | src/characters.js:165 | `liao.name` | 랴오 쓰위엔 | 이름·칭호 | 6 |
| 436 | src/characters.js:166 | `liao.epithet` | 떠도는 검 | 이름·칭호 | 5 |
| 437 | src/characters.js:212 | `liao.taunt` | 검이 다 똑같지, 뭘 그리 재나. | 대사 | 18 |
| 438 | src/characters.js:212 | `liao.lines.intro[0]` | 검이 다 똑같지, 뭘 그리 재나. | 대사 | 18 |
| 439 | src/characters.js:214 | `liao.lines.intro[1]` | 여비만 벌면 간다. | 대사 | 10 |
| 440 | src/characters.js:214 | `liao.lines.intro[2]` | …시작하지. | 대사 | 6 |
| 441 | src/characters.js:215 | `liao.lines.attack[0]` | —핫. | 대사(안 보임) | 3 |
| 442 | src/characters.js:215 | `liao.lines.attack[1]` | 거기. | 대사(안 보임) | 3 |
| 443 | src/characters.js:215 | `liao.lines.attack[2]` | 느려. | 대사(안 보임) | 3 |
| 444 | src/characters.js:216 | `liao.lines.hurt[0]` | …음. | 대사(안 보임) | 3 |
| 445 | src/characters.js:216 | `liao.lines.hurt[1]` | 괜찮은 칼이군. | 대사(안 보임) | 8 |
| 446 | src/characters.js:216 | `liao.lines.hurt[2]` | 한 번은 봐준다. | 대사(안 보임) | 9 |
| 447 | src/characters.js:217 | `liao.lines.winning[0]` | 두 번 걸렸어. 이제 재미있어졌네. | 대사 | 19 |
| 448 | src/characters.js:217 | `liao.lines.winning[1]` | 서두르지 마. 나도 안 서두르니까. | 대사 | 19 |
| 449 | src/characters.js:218 | `liao.lines.losing[0]` | …이 철검, 생각보다 무겁군. | 대사(안 보임) | 16 |
| 450 | src/characters.js:218 | `liao.lines.losing[1]` | 거리. 거리를 다시. | 대사(안 보임) | 11 |
| 451 | src/characters.js:218 | `liao.lines.losing[2]` | 오늘은 여기까지인가. | 대사(안 보임) | 11 |
| 452 | src/characters.js:219 | `liao.lines.win[0]` | …검이 다 똑같지. | 대사 | 10 |
| 453 | src/characters.js:219 | `liao.lines.win[1]` | 여비는 됐다. 다음 마을. | 대사 | 14 |
| 454 | src/characters.js:219 | `liao.lines.win[2]` | …참 잘 드는군. | 대사 | 9 |
| 455 | src/characters.js:220 | `liao.lines.lose[0]` | …통하긴 하는군. 반쯤. | 대사(안 보임) | 13 |
| 456 | src/characters.js:220 | `liao.lines.lose[1]` | 다음엔 더 가는 검을 가져오지. | 대사(안 보임) | 17 |
| 457 | src/characters.js:227 | `heinrich.name` | 하인리히 도른 | 이름·칭호 | 7 |
| 458 | src/characters.js:228 | `heinrich.epithet` | 미치광이 | 이름·칭호 | 4 |
| 459 | src/characters.js:278 | `heinrich.taunt` | 무릎 꿇어라. 왕의 검 앞이다. | 대사 | 17 |
| 460 | src/characters.js:278 | `heinrich.lines.intro[0]` | 무릎 꿇어라. 왕의 검 앞이다. | 대사 | 17 |
| 461 | src/characters.js:280 | `heinrich.lines.intro[1]` | 베인다! 베인다! 하하하! | 대사 | 14 |
| 462 | src/characters.js:280 | `heinrich.lines.intro[2]` | 이름 따위 필요 없다. 넌 곧 잊힌다. | 대사 | 21 |
| 463 | src/characters.js:281 | `heinrich.lines.attack[0]` | 죽어라! | 대사(안 보임) | 4 |
| 464 | src/characters.js:281 | `heinrich.lines.attack[1]` | 더! 더 피를 내놔라! | 대사(안 보임) | 12 |
| 465 | src/characters.js:281 | `heinrich.lines.attack[2]` | 하하하! 도망쳐 봐라! | 대사(안 보임) | 12 |
| 466 | src/characters.js:282 | `heinrich.lines.hurt[0]` | 감히… 감히 나를?! | 대사(안 보임) | 11 |
| 467 | src/characters.js:282 | `heinrich.lines.hurt[1]` | 이 피는 내 것이 아니다. 아니야! | 대사(안 보임) | 19 |
| 468 | src/characters.js:282 | `heinrich.lines.hurt[2]` | 하찮은 것이…! | 대사(안 보임) | 8 |
| 469 | src/characters.js:283 | `heinrich.lines.winning[0]` | 봐라! 이게 나다! | 대사 | 10 |
| 470 | src/characters.js:283 | `heinrich.lines.winning[1]` | 기어라. 기어서 살려 달라 해라! | 대사 | 18 |
| 471 | src/characters.js:284 | `heinrich.lines.losing[0]` | 말도 안 돼… 내가? | 대사(안 보임) | 11 |
| 472 | src/characters.js:284 | `heinrich.lines.losing[1]` | 가짜? 가짜라고?! 닥쳐! | 대사(안 보임) | 14 |
| 473 | src/characters.js:284 | `heinrich.lines.losing[2]` | 아직이다. 나는 아직 서 있다. | 대사(안 보임) | 17 |
| 474 | src/characters.js:285 | `heinrich.lines.win[0]` | 흔한 버러지였구나. | 대사 | 10 |
| 475 | src/characters.js:285 | `heinrich.lines.win[1]` | 기어서 살려 달라 하랬지. …아, 이제 못 기는군. | 대사 | 28 |
| 476 | src/characters.js:285 | `heinrich.lines.win[2]` | 너 같은 놈들을 수도 없이 봐 왔지. | 대사 | 20 |
| 477 | src/characters.js:286 | `heinrich.lines.lose[0]` | …거짓말이야. 내가… | 대사(안 보임) | 11 |
| 478 | src/characters.js:286 | `heinrich.lines.lose[1]` | 나는… 쓰러지지 않아… | 대사(안 보임) | 12 |
| 479 | src/characters.js:293 | `margarethe.name` | 마르그레테 슈바르츠 | 이름·칭호 | 10 |
| 480 | src/characters.js:294 | `margarethe.epithet` | 침묵의 벽 | 이름·칭호 | 5 |
| 481 | src/characters.js:341 | `margarethe.taunt` | 서두르는 쪽이 먼저 베인다. | 대사 | 15 |
| 482 | src/characters.js:341 | `margarethe.lines.intro[0]` | 서두르는 쪽이 먼저 베인다. | 대사 | 15 |
| 483 | src/characters.js:343 | `margarethe.lines.intro[1]` | 너에게도 회한이 있는가? | 대사 | 13 |
| 484 | src/characters.js:343 | `margarethe.lines.intro[2]` | …아직도 벨 수 있을까? 확인해 보지. | 대사 | 21 |
| 485 | src/characters.js:344 | `margarethe.lines.attack[0]` | 지금. | 대사(안 보임) | 3 |
| 486 | src/characters.js:344 | `margarethe.lines.attack[1]` | 거기서 서둘렀다. | 대사(안 보임) | 9 |
| 487 | src/characters.js:345 | `margarethe.lines.hurt[0]` | …좋은 칼. | 대사(안 보임) | 6 |
| 488 | src/characters.js:345 | `margarethe.lines.hurt[1]` | 내가 서둘렀군. | 대사(안 보임) | 8 |
| 489 | src/characters.js:345 | `margarethe.lines.hurt[2]` | 다시. | 대사(안 보임) | 3 |
| 490 | src/characters.js:346 | `margarethe.lines.winning[0]` | 기다려. 올 거다. | 대사 | 10 |
| 491 | src/characters.js:346 | `margarethe.lines.winning[1]` | …아직. | 대사 | 4 |
| 492 | src/characters.js:347 | `margarethe.lines.losing[0]` | …망설이지 않는군. 그건 가르칠 수 없지. | 대사(안 보임) | 23 |
| 493 | src/characters.js:347 | `margarethe.lines.losing[1]` | 그래. 이것도 다른 근육이야. | 대사(안 보임) | 16 |
| 494 | src/characters.js:348 | `margarethe.lines.win[0]` | 거기서 서둘렀다. 그게 전부야. | 대사 | 17 |
| 495 | src/characters.js:348 | `margarethe.lines.win[1]` | …콘라트, 오늘은 서두르지 않았어. | 대사 | 19 |
| 496 | src/characters.js:348 | `margarethe.lines.win[2]` | 가르치는 근육도 아직 벨 줄 아는군. | 대사 | 20 |
| 497 | src/characters.js:349 | `margarethe.lines.lose[0]` | …서둘렀나. 제자들에게 말해야겠군. | 대사(안 보임) | 19 |
| 498 | src/characters.js:349 | `margarethe.lines.lose[1]` | 좋은 검객이었다. 서두르지 마라. | 대사(안 보임) | 18 |
| 499 | src/characters.js:361 | `tome.name` | 토메 비달 | 이름·칭호 | 5 |
| 500 | src/characters.js:362 | `tome.epithet` | 아르키진나시오의 사서 | 이름·칭호 | 11 |
| 501 | src/characters.js:372 | `omari.name` | 오마리 | 이름·칭호 | 3 |
| 502 | src/characters.js:383 | `minami.name` | 미나미 | 이름·칭호 | 3 |
| 503 | src/characters.js:451 | `heinrich_mad.name` | 광기의 하인리히 도른 | 이름·칭호 | 11 |
| 504 | src/characters.js:445 | `heinrich_mad.epithet` | 밤의 왕 | 이름·칭호 | 4 |
| 505 | src/characters.js:466 | `heinrich_mad.taunt` | 무릎은 필요 없다. 목만. | 대사 | 14 |
| 506 | src/characters.js:466 | `heinrich_mad.lines.intro[0]` | 무릎은 필요 없다. 목만. | 대사 | 14 |
| 507 | src/characters.js:469 | `heinrich_mad.lines.win[0]` | …이제 파도 소리가 들리는군. | 대사 | 16 |
| 508 | src/main.js:442 | `:442` | 나 | 시스템 | 1 |
| 509 | src/main.js:455 | `:455` | 상대 | 시스템 | 2 |
| 510 | src/main.js:743 | `:743` | 화면을 손가락으로 끌면 칼이 따라 움직여요. 좌우로 끌면 가로베기, 위아래로 끌면 내려치기. ⏎ 폰을 앞뒤로 기울이면 전진·후퇴, 좌우로 기울이면 옆걸음. ⏎ ◎ 버튼: 지금 각도를 ‘똑바로’로 다시 맞춰요. ⏎ 칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요. ⏎  | 창 | 177 |
| 511 | src/main.js:744 | `:744` | 화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘둘러요. ⏎ WASD 또는 방향키로 걸어요. ⏎ Esc로 마우스 잠금을 풀고, P로 일시정지해요. ⏎ 칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점이에요. ⏎  | 창 | 143 |
| 512 | src/main.js:876 | `:876` | 상대 | 카드 | 33 |
| 513 | src/main.js:929 | `:929` | 상대 무기 카드 (고를 수 없어요) | 카드 | 19 |
| 514 | src/main.js:929 | `:929` | …번 카드 | 카드 | 5 |
| 515 | src/main.js:1013 | `:1013` | 상대 무기:  | 카드 | 7 |
| 516 | src/main.js:1013 | `:1013` | 내 무기:  | 카드 | 6 |
| 517 | src/main.js:1108 | `:1108` | 기울기 센서를 쓸 수 없어 조이스틱으로 바꿨어요 | 시스템 | 26 |
| 518 | src/main.js:1136 | `:1136` | 무기 카드를 한 장 고르세요 | 시스템 | 15 |
| 519 | src/main.js:1136 | `:1136` | 무기 카드를 한 장 고르세요 (1 · 2) | 시스템 | 23 |
| 520 | src/main.js:1152 | `:1152` | Battle | 시스템 | 6 |
| 521 | src/main.js:1155 | `:1155` | 클릭해서 마우스 잠그기 · WASD로 걷기 · 클릭으로 찌르기 | 시스템 | 34 |
| 522 | src/main.js:1157 | `:1157` | 끌어서 휘두르기 · 톡 쳐서 찌르기 · 기울여서 걷기 | 시스템 | 29 |
| 523 | src/main.js:1158 | `:1158` | 조이스틱으로 걷기 · 끌어서 휘두르기 · 톡 쳐서 찌르기 | 시스템 | 31 |
| 524 | src/main.js:1172 | `:1172` | 일시정지 | 창 | 4 |
| 525 | src/main.js:1173 | `:1173` | 설정을 바꾸거나 계속할 수 있어요. | 창 | 19 |
| 526 | src/main.js:1174 | `:1174` | 처음부터 다시 | 창 | 7 |
| 527 | src/main.js:1207 | `:1207` | 지금 각도를 기준으로 맞췄어요 | 시스템 | 16 |
| 528 | src/main.js:1233 | `:1233` | 이 | 시스템 | 1 |
| 529 | src/main.js:1233 | `:1233` | 가 | 시스템 | 1 |
| 530 | src/main.js:1233 | `:1233` | 공포에 잠식된다 | 시스템 | 8 |
| 531 | src/main.js:1234 | `:1234` | 집념을 보인다 | 시스템 | 7 |
| 532 | src/main.js:1234 | `:1234` | 집념이 생긴다 | 시스템 | 7 |
| 533 | src/main.js:1235 | `:1235` | …의  | 시스템 | 3 |
| 534 | src/main.js:1235 | `:1235` | 분노가 폭발한다 | 시스템 | 8 |
| 535 | src/main.js:1247 | `:1247` | 상대 | 시스템 | 2 |
| 536 | src/main.js:1281 | `:1281` | 상대 | 시스템 | 2 |
| 537 | src/main.js:1282 | `:1282` | 이 | 시스템 | 1 |
| 538 | src/main.js:1282 | `:1282` | 가 | 시스템 | 1 |
| 539 | src/main.js:1282 | `:1282` | …… 투지로 다시 일어선다 | 시스템 | 14 |
| 540 | src/main.js:1346 | `:1346` | 승리 | 시스템 | 2 |
| 541 | src/main.js:1346 | `:1346` | 패배 | 시스템 | 2 |
| 542 | src/main.js:1374 | `:1374` | 목을 베었다 | 창 | 6 |
| 543 | src/main.js:1374 | `:1374` | 머리를 쳤다 | 창 | 6 |
| 544 | src/main.js:1374 | `:1374` | 출혈로 쓰러뜨렸다 | 창 | 9 |
| 545 | src/main.js:1374 | `:1374` | 기절시켰다 | 창 | 5 |
| 546 | src/main.js:1374 | `:1374` | 내려찍었다 | 창 | 5 |
| 547 | src/main.js:1374 | `:1374` | 쓰러뜨렸다 | 창 | 5 |
| 548 | src/main.js:1375 | `:1375` | 목을 베였다 | 창 | 6 |
| 549 | src/main.js:1375 | `:1375` | 머리를 맞았다 | 창 | 7 |
| 550 | src/main.js:1375 | `:1375` | 피를 너무 흘렸다 | 창 | 9 |
| 551 | src/main.js:1375 | `:1375` | 기절했다 | 창 | 4 |
| 552 | src/main.js:1375 | `:1375` | 내려찍혔다 | 창 | 5 |
| 553 | src/main.js:1375 | `:1375` | 쓰러졌다 | 창 | 4 |
| 554 | src/main.js:1376 | `:1376` | 승리 | 창 | 2 |
| 555 | src/main.js:1376 | `:1376` | 패배 | 창 | 2 |
| 556 | src/main.js:1380 | `:1380` | 다음 상대 | 창 | 5 |
| 557 | src/main.js:1380 | `:1380` | 다시 싸우기 | 창 | 6 |
| 558 | src/main.js:1495 | `:1495` | 패시브 | 시스템 | 3 |
| 559 | src/main.js:1495 | `:1495` | 고유 동작 | 시스템 | 5 |
| 560 | src/main.js:1495 | `:1495` | 기술 | 시스템 | 2 |
| 561 | src/main.js:1495 | `:1495` | 비기 | 시스템 | 2 |
| 562 | src/main.js:1495 | `:1495` | 비기 | 시스템 | 2 |
| 563 | src/main.js:1495 | `:1495` | 비기 뒤 | 시스템 | 4 |
| 564 | src/main.js:1495 | `:1495` | 비기 | 시스템 | 2 |
| 565 | src/main.js:1516 | `:1516` | 경직 | 시스템 | 2 |
| 566 | src/main.js:1516 | `:1516` | 내 … | 시스템 | 3 |
| 567 | src/main.js:1535 | `:1535` | 고노센 준비 | 시스템 | 6 |
| 568 | src/main.js:1535 | `:1535` | 내 … | 시스템 | 3 |
| 569 | src/main.js:1545 | `:1545` | 경직 | 시스템 | 2 |
| 570 | src/main.js:1545 | `:1545` | 상대 … | 시스템 | 4 |
| 571 | index.html:262 | `@aria-label` | 일시정지 | 시스템 | 4 |
| 572 | index.html:263 | `@aria-label` | 기울기 영점 맞추기 | 시스템 | 10 |
| 573 | index.html:273 |  | 내 무기 | 카드 | 4 |
| 574 | index.html:274 |  | 내 무기 | 카드 | 4 |
| 575 | index.html:275 |  | 상대 무기 | 카드 | 5 |
| 576 | index.html:280 | `@aria-label` | 이동 조이스틱 | 시스템 | 7 |
| 577 | index.html:285 |  | 길 위에선 이름을 묻지 않는다. | 창 | 17 |
| 578 | index.html:286 |  | 상대 난이도 | 창 | 6 |
| 579 | index.html:288 |  | 쉬움 | 창 | 2 |
| 580 | index.html:288 |  | 보통 | 창 | 2 |
| 581 | index.html:288 |  | 어려움 | 창 | 3 |
| 582 | index.html:292 |  | 조작 흔적 보기 | 창 | 8 |
| 583 | index.html:292 | `@aria-label` | 조작 흔적 보기 | 창 | 8 |
| 584 | index.html:293 |  | 자세 이름 보기 | 창 | 8 |
| 585 | index.html:293 | `@aria-label` | 자세 이름 보기 | 창 | 8 |
| 586 | index.html:294 |  | 유파 기술 알림 | 창 | 8 |
| 587 | index.html:294 | `@aria-label` | 유파 기술 알림 | 창 | 8 |
| 588 | index.html:295 |  | 모든 기술 이름 보기 (디버그) | 창 | 17 |
| 589 | index.html:295 | `@aria-label` | 모든 기술 이름 보기 | 창 | 11 |
| 590 | index.html:296 |  | 비기 화면 번쩍임 | 창 | 9 |
| 591 | index.html:296 | `@aria-label` | 비기 화면 번쩍임 | 창 | 9 |
| 592 | index.html:297 |  | 비기 카메라 연출 | 창 | 9 |
| 593 | index.html:297 | `@aria-label` | 비기 카메라 연출 | 창 | 9 |
| 594 | index.html:298 |  | 픽셀 모드 (실험) | 창 | 10 |
| 595 | index.html:298 | `@aria-label` | 픽셀 모드 | 창 | 5 |
| 596 | index.html:299 |  | 화면 60 fps 제한 | 창 | 12 |
| 597 | index.html:299 | `@aria-label` | 화면 60 fps 제한 | 창 | 12 |
| 598 | index.html:300 |  | 피 표현 | 창 | 4 |
| 599 | index.html:300 | `@aria-label` | 피 표현 | 창 | 4 |
| 600 | index.html:301 |  | 소리 | 창 | 2 |
| 601 | index.html:301 |  | 들어보기 | 창 | 4 |
| 602 | index.html:301 | `@aria-label` | 소리 | 창 | 2 |
| 603 | index.html:302 |  | 이동 방식 | 창 | 5 |
| 604 | index.html:304 |  | 조이스틱 | 창 | 4 |
| 605 | index.html:304 |  | 기울기 | 창 | 3 |
| 606 | index.html:307 |  | 기울기 방향 반대로 | 창 | 10 |
| 607 | index.html:307 | `@aria-label` | 기울기 방향 반대로 | 창 | 10 |
| 608 | index.html:310 |  | 싸움 시작 | 창 | 5 |
| 609 | index.html:311 |  | 계속하기 | 창 | 4 |
| 610 | index.html:317 |  | 폰을 가로로 돌려 주세요 | 시스템 | 13 |
