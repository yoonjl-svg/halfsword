#!/bin/bash
# bx_250 재기 차례 (하나씩 · 많아야 둘 함께): 12 판 뜀 둘째 묶음 → arm_real D 재기 → 단위 시험 → 묶음(cell.sh · extra.sh · parry_x.sh)
P=$(cd $(dirname $0) && pwd); S=${S:?S = 작업 자리 뿌리}; MX=$S/p2/r6/mx; O=$S/r9x; c=bx_250; D=$MX/cells/$c; OC=$MX/$c; mkdir -p $O $OC
until [ -f $O/J12_DONE ]; do sleep 20; done
[ -f $O/J12B_DONE ] || $P/jump12b.sh $O bx_250 bw_250 bf_4_120 bv_250
ALL=longsword:up,longsword:left,longsword:upLeft,longsword:right,balisarda:left,rapier:left
if [ ! -f $O/ARMSD_DONE ]; then
  for x in bf_4_120 bw_250 bx_250; do mkdir -p $O/armsD_$x; done
  node $P/arms_d_probe.mjs --root=$MX/cells/bf_4_120 --cells=$ALL --csv=$O/armsD_bf_4_120 > $O/armsD_bf_4_120.txt 2>&1 &
  node $P/arms_d_probe.mjs --root=$MX/cells/bw_250 --cells=$ALL --csv=$O/armsD_bw_250 > $O/armsD_bw_250.txt 2>&1 & wait
  node $P/arms_d_probe.mjs --root=$MX/cells/bx_250 --cells=$ALL --csv=$O/armsD_bx_250 > $O/armsD_bx_250.txt 2>&1
  date > $O/ARMSD_DONE
fi
if [ ! -f $OC/TESTS_DONE ]; then ( cd $D && node --test --test-concurrency=2 tools/sim/*.test.mjs > $OC/tests.txt 2>&1 ); grep "^not ok" $OC/tests.txt | sed 's/^not ok [0-9]* - //' | sort > $OC/tests_fail.txt; date -u +%T > $OC/TESTS_DONE; fi
[ -f $OC/DONE ] || bash $MX/cell.sh $c
[ -f $OC/EXTRA_DONE ] || bash $MX/extra.sh $c
[ -f $OC/PARRYX_DONE ] || bash $MX/parry_x.sh $c
date > $O/PIPE_DONE
