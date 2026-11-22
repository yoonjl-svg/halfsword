#!/bin/bash
S=$1; B=http://127.0.0.1:4187; cd $S/wk1
(nohup nice -n 10 node node_modules/vite/bin/vite.js preview --port 4187 --strictPort > $S/W/preview.log 2>&1 &); sleep 4
cd $S/W/h; : > $S/W/out/g10_window.txt
for d in 0 6 12 24 40 70; do for r in 1 2 3; do nice -n 10 timeout 200 node g10_window.mjs $B frozen $d $r >> $S/W/out/g10_window.txt 2>&1; done; done
for r in 1 2 3 4; do nice -n 10 timeout 200 node g10_window.mjs $B ai 0 $r >> $S/W/out/g10_window.txt 2>&1; done
pkill -f "vite.js preview --port 4187"
echo DONE > $S/W/out/seq3.done
