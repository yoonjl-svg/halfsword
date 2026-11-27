#!/bin/bash
# 뒤집힌 시험 가르기 차례 (하나씩): tri_q.sh <기다릴 표지> <출력 폴더> <칸>...
P=$(cd $(dirname $0) && pwd); S=${S:?}; MX=$S/p2/r6/mx; W=$1; O=$2; shift 2
until [ -f $W ]; do sleep 30; done
for c in "$@"; do [ -s $O/tri_iai5_$c.jsonl ] || node $P/tri_iai5.mjs $MX/cells/$c > $O/tri_iai5_$c.jsonl 2> $O/tri_iai5_$c.err; done
date > $O/TRI_DONE
