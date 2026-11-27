#!/bin/bash
# r31 돌린 차례 (S=$S bash run.sh): 칸 만들기는 노트 '다시 돌리기' · 여기는 재기만 (시뮬 하나씩 · chain.sh 가 짐 평균 기다림)
S=${S:?}; R=$(cd $(dirname $0) && pwd); C=$R/chain.sh; MX=$S/p2/r6/mx
wl() { while :; do l=$(cut -d' ' -f1 /proc/loadavg); awk -v l=$l 'BEGIN{exit !(l<=4.5)}' && break; sleep 20; done; }
bash $C r31_om j12; bash $C r31_z0 j12; bash $C r31_ef j12; S=$S bash $R/z0_cmp.sh r31_om r31_z0
for c in r31_om r31_ef; do f=$S/r31/jz_$c.json; [ -s $f ] || { wl; cd $MX/cells/$c; ROOT=$MX/cells/$c OUT=$f nice -n 15 node --import file://$R/jump_zone.mjs tools/sim/fights12.mjs > $f.log 2>&1; }; python3 $R/jz.py $f 10 25 > $S/r31/jz_$c.txt; done
bash $C r31_s5 j12; bash $C r31_s20 j12
for c in r31_om r31_ef; do bash $C $c tri; bash $C $c fp; bash $C $c elb; done
for c in r31_ef r31_s5 r31_s20; do python3 $R/verdict.py $S/r31 r31_om $c > $S/r31/verdict_$c.txt; done
