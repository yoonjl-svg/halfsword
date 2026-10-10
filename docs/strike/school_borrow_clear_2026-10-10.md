# 유파 빌린 칸 걷어내기 — 롱소드(독일) 값을 그 유파 원전 값으로 (10/10)

가지 `…/borrow-clear-2q36ha` (origin/main 3af95d9 에서). 사장님 10/10 21:3x "아직 롱소드에서 빌려 쓰는 동작이 많은 거면 그거부터 해결해야 올바른 밸런스 보정이 가능하지 않을까?" →
순서: ① 빌린 칸을 먼저 유파 원전으로(이 일) ② 밸런스 보정은 그 뒤에 모든 유파를 한꺼번에(다음 일). 그래서 **값은 원전으로만 골랐고 승률을 보고 고르지 않았다** — 48 판·막음 비율은 다음 단계 자료로 재서 적기만 한다.

바탕: 점검표 `docs/strike/school_audit_2026-10-10.md`(2판 — 세 갈래 ① 기본 = 공유 + 유파 이름 + 작은 가중치 ② 롱소드 고유 = 빌리지 않음 ③ 기본 동작의 롱소드 값 = 그 유파 원전 값) ·
원전 문서 `docs/motion/rapier_guards_2026-10-10.md` · `iberian_montante_2026-10-10.md` · `japanese_guards_2026-10-10.md` · `chinese_guards_2026-10-10.md` · `docs/motion/schools/*`.

**결론**: 디렉터가 센 빌린 칸 가운데 막기 자리(네 유파) · 덮는 자세(넷) · 속임수 Umschlagen(이탈리아·이베리아) · 이베리아 물러남 · 이탈리아 쉴 자세·가중치를 원전으로 바꿨다. 일본 맞받아 베기는 기본(공통)이라 근거만 적고 그대로. 몬탄테의 지나는 자세·칼날 질량 분포는 원전에 꼴 말이 없거나 다른 작업자 파일이라 남은 빌림 목록에 둔다(끝 §7).

장치: 모두 `src/schools.js` 의 유파 칸만 — 패드 자리(G)는 기술 길의 열쇠라 옮기지 않고 **'어느 자리를 고르나'만** 바꾼다(그 자리의 몸꼴은 이미 유파 자세표 guardTable 이 정함). 공용 함수(sword_art.js·ai.js·frames.js)는 바꾸지 않았다.
독일·무유파 무기는 풀린 꾸러미(resolveSwordArt — 표·이름·쉴 자세·꾸러미·라이브러리 몫)의 JSON 덤프가 전과 바이트 같다(§6).

표기: [원문] 원전 글 · [원문 영역] 원전의 영어 번역(피게이레두 Myers·Hick, 카포 페로 Wiktenauer 영역) · [원전 2차] 연구서 · [해석] 글에서 읽은 꼴을 자리에 옮김 · [추정] 근거 없는 수.
카포 페로 번호: Wiktenauer 영역의 본문 단락 [n] · 권고(Advice) n · 판(그림 설명) 번호 — 판 35~48 칼만, 49~ 단검·망토·방패.

## 1. 막기 자리 (`parry` — AI 가 들어오는 줄마다 손을 두는 패드)

전(네 유파 모두): `GERMAN.parry` — highL [−0.3, 0.1] · highR 황소 · highC 긴 자세 · lowL·lowR 쟁기 둘 · thrust 왼 쟁기(Absetzen). 롱소드 표로 '공격 5 × 자세 13' 을 물리 탐색해 고른 자리(②·③).
줄: highL = 내 왼쪽 위(상대가 오른쪽에서 내리는 사선) · highR = 내 오른쪽 위 · highC = 머리 위에서 곧게 · lowL·lowR = 아래 · thrust = 찌르기. AI 는 막을 때(defend)와 물러나며 가릴 때(coverFor) 이 자리를 쓴다.

### 1-1. 이탈리아 (레이피어 — 카포 페로 1610)

막는 법: 칼끝을 곧게 두고 forte 로 받는다 — [115] 「While I strike, I necessarily parry together, inasmuch as I strike in the straight line」 · 권고 21 「all the parries require an extended arm」 · 권고 15 「parry with the true edge … with the forte」 [원문 영역].

| 줄 | 전 | 후 (자세표 이름) | 원전 근거 |
|---|---|---|---|
| highL | [−0.3, 0.1] (표에 없는 자리 — 무기 틀 값 섞임) | **왼쪽 쟁기 = 4번 자세 Quarta** | 판 48 「parries the enemy's sword in quarta with a beat of the right foot」 · 판 73 「quarta defends against any blow」(방패 판) [원문 영역] · 안쪽 줄 = quarta [해석] |
| highR | 황소 | 황소 = 2번 자세 Seconda (그대로) | 판 41·45 「meeting the enemy's sword on the outside, lowering his point in seconda」 [원문 영역] |
| highC | 긴 자세 | 긴 자세 = 뻗은 3번 자세 (그대로) | [115] 곧은 줄로 치며 막는다 [원문 영역] · 칼만 판에 머리 막기가 없어 원칙에서 [해석] |
| lowL | 왼 쟁기 | 4번 자세 (그대로) | 안쪽 줄 [해석] |
| lowR | 쟁기 | 쟁기 = 3번 자세 Terza (그대로) | 판 69 「parry with your sword in terza to the outside」 · [12] 「the guard of terza for resting in defense」 [원문 영역] |
| thrust | 왼 쟁기 | 4번 자세 (그대로) | 판 48 (quarta 로 받음) · 판 35 「parried the enemy's sword to the outside with the false or the true edge」 [원문 영역] |

이탈리아 자세표가 이미 쟁기·황소·긴 자세·왼 쟁기 자리를 Terza·Seconda·뻗은 Terza·Quarta 로 바꿔 두어서, 다섯 자리는 '롱소드 값'이 아니라 이미 원전 꼴이었다 — 자리는 그대로 두고 근거를 붙였다. 바뀐 자리는 highL 하나.

### 1-2. 이베리아 (몬탄테 — 피게이레두 1651)

막는 법: 베어서 쳐낸다 — 「deflect it with a talho … or else deflect with a revez, according to which side」(단ⅩⅣ) · 「all the deflections, parries and attacks of the montante must be helped by the movements of the body」(복Ⅵ) [원문 영역]. 쳐낸 칼이 멈추는 자리를 막기 자리로 둔다.

| 줄 | 전 | 후 (자세표 이름) | 원전 근거 |
|---|---|---|---|
| highL | [−0.3, 0.1] | **왼쪽 황소 = 왼 높이 비낌** | 탈류로 쳐낸 칼이 「high in front of the head on the left side, in obtuse line」(복ⅩⅤ)에 멈춤 [원문 영역] · 줄 대응 [해석] |
| highR | 황소 | 황소 = 오른 높이 비낌 (그대로) | 레베스로 쳐낸 끝 「high along the right diagonal in an obtuse line」(복ⅩⅤ) [원문 영역] |
| highC | 긴 자세 | 긴 자세 = 곧은 자세 (그대로) | 머리 막기 말은 두 원전 모두 없음 → 베기마다 멈추는 「in front of the face」(단Ⅰ·단Ⅱ) [추정] |
| lowL | 왼 쟁기 | 왼 쟁기 = 왼 비낀 자세 (그대로) | 「deflect it with the montante moving in acute angle along the left diagonal」(복ⅩⅣ — 낮은 공격) [원문 영역] |
| lowR | 쟁기 | **왼 쟁기 = 왼 비낀 자세** | 위와 같음 — 낮은 공격은 왼 대각 하나 [원문 영역] · 자리 [해석] |
| thrust | 왼 쟁기 | **쟁기 = 비낀 자세** | 「the montante in obtuse angle along the right diagonal, such that the right hand rests in front of the belt … to deflect the thrust aimed at the left breast with a talho」(복ⅩⅣ 첫 자세) [원문 영역] |

### 1-3. 일본 (검도형 · 오륜서)

전 작업(japanese_guards §2)은 패드를 독일 그대로 두고 그 자리의 몸꼴만 받는 꼴로 바꿨다. 이제 줄마다 받는 꼴을 찾아 그 꼴의 자리를 고른다.

| 줄 | 전 (그 자리 꼴) | 후 (자세표 이름) | 원전 근거 |
|---|---|---|---|
| highL | [−0.3, 0.1] (우케나가시·히다리와키 사이) | **왼쪽 황소 = 우케나가시** | 검도형 p17 소태도 2본 「左足を左斜め前に、右足をその後ろに」 몸을 왼쪽으로 열며 「右鎬で受け流し」 [원문] · 줄 대응 [해석] |
| highR | 황소 = 히키나가시 | (그대로) | 오륜서 p32-33 三つの受 (1) 「敵の太刀を我が右の肩へ引流して受くべし」 [원문] |
| highC | 긴 자세 = 추단 | (그대로) | 검도형 p11 5본 「左足からひく」と同時に「左鎬で摺り上げ」 [원문] |
| lowL | 왼 쟁기 = 사사에 | **왼쪽 옆 자세 = 히다리와키** | 오륜서 p21·p24 表4 「左の脇に横に構へて、敵の打ちかくる手を下よりはるべし」 [원문] · 줄 대응 [해석] |
| lowR | 쟁기 = 히라세이간 (받는 꼴 아님) | **바보 = 게단** | 오륜서 p23-24 表3 「太刀を下段に持ち、提げたる心にて、敵の打ちかく所を下より手をはる」 · 검도형 3본 相下段 [원문] · 줄 대응 [해석] |
| thrust | 왼 쟁기 = 사사에 | (그대로) | 검도형 p13~14 7본 「諸手を伸ばし…物打の鎬で打太刀の刀を支える」 [원문] |

(우치오토시 — 오륜서 中段 「切先返しにて打ち、打ち落したる太刀其儘置き」 — 는 받는 자리가 아니라 맞받아 치는 꼴이라 막기 자리에 넣지 않았다.)

### 1-4. 중국 (조선세법 — 무비지 권86 국역 쪽/원서 쪽 · 무예도보통지 권2 p)

24 세 가운데 막는 꼴은 格(擧鼎·撩掠·御車·銀蟒)과 洗(鳳頭) — 무비지 쪽153 초습 「格法有三 … 洗法有三」 [원문].

| 줄 | 전 | 후 (자세표 이름) | 원전 근거 |
|---|---|---|---|
| highL | [−0.3, 0.1] | **왼쪽 황소 = 봉두세** | 鳳頭勢 「卽鳳頭洗, 法能洗刺剪殺」 쪽176/0590 · 무도 p046/38 그림 '칼을 머리 높이 비껴' [원문] — 洗 = 씻어 쳐냄 · 왼쪽 줄 [해석] |
| highR | 황소(= 역린세, 찌르는 꼴) | **지붕 = 표두세** | 擧鼎勢 「卽擧鼎格, 法能鼎格上殺」 쪽154/0568 · 무도 p035/27 그림 '칼을 머리 위로 들어 막음' [원문] · 가로 든 칼이 표에 없어 가장 가까운 '머리 위로 든 칼' [해석] |
| highC | 긴 자세(= 직부송서) | **지붕 = 표두세** | 위와 같음 |
| lowL | 왼 쟁기(= 좌협세, 찌르는 꼴) | **바꿈 = 요략세** | 撩掠勢 「卽撩掠格, 法能遮駕下殺 蔽左護右」 무도 p038/30 그림 '칼을 낮게 앞으로, 칼 수평' [원문] |
| lowR | 쟁기(= 탄복세, 찌르는 꼴) | **바꿈 = 요략세** | 위와 같음 (왼쪽을 가리고 오른쪽을 지킴) |
| thrust | 왼 쟁기 | **긴 자세 = 직부송서** | 御車勢 「卽御車格, 法能駕御中殺」 쪽161/0575 · 무도 p038 그림 '두 손 앞쪽으로' [원문] · 御車 자세가 표에 없어 가장 가까운 '두 손 앞으로 뻗은' 자리 [해석] |

옛 기록(확인표 704): 擧鼎格 을 왕관 자리(G.kron)로 넣었을 때 칼이 가로로 눕지 않아(표두세에 끌림) 넣지 않았다. 이번엔 새 자리를 만들지 않고 표의 표두세 자리를 그대로 고른다 — 원전 꼴(가로 든 칼)과 다르다는 점은 [해석]으로 적고 사장님께 여쭌다(§8).

### 1-5. 물리 막음 비율 (보고용 — `tools/sim/school_parry.mjs <무기>`)

방법은 롱소드 막기 자리를 고른 도구(motion_lab parry)와 같다: 치는 쪽 롱소드가 기술 길을 11 m/s 로(highL zornhau · highR zornhauL · highC oberhau · lowL unterhau · lowR unterhauL · thrust stichPflug), 막는 쪽 유파 무기가 한 자리를 들고 버틴다. 다른 점은 본판 길(MOTION.lib 켬 — 생성자가 유파 자세표를 입힘)로 잰다는 것. 간격 1.3 · 1.45 · 1.6 · 1.75 m × 씨앗 7 = 자리마다 4 판, 막음 = 그 판에 상처 0. 판이 적어 거칠다(롱소드 표를 고를 때는 2 판).

(측정 표 — §1-5 표는 아래 채움)

## 2. 덮는 자세 (`pose.cover` — 완전히 쓰러졌을 때 칼을 머리 위로 들어 가림)

전(넷 다): 왕관 G.kron [0.02, 0.4] — 롱소드 Krone(②).

| 유파 | 후 | 근거 |
|---|---|---|
| 이탈리아 | 지붕 자리 = 1번 자세 Prima [0.02, 0.52] | 카포 페로 판 64 「parry the said blow in prima with the sword in guardia di testa」(망토 판 — 칼만 판엔 머리 막기 없음) [원문 영역] · 자리 [해석] |
| 이베리아 | 긴 자세 자리 = 곧은 자세 [0.0, 0.03] | 두 원전 모두 머리 가리기 말이 없다(머리 위로 넘김은 공격 꼴 — 복Ⅱ·복ⅩⅥ). 손을 눈 앞 높이로 드는 「the point forward and the hands high in front of the eyes」(단Ⅱ) [원문 영역]를 덮는 꼴로 [추정] |
| 일본 | 지붕 자리 = 조단 | 검도형 p16 소태도 1본 仕太刀 「右手頭上·刃先後ろ, 左鎬で受け流し」(머리 위에서 받음) [원문] · 자리 [해석] |
| 중국 | 지붕 자리 = 표두세 | 擧鼎格(칼을 머리 위로 들어 막음)과 같은 까닭 [원문 · 자리 해석] |

`pose.point`(긴 자세 — 칼끝으로 겨누기)는 다섯 원전 모두의 가운데 겨눔(中段·直符送書·postura recta·뻗은 Terza)이라 기본(공통)으로 두었다.

## 3. 속임수 (이탈리아 · 이베리아)

전: 몸 틀 속임수(`styleFeints` = 독일 FEINTS 넷) — 그 가운데 '오른쪽→왼쪽'·'왼쪽→오른쪽'은 칼을 머리 위로 넘기는 Umschlagen(롱소드 고유, ②).
후: 일본·중국과 같은 `ownFeints: true` 꼴로 유파 목록을 쓴다. **Umschlagen 둘을 빼고 새 속임은 지어 넣지 않았다.**

| 유파 | 후 목록 | 근거 |
|---|---|---|
| 이탈리아 | 위→다리 · 찌르기→베기 (+ 고유 동작 cavazione) | 권고 22 「these feints strike directly at the opposite of that at which they gesture」 [원문 영역] = 기본 속임 · 칼만 판의 속임(판 45·46 「disengaged the sword by way of a feint」)은 칼끝 돌려 빼기 = 이미 고유 cavazione |
| 이베리아 | 위→다리 · 찌르기→베기 | 피게이레두 32 규칙·고디뉴 몬탄테 장에 속임이 없다 [원문 영역] — 기본 둘만 남김 |

## 4. 그 밖의 칸

| 칸 | 전 → 후 | 근거 |
|---|---|---|
| 이베리아 물러남 `withdraw` | 몰릴 때 황소 · 그 밖 쟁기·긴 자세 (독일 값) → **몰릴 때 곧은 자세 · 그 밖 곧은 자세·칼끝 땅에** | 규칙을 풀며 물러남 「removing backward the left foot with a talho equal to the first」(단Ⅰ — 베기 끝 = 얼굴 앞) · 「retreating backward until you place your body as it began the rule」(복Ⅰ — 규칙의 시작 = 칼끝 땅에, 단Ⅰ) [원문 영역]. (이베리아 황소 자리 꼴은 이미 orelha direyta 라 '황소'는 이름만이었지만, 몰릴 때 그 자리로 가는 판단은 독일 것) |
| 이탈리아 쉴 자세 `rest` | null(= SKILL.homeGuard 쟁기 패드) → **'pflugR' = 3번 자세 Terza** | [6] 「one single guard, which is the low guard called terza」 · [12] 「the guard of terza for resting in defense」 [원문 영역]. **같은 패드라 판·손맛은 바뀌지 않는다**(쉴 자리 근거만 유파 것으로 — 확인표 641 의 답) |
| 일본 맞받아 베기 `counter` | 독일 목록 그대로 (근거만) | 고르는 길이 袈裟·逆袈裟·真向 — 다섯 원전 모두의 기본 베기(점검표 A-2). 오륜서 p32 「敵の太刀を受くる、はる、あたる…皆々敵を切る縁也」 · p35 張り受 「打太刀をはりて、はるより早く敵を打つ」 [원문] — 받는 칼이 곧 베는 칼. ① 기본(공통)이라 유파 몫(counterArt)을 따로 두지 않음 |
| 이탈리아 가중치 `techK` | 없음 → **'one:thrust' stoccata(stichPflug) ×1.2** | 권고 31 「The stoccata needs to be sent from the guard of terza」 · [6] 테르차가 단 하나의 자세 [원문 영역] · 수 [추정]. 찌르기 ×1.8·베기 ×0.7 은 무기 틀 몫 그대로 |
| 몬탄테 남은 칸 | 바꾸지 않음 | §7 남은 빌림 목록 |

## 5. 48 판 (대 롱소드, `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기> 24 main`) — 다음 밸런스 단계 자료

(측정 표 — 아래 채움)

## 6. 관문

(아래 채움)

## 7. 아직 빌려 쓰는 칸 (이 일 뒤)

(아래 채움)

## 8. 사장님께 여쭐 것

(아래 채움)
