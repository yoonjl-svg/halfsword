#!/bin/bash
# r43 확인표 28 — 새 본판(fd9809cf) 위에서 다시 잼 · 선임의 판 9501 ~ 9540 (일꾼 없이 · nice 15) · r39 run_judge.sh 를 본뜸
#  S=<scratch> bash run_judge.sh   · 바탕 칸 $S/r43/cells/main_fd98 (= 본판 fd9809cf) · 새 칸 $S/r43/cells/ai_line_m (= 바탕 + r39/ai_line.patch) · 나온 곳 $S/r43/judge/{base,new}/
#  바탕의 넘어짐 · 지문 · 단위 시험은 r40 판정에서 같은 src 로 잰 것을 씀($S/r40/judge/new). 끝난 일은 건너뜀.
set -u
H=$(cd "$(dirname "$0")" && pwd); R23=$H/../r23; R39=$H/../r39; C0=$S/r43/cells/main_fd98; C1=$S/r43/cells/ai_line_m; O=$S/r43/judge; mkdir -p $O/base $O/new
BL=9501-9540
{
echo "base|$C0|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_base --json=$O/base/gate.json > $O/base/gate.txt 2>&1"
echo "new|$C1|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_new --json=$O/new/gate.json > $O/new/gate.txt 2>&1"
echo "base|$C0|trace|node $R39/ai_line_trace.mjs --root=. --out=$O/base --seeds=$BL --hon=0 --tag=base > $O/base/trace.txt 2>&1"
echo "new|$C1|trace|node $R39/ai_line_trace.mjs --root=. --out=$O/new --seeds=$BL --hon=0 --tag=new > $O/new/trace.txt 2>&1"
for off in 0 300; do echo "new|$C1|fall_$off|node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/new/fall_$off.json --ringOut=$O/new/ring_$off.json > $O/new/fall_$off.txt 2>&1"; done
echo "new|$C1|fp|node $R23/fp_compare.mjs --root=. --json=$O/new/fp.json > $O/new/fp.txt 2>&1"
echo "new|$C1|tests|node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/new/tests.tap 2>&1; true"
} > $O/jobs.txt
bash $S/run_jobs.sh $O
