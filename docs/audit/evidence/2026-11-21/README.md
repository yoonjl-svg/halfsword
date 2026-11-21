# 감사 증거 (2026-11-21 집중 감사)

보고서 `docs/audit/2026-11-21.md`의 숫자를 다시 내는 스크립트와 목록. 게임 파일은 고치지 않는다. 본판을 따로 꺼낸 워크트리(`$M`)에서 돈다.

```
git worktree add --detach /tmp/wt_main origin/main && cd /tmp/wt_main && npm ci   # $M
```

| 폴더 | 무엇 | 쓰는 법 |
|---|---|---|
| `compliance/` | 확인표 답 칸 분류(`tbl.py`), 살아 있는 줄 어림(`live.py`), 설정 키 대조(`keys.py`) | `python3 tbl.py $M/docs/strike/owner_defaults_table.md out.json` |
| `deadcode/` | 설정 잎 걷기(`walk2.mjs`), 이름으로 읽는 곳 찾기(`rd.mjs`), 모듈 닿음(`reach.mjs`), 안 쓰는 export(`exp.mjs`, `exp2.mjs`), 이름이 안 나오는 설정 목록(`dead_keys.txt`) | `node walk2.mjs $M > main2.tsv; node rd.mjs $M main2.tsv; node reach.mjs $M src/game_entry.js src/pwa.js src/soundlab.js src/test_pick.js src/voicelab.js` |
| `perf/` | 물리 스텝 시간(`step_time.mjs`), 프로파일을 파일·함수별로(`prof_by_file.mjs`, `prof_fn.mjs`), Rapier 몸·관절·호출 수(`rapier_count.mjs`), 스텝당 할당(`heap_alloc.mjs`), 무대별 브라우저 측정(`P_measure.mjs`, `run_all.sh`, `table.mjs`), 쉬는 화면(`idle.mjs`), 첫 내려받기(`firstload.mjs`) | `cd $M && nice -n 10 node <여기>/perf/step_time.mjs 16 20` · `node --cpu-prof --cpu-prof-dir=prof step_time.mjs 12 15 && node prof_by_file.mjs prof` · 브라우저 측정은 `npx vite --port 5191`을 띄운 뒤 `STAGES="poseidon …" CFGS="tiny4 tiny1" ./run_all.sh` |
| `perf/patches/` | 6차 보고: 본판 복사본에서 만든 성능 패치 셋(`a_corr_early.patch` 권함, `b_slot_groups.patch`·`d_vital_inplace.patch` 거둠), 관문 일곱 개 돌리기(`gates.sh`)와 해시(`gates_*.txt`), 시간(`timing.sh`, `timing.jsonl`, `team_perf.txt`), (b)의 충돌 쌍 전수 대조(`slotcheck.mjs`) | 본판 `src`·`tools`·`package.json`을 꺼낸 폴더에서 `patch -p1 < a_corr_early.patch`, `./gates.sh <폴더> wa`, 기준 폴더 출력과 `cmp` |
| `rules/` | 판정 갈래 세기·끄기: 세기 장치를 넣는 패치 스크립트(`patch_combat.py`, `patch_fighter.py`, `_j.js`), 48판 러너(`D_fights.mjs`), 2:2 러너(`D_team.mjs`), 조사 메모(`notes_en.md`, 영문 원자료) | 본판 `src`·`tools`를 복사한 폴더에서 `python3 patch_combat.py; python3 patch_fighter.py` 뒤 `J_COUNTS=1 nice -n 10 node tools/sim/D_fights.mjs`, 끄기는 `J_ABL=<이름>`, 소음 폭은 `PERTURB=1|2|3` |
| `followups/` | 4차 보고: 찍기 추적(`finish_trace.mjs`, `ft_diag.mjs`, 결과 `ft_*.txt`), `46623c8c` 관문 다시 돌리기(`gates.sh`, `gates.log`), 처음 받는 목록 나누기(`pre.mjs`, `precache.txt`), 묶음 속 모듈 크기(`mods.mjs`), 무리 싸움 비용(`perf.txt`, `perf6.txt`, 함수별 견줌 `cmp.mjs`·`cmp.txt`) | `W=longsword node finish_trace.mjs 12 30` · `npm run build` 뒤 `cd dist && node <여기>/pre.mjs` · `node tools/sim/team_perf.mjs 2 12 --only=perf --counts=2,3,4,6` |
| `names/` | 5차 보고: 설정값 이름 세기(`cfgkeys.mjs`, `cfg_vocab.py`), 단위 글자(`units.py`), 겹친 작은 함수(`dups.py`), 주석 몫·줄 길이(`density.py`), 파일 묶음(`fam.py`), 문서 이름(`docs_scan.py`, `docs_dates.py`), 커밋 제목(`commits.py`), 조사 메모(`notes_en.md`, 영문 원자료) | `sh run_all.sh <본판 폴더>` |
| `leak/` | 8차 보고: 판을 이어 돌리며 판마다 청소 뒤 남은 것 세기(`leak_rounds.mjs`), 표(`table.mjs`), 소리·형상 내역(`rows_detail.mjs`), 결과(`runA.json` 무대 바뀜 10판, `runB.json` 같은 무대 6판), 메모(`notes_en.md`, 영문 원자료) | 본판에서 `npx vite --port 5193 --strictPort` 뒤 `node leak_rounds.mjs http://127.0.0.1:5193 "fps=1&weapon=longsword&emo=0" 10 runA.json 8` |
| `storage/` | 어떤 문서도 안 가리키는 `docs/handoff` 그림 목록, 본판에 이미 든 원격 브랜치 목록 | 목록 그대로 |

주의
- `perf/step_time.mjs`의 import 경로는 본판 워크트리의 `tools/sim/jelly_harness.mjs`를 가리키게 맞춘다.
- 9/30과 견줄 때는 `git archive 99da431 | tar -x -C <폴더>`로 옛 나무를 꺼내 같은 스크립트를 돌린다.
- 헤드리스 브라우저는 소프트웨어 그래픽이다. 그리기 호출·삼각형·셰이더 수를 GPU 부하의 대리값으로 본다.
- 싸움 결과는 혼돈계다. 1e-6 바꿈으로 잰 소음 폭 안의 차이는 "효과 없음"으로만 읽는다.
