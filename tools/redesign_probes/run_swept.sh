#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/exp
S=16,20,24,28,32,36,40,45,50
O=../out/speed
run(){ env "$@" node tools/sim/speedsweep.mjs $S 16 2>/dev/null | grep '^{' ; }
( for T in 0.75 0.95; do run SWEPT=1 TGT=farm T=$T CAP=1e9 > $O/farm_t${T}_swept.jsonl; run TGT=farm T=$T CAP=1e9 > $O/farm_t${T}_nocapB.jsonl; done
  run SWEPT=1 TGT=farm T=0.95 CAP=1e9 W=rapier > $O/rapier_farm_swept.jsonl ) &
( for T in 0.75 0.95; do run SWEPT=1 TGT=neck T=$T CAP=1e9 > $O/neck_t${T}_swept.jsonl; done
  run SWEPT=1 TGT=neck T=0.95 CAP=1e9 W=sabre > $O/sabre_neck_swept.jsonl
  run SWEPT=1 TGT=farm T=0.95 CAP=1e9 LIVE=1 > $O/farm_t0.95_swept_live.jsonl
  run TGT=farm T=0.95 CAP=30 LIVE=1 > $O/farm_t0.95_base_live.jsonl ) &
wait; echo done
