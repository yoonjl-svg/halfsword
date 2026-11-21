#!/bin/bash
# run_smokes.sh <scratch> : the 8 browser checks that can fail, against the new main checkout (wt3)
#  preview of a production build for the ones that ask for it, dev server for skill_tree_layout / redondo
S=$1; cd "$S/wt3"
(timeout 600 npm run build > "$S/F3/build.log" 2>&1; echo "build exit $?" > "$S/F3/result.txt")
node node_modules/vite/bin/vite.js preview --port 5201 --strictPort > "$S/F3/preview.log" 2>&1 & P1=$!
node node_modules/vite/bin/vite.js --port 5391 --strictPort > "$S/F3/dev.log" 2>&1 & P2=$!
sleep 6
run(){ n=$1; url=$2; shift 2; mkdir -p "$S/F3/o_$n"; t0=$(date +%s); timeout 420 node tools/browser/$n.mjs "$url" "$S/F3/o_$n" "$@" > "$S/F3/$n.log" 2>&1; e=$?; echo "$n exit $e secs $(( $(date +%s) - t0 ))" >> "$S/F3/result.txt"; }
run game_entry_smoke http://127.0.0.1:5201
run ui_fix_smoke http://127.0.0.1:5201
run stamina_smoke http://127.0.0.1:5201
run hero_tear_smoke http://127.0.0.1:5201
run player_stiff_freeze http://127.0.0.1:5201
run mordschlag_real_check http://127.0.0.1:5201
SHOTS="$S/F3/o_skill_tree_layout" run skill_tree_layout http://127.0.0.1:5391
run redondo_motion_shots http://127.0.0.1:5391
kill $P1 $P2 2>/dev/null
echo ALLDONE >> "$S/F3/result.txt"
