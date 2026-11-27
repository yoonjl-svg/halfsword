#!/bin/bash
# r17 재기 차례: pipe_bz.sh <칸> <출력 폴더> [bw]  — 두 줄(A · B)로 많아야 둘 함께
#  A: 12 판 뜀 두 묶음 → arm_real D 재기 → 단위 시험(한 줄씩)   B: (bw 이면 bw_250 채우기 먼저) → 칸 묶음 cell · extra · parry_x
P=$(cd $(dirname $0) && pwd); R9=$P/../r9b; S=${S:?S = 작업 자리 뿌리}; MX=$S/p2/r6/mx; c=$1; O=$2; D=$MX/cells/$c; OC=$MX/$c; mkdir -p $O $OC
ALL=longsword:up,longsword:left,longsword:upLeft,longsword:right,balisarda:left,rapier:left
laneA() {
  [ -f $O/j12_$c.txt ] || (cd $D && ROOT=$D LABEL=$c node --import file://$R9/arm_cmd2.mjs tools/sim/fights12.mjs > $O/j12_$c.txt 2>&1)
  [ -f $O/j12b_$c.txt ] || (cd $D && ROOT=$D LABEL=$c SEED0=12 node --import file://$R9/arm_cmd2.mjs $R9/fights_blk.mjs > $O/j12b_$c.txt 2>&1)
  [ -f $O/armsD_$c.txt ] || { mkdir -p $O/armsD_$c; node $R9/arms_d_probe.mjs --root=$D --cells=$ALL --csv=$O/armsD_$c > $O/armsD_$c.txt 2>&1; }
  if [ ! -f $OC/TESTS_DONE ]; then ( cd $D && node --test --test-concurrency=1 tools/sim/*.test.mjs > $OC/tests.txt 2>&1 ); grep "^not ok" $OC/tests.txt | sed 's/^not ok [0-9]* - //' | sort > $OC/tests_fail.txt; date -u +%T > $OC/TESTS_DONE; fi
  date > $O/A_${c}_DONE
}
laneB() {
  [ "$3" = bw ] && { [ -f $MX/bw_250/FILL_DONE ] || bash $P/bw_fill.sh bw_250; }
  [ -f $OC/DONE ] || bash $MX/cell.sh $c
  [ -f $OC/EXTRA_DONE ] || bash $MX/extra.sh $c
  [ -f $OC/PARRYX_DONE ] || bash $MX/parry_x.sh $c
  date > $O/B_${c}_DONE
}
laneA & laneB "$@" & wait
date > $O/PIPE_${c}_DONE
