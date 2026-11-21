#!/bin/bash
D=$(cd $(dirname $0); pwd); cd $D; : > timing.jsonl
for r in 1 2 3; do for t in base wa wb wd work; do
  echo "{\"tree\":\"$t\",\"run\":$r,\"res\":$(nice -n 10 node step_time.mjs 12 15 $D/$t 2>/dev/null)}" >> timing.jsonl
done; done
for t in base wb work; do echo "== $t" >> team_perf.txt; (cd $D/$t && nice -n 10 node tools/sim/team_perf.mjs --only=perf --counts=2,4,6 2>/dev/null) >> team_perf.txt; done
