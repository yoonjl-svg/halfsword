#!/bin/bash
# 뒤집힌 시험 가르기 (bw_250 · bx_250 · 하나씩): tri_bx.sh <출력 폴더>
P=$(cd $(dirname $0) && pwd); O=$1; MX=${S:?S = 작업 자리 뿌리}/p2/r6/mx; mkdir -p $O
for k in onehand:11,12,13,14,15,16,17,18 gl_ai:1,2,3,4,5,6,7,8 tap:1,2,3,4,5,6,7,8 itm:1,2,3,4,5,6,7,8; do c=${k%%:*}; s=${k#*:}
  for t in bw_250:comb bx_250:bx; do [ -s $O/tri_${c}_${t#*:}.jsonl ] || node $P/tri_bx.mjs $MX/cells/${t%%:*} $c $s > $O/tri_${c}_${t#*:}.jsonl 2>$O/tri_${c}_${t#*:}.err; done; done
date > $O/TRI_DONE
