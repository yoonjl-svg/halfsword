#!/bin/bash
# r27 재기 사슬 (떼어 돌림 · 한 번에 시뮬레이션 하나 · nice 15 · 부하 4.5 넘으면 기다림): S=<scratch> TREE=<이 나무> [NEW=new2] setsid nohup bash chain.sh > $S/r27/chain.log 2>&1 &
#  첫 판(NEW=new · 감쇠 셈에 h k 없음)은 C2 · C3 · C4 재기까지 돌고 멈춤(표 $S/r27/c234_v1.txt). 둘째 판(NEW=new2)은 C1 칸을 이 나무 src 로 다시 만들어 C1 을 다시 잰 뒤 사슬 전부.
#  차례: C1 (새 칸만 다시) → C2 · C3 · C4 재기 run_probe.sh (옛 = r24_om · 새 = lc_10_100) → 부호 검사 → C5 다리 묶음 두 칸 → C6 값 → C5 넘어짐 48 판(묶음 0 · 300 을 하나씩) → 표
#  끝 표시: $S/r27/DONE_<단계> (probe · sign · legs · cost · falls) · 마지막 $S/r27/DONE_chain
set -u
H=$(cd "$(dirname "$0")" && pwd); C=$S/p2/r6/mx/cells; R=$S/r27
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
NEW=${NEW:-new}
[ -f $R/DONE_c1_$NEW ] || { S=$S TREE=$TREE bash $H/mk_c1.sh > $R/mk_c1_$NEW.txt 2>&1; rm -f $R/c1/n100.* $R/c1/n1e4.* $R/c1/nroom.* $R/DONE_c1; S=$S TREE=$TREE bash $H/run_c1.sh; cp $R/c1/c1_table.txt $R/c1/c1_table_$NEW.txt; date -u +%T > $R/DONE_c1_$NEW; }
[ -d $C/lc_10_100 ] && diff -rq $TREE/src $C/lc_10_100/src > /dev/null || (S=$S node $H/mk_cells.mjs lc_10_100 > $R/mk_cells_$NEW.txt 2>&1)
[ -f $R/DONE_probe_$NEW ] || { bash $H/run_probe.sh old=$C/r24_om $NEW=$C/lc_10_100; node $H/analyze.mjs $R/probe old $NEW > $R/c234_$NEW.txt 2>&1; date -u +%T > $R/DONE_probe_$NEW; }
[ -f $R/DONE_sign ] || { wait_load; (cd $C/lc_10_100 && nice -n 15 node $H/sign_check.mjs --root=. > $R/sign_check.txt 2>&1); date -u +%T > $R/DONE_sign; }
mkdir -p $R/legs
[ -f $R/DONE_legs ] || { for p in old:r24_om new:lc_10_100; do t=${p%%:*}; c=${p#*:}; [ -s $R/legs/$t.json ] && continue; wait_load
  (cd $C/$c && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$R/legs/$t.json > $R/legs/$t.txt 2>&1); done; date -u +%T > $R/DONE_legs; }
[ -f $R/DONE_cost ] || bash $H/cost.sh $C/r24_om $C/lc_10_100
[ -f $R/DONE_falls ] || { for off in 0 300; do wait_load; OFFS=$off SCRATCH=$S bash $H/../r22/q2.sh lc_10_100; done
  TREE=/home/user/halfsword node $H/../r22/sum.mjs $S/p2/r10f2/out r24_om lc_10_100 --offs=0,300 > $R/falls_table.txt 2>&1; date -u +%T > $R/DONE_falls; }
date -u +%T > $R/DONE_chain
