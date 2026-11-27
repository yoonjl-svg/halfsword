#!/bin/bash
# r26 재기 차례 (시뮬 하나씩 · nice 15 · 있으면 건너뜀 — 다시 켜도 됨): S=$S chain.sh <칸> <일...>
#  칸 = $S/p2/r6/mx/cells/<칸> (r24_om 복사 · r26_om = 본판 src · r26_new = 이 가지 src)
#  일: j12 (빈 · 칼 팔 명령 뜀 두 묶음 — r9b arm_cmd2 · r17 lane_a 와 같은 명령) · armsD (arm_real D 여섯 자리) · rec (Dn 기록 — rec_chain.sh) ·
#      fin (마무리 찌르기 s1 · s2 · s34 · 레이피어 · 츠바이핸더 — cell.sh · extra.sh 와 같은 명령) · parry (막기 아홉 줄 × 간격 세 벌 — r18 parry_pair.sh) ·
#      bat (기본 다리 묶음 · 싸움 꼴 8 — cell.sh 와 같은 명령) · fp (선 겨눔 지문 × 간격 3 · 3.001 · 2.999 — r18 offarm_fp.mjs) ·
#      tests (단위 시험 — lane_a 와 같은 명령) · q2 (48 판 넘어짐 — r22 q2.sh · offs 0 300)
R=$(cd $(dirname $0) && pwd); P2=$(cd $R/.. && pwd); R9=/home/user/halfsword/docs/strike/physics2_proto/r9b
S=${S:?}; MX=$S/p2/r6/mx; BT=$S/wt_b5m; c=$1; shift; D=$MX/cells/$c; OC=$MX/$c; O=$S/r26; mkdir -p $O $OC
N="nice -n 15"
for job in "$@"; do cd $D; case $job in
  j12)
    [ -s $O/j12_$c.txt ] || ROOT=$D LABEL=$c $N node --import file://$R9/arm_cmd2.mjs tools/sim/fights12.mjs > $O/j12_$c.txt 2>&1
    [ -s $O/j12b_$c.txt ] || ROOT=$D LABEL=$c SEED0=12 $N node --import file://$R9/arm_cmd2.mjs $R9/fights_blk.mjs > $O/j12b_$c.txt 2>&1 ;;
  why) [ -s $O/why_$c.txt ] || ROOT=$D LABEL=$c $N node --import file://$R/jump_why.mjs tools/sim/fights12.mjs > $O/why_$c.txt 2>&1 ;; # 빈 팔 큰 뜀 까닭 (jump_why.mjs)
  armsD)
    [ -s $O/armsD_$c.txt ] || { mkdir -p $O/armsD_$c; $N node $R9/arms_d_probe.mjs --root=$D --cells=longsword:up,longsword:left,longsword:upLeft,longsword:right,balisarda:left,rapier:left --csv=$O/armsD_$c > $O/armsD_$c.txt 2>&1; } ;;
  rec) S=$S bash $R/rec_chain.sh $c $O/rec ;;
  side) TAP=side_rec S=$S bash $R/rec_chain.sh $c $O/side ;; # 게임이 낸 팔꿈치 쪽 (조건 ④)
  fin)
    [ -s $OC/fin_rows_1.txt ] || $N node tools/sim/finish_thrust.mjs 1 --rows > $OC/fin_rows_1.txt 2>&1
    [ -s $OC/fin_rows_2.txt ] || $N node tools/sim/finish_thrust.mjs 2 --rows > $OC/fin_rows_2.txt 2>&1
    [ -s $OC/fin_rows_34.txt ] || $N node tools/sim/finish_thrust.mjs 2 --seed=3 --rows > $OC/fin_rows_34.txt 2>&1
    for w in rapier zweihander; do [ -s $OC/fin_rows_$w.txt ] || $N node tools/sim/finish_thrust.mjs 1 $w --rows > $OC/fin_rows_$w.txt 2>&1; done ;;
  parry)
    declare -A G=([0]=1.35,1.5,1.65,1.8 [a]=1.4,1.55,1.7,1.85 [b]=1.3,1.45,1.6,1.75)
    for k in 0 a b; do for a in longsword rapier zweihander; do f=$O/pp9_${c}_${a}_$k
      [ -s $f.json ] || ATK=$a GAPS=${G[$k]} OUT=$f.json $N node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $f.txt 2>&1; done; done ;;
  bat)
    [ -s $OC/def_longsword.json ] || $N node $BT/tools/sim/legs_battery.mjs --root=$D --n=8 --fights=0 --weapons=longsword --json=$OC/def_longsword.json > $OC/def_longsword.txt 2>&1
    [ -s $OC/fl_longsword.json ] || $N node $BT/tools/sim/legs_battery.mjs --root=$D --n=8 --fights=0 --weapons=longsword --only=slowwalk,slowback,aistick,reqpass,reqlunge,aistroke_diagR,lungecut,passcut --nohonesty --json=$OC/fl_longsword.json > $OC/fl_longsword.txt 2>&1 ;;
  fp)
    for g in 3 3.001 2.999; do f=$O/fp_$c.json; [ $g = 3 ] || f=$O/fp_${c}_g$g.json
      [ -s $f ] || ROOT=$D FPGAP=$g $N node $P2/r18/offarm_fp.mjs $f > $f.log 2>&1; done ;;
  tests)
    [ -f $OC/TESTS_DONE ] || { $N node --test --test-concurrency=1 tools/sim/*.test.mjs > $OC/tests.txt 2>&1; grep "^not ok" $OC/tests.txt | sed 's/^not ok [0-9]* - //' | sort > $OC/tests_fail.txt; date -u +%T > $OC/TESTS_DONE; } ;;
  q2) for off in 0 300; do OFFS=$off SCRATCH=$S bash $P2/r22/q2.sh $c; done ;; # 묶음 하나씩 (q2.sh 는 둘을 나란히 돌리므로)
esac; date > $O/DONE_${c}_$job; done
