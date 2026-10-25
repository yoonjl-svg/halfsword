# 비기 소리 들여오기 · 연결 (10/25 — 샛별 저장소 2fa0b2ae · 남김말 MSG-S-015 답신)

> 사장님 10/25 18:0x: "샛별이 비기 소리 보낸 거 입혀"
> 우리가 14:1x 에 보낸 소리 요청(MSG-S-015 — `docs/devmeet/notes/2026-10-25-uhwa.md`)에 샛별 저장소가 답한 것 — **G1 · G2 두 소리**와 연결표 · 출처 · 다시 만드는 코드 — 을 들이고, 비기가 **실제로 터진 순간 한 번** 나게 이었다.
> 병합 · 체리픽 없이 필요한 파일만 받은 바이트 그대로 꺼내 우리 경로에 두었다(전달 README 의 가지 이름 · 청취 페이지 주소는 옮기지 않음). 연결 · 음량 · 시험 · 기록은 우리 것.

## 0. 한눈에

| 항목 | 결과 |
|---|---|
| 받은 곳 | 샛별 저장소 `2fa0b2ae`(우리 `069104fa` 위에서 만든 커밋 하나) — 읽기 전용 사본에서 읽기만 함 |
| 연결표 | **일본 · 이탈리아 · 동방 → g1-clank(0.34 s) · 이베리아 · 독일 → g2-dry(0.32 s)** — 사장님 10/25 결정(샛별 저장소 쪽에서 들으시고 고르심). 공통 S1 소리 · 고노센 발도음 덧대기 없음(G1 이 그 자체로 칼 뽑는 철컹) |
| 언제 | 비기가 터진 순간 = **낸 전투자의 터뜨림 수가 오른 때**(결정타 화면 늦춤과 같은 수 — 그 화면 안) · 사람 · AI 같음 · 한 비기에 한 번 · 낸 사람 유파의 파일 |
| 안 나는 때 | 창이 열림('!' · 비기 꼬리표) · 고노센 / 길목 / 싱지르 준비 · 누르기 창 · 못 냄 · 낸 스텝에 실행이 못 걸림 · 여러 타격 비기의 다음 칼 · 비기 아닌 고유 동작 잔상 · 새 판 시작(묵은 수) · 끈 판 |
| 음량 | 이벤트 음량 **1.0**(`SOUND.secretSfxGain` — 사장님 10/25 18:4x '음량 1.0으로') · **g1 · g2 크기 맞춤**(`SOUND.secretSfxTrimDb` — g2 +3.3 dB · 받은 MP3 바이트는 그대로) · 쇳소리 묶음 · 재생 빠르기 1 — 둘 다 뒤따르는 센 맞음보다 약 2.8 dB 작게(§5) · 1.0 · 맞춤 = **사장님 10/25 결정** · +3.3 dB 값 = 사장님 확인 전 |
| 스위치 | `?secretSfx=0` = 끔(녹음도 안 받음) · `SOUND.secretSfx` |
| 들인 파일 | 게임: `public/sfx/secret/g1-clank.mp3` · `g2-dry.mp3` · `LICENSE.txt`(받은 그대로) / 기록: `docs/import/secret_audio_20261025/`(README 두 군데만 지움 · WAV 원본 `masters/` · 원료 · 증거 · 코드) |
| 안 들인 것 | OGG 둘(게임은 MP3 만 읽음 · `prepare.py` 로 다시 만듦) · 받은 `mapping.json` 은 게임 경로에 두지 않음(기록 폴더에 원본 — 게임 연결표는 `src/config.js`) |
| 판 | fights12 `f3bd3ce2` · live_battery `67a000a7` · finish_thrust `90812518` · weapon_smoke 32 OK · corr_s0 12 IDENTICAL **그대로**(싸움 셈 변경 없음) |
| 공지 | 없음 |

## 1. 받은 것 · 둔 곳

| 받은 파일 (샛별 저장소 2fa0b2ae) | 우리 파일 | 어떻게 |
|---|---|---|
| `public/sfx/secret/g1-clank.mp3` | 같은 경로 | 바이트 그대로 — 5,516 B · sha256 `46c496a05a1b9e4d…`(받은 measurements 와 같음) · MPEG-1 Layer III 48 kHz 모노 |
| `public/sfx/secret/g2-dry.mp3` | 같은 경로 | 바이트 그대로 — 5,084 B · `f82fb61b07b41b22…` |
| `public/sfx/secret/LICENSE.txt` | 같은 경로 | 바이트 그대로(받은 출처 글 — 고치지 않음) · `2e7e36c5f107dbcc…` |
| `public/sfx/secret/g1-clank.wav` · `g2-dry.wav` | `docs/import/secret_audio_20261025/masters/` | 바이트 그대로(WAV 24 bit 원본 49,062 · 46,182 B) — 게임이 읽지 않아 `public/` 밖에 둠(앱 묶음 · 오프라인 받기에 안 실림) |
| `public/sfx/secret/g1-clank.ogg` · `g2-dry.ogg` | — | 안 들임(게임은 `sfx/<이름>.mp3` 만 읽음 — `src/sound.js` decodeSample) |
| `public/sfx/secret/mapping.json` | `docs/import/secret_audio_20261025/mapping.json` | 바이트 그대로 · 기록으로만(게임이 읽지 않는 연결표 · OGG / WAV 경로가 들어 있음) |
| `docs/import/secret_audio_20261025/README.md` | 같은 경로 | 받은 글 그대로 + 머리말 세 줄 · **가지 이름 · 청취 페이지 주소 두 군데만 지움** |
| 같은 폴더 `measurements.json` · `validation.json` · `versions.json` · `build.log` · `prepare.py` · `sources/`(원료 셋 · `evidence.json` · `oga-readme.txt`) | 같은 경로 | 바이트 그대로 — 원료 해시 = `evidence.json` |

- 크기: 게임 쪽 3 파일 약 12 KB · 기록 폴더 약 470 KB(원료 318 KB · WAV 95 KB).
- `public/sfx/LICENSE.txt` 에 `secret/` 절을 더함(원료 셋 · CC0 1.0 · 자세한 출처는 `secret/LICENSE.txt`).

## 2. 출처 · 사용 허가

- 원료 셋 모두 **CC0 1.0**(저작자 표시 의무 없음 · 기록으로 남김): SamsterBirdies 'Sword draw unsheathe'(freesound 581594 · HQ 미리듣기) · hushless 'Sword Unsheath'(freesound 772113 · HQ 미리듣기) · Vehicle / Jan Schupke 'Fantasy Weapons and Apparel SFX Library'(OpenGameArt · `seax-unsheathe-02.wav` — 꾸러미의 CC0 readme 보존).
- 손질(샛별 저장소): 자르기 · 모노 평균 · 거르기 · 시간 줄임 · 겹치기 · 들어감 / 나감 — 48 kHz 모노 · WAV 최고 −8 dBFS. G1 은 칼집에서 빠르게 뽑는 철컹 + 쇠 마찰(120 ms 뒤 꼬리를 줄여 에너지 99 % 가 약 179 ms 안) · G2 는 울림을 줄인 마른 판(약 226 ms). 역사 속 일본도 발도 소리를 되살렸다고 하지 않음.
- 다시 만들기: `docs/import/secret_audio_20261025/` 에서 `python prepare.py`(Python 3 · NumPy · SciPy · FFmpeg — 원료가 들어 있어 망 없이). OGG 는 Ogg 흐름 번호 · CRC 만 달라지고 소리는 같다(`validation.json`).

## 3. 언제 나나 — 걸쇠 `src/secret_sfx.js` · 자리 `src/main.js` frame()

화면마다 그 화면의 물리 스텝이 끝난 뒤 `secretSfx.tick()` 을 부른다. 보는 수는 결정타 화면 늦춤과 같은 터뜨림 수(`ai.secretBursts` · `player.skill.secretBursts`)이나, 걸쇠는 합이 아니라 **사람 · AI 수를 따로** 보므로 누가 냈는지 알고, 낸 전투자의 유파(`fighter.swordArt.tradition`)로 파일을 고른다. 판마다(`newRound`) 새로 만들며 그때의 수가 바탕이다. 소리는 수가 오른 그 화면 안에 난다 — 사람 입력으로 낸 비기는 그 화면(화면 늦춤도 그 화면), 물리 스텝 안에서 낸 비기(AI · 동방 미리 받기)는 그 화면 끝(화면 늦춤은 다음 화면 머리 — 한 화면 ≈ 17 ms 앞섬). 물리 스텝 뒤라 그 스텝 끝 실행 결과까지 보고 거른다(사람 입력 비기가 그 화면에 물리 스텝이 하나도 없으면 결과 전에 낸다 — 드묾).

| 유파 | 비기 | 파일 | 사람 — 수가 오르는 곳 (`player.skill.secretBursts`) | AI — 수가 오르는 곳 (`ai.secretBursts`) |
|---|---|---|---|---|
| 일본 | 고노센 (발도) | g1-clank | `skill.js secret` — 발도를 거는 순간(`requestIai`) · 창에서 낸 입력 | `ai.js secretGo` 순간 베기 칸(`requestIai`) — `secretScan`(상대 사건) |
| 이탈리아 | 안다레 리솔루토 (런지) | g1-clank | `skill.js secret` 리솔루토 — 런지를 거는 순간(`requestCombo` · `startLunge`) | AI 에게 닫힘(`SECRET.aiOpenSchools`) |
| 동방 | 격살 | g1-clank | `skill.js secret` 막기 연환 빠른 판 — 두 수를 거는 순간(`requestCombo`) · 서보 판(`?cnFast=0`)은 첫 칼 길을 열 때 한 번(`secretStrikeStart` · `run.burst`) | AI 에게 닫힘 |
| 이베리아 | 싱지르 (휘감아 돌기) | g2-dry | `skill.js secret` 회전 — 대본을 거는 순간(`requestSpin`) | `ai.js spinGo`(spinTick — 무장 뒤 상대가 들어올 때) |
| 독일 | 모르트슐라크 | g2-dry | `skill.js secret` 죽음의 일격 — 운동학 길을 거는 순간(`requestCombo` · `SECRET.mord.kin` 0.3) · kin 0 판은 칼 길을 열 때(`secretStrikeStart`) | `ai.js mordGo`(mordTick — 누르기 1.5 s → 창 → 머리가 닿을 때) |

- **이베리아 · 독일 AI 두 번 막기**: `spinGo` · `mordGo` 는 몸의 검술 층 `skill.secret` 을 불러 `enemy.skill.secretBursts` 도 오르고 AI 실행부 `ai.secretBursts` 도 오른다. 걸쇠는 AI 쪽은 **`ai.secretBursts` 하나만** 본다(화면 늦춤 합과 같은 수) → 한 번. 시험이 두 수가 다 1 오른 것과 소리 1 을 함께 본다.
- 옛 판 비기(`?deMord=0` · `?cnSecret=v1` · `?itSecret=contratempo` · 이베리아 옛 판)도 같은 수를 거치므로 같은 규칙(유파 파일 한 번).
- 사람 · AI 가 같은 화면에 내면 각자 자기 유파 파일로 한 번씩.

## 4. 받은 README 의 주의 — 코드에서 하나씩 확인

| 주의 (받은 README) | 우리 연결 | 시험 (`tools/sim/secret_sfx.test.mjs`) |
|---|---|---|
| 유파 선택에 `secretBurstsSeen` 합만 쓰지 말 것 · 발동한 전투자를 식별 | 사람 · AI 수를 따로 · 그 전투자 `swordArt.tradition` | 걸쇠 셈(같은 화면 둘 → 독일 g2 · 일본 g1) |
| 한 비기당 한 번 · 여러 타격 중복 0 | 수는 한 비기에 한 번 오른다(곧장 터지는 비기는 낼 때 · 칼 길을 여는 비기는 `run.burst` / `secretRun.burst` 걸쇠) · 한 화면에 수가 둘 올라도 한 번 | 사람 다섯 · AI 셋 모두 비기가 끝나고 1 s 뒤까지 정확히 1 · 서보 연환(두 수) 1 |
| 이베리아 AI 는 `skill.secret` 과 AI 실행부를 모두 지남 | AI 는 `ai.secretBursts` 만 | AI 싱지르: 검술 층 +1 · AI 실행부 +1 · 소리 1 |
| `instantArc` 에는 비기 아닌 고유 동작 잔상도 | 잔상은 보지 않음 | 잔상 id 만 바뀌면 0 |
| 준비 `!` / `secretReady` / 준비자세가 아닌 실제 발동 | 창 · 준비는 수를 올리지 않음 | 사람 고노센 준비 · 싱지르 무장 창 4 s 동안 0 → 창에서 내면 1 · AI 싱지르 무장 동안 0 · AI 모르트슐라크 누르기 · 창 동안 0 |
| 실패 0 | 못 냄(`secret()` · `secretGo()` false)은 수가 안 오름 · 낸 스텝 끝 실행이 못 걸리면(`instantResult.ok` false — 쓰러짐 · 칼 놓침) 수는 올라도(화면 늦춤은 전과 같음) 소리 없음 | 탈진 · 서 있지 않음 0 · 낸 뒤 칼을 놓친 발도 0 · AI 쉬는 중 0 |
| 슬로모와 별개로 `playbackRate=1` | 녹음 한 겹 빠르기 1 · 소리 시계는 실제 시간 | 사람 다섯 모두 빠르기 1 |
| 음소거 · 일시정지 · 새 판 카운터 초기화 · 잔여 재생 | 음소거 = 소리 꺼짐이면 안 냄 · 전체 음량은 master 를 거침 · 일시정지(메뉴 · 멈춤 화면 — `sound.setPaused`)와 새 판(`sound.resetRound`)에 울리던 비기 소리를 줄여 끔 · 판마다 새 걸쇠(지금 수가 바탕) | 음소거 0 · 끈 판 0 · 녹음이 아직 없으면 0 · 일시정지에 줄여 끔(끝난 소리는 그대로) · 묵은 수 0 |
| 뒤따르는 타격음과 최종 음량 | §5 — 음량 1.0 · g2 +3.3 dB 맞춤(사장님 10/25 18:4x) | 음량 = `SOUND.secretSfxGain` 1 · 녹음 한 겹 = 맞춤 dB · 쇳소리 묶음 · 맞춘 뒤 크기 차 0.1 dB 안 · 키운 최고가 리미터 아래 |

## 5. 음량 · 묶음 (`src/sound.js` secretSfx · `src/config.js` SOUND)

- **묶음**: 쇳소리 묶음(`metalBus` — 칼 부딪힘 · 채찍 딱과 같음) → 전체 음량 → 리미터. 무대 울림(성 · 대성당 · 홀)은 다른 쇳소리와 같은 몫으로 붙는다. 우선 2.5 — 칼 부딪힘(1 ~ 2) · 베기(2)가 몰려도 먼저 끊기지 않게(흘림 3 보다 낮게).
- **크기 견줌** — EBU R128 순간 크기(BS.1770 K 가중 · 400 ms 창 최고, LUFS): 녹음은 받은 MP3 를 48 kHz 로 풀어서, 합성 맞음 소리는 게임과 같은 조각(`makeBankSound` · 씨앗 다섯 평균)으로 재고 게임이 곱하는 이벤트 음량 · 녹음 한 겹 음량을 더함(전체 음량 0.8 은 모두 같아 뺌):

| 소리 | 조각 | × 이벤트 · 한 겹 음량 | 게임 속 | 비기 g1 · g2 와 차 |
|---|---:|---:|---:|---:|
| 센 베기 B2(140 J 넘음 · `drawnHeavy`) | −12.6 | (0.45 + 0.6) × 0.526 = 0.55 (−5.2 dB) | **−17.8** | 비기가 **2.8 dB 작음** |
| 센 베기 B2(112 J — B2 경계) | −12.6 | 0.50 (−6.0 dB) | −18.6 | 비기가 1.9 dB 작음 |
| 센 찌르기(`slashStab` · 140 J 넘음) | −18.2 | 1.05 (+0.4 dB) | **−17.7** | 비기가 **2.8 dB 작음** |
| 약한 베기 A2(70 J · `drawnCut`) | −14.3 | 0.42 (−7.6 dB) | −21.9 | 비기가 1.3 dB 큼 |
| 센 칼 부딪힘(`clashHard`) | −21.2 | 1.0 | −21.2 | 비기가 0.6 dB 큼 |
| **비기 g1-clank** | −20.53 | **1.0** · 맞춤 0 dB | **−20.53** | — |
| **비기 g2-dry** | −23.79 | **1.0** · 맞춤 **+3.3 dB** (× 1.46) | **−20.49** | g1 과 0.04 dB |

- **음량 1.0 · 크기 맞춤 (사장님 10/25 18:4x "음량 1.0으로 하고 g1과 g2 소리 크기 맞춰")**: 이벤트 음량 0.8 → **1.0**(`SOUND.secretSfxGain`) · 파일마다 녹음 한 겹 음량 `SOUND.secretSfxTrimDb` = g1 **0 dB** · g2 **+3.3 dB**(받은 MP3 바이트는 그대로 — 소리 카드에서 곱함). 둘 다 뒤따르는 센 맞음(비기 칼은 대개 센 맞음 — 140 J 넘음)보다 **약 2.8 dB 작고**(전 판 0.8 · 맞춤 없음: g1 약 4.7 dB · g2 약 8.0 dB), B2 경계(112 J) 맞음보다 약 1.9 dB 작다. g1 꼬리는 120 ms 뒤 줄어 99 % 가 179 ms 안이고, 화면이 0.4 배로 늦는 동안 맞음은 실제 시간으로 더 늦게 와서 겹침이 적다.
- **최고점 · 리미터**: g1 −7.9 dBTP(받은 measurements 4 배 오버샘플) × 1.0 × 전체 0.8 → 약 **−9.9 dBTP** · g2 −8.0 + 3.3 = −4.7 → 약 **−6.6 dBTP** — 리미터(컴프레서 문턱 −6 dB · 무릎은 문턱 위) 아래 약 0.6 dB · 그 뒤 부드러운 깎개(±2 입력까지 둥글게)보다 한참 아래라 깎임 없음. 뒤따르는 맞음 소리와 겹치는 순간은 다른 큰 소리 겹침처럼 리미터가 잠깐 누를 수 있다.
- **창 길이에 따라**: 400 ms 창(EBU 순간 — 맞춘 기준)으로는 같으나, g1 은 들어가는 소리가 더 날카로워 짧은 창으로 재면 아직 g1 이 크다(100 ms 창 g1 −14.9 · g2 −20.5 + 3.3 = −17.2 → 차 2.3 dB · 맞추기 전 5.6). g2 를 짧은 창 기준(+5.6 dB)으로 키우면 최고 약 −4.3 dBTP 로 리미터를 넘는다 — 400 ms 기준으로 둠(§7).
- 판 속 소리를 사람 귀 · 폰으로는 못 들어 봄. 빌드판 머리 없는 크롬(폰 가로 · 손가락으로 시작 · 성 무대 · `?skillNodes=all`)에서 연결만 봄: 녹음 둘이 읽힘 · 사람 고노센 → `g1-clank`(0.339 s) 한 번 · 사람 싱지르 → `g2-dry`(0.32 s) 한 번 · 빠르기 1 · 이벤트 음량(첫 판 0.8 · 18:4x 뒤 다시 봄: 이벤트 음량 1.0 · g1 한 겹 1 · g2 한 겹 1.462 = +3.3 dB) · `?secretSfx=0` 이면 녹음을 안 받음 · 콘솔 오류 0(PWA 단계를 안 돌린 빌드라 `sw.js` 없음은 뺌).

## 6. 시험 · 판

- `node --test tools/sim/secret_sfx.test.mjs` — 16 개: 사람 다섯(파일 · 묶음 · 음량 1 · 파일 크기 맞춤 · 빠르기 1 · 한 번) · g1 · g2 크기 맞춤(맞춘 뒤 차 0.1 dB 안 · 키운 최고 −6.5 dBTP 아래) · 서보 연환 한 번 · 사람 준비 0 · 못 냄 · 실행 실패 0 · AI 고노센(저절로 낸 것 포함 낸 수 = 소리 수) · AI 싱지르 · AI 모르트슐라크 · 걸쇠 셈 · 연결표 / 스위치 / 음소거 / 녹음 받기 · 일시정지 · 파일 해시 / 머리 / 출처.
- 모든 시험 `node --test tools/sim/*.test.mjs` **392 / 392**(18:4x 뒤) · `node tools/text/name_policy.mjs` 위반 0 · `npx vite build` OK.
- 판 해시 그대로: fights12 `f3bd3ce2` · live_battery `67a000a7` · finish_thrust `90812518` · weapon_smoke 32 OK · corr_s0 12 IDENTICAL(싸움 셈은 바뀌지 않음 — 걸쇠는 수를 읽기만).

## 7. 사장님께

- **답 받음 (10/25 18:4x)**: "음량 1.0으로 하고 g1과 g2 소리 크기 맞춰" → 음량 1.0 · g2 +3.3 dB(위 §5 · 확인표 2543). 맞춘다 = 사장님 결정 · +3.3 dB 값은 사장님 확인 전(폰으로 들어 보시고).
1. g1 은 들어가는 소리가 더 날카로워 400 ms 기준으로 맞춘 뒤에도 '탁' 하는 첫머리는 g1 이 조금 더 또렷할 수 있음(100 ms 창 차 2.3 dB) — 더 맞추려면 g1 을 내리는 쪽(g2 를 더 키우면 리미터에 닿음).
2. 모르트슐라크 AI 는 '낸 순간', 사람도 지금 판(운동학 kin 0.3)은 '낸 순간' — 같음. 옛 서보 판(kin 0)으로 돌리면 사람은 칼을 들어 올린 뒤 칼 길을 열 때 난다(화면 늦춤과 같은 수).
