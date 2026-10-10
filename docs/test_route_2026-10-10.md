# 테스트 전용 경로 (2026-10-10)

사장님 10/10 16:5x: "몬탄테와 우치가타나는 내가 해볼게. … 아예 테스트 전용 경로를 만들자. 무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤."
가지 `…/test-route-2q36ha`.

## 주소

- 고르는 화면: **https://yoonjl-svg.github.io/halfsword/test.html**
- '시작'을 누르면: `./index.html?test=1&weapon=<무기 id>&hero=<인물 id|player>&foe=random&stage=random`
- 인자 없는 `index.html` (본판)은 그대로다. 메뉴·여정·무기 카드 뽑기 모두 지금과 같다.

## 고르는 화면 (test.html, src/test_pick.js)

- 무기: `src/weapons.js` WEAPON_LIST 전부 (17종). 맨 위에 **오늘 바뀐 무기** 묶음(츠바이핸더 = 이베리아 몬탄테 고증, 우치가타나 = 일본 자세 고증), 그 아래 나머지.
  카드마다 이름 · 등급(색은 index.html `[data-tier]` 와 같은 값) · 유파 한 줄(`schools.js traditionOf`, 독일 두삭 가지는 가지 이름까지) · 카드 그림(`public/ui/weapons/<id>.webp`).
- 캐릭터: **기본 주인공**(지금 플레이어 겉모습 `LOOKS.player`) + `src/characters.js` CHARACTERS 여덟 명(이름 · 칭호 · 겉모습에 딸린 방어구).
  - 변형 인물 **광기의 하인리히는 뺐다**: 겉모습(look)이 낮의 하인리히와 같고, 다른 점(붉은 안광 `eyes: 'madGlow'`, AI 실력 +20%)은 플레이어에게 주지 않으므로 고를 이유가 없다. 주소에 `hero=heinrich_mad` 를 직접 적으면 받기는 한다(겉모습 = 하인리히, 이름만 다름).
- 마지막 고른 것은 `localStorage['stillness.testRoute.v1']` 에 기억한다(읽기·쓰기 모두 try/catch — 사생활 창 등에서 실패해도 그냥 기본값 츠바이핸더 · 기본 주인공).
- 세로 390×844 · 가로 844×390 에서 가로 스크롤 없음, 누르는 칸 최소 48 px.

## index.html 쪽 인자 (src/test_route.js — main.js 에는 부르는 줄만)

| 인자 | 뜻 |
|---|---|
| `hero=<인물 id>` | 플레이어 겉모습 = 그 인물의 look, 플레이어 이름(`Fighter.name`) = 그 인물 이름. `player` 또는 없음 = 지금 그대로. `test=1` 없이도 쓸 수 있다 |
| `stage=random` | 무대를 `stages.js STAGE_ORDER` 안에서 무작위로 (첫 판 — 메뉴 뒤 — 부터). 같은 무대 두 번 연속 없음. 어두운 홀은 순서표에 없으니 안 나온다. `?stage=<id>` 고정은 그대로 |
| `foe=random` | (원래 있던 인자) 판마다 무작위 상대. `test=1` 과 같이 오면 고른 인물은 상대 후보에서 뺀다(같은 겉모습 둘이 서지 않게). 후보는 CHARACTERS 여덟 명(변형 제외) |
| `test=1` | ① 상대는 **자기 무기**(`pickCharacterWeapon` — 브란은 10% 주운 칼 그대로). 본판에서 `weapon=` 을 주면 상대도 같은 무기를 들지만 테스트 경로는 아니다. `foeWeapon=` 을 직접 적으면 그것이 먼저 ② **이기든 지든 다음 판**: 판을 열 때마다 무대를 넘긴다(무대·상대 새로). 결과 메뉴 단추는 '다음 판 (무작위)', 일시정지의 '처음부터 다시'도 새 무대·새 상대 ③ 메뉴(시작·일시정지·결과 공용 `#menu .actions`)에 **'테스트 고르기로'** 단추를 JS 로 붙이고, 제목 아래에 '테스트 경로 · 무기 · 인물 · 상대·무대 무작위' 한 줄 ④ 무기 카드 뽑기는 `weapon=` 이 이미 건너뛴다(main.js startFight 의 FIXED_WEAPON 길 — 확인함) |

main.js 에서 바뀐 줄: import 1 · `createTestRoute(params)` 1 · pickFoe 2 · nextRoundStage 2 · 첫 무대 1 · 상대 무기 1 · 플레이어 Fighter 옵션 `...testRoute.player` 1 · 결과 단추 글 1 · 메뉴 단추 붙이기 1. index.html 은 건드리지 않았다.

## 고른 인물이 플레이어에게 주는 것 / 안 주는 것

**주는 것**
- 겉모습 전부(옷·머리·얼굴 — look).
- **겉모습에 딸린 방어구**: fighter.js 는 `look.helmet`(투구) · `look.armor === 'plate'`(판금)을 실제 막는 판정으로 쓴다. 그래서
  - 기본 주인공 = 케틀햇(막는다), 하인리히 = 판금, 마르그레테 = 판금 + 뿔 투구, 나머지 다섯 = 방어구 없음.
  - 즉 토메·오마리·미나미 등을 고르면 기본 주인공보다 **머리가 무르다**(케틀햇이 없어짐), 마르그레테를 고르면 훨씬 단단하다.
- 플레이어 이름(`Fighter.name`). 지금 화면에 플레이어 이름을 쓰는 곳은 없다(콘솔 맞음 기록에만 나온다) — 화면 글은 그대로 '내 ○○' 꼴.

**안 주는 것 (지금 규칙 그대로 무기를 따른다)**
- 유파 · 유파 기술 · 비기 · 패시브 · 걸음: 지금처럼 **고른 무기**의 유파(`traditionOf`). 토메를 골라도 츠바이핸더면 이베리아.
- 인물의 AI 성격(persona) · 실력 숫자 · 감정 문턱 · 시작 감정: 플레이어는 사람이 조작하므로 없음.
- 고유 능력: 이졸데의 **부활** 없음, 광기의 하인리히 붉은 안광 없음.
- 목소리: 플레이어 목소리('player') 그대로.

## 알려진 한계

- 무대가 무작위면 '무대마다 그곳의 검객'(STAGE_FOE) 짝은 깨진다 — 상대도 무작위라서(예: 밤의 포세이돈에 낮의 하인리히). 의도대로.
- 방어구가 겉모습에 딸려 오므로 인물을 바꾸면 내구도가 달라진다(위). 겉모습만 바꾸고 방어구는 기본 주인공 것으로 둘지 사장님께 여쭘.
- 빌드: test.html 이 weapons·characters·schools 를 같이 읽어서 Vite 가 공용 조각(`assets/characters-*.js`)을 따로 떼어 낸다. 본판은 그 조각을 하나 더 받는다(내용·동작 같음, 파일 수만 +1).
- 결과 메뉴 단추 글('다음 판 (무작위)')과 '테스트 고르기로'·안내 한 줄은 src/test_route.js 안의 글이다(화면 글 정리 작업과 겹치지 않게 main.js·index.html 밖에 둠).

## 확인

- `node tools/browser/test_route_shots.mjs http://127.0.0.1:4297 docs/handoff` (빌드 + `vite preview --port 4297`): 검사 전부 통과, 콘솔 에러 0.
  - test.html 세로·가로: `docs/handoff/test_route_picker_{portrait,landscape}{,_full}.png`
  - 츠바이핸더 + 토메 세 판(이김 → 짐 → 판 넘김): `test_route_z_menu.png` · `z_round1.png` · `z_round1_hero_front.png`(앞에서 본 플레이어) · `z_round1_result_win.png` · `z_round2.png` · `z_round2_result_lose.png` · `z_round3.png` · `z_pause_menu.png`
    - 한 번 돌린 예: 무대 화전 터 → 포세이돈 → 화전 터, 상대 오마리(츠바이핸더 — 자기 무기) → 이졸데(롱소드) → 브란(나뭇가지)
  - 일시정지 '테스트 고르기로' → test.html 이 마지막 고름(츠바이핸더 · 토메)을 기억
  - 우치가타나 + 마르그레테: `test_route_picker_uchigatana_selected.png` · `test_route_u_round1.png` (뿔 투구 · 판금 5곳)
  - 인자 없는 본판: 포세이돈 · '나'(케틀햇) · 하인리히 · 테스트 단추 없음
- 본판 관문: fights12 `5480fbd3` · live_battery `e7ee3d96` · finish_thrust 1 --stand `433ac984` · corr_s0 IDENTICAL 12/12 · weapon_smoke OK 17/17 · vite build 성공 · name_policy 위반 0.
