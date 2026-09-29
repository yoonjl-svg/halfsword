#!/bin/bash
# 실험판 src(tech/snap 의 env 패치) 가 필요하다 — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../../.." || exit 1
O=tools/redesign_probes/tech/out; mkdir -p $O
until grep -q ALLDONE $O/run1.log; do sleep 3; done
SP=12,16,20,24,28,32,36,40,45
for w in longsword rapier; do
  SPEED_GATE=1e9 SWEPT=1 OUT=$O/e1_${w}_farm_swept.json node tools/redesign_probes/tech/exp1_sweep.mjs $w farm $SP 16
  MODE=free OUT=$O/e1b_${w}_blade_free_base.json node tools/redesign_probes/tech/exp1_sweep.mjs $w blade $SP 16
  MODE=free CCD=scale OUT=$O/e1b_${w}_blade_free_ccdscale.json node tools/redesign_probes/tech/exp1_sweep.mjs $w blade $SP 16
  MODE=free CCD=1.0 OUT=$O/e1b_${w}_blade_free_ccd1.json node tools/redesign_probes/tech/exp1_sweep.mjs $w blade $SP 16
  MODE=free DT=240 OUT=$O/e1b_${w}_blade_free_dt240.json node tools/redesign_probes/tech/exp1_sweep.mjs $w blade $SP 16
done
echo ALLDONE2
