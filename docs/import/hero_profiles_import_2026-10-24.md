# 손님 인물 셋 프로필 확정본 들여오기 (10/24 — 샛별 저장소 전달본 0aef88d4)

> 사장님 10/24: "샛별이가 프로필 사진 보냈대. 모두 적용해."
> 방랑 전용 손님 인물 셋(롤랑 · 백린의 전사 · 베르나르도)의 **임시 프로필 그림**(10/23 — 게임 모델을 찍어 22 × 22 칸으로 줄인 그림 · `docs/import/wander_heroes_import_2026-10-23.md` §5)을 샛별 저장소가 손으로 그린 **확정본**으로 바꿨다.
> 전달본을 병합하지 않고 그림 파일만 골라 우리 경로 · 우리 id 로 옮겼다. 전달본의 인계서 · 검사 도구는 들이지 않고, 검사는 우리 도구로 다시 썼다(§5).

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 받은 곳 | 샛별 저장소 커밋 `0aef88d4a7397dc727641f0d773b8a49d2878533` (읽기 전용 사본에서 읽기만 함) |
| 들인 것 | 인물마다 `original.png` · `low.png` · `grid.png`(모두 1254² RGBA · 바이트 그대로) · 칸 자료 `sprites.json`(바이트 그대로) · 우리 `manifest.json`(새로 씀) |
| 안 들인 것 | 공유 액자 `frame1.png`(우리 `art/portraits-px-20261018/frame1.png` 와 sha256 같음 — 다시 두지 않음) · 전달본 인계서 · 세 인물 모아 본 그림 · 검사 도구 · 검사 결과 JSON 둘 · 전달본 manifest(경로가 샛별 id 라 우리 것으로 새로 씀) |
| id | 샛별 `sebastian` → **`roland`** · `white_scale` → **`white_scale`** · `black_king`(그쪽 이름 올리비에) → **`bernardo`** |
| 게임 파일 | `public/ui/portraits/{roland,white_scale,bernardo}.webp` 를 `low.png` 에서 다시 만듦(768² · 다른 33 장과 같은 값) |
| 코드 | `src/portraits.js` — 세 id 를 임시 그림 표(`TEMP_PORTRAIT_IDS`)에서 빼고 손님 인물 표(`GUEST_PORTRAIT_IDS`)로. 임시 그림 표는 빈 표로 남김 |
| 옛 임시 그림 | 마스터 `art/portraits-temp-20261023/` · 도구 둘(`tools/browser/portrait_temp_shots.mjs` · `tools/ui/portraits_temp_build.py`)은 기록으로 둠 — 지우지 않음 |
| 베르나르도 | 받은 그림은 **v1 복식**(먹빛 갑옷 · 황토빛 짧은 망토). 지금 모델은 v2 — 사장님 '모두 적용해'대로 다시 그리지 않고 그대로 씀(§4) |
| 점검 | 우리 검사 도구 통과 · 전달본 검사 도구의 같은 검사(해시 · 다시 그리기) 통과 · 단위 시험 · name_policy 0 · vite build · 화면 9 장(§5) |

## 1. 받은 것 · 우리 파일

| 전달본 파일 (샛별 id 경로) | 우리 파일 | 어떻게 |
|---|---|---|
| `art/hero-profiles-20261024/sebastian/{original,low,grid}.png` | `art/hero-profiles-20261024/roland/{original,low,grid}.png` | 바이트 그대로 |
| `art/hero-profiles-20261024/white_scale/{original,low,grid}.png` | `art/hero-profiles-20261024/white_scale/{original,low,grid}.png` | 바이트 그대로 |
| `art/hero-profiles-20261024/black_king/{original,low,grid}.png` | `art/hero-profiles-20261024/bernardo/{original,low,grid}.png` | 바이트 그대로 |
| `art/hero-profiles-20261024/sprites.json` | 같은 경로 | 바이트 그대로 (안의 열쇠는 샛별 id — 우리 manifest 의 `sourceId` 로 잇는다) |
| `art/hero-profiles-20261024/manifest.json` | 같은 경로 | **새로 씀** — 경로 · id 를 우리 것으로 · 그림 해시는 전달본 manifest 와 같음 · 게임 WebP 해시 · 사장님 말씀 · 베르나르도 눈끝 칸 |
| `art/hero-profiles-20261024/frame1.png` | — | 우리 `art/portraits-px-20261018/frame1.png` 와 sha256 `8d6ec8d1…1a54` 같음 → 그것을 씀 |
| 인계서 · 모아 본 그림 · 검사 도구 · 검사 결과 둘 | — | 안 들임 (내용은 이 기록에 우리 말로) |

- 그림 꼴(셋 다 같음 — 우리 도트 프로필 33 장과 같은 꼴): 1254² RGBA · 인물 **22 × 22 칸**(칸 50 px · 칸 시작 (77, 77)) · 액자 1(금색 이중선 + 네 모서리 장식) · 인물 뒤 투명 · 메타 조각 없음.
  - `original.png` = 액자 1 을 씌운 고해상도 원본(보관용) · `low.png` = 게임용 칸 그림(칸마다 손으로 고친 최종본) · `grid.png` = 칸 줄을 덮은 검수용(게임에 안 씀).
- 얼굴 칸 폭(전달본 기록): 롤랑 8 · 백린 7 · 베르나르도 8 칸 · 턱 14 번째 줄 · 가슴 위 같은 자르기. 두 투구의 눈가림(롤랑 면갑 틈 · 백린 가면)은 그대로.
- **베르나르도 눈 = 받은 최종본 그대로**: 눈 자리를 두 칸 올린 시안에서 각 눈의 가장 오른쪽 끝 칸을 한 칸 내리고 그 두 칸 (13, 7) · (16, 8)(칸 좌표 0 부터 — 열, 행)만 `#6E503B` → `#4F3829` 로 어둡게 한 판. 중간 시안으로 바꾸지 않았다 — 검사 도구가 그 두 칸의 색을 칸 자료와 `low.png` 둘 다에서 본다.

## 2. id · 이름

| 화면 이름 | 우리 id | 샛별 id (그쪽 이름) | 그림 |
|---|---|---|---|
| 롤랑 | `roland` | `sebastian` (롤랑) | 상아빛 닫힌 면갑 투구 · 흰 말총 · 금 콧대 · 상아빛 판금 · 포도주색 망토 깃 · 가슴의 성 문장 |
| 백린의 전사 | `white_scale` | `white_scale` (몽골 전사 · 백린의 전사) | 검은 뿔 투구 · 검은 가면 · 은빛 갑찰 · 붉은 끈과 띠 |
| 베르나르도 | `bernardo` | `black_king` (올리비에) | 짙은 피부 · 검은 곱슬머리 · 짙은 턱수염 · 먹빛 판금 · 황토빛 망토 (§4) |

## 3. 변환 (우리 기존 규칙 그대로)

- `tools/ui/portraits_px_build.py` 가 이제 `art/hero-profiles-20261024/<id>/low.png` 셋도 같이 만든다 — 1254² `low.png` → **768² (Pillow LANCZOS) · WebP 손실 품질 95 · 투명도 품질 100 · method 6** → `public/ui/portraits/<id>.webp`. 10/18 도트판 33 장 · 10/23 임시 그림과 같은 값이다.
  - 다시 돌려도 다른 33 장은 바이트가 그대로다(Pillow 12.3 · libwebp 1.6 에서 확인 — 이번 커밋에서 바뀐 WebP 는 셋뿐).
  - 크기: 롤랑 29,452 → 32,798 B · 백린 30,480 → 31,716 B · 베르나르도 27,728 → 29,648 B (다른 그림과 같은 30 KB 안팎).
- 화면이 부르는 그림은 하나뿐이다 — 대기실 프로필 칸(`?hero=<id>`)과 패배 창(일반 · 방랑) 모두 `portraitSrc(id)` = `ui/portraits/<id>.webp`. 다른 크기 · 다른 판 파일은 없다.
  - 예비 판(`?portrait=hd` · `?portrait=low` — 10/17 그림 17 장)에는 이 셋이 없어 전처럼 기본 판 그림을 쓴다(`portraitSrc`). `original.png` 를 hd 예비로 쓰는 것은 하지 않았다(hd 예비는 상아색 바탕 10/17 판 — 꼴이 달라서 · 지시 없음).
  - 칸 줄 보기(`?portraitGrid=1`)는 1254 좌표 공통 SVG 라 이 셋에도 그대로 맞는다.
- 설치 묶음(PWA)은 빌드 때 `dist` 를 훑어 목록을 만들므로 따로 고칠 것이 없다(`art/` 는 묶음 밖).

## 4. 베르나르도 — 그림(v1 복식)과 지금 모델(v2)의 차이

> (10/24 14:3x 바뀜) 샛별 저장소 복식 수정본(100a5971 — 흰 금테 겉옷 · 금관 쓴 검은 사자 · 금빛 망토)으로 그림을 바꿔 이제 옷은 v2 와 같다. 남은 차이는 수염 두께 · 금 머리띠뿐 — `docs/import/bernardo_whip_import_2026-10-24.md` §1 · 확인표 2440. 아래는 지난 내용.

샛별 저장소는 사장님이 이전에 확정한 올리비에 그림(우리 베르나르도 v1 과 같은 복식)을 보냈다. 우리 베르나르도는 10/23 에 v2 로 바뀌었다(`docs/decisions.md` 10/23 · 확인표 2318 ~ 2325). 사장님 '모두 적용해'대로 **다시 그리지 않고 받은 그대로** 썼다. 프로필(게임에 보이는 22 × 22 칸)에서 보이는 차이:

| | 프로필 그림 (받은 그대로 = v1 복식) | 지금 모델 v2 |
|---|---|---|
| 가슴 | 먹빛 리벳 판금 가슴판 · 어깨 판금 (겉옷 없음) | 무릎까지 오는 **흰 겉옷** · 가슴 한가운데 **금관 쓴 보랏빛 사자** |
| 망토 | **황토 · 올리브빛 짧은 망토**가 인물 오른어깨(그림 왼쪽)를 덮고 둥근 금 단추로 여밈 | 같은 어깨에 걸쳐 종아리까지 떨어지는 **맑은 금빛 긴 망토** |
| 금테 | 없음 | 겉옷 둘레 · 견갑 · 팔뚝 보호대 · 무릎 덮개의 가는 금테 |
| 머리 | 머리띠 없음 | **가는 금빛 머리띠**(시험 — 확인표 2325) |
| 수염 | 볼 · 턱을 덮는 짙고 풍성한 수염 | **반으로 다듬은** 짧은 수염(확인표 2321) |
| 같은 것 | 짙은 피부 · 어깨 닿는 검은 곱슬머리 · 찌푸린 눈매 · 쇠 깃 · 투구 없음 | (v2 도 v1 머리 · v1 쇠 깃) |

- 22 × 22 칸에서는 사자 · 금테 · 머리띠가 원래 몇 칸이라, 가장 눈에 띄는 차이는 **가슴 색(먹빛 판금 ↔ 흰 겉옷)** 과 **망토 색 · 길이** 다.
- 맞춘 그림이 필요하면 샛별 저장소에 v2 복식으로 다시 부탁하거나, v2 를 그림 쪽(v1)으로 되돌리는 두 길이 있다 — 사장님 확인 전(확인표 2331).

## 5. 점검

- **우리 검사 도구** `python3 -I tools/ui/hero_profiles_verify.py` — 통과. 전달본 검사 도구의 검사를 우리 경로 · id 로 옮기고 몇 가지를 더함:
  1. manifest 의 파일 14 개 sha256 · 바이트 수(그림 9 · `sprites.json` · 공유 액자 · 게임 WebP 3)
  2. 그림 9 장 1254² RGBA · 칸 22 × 22 · 칸 투명도 0 / 255 뿐
  3. `low.png` = 칸 자료를 칸 50 px · (77, 77) 로 그리고 액자 1 을 덮은 그림과 픽셀이 같음 · `grid.png` = 그 위에 칸 줄 · `original.png` 의 액자 자리 = 액자 1
  4. 베르나르도 눈끝 두 칸 (13, 7) · (16, 8) = `#4F3829` (칸 자료 · `low.png`)
  5. 게임 WebP = `low.png` 를 위 규칙으로 줄인 바이트와 같음 · 768² RGBA
  6. `src/portraits.js` 손님 인물 표에 셋 · 임시 그림 표에 없음 · 옛 임시 마스터 셋이 남아 있음
- **전달본 검사 도구의 같은 검사** — 전달본 사본(우리 저장소 밖)에 대해 해시 11 개 · 다시 그리기 · 액자를 그대로 돌려 통과. 마지막 단계(우리 게임 파일 · 임시 그림이 바뀌지 않았는지 보는 것)는 이번에 일부러 바꾸므로 뺐다.
- 받은 그림 9 장 · `sprites.json` 의 sha256 = 전달본 manifest 값 (우리 manifest 에 같은 값).
- 단위 시험 `node --test tools/sim/*.test.mjs` — `tools/sim/portraits.test.mjs` 고침: 임시 그림 표 = 빈 표 · 손님 인물 표 셋 · 마스터 경로 · 예비 판 → 기본 판 그림 · 새 시험 하나(manifest 해시 · 게임 WebP 768² · 옛 임시 마스터 남음 · 눈끝 칸).
- `node tools/text/name_policy.mjs` 위반 0 · `npx vite build` 오류 없음.
- 화면(폰 가로 844 × 390 · 배율 2 · WebP — `tools/browser/hero_profiles_shots.mjs` → `tools/ui/hero_profiles_sheet.py`, 판 끝은 연결 확인용으로 강제) — **PASS 9 · 콘솔 오류 0**(아홉 곳 모두 그림 = `ui/portraits/<id>.webp` · 768² · 패배 창은 그 인물의 승리 대사) · `docs/handoff/hero_profiles_2026-10-24/`:
  - `lobby_{roland,white_scale,bernardo}.webp` — 대기실 프로필 칸(`?title=1&hero=<id>`)
  - `defeat_{roland,white_scale,bernardo}.webp` — 그 인물에게 진 패배 창(왼쪽 프로필 · 오른쪽 승리 대사)
  - `wander_defeat_{roland,white_scale,bernardo}.webp` — 방랑에서 그 인물에게 진 창('… · 방랑 종료')
  - `before_after.webp` — 셋의 10/23 임시 그림 → 10/24 확정본(게임 WebP 를 나란히)

## 6. 바꾼 것

- 그림: `art/hero-profiles-20261024/`(새) · `public/ui/portraits/{roland,white_scale,bernardo}.webp`(바꿈).
- 코드: `src/portraits.js`(`GUEST_PORTRAIT_IDS` 새 · `TEMP_PORTRAIT_IDS` 빈 표 · 주석).
- 도구: `tools/ui/portraits_px_build.py`(셋을 같이 만듦) · `tools/ui/hero_profiles_verify.py`(새) · `tools/browser/hero_profiles_shots.mjs`(새) · `tools/ui/portraits_temp_build.py`(게임 파일은 `--public` 을 붙일 때만 덮어씀 — 확정본을 잘못 덮지 않게) · `tools/browser/portrait_temp_shots.mjs`(주석).
- 시험: `tools/sim/portraits.test.mjs`.
- 기록: 이 문서 · `docs/decisions.md` 10/24 · 확인표 2330 ~ 2332(2300 에 지난 내용 표시) · `docs/import/wander_heroes_import_2026-10-23.md` §5 에 바뀜 표시 · 공지 `20261024-hero-portraits`.

## 7. 되돌리기

- 이 커밋 하나를 되돌리면 된다(`git revert <이 커밋>`): 게임 WebP 셋이 10/23 임시 그림으로, `TEMP_PORTRAIT_IDS` 가 셋으로 돌아가고 `art/hero-profiles-20261024/` · 새 도구 · 기록 · 공지가 빠진다. 저장 형식 · 의존 라이브러리 변경은 없다.
- 그림만 임시로 되돌리려면: `src/portraits.js` 의 `GUEST_IDS` 셋을 `TEMP_IDS` 로 옮기고, 이 커밋 앞 판의 WebP 셋을 꺼내 놓는다(`git checkout <이 커밋>~1 -- public/ui/portraits/<id>.webp`). 옛 임시 마스터 `art/portraits-temp-20261023/<id>.png` 를 768² · 같은 값으로 줄여도 옛 WebP 와 같은 바이트다(10/24 확인). 이때 `tools/ui/portraits_px_build.py` 의 `HERO_IDS` 에서도 빼야 다시 돌릴 때 확정본으로 덮지 않는다.
- 베르나르도 하나만 임시 그림으로: 위와 같이 `bernardo` 만 옮기고 그 WebP 하나만.
