# 캐릭터 모델링 PM 보고 — round 1

브랜치: `claude/pm-character-looks` (base `claude/first-game-development-2q36ha` @ `a085d9d`), 커밋
`3af06ed`, 푸시 완료. PR: https://github.com/yoonjl-svg/halfsword/pull/new/claude/pm-character-looks
(요청받지 않아 아직 만들지 않음).

문서: [`docs/character_looks.md`](character_looks.md) — 버전별 스크린샷 표 포함, 이 파일보다
읽기 좋게 정리되어 있음.

## 캐릭터별 요약

- **마르그레테 슈바르츠**(`margarethe`): 먹색(ink-black) 판금 가슴갑옷 + 각진 쐐기꼴 견갑, 갈색
  머리. 골반의 기존 치마 위에 세로 판 10장을 둘러 갑주 치마로("아래는 치마" 요청 반영). 와인레드
  트림만 포인트로 쓰고 문장·로고 없음. 용기사 실루엣·분위기만 참고(실존 배우 얼굴/로고 없음).
- **하인리히 도른**(`heinrich`): 은빛(밝은 실버) 가슴갑옷·배갑옷·허벅지 자락·정강이받이·손목
  보호대·둥근 견갑, 은발 + 짧은 은수염. 투구는 얹지 않음(요청에 없었음).
- **랴오 쓰위엔**(`liao`): 장발(뒤로 묶어 등까지) + 한쪽 눈 안대(작은 판+짧은 끈). 사무라이
  쇼다운 방랑 검객 계열 분위기만 참고, 디자인은 새로 그림.
- **이졸데 반 아커러**(`isolde`): 크림 블라우스 + 어두운 남색 긴 치마, 검은 머리. 치마는
  넓적다리(thighF/thighB) 각각에 따로 붙여 래그돌이 벌어져도 다리 두 개가 읽히게 했다. Fate
  세이버 사복 분위기만 참고.
- **오소리 브란**(`bran`): 베이지~갈색 홈스펀 옷, 금발. 앞치마(가슴받이+허리 자락), 로프색 허리끈,
  걷어붙인 소매 자국(팔뚝 띠) 추가.

## 스크린샷 (docs/character_looks/, 각 40~57KB, JPEG)

캐릭터마다: `<id>_v0.jpg`(예전) · `<id>_v1.jpg`=`<id>_front.jpg`(지금, 정면) ·
`<id>_threeq.jpg`(3/4) · `<id>_side.jpg`(옆) · `<id>_default.jpg`(기본 대결 화면) ·
`<id>_down.jpg`(쓰러진 자세, `knockDown(true)` 직후 — 장식이 뜨거나 떨어지지 않고 부위를
잘 따라감을 확인). 다섯 캐릭터 전부 콘솔 에러 0건 (Playwright, `--use-gl=angle
--use-angle=swiftshader`).

## 드로우콜·삼각형 (적 캐릭터 하나, 무기·데칼·아레나 제외하고 격리 측정)

| 캐릭터 | 장식 전 메쉬/삼각형 | 장식 후 메쉬/삼각형 | 증가 |
| --- | ---: | ---: | ---: |
| bran | 50–58*/6163–7140* | 59/7196 | +1메쉬 / +56tri |
| isolde | 52/6782 | 51/6782 | −1메쉬(straps·headband 삭제분이 더 큼) / 0tri |
| liao | 53/6274 | 55/6486 | +2메쉬 / +212tri |
| heinrich | 58/6830 | 67/7326 | +9메쉬 / +496tri |
| margarethe | 51/6746 | 58/6982 | +7메쉬 / +236tri |

\* 브란은 10% 확률로 다른 무기를 들어(`weaponAlt`) 측정마다 무기 메쉬 수가 조금씩 다름(장식과
무관). 화면 전체(`game.renderInfo()`) 수치는 핏자국·발자국 데칼이 판마다 달라 잡음이 커서,
위 표는 `game.enemy` 그룹만 순회해 격리한 값을 썼다(`docs/character_looks.md`에 방법 설명).
모든 재질은 단색(`MeshStandardMaterial`, 텍스처 없음), 부위당 지오메트리를
`mergeGeometries`로 합쳐 메쉬 1~2개로 그린다.

## 아카이브된 버전

`src/looks.js`의 `LOOK_ARCHIVE`: 5개 캐릭터 전부 `v0`(예전, 그대로 보존) + `v1`(지금,
`CHARACTER_LOOK_VERSION`이 가리킴). 미리보기: `?look=margarethe:v0`, `?lookv=0` 등
(`docs/character_looks.md` 참고). player/enemy(기본 상대) 겉모습은 손대지 않음.

## fighter.js 훅 (이게 전부, 다른 줄은 안 건드림)

```diff
+import { decorateOutfit } from './outfits.js';
...
       const mesh = dressPart(dressTo, d, o.look);
+      isolatedVisual(() => decorateOutfit(dressTo, d, o.look), 0);
       this.partMesh[d.name] = mesh;
```

`isolatedVisual(..., 0)`: 무기 겉모습과 같은 패턴 — 장식 전용 난수를 쓰고 전역
`Math.random`은 0번 더 소비해서, 시드 기준 시뮬 결과가 그대로 유지됨.

## 검증

- `node tools/sim/live_battery.mjs`, `node tools/sim/fights12.mjs`: 변경 전과 바이트 단위로 동일.
- `node tools/sim/characters_eval.mjs both 2`: 변경 없음.
- 콜라이더·질량·관절·`hasHelmet`(머리 방어) 전부 그대로. AI 캐릭터 중 `look.helmet = 'kettle'`을
  쓰는 곳 없음 — 갑옷·견갑은 순수 장식이고 전투 판정에 전혀 영향 없음.
- `gait.js`는 건드리지 않음. fighter.js는 위 3줄 외에 다른 곳을 건드리지 않음(다리 관련
  작업과 충돌 없게).

## 오너가 정할 것

1. 갑옷(하인리히·마르그레테)이 실제로 데미지를 막아 줘야 하는지 — 지금은 순수 장식이라
   `vic.hasHelmet`처럼 방어력에 반영되지 않는다. 반영하려면 `look.armor` 같은 필드 +
   `combat.js` 판정을 따로 추가해야 한다(이번 라운드 범위 밖으로 남겨 둠).
2. 색·실루엣이 마음에 드는지 — `?look=<id>:v0`로 언제든 예전과 나란히 비교 가능.

## 참고: 알아채고 고친 것

작업 중 실측 검증(스크린샷을 직접 보고 판단하라는 지시)으로 잡은 버그: 랴오의 안대 끈
지오메트리가 머리 지름과 비슷한 길이(0.22)로 잘못 잡혀 얼굴 절반을 가리는 것처럼 보였다 —
끈 길이를 0.05로 줄이고 눈에 맞춰 재배치해서 고쳤다(수정 후 시뮬 3종 재검증 통과).
