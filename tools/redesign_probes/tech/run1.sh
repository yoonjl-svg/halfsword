#!/bin/bash
# 실험판 src(tech/snap 의 env 패치: SPEED_GATE·CCD·DT·SWEPT 훅) 가 필요하다 — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../../.." || exit 1
O=tools/redesign_probes/tech/out; mkdir -p $O
for w in longsword rapier; do
 for tg in farm neck; do
  OUT=$O/e1_${w}_${tg}_base.json node tools/redesign_probes/tech/exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 OUT=$O/e1_${w}_${tg}_nogate.json node tools/redesign_probes/tech/exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 CCD=scale OUT=$O/e1_${w}_${tg}_ccdscale.json node tools/redesign_probes/tech/exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 DT=240 OUT=$O/e1_${w}_${tg}_dt240.json node tools/redesign_probes/tech/exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
 done
done
echo ALLDONE
