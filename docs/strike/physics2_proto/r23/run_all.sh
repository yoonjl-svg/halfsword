#!/bin/bash
# r23 T1 재기 줄 (한 번에 시뮬레이션 하나 · nice 15 · 끝난 것은 건너뜀 — 다시 불러도 됨)
#  부르기: setsid nohup bash run_all.sh <S> [칸 이름] [나옴] > /dev/null 2>&1 &   (S = 흩어 놓는 곳 · 칸 $S/p2/r6/mx/cells/<칸 이름 · 기본 r23_t1> · 바탕 칸 r23_base · 나옴 기본 $S/r23)
#  끝 표시: <나옴>/<일>.done · 다 끝나면 <나옴>/all.done  (읽기 지적 뒤 고친 칸은 r23_t1r · 나옴 $S/r23/repair)
S=${1:?}; CN=${2:-r23_t1}; C=$S/p2/r6/mx/cells; T=$C/$CN; B=$C/r23_base; O=${3:-$S/r23}; D=$(cd "$(dirname "$0")" && pwd); R20=$D/../r20; mkdir -p $O
N="nice -n 15 node"
step() { [ -f $O/$1.done ] && return; shift; "$@" && touch $O/$1.done; }
run() { local k=$1; shift; [ -f $O/$k.done ] && return; ( "$@" ) && touch $O/$k.done; }
# 1 지문 (r20 도구 그대로 + r23 견줌)
run fp bash -c "cd $T && $N $R20/fingerprint.mjs --root=. --compare=$R20/fingerprint.json > $O/fp_r20cmp.txt 2>&1 && $N $D/fp_compare.mjs --root=$B --json=$O/fp23_base.json > /dev/null 2>&1 && $N $D/fp_compare.mjs --root=. --json=$O/fp23_$CN.json > /dev/null 2>&1 && node $D/fp_compare.mjs --a=$O/fp23_base.json --b=$O/fp23_$CN.json --json=$O/fp23_cmp.json > $O/fp23_cmp.txt 2>&1"
# 2 관문 두 묶음
for BL in 4001-4040 4041-4080; do run gate_$BL bash -c "cd $T && $N tools/sim/wb_gate.mjs --root=. --seeds=$BL --cache=$O/cache_t1 --json=$O/gate_$BL.json > $O/gate_$BL.txt 2>&1"; done
# 3 싸움 48 판 넘어짐 (H5 · 바탕 = $S/p2/r10f2/out/fb_base_r21)
for off in 0 300; do run fall_$off bash -c "mkdir -p $O/fb/$CN && cd $T && $N tools/sim/fall_context.mjs --fights=24 --offset=$off --rows --all --mech --json=$O/fb/$CN/fall_$off.json --ringOut=$O/fb/$CN/ring_$off.json > $O/fb/$CN/fall_$off.txt 2>&1"; done
# 4 마무리 찌르기 상처 (H4 · 바탕 = $S/r20/fin_*.txt)
mkdir -p $O/fin/$CN
run fin_1 bash -c "cd $T && $N tools/sim/finish_thrust.mjs 1 --rows > $O/fin/$CN/fin_rows_1.txt 2>&1"
run fin_2 bash -c "cd $T && $N tools/sim/finish_thrust.mjs 2 --rows > $O/fin/$CN/fin_rows_2.txt 2>&1"
run fin_34 bash -c "cd $T && $N tools/sim/finish_thrust.mjs 2 --seed=3 --rows > $O/fin/$CN/fin_rows_34.txt 2>&1"
run fin_r1 bash -c "cd $T && $N tools/sim/finish_thrust.mjs 1 rapier --rows > $O/fin/$CN/fin_rows_r1.txt 2>&1"
# 5 다리 묶음 (H3)
run legs bash -c "cd $T && $N tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json=$O/legs.json > $O/legs.txt 2>&1"
# 6 막기 (H4 · 롱소드가 치고 롱소드 · 레이피어가 막음 · 벌 0 a b · 바탕 칸과 고친 칸)
for c in r23_base $CN; do run pp_$c bash -c "S=$S ATK=longsword DEF=longsword,rapier nice -n 15 bash $D/../r18/parry_pair.sh $O/pp $c"; done
# 7 단위 시험 (H3)
run tests bash -c "cd $T && $N --test --test-concurrency=1 tools/sim/*.test.mjs > $O/tests.txt 2>&1; true"
# 8 안 본 씨앗 확인 (G1 · 고친 칸 · 바탕 칸)
run gate_5001-5040 bash -c "cd $T && $N tools/sim/wb_gate.mjs --root=. --seeds=5001-5040 --cache=$O/cache_t1 --json=$O/gate_5001-5040.json > $O/gate_5001-5040.txt 2>&1"
run gateb_5001-5040 bash -c "cd $B && $N tools/sim/wb_gate.mjs --root=. --seeds=5001-5040 --cache=$O/cache_base --json=$O/gateb_5001-5040.json > $O/gateb_5001-5040.txt 2>&1"
touch $O/all.done
