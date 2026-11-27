#!/bin/bash
# 12 판 팔 명령 뜀 · 둘째 씨앗 묶음(13 ~ 24): jump12b.sh <출력 폴더> <칸 이름>... — 둘씩 함께
P=$(cd $(dirname $0) && pwd); O=$1; shift; MX=${S:?S = 작업 자리 뿌리}/p2/r6/mx; mkdir -p $O
run() { (cd $MX/cells/$1 && ROOT=$MX/cells/$1 LABEL=$1 SEED0=12 node --import file://$P/arm_cmd2.mjs $P/fights_blk.mjs > $O/j12b_$1.txt 2>&1); }
while [ $# -gt 0 ]; do run $1 & [ -n "$2" ] && run $2 & wait; shift 2 2>/dev/null || shift; done
date > $O/J12B_DONE
