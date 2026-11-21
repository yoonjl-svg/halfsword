# ① 관문·시험이 지나는 코드 — 근거

기준: 본판 `9c5ba917`. 실행 기록은 노드의 `NODE_V8_COVERAGE`로 받았다.

## 다시 재는 법
```
bash scripts/run_gates.sh <본판 폴더> <결과 폴더>      # 관문 일곱(team_fights 는 --jobs=1) → raw/A, raw/Bx
bash scripts/run_tests.sh <본판 폴더> <결과 폴더>      # 시험 전체(하나씩) → raw/T, 약 14분
node scripts/merge.mjs <본판 폴더> A.json raw/A
node scripts/merge.mjs <본판 폴더> B.json raw/A raw/Bx
node scripts/merge.mjs <본판 폴더> C.json raw/A raw/Bx raw/T
node scripts/analyze.mjs <본판 폴더> A.json B.json C.json totals|top25|classify|input
node scripts/probe.mjs <본판 폴더> scripts/tap_probes.json A=raw/A Bx=raw/Bx T=raw/T      # 탭 17갈래
node scripts/commits.mjs <본판 폴더> A.json B.json C.json <커밋들>                        # 합친 줄
# 감사가 따로 맞춘 것
node scripts/my_loaded.mjs <본판 폴더> raw/A raw/Bx raw/T                                 # 읽힌 파일 수 (LIST=1 이면 안 읽힌 목록)
node scripts/my_probe.mjs <본판 폴더 이름>/src/skill.js 304 14 raw/A raw/Bx raw/T         # 그 글자가 실행된 프로세스 수
NODE_V8_COVERAGE=raw/my_fin node tools/sim/finish_thrust.mjs 1                            # 쓰러진 상대 찍기 (2분 반)
```

## 파일
| 파일 | 무엇 |
|---|---|
| `out/out_totals.md`, `out_top25.md`, `out_classify.md`, `out_input.md` | 전체 몫, 큰 파일 25개, 안 읽힌 파일 갈래, 손 입력 길 |
| `out/out_tap.txt` | 탭 17갈래마다 어느 관문·시험이 지났나 |
| `out/out_commits.md`, `out_removed.txt` | 어제 합친 줄, 죽은 코드 지움의 지운 줄 |
| `never_loaded_by_gates.txt` | 관문 일곱이 한 번도 안 읽는 파일 114개 |
| `never_loaded_by_gates_and_tests.txt` | 관문 + 시험이 한 번도 안 읽는 파일 31개 |
| `out/finish_thrust_1_down_9c5ba917.out` | 쓰러진 상대 찍기 출력 전문(sha256 앞 8자 `1597f6e0`) |
| `notes_en.md` | 조사 기록 전문(영어) |

실행 기록 원본(수백 MB)은 싣지 않았다. 위 명령으로 다시 만든다.
