#!/bin/bash
# 상한 몸의 값 칸 다섯 × 묶음 여섯(144 판) — 한 번에 하나 · nice 19. 부르기: S=<흩어 놓는 곳> setsid nohup bash run_cells.sh <q2.sh 자리> > /dev/null 2>&1 &
Q=${1:?q2.sh}; M=$S/r27/lead/DONE_cells; rm -f $M
for off in 0 300 600 624 648 672; do for c in lc_10_100 lc_13_125 lc_13_100 lc_10_125 lc_13_125_h4; do
  OFFS="$off" SCRATCH=$S nice -n 19 bash $Q $c >> $S/r27/lead/run_cells.log 2>&1
done; done
date -u +%T > $M
