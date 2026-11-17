# 스위치 걷어내기 (11/17)

사장님 11/17: "뭐 그렇게 매번 스위치를 만드냐 그거때문에 랙생기는 거 같이 스위치 투성이라" → "재지 말고 그냥 지워."
재지 않았다. 기본 판은 그대로 두고, 스위치와 그 스위치가 살려 두던 옛 길 · 시제품을 지웠다. 가지 `wk/switch-cleanup` (바탕 `1cc27e8e`).

## 1. 결과

| | 전 | 후 |
|---|---|---|
| 주소 인자 읽기 (main.js `params.get` · `has`) | 1 011 · 이름 464 | 20 · 이름 16 |
| 주소 인자 이름 (src 전체) | 488 | 27 (§2) |
| config.js 주석의 `?xxx=` 안내 (이름) | 431 | 5 (남긴 인자만) |
| 주소 인자가 덮던 config 칸 406 가운데 스위치 꼴(켬 · 끔 · 꼴 · 0/1) | 302 | 259 (43 지움) |
| config 참거짓 · 꼴 글 · null 칸 | 156 | 116 |
| src 줄 수 · 파일 | 102 231 · 254 | 100 756 · 253 (67 파일 +987 −2 465 — 주석만 고친 파일 포함) |
| config.js · main.js 줄 수 | 3 244 · 4 005 | 3 121 · 3 394 |
| tools/sim 파일 | 462 | 449 (13 지움) |
| 시험 (`node --test tools/sim/*.test.mjs`) | 1 091 / 1 091 | 955 / 955 (실패 0) |

관문은 바이트 같다 (§6). 같은 날 3차로 더 걷었다(§7). **스위치 걷어내기는 다 끝나지 않았다** — 지금 남은 것은 §9 끝.

## 2. 남긴 주소 인자

| 인자 | 까닭 |
|---|---|
| `weapon` · `foe` · `stage` · `hero` · `test` · `team` · `foeWhiff` | 시험 고르기 화면(test.html → `test_pick.js`)이 만드는 시작 주소 · 밤 만남 쪽(public/night-encounters*.html)의 대련 링크 · 목소리 듣기(voicelab)의 `?foe=` |
| `atkStick` | 공격 조이스틱 — 사장님이 기본값을 아직 안 정함 |
| `foeWeapon` · `look` · `cards` · `emo` · `slowMo` · `openSweep` · `skillNodes` · `uniqueStage` · `foeProficiency` · `fps` | 브라우저 도구(tools/browser) 수십 개가 판 · 장면을 여는 데 씀 (예: `emo` 41 · `slowMo` 35 · `skillNodes` 15 · `uniqueStage` 17 · `cards` 14). 판을 세울 때 읽는 값이라 도구를 다른 길로 바꾸려면 새 손잡이가 필요해서 그대로 둠 |
| `title` · `coins` · `heads` | 첫 화면 · 대기실 점검(journey_save.js · game_entry.js) — 도구 20 개 남짓 |
| `nosw` | 서비스 워커 비상 내리기(pwa.js) — 판 값이 아님 |
| `saengsaNow` | 생사전 시험판 시계(saengsa_clock.js · 생사전 브라우저 도구). 시험판 빌드 자체는 `VITE_SAENGSA_TEST` 로 켜짐 — 주소 인자 아님 |
| `horn` · `horns` · `shopAlter` · `shopSlot` | 상점 시험판(`VITE_SHOP_TEST` 빌드)에서만 읽는 시험 상태 |

시험 고르기 화면의 스위치 줄(이베리아 · 동방 · 독일 비기 판 · 이베리아 시험 · 이탈리아 걸음 · 유파 패시브 · 칠 때 알림)은 지웠다.

## 3. 지운 것

### 3-1. 주소 인자 · 화면 쪽

- main.js 판 덮어쓰기 묶음 통째(줄 94 ~ 716) · `lookv` · `back` · `madEyes` · `pixel`(픽셀 모드 실험) · 방랑 주소 스위치 셋 · `strikeCue` 와 그 꼴 인자 여섯
- 옛 카메라 따라가기(`camFollow=old`) · 손잡이 찍기 탭(`pommel=tap`) · 이베리아 자세표 v2 사람 몫
- 칠 때 알림 꼴: 테두리 · 둘 다 · 끔 · 상대 머리 · 띠 꼴 (느낌표 + 비기 금색 테두리만 남음 · screen_tint 셰이더도 그만큼)
- 채찍 맞음 옛 소리(`whipHit=old`) · 비기 소리 끔(`secretSfx=0`)
- 템포 · 옛 시간(`tempo` · `timeStd` · `TIME_STD`) — 템포 1.1 상수
- 폰 세로 배율 주소 손잡이 — 시뮬은 Input 생성 인자 `{ verticalGain: 1 }` 로 기준선 그대로
- 프로필 예비 판 `portrait=hd|low` · 칸 줄 `portraitGrid`
- 상점 시험판 `shopItems`
- config.js 의 주소 읽기 여섯(`montanteHand` · `itMeasure` · `flMeasure` · `edge` · `onetip` · `playerEdge`) — 환경 변수 읽기는 남음(§5)
- 주석 속 지운 인자 `?xxx=` 안내 약 550 곳

### 3-2. 스위치 (기본 판을 그 자리에 바로 적음)

- 기력: 켬 · 자연 탈진(옛 2.5 s 고정 탈진) · 공격 시계 묶음 일곱(attackTempo · tempoProfiles · tempoBody · tempoCaps · tempoInput · tempoGravity · tempoWristDamping)
- 티소나 위세: 막힘마다 깎던 10/21 판(aweDrain · aweGap · spendAweDrain)
- 몸: 받침 꼴(levitate) · 다리 근육 사람 값 · 사람 관절 한도 · R2′ 범위(player) · 일어서기 다리 차례
- 걸음: 유파 걸음 · 보폭 규칙 · 이탈리아 고른 걸음 · 독일 간격 잡기 · 파고들기 · 잡기 · 동방 가벼운 발(AI 포함) · 첫 걸음 박차기 · 옆 박차기 · 독일 박차기 · 앞뒤 뒷발 먼저 · 붙잡기 반사 꼴 · 기술 걸음 받기 · 걸음 사다리 판
- 밀치기: 켬 · 걸쇠(사람 · AI) · 맞밀기 · 묶임 공격 막음 · 칼자루만 · AI 규칙 끔 판(startAI null)
- 찌르기: 몸 반작용 꼴(legacy · full) · 약화 배율 물리 · 다 쓴 박힘 풀기
- 흘림: 옛 판정 · 위협 끝 · 받는 몸꼴 · 팔 늦춤 시험 꼴(hold · recover)
- 이베리아: 쳐내기 튕김 켬 · 흐름 켬 · 옛 흐름 읽기 · 사슬 · 풍차 베기 사슬 · 풍차 베기 위력 · 떨어뜨림 · 이어 돌리기 닿기 기다림 · 맞바꿈 · AI 몫(옛 AI 풍차 베기 특수 공격 지움)
- 채찍 꿇리기 AI 몫(늘 사람 채찍만)

### 3-3. 시제품 (기본 끔 · 안 들인 것 — 코드째 지움)

- R2′ 다리 사슬 탐색판(`BODY.chain 'legs'` · 척추 비틀기 감쇠 · 탐색판 HUD · `src/r2p_probe.js` · vite 탐색판 플러그인)
- R2′ 걸음 조율 채널 A · B(발 자리 추진 `pushAtFoot` · 다리 사슬 베기 걸음 `cutStep`)
- 비스듬히 앞 박차기(`burstFwdDeg` — 10/21 사장님 '그건 없애')
- 손잡이 찍기 모두에게(`CLOSE.pommelAll`)
- 이베리아 쳐내기 팔 늦춤(`IB_PARRY_ARM`)
- 휘두르는 동안 몸 돌림 묶기(`SWING_TURN`)
- 이베리아 날 세우기(`IB_EDGE`)
- 쉬는 날 방향 시험 다섯 칸(`EDGE_REST` pre · kick · fast · latch · tsw)
- 이어 돌리기 스위치 B — 사슬 셋째 칼에 곧장 무장(`IB_LINK.chainArm`)
- 이어 돌리기 식힘(`IB_LINK.cool`) · 넘기기 기다림(`IB_LINK.waitA`)

## 4. 시험

- 전 1 091 / 1 091 (실패 0) → 후 955 / 955 (실패 0). 줄어든 수는 아래 지운 블록(돌림 고리 안의 것은 여러 번 셈).
- 지운 시험 블록 134 (`test(` 156 지우고 22 는 제목 · 몸만 고쳐 다시 씀):
  - **옛 판으로 묶어 보던 시험 110** — 묶음 도구(`p_pin` · `react_old` · `arm_real_pin` · `secret_free_off` · `ai_kit_off` · `ai_read_pin` · `jp_tank_pin` · `pin_1116`)나 그 별칭(`withJpOld` · `oneFight` · `old1` · `was2` · `pinLodge0`)을 쓰던 시험. 옛 값으로 잰 장면이라 기본 판 기대값이 아님 — 도구와 함께 지움
  - **꺼 둔 판 · 옛 판 자체를 보던 시험 24** — 칠 때 알림 꼴 3 · 채찍 주소 1 · 프로필 예비 판 1 · TIME_STD=0 1 · 기력 끔 · 옛 탈진 5 · 위세 막힘 깎음 5 · 밀치기 걸쇠 기본값 1 · 밀치기 옛 판 1 · AI 규칙 끔으로 묶은 클린치 2 · 사슬 무장 스위치 B 1 · 풍차 베기 사슬 3
- 고친 시험(기대값은 그대로 · 꺼 둔 판 단언만 뺌): 기력 · 탈진 · 클린치 · 칠 때 알림 · 비기 소리 · 채찍 소리 · 프로필 · 표준 시간 · 걸음 사다리 · 독일 파고들기(옛 간격 잡기는 시뮬 몸으로) · 밀치기 · 찌르기 박힘 · 이베리아 흐름 · 이어 돌리기 · 팀 충돌 비트(사람 관절 한도 늘 켬) · 흘림 판 값 · 풍차 베기 흐름 무관(지운 칸 `FLOW_REDESIGN.on` · `threatEnd` · `ibStrike` · `windChain` 단언만 뺌)
- 지운 시뮬 도구(꺼 둔 판만 보던 것): `stamina_gates` · `stamina_contact_fixtures` · `cam_follow_probe` · `arm_clear2_pic` · `arm_odd_pic`
- 도중에 잡은 실수 하나: 2a 커밋에서 이베리아 막아 되찾기 조건이 `!!f?.swordArt?.tradition === 'iberian'` 로 바뀌어 늘 거짓이었음 — 2b 에서 고침(ib_block_regen 시험이 잡음 · 관문 다섯 판엔 닿지 않음)

## 5. 2차 끝에 남았던 것 (3차에서 일부 걷음 — 지금 남은 것은 §7-6)

- config 스위치 칸 약 260 이 아직 있다. 크게: SECRET(비기 — 고노센 · 발도 · 싱지르 · 모르트슐라크 · 리솔루토 · 격살 칸 100 남짓) · UNIQUE_ASSIST(겹치기 · 카바치오네 · 풍차 베기 · 셸하우 60 남짓 · `applyB4Old`) · SKILL(팔 사람 꼴 · 손가락 긋기 · 이탈리아 · 자세표) · JOINTS(날 세우기 꼴 · 손목 · 팔꿈치) · AI_PLAN · AI_KIT · AI_ARC · AI_TELL · IT_OUTBOX · PICKUP · THRUST · SCHOOL_PASSIVE · JP_TANK · IMPACT_FX · IB_LINK 켬 · 꼴(circle) · SKILL.corr(옛 보정 — corr_s0 관문이 이 둘을 견줌)
- schools.js · finish.js · vital_target.js · druid_whip.js · nagashi_redesign 바깥의 모듈 스위치(`setItalianStride` · `setJapaneseGait('old')` · `FINISH` · `VITAL` · `setWhipPreset`)와 시뮬 환경 변수(harness_m 의 FINISH_* · VITAL_* · config 의 MONTANTE_HAND · IT_MEASURE · FL_MEASURE · EDGE · ONETIP · PLAYER_EDGE · JOINTS)
- 브라우저 도구 60 남짓이 지운 주소 인자를 아직 주소에 적는다 — 게임이 읽지 않아 기본 판으로 돈다(견주던 도구는 두 판이 같게 나옴). 기계로 걷으면 견줌 짜임이 엉켜서(시도 뒤 되돌림) 도구마다 손봐야 함
- 시험 블록 안에서 스위치를 옛 값으로 바꿔 보던 곳 가운데 위 남은 스위치에 걸린 것들 — 그 스위치를 지울 때 같이

## 6. 관문

`node tools/sim/fights12.mjs | sha256sum` `b7ba0017` · live_battery `cd211727` · `finish_thrust 1 --stand` `ba9c958b` · `corr_s0 --limits=off,on` IDENTICAL 12 · weapon_smoke OK 34 / 34 · `npm run -s build` 됨 · `name_policy` 0 — 바탕 `1cc27e8e` 와 같다. 커밋마다 같은 관문을 돌림.
corr_s0 의 `--limits=off,on` 은 사람 관절 한도 스위치를 지운 뒤로 같은 판을 두 번 돈다(관문 명령 · 수는 그대로).

## 7. 3차 (같은 날 이어서 — `801e1a75` 부터)

감독 지시로 2단계를 이어 했다. 규칙은 같다(기본 판 그대로 · 다른 갈래 지움 · 안 들인 시제품 코드째 · 관문 바이트 같음).

### 7-1. 수 (630e57fb → 지금)

| | 전 | 후 |
|---|---|---|
| 주소 인자가 덮던 config 칸 406 가운데 스위치 꼴 | 302 중 259 남음 | 233 남음 (이번에 26 · 모두 69 지움) |
| config 참거짓 · 꼴 글 · null 칸 | 116 | 102 |
| config 참거짓 · 꼴 · null · 0/1 칸 (0/1 조율 수 섞임 — 어림) | 481 (바탕 559) | 427 |
| src 줄 수 · config.js 줄 수 | 100 756 · 3 121 | 100 337 · 3 030 |
| 시뮬 환경 변수 스위치 (src · harness) | MONTANTE_HAND · IT_MEASURE · FL_MEASURE · JOINTS · EDGE · ONETIP · PLAYER_EDGE · FINISH_* · VITAL* · PLATE_NECK · IT_RHYTHM | 0 |

### 7-2. 지운 것

- 기본값을 그 자리에 적음: IT_OUTBOX(켬 · AI 몫 · 걸어 들어옴 문턱 · 특수 공격 맞박자 · 리솔루토 칼 우위 · 칼 우위 빛) · THRUST(이탈리아 찌르기 · 런지 걸음 상한 · 몸 싣기 당김 · 몸 싣기 둘 다 · AI 몫 · 간격 줄 'full') · JP_TANK(스택 · AI · 빠르기 · 바위 몸 둘) · PICKUP(막기 단추 · AI) · AI_TELL(AI · 막기 단추) · SCHOOL_PASSIVE(모두 · 유파마다 켬 · 고노센 켄타이 · 인데스 칼 닿음) · AI_PLAN(켬 · 무 띠 · 읽기 넷 · 이베리아 흐름 몸 · 편섬 뛰어들기) · AI_PLAN_FREE · AI_PLAN_DE(굴림 몫 · 밀 마음) · AI_KIT · AI_ARC · IB_LINK(켬 · 넘기기 · 사슬 빠르기) · 몬탄테 쥠 'mid' · 플랑베르주 간격 'geo' · 한손 칼끝 'fix'
- 시제품 · 옛 판 코드째: 박자 찌르기(사람 · AI — 사장님 11/15 '되돌려') · 칼 우위 켜는 길 고르기(11/16 1안) · 칼 길 잡고 찌르기(bind) · 찌르기 재기 스위치(itDrop · itStep · itClashEnd · itAccel) · 이탈리아 간격 옛 줄 · 리솔루토 'contact' 판 · 받아 치기 고노센 C · 손목 치기 스택 예외 E · 막기 단추 낌새 붙잡기 · 줍기 저절로(auto) · 이어 돌리기 원 판 · 싱지르 원 긋기(꺼진 판) · B7 풍차 베기 글 판 · 몬탄테 쥠 옛 꼴 셋 · 플랑베르주 간격 다른 줄 둘 · 동방 · 일본 걸음 옛 판 손잡이(setChineseGait · setJapaneseGait · setJapanesePlayerWalk) · 시뮬 하네스 둘의 마무리 · 약한 자세 겨눔 환경 변수

### 7-3. 남긴 것과 까닭

- `SKILL.corr` — corr_s0 관문이 옛 보정과 v2 를 견준다
- `INPUT.atkStick` · 주소 인자 27 (§2 그대로)
- JOINTS `mode`(+ presets) · `edge` · `playerEdge` — 환경 변수 읽기만 걷고 값은 글자로 둠. 갈래를 지우려면 fighter.js 관절 · 날 세우기 길을 하나씩 걷어야 해 다음 일로
- 조율 수(0/1 이어도 배율인 칸 — 예 `SCHOOL_PASSIVE.german.aiK` · `JP_TANK.hit` · `AI_PLAN.read` 의 몫 수)

### 7-4. 시험

- 지운 시험 블록 31 (`test(` 52 지우고 21 은 제목 · 몸만 고쳐 다시 씀): 꺼 둔 판 · 옛 판으로 묶어 보던 것 — 박자 찌르기 · 칼 우위 길 · 리솔루토 칼 우위 끈 판 · 찌르기 재기 · 몸 싣기 끔 견줌 · 받아 치기 C · 막기 낌새 붙잡기 · 줍기 끔 · auto · 줍기 없는 판 · 유파 패시브 끔 · AI 플랜 · 읽기 끔 견줌 · 둥근 눈 끈 판 · 이어 돌리기 원 판 · 끈 판 · 그때 판 글(B7) 묶음 · 원 긋기 · 플랑베르주 다른 줄
- 고친 시험(기대값 그대로): 지운 칸 단언만 뺌 · 끈 판 견줌 줄만 뺌 · 견줌 바탕을 스위치 대신 배율 1 로(it_outbox 찌르기 0.8) · 줍기 시험은 단추 누름으로 · 간격 줄 시험은 찌르기 잣대 줄로
- 전체: 955 / 955 → 924 / 924 (실패 0)

### 7-5. 관문

커밋마다 같은 관문: fights12 `b7ba0017` · live `cd211727` · ft `ba9c958b` · corr 12 · smoke 34 / 34 · build 됨 · name_policy 0.

### 7-6. 남은 것

- config: SECRET(비기 — 100 칸 남짓) · UNIQUE_ASSIST(60 남짓 · `applyB4Old`) · SKILL(팔 사람 꼴 · 손가락 긋기 · 이탈리아 · 자세표 · 왕관 등 40 남짓 — corr 빼고) · JOINTS(관절 · 날 세우기 꼴) · CN_STEP · BIND · IMPACT_FX · SHOP · SAENGSA.playerProf.mode · SOUND.fleshHit · WANDER
- 모듈 스위치: finish.js `FINISH`(entry · mode · vital · plateNeck · lift · aim · track · cleave) · vital_target.js `VITAL`(aiCut · thrust · playerCut) · 이탈리아 걸음 손잡이 넷(setItalianStride · setItalianWalk · setItalianBackCap · setItalianRhythm) · druid_whip.js `setWhipPreset`(샛별 값 판) · guards.js `setIberianTable` · weapons.js `setGripTorque`
- 브라우저 도구: 182 개 가운데 65 개가 지운 주소 인자 99 가지를 아직 주소에 적는다(많은 것: camOpen 13 · pixel 4 · itRhythm 3 · tempo 3 · playerSecret 3). 게임은 읽지 않아 기본 판으로 돈다. 도구마다 견줌 짜임이 달라 손으로 고쳐야 해서 이번엔 목록만 — 아래 부록
- 시뮬 도구 가운데 지운 칸에 값을 넣는 것(ib_link · it_tone_measure · thrust_stuck · school_passive_duel · gonosen_play · jp_tank · ai_plan_measure 등) — 넣어도 읽는 데가 없어 기본 판으로 돈다

### 부록 — 지운 주소 인자를 아직 적는 브라우저 도구

- `atk_stick_shots.mjs` — `camOpen`
- `b4_shots.mjs` — `b4Old` · `camOpen` · `rdTajoAngle`
- `bernardo_whip_shots.mjs` — `whipHit`
- `build_smoke.mjs` — `motionLib` · `oneVersatile` · `pommel` · `schoolArt` · `schoolRest`
- `cavazione_probe.mjs` — `camOpen` · `cavHeld`
- `cn_combo_probe.mjs` — `cnBongdu` · `cnBuffer` · `cnFast`
- `cn_light_probe.mjs` — `cnLight`
- `corr_shots.mjs` — `corr` · `tip`
- `defeat_portrait_smoke.mjs` — `portrait` · `portraitGrid`
- `druid_whip_shots.mjs` — `whip`
- `duplieren_auto_probe.mjs` — `camOpen` · `dupAuto` · `dupBandMax` · `dupClashT` · `dupStackS`
- `duplieren_simple_shots.mjs` — `camOpen` · `dupOld` · `specialShare`
- `game_entry_smoke.mjs` — `stamina`
- `gonosen_crouch_shots.mjs` — `gnsCrouch`
- `gonosen_window_probe.mjs` — `camOpen` · `gnsCrouch`
- `hold_gap_probe.mjs` — `deHold`
- `iberian_flow_probe.mjs` — `ibSecret`
- `iberian_gilmok_probe.mjs` — `gilAim` · `ibSecret`
- `iberian_stick_shots.mjs` — `ibSettle`
- `it_downcut_shots.mjs` — `cutPronate`
- `it_even_probe.mjs` — `itGait` · `itRhythm` · `strideRule`
- `it_foot_probe.mjs` — `itRhythm`
- `it_rhythm_shots.mjs` — `itRhythm`
- `italian_opposition_probe.mjs` — `camOpen`
- `italian_thrust_shots.mjs` — `itThrust`
- `joint_shots.mjs` — `joints`
- `kote_pickup_shots.mjs` — `camOpen` · `pickup`
- `kron_shape_shots.mjs` — `kronShape`
- `legend_glow_measure.mjs` — `auraTune`
- `live_diag.mjs` — `chain` · `pixel`
- `longpress_probe.mjs` — `camOpen` · `holdPx` · `stickGuard`
- `mordschlag_selfclip_shots.mjs` — `mordAt` · `mordNoClip`
- `nagashi_live_shots.mjs` — `tempo`
- `pappenheimer_shots.mjs` — `alt` · `cy` · `dist` · `ids` · `mode` · `ppm`
- `parry_button_probe.mjs` — `parryAssist`
- `parry_combo_probe.mjs` — `bind` · `deSecret`
- `pistol_look.mjs` — `ids`
- `player_edge_shots.mjs` — `playerEdge`
- `redondo_gamecam_shots.mjs` — `camOpen` · `rdWind`
- `redondo_motion_shots.mjs` — `rdRelease` · `rdSteady` · `rdWind`
- `revive_shots.mjs` — `pixel`
- `risoluto_fx_shots.mjs` — `risoCam` · `risoStreak`
- `risoluto_lunge_shots.mjs` — `risoRecover`
- `risoluto_shots.mjs` — `risoBeat`
- `sb_import2_shots.mjs` — `finishMode`
- `school_parry_shots.mjs` — `kronShape`
- `shop_layout_shots.mjs` — `shopItems`
- `singir_circle_shots.mjs` — `ibUpright`
- `sluice_bear_shots.mjs` — `bearH` · `eye` · `ground` · `h` · `pixel` · `plinth` · `span` · `w` · `yaw`
- `stamina_recovery_smoke.mjs` — `tempo`
- `stamina_route_probe.mjs` — `stamina`
- `stamina_walking_smoke.mjs` — `tempo`
- `step_burst_probe.mjs` — `burstDe` · `stepBurst`
- `step_input_probe.mjs` — `camOpen` · `stepIn`
- `strike_cue_shots.mjs` — `playerSecret` · `strikeCue` · `uniqueAssist`
- `text_policy_shot.mjs` — `iai` · `playerSecret` · `secret`
- `title_account_smoke.mjs` — `type`
- `touch_stamina_probe.mjs` — `camOpen` · `strokeMin`
- `tsubame_path_probe.mjs` — `camOpen` · `tsuAim`
- `tsubame_shots.mjs` — `tsuAim` · `tsuRuler` · `tsuSnap`
- `unique_assist_shots.mjs` — `clears` · `pixel` · `playerSecret` · `uniqueAssist`
- `vital_shots.mjs` — `vital` · `vitalAi`
- `wander_resume_check.mjs` — `wanderResume`
- `weapon_thumbs.mjs` — `ids`
- `wrist_audit_shots.mjs` — `elbowSwivel` · `holdDepth` · `schielPath` · `swivelHuman` · `swivelThrust` · `thrustArm` · `wristGuard`

## 8. 4차 (a937427e 부터 — SECRET 묶음, 일부)

- SECRET 스위치 꼴 칸 159 → 54 (켬 · 끔 · 꼴 · 0/1 어림 — 남은 것엔 각도 · 배율 같은 조율 수가 섞임). src 100 337 → 99 841 줄 · config 3 030 → 2 776 줄.
- 지움: 켬 판 칸 59 (고노센 · 발도 · 칼집 · 리솔루토 · 연환 · 죽음의 일격 · 비기 기력 · 창 지킴 등 — 기본값을 그 자리에) · 끔 판 칸 19 코드째 (넘어 들어감 · 들어옴 창 · 들어옴 문 · 다 붙음 창 · 줄 덮음 · 거리 판단 리솔루토 · 칼 깊이 지킴 · 웅크림 등) · 꼴 칸 10 (이베리아 · 동방 · 독일 비기 판 · 이탈리아 비기 · 고노센 준비 'dist' · 길목 끝 · 피해 셈 · 스틱 · 거정세 순서 · 밀치기 누르기 옛 조건) · 옛 비기 정의 다섯 (이베리아 v4 · 흐름 · 길목 · 동방 v1 · 독일 막기 연환) · 죽음의 일격 칸 12 (거꾸로 쥠 판 · 쥠 바꿈 · 뒤 박차기 · 겨눔 · 세기 꼴 등 — 폼멜 찍기 하나로) · 알티바슈 칸 5 (옛 빠르기 판 · 무게 보정)
- 남김(다음 일): SECRET 의 싱지르 ibSpin 묶음 · 격살 꼴(armPath · power · auto) · gkFree · iaiKinematic · 발도 길 각도 칸. 그리고 'spin' 판에서만 쓰던 정수리 가르기 특수 공격 · 거꾸로 쥠 코드가 아직 src 에 남음(읽는 길이 없어짐 — 지울 일)
- 시험: 'spin' 판 · 옛 비기 판 · 끈 판으로 묶어 보던 시험 블록을 지움(파일 하나 b4_rework.test.mjs 통째). 기본 판 기대값은 그대로. 비기 정의의 글자 열쇠(fast 'cnFast' · lead 'japaneseLead')가 지운 칸을 가리켜 동방 빠른 연환이 꺼지던 것을 잡아 값으로 바꿈
- 관문 바이트 같음(커밋마다)

## 9. 5차 (272e5a12 부터 — 작업자 교대)

규칙은 같다(기본 판 그대로 · 다른 갈래 지움 · 안 들인 시제품 코드째 · 관문 바이트 같음 · 블록마다 커밋 · 시험 묶음은 `--test-concurrency=3`).

### 9-1. SECRET 남은 것 (블록 1)

- 수: SECRET 스위치 꼴 칸(켬 · 끔 · 꼴 · 0/1 어림) 54 → 22 (남은 22 는 각도 0 · 배율 1 · 걸음 칸의 글자 열쇠 'risolutoSlide' 같은 조율 수 · 길목 겨눔 'headTop'). src 99 841 → 97 770 줄(파일 251 → 249) · config 2 776 → 2 652 줄 · tools/sim 448 → 433 파일
- 지움 — 칸: `ibSpin` 묶음 통째(40 칸 — 입력 꼴 · 원 · 스틱 · 발디딤 · 받아 멈춤 · 몸통 · 뚜껑 · 땅 · 두 마디 · 특수 공격 굳음 등). 무장 셈 둘(`armTime` · `armGrace`)만 `SECRET.altib` 으로 옮김(알티바슈 포르트 무장이 싱지르 무장 그대로라 — 같은 값) · AI 내기 거리 `aiFire` 는 이미 `altib.aiFire` 에 같은 값 · 무장 동안 상처면 풀림(`hurtDisarm` 1)은 그 자리에 · 격살 꼴(`gyeoksal.on` · `auto` · `armPath` · `power` · `share` · `trailWidth`) · `gyeoksalAi` 통째(겹 문턱 1 은 나눗셈 1 이라 그대로 · `late` 는 풀기 판에서 안 읽음) · `gkFree.on` · `gkFreeSets`(A · B 견줌 값) · `iaiKinematic` · `mord.at` · `altib.staminaK` · `iaiPathBelly`(사람 발도는 원전 길 · AI 는 올려베기 길 — 배 길은 고를 길이 없었음)
- 지움 — 아무도 부르지 않던 코드: 싱지르 대본 통째(`src/iberian_spin.js` 1 230 줄 — 'spin' 비기 판과 특수 공격 싱지르가 다 없어져 부르는 곳이 없었음 · fighter · gait · skill · secret · ai · pickup · finger_cut · unique_assist 의 `f.ibSpin` 갈래) · 원 긋기 몸짓(`src/attack_circle.js`) · 스틱 돌리기 몸짓(`stick_turn.js` 는 데드존 수 `STICK_DEAD` 하나만 남김) · 비기 정의 `IBERIAN_SECRET_SPIN` · 사람 창 `spinCircle` · `spinStick` · `stickOwns` · `circleOwns`(main.js 원 · 스틱 입력 길) · AI `spinGo` · 'spin' 비기 단계 셈 · 특수 공격 싱지르 몫(`o.special` · `run.special`)
- 지움 — 'spin' 판에서만 쓰던 정수리 가르기 특수 공격: 사람 `windFire` 의 특수 공격 길(식힘 · 흐름 셈) · 무장 없이 메기(`sec` 거짓 갈래) · AI `rdFire` 의 특수 공격 길 · 기력 아낌(`rdThrift` · `rdWindCost` · `rdSkipWhy` · 공격 시작의 'redondo' 바꿈) · `windWoundT`. 메기 · 내려침은 알티바슈 포르트 비기 길(`altibFire`)로만
- 지움 — 죽음의 일격 거꾸로 쥠: `mordGripOf` · fighter `reverseGrip` · pickup `resetReverseGrip` · hands.js 거꾸로 쥔 주먹 · secret_instant `mordRegripStep` · 쥠 바꿈 토막(`regripAt` · `M.regrip` 갈래 셋) · fighter 손잡이 겨눔 · 빈손 자리의 `mordGrip` 갈래
- 남김: 알티바슈 포르트 무장 · 메기 · 내려침(`iberian_redondo.js` — 감기 꼴 `rdWindMode` 는 UNIQUE_ASSIST 블록) · `gkFree` 의 share · add · cool · cost · `gyeoksal.press` · 길목(`gilmokAim` 과 `do.gilmok` 길 — 길목 비기 정의는 4차에서 지웠으나 읽는 코드가 남음, 다음 일)
- 시험: 지운 파일 — `iberian_spin.test` · `singir_fall.test` · `windmill.test` · `attack_circle.test` · `stick_turn.test`(모두 지운 대본 · 몸짓만 봄). 지운 블록 — 원 긋기(atk_stick) · 싱지르 한 걸음(ib_swap) · 격살 한 칼 세기(power 1 · 'finish' 판) · 끈 판 · B 안 · 옛 판 견줌(cn_gk) · 배 길 값(gns_belly). 단언만 뺌 — `ibSpin.stride` · `gyeoksal.on` · `auto` · `power` · `share` · `staminaK` · 배 길 견줌 둘 · `spinGo` · 'spin' 단계 · 거꾸로 쥠(mordschlag · wrist_audit) · `iaiKinematic` 1 판(stamina_integration — 기본 0 판은 그대로 봄)
- 지운 시뮬 도구: `iberian_spin` · `iberian_spin_ai` · `iberian_spin_circle` · `iberian_spin_feet` · `iberian_spin_form` · `iberian_spin_share` · `iberian_stick` · `singir_fall` · `windmill` · `attack_circle_drives`. 고친 도구: ib_swap(spin 판) · iberian_finish_arms(spin 판) · greatsword_joints(spin 장면) · speed_cap_probe(spin 묶음) · school_balance · arm_reach_audit · gonosen_touch(원 · 스틱 입력) · kote_pickup · ai_arm_cross · mordschlag_hits · selfclip · probe(지운 칸 넣기 · 거꾸로 쥠 읽기)
- 지운 브라우저 도구: `iberian_spin_shots` · `iberian_stick_shots` · `singir_circle_shots` (지운 대본 · 입력만 찍음)
- 시험 수: `test(` 798 → 766 · 전체 788 돌림 중 실패 6 → 고침(남은 `R` 하나 · 지운 AI 정수리 가르기 특수 공격 시험 하나 지움 · main.js 줄 단언) → 실패 0
- 교훈(새로): 지운 칸만 지우고 그 칸을 읽던 변수 이름(`R` · `rg`)이 함수 아래쪽에 남으면 관문은 지나도(죽음의 일격 · 비기 소리는 관문 판에 없음) 시험이 `R is not defined` 로 잡는다 — 지운 지역 변수는 함수 전체에서 이름을 찾아 볼 것. 'spin' 판처럼 비기 판을 지운 뒤에는 그 판만 부르던 모듈(대본 · 몸짓 읽기)이 통째로 남아 있지 않은지 부르는 곳부터 거꾸로 찾을 것

### 9-2. UNIQUE_ASSIST — 풍차 베기 · B4 (블록 2 첫 몫 · 5b)

- 지움(기본값을 그 자리에): `rdHold` · `rdDrainCut`(메는 동안 초당 베기 한 번 값 — 옛 `rdDrain` 길 지움) · `rdRamp` · `rdSteady`(휘청 고침 늘 켬 — 감기 · 이어 돌리기 밧줄 뗌 · 놓인 팔 헛힘 끔) · `rdEdge`(이어 돌리기 날 −1 을 그 자리에) · `rdAiWind` · `rdSnapTime`(0 = 상한 없음 — 넘기지 않으면 0 과 같음)
- 지움(안 고른 꼴 코드째): 감기 꼴 `rdWindMode` 와 그 꼴 셋(10/29 원뿔 고리 'spin' · 안 A `rdSlow` · 안 B `rdShoulder` — 'load' 메기 하나만 · `windRate` · 도는 날 `windEdge` · 고리 셈) · 내려침 꼴 `rdRelease` 와 곧장 사선 `rdDiag`(secret_instant `comboPlanRdDiag`) · 10/29 왼 어깨 뒤 길 `rdArc`(`comboPlanRd` 의 그 길) · AI 옛 판 `rdAiOld` · AI 기력 아낌 `rdAiQuick` · `rdAiThrift`(읽는 곳이 블록 1 에서 없어짐) · 견줌 손잡이 `applyB4Old` · `rdLoad.woundFrom`('start' 판)
- 남김: `rdHoldTime` · `rdLoop`(내려침 앞 고리 자리 — tajo 길이 읽음) · `rdWristMargin` · `rdLoad` · `rdTajo` · `rdAiMaxT`
- 시험: 지운 칸 단언만 뺌(redondo_motion · redondo_hold · ib_swap 기본값). 도구: 지움 — `redondo_trace`(8 자 재기 — 옛 길 견줌) · `redondo_trace_plot.py` · `redondo_ai_duel`(AI 특수 공격 판). 고침 — `redondo_rest_view`(후보 자세를 어깨 꼴 대신 메기 `rdLoad` 에) · `b4_probe` · `special_balance`(옛 판 손잡이)

### 9-3. UNIQUE_ASSIST — 일반 · 곁눈 베기 · 제비 베기 · 날개 접기 · 비껴서며 찌르기 · 식힘 · 사냥 겹 · 손목 치기 떨굼 (블록 2 둘째 몫 · 5c)

- 지움(기본값을 그 자리에): `on` · `stepIn` · `stepPre`(0 — 스틱 기억 `stickMem` · `stickTick` · 'mem' 셈 코드째) · `speedK`(안 읽음) · 곁눈 베기 `schielPath` · `schielPlayer` · `schielPlayerTip` · `schielPlayerK`(1 — 세기 곱 길 코드째) · 제비 베기 `tsuRuler` · `tsuSnap` · `tsuAim` · `tsuBand` · `tsuHook`(0 — 곧은 길) · `tsuArm` · `tsuTip` · `tsuStep`(0 — 미끄러져 들어감 시제품 코드째) · `imbroReach` · `inqAi` · 탭 조건 켬 넷(`cavTap` · `lianTap` · `dupTap` · `inqTap` — `TAP_ON` 글자 열쇠 표로 읽던 것 · 표째 지움) · `specialCoolFrom`('free' — 'fire' · 'motion' 셈 코드째, 사람 · AI) · 사냥 겹 `cnHunt.on` · `ai` · `any` · `torso` · `share`(풀기 판에서 안 읽음 — `huntShareK` 함수째) · 손목 치기 떨굼 `koteDrop.ai` · `judge`('all') · `once` · `ease` · `swordVn`(완화 끔 문턱)
- 시간 상한 `tsuSnapTime` · `inqSnapTime` · `lianSnapTime`(모두 0 = 상한 없음): 부르는 쪽에서 `maxT` 를 넘기지 않음 — requestCombo 가 `req.maxT ?? 0` 이라 같은 0
- 남김: `enhance`(세기 곱 1 — 몸 덧씌우기 · 끝 힘 셈에 곱으로 들어가 1 을 지우면 뜬수 셈이 바뀔 수 있음 · 조율 수) · `stepStick` · `stepPost` · `planRelease` · `lianWindow` · `lianStep` · `specialCooldown` · `secretUses` · `koteDrop` 의 p · parts · swordHalf · easeE · easeAfter · easeVn · `cnHunt` 의 max · regen · life
- 시험: 지운 블록 — 사냥 겹 끔 판 · 켬 끔 바이트 견줌(cn_hunt 둘) · 손목 치기 10/24 판 둘(skill_tree — 파일 머리에서 `koteDrop.ai = 0` 으로 묶어 보던 것 · 묶음 줄도 지움) · 곁눈 베기 세기 손잡이(schielhau_strike) · 식힘 세 셈 견줌(special_cooldown). 단언 · 판 조각만 뺌 — 끈 판 · 옛 길(tsubame_snap 넷 · schielhau_strike 셋 · cavazione_tap · lianchi_tap · it_outbox · kote_pickup) · 지운 칸 기본값(cn_hunt · prof_kit · iai_real · redondo_hold · step_input · jp_strength). 시간 상한 단언은 `R.maxT === 0` 그대로 봄

### 9-4. UNIQUE_ASSIST — 칼끝 돌려 빼기 · 겹치기 (블록 2 끝 몫 · 5d)

- 지움(기본값을 그 자리에): 칼끝 돌려 빼기 `cavHeld` · `tapHeld` · `cavSnap` · `cavSide`('contact') · `cavSpeed`('tap' — 탭 찌르기 박자 · 상한 없음 · `capFromCut` 거짓) · `cavShare`(0 — 보통 찌르기 빠르기 × `cavSpeedMul`) · `cavSelfFree` · `cavHitMul` · `cavArmSlowAi` · `cavCapCut` · `cavSnapTime` · `cavTap`. 겹치기 `dupAuto`('both' — 'bind' · 'clash2' 홀로 판 · 탭 판 길 코드째: `TAP_TRIG.dup` 은 늘 없음 · 닿음 덩이 `dupC` · 카드 글 `G7_CMD_TAP` · `G7_CMD_AUTO`) · `dupAutoParry` · `dupAutoHint`(0) · `dupStackDrain`(0) · `dupBandMin`(null) · `dupClashMax`(0) · `dupTap` · `dupGrace` · `dupAny` · `dupStep` · `dupOld`(0 — 10/28 길 `comboPlanDup` 코드째 · `dupOldShare`) · `dupBurstFree` · `dupBurstSync` · `dupBurstT` · `dupBurstMatch` · `dupBurstFit` · `dupSnapTime` · `dupEdge` · `dupPlan`
- 지움(시제품 코드째 — 10/31 '세게 하는 시제품' 기본 끔): B `cavGap`(combat.js 틈 파고들기) · C `cavParryLock`(ai.js 반응 묶음 · `parryLockUntil`) · E `cavCancel`(`cavCancelTick` · `cavFire`) · 닿음 이어 붙임 `cavMerge`
- 남김: `cavFrom` · `cavTo` · `cavSpeedMul`(1.2 — 조율 수) · `cavArmSlow` · `dupBurst` · `dupFitPoint` · `dupFitMin` · `dupFitFloor` · `dupStackS` · `dupStackGap` · `dupBandMax` · `dupClashT` · `dupClashGap` · `dupFace` · `dupFollow` · `dupBody`
- 수(블록 2 전체): UNIQUE_ASSIST 스위치 꼴 칸 93 → 8 (남은 8 은 `enhance` 1 · `buckle.cool` 0 · 비기 쓸 수 1 · 몸 숙임 0 · tajo 의 pull 0 · liftK 1 · target 같은 조율 수 · 자료). config 2 652 → 2 475 줄 · src 97 770 → 97 174 줄
- 시험: 지운 파일 — `duplieren_tap.test`(머리에서 `UA.dupAuto = 0` 으로 파일 통째를 탭 판에 묶어 보던 것 — 교훈대로 모두 옛 판 시험). 지운 블록 — 시제품 A ~ E(cavazione_tap) · 겹치기 기본 아닌 꼴 일곱(duplieren_simple — `dupBurstFit 0` · `dupBurstMatch 0 · 2` · `dupBurstSync 0 · 2` · `dupBurstFree 0` · `dupOld 1` 로 묶어 보던 것) · 막기 단추 안 셈 · 알림 · 빠짐 판(duplieren_auto) · 탭 판 겹치기 식힘(special_cooldown 의 duplieren 칸). 단언만 뺌 — 지운 칸 기본값(cavazione_tap · duplieren_auto · duplieren_simple · de_dirty) · 끔 판 조각(cavSnap 0 · tapHeld 0 · dupAuto 0 · G7 다른 판 글)

### 9-5. 남은 것 (5차 끝)

- 블록 3 SKILL(`corr` 빼고) · 블록 4 JOINTS 꼴(`mode` · `presets` · `edge` · `playerEdge` · `playerEdgeMode`)과 fighter.js 관절 · 날 세우기 다른 길 · 블록 5 작은 묶음(CN_STEP · BIND · IMPACT_FX · SHOP · `SAENGSA.playerProf.mode` · `SOUND.fleshHit` · WANDER) · 블록 6 모듈 스위치(`FINISH` · `VITAL` · 이탈리아 걸음 손잡이 넷 · `setWhipPreset` · `setIberianTable` · `setGripTorque`)
- 블록 7 시뮬 도구: §7-6 목록에 더해 이번에 지운 칸을 아직 넣는 것 — kote_drop_duel(`koteDrop.judge`) · cn_ai_gyeoksal(`cnHunt.ai`) · duplieren_simple(`dupOld` · `dupOldShare`) · unique_study_player · tsubame_trace · school_balance · iai_real · kote_pickup · step_input_measure · unique_assist_probe · special_balance · it_tone_measure · it_outbox · schielhau_strike(제비 · 곁눈 · 식힘 칸) · mordschlag_duel(`mord.grip`). 넣어도 읽는 데가 없어 기본 판으로 돈다
- 블록 8 브라우저 도구: §7 부록 65 개에 더해 `iberian_finish_arms_shots`(MOVE=spin — 지운 대본) · `b4_shots` · `redondo_gamecam_shots` · `redondo_motion_shots`(지운 B4 · 감기 꼴 인자)
- 블록 밖에서 본 것(다음 일): 4차에서 정의를 지운 길목(`do.gilmok` · `gilmokAim` · secret.js `gilmokRest` · AI 길목 몸) 코드가 남음 · 4차에서 지운 죽음의 일격 칸(`mord.burstBack` · `burstFree` · `power` · `aim` · `pommel` · `track` · `trackCommit` · `noSelfClip` · `tech`)을 읽는 코드가 아직 undefined 로 읽음 — 기본 판 값으로 적고 갈래를 지울 것 · `AI_MAAI.hide`(0 — 스위치) · jp_strength.test 머리의 `withNoto0` · `deOff`(그때 판 묶음)

### 9-6. 시험 · 관문 · 교훈 (5차)

- 관문: 커밋마다 fights12 `b7ba0017` · live `cd211727` · ft `ba9c958b` · corr 12 · smoke 34 / 34 · build 됨 · name_policy 0 (바탕과 같음)
- 전체 시험: 블록 1 뒤 788 중 실패 6 → 고침 · 블록 2 뒤 765 중 실패 1 → 고침(아래) → 0. `test(` 798 → 745
- 교훈(새로):
  - 지운 칸을 별칭 + 선택 사슬로 읽는 곳(`const C = H(); … C?.on`)은 `C\.on` 같은 찾기에 안 걸린다 — 5c 에서 `cnHunt.on` 을 지우고 `huntRegenK` 의 `C?.on` 을 놓쳐 사냥 겹 기력 회복 감소가 꺼졌고, 관문은 지나고 cn_gk 시험이 잡았다(5d 에서 고침). 칸을 지울 때 `\??\.이름\b` 로 찾을 것
  - 머리 묶음 줄은 UNIQUE_ASSIST 에도 있다: `duplieren_tap.test` 머리 `UA.dupAuto = 0`(파일 통째 탭 판) · `skill_tree.test` 머리 `koteDrop.ai = 0`(손목 치기 10/24 판 시험 둘) · 시험 안 `body({ dupBurstFit: 0 … })` 처럼 도움 함수가 칸을 옛 값으로 넣는 것도 같은 묶음이다
  - 바꿔 넣던 칸이 없어지면 그 칸을 넣는 시험 조각은 아무 일도 안 하고 지나가거나(같은 판) 엉뚱하게 실패한다 — 실패 줄만 보지 말고 칸을 넣는 줄을 찾아 그 조각을 지울 것
  - 시간 상한 0 칸(`*SnapTime`)은 부르는 쪽에서 넘기지 않으면 requestCombo 가 `req.maxT ?? 0` 으로 같은 0 — 시험의 `R.maxT === 0` 은 그대로 맞음
