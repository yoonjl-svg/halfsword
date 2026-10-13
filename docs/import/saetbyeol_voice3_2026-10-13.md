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
