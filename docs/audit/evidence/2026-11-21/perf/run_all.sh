#!/bin/bash
cd "$(dirname "$0")"
for st in ${STAGES:-poseidon clearing temple castle poseidon_night cathedral}; do
  for cfg in ${CFGS:-r4 tiny4 tiny1}; do
    case $cfg in r1) env= ; rate=1;; r4) env= ; rate=4;; tiny4) env=TINY=1; rate=4;; tiny1) env=TINY=1; rate=1;; esac
    env $env nice -n 10 node P_measure.mjs http://127.0.0.1:5191 $st $rate P_raw/${st}_${cfg}.json 15 2>&1 | tail -1 | cut -c1-1200 | tee -a P_runs.log
  done
done
echo ALLDONE >> P_runs.log
