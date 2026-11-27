#!/bin/bash
# r29 inj part 3 runner: S=<scratch> bash run_cnt2.sh  (one process at a time · nice 15)
#  builds $S/p2/r6/mx/cells/ll_13_125_cnt2, runs fights12 in it three times: as is (ecc 1.3 · x1.25), with LEGS.ecc 1.0 (= cell ll_10_125), with ecc 1.0 and limit /1.25 (= cell ll_10_100);
#  plain fights12 in cells ll_13_125 · ll_10_125 · ll_10_100 for the identity proof of each instrumented run; then the table.
set -u
H=$(cd "$(dirname "$0")" && pwd); O=$S/r29/inj; C=$S/p2/r6/mx/cells
[ -d $C/ll_13_125_cnt2 ] || S=$S node $H/mk_cnt2.mjs > $O/mk_cnt2.txt 2>&1
for c in ll_13_125 ll_10_125 ll_10_100; do [ -s $O/f12_$c.txt ] || (cd $C/$c && nice -n 15 node tools/sim/fights12.mjs > $O/f12_$c.txt 2>&1); done
cd $C/ll_13_125_cnt2
[ -s $O/w2_13_125.json ] || R29_W2=$O/w2_13_125.json nice -n 15 node --import file://$H/cnt2_dump.mjs tools/sim/fights12.mjs > $O/f12_cnt2_13_125.txt 2>&1
[ -s $O/w2_10_125.json ] || R29_ECC=1.0 R29_W2=$O/w2_10_125.json nice -n 15 node --import file://$H/cnt2_dump.mjs tools/sim/fights12.mjs > $O/f12_cnt2_10_125.txt 2>&1
[ -s $O/w2_10_100.json ] || R29_ECC=1.0 R29_LIMDIV=1.25 R29_W2=$O/w2_10_100.json nice -n 15 node --import file://$H/cnt2_dump.mjs tools/sim/fights12.mjs > $O/f12_cnt2_10_100.txt 2>&1
node $H/cnt2_table.mjs $O > $O/cnt2_table.txt 2>&1
