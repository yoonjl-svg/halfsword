#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech
for w in longsword rapier; do
 for tg in farm neck; do
  OUT=out/e1_${w}_${tg}_base.json node exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 OUT=out/e1_${w}_${tg}_nogate.json node exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 CCD=scale OUT=out/e1_${w}_${tg}_ccdscale.json node exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
  SPEED_GATE=1e9 DT=240 OUT=out/e1_${w}_${tg}_dt240.json node exp1_sweep.mjs $w $tg 16,20,24,28,32,36,40,45 16
 done
done
echo ALLDONE
