#!/bin/bash
# r30 V4: 고친 나무에서 시험 전체를 한 번 (nice 15 · 한 번에 한 파일) · 실패 이름을 본판 실패 목록(r29/tests/fail_37_decided.txt)과 견줌.
#  쓰는 법: S=<작업 폴더> bash v4_run.sh   (결과 $S/r30/v4/)
set -u
: "${S:?S 를 정해 주세요}"
W="$S/wt_judge"; H="$(cd "$(dirname "$0")" && pwd)"; OUT="$S/r30/v4"; mkdir -p "$OUT"
cd "$W"
nice -n 15 node --test --test-concurrency=1 --test-reporter=tap tools/sim/*.test.mjs > "$OUT/tests.tap" 2>&1
echo "rc=$?" > "$OUT/rc.txt"
node "$H/v4_cmp.mjs" "$OUT/tests.tap" "$W/docs/strike/physics2_proto/r29/tests/fail_37_decided.txt" > "$OUT/result.txt"
cat "$OUT/result.txt"
