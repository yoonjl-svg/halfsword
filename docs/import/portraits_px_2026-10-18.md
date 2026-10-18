# 캐릭터 프로필 — 샛별 새 투명 배경 도트판 33 장 (2026-10-18)

- 지시 (사장님 10/18 16:3x): "샛별이 새 캐릭터 프로필 얼터까지 모두 그렸어. 가져와서 적용하고 플레이어 프로필은 '플래이어2'로 사용해. 배경이 투명한 것으로 하되 그리드가 보이는 것도 내가 확인볼 수 있게 스크린샷을 몇개 보내라"
- 들여온 곳: 샛별 저장소 `main` `55ac38e1`(10/18 16:09 KST)의 `public/encounters/pixel-profiles-low128-20261017/` — 34 장(바탕 18 = player1 · player2 · 인물 16, 얼터 16) · `profiles.json` 판 `low128-strict-grid-20261018`(상태 reviewed).
  - 이어진 커밋: `ce2ab205`(옛 low 를 투명 배경 도트판으로) → `9a40f169`(칸 22 × 22 · 액자 1 공유로 맞춤) → `b48d5535` · `6240b2d5` · `0200174b`(눈 · 빛 손질 · 미나미 · 아르토리아 눈꼴) → `23f35807` · `55ac38e1`(미나미 눈꼴 시안 둘 — `low-eye-option1/2.png`, 정본 `low.png` 은 그대로).

## 1. 그림

- 각 `low.png` = 1254² RGBA · **22 × 22 칸**(칸 50 px · 칸 시작 (77, 77) · 칸마다 한 색 — 네 모서리 칸만 액자 장식이 겹침) · 액자 1(금색 이중선 + 네 모서리 장식)이 그려져 있고 **배경(칸 밖 · 인물 둘레 칸)은 투명**. 메타 조각 없음(IHDR · IDAT · IEND 만).
- 마스터: `art/portraits-px-20261018/<id>.png` 34 장 그대로(바이트 같음) + `frame1.png`(공유 액자) · `grid-overlay.svg`(칸 줄) · `profiles.json`.
- 판에 쓰는 것: `public/ui/portraits/<id>.webp` 33 장 — 768² (PIL LANCZOS) · WebP 품질 95 · 투명도 품질 100 · method 6 · 합 약 1.2 MB(한 장 약 30 KB). 만든 도구 `tools/ui/portraits_px_build.py`.
  - **플레이어 = player2 그림**(샛별 이름 '플레이어2' · 최초 오른쪽 3/4 각도) → `player.webp`. player1 은 마스터만.
  - **얼터(광기의 ○○) 16 명도 자기 그림** — 전(10/18 01:0x '얼터는 일단 기본 캐릭터 프로필을 공유')은 바탕 인물 그림을 함께 썼다. 샛별 id 가 우리 인물 id 와 같다(`heinrich_mad` …).
- 투명한 곳에는 쓰는 곳의 바탕이 보인다: 대기실 ① 칸 · 패배 창 그림 칸 모두 어두운 갈색 네모(#30261c — 전 그림의 바깥 띠 색) → 인물 뒤가 어둡다(전: 상아색).

## 2. 주소 스위치

| 주소 | 판 | 파일 | 얼터 |
|---|---|---|---|
| (기본) | 투명 배경 도트판 | `ui/portraits/<id>.webp` (설치 묶음에 듦) | 자기 그림 |
| `?portrait=hd` | 10/17 고해상도 원본(배경 상아색) | `encounters/portraits-hd-20261017/<id>.webp` (전 `ui/portraits/` 에서 옮김 · 설치 묶음 밖) | 바탕 인물 |
| `?portrait=low` | 10/17 4 px 덩어리판 | `encounters/portraits-frame1-20261017/low/<id>.png` (그대로) | 바탕 인물 |
| `?portraitGrid=1` | 위 판에 **22 × 22 칸 줄**을 겹침(확인용) | `ui/portraits/grid-overlay.svg` (샛별 것 그대로 · 1254 좌표라 어느 크기에서도 칸에 맞음) | — |

- 첫 화면 · 대기실로 들어가려면 주소에 `title=1` 도 함께(주소 인자가 있으면 시험 판으로 곧장 싸움): 예 `?title=1&portraitGrid=1`.

## 3. 바꾼 코드

- `src/portraits.js`: 판(pixel · hd · low)마다 그림이 있는 id 표 — pixel 33(바탕 17 + 얼터 16) · hd / low 17(얼터 → 바탕 인물) · `portraitGrid()` · `PORTRAIT_GRID_SRC`.
- `src/lobby.js` · `src/main.js`(패배 창): `data-grid` (?portraitGrid=1) · `src/lobby.css` · `index.html`: `[data-grid]::after` 로 칸 줄 덮개.
- 시험: `tools/sim/portraits.test.mjs`(3 — 모든 인물 · 얼터 자기 그림 · 예비 판 얼터 → 바탕 · 파일 · 스위치) · 브라우저 점검 `defeat_portrait_smoke`(얼터 자기 그림 · hd 예비 · 칸 줄) · `game_entry_smoke` · `ui_fix_smoke` · `lobby_fix_smoke`(판 이름 'pixel').

## 4. 사장님께 보낸 사진 (저장소 밖)

- 대기실 플레이어(player2) 그림 — 칸 줄 없음 / 있음 · 패배 창(하인리히 · 광기의 하인리히) · 33 장 모아 보기 — 칸 줄 없음 / 있음.

## 5. 남은 것

- ~~미나미 눈꼴: 샛별이 시안 둘을 더 올렸다 — 정본 `low.png` 을 썼다.~~ → **10/18 22:1x 사장님 '미나미 눈 모양은 맨 마지막에 만든 작품이 최종'**: 샛별 마지막 판 `a0eb17a1`(10/18 16:29 · `profiles.json` 상태 `user-approved-final-20261018`)의 `minami/low.png` 로 바꿈 — 마지막 시안 `low-eye-option2.png`(왼눈 한 칸 오른쪽)와 같은 바이트(sha256 앞 16 `f18d467c69a95d26`). 마스터 `art/portraits-px-20261018/minami.png` · `profiles.json`(새 판 — 칸 미리보기 · 액자 시안 줄 더함) · `public/ui/portraits/minami.webp` 만 바뀜(다른 32 장 바이트 그대로). 같은 판의 액자 시안 셋(`frame-options/`)은 들이지 않음(지시 없음).
