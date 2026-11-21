#!/bin/bash
# "관문 그대로" 주장 다시 돌리기: 커밋마다 src·tools만 꺼내 세 관문의 출력 해시를 적는다.
# 쓰는 법: claims.sh <저장소> <node_modules> <결과 폴더> <커밋>...
REPO=$1; NM=$2; OUT=$3; shift 3
mkdir -p "$OUT"
for c in "$@"; do
  d="$OUT/t_$c"; rm -rf "$d"; mkdir -p "$d"
  git -C "$REPO" archive "$c" src tools package.json | tar -x -C "$d" || { echo "$c archive-failed" >> "$OUT/claims.log"; continue; }
  ln -s "$NM" "$d/node_modules"
  line="$c"
  for g in "fights12.mjs" "live_battery.mjs" "finish_thrust.mjs 1 --stand"; do
    n=$(echo $g | cut -d' ' -f1 | sed 's/.mjs//')
    (cd "$d" && nice -n 10 node tools/sim/$g 2>/dev/null > "$OUT/out_${c}_$n.txt")
    line="$line $n=$(sha256sum "$OUT/out_${c}_$n.txt" | cut -c1-8)"
  done
  echo "$line" >> "$OUT/claims.log"
  rm -rf "$d"
done
