# 샛별 가져오기 — 목소리 갱신 3차 (2026-10-13)

가지: `…/sb-voice3-2q36ha` (main 890157f 에서). 2 등급 작업. 병합은 디렉터가 한다.
사장님 지시로 가져옴. 샛별 쪽은 읽기만 했다. 커밋 sha 로만 적는다.

## 0. 원문

사장님 지시 (10/13 20:0x):

> 샛별이 진행한 사운드 업데이트 전체를 가져와서 적용해.

| 대상 | 가져올 변경 |
|---|---|
| 마야 | 이졸데와 분리한 독립 사운드셋. 이후 수정된 한 호흡 출혈 1·2, 피격1 교체, 출혈2 음색 미세조정까지 포함 |
| 이졸데·미나미 | 기존 목소리는 유지하면서 부족했던 기절·출혈 변주 보충 |
| 투야나·아르토리아 | 피격과 기절 분리, 기절·출혈 사이 중복 제거. 말소리 같던 출혈2를 날숨으로 교체한 최종본 |
| 마르그레테 슈바르츠 | 부족한 변주 보충. 기절1·출혈1 중복 제거, 기합 같던 기절2 교체, 출혈2를 잦아드는 소리로 교체 |
| 랴오 | 공유 세트의 기절·출혈 변주 보충. 거부했던 옛 출혈2는 제외 |
| 오마리 | 기존 단축본을 유지하면서 기절·출혈 두 번째 변주 보충 |
| 토메·김씨 | 공유하는 기절1의 날카로운 톤과 가공 질감 수정. `tome_ko1_clean` 이 최종본 |

샛별 쪽 말 (사장님 전달, 20:1x):

> 상대 캐릭터는 피격2·기절2·출혈2, 피격과 기절은 서로 다른 녹음입니다. 플레이어는 예외입니다. 기존 조용한 사망음 한 개와 이명을 유지합니다. 추가했던 player_exhale2는 사용하지 않습니다. 브란·하인리히·광기의 하인리히는 기존 세트를 유지합니다. 음원뿐 아니라 캐릭터 배정, src/sound.js의 최종 파일 연결과 부분 다운로드 재시도 수정, 음원 출처·라이선스도 함께 가져와야 합니다. 중간에 폐기한 파일을 다시 배정하면 안 됩니다.

## 1. 그쪽 sha → 우리 커밋

기준은 그쪽 main 머리(2579bc9)의 최종 상태다. 중간 판은 옮기지 않았다.
우리 커밋: **8aa3852** (음원·배정·재시도·듣기 화면·LICENSE). 이 기록은 그 다음 커밋.

| 그쪽 sha | 무엇 | 우리 |
|---|---|---|
| 3f330f7 | 마야 독립 묶음 · 전 인물 2/2/2 · 부분 다운로드 재시도 · 번호 버튼 | 'maya' 묶음 · 각 묶음 보충 · 재시도 고침 · `voices.html` 번호 버튼 |
| 87c8e77 | 플레이어 조용한 사망음 하나로 되돌림 · 슈바르츠·투야나 기절2/출혈2 교체 | 플레이어는 우리 것과 같아 바뀐 것 없음. 교체본만 옮김 |
| b728e34 | 슈바르츠 기절1 분리 · 투야나 출혈2 날숨으로 | `reitanna_gasp` 배정 · `tuyana_bleed2_breath` |
| b75013b | 마야 출혈 한 호흡 · 피격1 교체 | `maya_bleed1_single` · `maya_hurt1_single` |
| 7b6b079 | 토메 기절1 톤 (`tome_ko1_warm`) | 9d1b56a 로 대체돼 안 옮김 |
| 9d1b56a | 마야 출혈2 가볍게 · 토메 기절1 다듬기 | `maya_bleed2_light` · `tome_ko1_clean` |
| 587425d · 0e7eb9e · f9a42e0 · 8023ae9 · 64f76e0 · 2579bc9 | 발행 기록만 | 가져올 것 없음 |

## 2. 인물별 전 / 후

전 = main 890157f. 후 = 8aa3852. 파일 이름은 `public/sfx/voice/` 아래. **굵게** = 새 파일.

| 인물 (id) | 묶음 | 피격 | 기절 | 출혈 |
|---|---|---|---|---|
| 마야 (samira) 전 | isolde | isolde_hurt1·2 | isolde_ko1 | isolde_bleed1 |
| 마야 후 | **maya** | **maya_hurt1_single** · **maya_hurt2** | **maya_ko1** · **maya_ko2** | **maya_bleed1_single** · **maya_bleed2_light** |
| 투야나 (eira)·아르토리아 전 | soft_female | reitanna_gasp | reitanna_gasp | reitanna_long_sigh |
| 투야나·아르토리아 후 | soft_female | **tuyana_hurt1** · **tuyana_hurt2** | reitanna_gasp · **tuyana_ko2_exhale** | reitanna_long_sigh · **tuyana_bleed2_breath** |
| 이졸데·미나미 전 | isolde | isolde_hurt1·2 | isolde_ko1 | isolde_bleed1 |
| 이졸데·미나미 후 | isolde | isolde_hurt1·2 | isolde_ko1 · isolde_revive1 | isolde_bleed1 · isolde_ko1 |
| 슈바르츠 (margarethe) 전 | margarethe | margarethe_hurt1 | margarethe_ko1 (= 출혈1 과 같은 바이트) | margarethe_bleed1 |
| 슈바르츠 후 | margarethe | margarethe_hurt1 · **margarethe_hurt2** | reitanna_gasp · **margarethe_ko2_exhale** | margarethe_bleed1 · **margarethe_bleed2_fade** |
| 랴오 전 | liao | liao_hurt1·2 | liao_ko1 | liao_bleed1 |
| 랴오 후 | liao | liao_hurt1·2 | liao_ko1 · **liao_ko2** | liao_bleed1 · **liao_bleed3** |
| 오마리 전 | omari | omari_hurt1·2 | omari_ko1_short | omari_bleed1_short2 |
| 오마리 후 | omari | omari_hurt1·2 | omari_ko1_short · **omari_ko2** | omari_bleed1_short2 · **omari_bleed2** |
| 토메·김씨 (renji) 전 | tome | generic_hurt1·2 | generic_ko1 · generic_ko2 | generic_bleed1·2 |
| 토메·김씨 후 | tome | generic_hurt1·2 | **tome_ko1_clean** · generic_ko2 | generic_bleed1·2 |
| 플레이어 | player | player_hurt1·2 | player_exhale | player_exhale |
| 브란 · 하인리히 · 광기의 하인리히 | bran · heinrich | 그대로 (각 2) | 그대로 | 그대로 |

- 플레이어: 바뀐 것 없음. 조용한 사망음 하나 + 이명. `player_exhale2` 는 들이지 않았다.
- 기본 상대(generic)의 `generic_ko1` 은 그대로다. 토메 묶음만 `tome_ko1_clean` 을 쓴다.
- 이졸데·미나미의 기절1 과 출혈2 는 같은 파일(`isolde_ko1`)이다. 기절2 는 부활 숨(`isolde_revive1`)과 같은 파일이다. 그쪽 최종본 그대로다(그쪽 기록도 '이졸데의 교차 공유는 없애지 않았다'고 적음).
- 슈바르츠 기절1 `reitanna_gasp` 는 투야나와 같은 녹음이다. 슈바르츠 안의 기절·출혈 네 녹음은 서로 다르다.
- `src/sound.js` 의 묶음 배정은 그쪽 main 머리와 같다 (maya · soft_female · tome · omari · player · generic · bran · isolde · liao · heinrich · margarethe).
- 인물 배정: `src/characters.js` 의 마야(samira) `voice` 를 'isolde' → 'maya'. 나머지 인물의 묶음 이름은 그대로다.

## 3. 부분 다운로드 재시도

그쪽 3f330f7 고침의 뜻대로 옮겼다 (`Sound.loadVoiceSamples`).

- 전: 목록에 하나라도 있으면 건너뛰었다. 둘 중 하나만 받으면 다시 받지 않았다.
- 후: 받은 수가 파일 수와 같을 때만 건너뛴다. 모자라면 그 목록을 비우고 다시 받는다.
- 확인: 듣기 화면에서 `maya_hurt2` 첫 요청만 503 으로 막았다. 첫 클릭은 실패 안내. 두 번째 클릭에 `maya_hurt1_single`·`maya_hurt2` 를 다시 받아 재생했다 (200).

## 4. 듣기 화면

`voices.html` · `src/voicelab.js`.

- 버튼을 '피격 1 · 기절 1 · 출혈 1 / 피격 2 · 기절 2 · 출혈 2' 번호로 나눴다. 한 번에 녹음 하나를 고정해 듣는다(그쪽 3f330f7 방식).
- 받은 수가 모자라면 번호가 어긋나므로 재생하지 않고 안내한다.
- 마야는 '이전(isolde) / 새 배정(maya)' 을 견준다. 10/13 에 바뀐 다른 인물은 '지금 목소리' 의 번호 버튼으로 듣는다.
- 인물 목록은 그대로 우리 `characters.js` 에서 읽는다. 그쪽 `public/voice-casting.json` 은 들이지 않았다.

## 5. 들이지 않은 것과 까닭

| 파일 | 까닭 |
|---|---|
| maya_hurt1 · maya_bleed1 · maya_bleed2 | 그쪽 b75013b 에서 한 호흡 조각으로 대체. 그쪽 LICENSE 에 '이력용, 배정 안 함' |
| maya_bleed2_single | 그쪽 9d1b56a 에서 `maya_bleed2_light` 로 대체. 이력용 |
| margarethe_ko2 · margarethe_bleed2 (SkyRae) | 그쪽 87c8e77 에서 사용자가 거부(기합 같음·올라가는 톤) |
| tuyana_bleed2_fade | 그쪽 b728e34 에서 '말소리 같다'고 거부 |
| tome_ko1_warm | 그쪽 9d1b56a 에서 `tome_ko1_clean` 으로 대체 |
| player_exhale2 | 샛별 쪽 말대로 쓰지 않음 (그쪽 87c8e77) |
| omari_ko1 · omari_bleed1 · omari_bleed1_short | 10/12 때부터 안 들인 중간 파일 |

음원 밖에서 들이지 않은 것:
- `public/voice-casting.json`: 우리는 `characters.js` 에서 바로 읽는다.
- 그쪽 자산·검사·발행 json 과 검사 스크립트: 출처·구간·해시는 `public/sfx/LICENSE.txt` 로 옮겼다. 시험은 우리 관문과 브라우저 확인으로 대신했다.
- 은발의 검사(silver_wanderer)·세르파: 우리에 없는 인물이다. 목소리 일과 무관하다.

우리 쪽에 이미 있던 `margarethe_ko1.mp3`·`liao_bleed2.mp3` 는 디스크에 남기고 배정하지 않는다.

## 6. 라이선스

새 음원 18 개. 그쪽 main 의 git blob id 와 우리 파일의 blob id 가 모두 같다. 그쪽 자산 기록의 SHA-256 과도 모두 같다. 파일마다 SHA-256 은 `public/sfx/LICENSE.txt` 의 '2026-10-13 voice update' 칸에 적었다.
'사용자 제공' 으로 적힌 파일은 이번에 없다. 라이선스가 분명하지 않아 뺀 파일도 없다.

| 파일 | 원작자 · 원본 | 라이선스 |
|---|---|---|
| maya_hurt1_single · maya_hurt2 · maya_ko1 · maya_ko2 · maya_bleed1_single · maya_bleed2_light | AuraVoice (올린 이 Nocturnal_Vanguard), "Female Hurt Grunts & Groans" (OpenGameArt) | CC0 1.0 |
| tuyana_hurt1 · tuyana_hurt2 · tuyana_ko2_exhale · margarethe_ko2_exhale | Cici Fyre, "RPG Voice Starter Pack" (OpenGameArt) | CC0 1.0 |
| tuyana_bleed2_breath | Reitanna, "deep sigh and exhale.wav" (Freesound 351160) | CC0 1.0 |
| margarethe_bleed2_fade | Reitanna, "long sigh.wav" (Freesound 242690) | CC0 1.0 |
| margarethe_hurt2 | SkyRae, "Female Warrior Grunts" / "Grunts HD Deep.mp3" (OpenGameArt) | **CC-BY 3.0** (저작자 표기·변경 사실을 LICENSE.txt 에 적음) |
| liao_ko2 · liao_bleed3 · tome_ko1_clean | HaelDB, "Male Grunt/Yelling sounds" (OpenGameArt) | CC0 1.0 |
| omari_ko2 · omari_bleed2 | thebardofblasphemy, "grunts of male death and pain" (OpenGameArt) | CC0 1.0 |

## 7. 확인

- 듣기 화면(내 개발 서버 5297, 390×844): 인물 카드 13 개. 10/13 에 바뀐 인물 10 명과 플레이어의 번호 버튼 64 개를 모두 눌렀다. 실패 0. 목소리 파일 43 개를 받았다 (모두 200). 폐기 파일 요청 0. 콘솔 에러 0.
- 실제 게임 한 판 (`/?test=1&weapon=longsword&hero=player&foe=samira&stage=cathedral`): 마야 6 개 + 플레이어 3 개를 받았다. 받은 수 maya 2/2/2, player 피격 2·기절 1·출혈 1. 콘솔 에러 0.
- 같은 방식으로 투야나(eira) 한 판: soft_female 6 개 + 플레이어 3 개. 콘솔 에러 0.
- 소리는 귀로 듣지 못했다. 받기와 배정만 확인했다. 인물과 어울리는지는 사람이 들어 봐야 한다.

## 8. 관문

명령마다 'deprecated parameters' 줄을 뺀 sha256 앞 8 자리. 모두 그대로다.

| 명령 | 값 |
|---|---|
| `node tools/sim/fights12.mjs` | d5a4d113 |
| `node tools/sim/live_battery.mjs` | e7ee3d96 |
| `node tools/sim/finish_thrust.mjs 1 --stand` | 433ac984 |
| `node tools/sim/corr_s0.mjs --limits=on,off --scenes=a,b` | IDENTICAL 12/12 |
| `node tools/sim/weapon_smoke.mjs` | ' OK ' 21 줄 |
| `npx vite build` | rc 0 (빌드 안 목소리 파일 62 개) |
| `node tools/text/name_policy.mjs` | rc 0 |

## 9. 열린 질문

1. 이졸데·미나미는 기절1 = 출혈2(`isolde_ko1`), 기절2 = 부활 숨(`isolde_revive1`) 이다. 그쪽 최종본대로 두었다. 이 둘도 나눌지.
2. 슈바르츠 피격2 는 CC-BY 3.0 이라 저작자 표기가 필요하다. 지금은 `sfx/LICENSE.txt` (듣기 화면에서 링크)에만 있다. 게임 안 크레딧이 따로 필요한지.

## 10. 기절2·출혈2 분리 (10/13, `…/isolde-voice2-2q36ha`)

샛별 요청(사장님 전달): 이졸데·미나미의 기절2(= `isolde_revive1`)·출혈2(= `isolde_ko1`)를 같은 녹음의 안 쓴, 서로 다른 연기 구간으로 바꾼다. 9절 열린 질문 1 의 답.

**결과: 새 연기는 하나뿐이었다.** 기절2 만 `isolde_ko2` 로 바꿨다. 출혈2 는 지금처럼 `isolde_ko1` 이다 (억지로 만들지 않았다).

```js
ko: ['voice/isolde_ko1', 'voice/isolde_ko2'],      // 전: isolde_ko1 · isolde_revive1
bleed: ['voice/isolde_bleed1', 'voice/isolde_ko1'], // 그대로
```

- 피격 2개 · 기절1 · 출혈1 · 부활음(`isolde_revive1`)은 그대로. `hurt: 2 · revive: 1 · gain: 1.3` 그대로. 기존 파일은 덮어쓰거나 지우지 않았다.
- 미나미(`characters.js` minami 의 `voice: 'isolde'`)와 이졸데(voice 칸 없음 → id 'isolde', `main.js` 의 `ch.voice || ch.variantOf || ch.id`)가 같은 묶음을 쓴다. 인물 배정은 바꾸지 않았다.

### 원본

샛별이 확보해 사장님이 올린 mvVoiceActing "girl damage" (Freesound 855460) 전체 공개 HQ MP3 미리듣기, CC0 1.0. sha256 `ce834bc7…ef7c` 를 다시 확인했다. 원본 WAV 가 아니다. 한 번 PCM(32 bit float)으로 풀어 그 PCM 에서만 편집했다.

### 판정 방법과 숫자

모노 합(L+R)/2, 70 Hz 하이패스 뒤 30 ms 창 · 10 ms 간격. 바닥 잡음 = 10 ms RMS 의 5 번째 백분위 **−73.6 dBFS**. f0 = 정규화 자기상관(120–700 Hz), 주기성 0.5 넘는 칸만 유성으로 셌다. 스펙트럼 중심과 4 kHz 위 비중을 함께 봤다. 원본 L/R 상관은 모든 연기에서 0.99–1.00 (사실상 모노).

| 구간 (s) | 바닥 +10 dB 넘는 길이 | 최대 (바닥 위) | 유성 비율 | f0 시작/중간/끝 (Hz) | 중심 (Hz) | 판정 |
|---|---|---|---|---|---|---|
| 0.00–0.40 | 0 ms | +3.8 dB | – | – | – | 바닥 잡음 |
| 1.30–1.90 | 0 ms | +3.8 dB | – | – | – | 바닥 잡음 |
| 2.70–3.30 | 0 ms | +7.4 dB (3.00–3.02, 20 ms) | – | – | 350–400 | 숨 아님 — 4 kHz 위 0.02–0.03, 바닥과 같은 성격 |
| 4.40–5.50 | 0 ms | +4.6 dB | – | – | – | 바닥 잡음 |
| **5.59–5.71** | **100 ms** | **+31.3 dB** (peak −33.2 dBFS) | **0.60** (주기성 최대 0.74) | **334 / 326 / 277** (최고 349) | **898** | **새 연기: 짧게 떨어지는 유성 "읏"** |
| 5.85–6.55 | 0 ms | +6.3 dB (6.43–6.48, 50 ms) | – | – | 490–690 | 숨 아님 — 4 kHz 위 0.04–0.06, 부활 "흡" 0.1 s 앞 바닥 요동 |
| 7.02–7.80 | 0 ms | +4.8 dB | – | – | – | 바닥 잡음 |
| 8.90–끝 | 0 ms | +4.7 dB | – | – | – | 바닥 잡음 (샛별 메모와 같음) |

이미 쓴 연기 (견줌):

| 파일 | 활동 길이 | 유성 | f0 시작/중간/끝 | 중심 |
|---|---|---|---|---|
| 피격1 | 460 ms | 0.11 | 143 / 211 / 200 | 1959 |
| 피격2 | 410 ms | 0.41 | 185 / 320 / 165 | 1179 |
| 기절1 | 490 ms (두 마디) | 0.41 | 302 / 369 / 255 | 913 |
| 부활1 | 240 ms | 0.38 | 313 / 374 / 315 | 996 |
| 출혈1 | 560 ms | 0.79 | 224 / 208 / 342 | 431 |

- 5.59–5.71 조각이 다른 연기의 복사인지: 원본 전체와 정규화 상호상관, 소리 있는 자리에서 자기 자리 밖 최대 |r| = 0.38 (2.16 s). 복사가 아니다. 길이·f0 곡선도 어느 연기와도 다르다.
- 5.6 s 조각을 **기절** 자리에 넣은 까닭: `Sound.death()` 는 '기절'·'머리' 에 짧게 뚝 끊기는 소리, '출혈'·'목' 에 숨이 잦아드는 긴 소리를 쓴다. 이 조각은 0.1 s 로 짧고 음이 떨어지며 끊긴다. f0(277–350 Hz)·중심(898 Hz)도 기절1(255–416 Hz, 913 Hz)에 가깝고, 출혈1(낮은 208 Hz 중심 431 Hz, 560 ms 의 긴 신음)과는 멀다.
- 출혈 연기로 쓸 만한 새 구간은 없다. 다른 틈은 모두 바닥 +10 dB 를 한 칸도 넘지 않는다.

### 손질 (기존 편집본에 맞춤)

기존 편집본 다섯 개를 원본 PCM 에 맞대어(상호상관) 손질을 거꾸로 읽었다: 시작점은 LICENSE 구간 시작과 정확히 같다(피격은 0.60 s 만 씀), 모노, 70 Hz 하이패스, 피크 −1 dBFS 정규화(이득 +23.4 ~ +36.4 dB), 페이드 인 약 5 ms, 페이드 아웃 약 80–90 ms(출혈1 약 140 ms, 부활1 약 50 ms), 44.1 kHz 모노 MP3 70–81 kbps.

`isolde_ko2.mp3`: 원본 **5.54–5.94 s** (0.40 s, 소리는 5.59–5.71, 끝 꼬리 5.77 까지). PCM 에서 (L+R)/2 → 70 Hz 하이패스(ffmpeg `highpass`) → 페이드 인 5 ms · 아웃 80 ms → 표본 피크 −1 dBFS (+32.21 dB) → 마지막에 한 번만 libmp3lame VBR q4 모노 인코딩. 음높이·길이 손대지 않음. 4,972 bytes, 0.444 s(MP3 틀), MP3 뒤 peak −0.5 dBFS · 평균 −19.3 dB (기절1 −23.1, 부활1 −18.0). 앞 0.04 s 바닥 RMS −38.6 dBFS (부활1 앞 −39.1 과 비슷).
sha256 `97f52164ca22b0989be61ed2c526af5d09d4c8744c0c81c0f7f568e711c7b37f`.

설치한 것: apt `ffmpeg` 6.1.1 (`apt-get update` 뒤 `--no-install-recommends`), pip `numpy` 2.4.6 · `scipy` 1.17.1. 분석 스크립트는 저장소 밖 임시 폴더에 두었다.

### 바뀐 파일

- `public/sfx/voice/isolde_ko2.mp3` (새 파일)
- `src/sound.js` — isolde 프로필 `ko` 둘째 참조만, 주석
- `public/sfx/LICENSE.txt` — isolde_ko2 줄(구간·필터·페이드·sha256), 묶음 설명
- `src/voicelab.js` — 이졸데·미나미 줄 메모 (파일 목록은 `VOICES` 에서 읽으므로 따로 없음)

### 확인

- 듣기 화면(내 개발 서버 5391, 390×844, 헤드리스): 이졸데·미나미 기절 1·2 · 출혈 1·2 여덟 버튼 모두 재생 상태. `isolde_ko1·ko2·bleed1·hurt1·hurt2·revive1` 모두 200, 400 이상 0, 콘솔 에러 0. 게임 한 판(`foe=minami`)은 헤드리스에서 목소리 받기가 일어나지 않아 듣기 화면으로 대신했다.
- 소리는 귀로 듣지 못했다. 숫자로만 판정했다.
- 관문 ('deprecated parameters' 줄을 뺀 sha256 앞 8 자리, main 과 같음): fights12 d5a4d113 · live_battery e7ee3d96 · finish_thrust 1 --stand 433ac984 · corr_s0 IDENTICAL 12/12 · weapon_smoke ' OK ' 21 줄 · `npx vite build` rc 0 (빌드 안 목소리 파일 63 개 = 62 + isolde_ko2) · name_policy 위반 0.

### 남은 것

1. 출혈2 는 아직 기절1 과 같은 파일(`isolde_ko1`)이다. 이 녹음에는 더 쓸 연기가 없다. 나누려면 같은 배우의 다른 녹음이나 다른 출처가 필요하다 — 사람이 정할 일.
2. `isolde_ko2` 는 소리가 0.12 s 로 매우 짧고, 원본이 작아 +32 dB 올렸다. 끊기는 느낌·잡음이 괜찮은지 사람이 들어 봐야 한다.
