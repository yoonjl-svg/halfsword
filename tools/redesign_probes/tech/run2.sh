#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech
until grep -q ALLDONE out/run1.log; do sleep 3; done
SP=12,16,20,24,28,32,36,40,45
for w in longsword rapier; do
  SPEED_GATE=1e9 SWEPT=1 OUT=out/e1_${w}_farm_swept.json node exp1_sweep.mjs $w farm $SP 16
  MODE=free OUT=out/e1b_${w}_blade_free_base.json node exp1_sweep.mjs $w blade $SP 16
  MODE=free CCD=scale OUT=out/e1b_${w}_blade_free_ccdscale.json node exp1_sweep.mjs $w blade $SP 16
  MODE=free CCD=1.0 OUT=out/e1b_${w}_blade_free_ccd1.json node exp1_sweep.mjs $w blade $SP 16
  MODE=free DT=240 OUT=out/e1b_${w}_blade_free_dt240.json node exp1_sweep.mjs $w blade $SP 16
done
echo ALLDONE2
