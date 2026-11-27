#!/bin/bash
# r31 재기 차례 (r26 chain.sh · tri.sh · rec_chain.sh 와 같은 명령 · 출력만 $S/r31): S=$S chain.sh <칸> <일...>
#  칸 = $S/p2/r6/mx/cells/<칸> (r26_om 복사 · src 만 갈아 끼움). 시뮬 하나씩 · nice 15 · 시뮬마다 1 분 짐 평균 4.5 이하 기다림 · 있으면 건너뜀
#  일: j12 (fights12 · fights_blk — r9b arm_cmd2 와 r26 jump_why 와 싸움꾼별 셈 arm_seed 를 한 판에 같이 실음 · 읽기만이라 판은 같음)
#      parry (막기 아홉 줄 × 간격 세 벌 — r26 과 같음) · fp (선 겨눔 지문 × 간격 셋 — r18 offarm_fp) ·
#      tri (arm_real 씨앗 여덟 — r9b tri_bx · 두손 칼 오른쪽 끝 A — r26 tri_a) · elb (T6 — r26 rec_chain 과 같은 장면 아홉에 elb_rec)
R=$(cd $(dirname $0) && pwd); P2=$(cd $R/.. && pwd); R26=$P2/r26; R9=/home/user/halfsword/docs/strike/physics2_proto/r9b
S=${S:?}; MX=$S/p2/r6/mx; BT=$S/wt_b5m; c=$1; shift; D=$MX/cells/$c; O=$S/r31; mkdir -p $O/elb $O/tri
N="nice -n 15"
wl() { while :; do l=$(cut -d' ' -f1 /proc/loadavg); awk -v l=$l 'BEGIN{exit !(l<=4.5)}' && break; sleep 20; done; }
for job in "$@"; do cd $D; case $job in
  j12)
    f=$O/j12_$c.txt; [ -s $f ] || { wl; ROOT=$D LABEL=$c OUT=$O/seed_$c.json $N node --import file://$R9/arm_cmd2.mjs --import file://$R26/jump_why.mjs --import file://$R/arm_seed.mjs tools/sim/fights12.mjs > $f 2>&1; }
    f=$O/j12b_$c.txt; [ -s $f ] || { wl; ROOT=$D LABEL=$c SEED0=12 OUT=$O/seedb_$c.json $N node --import file://$R9/arm_cmd2.mjs --import file://$R/arm_seed.mjs $R9/fights_blk.mjs > $f 2>&1; } ;;
  parry)
    declare -A G=([0]=1.35,1.5,1.65,1.8 [a]=1.4,1.55,1.7,1.85 [b]=1.3,1.45,1.6,1.75)
    for k in 0 a b; do for a in longsword rapier zweihander; do f=$O/pp9_${c}_${a}_$k
      [ -s $f.json ] || { wl; ATK=$a GAPS=${G[$k]} OUT=$f.json $N node tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $f.txt 2>&1; }; done; done ;;
  fp)
    for g in 3 3.001 2.999; do f=$O/fp_$c.json; [ $g = 3 ] || f=$O/fp_${c}_g$g.json
      [ -s $f ] || { wl; ROOT=$D FPGAP=$g $N node $P2/r18/offarm_fp.mjs $f > $f.log 2>&1; }; done ;;
  tri)
    f=$O/tri/tri_arm_real_$c.jsonl; [ -s $f ] || { wl; $N node $R9/tri_bx.mjs $D arm_real 1,2,3,4,5,6,7,8 > $f 2> $f.err; }
    f=$O/tri/tri_A_$c.jsonl; [ -s $f ] || { wl; $N node $R26/tri_a.mjs $D > $f 2> $f.err; } ;;
  elb)
    for j in f_longsword f_rapier f_zweihander f_uchigatana p_longsword p_rapier p_zweihander t_1 t_2; do f=$O/elb/elb_${c}_$j.json; [ -s $f ] && continue; wl
      case $j in
        f_*) ROOT=$D OUT=$f $N node --import file://$R/elb_rec.mjs $BT/tools/sim/legs_battery.mjs --root=$D --only=fight --fights=12 --fightWeapons=${j#f_} > $f.log 2>&1;;
        p_*) ROOT=$D OUT=$f ATK=${j#p_} $N node --import file://$R/elb_rec.mjs tools/sim/parry_gap_map.mjs longsword,rapier,zweihander > $f.log 2>&1;;
        t_*) ROOT=$D OUT=$f $N node --import file://$R/elb_rec.mjs tools/sim/finish_thrust.mjs ${j#t_} --rows > $f.log 2>&1;;
      esac; done ;;
esac; date > $O/DONE_${c}_$job; done
