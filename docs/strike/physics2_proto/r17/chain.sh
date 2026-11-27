#!/bin/bash
# r17 뒤 차례 (줄 A 하나씩 · 줄 B 하나씩): bz 줄 A 끝 → 고친 칸 고리 재기 → 큰 뜀 형편(bw) → bz2 줄 A  ||  bz 줄 B 끝 → bz2 묶음
P=$(cd $(dirname $0) && pwd); S=${S:?}; O=$S/r17; MX=$S/p2/r6/mx
A() { until [ -f $O/A_bz_250_DONE ]; do sleep 30; done
  [ -f $O/off_pr_off2.txt ] || { mkdir -p $O/off_pr_off2; node $P/off_probe.mjs --root=$O/pr_off2 --csv=$O/off_pr_off2 > $O/off_pr_off2.txt 2>&1; }
  [ -f $O/BIG_DONE ] || bash $P/big_q.sh $O/A_bz_250_DONE $O
  PROBE= bash $P/lane_a.sh bz2_250 $O; }
B() { until [ -f $O/B_bz_250_DONE ]; do sleep 30; done
  [ -f $MX/bz2_250/DONE ] || bash $MX/cell.sh bz2_250
  [ -f $MX/bz2_250/EXTRA_DONE ] || bash $MX/extra.sh bz2_250
  [ -f $MX/bz2_250/PARRYX_DONE ] || bash $MX/parry_x.sh bz2_250
  date > $O/B_bz2_250_DONE; }
A & B & wait; date > $O/CHAIN_DONE
