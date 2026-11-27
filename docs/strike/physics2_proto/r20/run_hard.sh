#!/bin/bash
# 굳은 금 기준선 (한 번에 시뮬레이션 하나 · nice 10 · 관문(gate.done) 뒤에 돎 · 다시 부르면 이미 있는 결과는 건너뜀)
#  부르기: setsid nohup bash docs/strike/physics2_proto/r20/run_hard.sh <나무> <결과 폴더 = $S/r20> > /dev/null 2>&1 &
#  끝 표시: <결과 폴더>/hard.done
T=${1:-.}; O=${2:?결과 폴더}; D=$(cd "$(dirname "$0")" && pwd); mkdir -p "$O"
cd "$T" || exit 1
while [ ! -f "$O/gate.done" ]; do sleep 20; done
N="nice -n 10 node"
[ -f "$O/fp_a.json" ] || $N "$D/fingerprint.mjs" --root=. --json="$O/fp_a.json" > "$O/fp_a.txt" 2>&1
[ -f "$O/fp_b.txt" ] || $N "$D/fingerprint.mjs" --root=. --compare="$O/fp_a.json" > "$O/fp_b.txt" 2>&1
[ -f "$O/torque.json" ] || $N "$D/torque.mjs" --root=. --seeds=4001-4040 --json="$O/torque.json" > "$O/torque.txt" 2>&1
[ -f "$O/legs.json" ] || $N tools/sim/legs_battery.mjs --root=. --n=8 --fights=0 --weapons=longsword --json="$O/legs.json" > "$O/legs.txt" 2>&1
# 본판을 합친 뒤 지문이 그 앞(첫 기준선 fingerprint.json)과 같은지
[ -f "$O/fp_vs_old.txt" ] || $N "$D/fingerprint.mjs" --root=. --compare="$D/fingerprint.json" > "$O/fp_vs_old.txt" 2>&1
# 굳은 금 5 마무리 찌르기 상처 (r17 묶음과 같은 셈: s1 = 판 1 · s2 = 판 2 · s34 = 판 2 씨앗 3 부터 · 레이피어 판 1 · 2) — 장검 · 레이피어만 (츠바이핸더는 이 관문의 무기 밖이라 안 잼)
[ -f "$O/fin_1.txt" ] || $N tools/sim/finish_thrust.mjs 1 --rows > "$O/fin_1.txt" 2>&1
[ -f "$O/fin_2.txt" ] || $N tools/sim/finish_thrust.mjs 2 --rows > "$O/fin_2.txt" 2>&1
[ -f "$O/fin_34.txt" ] || $N tools/sim/finish_thrust.mjs 2 --seed=3 --rows > "$O/fin_34.txt" 2>&1
[ -f "$O/fin_r1.txt" ] || $N tools/sim/finish_thrust.mjs 1 rapier --rows > "$O/fin_r1.txt" 2>&1
[ -f "$O/fin_r2.txt" ] || $N tools/sim/finish_thrust.mjs 2 rapier --rows > "$O/fin_r2.txt" 2>&1
node tools/sim/finish_sum.mjs s1="$O/fin_1.txt" s2="$O/fin_2.txt" s34="$O/fin_34.txt" r1="$O/fin_r1.txt" r2="$O/fin_r2.txt" > "$O/fin_sum.txt" 2>&1
# 굳은 금 4 뒷부분: 단위 시험 (한 번에 하나)
[ -f "$O/tests.txt" ] || $N --test --test-concurrency=1 tools/sim/*.test.mjs > "$O/tests.txt" 2>&1
touch "$O/hard.done"
