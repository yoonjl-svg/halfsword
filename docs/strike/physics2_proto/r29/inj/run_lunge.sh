#!/bin/bash
# r29 inj part 1 runner: S=<scratch> bash run_lunge.sh   (one process at a time · nice 15)
#  1) mutation proof: cell ll_10_100 with --ecc=1.3 --lim=1.25 must give the same events (same steps) as cell ll_13_125
#  2) seeds 1-8 at 3.2 m in base and new (seed sensitivity)
#  3) distance grid 3.0 .. 3.4 m in every value cell (seed 1)
set -u
H=$(cd "$(dirname "$0")" && pwd); O=$S/r29/inj; C=$S/p2/r6/mx/cells; mkdir -p $O
run() { local cell=$1 tag=$2; shift 2; (cd $C/$cell && nice -n 15 node $H/lunge_trace.mjs --root=. "$@" --out=$O/lg_$tag.json > $O/lg_$tag.txt 2>&1); }
run ll_13_125 proof_cell --gaps=3.2,2.2 --seeds=1
run ll_10_100 proof_mut --gaps=3.2,2.2 --seeds=1 --ecc=1.3 --lim=1.25
run r24_om seeds_base --gaps=3.2 --seeds=1,2,3,4,5,6,7,8
run ll_13_125 seeds_new --gaps=3.2 --seeds=1,2,3,4,5,6,7,8
G=3.0,3.05,3.1,3.15,3.2,3.25,3.3,3.35,3.4
for c in r24_om ll_10_100 ll_13_100 ll_10_125 ll_117_125 ll_13_125 ll_14_125; do run $c grid_$c --gaps=$G --seeds=1; done
# extra pairs by mutation (ll_10_100): ecc 1.3 with limit x1.1 · ecc 1.0 limit x1.25 cross-check · ecc 1.2 limit x1.25
run ll_10_100 grid_m13_110 --gaps=$G --seeds=1 --ecc=1.3 --lim=1.1
run ll_10_100 grid_m12_125 --gaps=$G --seeds=1 --ecc=1.2 --lim=1.25
node $H/lunge_table.mjs $O > $O/lunge_table.txt 2>&1
