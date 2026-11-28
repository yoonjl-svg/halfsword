#!/bin/bash
# r35 갈래 (다) 재기 — AI 의 쉼 무게 목표에서 손가락 댐을 뺀 한 줄 칸(idlefree)을 선임의 판으로 (일꾼 없이 · 한 번에 둘 · nice 15)
#  S=<scratch> bash run_c.sh   · 바탕 칸 $S/p2/r6/mx/cells/r32_a · 새 칸 $S/r35/cells/idlefree · 나온 곳 $S/r35/judge/{base,new}/ · 끝 표시 $S/r35/judge/DONE
#  바탕의 넘어짐 · 지문 · 단위 시험은 있는 것을 씀($S/r32b/a/fall_{0,300}.json · fp.json · tests.tap). 끝난 일은 건너뜀.
set -u
H=$(cd "$(dirname "$0")" && pwd); R23=$H/../r23; C0=$S/p2/r6/mx/cells/r32_a; C1=$S/r35/cells/idlefree; O=$S/r35/judge; mkdir -p $O/base $O/new
one() { local d=$1 c=$2 k=$3 cmd=$4; [ -f $O/$d/$k.done ] && return 0; ( cd $c && bash -c "$cmd" ) && touch $O/$d/$k.done; }
export -f one; export O
J=$O/jobs.txt; : > $J
BL=9101-9140
echo "one base $C0 gate_$BL \"nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_base --json=$O/base/gate_$BL.json > $O/base/gate_$BL.txt 2>&1\"" >> $J
echo "one new $C1 gate_$BL \"nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_new --json=$O/new/gate_$BL.json > $O/new/gate_$BL.txt 2>&1\"" >> $J
for off in 0 300; do
  echo "one new $C1 fall_$off \"nice -n 15 node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/new/fall_$off.json --ringOut=$O/new/ring_$off.json > $O/new/fall_$off.txt 2>&1\"" >> $J
done
echo "one new $C1 fp \"nice -n 15 node $R23/fp_compare.mjs --root=. --json=$O/new/fp.json > $O/new/fp.txt 2>&1\"" >> $J
echo "one new $C1 tests \"nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/new/tests.tap 2>&1; true\"" >> $J
xargs -P2 -d '\n' -I{} bash -c '{}' < $J
touch $O/DONE
