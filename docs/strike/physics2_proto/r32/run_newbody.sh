#!/bin/bash
# r32 찌르기 가 · 가+나를 오늘 본판 몸에서 다시 재기 (일꾼 없이 · 떼어서 · 한 번에 둘까지 · nice 15): S=<scratch> setsid nohup bash run_newbody.sh > /dev/null 2>&1 &
#  줄은 physics2_notes/r32_thrust_newbody.md (재기 앞에 적음). 칸 r32_om · r32_a · r32_ab = r23_base 사본에 이 가지의 src · tools · data (+ 패치). 끝난 일은 건너뜀.
#  나온 곳 $S/r32b/<칸>/ · 표 $S/r32b/table_{a,ab}.txt · one_event.txt · tests_new_fail_{a,ab}.txt · 끝 표시 $S/r32b/DONE
#  (첫 판은 일 줄의 따옴표가 풀려 아무것도 안 돌고 끝 표시만 남겼다 — 나온 곳을 r32b 로 바꾸고 일 줄을 한 줄 = 한 명령으로 고침.)
set -u
H=$(cd "$(dirname "$0")" && pwd); REPO=$(cd $H/../../../.. && pwd); C=$S/p2/r6/mx/cells; O=$S/r32b; R28=$H/../r28; R23=$H/../r23; mkdir -p $O
mk() { # 칸 이름 · 패치(없으면 빈 글)
  [ -d $C/$1 ] && return
  cp -a $C/r23_base $C/$1 && (cd $C/$1 && rm -rf src tools data && cp -a $REPO/src src && cp -a $REPO/tools tools && cp -a $REPO/data data && { [ -z "$2" ] || patch -p1 -s --no-backup-if-mismatch < $2; }) || { echo "칸 만들기 실패 $1" >> $O/log.txt; exit 1; }
}
mk r32_om ""; mk r32_a $R28/chamber.patch; mk r32_ab $R28/timing2.patch
{ echo "r32_om 대 가지 src 다른 파일 수: $(diff -rq $C/r32_om/src $REPO/src | wc -l)"; diff -rq $C/r32_om/src $C/r32_a/src; diff -rq $C/r32_om/src $C/r32_ab/src; } > $O/cells_check.txt 2>&1
# 일 하나: 칸 · 이름 · 명령(한 글) — 칸 폴더에서 돌리고, 잘 끝나면 끝 표시
one() { local n=$1 k=$2 cmd=$3; mkdir -p $O/$n; [ -f $O/$n/$k.done ] && return 0; ( cd $C/r32_$n && bash -c "$cmd" ) && touch $O/$n/$k.done; }
export -f one; export C O
J=$O/jobs.txt; : > $J
for n in om a ab; do for BL in 7001-7040 4001-4040 4041-4080 5001-5040 6001-6040; do
  echo "one $n gate_$BL \"nice -n 15 node tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_$n --json=$O/$n/gate_$BL.json > $O/$n/gate_$BL.txt 2>&1\"" >> $J
done; done
for n in om a ab; do for off in 0 300; do
  echo "one $n fall_$off \"nice -n 15 node tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/$n/fall_$off.json --ringOut=$O/$n/ring_$off.json > $O/$n/fall_$off.txt 2>&1\"" >> $J
done; done
for n in om a ab; do
  echo "one $n fp \"nice -n 15 node $R23/fp_compare.mjs --root=. --json=$O/$n/fp.json > $O/$n/fp.txt 2>&1\"" >> $J
  echo "one $n fin_1 \"nice -n 15 node tools/sim/finish_thrust.mjs 1 --rows > $O/$n/fin_1.txt 2>&1\"" >> $J
  echo "one $n fin_2 \"nice -n 15 node tools/sim/finish_thrust.mjs 2 --rows > $O/$n/fin_2.txt 2>&1\"" >> $J
  echo "one $n fin_34 \"nice -n 15 node tools/sim/finish_thrust.mjs 2 --seed=3 --rows > $O/$n/fin_34.txt 2>&1\"" >> $J
  echo "one $n fin_r1 \"nice -n 15 node tools/sim/finish_thrust.mjs 1 rapier --rows > $O/$n/fin_r1.txt 2>&1\"" >> $J
done
for n in om a; do echo "one $n itm \"nice -n 15 node $R28/it_measure.mjs --root=. > $O/$n/it_measure.txt 2>&1\"" >> $J; done
for n in a ab; do echo "one $n tests \"nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > $O/$n/tests.tap 2>&1; true\"" >> $J; done
xargs -P2 -d '\n' -I{} bash -c '{}' < $J
# 표 (시뮬 없음)
G() { echo "$O/$1/gate_4001-4040.json,$O/$1/gate_4041-4080.json,$O/$1/gate_5001-5040.json,$O/$1/gate_6001-6040.json,$O/$1/gate_7001-7040.json"; }
for n in a ab; do
  node $R28/table.mjs --base=$(G om) --cell=$(G $n) --names=A,B,5001,6001,7001 --json=$O/table_$n.json > $O/table_$n.txt 2>&1
  node $R23/fp_compare.mjs --a=$O/om/fp.json --b=$O/$n/fp.json --json=$O/fp_cmp_$n.json > $O/fp_cmp_$n.txt 2>&1
  for f in fin_1 fin_2 fin_34 fin_r1; do cmp -s $O/om/$f.txt $O/$n/$f.txt && echo "$f 같음" || echo "$f 다름"; done > $O/fin_cmp_$n.txt
  grep '^not ok' $O/$n/tests.tap | sed 's/^not ok [0-9]* - //' | sort -u > $O/tests_fail_$n.txt
  sort -u $H/../r29/tests/fail_37_decided.txt > $O/fail37.sorted
  comm -23 $O/tests_fail_$n.txt $O/fail37.sorted > $O/tests_new_fail_$n.txt
  comm -13 $O/tests_fail_$n.txt $O/fail37.sorted > $O/tests_new_pass_$n.txt
done
node $R23/one_event.mjs "오늘 본판=$(G om)" "가=$(G a)" "가+나=$(G ab)" > $O/one_event.txt 2>&1
ls $O/om/*.done $O/a/*.done $O/ab/*.done 2>/dev/null | wc -l > $O/done_count.txt
date -u +%T > $O/DONE
