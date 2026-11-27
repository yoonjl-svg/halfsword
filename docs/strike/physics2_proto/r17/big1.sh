#!/bin/bash
# 빈 팔 큰 뜀 형편 다시 (bw_250 · 씨앗 1 ~ 12 · 팔꿈치 쪽 |pDir| 더함): big1.sh <기다릴 표지> <출력 폴더>
P=$(cd $(dirname $0) && pwd); S=${S:?}; D=$S/p2/r6/mx/cells/bw_250; O=$2
until [ -f $1 ]; do sleep 30; done
(cd $D && OFFT=100 ROOT=$D LABEL=bw_250-1 node --import file://$P/arm_big.mjs tools/sim/fights12.mjs > $O/big_bw_1_pd.txt 2>&1)
date > $O/BIGPD_DONE
