#!/bin/bash
# r29 새 실패 · 새 통과 가름 + 할당 세기 + 같은 싸움의 벽시계 (떼어서: S=<scratch> setsid nohup bash run_tri.sh > $S/r29/tri.log 2>&1 &) — 한 번에 하나 · nice 15 · 부하 4.5 넘으면 기다림
#  바탕 나무 tt_10_100 = 이 나무 사본(본판 src 와 같은 수) · 새 나무 tt_13_125 (run_e3.sh 가 만든 것)
#  1) 런지 시험: tri_lunge.mjs 씨앗 1 ~ 8 (두 나무)
#  2) 제비 베기 견줌 판: schielhau_strike.test.mjs 의 tsubameRun(1, …) 씨앗만 1 ~ 8 로 바꾼 사본 (두 나무 · r24/tri.sh 와 같은 바꿈)
#  3) 새 실패 둘 · 새 통과 넷을 바탕 나무에서 이름 하나씩 다시 (그 시험 그대로)
#  4) alloc_probe.mjs (이 나무) · 5) fights12 벽시계 r24_om · ll_10_100 번갈아 다섯 짝 (같은 싸움이라 순수 값)
#  끝 표시 $S/r29/DONE_tri
set -u
H=$(cd "$(dirname "$0")" && pwd); T=$(cd $H/../../../.. && pwd); R=$S/r29; O=$R/tri; mkdir -p $O; C=$S/p2/r6/mx/cells
NT=$R/tt_13_125; BT=$R/tt_10_100
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
[ -d $BT ] || { mkdir -p $BT; tar -C $T --exclude=./.git --exclude=./node_modules -cf - . | tar -C $BT -xf -; ln -sfn /home/user/halfsword/node_modules $BT/node_modules; }
for p in new:$NT base:$BT; do t=${p%%:*}; root=${p#*:}
  [ -s $O/lunge_$t.txt ] || { wait_load; (cd $root && nice -n 15 node $H/tri_lunge.mjs --root=. > $O/lunge_$t.txt 2>&1); }
  [ -s $O/tsub_$t.txt ] || { sed 's/tsubameRun(1, { immortal: true, dur: 14, ghostDown: true })/tsubameRun(+process.env.R29_SEED, { immortal: true, dur: 14, ghostDown: true })/' $root/tools/sim/schielhau_strike.test.mjs > $root/tools/sim/_tri_sch.test.mjs
    for s in 1 2 3 4 5 6 7 8; do wait_load
      r=$(cd $root && R29_SEED=$s nice -n 15 node --test --test-name-pattern="제비 베기 견줌 판" tools/sim/_tri_sch.test.mjs 2>&1 | grep -E "^# (pass|fail)|^ +(\{|[0-9]+ !==|true !==|false !==)" | tr '\n' ' ')
      echo "씨앗 $s $r" >> $O/tsub_$t.txt; done; rm -f $root/tools/sim/_tri_sch.test.mjs; }
done
[ -s $O/rerun_base.txt ] || { cat $R/e3/new_fail.txt $R/e3/new_pass.txt | while IFS= read -r name; do [ -z "$name" ] && continue
    pat=$(printf '%s' "$name" | sed 's/[][\.*^$()+?{}|]/\\&/g'); wait_load
    r=$(cd $BT && nice -n 15 node --test --test-concurrency=1 --test-name-pattern="$pat" tools/sim/*.test.mjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')
    echo "$r | $name" >> $O/rerun_base.txt; done; }
[ -s $O/alloc.txt ] || { wait_load; (cd $T && nice -n 15 node $H/alloc_probe.mjs --secs=10 > $O/alloc.txt 2>&1); }
for i in 1 2 3 4 5; do for c in r24_om ll_10_100; do [ -s $O/wall_${c}_$i.txt ] && continue; wait_load
  (cd $C/$c && R29_ROOT=$C/$c nice -n 15 node --import file://$H/count_steps.mjs tools/sim/fights12.mjs > /dev/null 2> $O/wall_${c}_$i.txt); done; done
node -e '
const fs=require("fs"),O=process.argv[1];const g=(c)=>[1,2,3,4,5].map(i=>+fs.readFileSync(`${O}/wall_${c}_${i}.txt`,"utf8").match(/wall_per_sim ([\d.]+)/)[1]);
const a=g("r24_om"),b=g("ll_10_100"),r=a.map((x,i)=>b[i]/x),m=(v)=>v.reduce((s,x)=>s+x,0)/v.length,sd=(v)=>{const u=m(v);return Math.sqrt(v.reduce((s,x)=>s+(x-u)**2,0)/(v.length-1));};
const s=[...r].sort((x,y)=>x-y);
console.log(`벽시계 ÷ 흉내 낸 초 (fights12 · 같은 싸움 · 다섯 짝): r24_om ${a.join(" ")} · ll_10_100 ${b.join(" ")} · 짝마다 새÷바탕 ${r.map(x=>x.toFixed(3)).join(" ")} · 가운데 ${s[2].toFixed(3)} · 범위 ${s[0].toFixed(3)} ~ ${s[4].toFixed(3)} · 평균 ${m(r).toFixed(3)} · sd ${sd(r).toFixed(3)}`);' $O > $O/wall_same_table.txt
date -u +%T > $R/DONE_tri
