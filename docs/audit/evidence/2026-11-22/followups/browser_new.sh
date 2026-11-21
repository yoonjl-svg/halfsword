#!/bin/bash
# browser_new.sh <scratch> : leak rounds (10, default stage order) and idle screens on the new main checkout (wt3)
S=$1; cd "$S/wt3"
node node_modules/vite/bin/vite.js --port 5193 --strictPort > "$S/F2/dev.log" 2>&1 & P=$!
sleep 6
cd "$S/F2/b"
timeout 900 node leak_rounds.mjs http://127.0.0.1:5193 "fps=1&weapon=longsword&emo=0" 10 "$S/F2/leak_new.json" 8 > "$S/F2/leak_new.log" 2>&1
timeout 600 node idle_screens.mjs http://127.0.0.1:5193 > "$S/F2/idle_new.log" 2>&1
cp idle_screens.json "$S/F2/idle_new.json" 2>/dev/null
kill $P 2>/dev/null
echo ALLDONE
