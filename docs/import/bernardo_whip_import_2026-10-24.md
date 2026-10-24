# 베르나르도 새 옷 프로필 · 채찍 섬네일 · 채찍 맞음 소리 들여오기 (10/24 — 샛별 저장소 100a5971 · 537a7bd8 · 3912e1ec)

> 사장님 10/24 14:3x: "샛별이 보낸 메시지 확인하고 적용해 (신규 캐릭터 사운드 제안은 무시해)"
> 샛별 저장소가 오늘 보낸 메시지 넷 가운데 남은 둘 — **베르나르도 프로필 복식 수정본** · **채찍 최종(섬네일 · 소리)** — 을 들였다. 앞의 둘(손님 인물 셋 프로필 0aef88d4 → 우리 01695c0 · 뒤랑달 c039bcc7)은 이미 들어와 있다.
> 병합 · 체리픽 없이 필요한 파일만 받은 바이트 그대로 꺼내 우리 경로에 두고, manifest · 연결 · 시험 · 기록은 우리 것으로 썼다(전달본 인계서에는 저장소 주소 · 가지 이름이 있어 옮기지 않음).

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 받은 곳 | 샛별 저장소 `100a5971`(베르나르도) · `537a7bd8`(채찍 섬네일) · `3912e1ec`(C2 소리 · 기록) — 셋 다 우리 본판 커밋(323ad40 · c264512) 위에서 만든 것. 읽기 전용 사본에서 읽기만 함 |
| A 베르나르도 | 그림 3 장 · `sprites.json` 바이트 그대로 · 우리 manifest 에 `revision` · 게임 WebP 는 `low.png` 에서 **우리 도구로 다시 만듦 → 전달본 WebP 와 바이트 같음**(`4c58ad9e…` · 30,322 B) |
| B-1 섬네일 | 처음 만든 넓은 원형 그림(1안) — 256² WebP `a649b44e…` 바이트 그대로 `public/ui/weapons/druid_whip.webp` · 1254² 원본 PNG `art/druid-whip-thumb-20261024/` · 다시 찍기 도구 예외 옮김 |
| B-2 소리 | C2 = SciFiSounds 'Whip Crack'(freesound 529925 · **CC0 1.0**) → `public/sfx/whip/lash1.mp3`(딱 부분 0.30 s) = 채찍 **살 · 옷 맞음 소리 기본** · 옛 소리 `?whipHit=old` · 끝 '딱'과 두 번 터지지 않게 막음 |
| 안 들인 것 | 캐릭터 음성 점검 정정 · `voice-audit-*` · `voice-proposal-historical.json`(사장님 '신규 캐릭터 사운드 제안은 무시') · 용 특별전 설계 제안(우리에게 온 메시지 아님) · 전달본 인계서 · 검사 결과 · 화면 사진 · 마스크 등(§4) |
| 인물 목소리 | 그대로 — 롤랑 'bran' · 백린의 전사 'omari' · 베르나르도 'liao'(사장님 10/24 13:0x · 13:1x) |
| 공지 | 없음(사장님 — 오늘 공지 더 없음) |

## 1. A — 베르나르도 프로필 복식 수정본 (샛별 저장소 100a5971)

샛별 저장소 쪽에서 사장님이 승인한 그림("good. 우화에게 보내.")이다. **흰 금테 겉옷 · 금관 쓴 검은 사자 · 금빛 망토** — 지금 모델 v2 와 같은 옷. 얼굴 · 머리 · 수염 · 눈끝 두 칸 · 액자 · 자르기는 처음 받은 그림 그대로.

| 받은 파일 | 우리 파일 | 어떻게 |
|---|---|---|
| `art/hero-profiles-20261024/bernardo/{original,low,grid}.png` | 같은 경로 | 바이트 그대로 (1254² RGBA · 22 × 22 칸 · 칸 50 px · 시작 (77, 77)) |
| `art/hero-profiles-20261024/sprites.json` | 같은 경로 | 바이트 그대로 — 바뀐 것은 `black_king`(우리 베르나르도) 칸 자료뿐 · 롤랑(`sebastian`) · 백린 칸 자료는 바이트 같음 |
| `art/hero-profiles-20261024/manifest.json` | 같은 경로 | **우리가 고침** — sprites · 베르나르도 그림 · 게임 WebP 해시, 베르나르도 `note`, `revision`(출처 `100a5971` · 바뀐 것 · 사장님 말씀 · 전 판 v1 해시와 출처 `0aef88d4`). `source.commit` 은 처음 묶음 그대로 |
| `public/ui/portraits/bernardo.webp` | 같은 경로 | **우리 도구로 다시 만듦**(아래) — 전달본 파일은 견주기만 |

- 바뀐 칸(우리가 칸 자료로 다시 셈): **82 칸 · 모두 12 ~ 21 줄(옷)**. 얼굴 칸 (10, 6) ~ (17, 14) · 위 12 줄(머리 · 얼굴 · 수염) · 눈끝 두 칸 (13, 7) · (16, 8) `#4F3829` 는 그대로. 팔레트 40 → 102 색.
- 게임 WebP: `python3 -I tools/ui/portraits_px_build.py`(1254² `low.png` → 768² LANCZOS · WebP 손실 95 · 투명도 100 · method 6 — 다른 35 장과 같은 값) → **sha256 `4c58ad9e84293dd2…` · 30,322 B = 전달본 WebP 와 바이트 같음**(Pillow 12.3 · libwebp 1.6). 다시 돌려도 다른 35 장은 바이트 그대로(이번에 바뀐 WebP 는 베르나르도 하나). 전 판 29,648 B.
- 우리 검사 도구 `python3 -I tools/ui/hero_profiles_verify.py` 통과(파일 14 개 해시 · 다시 그리기 · 액자 · 눈끝 · WebP = `low.png` 변환). 코드 · 도구는 그대로 — `src/portraits.js` 주석만 고침.
- **지금 모델 v2 와**: 옷이 같아졌다(가슴 흰 겉옷 · 검은 사자 · 그림 왼쪽 어깨의 금빛 망토). 남은 차이는 머리 쪽 — 그림은 처음 받은 얼굴 그대로(풍성한 수염 · 머리띠 없음), 모델 v2 는 반으로 다듬은 수염 · 가는 금 머리띠(시험 — 확인표 2325). 22 × 22 칸에서는 작게만 보인다. 확인표 2331 고침 · 2440.
- 그림: `docs/handoff/bernardo_whip_2026-10-24/before_after_bernardo.webp`(왼쪽 전 판 v1 · 오른쪽 새 판 — 게임 WebP 를 쓰는 곳 바탕 위에) · `lobby_bernardo.webp` · `defeat_bernardo.webp`.

## 2. B-1 — 채찍 섬네일 = 처음 만든 넓은 원형 그림 (샛별 저장소 537a7bd8)

| 받은 파일 | 우리 파일 | 어떻게 |
|---|---|---|
| `art/weapons/druid_whip_coiled_20261024/original.png` | `art/druid-whip-thumb-20261024/original.png` | 바이트 그대로 (1254² RGBA · 보관용) |
| `art/weapons/druid_whip_coiled_20261024/game.webp` | `art/druid-whip-thumb-20261024/game.webp` | 바이트 그대로 (256² — 게임 파일의 마스터) |
| `public/ui/weapons/druid_whip.webp` | 같은 경로 | 바이트 그대로 — sha256 `a649b44ed7eaba6c…` = 메시지의 승인 해시 |
| `tools/browser/weapon_thumbs.mjs` 의 채찍 예외 | 같은 파일 | **우리 말로 옮김**(우리 도구가 받은 쪽 앞 판과 바이트 같았음): 표 `KEEP = { druid_whip: art/…/game.webp }` — 모델로 다시 찍지 않고 마스터를 복사 |

- 우리 `art/` 폴더 꼴(`<이름>-<날짜>/`)에 맞춰 `art/druid-whip-thumb-20261024/` 로 두고 `manifest.json`(출처 · 해시 · 쓰는 곳 · 전 판 해시)을 썼다.
- 쓰는 곳은 그대로 하나의 경로 — 카드 뽑기 앞면 · 대기실 아이템 칸 · 시험 경로가 모두 `ui/weapons/druid_whip.webp`. 코드 변경 없음.
- 크기 23,270 B — 다른 무기 썸네일(약 3 KB · 모델 사진)보다 크다(손그림 · 승인 바이트 그대로 둠). 2안(촘촘 감김) · 3안(8 자)은 고르지 않은 시안이라 들이지 않았다.
- 그림: `inventory_whip.webp`(대기실 아이템 칸 · 채찍 설명 카드) · `card_whip.webp`(카드 뽑기 앞면).

## 3. B-2 — 채찍 살 · 옷 맞음 소리 = C2 (샛별 저장소 3912e1ec)

### 3-1. 받은 것 · 손질
- 사장님이 고른 C2 = **SciFiSounds 'Whip Crack'**(freesound 529925 · **CC0 1.0** — 저작자 표시 의무 없음 · 기록으로 남김). 받은 파일: 사장님이 들은 단발 `C2-approved-single.mp3`(0.534 s · 모노 · 최고 −6 dBFS · sha256 `ebff24d3…`)와 사이트 HQ 미리듣기 `C2-hq-preview.mp3`(스테레오 · `5273b706…`). 올린 원본 M4A 는 없다.
- 둘은 같은 소리다(미리듣기를 모노로 하면 단발과 어긋남 0 표본 · 상관 0.99). 손질은 한 단계라도 덜 거친 **HQ 미리듣기**에서 했다.
- 이 녹음은 **휘두르는 바람 소리(0.05 ~ 0.17 s) 뒤에 딱(0.212 s)** 이 오는 꼴이다. 맞은 순간에 그대로 틀면 딱이 0.2 s 늦게 나고 바람 소리가 맞은 뒤에 나므로, **딱 부분만** 잘랐다(휘두르는 '휙'은 게임이 따로 낸다).
- 손질은 다른 채찍 녹음과 같은 규칙: 왼 · 오른 평균 모노 44.1 kHz → 0.210 s 부터 0.300 s → 80 Hz 고역 · 12 kHz 저역 통과 → 들어감 1 ms · 나감 80 ms → 최고 −1 dBFS(+3.0 dB) → MP3(LAME VBR q4). 음높이 · 빠르기 · 합성 겹 변경 없음.
- 결과 `public/sfx/whip/lash1.mp3` — 3,914 B · sha256 `deeeb2d8ce671525…` · 딱이 파일 2 ms 에 있다(옛 Thwack 3 ~ 12 ms 와 같은 꼴). 자른 자리 · 이득 · 해시는 `public/sfx/whip/provenance.json` `lash1` · 출처 · CC0 는 `public/sfx/LICENSE.txt` whip/ 절.

### 3-2. 언제 · 얼마나 크게 (`src/sound.js` whip · `src/config.js` SOUND)
- **언제**: 전과 같다 — 채찍이 판정을 낸 맞음(`main.js` onWound → `sound.whip('hit', J, 갑옷)`) · 5 J 아래는 소리 없음 · 투구 · 판금은 Kenney 'impactPlate_light' 그대로 · 흙 몸은 마른 타격음 그대로. 살 · 옷이면 `whipLash`(C2) 를 낸다.
- **얼마나 크게**: event 음량은 전과 같은 눈금(칼 둔타와 같음 — 0.12 + 0.95 (J/120)^0.8 · 몸 소리 묶음) · 녹음 한 겹 `SOUND.whipLashGain` **1**(다른 채찍 녹음과 같이 파일 최고 −1 dBFS 그대로) · 빠르기 0.94 ~ 1.06 흔듦 그대로.
- 소리 크기 견줌(BS.1770 K 가중 · 400 ms 창 가장 큰 값): C2 딱 −16.5 LUFS · 옛 Thwack 셋 −24.9 / −21.6 / −24.6(평균 −23.4) · 끝 딱 셋 −21.0 / −20.4 / −18.5 · 휙 −20.5 / −18.0. 같은 J 에서 **C2 맞음은 옛 소리보다 약 7 dB 크다.**
  - 쓸만한가 봇 판 기준(아래 §3-3) 맞음 J 가운데 12 ~ 13(event 음량 0.27 ~ 0.28) · 획 칼끝 최고 빠르기 가운데 15 ~ 18 m/s(끝 딱 event 음량 0.43 ~ 0.54): 흔한 맞음의 C2 는 흔한 끝 딱보다 약 1 ~ 2 dB 작다(옛 Thwack 은 약 8 ~ 9 dB 작아 휙 · 딱에 묻혔다). 옛 소리와 같은 크기를 원하시면 `whipLashGain` 0.45(−7 dB).

### 3-3. 끝 '딱'과 겹침 — 잰 값과 막는 규칙
C2 는 그 자체가 '딱'이라, 맞아서 덩굴 끝이 꺾일 때 나는 끝 '딱'(`whipTipStep` — 최고 빠르기에서 15 % 꺾이면)이나 한 획에 여러 마디가 닿는 맞음과 붙으면 한 맞음이 두세 번 터진다.
- 잰 값(`node tools/sim/whip_duel.mjs --weapons=druid_whip:k --seeds=1-3 --dur=40 --sound` — 사람처럼 쓰는 봇 · 인물 여섯 × 셋 · 게임과 같은 걸쇠를 화면마다 · `--stand=contact` 도): 살 · 옷 맞음 178 / 186 번 가운데 맞은 뒤 0.3 s 안에 끝 딱 21 / 24 % · 맞기 전 0.3 s 안에 끝 딱 27 / 23 % · 앞뒤 0.3 s 에 딱 없음 52 / 53 %. 앞 맞음에서 0.25 s 안에 다시 맞음 43 % / 38 %(한 획의 여러 마디).
- 규칙(`src/whip_sound.js` whipCrackGate · 소리 시계 기준):
  1. C2 맞음 뒤 **0.2 s**(`SOUND.whipLashGap` — C2 딱이 들리는 길이) 안의 끝 딱 · 다른 C2 맞음은 내지 않는다(같은 맞음).
  2. 끝 딱 뒤 **0.06 s**(`SOUND.whipFlam` — 화면 약 네 장) 안의 C2 맞음은 내지 않는다(거의 같은 때 — 이미 난 딱이 맞음 소리를 대신). 그보다 늦으면 '공중 딱 + 맞음 짝' 둘 다 낸다(다른 일).
  3. 투구 · 판금 맞음 · 휙 · 칼에 부딪힘은 막지 않는다.
- 같은 봇 판에 규칙을 돌리면(판 시계 · 멈칫 시간은 셈 밖): C2 맞음 낸 108 · 막힌 70 / 낸 118 · 막힌 68 — 끝 딱 낸 279 · 막힌 21 / 낸 234 · 막힌 21.
- 판 시계가 아니라 소리 시계로 재므로 맞음 멈칫(최대 0.1 s) 뒤에 나는 끝 딱도 0.2 s 안이면 막힌다.

### 3-4. 옛 소리 · 바꾼 코드
- 옛 파일 `whip/hit1 ~ 3.mp3`(Thwack)는 그대로 두었다. **`?whipHit=old`** = 10/23 판 그대로(Thwack · 음량 1 · 겹침 막기 없음). 그 밖의 값 · 없음 = C2.
- `src/whip_sound.js`(새): 휙 · 딱 걸쇠 `whipTipStep`(main.js `whipWhoosh` 에서 옮김 — 값 · 셈 그대로) · 주소 스위치 `whipHitMode` · 겹침 막기 `whipCrackGate`. 게임 · 노드 도구 · 시험이 같은 셈을 쓴다.
- `src/sound.js`: SAMPLES `whipLash`(하나) · whip() 고르기 · 막기. `src/config.js` SOUND `whipHit` · `whipLashGain` · `whipLashGap` · `whipFlam`. `src/main.js`: 주소 스위치 한 줄 · whipWhoosh 가 whipTipStep 을 부름.
- 브라우저(빌드판) 연결 확인 — `tools/browser/bernardo_whip_shots.mjs` ④: 녹음 여섯 묶음 모두 읽힘(휙 4 · 딱 3 · Thwack 3 · C2 1 · 갑옷 3 · 칼 3 · C2 길이 0.30 s) · 기본 판 `whip('hit', 60)` → C2 · 바로 뒤 끝 딱 막힘 · 0.4 s 뒤 끝 딱 남 · `?whipHit=old` → Thwack · 끝 딱 막지 않음.
- **사람 귀 · 폰 스피커로 판 속 소리를 들어 보지는 못했다**(이 환경에 소리 출력 없음).

## 4. 안 들인 것 · 까닭

| 받은 것 | 까닭 |
|---|---|
| 채찍 메시지의 '캐릭터 음성 점검의 정정' 절 · `voice-audit-historical.json` · `voice-proposal-historical.json` · `voice-audit-current.json` / `.mjs` | 사장님 '신규 캐릭터 사운드 제안은 무시해'. 인물 `voice` 칸은 손대지 않음(롤랑 'bran' · 백린 'omari' · 베르나르도 'liao') |
| 용 특별전 설계 제안 | 우리에게 온 메시지가 아님 |
| 베르나르도: 인계서 · `cell-edits.json` · 단독 `sprite.json` · 보호 / 옷 마스크 · 비교 그림 · 검사 결과 JSON 셋 · 화면 PNG 둘 · 화면 도구 `browser.mjs` · 로그 | 내용은 이 기록에 우리 말로 · 검사는 우리 도구로 다시 · 바뀐 칸 수는 칸 자료로 다시 셈 |
| 채찍: 인계서 · `selection.json` · `verification.json` · `build.log` · 카드 사진 · CC0 근거 발췌 HTML · `C2-approved-single.mp3` · `C2-hq-preview.mp3`(원본 둘) | 출처 · 해시 · CC0 는 `public/sfx/LICENSE.txt` · `provenance.json` 에 · 게임에는 손질한 `lash1.mp3` 하나만 |
| 받은 쪽 `public/ui/portraits/bernardo.webp` | 우리 도구로 `low.png` 에서 다시 만듦(바이트가 같음을 확인만) |

## 5. 점검

- 단위 시험 `node --test tools/sim/*.test.mjs` 319 개 모두 통과 — 새 `tools/sim/whip_sound.test.mjs`(5: 걸쇠 값 그대로 · 주소 스위치 · 고르기 · 겹침 막기 · 파일 / 출처) · `tools/sim/portraits.test.mjs` 새 시험 1(베르나르도 수정본 출처 · 전 판 해시 · 얼굴 칸 · 롤랑 / 백린 칸 그대로) · `tools/sim/druid_whip.test.mjs` 새 시험 1(섬네일 해시 · 원본 1254² · 다시 찍기 예외).
- `python3 -I tools/ui/hero_profiles_verify.py` 통과 · `node tools/text/name_policy.mjs` 위반 0 · `npx vite build` 통과(묶음 크기 경고만).
- AI 끼리 판 해시 그대로(소리 · 그림만): fights12 `5c7ed36e` · live_battery `289eeb43` · finish_thrust 1 --stand `015fdd7c` · weapon_smoke 32 OK · corr_s0 12 IDENTICAL.
- 화면(폰 가로 844 × 390 · 배율 2 · 빌드판 + 설치 묶음 · WebP — `tools/browser/bernardo_whip_shots.mjs`) — PASS 6 · 콘솔 오류 0 · `docs/handoff/bernardo_whip_2026-10-24/`:
  - `lobby_bernardo.webp` — 대기실 프로필 칸(`?title=1&hero=bernardo` — 768²)
  - `defeat_bernardo.webp` — 베르나르도에게 진 패배 창(왼쪽 새 프로필 · 오른쪽 승리 대사 — 판 끝은 연결 확인용으로 강제)
  - `inventory_whip.webp` — 대기실 아이템 칸의 새 채찍 섬네일 · 설명 카드
  - `card_whip.webp` — 카드 뽑기의 채찍 카드 앞면
  - `before_after_bernardo.webp` — 베르나르도 게임 WebP 전 판(v1 옷) · 새 판

## 6. 바꾼 것

- 그림: `art/hero-profiles-20261024/bernardo/{original,low,grid}.png` · `sprites.json` · `manifest.json` · `public/ui/portraits/bernardo.webp` · `art/druid-whip-thumb-20261024/`(새 — 원본 · 게임 마스터 · manifest) · `public/ui/weapons/druid_whip.webp`.
- 소리: `public/sfx/whip/lash1.mp3`(새) · `provenance.json` · `public/sfx/LICENSE.txt`.
- 코드: `src/whip_sound.js`(새) · `src/sound.js` · `src/config.js` SOUND · `src/main.js`(주소 스위치 · 걸쇠 부름) · `src/portraits.js`(주석).
- 도구: `tools/browser/weapon_thumbs.mjs`(확정 그림 예외) · `tools/browser/bernardo_whip_shots.mjs`(새) · `tools/browser/druid_whip_shots.mjs`(소리 점검에 C2 묶음) · `tools/sim/whip_duel.mjs`(`--sound`).
- 시험: `tools/sim/whip_sound.test.mjs`(새) · `tools/sim/portraits.test.mjs` · `tools/sim/druid_whip.test.mjs`.
- 기록: 이 문서 · `docs/decisions.md` 10/24 14:3x · 확인표 2440 ~ 2445 · 2331 고침 · `docs/import/hero_profiles_import_2026-10-24.md` §4 · `docs/import/druid_whip_2026-10-23.md` §10 에 바뀜 표시.

## 7. 되돌리기

- 이 커밋 하나를 되돌리면 된다(`git revert <이 커밋>`) — 베르나르도 그림 · 칸 자료 · manifest · 게임 WebP 가 v1 옷으로, 채찍 섬네일이 모델 사진으로, 맞음 소리가 Thwack 으로 돌아간다. 저장 형식 · 의존 라이브러리 변경 없음.
- 소리만: 주소 `?whipHit=old`(코드 그대로) 또는 `src/config.js` `SOUND.whipHit: 'old'`.
- 섬네일만: `git checkout <이 커밋>~1 -- public/ui/weapons/druid_whip.webp` 뒤 `tools/browser/weapon_thumbs.mjs` 의 `KEEP` 에서 채찍을 빼야 다시 찍을 때 확정 그림으로 덮지 않는다.
- 베르나르도만: manifest 의 `revision.previous` 해시가 전 판이다 — 그 커밋 앞 판의 그림 3 장 · `sprites.json` 을 꺼내고 `python3 -I tools/ui/portraits_px_build.py` 를 돌리면 옛 WebP(`1584f9d5…`)와 같은 바이트가 된다.
