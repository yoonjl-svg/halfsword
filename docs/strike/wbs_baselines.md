# wbs 기준 sha (시뮬 stdout sha256)

잰 코드: wbs-impl `b390085` (W5 병합 `8df8efe` = wbs-r2-w5 `5d1774f` + main `01083f8` 병합 `b390085`). 이 메모 커밋은 코드를 바꾸지 않는다 (D-004 다시 잼, 2026-09-30).
main 이 그사이 시작 간격 5.6 m·발 묶음 2 s, 참수 (`COMBAT.decapitate`), 되튐 두 가지 (`STEEL.steel`·`STEEL.bone`), 판금 이동 ×0.8 (`ARMOR.moveMul`), 가슴 찌르기 +0.25 지움을 넣어서 기본값·main 같음·levitate·옛 ARENA fights12 sha 가 모두 바뀌었다. live_battery 는 main 같음 (`2f453e0b`)·옛 ARENA 둘이 그대로이고, 기본값만 바뀌었다.
저장소 뿌리에서, sha256 앞 8자리 (전체는 아래 표). fights12 는 바이트 관문 전용 (`tools/sim/README.md` '소음 폭'). stdout 만 (stderr 의 'using deprecated parameters' 줄은 뺌).
온몸 깃발은 9/29 메모와 같다 (W4·W5 가 새로 둔 것은 모두 DRIVE·GESTURE 안: `hands` 기본 거짓·`handMode`·`fingerFF`·`ffFilter` (W5 기본 참)·`poleMinDir`·`ikDphi`·`sectorAll` → `DRIVE.on=false`·`GESTURE.on=false` 가 다 끈다). W5 가 옛 결심 경로 (`WHOLE.commit`·`COMMIT`) 를 지웠으므로 그 깃발은 없다.

## 1. 기본값 (게임 그대로: WHOLE·R0·R1·손짓·드라이브 모두 켬, DRIVE.hands 거짓 = trunkOnly, ffFilter 참)
| 명령 | sha |
|---|---|
| `node tools/sim/fights12.mjs` (= `hybrid.mjs fights12.mjs`) | `2933b5e2` |
| `node tools/sim/live_battery.mjs` | `1895268d` |

## 2. S = 0 불변 (손짓·드라이브를 꺼도 AI 판은 1번과 같다)
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false fights12.mjs` | `2933b5e2` |
| `node tools/sim/with_config.mjs GESTURE.on=false DRIVE.on=false live_battery.mjs` | `1895268d` |

## 3. main 과 바이트 같음 (main `01083f8` 기본 실행: fights12 = hybrid `12223139`, live_battery `2f453e0b`, README 값과 같음)
온몸 깃발을 다 끈다. `WHOLE.on=false` 가 있어야 한다: `GAIT.fwdFix`(AI 기술 걸음 방향 고침)는 `WHOLE.on` 일 때만 켜지고 hybrid 걸음에서만 판을 바꾼다.
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false GESTURE.on=false DRIVE.on=false ARM.lead=false ARM.rawSwing=false ARM.leashSkip=false ARM.holdSpeedFinger=0.3 fights12.mjs` | `12223139` |
| 같은 깃발 `hybrid.mjs fights12.mjs` | `12223139` |
| 같은 깃발 `live_battery.mjs` | `2f453e0b` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false fights12.mjs` (손짓·드라이브는 켠 채, S = 0) | `12223139` |
| `R0_OFF=1 node tools/sim/with_config.mjs WHOLE.on=false live_battery.mjs` | `2f453e0b` |

## 4. 옛 levitate 관문 (이어 보기용, main 도 같은 값)
| 명령 | sha |
|---|---|
| `R0_OFF=1 node tools/sim/with_config.mjs BODY.weightMode=levitate GESTURE.on=false DRIVE.on=false fights12.mjs` | `73abfceb` |
| 같은 깃발 `live_battery.mjs` | `b22b24fa` |
| main `01083f8`: `with_config.mjs BODY.weightMode=levitate fights12.mjs` · `live_battery.mjs` | `73abfceb` · `b22b24fa` |

## 5. 옛 시작 (간격 4.2 m, 발 묶음 없음)
main `01083f8` 에서도 옛 ARENA fights12 는 9/29 값 (`3d9b04f9`·`afdd8c66`) 이 아니다: 되튐 통합·판금 이동·가슴 찌르기 지움이 판을 바꾼다 (main 옛 ARENA fights12 = `2a477544`, live_battery = `11433650` 그대로). README 의 '옛 기준은 바이트 그대로' 는 그 판정 바꿈 전 이야기다.
| 명령 | sha |
|---|---|
| `node tools/sim/with_config.mjs ARENA.startGap=4.2 ARENA.startHold=0 fights12.mjs` · `live_battery.mjs` | `2ee00c02` · `50c9f1b0` |
| `R0_OFF=1 … ARENA.startGap=4.2 ARENA.startHold=0` + 3번 깃발 `fights12.mjs` · `live_battery.mjs` (= main 옛 ARENA) | `2a477544` · `11433650` |

## 6. R2 도구 (결정적)
| 명령 | sha | 판정 |
|---|---|---|
| `node tools/sim/puppet.mjs` | `26152a75` | 24/24, 손 최대 0.022 m, 부호 PASS (병합 전과 같음) |
| `node tools/sim/gesture_eval.mjs --input=both` | `1ff042cd` | wind·stroke PASS (병합 전과 같음) |
| `node --expose-gc tools/sim/atlas_check.mjs` (`--clips=docs/motion/clips` 도) | (시간 값이 들어 매번 다름) | 모두 통과, 묶음 generated `sha1:5e244acf` (클립·묶음 안 바뀜, 다시 안 만듦) |

## 지난 값 (0454220, W4 + main d397e4b)
fights12 기본 `e19960bf`, live_battery 기본 `b83c9a9b`, main 같음 `a74bb59c`·`2f453e0b`, levitate `f73fca94`·`e9ad046d`, 옛 ARENA 기본 `3d9b04f9`·`50c9f1b0`, 옛 ARENA main 같음 `afdd8c66`·`11433650`. W5 (`5d1774f`) 는 이 값을 모두 그대로 두었다 (옛 경로 지우기 전과 바이트 같음).

## 전체 sha256
- `2933b5e2cc944e2323bb03129ad9bbc776b8391785e1598310f66fd7234ecd99` fights12 기본
- `1895268da3343effe5b719fb7f53c4ffd16c8312ae19b14b7cd0d9ad3b5e761b` live_battery 기본
- `12223139405767739ad9a3f987acda5684333fd1c293223af0e94642cf181851` fights12 = main
- `2f453e0b6f759b7145526a79ce580d591802bbf8e8cb7040e0a402e42099ea5f` live_battery = main
- `73abfcebc5b846e335ac38b4d26640e9611c963698db6fa12cb907e119a680fc` fights12 levitate 끔
- `b22b24fa5f222e377985d24e6bd3e50a7c13f5b3a65acef36686f94d810a7427` live_battery levitate 끔
- `2ee00c0235fb29063e50e39a79980fec658efcab4ebcbd6886ba1f582f0d218e` fights12 기본, 옛 ARENA
- `50c9f1b0d7b2ff24fa8e2becdaae6a6b19fd6cd6a476c8701b7328bea6b710a9` live_battery 기본, 옛 ARENA
- `2a477544f00e881a5e26cf9ff83a8ce624da4b4499aef91a4e5d75fa04f93fc3` fights12 = main, 옛 ARENA
- `11433650ea03a2f00494291550f9df672dd31a053045775ef1fcd74a38560134` live_battery = main, 옛 ARENA
- `26152a75655af8bb8077efaa9118c05cae19d3c195be193bb1d199c70950fe8a` puppet
- `1ff042cdd261db6b7a59a7f9af09d63c781c41ace889d1e54f801d756066e0ac` gesture_eval both
