#!/bin/bash
cd "$(dirname "$0")/../../.." || exit 1
O=tools/redesign_probes/tech/out; mkdir -p $O
node tools/redesign_probes/tech/exp3_energy.mjs 12 base 1 $O/e3_base.json
node tools/redesign_probes/tech/exp3_energy.mjs 8 heinrich 101 $O/e3_heinrich.json
node tools/redesign_probes/tech/exp3_energy.mjs 8 margarethe 201 $O/e3_margarethe.json
echo ALLDONE3
