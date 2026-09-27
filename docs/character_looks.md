# 캐릭터 겉모습 (모델링 PM 라운드)

오너 요청: "캐릭터 모델링을 개선하고 싶다." 5인의 상대 캐릭터에 갑옷판·머리모양·수염·안대 같은
장식 레이어(`src/outfits.js`)를 새로 얹고, 예전 겉모습은 지우지 않고 `src/looks.js`의
`LOOK_ARCHIVE`에 `v0`로 남겨 두었다. 지금 게임이 쓰는 버전은 `CHARACTER_LOOK_VERSION`(현재 전부
`v1`)이 가리킨다.

플레이어(케틀햇+갬비슨)의 겉모습은 요청대로 건드리지 않았다.

## 미리보기

- `?look=<id>:<version>` — 그 캐릭터를 상대로 고정하고 그 버전을 입힌다. 예: `?look=margarethe:v0`
- `?lookv=<version>` — 이번에 고른 상대가 누구든 그 버전을 입힌다(`?foe=`와 함께 써도 된다)
- 버전 이름은 `v0`, `v1`처럼 `v` 접두사를 쓰거나 숫자만(`0`, `1`) 써도 된다

## 마르그레테 슈바르츠 (`margarethe`) — 용기사

**v0(예전)**: 회색 수수한 노장 — 회색 누비옷, 은발.
**v1(지금, `outfit: 'margarethe_dragon'`)**: 먹색(ink-black) 판금 가슴갑옷 + 각진 견갑(뾰족한
쐐기꼴, 용기사 실루엣), 갈색 머리. 골반의 기존 천 치마 위에 세로 판 10장을 두른 갑주 치마를
얹어 "아래는 치마"인 느낌을 살렸다. 와인레드 트림 라인으로 포인트만 주고, 문장·로고·특정
배우를 떠올릴 장식은 넣지 않았다(실루엣·분위기만 참고).

| v0 | v1 |
| --- | --- |
| ![margarethe v0](character_looks/margarethe_v0.jpg) | ![margarethe v1](character_looks/margarethe_v1.jpg) |

추가 컷: [3/4](character_looks/margarethe_threeq.jpg) · [옆](character_looks/margarethe_side.jpg) ·
[기본 대결 화면](character_looks/margarethe_default.jpg) · [쓰러짐](character_looks/margarethe_down.jpg)

## 하인리히 도른 (`heinrich`) — 은빛 중갑 기사

**v0(예전)**: 붉은 금장 흥행 검객 — 빨간 더블릿, 금발.
**v1(지금, `outfit: 'heinrich_knight'`)**: 은빛(bright silver) 판금 가슴갑옷·배갑옷·허벅지
자락(tasset)·정강이받이(그리브)·손목 보호대(가운틀릿 커프)·둥근 견갑, 은발 + 짧은 은수염.
투구는 얹지 않았다(오너 요청에 투구 언급 없음, `hasHelmet` 관련 절 참고).

| v0 | v1 |
| --- | --- |
| ![heinrich v0](character_looks/heinrich_v0.jpg) | ![heinrich v1](character_looks/heinrich_v1.jpg) |

추가 컷: [3/4](character_looks/heinrich_threeq.jpg) · [옆](character_looks/heinrich_side.jpg) ·
[기본 대결 화면](character_looks/heinrich_default.jpg) · [쓰러짐](character_looks/heinrich_down.jpg)

## 랴오 쓰위엔 (`liao`) — 방랑 낭인

**v0(예전)**: 짙은 초록 방랑 검객 — 검은 머리, 붉은 머리띠.
**v1(지금, `outfit: 'liao_ronin'`)**: 장발(뒤로 묶어 등까지 늘어뜨림) + 한쪽 눈 안대(작은 판 +
짧은 끈). 사무라이 쇼다운의 방랑 검객(무사시·하오마루 계열) 분위기만 참고했고, 특정 캐릭터의
디자인을 그대로 베끼지 않았다.

| v0 | v1 |
| --- | --- |
| ![liao v0](character_looks/liao_v0.jpg) | ![liao v1](character_looks/liao_v1.jpg) |

추가 컷: [3/4](character_looks/liao_threeq.jpg) · [옆](character_looks/liao_side.jpg) ·
[기본 대결 화면](character_looks/liao_default.jpg) · [쓰러짐](character_looks/liao_down.jpg)

## 이졸데 반 아커러 (`isolde`) — 평상복

**v0(예전)**: 보랏빛 견습생 복장 — 보라 상의, 보라 머리띠.
**v1(지금, `outfit: 'isolde_saber'`)**: 평범한 사복 — 크림색 블라우스, 어두운 남색 긴 치마,
검은 머리. Fate 세이버의 사복 분위기만 참고했다. 치마는 넓적다리(thighF·thighB) 각각에 따로
붙여서, 래그돌이 다리를 벌려도 다리가 서로 다른 부위임이 읽히게 했다("다리가 읽혀야 한다"는
지시 반영).

| v0 | v1 |
| --- | --- |
| ![isolde v0](character_looks/isolde_v0.jpg) | ![isolde v1](character_looks/isolde_v1.jpg) |

추가 컷: [3/4](character_looks/isolde_threeq.jpg) · [옆](character_looks/isolde_side.jpg) ·
[기본 대결 화면](character_looks/isolde_default.jpg) · [쓰러짐](character_looks/isolde_down.jpg)

## 오소리 브란 (`bran`) — 화전민 농부

**v0(예전)**: 어두운 잡색 — 짙은 갈색 상의, 검은 머리.
**v1(지금, `outfit: 'bran_farmer'`)**: 베이지~갈색 홈스펀 옷, 금발. 앞치마(가슴받이+허리
자락), 끈으로 묶은 로프 벨트(허리끈 색을 로프색으로), 소매를 걷어붙인 자국(팔뚝에 두른 어두운
띠)을 더했다.

| v0 | v1 |
| --- | --- |
| ![bran v0](character_looks/bran_v0.jpg) | ![bran v1](character_looks/bran_v1.jpg) |

추가 컷: [3/4](character_looks/bran_threeq.jpg) · [옆](character_looks/bran_side.jpg) ·
[기본 대결 화면](character_looks/bran_default.jpg) · [쓰러짐](character_looks/bran_down.jpg)

## 그리기 비용 (적 캐릭터 하나 기준, 무기·아레나·데칼 제외하고 격리 측정)

기본 대결 화면 전체(`game.renderInfo()`)는 핏자국·발자국 데칼·상대가 든 무기(브란은 10% 확률로
다른 무기)가 매 판 달라져서 그대로 비교하면 잡음이 크다. 그래서 `game.enemy`의 몸·무기 메쉬만
따로 순회해 삼각형·메쉬 수를 쟀다(장식 레이어만의 순수 증가분).

| 캐릭터 | 장식 전(v0) 메쉬 | 장식 전 삼각형 | 장식 후(v1) 메쉬 | 장식 후 삼각형 | 늘어난 메쉬 | 늘어난 삼각형 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bran | 50–58* | 6163–7140* | 59 | 7196 | +1 | +56 |
| isolde | 52 | 6782 | 51 | 6782 | −1 | 0 |
| liao | 53 | 6274 | 55 | 6486–6502 | +2 | +212–228 |
| heinrich | 58 | 6830 | 67 | 7326 | +9 | +496 |
| margarethe | 51 | 6746 | 58 | 6982 | +7 | +236 |

\* 브란은 `weaponAlt`로 10% 확률로 다른 무기를 드는데, 그 무기 자체의 메쉬 수가 측정마다 살짝
달라진다(장식과 무관). 이졸데는 v0의 보라 머리띠·가죽 끈(4장) 값이 v1의 옷깃·허리 리본·치마
2장보다 메쉬가 조금 더 많아서, 장식이 늘었는데도 총 메쉬 수는 오히려 1개 줄었다 — 옷을 더
단순하게 바꾼 결과다.

모든 캐릭터에서 늘어난 삼각형은 수백 개 수준(장식 없는 기본 몸 6천~7천 개의 몇 %)이고,
드로우콜은 부위 하나에 재질 1~2개짜리 병합 메쉬(`mergeGeometries`)로만 늘었다. 텍스처는 전혀
쓰지 않았다(단색 `MeshStandardMaterial`만).

## 스크린샷

Playwright(`--use-gl=angle --use-angle=swiftshader`)로 캐릭터별 정면·3/4·옆·기본 대결 화면·
쓰러진 자세를 찍었다. `docs/character_looks/` 아래 JPEG(각 40~57KB, 150KB 미만)로 저장했다.
콘솔 에러는 다섯 캐릭터 모두 0건.

## 물리 확인

- `node tools/sim/live_battery.mjs`, `node tools/sim/fights12.mjs`: 변경 전과 바이트 단위로
  동일 — 무기 겉모습과 같은 방식(`isolatedVisual`)으로 장식 전용 난수를 격리해 전역
  `Math.random` 소비량이 0이기 때문.
- `node tools/sim/characters_eval.mjs both 2`: 변경 없음.
- 콜라이더·질량·관절·`hasHelmet`(머리 방어)은 전혀 건드리지 않았다. AI 캐릭터 중 누구도
  `look.helmet = 'kettle'`을 쓰지 않는다 — 갑옷·견갑은 전부 겉보기만이고 전투 판정에 영향이
  없다.

## 오너가 정할 것

- 갑옷(하인리히·마르그레테)이 실제로 막아 줘야 하는지: 지금은 순수 장식이라 `vic.hasHelmet`처럼
  방어력에 반영되지 않는다. 반영하려면 `look.armor` 같은 새 필드와 `combat.js` 쪽 판정이
  따로 필요하다(이번 라운드 범위 밖).
- 색·실루엣이 마음에 드는지 — `?look=`으로 언제든 v0와 나란히 비교해 볼 수 있다.
