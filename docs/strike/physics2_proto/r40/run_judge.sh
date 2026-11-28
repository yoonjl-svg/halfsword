#!/bin/bash
# r40 확인표 18 판정 — 선임의 판 9401 ~ 9420 (일꾼 없이 · nice 15)
#  S=<scratch> bash run_judge.sh   · 바탕 칸 $S/p2/r6/mx/cells/r32_a · 새 칸 $S/r40/cells/wrist25 · 나온 곳 $S/r40/judge/{base,new}/
#  바탕의 넘어짐 · 지문 · 단위 시험은 있는 것을 씀. 끝난 일은 건너뜀.
set -u
H=$(cd "$(dirname "$0")" && pwd); R23=$H/../r23; R37=$H/../r37; C0=$S/p2/r6/mx/cells/r32_a; C1=$S/r40/cells/wrist25; O=$S/r40/judge; mkdir -p $O/base $O/new $O/hcut
BL=9401-9420
{
echo "base|$C0|hcut|node $R37/wrist_split.mjs --root=. --scene=hcut --seeds=$BL --out=$O/hcut --tag=base > $O/base/hcut.txt 2>&1"
echo "new|$C1|hcut|node $R37/wrist_split.mjs --root=. --scene=hcut --seeds=$BL --out=$O/hcut --tag=new > $O/new/hcut.txt 2>&1"
echo "base|$C0|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_base --json=$O/base/gate.json > $O/base/gate.txt 2>&1"
echo "new|$C1|gate|node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_new --json=$O/new/gate.json > $O/new/gate.txt 2>&1"
for off in 0 300; do echo "new|$C1|fall_$off|node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/new/fall_$off.json --ringOut=$O/new/ring_$off.json > $O/new/fall_$off.txt 2>&1"; done
echo "new|$C1|fp|node $R23/fp_compare.mjs --root=. --json=$O/new/fp.json > $O/new/fp.txt 2>&1"
echo "new|$C1|tests|node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/new/tests.tap 2>&1; true"
# W5: 고친 새 도구와 옛 도구를 바탕 몸에 (판 9401 · 무기 셋)
for w in rapier longsword zweihander; do
echo "base|$C0|w5old_$w|node tools/sim/honesty.mjs --root=. --scene=stroke --weapon=$w --seed=9401 --json=$O/base/w5old_$w.json > $O/base/w5old_$w.txt 2>&1"
echo "base|$C0|w5new_$w|node $C1/tools/sim/honesty.mjs --root=. --scene=stroke --weapon=$w --seed=9401 --json=$O/base/w5new_$w.json > $O/base/w5new_$w.txt 2>&1"
done
} > $O/jobs.txt
