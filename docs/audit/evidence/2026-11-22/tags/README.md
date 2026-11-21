# ③ 승인 표시 — 근거

견준 것: `87f010d7:src/config.js`(줄이기 전) 과 `origin/main:src/config.js`(`9c5ba917`).

## 다시 돌리는 법
```
git show 87f010d7:src/config.js > old_config.js
git show origin/main:src/config.js > new_config.js
node scripts/extract.cjs $(npm root -g)/typescript old_config.js old_keys.json   # 값 이름마다 붙은 주석
node scripts/extract.cjs $(npm root -g)/typescript new_config.js new_keys.json
node scripts/classify.cjs old_keys.json new_keys.json rows.json                   # 사장님 / 섞임 / 확인 전 / 없음
node scripts/groups.cjs rows.json MIXED:OWNER,PROV:OWNER,MIXED:NONE > grp_upgrade.txt
node scripts/blocktag.cjs rows.json blocktag.tsv                                  # 머리말 표시가 이름을 안 부른 값
node scripts/open.cjs rows.json <owner_open_questions.md> open_missing.tsv        # 여쭐 값 표에 없는 후보
node scripts/sample.cjs rows.json 20261121 <결정 기록 본문들>                      # 날짜 표본(결과로 삼지 않음)
node scripts/appendix.cjs rows.json 7 <달별 결정 기록들>                           # 옛 주석 보존 표본
```

## 파일
| 파일 | 무엇 |
|---|---|
| `grp_upgrade.txt` | "확인 전·섞임 → 사장님"으로 바뀐 30묶음 97개의 앞뒤 주석. 손으로 읽은 바탕 |
| `blocktag.tsv` | 사장님 표시가 붙었지만 옛 주석의 사장님 문장이 그 값 이름을 부르지 않은 후보 225개 + 옛 주석에 사장님 말이 아예 없던 90개 |
| `blocktag_viol.tsv` | 옛 주석에 "확인 전"이 있었는데 지금 표시가 없는 25개(읽어 보니 12개가 실제) |
| `open_missing.tsv` | 낱말로 거른 "플레이어 쪽 확인 전" 후보 34개와 지금 주석 |
| `sample.txt` | 날짜 표본 40개의 기계 대조. 기계가 못 미더워 결과로 삼지 않음 |

## 알아 둘 것
- 가름은 주석의 낱말 규칙이다(`scripts/classify.cjs`). 숫자는 ±10%로 읽는다.
- 한 줄에 값이 여럿이면 그 줄의 주석이 모두에게 붙는다.
- 값 이름은 타입스크립트 파서로 뽑았고, 실제 `import()`로 본 이름과 다섯 개(펼침·getter)만 다르다.
