# 서양·무유파 자세 이름 초안 — 이베리아(몬탄테)·독일 두삭 가지·무유파 (2026-10-09, 2 등급 조사)

- **상태**: **적용 10/9** (가지 `…/school-names-src-2q36ha`) — §2-3·§3-4·§4 표를 `src/schools.js` 에 그대로 넣음: `TRADITIONS.iberian.names`·`TRADITIONS.none.names`·`TRADITIONS.german.branches['one:cut'].names`(롱소드 `german.names` 는 그대로). `sword_art.js schoolNames` 가 가지 이름을 먼저 읽는다. §7 두 물음은 사장님 결정대로(포르투갈어 철자, 다섯 자리 원문 낱말). 고친 글자: 이베리아 '왼쪽 쟁기' 출처 'posture' → 'postura'. §2-1 의 frames.js·weapon_motions.md '첫 규칙' 주석도 고침. 관문(이름은 HUD 만) 바이트 같음.
- (옛 상태) 초안이다. 이름·설명·출처만 다룬다. 값은 모두 **사장님 확인 전**이다.
- **사장님 규칙** (10/9): 유파는 패드 자리·칼끝 각·몸 돌림을 옮기지 않는다. 이름과 설명만 바꾼다. 출처는 정직하게 적는다. 원전 이름이 없으면 쉬운 말을 쓰고, [전승] 후보는 따로 적는다.
- **표시**: 일본 초안(`school_japanese_draft.md`)과 같다.
  - [원문] 책에 글로 있음 (이번에 내가 원본 또는 원본 전사로 확인함)
  - [원전 2차] 번역·해설로만 봄
  - [해석] 글을 보고 자리에 맞춤
  - [추정] 근거 없이 정함
  - [전승] 책 밖의 이야기
- **시계**: 시작 02:29, 끝은 맨 아래에 적는다 (KST).

책 약칭:
| 약칭 | 책 | 어디서 봤나 |
|---|---|---|
| 고디뉴 | Godinho, *Arte de Esgrima* (1599, BNP PBA 58). 손글씨, 글은 카스티야어(포르투갈식 철자 섞임) | 세션 밖 `scratchpad/sources/godinho_1599_pba58.pdf`(270 쪽, 글자층 없음). 쪽을 그림으로 떠서 직접 읽음. **PDF 쪽(1부터) = 2 × fol − 7** (앞면). 몬탄테 장 = fol.110r~(차례 「Del montante f.110」, 「Declaracion del montante f.124」, PDF 6 쪽) |
| 피게이레두 | Figueyredo, *Memorial da Prattica do Montante* (1651, Ajuda 49.III.20 nº21). 단순 규칙 16 + 복합 규칙 16 | Wiktenauer 'Diogo Gomes de Figueyredo' 문서의 Myers·Hick 전사(포르투갈어 원문)와 영역. 원본 쪽 그림은 없다 → **규칙 번호로 적는다**: 피 단Ⅰ = 단순 규칙 Ⅰ, 피 복Ⅱ = 복합 규칙 Ⅱ. 영역은 CC BY-NC-SA 라 짧은 원어 낱말만 옮긴다 |
| 마이어 | Meyer, *Gründtliche Beschreibung* (1570). 장검 Ⅰ, 두삭 Ⅱ | sprechfenster.org(diestro) 판: 독일어 원문 + Garber 영역 나란히. **fol. 번호는 원본 그대로** (예: Ⅱ.22r.3) |

## 0. 한 장 요약
- **왜 하나**: 지금 HUD 에 틀 표의 이름이 그대로 보인다.
  - 츠바이핸더(이베리아)와 냉동 참치(무유파)가 앞무게 틀(`frames.js FRAME_GUARDS.heavy`)의 일본식 이름 **상단·팔상·중단·협**을 보인다.
  - 세이버·팔쉬온(독일 두삭)과 나뭇가지·고무 닭·모르겐슈테른(무유파)이 한손 틀(`FRAME_GUARDS.one`)의 이탈리아 레이피어 이름 **3번 자세 (Terza)·바깥 막기 (Seconda)·안쪽 막기 (Quarta)**를 보인다.
  - 이 세 표가 그 자리를 채운다.
- **이베리아 (몬탄테)**: 피게이레두에 **자세 낱말이 실제로 있다** — `postura recta`(곧은 자세: 베기마다 얼굴 앞에 멈춤)와 `postura obtusa / angulo obtuso`(비낀 자세: 오른손을 허리띠 앞에 두고 칼을 오른 대각으로). 칼끝을 땅에 두고 시작하는 꼴(`ponta no chão`), 오른 귀 앞 겨눔(`defronte da orelha direyta`), 가로 탈류·가로 레베스(`talho/revez orizontal`)도 원문에 있다.
  - 14 자리 가운데 원문 낱말로 자리까지 붙는 곳 **7**, 베기 이름으로 자리를 부른 곳([해석]) **6**, 쉬운 말 **1**.
  - 고디뉴 몬탄테 장에는 자세 이름이 없다. 쥐는 법·tajo·revés·tajo rastero 같은 베기 낱말만 있다.
- **독일 두삭 가지**: 마이어가 두삭 자세를 **옆 다섯**(Zornhut·Stier·Mittelhut·Eber·Wechsel, 좌우 둘 다)과 **가운데 다섯**(Wacht·Schnitt·Langort·Bastei·Bogen)으로 적었다 (Ⅱ.2r.2 [원문]).
  - 14 자리 가운데 원문 이름이 붙는 곳 **12**, 쉬운 말 **2**(옆 지킴·왼 쟁기 — 마이어는 Eber 를 '오른쪽에서만' 쓴다고 적음).
  - Schnitt·Bogen 은 막기(Versatzung) 자세라 자세표가 아니라 막기 덧씌우기(`COVERS`) 이름 후보로 둔다.
- **무유파**: 쉬운 말 14. 한손 표와 앞무게 표에 같은 말이 맞도록 골랐다 (한 표로 둘을 덮음).
- **독일 롱소드 지금 이름**: 마이어 장검 원문과 대조했다. **틀린 이름은 없다.** 바꿀 것 없음 (5절).
- **코드에 넣을 때 하나 걸리는 점**: 두삭 이름은 독일 유파 **가지**(`branches['one:cut']`)에 붙어야 한다. 지금 `sword_art.js schoolNames` 는 `TRADITIONS[tradition].names` 만 읽는다. 그대로 `german.names` 에 넣으면 롱소드까지 두삭 이름이 된다 → 가지 이름을 읽는 한 줄이 필요하다 (6절). 이 문서는 src 를 고치지 않았다.

## 1. 바탕 — 이름이 붙는 자리와 지금 값
- 열쇠는 `guards.js` 바탕 자리 이름 글자 그대로다: `'지붕 (Vom Tag)'`, `'어깨 지붕 (Vom Tag)'`, `'황소 (Ochs)'`, `'긴 자세 (Langort)'`, `'옆 자세'`, `'쟁기 (Pflug)'`, `'바꿈 (Wechsel)'`, `'옆 지킴 (Nebenhut)'`, `'바보 (Alber)'`, `'왼쪽 어깨 지붕'`, `'왼쪽 황소'`, `'왼쪽 옆 자세'`, `'왼쪽 쟁기'`, `'왼쪽 바꿈'`.
- 무기 → 유파 → 표 (`schools.js traditionOf`, `sword_art.js baseTableOf`, `frames.js buildFrameTable`):

| 무기 | 틀:방식 | 유파 | 자세표 | 지금 HUD 이름 |
|---|---|---|---|---|
| 츠바이핸더 | heavy:cut | 이베리아 | 롱소드 표 + `FRAME_GUARDS.heavy` | 상단·팔상·왼 팔상·중단·협 + 롱소드 이름 |
| 냉동 참치 | heavy:blunt | 무유파 | 위와 같음 | 위와 같음 |
| 세이버·팔쉬온 | one:cut | 독일 (두삭 가지) | 한손 세이버 표 + `FRAME_GUARDS.one` | 3번 자세·바깥 막기·안쪽 막기 + 롱소드 이름 |
| 나뭇가지·고무 닭·모르겐슈테른 | one:blunt | 무유파 | 위와 같음 | 위와 같음 |
| 권총 | gun | 무유파 | 한손 세이버 표 (사격 자세는 `gun.js` 가 덮음) | 위와 같음 |
| 모노호시자오 | heavy:cut | 일본 (스펙 school) | 앞무게 표 | 일본 이름 (이미 있음) |

- 칼끝 = [올려본 각, 옆 각] (도), 손 = [앞, 위, 칼 든 쪽] (m). 아래 표의 값은 지금 코드 값 그대로 옮긴 것이고, **이 문서는 하나도 바꾸지 않는다.**

## 2. 이베리아 (몬탄테) — 앞무게 표 14 자리

### 2-1. 원전에서 읽은 것
- **고디뉴 몬탄테 장** (fol.110r~, PDF 213~) — 손글씨를 내가 읽은 것이라 낱말 읽기 자체가 [해석]이 섞인다.
  - fol.110r 장 제목 「Capitulo primero del montante y declaraciones sobre el」, 난외 「como se a de traer el montante y como se a de tomar」 (PDF 213).
  - **쥐는 법** fol.112v 규칙 3: 「tomarás el montante con la mano derecha junto a las guarniciones y con la zurda junto al pomo」 — 오른손은 코등이 곁, 왼손은 폼멜 곁 (PDF 218).
  - **베기 낱말** fol.113r: tajo(오른쪽에서 베기)는 「armado por el aire」, 「de arriba abajo」 로 벤다. revés(왼쪽에서 베기)는 「armado por encima de la cabeza」. 찌르기는 punta (PDF 219).
  - **낮은 베기** fol.117v 규칙 8: 「un tajo rastero a las piernas」 — 몸을 굽히고 팔을 뻗어 다리를 쓸듯 벤다 (PDF 227).
  - **좁은 길** fol.111v 장 2: 「de muñeca」(손목으로 돌림), 「muy recogido al pecho」(가슴에 바짝 모음) (PDF 216).
  - **몬탄테끼리** fol.111r: 규칙을 쓰지 말고 칼 둘이 싸우듯(「batalla firmada como dos espadas」) 한다 (PDF 215).
  - **자세 이름은 이 장에 없다.** 규칙은 '어디서 무엇을 벤다'로만 적혀 있다.
- **피게이레두** (전사 원문의 낱말을 그대로 옮김):
  - 단Ⅰ: 「o Montante com a ponta no chão, tomado na cruz com a mão dereyta」 — 칼끝을 땅에 두고 시작한다. 이어 「talho por detras, de baxo para sima」, 「parando com o montante em **postura recta** defronte [do rosto]」 [원문].
  - 단Ⅱ: 탈류 뒤 「a ponta para diante com as mãos altas defronte dos olhos」 — 칼끝은 앞, 두 손은 눈앞 높이에 멈춘다 [원문].
  - 복Ⅱ: 「Levantarseha o Montante com a ponta para diante defronte da **orelha direyta**」(오른 귀 앞, 칼끝 앞). 이어 머리 위·어깨 뒤로 넘겨 「caya sobre o braço esquerdo para dar hũ **revez cingido**」(왼팔 위로 떨어뜨려 감아 도는 레베스) [원문].
  - 단Ⅲ·복Ⅲ 외 여럿: 「armando a estocada sobre o braço dereyto」 — 오른팔 위에서 찌르기를 준비 [원문].
  - 단Ⅸ: 「hũ altibaxo」(곧게 내려치기), 「estocada com a maçãm do montante no hombro dereyto」(폼멜을 오른 어깨에 두고 찌름) [원문].
  - 단Ⅺ (coxia de galé): 「talho orizontal」, 「revez … orizontal」 — 가로 탈류·가로 레베스 [원문].
  - 단ⅩⅣ: 「o montante em **postura obtuza**」 [원문]. 복ⅩⅣ: **「Duas posturas universaes」** — 첫째 「o montante em angulo obtuso na diagonal dereyta desorte que fique a mão dereyta defronte da sintura」(오른 대각, 오른손 허리띠 앞), 둘째 「o montante em angulo obtuso pella diagonal esquerda」(왼 대각) [원문].
  - 복ⅩⅤ: 「levando o montante a parar alto defronte da cabeça para a parte esquerda, em linha obtusa pella diagonal」(머리 앞 왼쪽 높이 비껴 멈춤), 「hũ revez debaxo para sima」(아래에서 올리는 레베스), 「ficando o montante alto na diagonal dereyta em angulo obtuso」 [원문].
- **지금 코드 주석과 원문이 다른 곳 (보고만 한다, 고치지 않음)**:
  - `frames.js` heavy 주석과 `docs/weapon_motions.md` 는 「몬탄테 첫 규칙: 오른 어깨에서 탈류, 왼 어깨에서 레베스」라고 적었다.
  - 원문 단Ⅰ은 **칼끝을 땅에 두고 시작해, 뒤에서 아래→위로 탈류를 올려, 얼굴 앞 곧은 자세에 멈추는** 규칙이다. 어깨 이야기는 없다.
  - '좌우 번갈아 벤다'는 뜻은 여러 규칙에 맞지만, '첫 규칙'·'어깨'는 원문에 없다. `docs/motion/sources.md` 9/29 기록('베기마다 칼을 얼굴 앞에 세워 멈춘다')이 원문과 맞다.
- **철자**: 고디뉴는 카스티야어(tajo·revés), 피게이레두는 포르투갈어(talho·revez·altibaxo). 자세 낱말(postura recta·obtusa)이 피게이레두에만 있어서 **HUD 는 포르투갈어로 통일**하길 권한다. 저장소가 이미 '탈류(talho)·레베스'를 쓰고 있어 맞는다. 고디뉴 낱말은 대안 칸에 둔다.

### 2-2. 14 자리 표
- 지금 값 = 롱소드 표 위에 `FRAME_GUARDS.heavy` 를 덮은 것 (츠바이핸더. 참치도 같은 표지만 무유파라 3절 이름을 쓴다).

| # | 자리 | 지금 손 / 칼끝 (지금 HUD) | 이베리아 이름 (HUD 제안) | 한 줄 설명 | 근거 | 확신 |
|---|---|---|---|---|---|---|
| 0 | 지붕 (Vom Tag) | [0.2, 0.46, 0.05] / [115, 0] (상단) | **머리 위 (altibaxo)** | 칼을 이마 위로 들고 칼끝은 뒤로 · 곧게 내려친다 | 피 단Ⅸ·복ⅩⅤ 「altibaxo」 [원문 낱말] · 고디뉴 fol.113r 「de arriba abajo」 [원문 낱말] · 이 자리에 붙인 것 [해석] | 중 |
| 1 | 어깨 지붕 | [0.12, 0.22, 0.2] / [70, 165] (팔상 · 어깨 메기) | **탈류 준비 (talho)** | 칼을 오른 어깨에 메어 칼끝은 뒤로 · 오른쪽 위에서 비스듬히 내려벤다 | 탈류 = 오른쪽에서 오는 베기: 피 단Ⅲ 등 「talho」, 고디뉴 fol.113r 「tajo … armado por el aire」 [원문 낱말]. 어깨에 멘다는 글은 없다 → 자리 [해석] | 중 |
| 2 | 황소 (Ochs) | [0.28, 0.29, 0.22] / [−15, −12] (황소) | **귀 앞 겨눔 (orelha direyta)** | 칼자루를 오른 귀 앞에, 칼끝은 앞 · 여기서 앞으로 탈류 | 피 복Ⅱ 「com a ponta para diante defronte da orelha direyta」 [원문] | 상 |
| 3 | 긴 자세 (Langort) | [0.38, −0.1, 0.03] / [12, 0] (중단) | **곧은 자세 (postura recta)** | 칼을 얼굴 앞 가운데에 곧게 · 베기마다 여기 멈춘다 | 피 단Ⅰ 「parando com o montante em postura recta defronte」, 단Ⅱ 「mãos altas defronte dos olhos」, 복Ⅶ 「sempre parará o montante defronte do rosto」 [원문]. 원문 손은 눈높이, 우리 손은 배꼽 앞 → 자리 [해석] | 중 |
| 4 | 옆 자세 | [0.15, 0.12, 0.28] / [5, 110] (옆 자세) | **가로 탈류 (talho orizontal)** | 칼을 오른쪽에 가로로 눕힌다 · 가로로 벤다 | 피 단Ⅺ 「talho orizontal」 [원문] | 상 |
| 5 | 쟁기 (Pflug) | [0.28, −0.31, 0.15] / [30, −12] (쟁기) | **비낀 자세 (postura obtusa)** | 오른손을 허리띠 앞에, 칼은 오른 대각으로 비껴 · 찌르기를 받아 탈류로 쳐낸다 | 피 복ⅩⅣ 「angulo obtuso na diagonal dereyta … a mão dereyta defronte da sintura」, 단ⅩⅣ 「postura obtuza」 [원문] | 상 |
| 6 | 바꿈 (Wechsel) | [0.25, −0.33, 0.2] / [−45, 40] (바꿈) | **아래 탈류 (talho de baxo)** | 칼끝을 오른쪽 아래로 · 아래에서 위로 탈류를 올린다 | 피 단Ⅰ·복Ⅰ·단Ⅸ 「talho de baxo para sima」 [원문 낱말]. 오른쪽 아래에서 시작한다는 것은 [해석] (탈류 = 오른쪽 베기) | 중 |
| 7 | 옆 지킴 (Nebenhut) | [0.05, −0.25, 0.2] / [−35, 160] (협) | **뒤 탈류 (talho por detras)** | 칼을 오른 허리 뒤로 숨긴다 · 뒤에서 앞으로 탈류 | 피 단Ⅰ·단Ⅲ 등 「talho por detras」 [원문 낱말] · 자리 [해석]. 대안: 고디뉴 「tajo rastero」(다리 쓸어 베기) fol.117v | 중하 |
| 8 | 바보 (Alber) | [0.4, −0.33, 0.02] / [−40, 0] (바보) | **칼끝 땅에 (ponta no chão)** | 칼끝을 앞 땅으로 · 첫 규칙이 여기서 시작한다 | 피 단Ⅰ 「o Montante com a ponta no chão」 [원문] | 상 |
| 9 | 왼쪽 어깨 지붕 | [0.16, 0.22, −0.12] / [70, −165] (왼 팔상 · 레베스 준비) | **레베스 준비 (revez)** | 머리 위로 넘긴 칼을 왼 어깨·왼팔에 떨군다 · 왼쪽에서 감아 벤다 | 피 복Ⅱ 「passar por sima da cabeça as espaldas … caya sobre o braço esquerdo para dar hũ revez cingido」 [원문] · 고디뉴 fol.113r 「revés … armado por encima de la cabeza」 | 상 |
| 10 | 왼쪽 황소 | [0.28, 0.29, −0.12] / [−15, 12] (왼쪽 황소) | **왼 높이 비낌 (linha obtusa)** | 칼을 머리 앞 왼쪽 높이에 비껴 멈춘다 | 피 복ⅩⅤ 「parar alto defronte da cabeça para a parte esquerda, em linha obtusa」 [원문] · 손이 머리 왼쪽인 것은 맞고 칼끝 방향은 [해석] | 중 |
| 11 | 왼쪽 옆 자세 | [0.2, 0.12, −0.18] / [5, −110] (왼쪽 옆 자세) | **가로 레베스 (revez orizontal)** | 칼을 왼쪽에 가로로 · 왼쪽에서 가로로 벤다 | 피 단Ⅺ 「revez … orizontal」 [원문] | 상 |
| 12 | 왼쪽 쟁기 | [0.28, −0.31, −0.06] / [30, 12] (왼쪽 쟁기) | **왼 비낀 자세 (postura obtusa)** | 칼을 왼 대각으로 비껴 · 찌르기를 레베스로 쳐낸다 | 피 복ⅩⅣ 둘째 posture 「angulo obtuso pella diagonal esquerda para desviar de revez」 [원문] | 상 |
| 13 | 왼쪽 바꿈 | [0.32, −0.31, −0.1] / [−45, −40] (왼쪽 바꿈) | **아래 레베스 (revez de baxo)** | 칼끝을 왼쪽 아래로 · 아래에서 위로 레베스를 올린다 | 피 복ⅩⅤ 「hũ revez debaxo para sima」 [원문 낱말] · 자리 [해석] | 중 |

- **근거 정도**: 원문 낱말 + 자리 근거 7 (2·4·5·8·9·11·12), 원문 낱말 + 자리 [해석] 6 (0·1·3·6·10·13), 원문 낱말 + 자리 [해석] 이지만 대안이 있는 곳 1 (7).
- **쉬운 말로 바꿀 수 있는 곳**: 0·1·6·7·13 은 '베기 이름 + 준비'라서, 사장님이 원하면 쉬운 말('머리 위'·'오른 어깨 메기'·'오른 아래'·'오른 뒤 숨김'·'왼 아래')로 둘 수 있다.
- **[전승] 후보**: 없다. 몬탄테에는 널리 퍼진 자세 별명이 없다 — 지어내지 않았다.

### 2-3. 붙여 넣을 꼴
```js
// 이베리아 (몬탄테 — 츠바이핸더, 앞무게 틀). 이름 14 자리 — 피게이레두 1651 원문 낱말 + 자리 근거 7, 자리 [해석] 7.
//  피 단Ⅰ = 단순 규칙 Ⅰ, 피 복Ⅱ = 복합 규칙 Ⅱ (Myers·Hick 전사). 고디뉴 = Arte de Esgrima 1599 fol (PDF 쪽 = 2×fol − 7)
const IBERIAN_NAMES = {
  '지붕 (Vom Tag)': { name: '머리 위 (altibaxo)', desc: '칼을 이마 위로 들고 칼끝은 뒤로 · 곧게 내려친다', src: '피 단Ⅸ·복ⅩⅤ altibaxo · 고디뉴 fol.113r de arriba abajo · 자리 [해석]' },
  '어깨 지붕 (Vom Tag)': { name: '탈류 준비 (talho)', desc: '칼을 오른 어깨에 메어 칼끝은 뒤로 · 오른쪽 위에서 비스듬히 내려벤다', src: '피 단Ⅲ talho · 고디뉴 fol.113r tajo · 자리 [해석]' },
  '황소 (Ochs)': { name: '귀 앞 겨눔 (orelha direyta)', desc: '칼자루를 오른 귀 앞에, 칼끝은 앞 · 여기서 앞으로 탈류', src: '피 복Ⅱ' },
  '긴 자세 (Langort)': { name: '곧은 자세 (postura recta)', desc: '칼을 얼굴 앞 가운데에 곧게 · 베기마다 여기 멈춘다', src: '피 단Ⅰ·단Ⅱ·복Ⅶ · 손 높이는 [해석]' },
  '옆 자세': { name: '가로 탈류 (talho orizontal)', desc: '칼을 오른쪽에 가로로 눕힌다 · 가로로 벤다', src: '피 단Ⅺ' },
  '쟁기 (Pflug)': { name: '비낀 자세 (postura obtusa)', desc: '오른손을 허리띠 앞에, 칼은 오른 대각으로 비껴 · 찌르기를 받아 탈류로 쳐낸다', src: '피 단ⅩⅣ·복ⅩⅣ' },
  '바꿈 (Wechsel)': { name: '아래 탈류 (talho de baxo)', desc: '칼끝을 오른쪽 아래로 · 아래에서 위로 탈류를 올린다', src: '피 단Ⅰ·단Ⅸ · 자리 [해석]' },
  '옆 지킴 (Nebenhut)': { name: '뒤 탈류 (talho por detras)', desc: '칼을 오른 허리 뒤로 숨긴다 · 뒤에서 앞으로 탈류', src: '피 단Ⅰ·단Ⅲ · 자리 [해석] (대안 고디뉴 fol.117v tajo rastero)' },
  '바보 (Alber)': { name: '칼끝 땅에 (ponta no chão)', desc: '칼끝을 앞 땅으로 · 첫 규칙이 여기서 시작한다', src: '피 단Ⅰ' },
  '왼쪽 어깨 지붕': { name: '레베스 준비 (revez)', desc: '머리 위로 넘긴 칼을 왼 어깨에 떨군다 · 왼쪽에서 감아 벤다', src: '피 복Ⅱ revez cingido · 고디뉴 fol.113r' },
  '왼쪽 황소': { name: '왼 높이 비낌 (linha obtusa)', desc: '칼을 머리 앞 왼쪽 높이에 비껴 멈춘다', src: '피 복ⅩⅤ · 칼끝 방향 [해석]' },
  '왼쪽 옆 자세': { name: '가로 레베스 (revez orizontal)', desc: '칼을 왼쪽에 가로로 · 왼쪽에서 가로로 벤다', src: '피 단Ⅺ' },
  '왼쪽 쟁기': { name: '왼 비낀 자세 (postura obtusa)', desc: '칼을 왼 대각으로 비껴 · 찌르기를 레베스로 쳐낸다', src: '피 복ⅩⅣ 둘째 posture' },
  '왼쪽 바꿈': { name: '아래 레베스 (revez de baxo)', desc: '칼끝을 왼쪽 아래로 · 아래에서 위로 레베스를 올린다', src: '피 복ⅩⅤ · 자리 [해석]' },
};
// 넣는 곳: TRADITIONS.iberian = { …, names: IBERIAN_NAMES } (이베리아는 지금 츠바이핸더뿐 — 참치는 무유파라 닿지 않는다)
```

### 2-4. 기술 이름 (참고 — HUD 기술 이름을 붙일 때)
| 우리 기술 | 몬탄테 이름 | 근거 |
|---|---|---|
| zornhau (오른 어깨 → 왼 아래) | 탈류 (talho) | 피 여러 규칙 · 고디뉴 tajo [원문 낱말] |
| zornhauL (왼 어깨 → 오른 아래) | 레베스 (revez) | 같음 |
| oberhau (머리 위 → 아래) | 알티바쇼 (altibaxo) | 피 단Ⅸ·복ⅩⅤ [원문 낱말] |
| zwerch / zwerchL | 가로 탈류 / 가로 레베스 | 피 단Ⅺ [원문] |
| unterhau / unterhauL | 아래 탈류 / 아래 레베스 (de baxo para sima) | 피 단Ⅰ·복ⅩⅤ [원문 낱말] |
| stich* (찌르기) | 에스토카다 (estocada), 고디뉴 punta | 피 복Ⅲ·단Ⅳ 등 「armando a estocada」 · 고디뉴 fol.113r [원문 낱말] |
| talhoReves (8자 이어 베기) | 탈류·레베스 잇기 (revez cingido 로 감아 돎) | 피 복Ⅱ [원문] — 이름 그대로 맞다 |

## 3. 독일 두삭 가지 — 한손 세이버 표 14 자리

### 3-1. 원전에서 읽은 것 (마이어 1570 두삭 편)
- **자세 목록** Ⅱ.2r.2 [원문]: 「Erstlich so seind der Läger fünff: Nemblich die Zorn hut, der Stier, die Mittel hut, der Eber, und der Wechsel: welche, wie du sie zur Rechten anschicket, also solstu sie auch zur Lincken ins werck richten. Ferner hastu gerad vor dir … auch fünffe. Nemblich … die Wacht, … den Schnidt, welches ist die versatzung, von oben, das Lang orth, die Bastey auff zweyerley art, … den Bogen welches ist die andere versatzung von unden」.
  - 옆 다섯(오른쪽·왼쪽 둘 다): Zornhut·Stier·Mittelhut·Eber·Wechsel.
  - 가운데 다섯: Wacht·Schnitt(위에서 오는 막기)·Langort·Bastei(두 가지)·Bogen(아래에서 막기).
- 자세마다 [원문]:
  - **Wacht** Ⅱ.20r.2: 「halt dein Dusacken uber den Kopff, und laß die klingen hind dir abhangen」 — 머리 위, 칼날은 뒤로 늘어뜨림. 오른발 앞.
  - **Stier** Ⅱ.22r.3: 「halt dein Dusacken mit deim gehültz zur Rechten, neben deim Kopff, Also das der vorder ort dem Mann gegen seinem gesicht stand」 — 칼자루는 머리 오른쪽, 칼끝은 상대 얼굴. 「ein gezuckter stoß von oben」(위에서 당겨 둔 찌르기). 왼발 앞.
  - **Zornhut** Ⅱ.29r.1: 「wirt auch zu beiden seiten gebraucht」(양쪽에서 씀), Stier 와 다른 것은 찌르기 대신 '성난 몸짓의 베기'뿐. 꼴은 그림(M)만 — 장검 Zornhut Ⅰ.7v.3 「halt dein Schwerdt auff der rechten Achsel, also das die Kling hindersich herab zum gefaßten streich hanget」(오른 어깨, 칼날 뒤로 늘어뜨림)와 같다고 본다 [해석].
  - **Mittelhut** Ⅱ.43r.2: 「solche auß dem Mittelhauw endtspringt」 — 가운데 베기(가로)가 끝나는 자리. 오른쪽에서 벤 칼이 「neben deiner Lincken zu ruck verschwingen … biß in die Mittelhut」(왼쪽 옆으로 흘러 Mittelhut 에 듦).
  - **Eber** Ⅱ.41r.3: 낮은 자세로 높은 자세를 깬다. 「die Hut des Ebers wirt allein zur Rechten gebraucht」 — **오른쪽에서만** 쓴다. 꼴은 그림(M)만. Wechsel 장 15 [8]: Eber 에서 팔을 뻗어 얼굴로 찌른다 (Garber 영역).
  - **Wechsel** Ⅱ.45v.2: 「halt dein Dusacken mit außgestrecktem Arm neben dir beiseits auß, mit dem ort auff die Erden」 — 옆에 팔을 뻗어 칼끝을 땅에. 「gehet zu beiden seiten」(양쪽).
  - **Bastei** Ⅱ.47v.4: 「lege dein Dusacken weit von dir außgestreckt auff die erden, gleich dem Olber im Schwerdt」 — 칼끝을 멀리 앞 땅에, **장검의 바보(Alber)와 같다**. 왼발 앞, 칼자루는 왼발 앞쪽으로.
  - **Schnitt** Ⅱ.32v.2·**Bogen** Ⅱ.36v.1: 막기 자세(gerade Versatzung · Versatzung von unden). 둘 다 Langort 로 끝난다 (Ⅱ.16r 막기 장).
- **네 베기** Ⅱ.2v.2~Ⅱ.3v [원문]: Oberhau(곧은 위 베기, Scheittel Lini), Zornhau(비스듬히 내림, Zorn Lini), Mittelhau(가로, Zwerch oder mittel Lini), Unterhau(아래에서 비스듬히 올림). 두삭에는 Zwerchhau 이름이 없고 가로 베기는 **Mittelhau** 다.

### 3-2. 14 자리 표
- 지금 값 = `guards.js ONE_HAND_SABRE` (팔꿈치를 굽혀 칼을 어깨·머리 옆에 두는 표). `FRAME_GUARDS.one` 은 이름만 덮고 값은 안 바꾼다.

| # | 자리 | 지금 손 / 칼끝 (지금 HUD) | 두삭 이름 (HUD 제안) | 한 줄 설명 | 근거 | 확신 |
|---|---|---|---|---|---|---|
| 0 | 지붕 (Vom Tag) | [0.2, 0.45, 0.12] / [95, 0] (지붕) | **망루 (Wacht)** | 칼을 머리 위로 · 위에서 곧게 내려벤다 | 마이어 Ⅱ.20r.2 [원문]. 원문은 칼날을 뒤로 늘어뜨리고, 우리 칼끝은 거의 곧게 섰다(95°) → 꼴 차이 [해석] | 중상 |
| 1 | 어깨 지붕 | [0.2, 0.18, 0.24] / [40, 170] (어깨 지붕) | **분노 자세 (Zornhut)** | 칼을 오른 어깨에 메어 칼날은 뒤로 · 비스듬히 내려벤다 | 마이어 Ⅱ.2r.2·Ⅱ.29r.1 [원문], 꼴은 장검 Ⅰ.7v.3 [해석] | 상 |
| 2 | 황소 (Ochs) | [0.36, 0.26, 0.17] / [−15, −12] (황소) | **황소 (Stier)** | 칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴 · 위에서 찌른다 | 마이어 Ⅱ.22r.3 [원문] | 상 |
| 3 | 긴 자세 (Langort) | [0.68, 0.08, 0.1] / [−3, 0] (3번 자세 Terza) | **긴 자세 (Langort)** | 팔을 쭉 뻗어 칼끝으로 겨눈다 · 막기가 끝나는 자리 | 마이어 Ⅱ.2r.2 「das Lang orth」, Ⅱ.16r 막기 장 [원문] | 상 |
| 4 | 옆 자세 | [0.14, 0.24, 0.3] / [30, 150] (옆 자세) | **가운데 지킴 (Mittelhut)** | 칼을 오른 옆 뒤로 눕힌다 · 가로로 벤다(가운데 베기) | 마이어 Ⅱ.2r.2·Ⅱ.43r.2 [원문] · 오른쪽 꼴은 왼쪽의 거울 [해석] | 중 |
| 5 | 쟁기 (Pflug) | [0.4, −0.22, 0.13] / [30, −12] (바깥 막기 Seconda) | **멧돼지 (Eber)** | 칼자루를 오른 허리 아래에, 칼끝은 상대 얼굴 · 아래에서 찌르고 올려벤다 | 마이어 Ⅱ.2r.2·Ⅱ.41r.3 [원문 이름]. 꼴은 그림뿐 → 레크퀴흐너 Eber = 장검 Pflug 자리 [원전 2차, `docs/weapon_motion_sources_one_pole.md` §2] 로 자리 [해석] | 중 |
| 6 | 바꿈 (Wechsel) | [0.3, −0.25, 0.2] / [−40, 30] (바꿈) | **바꿈 (Wechsel)** | 칼끝을 오른쪽 아래 땅으로 · 올려베기 준비 | 마이어 Ⅱ.45v.2 [원문] | 상 |
| 7 | 옆 지킴 (Nebenhut) | [0.1, −0.2, 0.26] / [−35, 150] (옆 지킴) | **옆 지킴** (쉬운 말) | 칼을 오른 허리 뒤로 숨긴다 | 두삭 편에 이 꼴의 이름이 없다. 장검 Nebenhut(Ⅰ.8r.2)에서 원어만 뺐다 | 하 |
| 8 | 바보 (Alber) | [0.46, −0.28, 0.07] / [−40, 0] (바보) | **보루 (Bastei)** | 칼끝을 앞 땅으로 멀리 · 아래를 막고 올려친다 | 마이어 Ⅱ.47v.4 「gleich dem Olber im Schwerdt」 [원문] | 상 |
| 9 | 왼쪽 어깨 지붕 | [0.24, 0.2, −0.04] / [45, −160] (왼쪽 어깨 지붕) | **왼 분노 자세 (Zornhut)** | 칼을 왼 어깨에 메어 칼날은 뒤로 · 왼쪽에서 비스듬히 내려벤다 | 마이어 Ⅱ.29r.1 「zu beiden seiten」 [원문] | 상 |
| 10 | 왼쪽 황소 | [0.34, 0.28, 0.0] / [−15, 12] (왼쪽 황소) | **왼 황소 (Stier)** | 칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴 | 마이어 Ⅱ.2r.2 (옆 다섯은 왼쪽에도) [원문] | 상 |
| 11 | 왼쪽 옆 자세 | [0.24, 0.14, −0.02] / [25, −150] (왼쪽 옆 자세) | **왼 가운데 지킴 (Mittelhut)** | 가로 베기가 끝나 칼이 왼 옆에 눕는다 · 되받아 가로로 | 마이어 Ⅱ.43r.2 「neben deiner Lincken … biß in die Mittelhut」 [원문] | 상 |
| 12 | 왼쪽 쟁기 | [0.36, −0.22, 0.0] / [25, 12] (안쪽 막기 Quarta) | **왼 허리 겨눔** (쉬운 말) | 칼자루를 왼 허리에, 칼끝은 상대 얼굴 | 마이어 Ⅱ.41r.3 「allein zur Rechten」 — 왼 Eber 는 없다 | 하 |
| 13 | 왼쪽 바꿈 | [0.36, −0.28, −0.02] / [−45, −40] (왼쪽 바꿈) | **왼 바꿈 (Wechsel)** | 칼끝을 왼쪽 아래로 · 분노 베기가 끝나는 자리 | 마이어 Ⅱ.45v.2 「gehet zu beiden seiten」 [원문] | 상 |

- **근거 정도**: 원문 이름 + 원문 꼴 9 (0·2·3·6·8·9·10·11·13), 원문 이름 + 꼴 [해석] 3 (1·4·5), 쉬운 말 2 (7·12).
- **안 쓴 마이어 이름**:
  - Schnitt(곧은 막기)·Bogen(아래 막기): 막기 자세다. 자세표에 넣으면 베기 길이 휜다(무기 PM 규칙 1). `frames.js COVERS.one` 이름 후보로 둔다 — highC '머리 막기 (St. George)' 자리에 Schnitt, highR '걸친 막기 (Hanging guard)' 자리에 Bogen 을 쓸지는 꼴 비교가 먼저다 [해석].
  - Bastei 둘째 꼴(칼자루를 세우고 칼끝을 발 앞 땅에): 바보 자리 하나라 첫째 꼴만 썼다.
- **[전승] 후보**: 레크퀴흐너 메서 이름(Luginsland = 망루, Pastei)은 같은 독일 계통이지만 두삭이 아니라 메서다. Wacht 자리 대안으로 Luginsland 만 적어 둔다.

### 3-3. 기술 이름 (두삭)
| 우리 기술 | 두삭 이름 | 근거 |
|---|---|---|
| oberhau | 위 베기 (Oberhau) | Ⅱ.2v.2~3v 네 베기 [원문] |
| zornhau / zornhauL | 분노 베기 (Zornhau) 오른·왼 | 같음 |
| zwerch / zwerchL | 가운데 베기 (Mittelhau) 오른·왼 | 같음 — 두삭엔 Zwerchhau 이름이 없다 |
| unterhau / unterhauL | 아래 베기 (Unterhau) 오른·왼 | 같음 |
| stichOchs / stichOchsL | 황소 찌르기 (Stier) | Ⅱ.22r.3 「ein gezuckter stoß von oben」 [원문] |
| stichPflug / stichPflugL | 멧돼지 찌르기 (Eber) | Eber 에서 팔을 뻗어 얼굴로 찌름 (Wechsel 장 15 [8], Garber 영역) [원전 2차] |
| stichAlber | (이름 없음) 쉬운 말 '아래에서 찌르기' | — |
| wristCut (한손 틀) | (이름 없음) 쉬운 말 '손목 베기'. 마이어는 아래팔 뼈를 끊어 치는 법을 적었지만(Schnitt 장 [12]) 이름은 없다. 레이피어 편의 'Hand Cuts' 는 다른 편 | [해석] |
| molinello (사람만) | 후보: 장미 베기 (Rosenhau) — 상대 칼 둘레로 원을 그려 들어감 (Ⅱ.11r 부근, 장 4 [10]) | [해석] |
| 이어 치기: zornhau → zornhauL | 십자 베기 (Kreutzhau) — 양쪽 분노 베기 둘을 엇갈려 (장 4 [20], Ⅱ.14r.3) | [원문 뜻, 영역으로 읽음] |
| 바꿈에 드는 베기 | 바꿈 베기 (Wechselhau) — 「durch die Wechselhäuw in dise Leger kommest」 Ⅱ.45v.2 | [원문] |
- 그 밖의 곁 베기 이름(Krumphau·Kurtzhau·Blendthau·Windthau·Entrüsthau·Zwingerhau·Sturtzhau·Gefehrhau·Weckerhau·Brummerhau·Schnellhau)은 우리 기술 길에 맞는 것이 없어 적어만 둔다 (장 4, Ⅱ.8v.2~Ⅱ.14v).

### 3-4. 붙여 넣을 꼴
```js
// 독일 두삭 가지 (한손 베기 — 세이버·팔쉬온). 이름 14 자리 — 마이어 1570 두삭 편 원문 이름 12 + 쉬운 말 2.
//  롱소드와 같은 독일 유파라 TRADITIONS.german.names 가 아니라 가지에 둔다 (6절 — sword_art.js 가 가지 이름을 읽어야 함)
const DUSSACK_NAMES = {
  '지붕 (Vom Tag)': { name: '망루 (Wacht)', desc: '칼을 머리 위로 · 위에서 곧게 내려벤다', src: '마이어 1570 Ⅱ.20r.2' },
  '어깨 지붕 (Vom Tag)': { name: '분노 자세 (Zornhut)', desc: '칼을 오른 어깨에 메어 칼날은 뒤로 · 비스듬히 내려벤다', src: '마이어 Ⅱ.2r.2·Ⅱ.29r.1 · 꼴은 장검 Ⅰ.7v.3 [해석]' },
  '황소 (Ochs)': { name: '황소 (Stier)', desc: '칼자루를 머리 오른쪽에, 칼끝은 상대 얼굴 · 위에서 찌른다', src: '마이어 Ⅱ.22r.3' },
  '긴 자세 (Langort)': { name: '긴 자세 (Langort)', desc: '팔을 쭉 뻗어 칼끝으로 겨눈다 · 막기가 끝나는 자리', src: '마이어 Ⅱ.2r.2·Ⅱ.16r' },
  '옆 자세': { name: '가운데 지킴 (Mittelhut)', desc: '칼을 오른 옆 뒤로 눕힌다 · 가로로 벤다(가운데 베기)', src: '마이어 Ⅱ.2r.2·Ⅱ.43r.2 · 오른쪽 꼴 [해석]' },
  '쟁기 (Pflug)': { name: '멧돼지 (Eber)', desc: '칼자루를 오른 허리 아래에, 칼끝은 상대 얼굴 · 아래에서 찌르고 올려벤다', src: '마이어 Ⅱ.41r.3 · 자리 [해석] (레크퀴흐너 Eber = Pflug)' },
  '바꿈 (Wechsel)': { name: '바꿈 (Wechsel)', desc: '칼끝을 오른쪽 아래 땅으로 · 올려베기 준비', src: '마이어 Ⅱ.45v.2' },
  '옆 지킴 (Nebenhut)': { name: '옆 지킴', desc: '칼을 오른 허리 뒤로 숨긴다', src: '두삭 편에 없음 (쉬운 말)' },
  '바보 (Alber)': { name: '보루 (Bastei)', desc: '칼끝을 앞 땅으로 멀리 · 아래를 막고 올려친다', src: '마이어 Ⅱ.47v.4 「gleich dem Olber」' },
  '왼쪽 어깨 지붕': { name: '왼 분노 자세 (Zornhut)', desc: '칼을 왼 어깨에 메어 칼날은 뒤로 · 왼쪽에서 비스듬히 내려벤다', src: '마이어 Ⅱ.29r.1 「zu beiden seiten」' },
  '왼쪽 황소': { name: '왼 황소 (Stier)', desc: '칼자루를 머리 왼쪽에, 칼끝은 상대 얼굴', src: '마이어 Ⅱ.2r.2' },
  '왼쪽 옆 자세': { name: '왼 가운데 지킴 (Mittelhut)', desc: '가로 베기가 끝나 칼이 왼 옆에 눕는다 · 되받아 가로로', src: '마이어 Ⅱ.43r.2' },
  '왼쪽 쟁기': { name: '왼 허리 겨눔', desc: '칼자루를 왼 허리에, 칼끝은 상대 얼굴', src: '원전 없음 (마이어 Ⅱ.41r.3: Eber 는 오른쪽만)' },
  '왼쪽 바꿈': { name: '왼 바꿈 (Wechsel)', desc: '칼끝을 왼쪽 아래로 · 분노 베기가 끝나는 자리', src: '마이어 Ⅱ.45v.2 「zu beiden seiten」' },
};
// 넣는 곳 (안): TRADITIONS.german.branches['one:cut'] = { nameKo: '두삭 (한손 베기)', thrustK: 0.5, names: DUSSACK_NAMES }
```

## 4. 무유파 — 쉬운 말 14 (앞무게 표·한손 표 함께)
- 무유파 무기: 냉동 참치(앞무게 표), 나뭇가지·고무 닭·모르겐슈테른(한손 세이버 표), 권총(한손 표 + 사격 자세).
- 이름 한 벌로 두 표를 덮는다 (`schoolNames` 가 유파마다 한 벌만 읽으므로). 그래서 두 표에서 같은 뜻이 되는 말만 골랐다. 역사 낱말은 쓰지 않는다. 원어 괄호도 없다.

| # | 자리 | 앞무게 표 (참치) 손 / 칼끝 | 한손 표 (몽둥이류) 손 / 칼끝 | 무유파 이름 | 한 줄 설명 | 확신 |
|---|---|---|---|---|---|---|
| 0 | 지붕 (Vom Tag) | [0.2, 0.46, 0.05] / [115, 0] | [0.2, 0.45, 0.12] / [95, 0] | **머리 위** | 머리 위로 높이 든다 · 내려친다 | 상 |
| 1 | 어깨 지붕 | [0.12, 0.22, 0.2] / [70, 165] | [0.2, 0.18, 0.24] / [40, 170] | **오른 어깨 메기** | 오른 어깨에 메어 끝을 뒤로 · 비스듬히 내려친다 | 상 |
| 2 | 황소 (Ochs) | [0.28, 0.29, 0.22] / [−15, −12] | [0.36, 0.26, 0.17] / [−15, −12] | **머리 옆 겨눔** | 손을 머리 오른쪽에, 끝은 상대 얼굴 | 상 |
| 3 | 긴 자세 (Langort) | [0.38, −0.1, 0.03] / [12, 0] | [0.68, 0.08, 0.1] / [−3, 0] | **앞으로 겨눔** | 끝을 상대에게 곧게 겨눈다 · 쉴 때 돌아오는 자리 | 상 (참치는 손이 몸 가까이, 한손은 팔을 뻗음 — 둘 다 '겨눔') |
| 4 | 옆 자세 | [0.15, 0.12, 0.28] / [5, 110] | [0.14, 0.24, 0.3] / [30, 150] | **오른쪽 젖히기** | 오른쪽 뒤로 젖혀 둔다 · 옆으로 후려친다 | 중 (참치는 가로로 눕고, 한손은 어깨 뒤로 비스듬 — '젖히기'가 둘을 덮는다) |
| 5 | 쟁기 (Pflug) | [0.28, −0.31, 0.15] / [30, −12] | [0.4, −0.22, 0.13] / [30, −12] | **허리 겨눔** | 손을 오른 허리에, 끝은 상대 얼굴 | 상 |
| 6 | 바꿈 (Wechsel) | [0.25, −0.33, 0.2] / [−45, 40] | [0.3, −0.25, 0.2] / [−40, 30] | **오른 아래로 내림** | 끝을 오른쪽 아래로 · 올려친다 | 상 |
| 7 | 옆 지킴 (Nebenhut) | [0.05, −0.25, 0.2] / [−35, 160] | [0.1, −0.2, 0.26] / [−35, 150] | **오른 뒤로 숨김** | 오른 허리 뒤로 숨겨 길이를 감춘다 | 상 |
| 8 | 바보 (Alber) | [0.4, −0.33, 0.02] / [−40, 0] | [0.46, −0.28, 0.07] / [−40, 0] | **앞으로 늘어뜨림** | 끝을 앞 아래로 늘어뜨린다 · 머리를 비워 끌어들인다 | 상 |
| 9 | 왼쪽 어깨 지붕 | [0.16, 0.22, −0.12] / [70, −165] | [0.24, 0.2, −0.04] / [45, −160] | **왼 어깨 메기** | 왼 어깨에 메어 끝을 뒤로 · 반대쪽으로 비스듬히 내려친다 | 상 |
| 10 | 왼쪽 황소 | [0.28, 0.29, −0.12] / [−15, 12] | [0.34, 0.28, 0.0] / [−15, 12] | **왼 머리 옆 겨눔** | 손을 머리 왼쪽에, 끝은 상대 얼굴 | 상 |
| 11 | 왼쪽 옆 자세 | [0.2, 0.12, −0.18] / [5, −110] | [0.24, 0.14, −0.02] / [25, −150] | **왼쪽 젖히기** | 왼쪽 뒤로 젖혀 둔다 · 반대쪽으로 후려친다 | 중 |
| 12 | 왼쪽 쟁기 | [0.28, −0.31, −0.06] / [30, 12] | [0.36, −0.22, 0.0] / [25, 12] | **왼 허리 겨눔** | 손을 왼 허리에, 끝은 상대 얼굴 | 상 |
| 13 | 왼쪽 바꿈 | [0.32, −0.31, −0.1] / [−45, −40] | [0.36, −0.28, −0.02] / [−45, −40] | **왼 아래로 내림** | 끝을 왼쪽 아래로 · 내려친 끝, 여기서 되올린다 | 상 |

- '칼끝' 대신 '끝'이라 썼다: 참치·고무 닭·모르겐슈테른에는 칼끝이 없다.
- 일본·중국 초안의 쉬운 말('머리 옆 겨눔'·'왼 허리 겨눔')과 낱말을 맞췄다.

```js
// 무유파 (둔기·총 — 냉동 참치·나뭇가지·고무 닭·모르겐슈테른·권총). 쉬운 말 14 — 역사 낱말 없음. 앞무게 표·한손 표에 같은 말
const NONE_NAMES = {
  '지붕 (Vom Tag)': { name: '머리 위', desc: '머리 위로 높이 든다 · 내려친다', src: '쉬운 말' },
  '어깨 지붕 (Vom Tag)': { name: '오른 어깨 메기', desc: '오른 어깨에 메어 끝을 뒤로 · 비스듬히 내려친다', src: '쉬운 말' },
  '황소 (Ochs)': { name: '머리 옆 겨눔', desc: '손을 머리 오른쪽에, 끝은 상대 얼굴', src: '쉬운 말' },
  '긴 자세 (Langort)': { name: '앞으로 겨눔', desc: '끝을 상대에게 곧게 겨눈다 · 쉴 때 돌아오는 자리', src: '쉬운 말' },
  '옆 자세': { name: '오른쪽 젖히기', desc: '오른쪽 뒤로 젖혀 둔다 · 옆으로 후려친다', src: '쉬운 말' },
  '쟁기 (Pflug)': { name: '허리 겨눔', desc: '손을 오른 허리에, 끝은 상대 얼굴', src: '쉬운 말' },
  '바꿈 (Wechsel)': { name: '오른 아래로 내림', desc: '끝을 오른쪽 아래로 · 올려친다', src: '쉬운 말' },
  '옆 지킴 (Nebenhut)': { name: '오른 뒤로 숨김', desc: '오른 허리 뒤로 숨겨 길이를 감춘다', src: '쉬운 말' },
  '바보 (Alber)': { name: '앞으로 늘어뜨림', desc: '끝을 앞 아래로 늘어뜨린다 · 머리를 비워 끌어들인다', src: '쉬운 말' },
  '왼쪽 어깨 지붕': { name: '왼 어깨 메기', desc: '왼 어깨에 메어 끝을 뒤로 · 반대쪽으로 비스듬히 내려친다', src: '쉬운 말' },
  '왼쪽 황소': { name: '왼 머리 옆 겨눔', desc: '손을 머리 왼쪽에, 끝은 상대 얼굴', src: '쉬운 말' },
  '왼쪽 옆 자세': { name: '왼쪽 젖히기', desc: '왼쪽 뒤로 젖혀 둔다 · 반대쪽으로 후려친다', src: '쉬운 말' },
  '왼쪽 쟁기': { name: '왼 허리 겨눔', desc: '손을 왼 허리에, 끝은 상대 얼굴', src: '쉬운 말' },
  '왼쪽 바꿈': { name: '왼 아래로 내림', desc: '끝을 왼쪽 아래로 · 내려친 끝, 여기서 되올린다', src: '쉬운 말' },
};
// 넣는 곳: TRADITIONS.none = { …, names: NONE_NAMES }
```

## 5. 독일 롱소드 지금 이름 — 맞는지 확인 (바꿀 것 없음)
- 마이어 장검 Ⅰ 장 3(자세) 원문과 대조했다. 꼴이 이름과 어긋나는 곳은 없다.

| 자리 | 지금 이름 | 마이어 원문 | 판단 |
|---|---|---|---|
| 0 | 지붕 (Vom Tag) | Ⅰ.6v.3 Tag: 머리 위로 높이, 칼끝은 곧게 위 | 맞음 (칼끝 100°) |
| 1 | 어깨 지붕 (Vom Tag) | 리히테나워 주해(Ringeck): Vom Tag 는 오른 어깨 위 또는 머리 위 [원전 2차]. 마이어는 어깨 위 칼날 뒤 늘어뜨림을 Zornhut 이라 부른다 (Ⅰ.7v.3) | 맞음. 우리 칼끝은 뒤 위 55° 라 늘어뜨린 Zornhut 이 아니다 → 그대로 |
| 2 | 황소 (Ochs) | Ⅰ.6v.1: 칼자루를 머리 오른쪽 높이, 칼끝은 상대 얼굴 | 맞음 |
| 3 | 긴 자세 (Langort) | Ⅰ.7v.4: 팔을 길게 뻗어 칼끝은 상대 얼굴 | 맞음 |
| 4 | 옆 자세 | 이름 없음 (가로베기 준비, 주석에 [추정]) | 그대로 — 원어를 붙이지 않은 것이 맞다 |
| 5 | 쟁기 (Pflug) | Ⅰ.6v.2: 칼자루를 앞무릎 곁, 칼끝은 상대 얼굴 | 맞음 (우리 손은 허리 높이 — 이름 문제 아님) |
| 6 | 바꿈 (Wechsel) | Ⅰ.8r.1: 칼끝을 옆 땅으로 뻗음, 짧은 날이 상대 쪽 | 맞음 |
| 7 | 옆 지킴 (Nebenhut) | Ⅰ.8r.2: 오른쪽 곁, 칼끝은 땅, 폼멜은 위 | 맞음 |
| 8 | 바보 (Alber) | Ⅰ.7v.2 Olber | 맞음 |
| 9~13 | 왼쪽 … (원어 없음) | 마이어는 Ochs·Pflug 를 좌우로 적었다 | 그대로 |

## 6. 코드에 넣을 때 (src 담당께 — 이 문서는 src 를 고치지 않음)
1. **이베리아·무유파**: `TRADITIONS.iberian.names = IBERIAN_NAMES`, `TRADITIONS.none.names = NONE_NAMES`. 지금 `schoolNames` 그대로 된다.
   - 참치는 무유파라 이베리아 이름이 닿지 않는다. 모노호시자오는 스펙 school 이 일본이라 닿지 않는다.
2. **두삭**: 독일 유파 안의 가지다. `schoolNames(names, tradition)` 는 `TRADITIONS[tradition].names` 만 읽는다.
   - 안: `resolveSwordArt` 에서 `TRADITIONS[tradition].branches?.[`${frame}:${style}`]?.names ?? TRADITIONS[tradition].names` 를 넘긴다.
   - `german.names` 에 바로 넣으면 롱소드·에스톡까지 망루·분노 자세가 된다 — 하면 안 된다.
3. **판에 닿지 않는다**: 이름·설명·출처만 바뀐다(HUD). 자세표(`table`)·패드·칼끝·돌림은 그대로. 관문 결정 덤프·결투 판은 바이트 같아야 한다.
4. 한손 틀 `FRAME_GUARDS.one` 의 이탈리아 이름(3번 자세·바깥 막기·안쪽 막기)은 유파 이름이 덮으므로 세이버·팔쉬온·둔기에서 사라진다. 레이피어(이탈리아)는 `STYLE_GUARDS['one:thrust']` 이름 그대로.
5. 앞무게 틀 `FRAME_GUARDS.heavy` 의 일본식 이름은 이제 어느 무기에도 보이지 않게 된다(츠바이핸더 이베리아, 참치 무유파, 모노호시자오 일본). 틀 이름을 '두손 앞무게 기본'으로 남길지는 틀 담당 몫.

## 7. 사장님께 여쭐 것
1. **이베리아 철자**: 포르투갈어(talho·revez·altibaxo — 피게이레두, 자세 낱말이 여기만 있음)로 통일할지, 고디뉴의 카스티야어(tajo·revés)를 쓸지. 권함: 포르투갈어.
2. **이베리아 '베기 이름 + 준비' 다섯 자리**(머리 위·탈류 준비·아래 탈류·뒤 탈류·아래 레베스): 원문 낱말로 둘지, 쉬운 말로 둘지. 권함: 원문 낱말 (몬탄테 맛이 남는다. 설명 칸이 쉬운 말).

---
- 시계: 시작 2026-10-09 02:29 KST · 끝 02:49 KST (약 20 분). 자료: 고디뉴 PDF 쪽 그림 직접 읽음, 피게이레두·마이어는 Wiktenauer·sprechfenster 전사 원문으로 확인
