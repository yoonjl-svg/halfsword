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

관문은 바이트 같다 (§6). **스위치 걷어내기는 다 끝나지 않았다** — 남은 것은 §5.

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

## 5. 남은 것 (다음 일)

- config 스위치 칸 약 260 이 아직 있다. 크게: SECRET(비기 — 고노센 · 발도 · 싱지르 · 모르트슐라크 · 리솔루토 · 격살 칸 100 남짓) · UNIQUE_ASSIST(겹치기 · 카바치오네 · 풍차 베기 · 셸하우 60 남짓 · `applyB4Old`) · SKILL(팔 사람 꼴 · 손가락 긋기 · 이탈리아 · 자세표) · JOINTS(날 세우기 꼴 · 손목 · 팔꿈치) · AI_PLAN · AI_KIT · AI_ARC · AI_TELL · IT_OUTBOX · PICKUP · THRUST · SCHOOL_PASSIVE · JP_TANK · IMPACT_FX · IB_LINK 켬 · 꼴(circle) · SKILL.corr(옛 보정 — corr_s0 관문이 이 둘을 견줌)
- schools.js · finish.js · vital_target.js · druid_whip.js · nagashi_redesign 바깥의 모듈 스위치(`setItalianStride` · `setJapaneseGait('old')` · `FINISH` · `VITAL` · `setWhipPreset`)와 시뮬 환경 변수(harness_m 의 FINISH_* · VITAL_* · config 의 MONTANTE_HAND · IT_MEASURE · FL_MEASURE · EDGE · ONETIP · PLAYER_EDGE · JOINTS)
- 브라우저 도구 60 남짓이 지운 주소 인자를 아직 주소에 적는다 — 게임이 읽지 않아 기본 판으로 돈다(견주던 도구는 두 판이 같게 나옴). 기계로 걷으면 견줌 짜임이 엉켜서(시도 뒤 되돌림) 도구마다 손봐야 함
- 시험 블록 안에서 스위치를 옛 값으로 바꿔 보던 곳 가운데 위 남은 스위치에 걸린 것들 — 그 스위치를 지울 때 같이

## 6. 관문

`node tools/sim/fights12.mjs | sha256sum` `b7ba0017` · live_battery `cd211727` · `finish_thrust 1 --stand` `ba9c958b` · `corr_s0 --limits=off,on` IDENTICAL 12 · weapon_smoke OK 34 / 34 · `npm run -s build` 됨 · `name_policy` 0 — 바탕 `1cc27e8e` 와 같다. 커밋마다 같은 관문을 돌림.
corr_s0 의 `--limits=off,on` 은 사람 관절 한도 스위치를 지운 뒤로 같은 판을 두 번 돈다(관문 명령 · 수는 그대로).
