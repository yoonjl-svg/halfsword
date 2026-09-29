# wbs 기준 sha (시뮬 stdout sha256)

잰 코드: wbs-impl `15d6f2a` (W4 병합 `08f9d8c` + main `d397e4b` 병합 `e272597` + 아틀라스 묶음 다시 만듦 `15d6f2a`). 이 메모 커밋은 코드를 바꾸지 않는다.
main 이 시작 간격 7.0 m·발 묶음 2 s (`ARENA.startGap`·`startHold`, a9bc074) 를 넣어서 기본값·main 같음 sha 가 모두 바뀌었다.
옛 값은 `with_config.mjs ARENA.startGap=4.2 ARENA.startHold=0 …` 로 바이트 그대로 나온다 (아래 5번).
저장소 뿌리에서, sha256 앞 8자리 (전체는 아래 표). fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭').
온몸 깃발은 9/29 메모와 같다 (W4 가 새로 둔 것은 모두 DRIVE 안: `hands` 기본 거짓·`handMode`·`fingerFF`·`ffFilter`·`poleMinDir`·`ikDphi` → `DRIVE.on=false` 가 다 끈다).

## 1. 기본값 (게임 그대로: WHOLE·R0·R1·손짓·드라이브 모두 켬, DRIVE.hands 거짓 = trunkOnly)
| 명령 | sha |
|---|---|
| `node tools/sim/fights12.mjs` (= `hybrid.mjs fights12.mjs`) | `e19960bf` |
| `node tools/sim/live_battery.mjs` | `b83c9a9b` |

## 2. S = 0 불변 (손짓·드라이브를 꺼도 AI 판은 1번과 같다)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false fights12.mjs` | `e19960bf` |
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false live_battery.mjs` | `b83c9a9b` |

## 3. main 과 바이트 같음 (main `2990d3d` 기본 실행: fights12 = hybrid `a74bb59c`, live_battery `2f453e0b`, README 값과 같음)
온몸 깃발을 다 끈다. `WHOLE.on=false` 가 있어야 한다: `GAIT.fwdFix`(AI 기술 걸음 방향 고침)는 `WHOLE.on` 일 때만 켜지고 hybrid 걸음에서만 판을 바꾼다.
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false GESTURE.on=false DRIVE.on=false ARM.lead=false ARM.rawSwing=false ARM.leashSkip=false ARM.holdSpeedFinger=0.3 fights12.mjs` | `a74bb59c` |
| 같은 깃발 `hybrid.mjs fights12.mjs` | `a74bb59c` |
| 같은 깃발 `live_battery.mjs` | `2f453e0b` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false fights12.mjs` (손짓·드라이브는 켠 채, S = 0) | `a74bb59c` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false live_battery.mjs` | `2f453e0b` |

## 4. 옛 levitate 관문 (이어 보기용, main 도 같은 값)
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs BODY.weightMode=levitate GESTURE.on=false DRIVE.on=false fights12.mjs` | `f73fca94` |
| 같은 깃발 `live_battery.mjs` | `e9ad046d` |
| main `2990d3d`: `with_config.mjs BODY.weightMode=levitate fights12.mjs` · `live_battery.mjs` | `f73fca94` · `e9ad046d` |

## 5. 옛 시작 (간격 4.2 m, 발 묶음 없음) — 9/29 메모 값 그대로
W4 병합·새 묶음은 AI 판에 아무것도 더하지 않는다 (S = 0): 옛 ARENA 로 돌리면 9/29 기본·main 값이 바이트 그대로.
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs ARENA.startGap=4.2 ARENA.startHold=0 fights12.mjs` · `live_battery.mjs` | `3d9b04f9` · `50c9f1b0` |
| `R0_OFF=1 … ARENA.startGap=4.2 ARENA.startHold=0` + 3번 깃발 `fights12.mjs` · `live_battery.mjs` | `afdd8c66` · `11433650` |

## 6. R2 도구 (결정적)
| 명령 | sha | 판정 |
|---|---|---|
| `node tools/sim/puppet.mjs` | `26152a75` | 24/24, 손 최대 0.022 m, 부호 PASS (새 클립) |
| `node tools/sim/gesture_eval.mjs --input=both` | `1ff042cd` | wind·stroke PASS (9/29 와 같음) |
| `node --expose-gc tools/sim/atlas_check.mjs` (`--clips=docs/motion/clips` 도) | (시간 값이 들어 매번 다름) | 모두 통과, 묶음 generated `sha1:5e244acf` |

## 전체 sha256
- `e19960bf41468abc1053f383e99b68f22de160752075232720febf5ad6e86bbe` fights12 기본
- `b83c9a9ba656e77a9c25fe7cdb7e889adb6a52fd9371687452f468449ba8d336` live_battery 기본
- `a74bb59ce5952fafc885f3a792a71540e24365a27d0f4d1d543243d336507a56` fights12 = main
- `2f453e0b6f759b7145526a79ce580d591802bbf8e8cb7040e0a402e42099ea5f` live_battery = main
- `f73fca94f69024bbed649cf950139eab384b5e0705d7670c6c74a722945d3ddb` fights12 levitate 끔
- `e9ad046dcf45046ad412e7d90b326eff778eca5bb1228d775e47c04033b8f139` live_battery levitate 끔
- `3d9b04f9e2c62115dfe3236107d6ec5f97f9f3cc33443dfa4b437feec44f5744` fights12 기본, 옛 ARENA
- `50c9f1b0d7b2ff24fa8e2becdaae6a6b19fd6cd6a476c8701b7328bea6b710a9` live_battery 기본, 옛 ARENA
- `afdd8c664f10471acb0f81f9615ff3e31fb2ad790427330f8dc5132da3da2753` fights12 = main, 옛 ARENA
- `11433650ea03a2f00494291550f9df672dd31a053045775ef1fcd74a38560134` live_battery = main, 옛 ARENA
- `26152a75655af8bb8077efaa9118c05cae19d3c195be193bb1d199c70950fe8a` puppet
- `1ff042cdd261db6b7a59a7f9af09d63c781c41ace889d1e54f801d756066e0ac` gesture_eval both
