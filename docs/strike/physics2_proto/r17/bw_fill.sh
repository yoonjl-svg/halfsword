#!/bin/bash
# bw_250 에 없던 묶음 줄 채우기 (cell.sh 의 마무리 찌르기 · 12 판 · 막기 · 베기 느낌 · req 줄 + extra.sh + parry_x.sh) — 하나씩
S=${S:?S = 작업 자리 뿌리}; MX=$S/p2/r6/mx; BT=$S/wt_b5m; TAG=${1:-bw_250}; D=$MX/cells/$TAG; O=$MX/$TAG; cd $D
node tools/sim/finish_thrust.mjs 1 --rows > $O/fin_rows_1.txt 2>&1
node tools/sim/finish_thrust.mjs 2 --rows > $O/fin_rows_2.txt 2>&1
node $BT/tools/sim/finish_sum.mjs s1=$O/fin_rows_1.txt > $O/fin_sum.txt 2>&1
node $BT/tools/sim/finish_sum.mjs s2=$O/fin_rows_2.txt >> $O/fin_sum.txt 2>&1
ROOT=$D LABEL=$TAG-f12 node --import file:///home/user/halfsword/tools/sim/arm_cmd_probe.mjs tools/sim/fights12.mjs > $O/fights12.txt 2>&1
node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $O/parry.txt 2>&1
node tools/sim/swing_feel.mjs longsword > $O/swing_longsword.txt 2>&1
node $BT/tools/sim/req_probe.mjs --root=$D --n=8 --json=$O/req.json > $O/req.txt 2>&1
node $S/p2/r5/sum.mjs $O $TAG > $O/summary.txt 2>&1
cat $O/fin_sum.txt >> $O/summary.txt
grep -h "막음" $O/parry.txt | cut -c1-90 >> $O/summary.txt
grep -h "^팔 명령" $O/fights12.txt >> $O/summary.txt
bash $MX/extra.sh $TAG
bash $MX/parry_x.sh $TAG
date -u +%T > $O/FILL_DONE
