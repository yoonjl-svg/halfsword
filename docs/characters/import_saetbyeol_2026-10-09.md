# 샛별 저장소 인물 셋·무대 셋 가져오기 (2026-10-09 지시 · 10/10 작업)

가지 `…/import-saetbyeol-2q36ha` · 본판 1c5c683 위 · 샛별 저장소 `main` 628d960(10/10 00:42 KST) 기준.

사장님 지시(10/9 23:4x): "샛별이 신규 캐릭터와 스테이지 만들었거든. 개발노트 확인해보고 그거 그대로 가져와. 플레이 기질이나 설정까지 가져올 필요는 없고(그건 디렉터가 판단) 외형이랑 소리는 다 가져와. '토메 비달'이 레이피어 전용 캐릭터. '영만'은 '미나미'로 이름 바꿔서 가져오고 모노호시자오 쓰게 해. '오마리'는 샛별 설정에선 해적이라 펄션을 들었지만 우선 이베리아 비기를 볼 수 있게 츠바이핸더를 줘."
10/10 새벽 재지시: "샛별이 캐릭터 작업과 스테이지 작업을 마쳤으니 그거 가져와." → 샛별 저장소를 한 번 더 받아 최신(628d960)으로 맞췄다.

## 1. 어디서 가져왔나

샛별 저장소의 원본 자리(공통 조상 b63665b 이후 네 묶음):

| 샛별 커밋 | 내용 |
|---|---|
| af98fff | 새 인물 셋(외형·복식)과 무대 셋, 무대별 발소리·울림·배경음 |
| 1f45595 | 무대 랜드마크 보강(회랑 바닥 상감·돛·로프·신목), 무대 세부음(`stage_detail_sound.js`), 카드 뒷면 24조각 |
| 1cc3c36 | 영만 머리·하카마 v2, 숲·항구 보강 (이졸데 v3 는 그쪽에서도 v2 로 되돌림) |
| 628d960 | 항구·신목 보강, 영만 긴 양갈래 머리 v3 (그쪽 현재 판) |

우리 `looks.js`·`outfits.js`·`stages.js`·`stage_kit.js` 는 공통 조상과 바이트가 같아서, 그쪽 차이(b63665b → 628d960)를 그대로 얹었다(충돌 0). `sound.js` 도 겹치는 줄이 없어 그대로 얹혔다.

## 2. 가져온 것

### 인물 셋 (외형 + 소리)
| 우리 id · 이름 | 샛별 원본 | 무기 (유파) | 외형 | 목소리 |
|---|---|---|---|---|
| `tome` 토메 비달 | tome · 토메 비달 | **레이피어** (이탈리아) | looks `tome.v1`: 포도주색 겉옷·은발·작은 수염·밝은 목깃 / 복식 `tome_rapier` | 랴오의 녹음 (`voice: 'liao'`) |
| `omari` 오마리 | omari · 오마리 | **츠바이핸더** (이베리아) — 샛별은 펄션 | looks `omari.v1`: 짙은 피부·푸른 코트·상아색 셔츠·붉은 허리띠·삼각모 / 복식 `omari_seafarer` | 브란의 녹음 (`voice: 'bran'`) |
| `minami` **미나미** | yeongman · 영만 | **모노호시자오** (일본) | looks `minami.v1~v3`(지금 v3): 흰 교차 깃·이끼색 하카마·주홍 매듭·긴 양갈래 검은 머리 / 복식 `minami_shrine`·`minami_grove` | 이졸데의 녹음 (`voice: 'isolde'`) |

- 외형 항목(셋 모두): 옷 색 13칸(tunic·quilt·sleeve·belt·hose·shoes·skin·hands·metal·hair·grip·hilt·accent) + 부위별 복식(머리·가슴·배·골반·위팔·아래팔·허벅지·정강이·발 12부위). 복식은 강체 부위에 붙는 장식뿐이고 몸·질량·관절·손·충돌체·상처 면은 그대로(그쪽 기록과 같음). 모자·끈·놋쇠 장식은 방어구가 아니다.
- 소리: 그쪽도 새 녹음 파일이 없다 — **목소리는 기존 녹음을 빌려 쓰는 짝**(위 표)이 전부라 그대로 옮겼다. `main.js voiceOf` 가 `voice` 칸을 먼저 읽게 한 줄 고쳤다(그쪽과 같은 줄). 소리 파일 0개.
- 카드/초상 그림: 그쪽에 인물 카드 그림은 없다. 선택 페이지용 장면 사진(초상)은 게임이 쓰는 곳이 없어 `docs/characters/saetbyeol_ref/`(tome·omari·minami.webp, 그쪽 PNG 를 webp 로)에 참고로만 두었다.

### 무대 셋 (지오메트리·재질·조명·소리 그대로)
| id · 이름 | 파일 | 상대 | 소리 |
|---|---|---|---|
| `loggia` 붉은 회랑 | `src/stage_loggia.js` | 토메 비달 | 돌 발소리·짧은 울림(`STAGE_SOUND.loggia`), 낮은 바람 배경음, 붉은 천 펄럭임 세부음(clothRustle) |
| `corsair` 산호 항구 | `src/stage_corsair.js` | 오마리 | 모래 발소리, 잔잔한 바다 배경음, 돛 밧줄 삐걱(riggingCreak)·부두 물결(waterLap)·갈매기(gullCall) |
| `sacred_grove` 신목의 숲 | `src/stage_sacred_grove.js` | 미나미 | 자갈 발소리, 숲 바람·먼 물소리 배경음, 수관(groveRustle)·종이(paperRustle) 세부음 |

- 소리는 모두 WebAudio 합성(`src/stage_detail_sound.js` + `sound.js` 의 무대 칸·`setPaused`·`stageEvent('stageDetail')`). 외부 녹음·라이선스 표기 대상 없음(그쪽 기록: "외부 녹음/유료 생성 없이 합성").
- 무기 카드 뒷면: `public/ui/cardbacks/px_{loggia,corsair,sacred_grove}_{tile,frame,center,plaque}[_foe].png` 24조각 + 생성기 `tools/cardbacks/gen_pixel_cardbacks.py` 세 함수, `main.js PX_BACKS` 바탕색 세 칸.
- 메뉴·일시정지 동안 새 무대 배경음만 줄이는 `sound.setPaused(...)` 한 줄을 게임 루프 첫머리에 넣었다(그쪽과 같은 줄, 기존 소리 버스는 그대로).
- 소리 실험실(`soundlab.js`) 배경 목록에 세 무대를 더했다.
- 참고 사진: `docs/characters/saetbyeol_ref/` 의 `*_detail.webp`·`*_wide.webp`·`minami_v3_threeq.webp`(그쪽 기록 사진).

### 등장 (기존 인물과 같은 규칙)
- 세 사람은 `CHARACTERS`(기본 회전)에 들어가 무작위 상대(`?foe=random`·짝 없는 무대)에서 기존 다섯과 **같은 확률**(1/n)로 나온다.
- 무대 짝 `STAGE_FOE`: loggia→tome · corsair→omari · sacred_grove→minami.
- 기본 진행 `STAGE_ORDER`: 기존 여섯 뒤에 세 무대를 이었다(확인표 350). 바로 보려면 `?stage=loggia`·`?stage=corsair`·`?stage=sacred_grove`(그 무대 상대가 나온다) 또는 `?foe=tome|omari|minami`.

## 3. 바꾼 것
- 이름 '영만' → **'미나미'**, id `yeongman` → `minami`(외형 열쇠·복식 이름 `minami_*`·얼굴 분기 포함).
- 무기: 오마리 펄션 → **츠바이핸더**. 토메 비달 레이피어·미나미 모노호시자오는 그쪽과 같다.
- 유파: `persona.school` = 무기 id → 레이피어 이탈리아 · 츠바이핸더 이베리아 · 모노호시자오 일본(`schools.js traditionOf`, 브라우저에서 `ai.art.tradition` 로 확인).
- `persona.pers = {}` → 유파 기질(`TRADITIONS[t].temper`)이 쓰인다. 실력 묶음 `ai.level 'normal'`(그쪽 값, 확인표 351).
- `main.js showFoeIntro`: 대사가 없는 인물이면 빈 따옴표(“”) 대신 빈칸(한 줄).
- 표기 방침: 가져온 이름·무대 이름에 한자·가나가 없다(미나미·신목의 숲 등 한글만). 가져온 코드의 더한 줄에도 한자·가나 0.

## 4. 안 가져온 것과 까닭
| 안 가져온 것 | 까닭 |
|---|---|
| 플레이 기질: persona.level 숫자·pers(정확도·간격·자세/기술 취향 등)·idle·close | 사장님 "플레이 기질은 디렉터 판단" |
| 설정 문구: 별명·나이·출신·이야기·바라는 것·유파 설명·대사(intro/win)·taunt | 같은 지시(설정은 디렉터 판단). 별명·대사 칸은 비워 둠 |
| 이졸데 v3 외형(`isolde_tailored`)과 사진 | 우리 이졸데와 관계없고, 그쪽도 사용자 선호로 v2 로 되돌림 |
| 선택 페이지(`new-encounters.html`·`nature-detail.html`)·전달 검사 도구·비교 사진 수십 장 | 그쪽 공개 배포 검증용. 우리 장면 선택은 `STAGE_ORDER`·`?stage=` |
| 그쪽 `characters_expansion.js` 파일 자체 | 세 사람을 우리 `characters.js` 에 기존 인물과 같은 꼴로 바로 적음 |

## 5. 확인
| 관문 | 결과 | 기준 |
|---|---|---|
| `npx vite build` | 성공 | — |
| `node tools/sim/weapon_smoke.mjs` | OK 17/17 | 17/17 |
| `node tools/sim/fights12.mjs` (deprecated 줄 뺀 sha256 앞 8) | **33ad68ae** | 33ad68ae — 그대로(인물·무대는 시뮬 하네스가 읽지 않음) |
| `node tools/sim/live_battery.mjs` | **e7ee3d96** | e7ee3d96 |
| `node tools/sim/finish_thrust.mjs 1 --stand` | **433ac984** | 433ac984 |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 | 12/12 |
| 브라우저 `tools/browser/smoke.mjs` (기본 첫 판) | 콘솔 에러 0 | 0 |
| 브라우저 `tools/browser/import_saetbyeol_shots.mjs` (새 도구, 무대 셋) | 셋 모두 콘솔 에러 0 · 무대/상대/무기/유파 일치 | 0 |

새 도구 결과: loggia → 토메 비달·rapier·italian / corsair → 오마리·zweihander·iberian / sacred_grove → 미나미·monohoshizao·japanese, 카드 뒷면 px 테마. SwiftShader 라 6초 동안 물리 0.6~1.0초만 흘렀다(실기기 성능 아님).

## 6. 캡처
- `docs/handoff/import_saetbyeol_loggia_fight.png` — 붉은 회랑의 토메 비달
- `docs/handoff/import_saetbyeol_corsair_draw.png` — 산호 항구 무기 카드(새 카드 뒷면)
- `docs/handoff/import_saetbyeol_corsair_fight.png` — 산호 항구의 오마리(츠바이핸더)
- `docs/handoff/import_saetbyeol_sacred_grove_fight.png` — 신목의 숲의 미나미

## 7. 남은 것 (디렉터 판단)
- 세 사람의 플레이 기질·설정·대사, 별명.
- 기본 진행에서의 자리(지금 대성당 뒤). 앞으로 당기면 기존 여정이 바뀐다.
- 목소리 짝: 그쪽이 기존 녹음을 빌려 쓴 짝 그대로(토메=랴오, 오마리=브란, 미나미=이졸데). 이졸데와 미나미가 같은 목소리다.
- 그쪽 기록의 한계 그대로: 강체 부위에 붙은 옷이라 크게 꺾이면 겹칠 수 있다(천 시뮬 없음).
