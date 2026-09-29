# 무기 PM 상태 (늘 최신 — 디렉터 9/29 규칙 ④)

- 세션: `session_013j34LYEUYoaeS5xUme2DTq` · 브랜치 `claude/pm-weapons-balance` · 디렉터 `session_014nJCzE4hyxiYc9innhSUng`
- 보고: 하루 한 번 18:00 KST, 10줄 안, 끝남/진행 중/안 함 + 커밋 해시. 막혔을 때만 그 전에. 일이 없으면 "대기" 한 줄.
- 역할(main `docs/pm_roles_charter.md` 부록 B): 무기가 "무엇을 하나"(무기 값·자세표·기술 길·판정 제안). 몸 동작은 동작 PM, `schools.js`·`ai.js` 는 캐릭터 PM·디렉터(무기 PM은 값만 제안). 제한·상한·조건은 제안만.

## 맡은 일
- 무기 밸런스·겉모습, 리볼버 점검 도구(`gun_recoil.mjs`)
- 무기 분류 `src/weapon_class.js` · `docs/weapon_types.md`
- 동작 라이브러리 `src/motion_library.js`(기본 꺼짐) · `docs/weapon_motions.md` → 온몸 타격의 '무기 층'으로 합침(역할 분담안 4번)
- 자루 무기(봉·창) 시제품 `tools/sim/pole_specs.mjs` · `docs/pole_frame_design.md`
- 무기-검술 연구 ASS 지휘 (`session_01QoWtSqxGN5jYBMudxkqo1x`, 브랜치 `claude/pm-weapons`, 요청 목록은 디렉터 9/29 지시 5의 순서)

## 열린 요청
| 일 | 기한 | 상태 |
|---|---|---|
| `docs/handoff/weapons_merge_list.md` (main 병합 최소 묶음 + 붉은 팀 명령) | 9/29 18:00 KST | 끝남 |
| 이 상태 파일 | 늘 | 끝남(갱신 중) |
| 무기 층 인터페이스 초안 `docs/weapon_layer.md` + `weapon_class.js` 칸 | 9/30 18:00 KST | 끝남 (초안, 연구 ASS R6 조사 오면 3절 값 교체) |
| 사장님 결정: 밸런스 수치 3개 + 청강검 선택안, 온몸 타격 Q13·Q14·Q26 | 디렉터가 전달 | 대기 |
| 온몸 타격(R2 이후) 뒤 도끼·메이스 시제품 다시 재기 | R2 뒤 | 대기 |

## 하지 말 것 (디렉터 9/29)
motion_library 몸 동작 기능 확장, 밸런스 값 적용, 새 시제품. main 에 없는 작업을 더 키우지 않는다. 새 원격 브랜치 금지.

## 재현 명령
- 분류 표: `node tools/sim/weapon_classes.mjs`
- 라이브러리 켬/끔 롱소드 상대: `node tools/sim/hybrid.mjs motion_lab.mjs duel <무기id> 48 off|on`
- 리그전: `for k in 0 1 2 3; do node tools/sim/motion_league.mjs run 24 $k 4 off > l.$k.jsonl & done; wait; node tools/sim/motion_league.mjs report l.*.jsonl` (켬은 `on`)
- 밸런스 제안 묶음: `node tools/sim/with_spec.mjs 'rubber_chicken.mBlunt=3.8' 'monohoshizao.controlOverrides={"maxAimTorque":22,"aimStiffness":70,"wristVmax":34,"twistScale":0.25}' 'monohoshizao.mCut=1.4' 'zweihander.mCut=1.35' motion_league.mjs run 24 0 1 off`
- 봉: `STAFF_N=48 STAFF_THRUST=rapier STAFF_MBLUNT=3.5 LIB=1 node tools/sim/hybrid.mjs staff_proto.mjs` · 봉·창 리그: `EXTRA=pole ONLY=proto_staff node tools/sim/motion_league.mjs run 12 0 1 off`
- 부위 효과표: `node tools/sim/hybrid.mjs blunt_zones.mjs <무기id> 24 on|off`
- 게임 불변 확인: `fights12.mjs`, `hybrid.mjs fights12.mjs`, `live_battery.mjs` 바이트 비교 + `weapon_smoke.mjs`

## 다음 할 일
1. 연구 ASS R6 조사가 오면 무기 층 3절 값 교체.
2. 결정이 오면 밸런스 수치 적용(디렉터 지시 뒤) + 공통 검증.
3. R2 시험판이 나오면 붉은 팀 명령(병합 목록 5절).
