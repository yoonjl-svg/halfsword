#!/bin/bash
# 12 판 팔 명령 뜀(칼 팔 · 빈 팔): jump12.sh <출력 폴더> <칸 이름>... — 둘씩 함께 돌림
P=$(cd $(dirname $0) && pwd); O=$1; shift; MX=${S:?S = 작업 자리 뿌리}/p2/r6/mx; mkdir -p $O
run() { (cd $MX/cells/$1 && ROOT=$MX/cells/$1 LABEL=$1 node --import file://$P/arm_cmd2.mjs tools/sim/fights12.mjs > $O/j12_$1.txt 2>&1); }
while [ $# -gt 0 ]; do run $1 & [ -n "$2" ] && run $2 & wait; shift 2 2>/dev/null || shift; done
date > $O/J12_DONE
