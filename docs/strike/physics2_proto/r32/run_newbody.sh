#!/bin/bash
# r32 찌르기 가 · 가+나를 오늘 본판 몸에서 다시 재기 (일꾼 없이 · 떼어서 · 한 번에 둘까지 · nice 15): S=<scratch> setsid nohup bash run_newbody.sh > /dev/null 2>&1 &
#  줄은 physics2_notes/r32_thrust_newbody.md (재기 앞에 적음). 칸 r32_om · r32_a · r32_ab = r23_base 사본에 이 가지의 src · tools · data (+ 패치). 끝난 일은 건너뜀.
#  나온 곳 $S/r32/<칸>/ · 표 $S/r32/table_{a,ab}.txt · one_event.txt · tests_{a,ab}.txt · 끝 표시 $S/r32/DONE
set -u
H=$(cd "$(dirname "$0")" && pwd); REPO=$(cd $H/../../../.. && pwd); C=$S/p2/r6/mx/cells; O=$S/r32; R28=$H/../r28; R23=$H/../r23; mkdir -p $O
mk() { # 칸 이름 · 패치(없으면 빈 글)
  [ -d $C/$1 ] && return; cp -a $C/r23_base $C/$1 && (cd $C/$1 && rm -rf src tools data && cp -a $REPO/src src && cp -a $REPO/tools tools && cp -a $REPO/data data && { [ -z "$2" ] || patch -p1 -s < $2; }) || { echo "칸 만들기 실패 $1" >> $O/log.txt; exit 1; }; }
mk r32_om ""; mk r32_a $R28/chamber.patch; mk r32_ab $R28/timing2.patch
{ diff -rq $C/r32_om/src $REPO/src | wc -l; diff -rq $C/r32_om/src $C/r32_a/src; diff -rq $C/r32_om/src $C/r32_ab/src; } > $O/cells_check.txt 2>&1
one() { n=$1; k=$2; shift 2; mkdir -p $O/$n; [ -f $O/$n/$k.done ] && return; ( cd $C/r32_$n && "$@" ) && touch $O/$n/$k.done; }
export -f one; export C O R28 R23 H
J=$O/jobs.txt; : > $J
for n in om a ab; do for BL in 7001-7040 4001-4040 4041-4080 5001-5040 6001-6040; do echo "$n gate_$BL bash -c 'nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_$n --json=$O/$n/gate_$BL.json > $O/$n/gate_$BL.txt 2>&1'" >> $J; done; done
for n in om a ab; do for off in 0 300; do echo "$n fall_$off bash -c 'nice -n 15 node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/$n/fall_$off.json --ringOut=$O/$n/ring_$off.json > $O/$n/fall_$off.txt 2>&1'" >> $J; done; done
for n in om a ab; do echo "$n fp bash -c 'nice -n 15 node $R23/fp_compare.mjs --root=. --json=$O/$n/fp.json > /dev/null 2>&1'" >> $J; done
for n in om a ab; do for a in "1" "2" "2 --seed=3" "1 rapier"; do k=fin_$(echo $a | tr -d ' =-'); echo "$n $k bash -c 'nice -n 15 node tools/sim/finish_thrust.mjs $a --rows > $O/$n/$k.txt 2>&1'" >> $J; done; done
for n in om a; do echo "$n itm bash -c 'nice -n 15 node $R28/it_measure.mjs --root=. > $O/$n/it_measure.txt 2>&1'" >> $J; done
for n in a ab; do echo "$n tests bash -c 'nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/$n/tests.tap 2>&1; true'" >> $J; done
xargs -P2 -L1 bash -c 'eval "one $0 $1 ${@:2}"' < $J
# 표
for n in a ab; do
  node $R28/table.mjs --base=$O/om/gate_4001-4040.json,$O/om/gate_4041-4080.json,$O/om/gate_5001-5040.json,$O/om/gate_6001-6040.json,$O/om/gate_7001-7040.json --cell=$O/$n/gate_4001-4040.json,$O/$n/gate_4041-4080.json,$O/$n/gate_5001-5040.json,$O/$n/gate_6001-6040.json,$O/$n/gate_7001-7040.json --names=A,B,5001,6001,7001 --json=$O/table_$n.json > $O/table_$n.txt 2>&1
  node $R23/fp_compare.mjs --a=$O/om/fp.json --b=$O/$n/fp.json --json=$O/fp_cmp_$n.json > $O/fp_cmp_$n.txt 2>&1
  grep '^not ok' $O/$n/tests.tap | sed 's/^not ok [0-9]* - //' | sort -u > $O/tests_fail_$n.txt
  comm -23 $O/tests_fail_$n.txt <(sort -u $H/../r29/tests/fail_37_decided.txt) > $O/tests_new_fail_$n.txt; comm -13 $O/tests_fail_$n.txt <(sort -u $H/../r29/tests/fail_37_decided.txt) > $O/tests_new_pass_$n.txt
done
G() { echo "$O/$1/gate_4001-4040.json,$O/$1/gate_4041-4080.json,$O/$1/gate_5001-5040.json,$O/$1/gate_6001-6040.json,$O/$1/gate_7001-7040.json"; }
node $R23/one_event.mjs "오늘 본판=$(G om)" "가=$(G a)" "가+나=$(G ab)" > $O/one_event.txt 2>&1
date -u +%T > $O/DONE
