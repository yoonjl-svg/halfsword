#!/bin/bash
# r33 런지 — 선임의 판정 재기 (일꾼 없이 · 떼어서 · 한 번에 셋 · nice 15): S=<scratch> setsid nohup bash run_judge.sh > /dev/null 2>&1 &
#  줄은 physics2_notes/r33_lunge.md §5 (짓기 앞에 적음). 칸: base = r32_a (본판 + 휘둘림 고침 가) · new = r33_j (그 위에 lunge.patch · mk_cell.sh 로 만듦).
#  런지 장면 씨앗은 짓는 쪽이 안 본 7001 ~ 7020 · 8001 ~ 8020. 관문 다섯 묶음 · 싸움 · 지문 · 마무리 찌르기 · 단위 시험의 바탕은 $S/r32b/a (같은 칸 r32_a 로 앞서 잰 것).
#  나온 곳 $S/r33j/<base|new>/ · 끝 표시 $S/r33j/DONE · 끝난 일은 건너뜀. 표는 judge_tab.mjs 가 따로 냄.
set -u
H=$(cd "$(dirname "$0")" && pwd); C=$S/p2/r6/mx/cells; O=$S/r33j; R28=$H/../r28; R23=$H/../r23; mkdir -p $O
cell() { [ "$1" = base ] && echo r32_a || echo r33_j; }
one() { local n=$1 k=$2 cmd=$3; mkdir -p $O/$n; [ -f $O/$n/$k.done ] && return 0; ( cd $C/$(cell $n) && bash -c "$cmd" ) && touch $O/$n/$k.done; }
export -f one cell; export C O
J=$O/jobs.txt; : > $J
for n in base new; do for SD in 7001-7020 8001-8020; do
  echo "one $n scene_w_$SD \"nice -n 15 node $H/lunge_scene.mjs --root=. --seeds=$SD --adds=0,0.15,0.3,0.45 --walk=0.6 --json=$O/$n/scene_w_$SD.json > $O/$n/scene_w_$SD.txt 2>&1\"" >> $J
  echo "one $n scene_p_$SD \"nice -n 15 node $H/lunge_scene.mjs --root=. --seeds=$SD --adds=0,0.15,0.3,0.45 --walk=0 --json=$O/$n/scene_p_$SD.json > $O/$n/scene_p_$SD.txt 2>&1\"" >> $J
  echo "one $n rec_$SD \"nice -n 15 node $H/lunge_recover.mjs --root=. --seeds=$SD --adds=0.3,0.45 --walk=0.6 --json=$O/$n/rec_$SD.json > $O/$n/rec_$SD.txt 2>&1\"" >> $J
  echo "one $n feel_$SD \"nice -n 15 node $H/read_feel.mjs --root=. --seeds=$SD --adds=0.3,0.45 --mode=dbl,back --json=$O/$n/feel_$SD.json > $O/$n/feel_$SD.txt 2>&1\"" >> $J
  echo "one $n hon_$SD \"nice -n 15 node $H/lunge_honesty.mjs --root=. --seeds=${SD%-*}-$(( ${SD%-*} + 9 )) --adds=0.3,0.45 --walk=0.6 --json=$O/$n/hon_$SD.json > $O/$n/hon_$SD.txt 2>&1\"" >> $J
done
  echo "one $n fpiw \"nice -n 15 node $H/fp_idle_walk.mjs --root=. --json=$O/$n/fpiw.json > $O/$n/fpiw.txt 2>&1\"" >> $J
  echo "one $n aifar \"nice -n 15 node $H/lunge_ai_far.mjs --root=. --seeds=7001-7010 --secs=30 --json=$O/$n/aifar.json > $O/$n/aifar.txt 2>&1\"" >> $J
done
n=new
for BL in 7001-7040 4001-4040 4041-4080 5001-5040 6001-6040; do
  echo "one $n gate_$BL \"nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_$n --json=$O/$n/gate_$BL.json > $O/$n/gate_$BL.txt 2>&1\"" >> $J
done
for off in 0 300; do
  echo "one $n fall_$off \"nice -n 15 node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/$n/fall_$off.json --ringOut=$O/$n/ring_$off.json > $O/$n/fall_$off.txt 2>&1\"" >> $J
done
echo "one $n fp \"nice -n 15 node $R23/fp_compare.mjs --root=. --json=$O/$n/fp.json > $O/$n/fp.txt 2>&1\"" >> $J
echo "one $n fin_1 \"nice -n 15 node tools/sim/finish_thrust.mjs 1 --rows > $O/$n/fin_1.txt 2>&1\"" >> $J
echo "one $n fin_2 \"nice -n 15 node tools/sim/finish_thrust.mjs 2 --rows > $O/$n/fin_2.txt 2>&1\"" >> $J
echo "one $n fin_34 \"nice -n 15 node tools/sim/finish_thrust.mjs 2 --seed=3 --rows > $O/$n/fin_34.txt 2>&1\"" >> $J
echo "one $n fin_r1 \"nice -n 15 node tools/sim/finish_thrust.mjs 1 rapier --rows > $O/$n/fin_r1.txt 2>&1\"" >> $J
echo "one $n tests \"nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/$n/tests.tap 2>&1; true\"" >> $J
xargs -P3 -d '\n' -I{} bash -c '{}' < $J
ls $O/base/*.done $O/new/*.done 2>/dev/null | wc -l > $O/done_count.txt
date -u +%T > $O/DONE
