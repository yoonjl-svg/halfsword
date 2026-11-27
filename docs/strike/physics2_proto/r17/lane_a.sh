#!/bin/bash
# r17 줄 A (하나씩): lane_a.sh <칸> <출력 폴더> — 12 판 뜀 두 묶음 → arm_real D 재기 → (있으면) 빈손 비킴 고리 재기 → 단위 시험
P=$(cd $(dirname $0) && pwd); R9=$P/../r9b; S=${S:?S = 작업 자리 뿌리}; MX=$S/p2/r6/mx; c=$1; O=$2; D=$MX/cells/$c; OC=$MX/$c; mkdir -p $O $OC
ALL=longsword:up,longsword:left,longsword:upLeft,longsword:right,balisarda:left,rapier:left
[ -f $O/j12_$c.txt ] || (cd $D && ROOT=$D LABEL=$c node --import file://$R9/arm_cmd2.mjs tools/sim/fights12.mjs > $O/j12_$c.txt 2>&1)
[ -f $O/j12b_$c.txt ] || (cd $D && ROOT=$D LABEL=$c SEED0=12 node --import file://$R9/arm_cmd2.mjs $R9/fights_blk.mjs > $O/j12b_$c.txt 2>&1)
[ -f $O/armsD_$c.txt ] || { mkdir -p $O/armsD_$c; node $R9/arms_d_probe.mjs --root=$D --cells=$ALL --csv=$O/armsD_$c > $O/armsD_$c.txt 2>&1; }
for t in $PROBE; do [ -f $O/off_$t.txt ] || { mkdir -p $O/off_$t; node $P/off_probe.mjs --root=$O/$t --csv=$O/off_$t > $O/off_$t.txt 2>&1; }; done
if [ ! -f $OC/TESTS_DONE ]; then ( cd $D && node --test --test-concurrency=1 tools/sim/*.test.mjs > $OC/tests.txt 2>&1 ); grep "^not ok" $OC/tests.txt | sed 's/^not ok [0-9]* - //' | sort > $OC/tests_fail.txt; date -u +%T > $OC/TESTS_DONE; fi
date > $O/A_${c}_DONE
