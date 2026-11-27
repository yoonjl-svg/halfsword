#!/bin/bash
# 마무리 찌르기만 (cell.sh 의 첫 두 줄과 같은 명령 · 짝 맞댐 fin_pair.py 용): S=$S fin_only.sh <칸> — 출력 $S/p2/r6/mx/<칸>/fin_rows_{1,2}.txt
S=${S:?}; MX=$S/p2/r6/mx; c=$1; D=$MX/cells/$c; O=$MX/$c; mkdir -p $O; cd $D
[ -s $O/fin_rows_1.txt ] || node tools/sim/finish_thrust.mjs 1 --rows > $O/fin_rows_1.txt 2>&1
[ -s $O/fin_rows_2.txt ] || node tools/sim/finish_thrust.mjs 2 --rows > $O/fin_rows_2.txt 2>&1
date > $O/FIN_DONE
