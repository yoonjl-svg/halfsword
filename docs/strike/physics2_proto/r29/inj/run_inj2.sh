#!/bin/bash
# r29 inj part 2 extra: mutation proof (ll_10_100 + ecc 1.3 + limit x1.25 == cell ll_13_125 walk results) and a dose test of the limit scale on the injured walk
#  S=<scratch> bash run_inj2.sh  (one process at a time · nice 15)
set -u
H=$(cd "$(dirname "$0")" && pwd); O=$S/r29/inj; C=$S/p2/r6/mx/cells
cd $C/ll_10_100
nice -n 15 node $H/inj_walk.mjs --root=. --str=1,0.8,0.5 --n=8 --secs=10 --ecc=1.3 --lim=1.25 --out=$O/walk_mut_13_125.json > /dev/null 2>&1
for L in 0.8 1.5 2; do nice -n 15 node $H/inj_walk.mjs --root=. --str=1,0.8,0.5 --n=8 --secs=10 --lim=$L --out=$O/walk_mut_10_$L.json > /dev/null 2>&1; done
node -e '
const fs=require("fs"),O=process.argv[1];
const a=JSON.parse(fs.readFileSync(O+"/walk_ll_13_125.json")).runs,b=JSON.parse(fs.readFileSync(O+"/walk_mut_13_125.json")).runs;
const same=a.length===b.length&&a.every((r,i)=>JSON.stringify(r)===JSON.stringify(b[i]));
console.log(`mutation proof walk (ll_10_100 + ecc 1.3 + x1.25 vs cell ll_13_125, ${a.length} runs): ${same?"IDENTICAL":"DIFFERENT"}`);
const m=(R,k)=>R.reduce((s,r)=>s+r[k],0)/R.length;
console.log("| limit scale (ecc 1.0) | str | falls | speed m/s | pelvis mean m | step length m |");console.log("|---|---|---|---|---|---|");
for (const [L,f] of [["0.8","walk_mut_10_0.8.json"],["1.0","walk_ll_10_100.json"],["1.25","walk_ll_10_125.json"],["1.5","walk_mut_10_1.5.json"],["2.0","walk_mut_10_2.json"]]) { const R=JSON.parse(fs.readFileSync(O+"/"+f)).runs;
 for (const t of [1,0.8,0.5]) { const X=R.filter(r=>r.target===t), ok=X.filter(r=>!r.fell); console.log(`| x${L} | ${t} | ${X.length-ok.length}/${X.length} | ${m(ok,"alongV").toFixed(3)} | ${m(ok,"yMean").toFixed(3)} | ${m(ok,"stepLen").toFixed(3)} |`);} }
' $O > $O/inj_dose.txt 2>&1
