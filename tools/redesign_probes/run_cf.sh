#!/bin/bash
# counterfactual sensitivity runs (probe only). usage: run_cf.sh NAME "ENV=.. ENV2=.."
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/instr
name=$1; shift
env HZS=${HZS:-120} WEAPONS=${WEAPONS:-longsword,zweihander,sabre} FAMS=${FAMS:-diagR,vert,horizR} OUT=../out/cf_$name.json "$@" node tools/sim/hybrid.mjs tseq.mjs 2>&1 | grep -v deprecated > ../out/cf_$name.txt
echo done $name
