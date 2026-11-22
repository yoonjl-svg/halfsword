#!/bin/bash
# one heavy measurement at a time, low priority
S=$1; B=http://127.0.0.1:5311; cd $S/W/h
nice -n 10 timeout 900 node attack_input_line.mjs $B run   > $S/W/out/n032_run.txt 2>&1
nice -n 10 timeout 900 node attack_input_line.mjs $B guard > $S/W/out/n032_guard.txt 2>&1
nice -n 10 timeout 300 node blur_guard_light.mjs $B        > $S/W/out/n034_blur.txt 2>&1
nice -n 10 timeout 600 node cadence_blocked.mjs $B blocked > $S/W/out/n037_blocked.txt 2>&1
echo DONE > $S/W/out/seq1.done
