#!/bin/bash
# run_verify.sh <scratch> : base vs checkShaderErrors=false, interleaved, 1x, 3 runs each
S=$1; cd "$S/V2"
node node_modules/vite/bin/vite.js preview --outDir "$S/C2/dist" --port 5198 --strictPort > "$S/C2/pv_base.log" 2>&1 & P1=$!
node node_modules/vite/bin/vite.js preview --outDir "$S/C2/dist_nocheck" --port 5199 --strictPort > "$S/C2/pv_var.log" 2>&1 & P2=$!
sleep 4
cd "$S/C2"
for k in 1 2 3; do
  timeout 500 node q2_hitch.mjs http://127.0.0.1:5198 1 "out/v_base_$k.json" 4 1 2>&1 | tail -3 | cut -c1-300
  timeout 500 node q2_hitch.mjs http://127.0.0.1:5199 1 "out/v_nock_$k.json" 4 1 2>&1 | tail -3 | cut -c1-300
done
kill $P1 $P2 2>/dev/null
echo ALLDONE
