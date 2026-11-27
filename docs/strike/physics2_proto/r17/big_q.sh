#!/bin/bash
# 큰 뜀 형편 재기 (bw_250 · 두 씨앗 묶음 · 하나씩): big_q.sh <기다릴 표지> <출력 폴더>
P=$(cd $(dirname $0) && pwd); R9=$P/../r9b; S=${S:?}; D=$S/p2/r6/mx/cells/bw_250; O=$2
until [ -f $1 ]; do sleep 30; done
(cd $D && OFFT=${OFFT:-170} ROOT=$D LABEL=bw_250-1 node --import file://$P/arm_big.mjs tools/sim/fights12.mjs > $O/big_bw_1${OFFT:+_o$OFFT}.txt 2>&1)
(cd $D && OFFT=${OFFT:-170} ROOT=$D LABEL=bw_250-2 SEED0=12 node --import file://$P/arm_big.mjs $R9/fights_blk.mjs > $O/big_bw_2${OFFT:+_o$OFFT}.txt 2>&1)
date > $O/BIG${OFFT}_DONE
