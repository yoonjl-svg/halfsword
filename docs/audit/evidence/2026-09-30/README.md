# 감사 증거 (2026-09-30 첫 최적화 감사)

보고서 `docs/audit/2026-09-30.md`의 숫자를 다시 내는 스크립트. 게임 파일은 고치지 않는다. 모두 **복사본(워크트리)**에서 돈다.

## 1. 무대별 브라우저 측정 (O-001~O-003, `perf_baseline.md`)
```
git -C /home/user/halfsword worktree add --detach /tmp/pm origin/main
ln -s /home/user/halfsword/node_modules /tmp/pm/node_modules; npm i --no-save playwright
(cd /tmp/pm && npx vite --port 5190 --strictPort &)
cd docs/audit/evidence/2026-09-30 && mkdir -p P_raw
./P_run_all.sh && node P_table.mjs > P_table.md                       # 7무대 × {r1, r4, tiny1, tiny4}
TINY=1 nice -n 10 node P_profile.mjs http://127.0.0.1:5190 poseidon_night 4 P_raw/prof   # CPU·메모리 프로파일
TINY=1 NOSHADOW=1 nice -n 10 node P_measure.mjs http://127.0.0.1:5190 temple 1 P_raw/ns.json 15   # 그림자 끔 비교
```
- r1/r4 = CPU 느리게 하지 않음/4배. tiny = 그리는 판을 8×4로 줄여 CPU·그리기 호출·그림자 패스만 남긴 것이다. 헤드리스는 소프트웨어 그래픽이라 화면 채우기 시간이 폰과 다르다.
- 화면 844×390, DPR 3 → 게임이 2로 자름 → 1688×780. AI 대 AI 15 초 표본 + 5 초 추적.

## 2. 판정 갈래 세기·끄기 (O-004, O-005)
```
git -C /home/user/halfsword worktree add --detach /tmp/jm origin/main && cd /tmp/jm
ln -s /home/user/halfsword/node_modules node_modules
git apply /home/user/halfsword/docs/audit/evidence/2026-09-30/instr_full.patch   # 켜진 횟수 세기 + 끄기 스위치 (환경변수로만 켜짐)
cp /home/user/halfsword/docs/audit/evidence/2026-09-30/J_*.mjs tools/sim/
J_COUNTS=1 nice -n 10 node tools/sim/J_fights.mjs                 # 36판(hybrid) 갈래별 횟수
J_COUNTS=1 J_ABL=<이름> nice -n 10 node tools/sim/J_fights.mjs     # 한 갈래를 끄고 비교 (이름은 patch 안 J_ABL 비교문)
```
- 세기 장치를 넣은 판은 원본과 36판 끝 상태가 씨앗마다 같았다.
- 소음 폭(1e-6 바꿈): 죽음 24~27/36, 플레이어 승 12~19, 넘어짐 46~62. 이 폭 안의 차이는 "효과 없음"이지 "0의 증명"이 아니다.
