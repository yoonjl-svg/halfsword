#!/bin/bash
# fix_chain.sh 의 둘째 줄 (부하 3.5 아래일 때만 함께): S=$S lane2.sh <칸> — 줄 A (r17 lane_a.sh) → 큰 뜀 (big_pd) → 막기 아홉 줄 json (칸만 · bw_250 은 이미 있음)
R=$(cd $(dirname $0) && pwd); P=/home/user/halfsword/docs/strike/physics2_proto/r17; S=${S:?}; c=$1; O=$S/r18
[ -f $O/A_${c}_DONE ] || bash $P/lane_a.sh $c $O
[ -f $O/BIG_${c}_DONE ] || bash $R/big_pd.sh $c $O
for a in longsword rapier zweihander; do ATK=$a DEF=longsword,rapier,zweihander SETS="0 a b" bash $R/parry_pair.sh $O $c; done
date > $O/L2_${c}_DONE
