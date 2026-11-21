#!/bin/bash
cd $(dirname $0); : > timing.txt
for r in 1 2 3 4 5; do for t in wa w1 w2 w3 wall; do echo "r$r $t $(node st_$t.mjs 12 15 2>/dev/null)" >> timing.txt; done; done
for t in wa wall; do echo "team_perf $t" >> timing.txt; (cd $t && node tools/sim/team_perf.mjs --only=perf --counts=2,4,6 2>/dev/null) >> timing.txt; done
echo DONE >> timing.txt
