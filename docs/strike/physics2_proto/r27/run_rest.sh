#!/bin/bash
# r27 남은 재기 (이끄는 이가 돌림 · 떼어서: S=<scratch> setsid nohup bash run_rest.sh > /dev/null 2>&1 &) — 한 번에 시뮬레이션 하나 · nice 15 · 1 분 부하 4.5 넘으면 기다림.
#  1) 단위 시험 (이 나무 · 하나씩) → $S/r27/rest/tests.txt · 실패 이름 tests_fail.txt · 39 이름($S/p2/r6/mx/bq_250/tests_fail.txt)에 없는 새 실패 new_fail.txt
#  2) 새 실패 가름: r24/tri.sh 가 아는 셋(막기 굴림 · 제비 베기 견줌 · 제비 베기 나감)이 들었으면 씨앗 1 ~ 8 로 tri.sh (이 나무 → tri_new.txt · 바탕 칸 r24_om → tri_base.txt) ·
#     그 밖의 새 실패는 이름 하나씩 이 나무와 바탕 칸 r24_om 에서 다시 돌려 둘 다 적음 (rerun.txt — 바탕에서도 지면 이 고침 탓이 아님)
#  3) 균형 관문 (칸 lc_10_100 · 씨앗 100-139 · --jobs=1) → gate.txt · gate.json (오늘 0.55 ~ 0.56)
#  끝 표시 $S/r27/DONE_rest · 표: node rest_table.mjs (이 폴더)
set -u
H=$(cd "$(dirname "$0")" && pwd); T=$(cd $H/../../../.. && pwd); O=$S/r27/rest; mkdir -p $O
C=$S/p2/r6/mx/cells; CELL=$C/lc_10_100; BASE=$C/r24_om
wait_load() { while awk '{exit !($1>4.5)}' /proc/loadavg; do sleep 20; done; }
[ -d $CELL ] || (S=$S node $H/mk_cells.mjs lc_10_100 > $O/mk.txt 2>&1)
# 1
[ -f $O/tests.done ] || { wait_load; ( cd $T && nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs > $O/tests.txt 2>&1 ); touch $O/tests.done; }
sed -nE 's/^ *not ok [0-9]+ - (.*)$/\1/p' $O/tests.txt | sed 's/ # .*$//' | sort -u > $O/tests_fail.txt
sort -u $S/p2/r6/mx/bq_250/tests_fail.txt > $O/old39.txt
comm -23 $O/tests_fail.txt $O/old39.txt > $O/new_fail.txt
# 2
[ -f $O/tri.done ] || {
  if grep -qE '막기 굴림|제비 베기' $O/new_fail.txt; then
    wait_load; nice -n 15 bash $H/../r24/tri.sh $T $O/tri_new.txt
    wait_load; nice -n 15 bash $H/../r24/tri.sh $BASE $O/tri_base.txt
  fi
  : > $O/rerun.txt
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    echo "$name" | grep -qE '판에서 쓰임: 막기 굴림|제비 베기 견줌 판|제비 베기: 나감' && continue
    pat=$(printf '%s' "$name" | sed 's/[][\.*^$()+?{}|]/\\&/g')
    for root in $T $BASE; do
      wait_load
      r=$(cd $root && nice -n 15 node --test --test-concurrency=1 --test-name-pattern="$pat" tools/sim/*.test.mjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')
      echo "$(basename $root) | $name | $r" >> $O/rerun.txt
    done
  done < $O/new_fail.txt
  touch $O/tri.done; }
# 3
[ -f $O/gate.done ] || { for t in balance_gate.mjs balance_scenes.mjs; do [ -f $CELL/tools/sim/$t ] || cp $T/tools/sim/$t $CELL/tools/sim/$t; done
  wait_load; ( cd $CELL && nice -n 15 node tools/sim/balance_gate.mjs --root=. --seeds=100-139 --jobs=1 --json=$O/gate.json > $O/gate.txt 2>&1 ); touch $O/gate.done; }
date -u +%T > $S/r27/DONE_rest
