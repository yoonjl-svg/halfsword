#!/bin/bash
# 본판의 시험 파일(tools/sim/*.test.mjs)을 하나씩 돌려 끝난 코드와 걸린 시간을 적는다.
# 쓰는 법: run_tests.sh <본판 폴더> <결과 폴더>
M=$1; OUT=$2; mkdir -p "$OUT"; : > "$OUT/tests.tsv"
cd "$M"
for f in tools/sim/*.test.mjs; do
  n=$(basename "$f" .test.mjs); s=$(date +%s)
  timeout 240 nice -n 10 node "$f" > "$OUT/$n.out" 2> "$OUT/$n.err"; code=$?
  printf '%s\t%s\t%ss\t%s\n' "$n" "$code" "$(( $(date +%s)-s ))" "$(tail -1 "$OUT/$n.out" | cut -c1-160)" >> "$OUT/tests.tsv"
done
