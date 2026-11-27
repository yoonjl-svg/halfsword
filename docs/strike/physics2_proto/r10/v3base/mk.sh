#!/bin/bash
# 칸 셋 만들기: mk.sh — bw_250(main + 팔 근육 고침 셋째 판 + 다리 한도 250/250) 을 베끼고 넘어짐 도구(7ac4137c) · 고침 diff 를 넣음
# 쓰는 곳: $SCRATCH/p2/r6/mx/cells/fb_{base,bc,b} · diff 는 이 폴더의 bc.diff(= git diff 441c2e39 809c10ad -- src) · b.diff(그 둘째 덩이) · c.diff(첫째 · 셋째 덩이)
S=${SCRATCH:?흩어 놓는 곳}; W=$S/wt_falls; B=$S/p2/r6/mx/cells/bw_250; C=$S/p2/r6/mx/cells; P=$(dirname "$(readlink -f "$0")")
for n in fb_base fb_bc fb_b; do
  [ -e $C/$n ] && { echo "있음: $n"; continue; }
  cp -a $B $C/$n
  for f in fall_context fall_mech; do git -C $W show 7ac4137c:tools/sim/$f.mjs > $C/$n/tools/sim/$f.mjs; done
done
( cd $C/fb_bc && patch -p1 --dry-run < $P/bc.diff && patch -p1 -s < $P/bc.diff )
( cd $C/fb_b && patch -p1 --dry-run < $P/b.diff && patch -p1 -s < $P/b.diff )
git -C $W show 809c10ad:src/gait.js | diff -q - $C/fb_bc/src/gait.js && echo "fb_bc gait.js = 809c10ad"
