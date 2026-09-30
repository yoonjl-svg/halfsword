#!/bin/bash
# Runs P_measure.mjs for every stage x config, one at a time, niced. Output: P_raw/<stage>_<cfg>.json, summary lines in P_runs.log
S=${S:-$(cd "$(dirname "$0")" && pwd)}  # 이 스크립트가 있는 폴더
cd $S
for st in ${STAGES:-poseidon clearing temple castle poseidon_night cathedral darkhall}; do
  for cfg in r1 r4 tiny4 tiny1; do
    case $cfg in
      r1) env= ; rate=1;; r4) env= ; rate=4;; tiny4) env=TINY=1; rate=4;; tiny1) env=TINY=1; rate=1;;
    esac
    env $env nice -n 10 node P_measure.mjs http://127.0.0.1:5190 $st $rate P_raw/${st}_${cfg}.json 15 2>&1 | tail -1 | tee -a P_runs.log
  done
done
echo ALLDONE >> P_runs.log
