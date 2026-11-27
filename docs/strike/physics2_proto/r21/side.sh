#!/bin/bash
# r21 곁 읽기: SCRATCH=$S bash side.sh — 첫 걸음 넘어짐 줄이 끝난 뒤(끝 표시를 기다림) 균형 관문 셋 · 뛰기 hop 관문 하나를 차례로(각각 안에서 둘까지). 끝난 것은 건너뜀.
R=${SCRATCH:?}/r21; C=$SCRATCH/p2/r6/mx/cells
until [ -f "$R/DONE_fb_base_sa_dem_sa_dem2_sb_body_sc_aid0_sc_aid2_0_300" ]; do sleep 30; done
for c in sb_body sc_aid0 sc_aid2; do
  [ -s $R/gate_$c.json ] && continue
  ( cd $C/$c && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=2 --json=$R/gate_$c.json.tmp > $R/gate_$c.txt 2>&1 ) && mv $R/gate_$c.json.tmp $R/gate_$c.json
done
[ -s $R/hop_body.txt ] || ( cd $R/wt_run_body && nice -n 15 node tools/sim/run_gate.mjs --stage=hop --seeds=0-7 --jobs=2 --out=$R/hop_cache --fresh > $R/hop_body.txt.tmp 2>&1; mv $R/hop_body.txt.tmp $R/hop_body.txt )
date -u +%T > $R/DONE_side
