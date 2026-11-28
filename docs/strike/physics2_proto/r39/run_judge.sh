#!/bin/bash
# r39 확인표 28 판정 — 선임의 판 9201 ~ 9240 (일꾼 없이 · nice 15) · r35 run_c.sh 를 본뜸
#  S=<scratch> bash run_judge.sh   · 바탕 칸 $S/p2/r6/mx/cells/r32_a · 새 칸 $S/r39/cells/ai_line · 나온 곳 $S/r39/judge/{base,new}/
#  바탕의 넘어짐 · 지문 · 단위 시험은 있는 것을 씀($S/r32b/a · $S/r35/judge/tests_fail_base.txt). 끝난 일은 건너뜀.
set -u
H=$(cd "$(dirname "$0")" && pwd); R23=$H/../r23; C0=$S/p2/r6/mx/cells/r32_a; C1=$S/r39/cells/ai_line; O=$S/r39/judge; mkdir -p $O/base $O/new
BL=9201-9240
{
echo "base|$C0|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_base --json=$O/base/gate.json > $O/base/gate.txt 2>&1"
echo "new|$C1|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_new --json=$O/new/gate.json > $O/new/gate.txt 2>&1"
echo "base|$C0|trace|node $H/ai_line_trace.mjs --root=. --out=$O/base --seeds=$BL --hon=0 --tag=base > $O/base/trace.txt 2>&1"
echo "new|$C1|trace|node $H/ai_line_trace.mjs --root=. --out=$O/new --seeds=$BL --hon=0 --tag=new > $O/new/trace.txt 2>&1"
for off in 0 300; do echo "new|$C1|fall_$off|node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/new/fall_$off.json --ringOut=$O/new/ring_$off.json > $O/new/fall_$off.txt 2>&1"; done
echo "new|$C1|fp|node $R23/fp_compare.mjs --root=. --json=$O/new/fp.json > $O/new/fp.txt 2>&1"
echo "new|$C1|tests|node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/new/tests.tap 2>&1; true"
} > $O/jobs.txt
