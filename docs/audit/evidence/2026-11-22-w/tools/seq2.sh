#!/bin/bash
# continues after seq1: still one heavy measurement at a time, low priority
S=$1; B=http://127.0.0.1:5311; cd $S/W/h
until [ -f $S/W/out/seq1.done ]; do sleep 3; done
: > $S/W/out/n036_kneel.txt
for D in 1.2 1.5 1.7 1.75 1.8 1.85 1.9 2.2; do nice -n 10 timeout 300 node kneeling_foe_tap.mjs $B $D 1 longsword german >> $S/W/out/n036_kneel.txt 2>&1; done
for ws in "uchigatana japanese" "rapier italian" "kriegsmesser german" "hwando chinese"; do set -- $ws; for D in 1.3 1.5 1.7 1.9 2.1 2.3; do nice -n 10 timeout 300 node kneeling_foe_tap.mjs $B $D 1 $1 $2 >> $S/W/out/n036_kneel.txt 2>&1; done; done
echo DONE > $S/W/out/seq2a.done
nice -n 10 timeout 1500 node suite.mjs $B $S/W/out/suite_main.jsonl all 1 > $S/W/out/suite_main.log 2>&1
echo DONE > $S/W/out/seq2b.done
for i in 1 2 3; do nice -n 10 timeout 600 node q3_cards.mjs $B $S/W/out/stall_wait1500_$i.json 4 > $S/W/out/stall_wait1500_$i.txt 2>&1; done
for i in 1 2; do RESULT_WAIT_MS=300 nice -n 10 timeout 600 node q3_cards.mjs $B $S/W/out/stall_wait300_$i.json 4 > $S/W/out/stall_wait300_$i.txt 2>&1; done
echo DONE > $S/W/out/seq2c.done
nice -n 10 timeout 300 node result_panel.mjs $B > $S/W/out/result_panel.txt 2>&1
nice -n 10 timeout 900 node leak_rounds.mjs $B "fps=1&weapon=longsword&emo=0" 10 $S/W/out/leak_main.json > $S/W/out/leak_main.txt 2>&1
echo DONE > $S/W/out/seq2.done
