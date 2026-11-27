#!/bin/bash
# r18 마지막 칸 재기 차례 (다시 돌려도 됨 · 많아야 시뮬 둘): final_chain.sh <칸> — 줄 A · B (r17 pipe_bz.sh) → 빈 팔 큰 뜀(big_pd) → 막기 아홉 줄 json (bw_250 · 칸, 간격 세 벌)
R=$(cd $(dirname $0) && pwd); P=/home/user/halfsword/docs/strike/physics2_proto/r17; S=${S:?}; c=$1; O=$S/r18
[ -f $O/PIPE_${c}_DONE ] || bash $P/pipe_bz.sh $c $O
[ -f $O/BIG_${c}_DONE ] || bash $R/big_pd.sh $c $O
for a in longsword rapier zweihander; do [ -f $O/PP_DONE_${a}0ab ] || ATK=$a DEF=longsword,rapier,zweihander SETS="0 a b" bash $R/parry_pair.sh $O bw_250 $c; done
date > $O/FINAL_${c}_DONE
