# wbs 기준 sha (시뮬 stdout sha256)

잰 코드: wbs-impl `39f4d48` (W3 병합 `0c45eb1` + main `c93e9a9` 병합). 이 메모 커밋은 코드를 바꾸지 않는다.
main 이 `BODY.weightMode` 기본값을 `hybrid` 로 바꿔서(2daf262) 옛 wbs 기준(levitate 때)은 아래 4번으로만 남는다.
저장소 뿌리에서, sha256 앞 8자리 (전체는 아래 표). fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭').

## 1. 기본값 (게임 그대로: WHOLE·R0·R1·손짓·드라이브 모두 켬)
| 명령 | sha |
|---|---|
| `node tools/sim/fights12.mjs` (= `hybrid.mjs fights12.mjs`) | `3d9b04f9` |
| `node tools/sim/live_battery.mjs` | `50c9f1b0` |

## 2. S = 0 불변 (손짓·드라이브를 꺼도 AI 판은 1번과 같다)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false fights12.mjs` | `3d9b04f9` |
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false live_battery.mjs` | `50c9f1b0` |

## 3. main 과 바이트 같음 (main `c93e9a9` 기본 실행: fights12 `afdd8c66`, live_battery `11433650`)
온몸 깃발을 다 끈다. `WHOLE.on=false` 가 있어야 한다: `GAIT.fwdFix`(AI 기술 걸음 방향 고침)는 `WHOLE.on` 일 때만 켜지고 hybrid 걸음에서만 판을 바꾼다.
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false GESTURE.on=false DRIVE.on=false ARM.lead=false ARM.rawSwing=false ARM.leashSkip=false ARM.holdSpeedFinger=0.3 fights12.mjs` | `afdd8c66` |
| 같은 깃발 `live_battery.mjs` | `11433650` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false fights12.mjs` (손짓·드라이브는 켠 채, S = 0) | `afdd8c66` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false live_battery.mjs` | `11433650` |

## 4. 옛 levitate 관문 (R0 기준, 이어 보기용)
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs BODY.weightMode=levitate GESTURE.on=false DRIVE.on=false fights12.mjs` | `15dca714` |
| 같은 깃발 `live_battery.mjs` | `b867fc3f` |

## 5. R2 도구 (결정적)
| 명령 | sha | 판정 |
|---|---|---|
| `node tools/sim/puppet.mjs` | `a08a2b67` | 24/24, 손 최대 0.022 m, 부호 PASS |
| `node tools/sim/gesture_eval.mjs --input=both` | `1ff042cd` | wind·stroke PASS |
| `node --expose-gc tools/sim/atlas_check.mjs` | (시간 값이 들어 매번 다름) | 모두 통과 |

## 전체 sha256
- `3d9b04f9e2c62115dfe3236107d6ec5f97f9f3cc33443dfa4b437feec44f5744` fights12 기본
- `50c9f1b0d7b2ff24fa8e2becdaae6a6b19fd6cd6a476c8701b7328bea6b710a9` live_battery 기본
- `afdd8c664f10471acb0f81f9615ff3e31fb2ad790427330f8dc5132da3da2753` fights12 = main
- `11433650ea03a2f00494291550f9df672dd31a053045775ef1fcd74a38560134` live_battery = main
- `15dca714da414544947cedeeb0a97144fb00466c71c4d95cd383f1999a900800` fights12 levitate 끔
- `b867fc3f67c7f37fb2bf1e2ea7b0fddbac01d1dc0f96d22103f2388be9284572` live_battery levitate 끔
- `a08a2b6754e69c97c3ceb0e727686ea7fec0209a65549217bb5246d51abd9a0d` puppet
- `1ff042cdd261db6b7a59a7f9af09d63c781c41ace889d1e54f801d756066e0ac` gesture_eval both
