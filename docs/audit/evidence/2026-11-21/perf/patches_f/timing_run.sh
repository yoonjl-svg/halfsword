#!/bin/bash
# alternate wa/wf, 3 rounds, 12 fights x 15 s, then team_perf once each
cd $(dirname $0); : > timing.txt
for r in 1 2 3; do for t in wa wf; do echo "r$r $t $(node st_$t.mjs 12 15 2>/dev/null)" >> timing.txt; done; done
for t in wa wf; do echo "team_perf $t" >> timing.txt; (cd $t && node tools/sim/team_perf.mjs --only=perf --counts=2,4,6 2>/dev/null) >> timing.txt; done
echo DONE >> timing.txt
