#!/bin/bash
# r33 Q2 능력 지도 (재기 전용 더듬기 — 고침이 아님): 재기 전용 칸(R33_ACC · R33_V 를 읽는 칸 · 바꾼 줄은 넘겨받을 메모)에서
#  탭 런지 걸음의 가속 한도 배율(R33_ACC — 런지 걸음을 req.accel 로 · lungeBrake 동안 aLim = maxAccel × R33_ACC)과
#  런지 발이 뜬 동안의 가려는 속도 앞 몫(R33_V — legVmax 자르기 뒤에 덮어씀)을 단계로 올려 lunge_trace.mjs 로 적음.
#  자세 둘: walk 0 (관문 장면 · 두 발 나란함) · walk 0.6 (먼저 걸어 펜싱 자세). 한 번에 node 둘 · nice 15.
#  bash lunge_cap.sh <칸 폴더> <나온 것 폴더> [씨앗 4001-4003]
CELL=$1; OUT=$2; SEEDS=${3:-4001-4003}; HERE=$(cd "$(dirname "$0")" && pwd); mkdir -p "$OUT"
run() { local tag=$1 walk=$2; shift 2; ( cd "$CELL" && env "$@" nice -n 15 node "$HERE/lunge_trace.mjs" --root=. --seeds=$SEEDS --post=3 --quiet --walk=$walk --json="$OUT/cap_$tag.json" 2>&1 | grep -v deprec > "$OUT/cap_$tag.txt" ); }
for WALK in 0 0.6; do for A in 1 2 3 4; do for V in 0 1.5 2.0; do
  E=(X=1); [ "$A" != 1 ] && E+=(R33_ACC=$A); [ "$V" != 0 ] && E+=(R33_V=$V)
  run "w${WALK}_a${A}_v${V}" "$WALK" "${E[@]}" &
  while [ "$(jobs -rp | wc -l)" -ge 2 ]; do wait -n; done
done; done; done
wait
