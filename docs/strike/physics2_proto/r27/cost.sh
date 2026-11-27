#!/bin/bash
# r27 C6 값: 옛 칸과 새 칸을 번갈아 세 번씩 (한 번에 하나 · nice 15 · 부하 4.5 넘으면 기다림) — r24/count_steps.mjs 로 벽시계 ÷ 흉내 낸 초.
#  쓰는 법: S=<scratch> TREE=<이 나무> bash cost.sh <옛 칸> <새 칸> → $S/r27/cost/<a|b>_<i>.txt · 표 $S/r27/cost/table.txt · 끝 표시 $S/r27/DONE_cost
set -u
O=$S/r27/cost; mkdir -p $O; CS=file://$TREE/docs/strike/physics2_proto/r24/count_steps.mjs
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
A=$1; B=$2
for i in 1 2 3; do for tag in a b; do root=$A; [ $tag = b ] && root=$B
  wait_load
  (cd $root && R24_ROOT=$root nice -n 15 node --import $CS tools/sim/fights12.mjs > /dev/null 2> $O/${tag}_$i.txt)
done; done
node -e '
const fs=require("fs"),O=process.argv[1];const g=(t)=>[1,2,3].map(i=>+fs.readFileSync(`${O}/${t}_${i}.txt`,"utf8").match(/wall_per_sim ([\d.]+)/)[1]);
const a=g("a"),b=g("b");const r=a.map((x,i)=>b[i]/x);const m=(v)=>v.reduce((s,x)=>s+x,0)/v.length;
console.log(`C6 벽시계 ÷ 흉내 낸 초 (fights12 · 세 짝): 옛 ${a.join(" ")} · 새 ${b.join(" ")} · 짝마다 새÷옛 ${r.map(x=>x.toFixed(3)).join(" ")} · 평균 ${m(r).toFixed(3)} → ${m(r)<=1.03?"PASS":"FAIL"} (문턱 1.03)`);' $O > $O/table.txt
date -u +%T > $S/r27/DONE_cost
