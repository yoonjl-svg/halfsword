# 표기 방침 — 일본 유파는 일본 발음 독음, 중국 유파는 한국 한자음 (漢字) (2026-10-10)

- 지시: 사장님 10/10 — "打刀를 일본어 발음을 한국어로 독음해서 쓰는 방식으로 이름 바꿔. 앞으로 중국 유파는 한자를 한국식으로 쓴 뒤 한자 괄호 안에 병기하고, 일본 유파는 일본식 발음을 독음해서 쓰며 한자 병기는 하지 마. 이 방침에 어긋나는 텍스트 표기가 있다면 찾아서 고치도록 해. 고치고 나면 게임 전체의 텍스트 일괄 스프레드 시트에 모아서 링크 보내줘. 교열하려고." (03:5x "이어서 해")
- 작업: 2 등급, 가지 `…/text-policy2-2q36ha` (기준 95966dd). 앞 작업자가 1c5c683 위에서 하다 멈춘 고침(schools.js·weapons.js·frames.js)과 도구(`tools/text/`)를 3-way 로 얹고, 그 사이 들어온 글(비기 v4·발도·이베리아 휩쓸기·플레이어 비기·샛별 인물 셋·무대 셋)을 검사기로 다시 훑음.
- 결과: 화면 글 **59 곳** 고침 (일본 41 · 중국 13 · 몸 틀 앞무게 표 5 — 이베리아·일본·무유파가 같이 쓰는 표). 행동 불변(관문 아래). 교열용 구글 시트는 사장님 드라이브에 만들어 링크를 보고로 보냄(저장소엔 적지 않음).

## 1. 규칙

| 갈래 | 규칙 | 예 |
|---|---|---|
| 일본 유파 | 일본어 발음을 한글로만. 한자·가나 없음. 관용 표기: つ → 츠, 첫소리 か·た → 카·타, 장음 표시 없음, 촉음은 받침 ㅅ | 打刀 → 우치가타나 · 츠바메가에시 · 코테 · 잔신 · 데바나 · 카에시 · 고노센 · 히라키기리 · 케사 · 도 · 츠키 · 조단 · 추단 · 게단 · 핫소 · 와키가마에 · 맛코 |
| 일본 — 읽기 불확실 | 무예도보통지 왜검 낱말처럼 일본 쪽 읽기 기록이 없는 것은 음독(오음)으로 정하고 시트에 **[추정]** | 跨虎 → 코코 · 右下藏 → 우게조 · 左藏 → 사조 · 左右垂劍打 → 사유스이켄다 |
| 일본 — 국립국어원 | 게임엔 넣지 않고 시트 '국립국어원 표기' 칸에 대안으로 (어두 거센소리 없음, つ = 쓰) | 쓰바메가에시 · 고테 · 가에시 · 주단 · 쓰키 · 게사기리 · 기리아게 |
| 중국 유파 | '한글 독음 (漢字)' 꼴. 한국 한자음 · 두음법칙 | 요격 (腰擊) · 좌익격 (左翼擊) · 염시 (斂翅) · 역린자 (逆鱗刺) · 체보요격 (掣步腰擊) · 연환삼격 (連環三擊) · 직부송서 (直符送書) · 탄복자 (坦腹刺) |
| 독일·이탈리아·이베리아·무유파 | 방침 밖 — 그대로 | 분노의 베기 (Zornhau) · mandritto · talho |
| 한글만 있는 중국 무기·능력 이름 | 그대로 두고 시트에 후보로 | 청강검 (靑鋼劍?) · 창천 (蒼天?) |
| 인물 이름 | 유파 용어가 아니라 그대로 두고 시트에 후보로 | 랴오 쓰위엔 (중국 발음 표기 — 한자 이름 미정) |

- 바꾸지 않는 것: 코드 식별자·객체 열쇠(자세 바탕 열쇠 `'지붕 (Vom Tag)'` 등, 기술 이름 `tsubameGaeshi` 등), `src:` 출처 칸, 주석, `docs/` 기록 (옛 표기는 기록이라 그대로).
- 일본 자세 설명 속 오륜서 낱말 `表5`·`表4` 는 '오모테 5'·'오모테 4' 로.

## 2. 열쇠를 지킨 방법 (행동 불변)

- **속임수 이름 `feint.name`** (중국 `lianchi` '염시 (斂翅) · 찌르는 척 → 거둬 요격'): 열쇠로 쓰이는 곳 — `src/ai.js` `uniqueByName`(고유 동작 맵, 속임수는 `feint.name` 이 열쇠) · `strikeCue` 의 `uniqueByName.get(this.feint.name)` · `src/sword_art.js` 속임수 중복 막기(`f.name === u.feint.name`) · `src/ai.js` 패시브 `do.feint`(`f.name === D.feint` — 지금 `do.feint` 를 문자열로 쓰는 패시브는 없음, grep 0) · `tools/sim/motion_lab.mjs` 의 `feintUsed[XA.feint.name]` 집계. 모두 **같은 객체의 같은 칸을 읽어** 맵에 넣고 꺼내므로 글자만 바꾸면 함께 바뀐다(따로 적힌 옛 문자열이 없음을 grep 으로 확인 — `src`·`tools` 에 옛 이름은 주석뿐). 브라우저 스모크에서 `uniqueByName.get(feint.name) === U` 참 확인.
- **패시브 `do.feint`·자세 이름표 열쇠**: 패시브는 기술 열쇠(`tsubameGaeshi`·`yaoji` 등 코드 이름)로 가리키고, 유파 자세 이름표는 바탕 자세 열쇠(`'지붕 (Vom Tag)'` 등 바탕 표의 이름)로 찾는다 — 바뀐 것은 이름표의 `.name`·`.desc` 값뿐이라 열쇠는 그대로. 바탕 표(`guards.js` GUARDS)는 독일 말이라 방침 밖, 손대지 않음.
- **비기 안의 수 이름** (`CHINESE_SECRET.do.seq[].nameKo`): 화면엔 비기 이름만 뜨고(`strikeCue` 는 비기 동안 돌아감) 열쇠로 쓰이지 않음 — 표기만 맞춤.
- 그래서 관문 해시가 모두 그대로다(아래 §4).

## 3. 도구

- `tools/text/texts.mjs` — 화면 글 모으기(모듈 import: 유파·자세표·무기·사격 자세·인물·비기 수 이름 / 리터럴: `main.js`·`perfmeter.js`·`index.html`). 바탕 자세표가 여러 표에 되풀이되는 글은 한 줄로 모으고 위치에 표 이름을 덧붙임.
- `tools/text/name_policy.mjs` — 표기 방침 검사기. 일본 글에 한자·가나 → 위반, 중국 글은 '한글 독음 (漢字)' 꼴(괄호 앞 한글 음절 수 = 한자 수), 그 밖은 가나 금지·한자는 '한글 (漢字)' 꼴. **인물(characters.js)도 이제 본다**(앞서는 이식 중이라 보고만). 한계: 한글만 쓴 한자말(예: 옛 '과좌·과우 번갈아')·국립국어원식 표기(쓰·고 따위)는 기계로 못 잡음 → 이번에 눈으로 훑어 고침.
- `tools/text/extract_texts.mjs` — 시트용 CSV + JSON(전체 줄 · 바꾼 것 줄). 원어·국립국어원 표기·옛 표기·[추정] 비고 표(GLOSS)를 품음.
- `tools/browser/text_policy_shot.mjs` — 브라우저 스모크(콘솔 에러 0 · 속임수 열쇠 찾기 · 자세 이름 HUD·기술 알림 사진 `docs/handoff/text_policy_hud.png`).

## 4. 확인 (최종 작업 트리)

| 관문 | 기대 | 결과 |
|---|---|---|
| `node tools/text/name_policy.mjs` | 위반 0 (인물 포함) | 위반 0 · 화면 글 607 줄 |
| `node tools/sim/fights12.mjs` (stdout − deprecated 줄, sha256 앞 8) | 5480fbd3 | **5480fbd3** |
| `node tools/sim/live_battery.mjs` | e7ee3d96 | **e7ee3d96** |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 433ac984 | **433ac984** |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | **12/12** (종료 0) |
| `node tools/sim/weapon_smoke.mjs` | OK 17/17 | **17/17** |
| `npx vite build` | 통과 | 통과 |
| 브라우저 스모크 (우치가타나 대 청강검) | 콘솔 에러 0 | 0 · HUD '추단' · 알림 '염시 (斂翅) · 찌르는 척 → 거둬 요격 / 중국 · 고유 동작' |

## 5. 바꾼 것 — 옛 표기 → 새 표기 (59)

| # | 유파 | 위치 | 옛 표기 | 새 표기 |
|---|---|---|---|---|
| 1 | 일본 | `weapons uchigatana.nameKo` | 打刀 (우치가타나) | 우치가타나 |
| 2 | 일본 | `schools japanese.names['지붕 (Vom Tag)'].name` | 상단 (上段) | 조단 |
| 3 | 일본 | `schools japanese.names['어깨 지붕 (Vom Tag)'].name` | 팔상 (八相) | 핫소 |
| 4 | 일본 | `schools japanese.names['어깨 지붕 (Vom Tag)'].desc` | 上段에서 오른 주먹을 오른 어깨까지 내린 꼴 · 날은 상대 쪽, 왼발 앞 | 조단에서 오른 주먹을 오른 어깨까지 내린 꼴 · 날은 상대 쪽, 왼발 앞 |
| 5 | 일본 | `schools japanese.names['긴 자세 (Langort)'].name` | 중단 (中段) | 추단 |
| 6 | 일본 | `schools japanese.names['옆 자세'].name` | 우협 (右脇) | 미기와키 |
| 7 | 일본 | `schools japanese.names['옆 자세'].desc` | 칼을 오른쪽에 가로로 눕힌다 · 받아서 上段으로 올려 곧장 내려벤다(表5) | 칼을 오른쪽에 가로로 눕힌다 · 받아서 조단으로 올려 곧장 내려벤다(오모테 5) |
| 8 | 일본 | `schools japanese.names['쟁기 (Pflug)'].name` | 청안 (晴眼) | 세이간 |
| 9 | 일본 | `schools japanese.names['쟁기 (Pflug)'].desc` | 칼자루를 오른 허리에, 칼끝은 상대 얼굴 · 손이 낮은 中段 · 쉴 자세 안 B | 칼자루를 오른 허리에, 칼끝은 상대 얼굴 · 손이 낮은 추단 · 쉴 자세 안 B |
| 10 | 일본 | `schools japanese.names['바꿈 (Wechsel)'].name` | 우하장 (右下藏) | 우게조 |
| 11 | 일본 | `schools japanese.names['바꿈 (Wechsel)'].desc` | 칼끝을 오른쪽 아래로 감춘다 · 여기서 올려벤다(切り上げ) | 칼끝을 오른쪽 아래로 감춘다 · 여기서 올려벤다(키리아게) |
| 12 | 일본 | `schools japanese.names['옆 지킴 (Nebenhut)'].name` | 협구 (脇構え) | 와키가마에 |
| 13 | 일본 | `schools japanese.names['바보 (Alber)'].name` | 하단 (下段) | 게단 |
| 14 | 일본 | `schools japanese.names['왼쪽 어깨 지붕'].name` | 왼 어깨 (八相 거울) | 왼 어깨 (핫소 거울) |
| 15 | 일본 | `schools japanese.names['왼쪽 옆 자세'].name` | 좌협 (左脇) | 히다리와키 |
| 16 | 일본 | `schools japanese.names['왼쪽 옆 자세'].desc` | 칼을 왼쪽에 가로로 · 아래에서 상대 손을 치고 어깨 위로 비스듬히 벤다(表4) | 칼을 왼쪽에 가로로 · 아래에서 상대 손을 치고 어깨 위로 비스듬히 벤다(오모테 4) |
| 17 | 일본 | `schools japanese.names['왼쪽 바꿈'].name` | 좌장 (左藏) | 사조 |
| 18 | 일본 | `schools japanese.names['왼쪽 바꿈'].desc` | 칼끝을 왼쪽 아래로 · 袈裟가 끝나는 자리, 여기서 逆袈裟로 되올린다 | 칼끝을 왼쪽 아래로 · 케사가 끝나는 자리, 여기서 갸쿠케사로 되올린다 |
| 19 | 일본 | `schools japanese.techNames.zornhau` | 袈裟 (けさ) 斬り | 케사기리 |
| 20 | 일본 | `schools japanese.techNames.zornhauL` | 左袈裟 | 히다리케사 |
| 21 | 일본 | `schools japanese.techNames.oberhau` | 真向 (정수리 베기) · 正面打ち | 맛코 (정수리 베기) · 쇼멘우치 |
| 22 | 일본 | `schools japanese.techNames.zwerch` | 胴 (どう) | 도 |
| 23 | 일본 | `schools japanese.techNames.zwerchL` | 逆胴 | 갸쿠도 |
| 24 | 일본 | `schools japanese.techNames.unterhau` | 切り上げ | 키리아게 |
| 25 | 일본 | `schools japanese.techNames.unterhauL` | 逆袈裟 | 갸쿠케사 |
| 26 | 일본 | `schools japanese.techNames.stichPflug` | 突き (청안에서) | 츠키 (세이간에서) |
| 27 | 일본 | `schools japanese.techNames.stichPflugL` | 突き (왼 허리에서) | 츠키 (왼 허리에서) |
| 28 | 일본 | `schools japanese.techNames.stichOchs` | 突き (머리 옆에서) | 츠키 (머리 옆에서) |
| 29 | 일본 | `schools japanese.techNames.stichOchsL` | 突き (왼 머리 옆에서) | 츠키 (왼 머리 옆에서) |
| 30 | 일본 | `schools japanese.techNames.stichAlber` | 突き (하단에서) | 츠키 (게단에서) |
| 31 | 일본 | `schools japanese.techNames.talhoReves` | 左右垂劍打 | 사유스이켄다 |
| 32 | 일본 | `schools japanese.techNames.wristCut` | 片手小手 | 카타테코테 |
| 33 | 일본 | `schools japanese.unique[tsubameGaeshi].nameKo` | 燕返し (츠바메가에시) | 츠바메가에시 |
| 34 | 일본 | `schools japanese.unique[kote].nameKo` | 小手 (코테) | 코테 |
| 35 | 일본 | `schools japanese.unique[kokoRenda].nameKo` | 跨虎 연타 | 코코 연타 |
| 36 | 일본 | `schools japanese.unique[hirakiGiri].nameKo` | 開き斬り (히라키기리) | 히라키기리 |
| 37 | 일본 | `schools japanese.spare[omote5].nameKo` | 表5 (오모테 5) | 오모테 5 |
| 38 | 일본 | `schools japanese.passives[zanshin].nameKo` | 残心 | 잔신 |
| 39 | 일본 | `schools japanese.passives[debana].nameKo` | 出端 (데바나) | 데바나 |
| 40 | 일본 | `schools japanese.passives[kaeshi].nameKo` | 返し (카에시) | 카에시 |
| 41 | 일본 | `schools japanese.secret.nameKo` | 後の先 (고노센 · 가칭) | 고노센 · 가칭 |
| 42 | 중국 | `schools chinese.names['왼쪽 어깨 지붕'].desc` | 치켜 올렸다 눌러 상대 손아귀(虎口)를 바로 친다 | 치켜 올렸다 눌러 상대 손아귀인 호구 (虎口)를 바로 친다 |
| 43 | 중국 | `schools chinese.names['왼쪽 옆 자세'].name` | 요격세 · 왼 (腰擊) | 왼 요격세 (腰擊勢) |
| 44 | 중국 | `schools chinese.names['왼쪽 옆 자세'].desc` | 왼쪽에서 허리를 가로질러 친다 — 오른쪽 腰擊과 번갈아 | 왼쪽에서 허리를 가로질러 친다 — 오른쪽 요격 (腰擊)과 번갈아 |
| 45 | 중국 | `schools chinese.techNames.talhoReves` | 과좌·과우 번갈아 | 과좌·과우 (跨左·跨右) 번갈아 |
| 46 | 중국 | `schools chinese.unique[yaoji].nameKo` | 腰擊 (요격) | 요격 (腰擊) |
| 47 | 중국 | `schools chinese.unique[zuoyi].nameKo` | 左翼擊 (좌익격) | 좌익격 (左翼擊) |
| 48 | 중국 | `schools chinese.unique[lianchi].feint.name` | 斂翅 (찌르는 척 → 거둬 腰擊) | 염시 (斂翅) · 찌르는 척 → 거둬 요격 |
| 49 | 중국 | `schools chinese.unique[chebuYaoji].nameKo` | 掣步 腰擊 (끌어 딛는 요격) | 체보요격 (掣步腰擊) |
| 50 | 중국 | `schools chinese.passives[ciji].nameKo` | 刺→擊 고리 | 자→격 (刺→擊) 고리 |
| 51 | 중국 | `schools chinese.secret.nameKo` | 連環三擊 (연환삼격 · 가칭) | 연환삼격 (連環三擊) · 가칭 |
| 52 | 중국 | `schools chinese.secret.do.seq[lianhuanYao].nameKo` | 腰擊 (요격) | 요격 (腰擊) |
| 53 | 중국 | `schools chinese.secret.do.seq[lianhuanLiao].nameKo` | 撩掠 (요략 — 걷어 올려 베기) | 요략 (撩掠) · 걷어 올려 베기 |
| 54 | 중국 | `schools chinese.secret.do.seq[lianhuanTanfu].nameKo` | 坦腹刺 (탄복자) | 탄복자 (坦腹刺) |
| 55 | 이베리아·일본·무유파 | `frames FRAME_GUARDS.heavy['지붕 (Vom Tag)'].name` | 상단 (上段) | 조단 |
| 56 | 이베리아·일본·무유파 | `frames FRAME_GUARDS.heavy['어깨 지붕 (Vom Tag)'].name` | 팔상 (八相) · 어깨 메기 | 핫소 · 어깨 메기 |
| 57 | 이베리아·일본·무유파 | `frames FRAME_GUARDS.heavy['왼쪽 어깨 지붕'].name` | 왼 팔상 · 레베스 준비 | 왼 핫소 · 레베스 준비 |
| 58 | 이베리아·일본·무유파 | `frames FRAME_GUARDS.heavy['긴 자세 (Langort)'].name` | 중단 (中段) | 추단 |
| 59 | 이베리아·일본·무유파 | `frames FRAME_GUARDS.heavy['옆 지킴 (Nebenhut)'].name` | 협 (脇構え) | 와키가마에 |

- 위 59 곳 밖의 화면 글(독일·이탈리아·이베리아·무유파·공용 메뉴·알림·설정·인물 대사)은 방침 밖이거나 이미 맞아 그대로. 새로 들어온 글('고노센 준비'·'경직'·'비기 뒤'·비기 설정 줄·샛별 인물 이름 토메 비달·오마리·미나미)은 검사기·눈으로 보아 맞음.
- 같이 쓰는 몸 틀 앞무게 표(frames.js heavy — 이베리아·일본·무유파)는 일본 오다치 자세를 옮긴 표라 일본 독음으로 맞춤. 이베리아·일본은 유파 이름표가 늘 덮어 화면엔 거의 안 나옴.
- 시트 후보(바꾸지 않음): 청강검·창천(한글만 — 한자 병기 여부), 제비 베기(모노호시자오 능력 — 번역어, 츠바메가에시로 할지), 랴오 쓰위엔(인물 이름 — 중국 발음 표기).
