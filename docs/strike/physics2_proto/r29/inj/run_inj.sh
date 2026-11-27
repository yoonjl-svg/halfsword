#!/bin/bash
# r29 inj part 2 runner: S=<scratch> bash run_inj.sh   (one process at a time · nice 15)
set -u
H=$(cd "$(dirname "$0")" && pwd); O=$S/r29/inj; C=$S/p2/r6/mx/cells; mkdir -p $O
(cd $C/ll_10_100 && nice -n 15 node $H/leg_readers.mjs --root=. --out=$O/readers.txt > /dev/null 2>&1)
for c in ll_10_100 ll_10_125 ll_13_100 ll_13_125; do
  (cd $C/$c && nice -n 15 node $H/inj_walk.mjs --root=. --str=1,0.8,0.5 --n=8 --secs=10 --out=$O/walk_$c.json > $O/walk_$c.txt 2>&1)
done
node $H/inj_table.mjs $O > $O/inj_table.txt 2>&1
