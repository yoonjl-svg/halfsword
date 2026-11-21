#!/bin/bash
# 디렉터 성능 합침 확인: 관문(바탕 대 새 본판) → 시간(바탕 · (a)만 · 새 본판 번갈아 5회) → 무리 싸움 2회씩
cd $(dirname $0)
./gates.sh $PWD/base base > /dev/null 2>&1
./gates.sh $PWD/new new > /dev/null 2>&1
: > timing.txt
for r in 1 2 3 4 5; do for t in base wa new; do echo "r$r $t $(nice -n 10 node st_$t.mjs 12 15 2>/dev/null)" >> timing.txt; done; done
for r in 1 2; do for t in base wa new; do echo "team r$r $t" >> timing.txt; (cd $t && nice -n 10 node tools/sim/team_perf.mjs --only=perf --counts=2,4,6 2>/dev/null | grep fighters) >> timing.txt; done; done
echo DONE >> timing.txt
