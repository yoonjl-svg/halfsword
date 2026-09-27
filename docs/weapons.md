# 무기 로스터 → 유파 꾸러미(schools.js) 연동 자료

캐릭터 PM 쪽 `docs/school_contract.md`(claude/pm-characters) 계약에 맞춰 정리한 자료.
`src/ai.js`·`src/schools.js`·`src/characters.js`는 건드리지 않았다 — 숫자만 여기 남긴다.

- 이 브랜치: `claude/pm-weapons`. `origin/main`(유파·캐릭터·소리 통합)을 `b43285f`에서 합쳐
  두었고, 등급·복제품·별칭·실전용 롱소드는 그다음 커밋(이 문서를 갱신한 커밋)에 있다 —
  정확한 해시는 `git log -1 origin/claude/pm-weapons`.
- 무기 물리(질량·형태·재질·손목 힘 한계 등)는 `src/weapons.js`의 `WEAPONS` 객체가 정한다.
  `fighter.js`는 이 스펙으로 칼을 만들 뿐, `src/ai.js`는 그대로(원래 파일로 되돌려 두었다) —
  전역 `MEASURE` 상수 하나만 쓰는 옛 방식 그대로다. 무기별 간격은 여기 표를 그대로
  `schools.js`의 `measure`에 넣으면 된다.

## 1. 무기 id 목록 + 질량 + 칼날 길이

*질량은 `buildParts()`가 만드는 자루+폼멜+코등이+칼날 합. 칼날 길이(`bladeLength`)는 무기
스펙에 직접 있는 값. `HL`(hiltLength) = 자루 원점(손)에서 칼날이 시작하는 거리.*

| id | 한글 이름 | 잡는 법 | 질량(kg) | 칼날 길이(m) | HL(m) | 재질 |
|---|---|---|---|---|---|---|
| longsword | 롱소드 | 두손 | 1.60 | 1.05 | 0.13 | steel |
| longsword_sharp | 롱소드 (실전용, 별도 id) | 두손 | 1.39 | 0.90 | 0.13 | steel |
| arming_sword | 암소드 | 한손 | 1.13 | 0.72 | 0.10 | steel |
| messer | 메서 | 한손 | 0.96 | 0.60 | 0.11 | steel |
| zweihander | 츠바이핸더 | 두손 | 2.90 | 1.17 | 0.19 | steel |
| estoc | 에스톡 | 한손반 | 1.60 | 1.15 | 0.14 | steel |
| sabre | 세이버 | 한손 | 0.95 | 0.83 | 0.11 | steel |
| rapier | 레이피어 | 한손 | 1.10 | 0.95 | 0.10 | steel |
| falchion | 팔쉬온 | 한손 | 0.90 | 0.80 | 0.10 | steel |
| katana | 카타나 | 두손 | 1.20 | 0.72 | 0.25 | steel |
| jian | 지안 | 한손 | 0.85 | 0.74 | 0.12 | steel |
| hwandudaedo | 환두대도 | 한손반 | 1.30 | 0.68 | 0.12 | steel |
| excalibur | 엑스칼리버 (진품, 플레이어 전용) | 두손 | 1.35 | 1.00 | 0.13 | steel |
| excalibur_replica | 엑스칼리버 (복제품) | 두손 | 1.60 | 1.05 | 0.13 | steel — 물리는 롱소드와 100% 동일, 겉만 금색 |
| lightsaber | 라이트세이버 | 한손 | 0.77 | 0.90 | 0.15 | plasma |
| tree_branch | 나뭇가지 | 한손 | 0.32 | 0.80 | 0.15 | wood (edged:false) |
| rubber_chicken | 고무 닭 | 한손 | 0.20 | 0.35 | 0.10 | rubber (edged:false) |
| frozen_tuna | 냉동 참치 | 두손 | 1.50 | 0.75 | 0.15 | frozen (edged:false) |

현재 캐릭터가 참조 중이라고 하신 네 개(`longsword, jian, branch, excalibur`) 중 `branch`는
이 로스터에서 `tree_branch`로 되어 있다 — id를 맞추거나 `schools.js`에서 매핑해 주시면 된다.

### 1a. 등급 · 별칭 · 소리 재질 (스펙에 함께 실려 있다)

- **등급 계약** (캐릭터 PM 추가 지시 반영) — 스펙마다 `tier: 'trash'|'common'|'legend'`,
  `power`(타격 에너지 배율, common=1.0 — combat.js가 베기·찌르기·둔기 에너지에 실제로 곱한다),
  `durability`(내구, 0~1 — 아직 아무 코드도 안 쓰는 계약 수치, 부서짐은 감독이 붙인다).
  등급 기본값 `TIER_DEFAULTS`: trash 0.85/0.15, common 1.0/0.6, legend 1.2/1.0. 무기에 직접 적은
  값이 우선. 지금 나뭇가지·냉동 참치가 실제로 부러지는 건 별도 `breakImpulse`(칼끼리 부딪힌
  충격량 예산 N·s: 9, 14) 때문이며 `durability`와는 별개다.

  | id | tier | power | durability | 비고 |
  |---|---|---|---|---|
  | tree_branch (`branch`) | trash | 0.85 | 0.15 | 날 없음(찌르기 없음), breakImpulse 9 |
  | excalibur | legend | 1.2 | 1.0 | 플레이어 전용 진품. 베기·찌르기·둔기 모두 ×1.2 |
  | excalibur_replica | common | 1.0 | 0.6 | 하인리히용. 물리·수치는 롱소드 그대로 |
  | jian | common | 1.0 | 0.6 | mThrust 1.15(찌르기 강함), 한손(누르는 힘 12N·m) |
  | frozen_tuna | common | 1.0 | 0.25 | 커먼이지만 잘 갈라진다, breakImpulse 14 |
  | 나머지 전부 | common | 1.0 | 0.6 | |

- **별칭** `WEAPON_ALIASES` — `getWeapon()`이 알아서 정식 id로 바꾼다:
  `branch`/`stick`→`tree_branch`, `chicken`→`rubber_chicken`, `tuna`→`frozen_tuna`,
  `sharp`→`longsword_sharp`, `replica`→`excalibur_replica`, `arming`→`arming_sword`,
  `saber`→`lightsaber`. characters.js의 `weapon: 'branch'`는 그대로 두셔도 된다.
  모르는 id는 롱소드로 대신하고 콘솔에 경고를 한 번 찍는다.
- **소리 재질** `spec.soundMaterial` — 소리 담당 API `sound.impact({a, b, energy})`가 아는 이름
  (`steel/armor/flesh/wood/plasma/rubber`)으로 옮긴 값. 물리 재질과 다른 건 냉동 참치뿐
  (`frozen` → 소리는 `wood`). 나머지는 이름이 같다. 부딪힘 처리에서 `att.weapon.soundMaterial`을
  `a`에, 상대 무기/갑옷/살을 `b`에 넣으면 된다(main.js 연결은 아직 안 했다 — 소리 담당 판단).
- **기본 무기 스위치** `DEFAULT_WEAPON`(`'longsword'`) — `'longsword_sharp'`로 바꾸면 무기를 안
  정한 모든 파이터가 실전용 롱소드를 든다. 기존 시뮬 수치가 전부 바뀌므로 감독 결정 전엔 그대로.

## 2. 무기별 measure (실측 — 2차 시도로 성공)

**1차 시도**(가만히 세운 상대에게 실제로 맞혀서 이분 탐색)는 몸이 손 목표를 따라가며 흔들리는
탓에 거리에 비례해 깔끔히 명중/불명중이 갈리지 않아 버렸다(1.6m 명중 → 1.7~1.8m 빗나감 →
1.9~2.1m 다시 명중 식). **2차 시도로 방법을 바꿔 성공했다** — `tools/sim/weapon_measure.mjs`:
상대를 아예 치우고(park()) 혼자 분노의 베기(zornhau — 코드 주석에 "가장 잘 통함"이라고 되어
있다)를 한 번 휘두르면서, 칼날 70% 지점이 머리 높이(y 1.45~1.75m)를 지나는 순간의 **스윙을
시작한 시점의 가슴 위치·방향 기준** 전방 거리를 기록한다(상대 몸과의 충돌 판정이 아예 없어
노이즈가 없고, 한 번만 돌리면 된다). `reach`는 같은 스윙에 내딛기(move.y=1)를 더해서 잰다.

이 raw 값 자체는 원래 롱소드 기준(1.62m)과 정확히 일치하진 않아서(기술·타이밍이 다를 수 있어
생기는 체계적 차이로 보임), **롱소드의 raw 값이 1.62가 되는 배율을 구해 모든 무기에 똑같이
곱했다**(이번 실행 기준 ×1.178 — 매번 이 배율도 같이 찍어 준다). 무기별 *상대적* 차이는 이
보정과 무관하게 그대로 실제 물리(질량·무게중심·손목 제어)에서 나온 값이라, 이번엔 정말
"실측"이라고 부를 만하다. `clinch`만은 여전히 롱소드 비율(`clinch/contact = 1.25/1.62`)로
유도했다(직접 재기 애매한 개념이라서). `cutTime`은 배율 없이 그대로 잰 시간이다.

| id | contact | reach | clinch | cutTime | 비고 |
|---|---|---|---|---|---|
| longsword | 1.62 | 1.91 | 1.25 | 0.42 | 기준(보정으로 정확히 일치). main 병합 후 다시 재면 1.62/1.92/1.25/0.43 (걸음 쪽 변화, 오차 수준) |
| longsword_sharp | 1.51 | 1.77 | 1.17 | 0.40 | main 병합 후 실측. 칼날 15cm 짧고 210g 가벼워 간격이 줄고 살짝 빠르다 |
| excalibur_replica | 1.62 | 1.92 | 1.25 | 0.43 | 롱소드와 동일(물리가 같다) — 롱소드 유파 그대로 쓰면 된다 |
| arming_sword | 1.25 | 1.50 | 0.96 | 0.38 | |
| messer | 1.23 | 1.46 | 0.95 | 0.37 | |
| zweihander | 1.62 | 2.05 | 1.25 | 0.48 | 무거워 스윙이 느려 contact는 롱소드와 비슷, reach는 더 크다 |
| estoc | 1.65 | 2.00 | 1.27 | 0.44 | |
| sabre | 1.29 | 1.58 | 1.00 | 0.38 | |
| rapier | 1.48 | 1.72 | 1.14 | 0.36 | |
| falchion | 1.29 | 1.55 | 1.00 | 0.38 | |
| katana | 1.44 | 1.77 | 1.11 | 0.44 | |
| jian | 1.32 | 1.55 | 1.02 | 0.38 | |
| hwandudaedo | 1.29 | 1.55 | 1.00 | 0.42 | |
| excalibur | 1.61 | 1.87 | 1.24 | 0.39 | |
| lightsaber | 1.56 | 1.72 | 1.20 | 0.29 | cutTime이 눈에 띄게 짧다 — 칼날이 거의 질량 없어 손목이 훨씬 빨리 돈다 |
| tree_branch | 1.41 | 1.63 | 1.09 | 0.36 | |
| rubber_chicken | 1.07 | 1.21 | 0.83 | 0.26 | 짧고 가벼워 간격이 확 줄고 cutTime도 짧다 |
| frozen_tuna | 1.32 | 1.64 | 1.02 | 0.43 | |

재현 방법: `node tools/sim/weapon_measure.mjs` (인자 없으면 전체, 무기 id를 인자로 주면 그것만).
결정적(같은 seed=1, 랜덤 없음)이라 다시 돌려도 같은 값이 나온다.

**그래도 남는 한계**: 기술을 `zornhau` 하나만 썼고, `reach`의 "한 걸음 내딛기"는 실제 발놀림이
아니라 `move.y=1`을 스윙 내내 누르는 것으로 단순화했다. `TECH[].reach`(기술별 개별 보정)는
여전히 다시 재지 못했다 — 위 표는 "대표 기술 하나의 대표적인 간격"이지 기술마다 다른
`reach` 보정까지 담지는 않는다. 손맛을 보면서 미세 조정하는 걸 권한다.

## 3. 무기 쪽 특수 규칙 (schools.js 밖, fighter.js/combat.js에서 처리)

캐릭터 PM이 알아 두면 좋을, weapons.js/fighter.js/combat.js 쪽에서 이미 처리한 것들:

- `edged: false`인 무기(나뭇가지·고무 닭·냉동 참치)는 베기·찌르기 판정이 아예 없고 항상 둔기
  판정이다. `fighter.applyWound`가 둔기는 머리·목에서만 효과가 있게 되어 있어서(몸통·팔다리
  타격은 판정상 무해), 이 셋의 실전 성능은 "머리에 맞히는가"에 크게 좌우된다.
- `breakImpulse`가 정해진 무기(나뭇가지 9, 냉동 참치 14, 단위는 칼끼리 부딪힌 충격량 N·s 누적)는
  다 닳으면 부러져(`weaponBroken`) 그때부터 항상 둔기 판정이 된다(원래도 `edged:false`라 실제
  차이는 시각 효과 정도).
- `ignoreArmor: true`인 무기(라이트세이버)는 갑옷·투구가 막아 주지 않는다.
- `mCut`/`mThrust`/`mBlunt`는 같은 물리(속도·유효질량)로 계산한 에너지에 곱하는 무기별 배율 —
  세이버가 물리로 다 담기지 않는 곡도 베기 효율을 보정하거나, 에스톡이 갑옷 틈을 노리는 찌르기에
  강하고 베기에 약하다는 설정 등에 쓴다.
- 지안 설정(docs/character_lore.md)의 "cutTime 0.22" 요청: 실측은 0.38로 롱소드(0.42)보다
  약 10% 빠른 정도다. 물리(질량 0.85kg·한손)로는 0.22가 안 나온다 — 그 수치를 원하시면 유파 쪽
  `measure.cutTime`에 그냥 적어도 되지만, 실제 스윙은 그보다 느리니 AI 타이밍이 어긋날 수 있다.
  나뭇가지의 "찌르기 없음"은 `edged:false`로 이미 그렇다.

## 4. AI 대 AI 밸런스 (참고용, 옛 ai.js 기준 — schools.js 통합 전)

`tools/sim/weapon_balance.mjs`로 각 무기 vs 롱소드, 양쪽 다 AI를 붙여(이 부분은 `src/ai.js`를
고치기 전, 무기 길이에 맞춰 간격을 스스로 조정하는 임시 버전으로 쟀다 — 지금은 되돌려서
`src/ai.js`가 전역 `MEASURE` 하나만 쓰니, `schools.js`로 무기별 `measure`를 넣은 뒤에는 이 숫자가
그대로 재현되진 않을 것이다. 물리(질량·손목 힘 등)는 그대로라 방향은 비슷하겠지만, 최종 검증은
꾸러미를 붙인 뒤 다시 재는 걸 권한다):

25판×2방향(총 50판)씩 잰 마지막 확인 결과 (모두 롱소드 상대 승률):

| 무기 | 승률 | 평균 종료(s) | 무승부 | 비고 |
|---|---|---|---|---|
| 엑스칼리버 | 52% → 58% | 16.0 → 15.6 | 7/50 → 3/50 | 세지만 절대적이지 않음. 뒤 값은 등급 power 1.2 적용 후(main 병합 AI) |
| 엑스칼리버 복제품 | 46% | 18.2 | 7/50 | main 병합 후(유파 AI) 실측 — 롱소드 미러전이니 50% 근처가 정상 |
| 롱소드 (실전용) | 28% | 19.7 | 9/50 | main 병합 후 실측. 가볍고 짧아 훈련용 롱소드에 밀린다(아래 5절 참고) |
| 라이트세이버 | 54% | 17.8 | 1/50 | 가볍고 빠르지만 무거운 칼에 밀림 |
| 츠바이핸더 | 30% | 19.3 | 12/50 | |
| 팔쉬온 | 22% | 19.5 | 7/50 | |
| 냉동 참치 | 20% | 17.8 | 7/50 | 34/50판에서 부러짐(breakImpulse) |
| 암소드 | 18% | 18.9 | 10/50 | |
| 레이피어 | 16% | 19.3 | 10/50 | |
| 메서 | 14% | 15.5 | 8/50 | |
| 고무 닭 | 12% | 17.4 | 5/50 | |
| 나뭇가지 | 10% → 10% | 20.3 → 19.5 | 5/50 | 28/50판에서 부러짐(breakImpulse). 뒤 값은 tier power 0.85로 옮긴 뒤(총 배율 동일) |
| 카타나 | 10% | 17.1 | 6/50 | |
| 환두대도 | 8% | 21.3 | 12/50 | |
| 지안 | 8% → 10% | 19.2 → 18.3 | 8/50 | 뒤 값은 mThrust 1.15 적용 후(main 병합 AI) |
| 에스톡 | 6% | 16.2 | 16/50 | |
| 세이버 | 6% | 17.2 | 8/50 | |

모두 95%/5% 밖으로 벗어나지 않는다(요청하신 밸런스 기준). `node tools/sim/weapon_smoke.mjs`로
16개 무기 전부 물리 발산(NaN) 없이 안정적임도 확인했다.

## 5. 남은 질문

- `schools.js`에 무기별 꾸러미를 붙일 때 `guards`/`tech`/`parry`/`counter`는 전부 롱소드 것을
  그대로 쓰실 계획인지, 아니면 카타나·지안처럼 자세 자체가 다른 무기는 나중에 따로 만들
  계획인지 궁금하다 — 그에 따라 `TECH[].reach` 재실측 우선순위가 달라질 것 같다.
- `TECH[].reach`(기술별 개별 보정)는 아직 못 쟀다 — `weapon_measure.mjs`를 기술별로 확장해
  이어서 도와드릴 수 있다(원하시면 말씀해 주시면 바로 시작하겠다).
- ~~`weapon: 'branch'`(characters.js) ↔ `tree_branch`(weapons.js) id 표기가 다른 점~~ → 별칭으로
  해결(1a절). 다만 main의 `characters.js`는 하인리히가 `'excalibur'`(진품 id)를 들고 있고
  pm-characters 쪽은 `'excalibur_replica'`다 — 복제품 id는 이제 있으니 `excalibur_replica`로
  맞추시면 진품(플레이어 전용)과 갈린다.
- 실전용 롱소드(`longsword_sharp`, Albion Crécy 1.39kg·칼날 0.90m)는 훈련용 기본 롱소드보다
  승률 28%로 확실히 약하다(짧고 가벼워 닿는 거리·타격 에너지 둘 다 준다). "기본값을 실전용으로
  바꿀지"는 감독 판단 — 바꾸면 미러전이라 밸런스 자체는 문제 없지만 `measure`(1.51/1.77)·
  fights12 기준선이 전부 바뀐다. 결정 전엔 `DEFAULT_WEAPON = 'longsword'` 그대로.
- 2절의 measure 표는 `zornhau` 기술 하나로 잰 값이라, 실제 게임에 붙여서 손맛을 봤을 때
  체감과 차이가 크면 알려 주시면 같이 다시 조정하겠다.
