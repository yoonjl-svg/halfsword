#!/bin/bash
# run.sh <scratch> : down_ai.mjs (player knocked down and kept down, enemy AI acts freely) on old (wt2) and new (wt3) main
S=$1
for w in wt2 wt3; do ( cd $S/$w; for W in longsword kriegsmesser rapier zweihander uchigatana hwando; do node tools/sim/down_ai.mjs 6 $W 12 2>/dev/null | grep "^전체" | sed "s/^/$W /"; done > $S/F6/down_$w.txt; echo "$w done" >> $S/F6/log.txt ) & done
wait; echo ALLDONE >> $S/F6/log.txt
