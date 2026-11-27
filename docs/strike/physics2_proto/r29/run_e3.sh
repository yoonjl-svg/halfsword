#!/bin/bash
# r29 E3 — 권하는 칸 ll_13_125 를 바탕 r24_om 과 견줌 (떼어서: S=<scratch> setsid nohup bash run_e3.sh > $S/r29/e3.log 2>&1 &)
#  한 번에 시뮬레이션 하나 · nice 15 · 1 분 부하 4.5 넘으면 기다림 · 끝난 단계는 건너뜀(다시 켜도 됨). 단계마다 끝 표시 $S/r29/DONE_e3_<단계> · 마지막 $S/r29/DONE_e3
#  falls : 144 판 = r22/q2.sh ll_13_125 를 묶음 0 300 600 624 648 672 하나씩 + ll_10_100 묶음 0 · 300 (r24_om 의 나옴과 cmp) → r22/sum.mjs 표
#  legs  : 다리 묶음 (롱소드 · n 8) ll_13_125 → legs_table.mjs (바탕 = E1 의 legs_r24_om.json)
#  cnt   : 재는 사본 ll_13_125_cnt 로 fights12 → cnt_table.mjs
#  wall  : fights12 를 r24_om · ll_13_125 번갈아 다섯 짝 (count_steps.mjs) → wall_table.txt
#  tests : 이 나무 사본 + ll_13_125 의 config($S/r29/tt_13_125)에서 단위 시험 → 39 이름과 견줌 (새 실패 · 새 통과)
#  gate  : 균형 관문 (씨앗 100-139 · --jobs=1) — tt_13_125 와 이 나무(본판 src 와 같은 수)
set -u
H=$(cd "$(dirname "$0")" && pwd); T=$(cd $H/../../../.. && pwd); C=$S/p2/r6/mx/cells; R=$S/r29; O=$R/e3; mkdir -p $O
OUT=$S/p2/r10f2/out
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
done_() { date -u +%T > $R/DONE_e3_$1; }
# falls
[ -f $R/DONE_e3_falls ] || {
  for off in 0 300 600 624 648 672; do wait_load; OFFS="$off" SCRATCH=$S bash $H/../r22/q2.sh ll_13_125; done
  for off in 0 300; do wait_load; OFFS="$off" SCRATCH=$S bash $H/../r22/q2.sh ll_10_100; done
  { for off in 0 300; do for f in fall_$off.json ring_$off.json fall_$off.txt; do
      if cmp -s $OUT/r24_om/$f $OUT/ll_10_100/$f; then echo "ll_10_100 대 r24_om $f: 같음"; else echo "ll_10_100 대 r24_om $f: 다름 ($(cmp $OUT/r24_om/$f $OUT/ll_10_100/$f 2>&1 | head -1))"; fi; done; done; } > $O/falls_same.txt
  TREE=/home/user/halfsword node $H/../r22/sum.mjs $OUT r24_om ll_10_100 ll_13_125 --offs=0,300,600,624,648,672 > $O/falls_table.txt 2>&1
  done_ falls; }
# legs
[ -f $R/DONE_e3_legs ] || { wait_load
  (cd $C/ll_13_125 && nice -n 15 node tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs_ll_13_125.json > $O/legs_ll_13_125.txt 2>&1)
  node $H/legs_table.mjs $R/e1/legs_r24_om.json $O/legs_ll_13_125.json > $O/legs_table.txt 2>&1; done_ legs; }
# cnt
[ -f $R/DONE_e3_cnt ] || { [ -d $C/ll_13_125_cnt ] || S=$S node $H/mk_cnt.mjs > $O/mk_cnt.txt 2>&1; wait_load
  (cd $C/ll_13_125_cnt && R29_CNT=$O/cnt.json nice -n 15 node --import file://$H/cnt_dump.mjs tools/sim/fights12.mjs > $O/cnt_fights.txt 2>&1)
  node $H/cnt_table.mjs $O/cnt.json > $O/cnt_table.txt 2>&1; done_ cnt; }
# wall
[ -f $R/DONE_e3_wall ] || {
  for i in 1 2 3 4 5; do for c in r24_om ll_13_125; do [ -s $O/wall_${c}_$i.txt ] && continue; wait_load
    (cd $C/$c && R29_ROOT=$C/$c nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > /dev/null 2> $O/wall_${c}_$i.txt); done; done
  node -e '
const fs=require("fs"),O=process.argv[1];const g=(c)=>[1,2,3,4,5].map(i=>+fs.readFileSync(`${O}/wall_${c}_${i}.txt`,"utf8").match(/wall_per_sim ([\d.]+)/)[1]);
const a=g("r24_om"),b=g("ll_13_125"),r=a.map((x,i)=>b[i]/x),m=(v)=>v.reduce((s,x)=>s+x,0)/v.length,sd=(v)=>{const u=m(v);return Math.sqrt(v.reduce((s,x)=>s+(x-u)**2,0)/(v.length-1));};
const s=[...r].sort((x,y)=>x-y);
console.log(`벽시계 ÷ 흉내 낸 초 (fights12 · 다섯 짝 · 번갈아): 바탕 ${a.join(" ")} (평균 ${m(a).toFixed(4)} · sd ${sd(a).toFixed(4)}) · 새 ${b.join(" ")} (평균 ${m(b).toFixed(4)} · sd ${sd(b).toFixed(4)})`);
console.log(`짝마다 새÷바탕 ${r.map(x=>x.toFixed(3)).join(" ")} · 가운데 ${s[2].toFixed(3)} · 가장 작음 ${s[0].toFixed(3)} · 가장 큼 ${s[4].toFixed(3)} · 평균 ${m(r).toFixed(3)} · sd ${sd(r).toFixed(3)}`);' $O > $O/wall_table.txt
  done_ wall; }
# tests
TT=$R/tt_13_125
[ -f $R/DONE_e3_tests ] || {
  rm -rf $TT; mkdir -p $TT; tar -C $T --exclude=./.git --exclude=./node_modules -cf - . | tar -C $TT -xf -
  ln -sfn /home/user/halfsword/node_modules $TT/node_modules; cp $C/ll_13_125/src/config.js $TT/src/config.js
  diff -r $T/src $TT/src > $O/tt_src_diff.txt; diff -rq $T/tools $TT/tools > $O/tt_tools_diff.txt
  wait_load; (cd $TT && nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs > $O/tests.txt 2>&1)
  sed -nE 's/^ *not ok [0-9]+ - (.*)$/\1/p' $O/tests.txt | sed 's/ # .*$//' | sort -u > $O/tests_fail.txt
  sort -u $S/p2/r6/mx/bq_250/tests_fail.txt > $O/old39.txt
  comm -23 $O/tests_fail.txt $O/old39.txt > $O/new_fail.txt; comm -13 $O/tests_fail.txt $O/old39.txt > $O/new_pass.txt
  done_ tests; }
# gate
[ -f $R/DONE_e3_gate ] || {
  for p in new:$TT base:$T; do t=${p%%:*}; root=${p#*:}; [ -s $O/gate_$t.json ] && continue; wait_load
    (cd $root && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=1 --json=$O/gate_$t.json > $O/gate_$t.txt 2>&1); done
  done_ gate; }
date -u +%T > $R/DONE_e3
