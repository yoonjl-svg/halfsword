#!/bin/bash
# r18 읽기 지적 고친 칸 재기 (다시 돌려도 됨 · 시뮬 하나씩 · nice): S=$S fix_chain.sh <칸>
#  ① 빈팔 선 자세 지문 — 씨앗 1 · 2 · 간격 3.001 · 2.999 (bz2_250 · ca_250 은 씨앗 2 만 더 · 흔들림)  ①' 줄 B 의 cell (마무리 찌르기가 맨 앞 — 일찍 봄)  ② 줄 A (r17 lane_a.sh: 12 판 뜀 둘 · arm_real D · 단위 시험)
#  ③ 빈 팔 큰 뜀 (big_pd — 고친 pd_tap)  ④ 막기 아홉 줄 json (치는 셋 × 막는 셋 · 간격 세 벌) bw_250 · 칸  ⑤ 줄 B (cell · extra · parry_x)
R=$(cd $(dirname $0) && pwd); P=/home/user/halfsword/docs/strike/physics2_proto/r17; S=${S:?}; c=$1; O=$S/r18; MX=$S/p2/r6/mx; mkdir -p $O
fp() { local cl=$1 sd=$2 f=$O/fp_$1.json; [ $sd = 1 ] || f=$O/fp_$1_s$2.json; [ -s $f ] || (cd $MX/cells/$cl && ROOT=$MX/cells/$cl FPSEED=$sd node $R/offarm_fp.mjs $f > $f.log 2>&1); }
fp bz2_250 2; fp ca_250 2; fp $c 1; fp $c 2
for g in 3.001 2.999; do f=$O/fp_${c}_g$g.json; [ -s $f ] || (cd $MX/cells/$c && ROOT=$MX/cells/$c FPGAP=$g node $R/offarm_fp.mjs $f > $f.log 2>&1); done
[ -f $MX/$c/DONE ] || bash $MX/cell.sh $c
# 부하 3.5 아래면 둘째 줄(lane2.sh: 줄 A · 큰 뜀 · 막기 아홉 줄)을 함께 돌리고 WAIT2=1 로 그 끝을 기다림
while [ -n "$WAIT2" ] && [ ! -f $O/L2_${c}_DONE ]; do sleep 30; done
[ -f $O/A_${c}_DONE ] || bash $P/lane_a.sh $c $O
[ -f $O/BIG_${c}_DONE ] || bash $R/big_pd.sh $c $O
for a in longsword rapier zweihander; do for cl in bw_250 $c; do ATK=$a DEF=longsword,rapier,zweihander SETS="0 a b" bash $R/parry_pair.sh $O $cl; done; done
[ -f $MX/$c/EXTRA_DONE ] || bash $MX/extra.sh $c
[ -f $MX/$c/PARRYX_DONE ] || bash $MX/parry_x.sh $c
date > $O/FIX_${c}_DONE
