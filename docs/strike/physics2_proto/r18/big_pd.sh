#!/bin/bash
# 빈 팔 큰 뜀 (> OFFT° · 기본 100) 두 묶음 + |pDir|: big_pd.sh <칸> <출력 폴더> — 두 묶음 차례로 (시뮬 하나 — 11/27 기계가 붐벼서)
P=/home/user/halfsword/docs/strike/physics2_proto/r17; R9=$P/../r9b; R=$(cd $(dirname $0) && pwd); S=${S:?}; c=$1; D=$S/p2/r6/mx/cells/$c; O=$2; mkdir -p $O
[ -s $O/big_${c}_1.txt ] || (cd $D && OFFT=${OFFT:-100} ROOT=$D LABEL=$c-1 node --import file://$R/pd_tap.mjs --import file://$P/arm_big.mjs tools/sim/fights12.mjs > $O/big_${c}_1.txt 2>&1)
[ -s $O/big_${c}_2.txt ] || (cd $D && OFFT=${OFFT:-100} ROOT=$D LABEL=$c-2 SEED0=12 node --import file://$R/pd_tap.mjs --import file://$P/arm_big.mjs $R9/fights_blk.mjs > $O/big_${c}_2.txt 2>&1)
wait; date > $O/BIG_${c}_DONE
