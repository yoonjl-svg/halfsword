#!/bin/bash
# counterfactual sensitivity runs (probe only). usage: tools/redesign_probes/run_cf.sh NAME "ENV=.. ENV2=.."
# 계측판 src(instr_src.patch) 가 필요하다 — 이 저장소 src 에는 적용하지 않았다
cd "$(dirname "$0")/../.." || exit 1
O=tools/redesign_probes/out; mkdir -p $O
name=$1; shift
env HZS=${HZS:-120} WEAPONS=${WEAPONS:-longsword,zweihander,sabre} FAMS=${FAMS:-diagR,vert,horizR} OUT=$O/cf_$name.json "$@" node tools/sim/hybrid.mjs ../redesign_probes/tseq.mjs 2>&1 | grep -v deprecated > $O/cf_$name.txt
echo done $name
