#!/bin/bash
cd /tmp/claude-0/-home-user-halfsword/9fbda44b-c017-5e21-91ef-deb2c6dbddd3/scratchpad/wbspeed/tech
node exp3_energy.mjs 12 base 1 out/e3_base.json
node exp3_energy.mjs 8 heinrich 101 out/e3_heinrich.json
node exp3_energy.mjs 8 margarethe 201 out/e3_margarethe.json
echo ALLDONE3
