# P4: compute-only-when-consumed patches (round 2)

**NULL RESULT: none of the three patches has a time gain that clears run-to-run noise. All three (and all of them together) are byte-identical on all 7 gates. Verdict: g1 DROP, g2 DROP, g3 DROP.**

All paths below are relative to `scratchpad/P4/` unless they are absolute. Trees: `wa` = base + patch a (copied from P3/wa, gates match P3/gates_wa.txt), `w1..w3` = wa + one patch, `wall` = wa + g1+g2+g3.
Runners: `st_<tree>.mjs` = step_time.mjs with the harness import pointed at that tree. Profile summarisers: `top.mjs` (self/total by fn file:line), `kids.mjs` (children + self line ticks), `callers.mjs`.

## 1. Profile of wa (where time goes after patch a)
Commands: `node --cpu-prof --cpu-prof-dir=prof1 st_wa.mjs 12 15`, then `node top.mjs prof1 40 [src/]`. 2v2: `(cd wa && node --cpu-prof --cpu-prof-dir=../prof2 tools/sim/team_perf.mjs --only=perf --counts=4)`, then `node top.mjs prof2 30`.
Profile total: 1v1 26.8 s (the run printed meanMs 1.22, inflated by profiling). 2v2: 29.5 s.

SELF, 1v1 (ms, share): rapier __wrap 2555 9.5% | fighter.step fighter.js:1740 1613 6.0% (inlined callees) | wasm-fn[37] 1566 5.8% | wasm-fn[374] 981 | driveBalance :2837 899 3.4% | wasm-fn[259] 779 | driveSword :3421 751 2.8% | updateCombat ai.js:901 735 2.7% | GC 731 | __destroy_into_raw 714 | gait.update :731 508 | driveJoints :3206 381 | G.step harness 339 | ai.update :869 303 | applyPose :3084 209 | segSegDist :408 204 | skill.update :1593 182 | updateFooting :2986 179 | recentHandSpeed ai_sense.js:104 176 | moveFeet ai.js:4437 164 | poseLegs 154 | armIK 154 | guardAt 152 | cacheState 145 | updateBodyPose 135.
TOTAL, 1v1, src only: fighter.step 13264 49.5% | driveSword 3397 12.7% | updateCombat 3002 11.2% | driveBalance 2987 11.1% | driveJoints 1241 | cacheState 1235 4.6% | rot 1016 | gait.update 962 | armIK 946 | applyPose 808 | combat.afterStep 780 | updateFooting 743 | elbowSwivel 692 2.6% | pinFeet 522 | updateBodyPose 519 | poseLegs 515 | recordSenses 510 | corrStep 502 1.9% | record 463 | offHand 396 | bladePoint 380 | armClearNear 359 | evalPart 343. Rapier world.step: 6333 23.6%.
2v2 (4 fighters) TOTAL: stepMatch 27968 | fighter.step 13491 45.8% | rapier.step 6842 23.2% | ai.update 4605 15.6% | updateCombat 4139 14.0% | driveSword 3376 | driveBalance 2846 | cacheState 1282 | moveFeet 827 | recordSenses 791 | elbowSwivel 724 | bladePoint 496 | captureVitalPose 402 | armClearNear 401 | teamFeet 383 (busyFoe 22) | runInstants 356 | chooseTarget 280.
Children (`node kids.mjs prof1 "<fn>"`): driveSword → armIK 941, corrStep 500, armClearNear 355. driveBalance → gait.update 961, updateFooting 739; driveBalance's hottest line is fighter.js:2876 (416 ticks; the per-body `resetForces/resetTorques` loop). evalPart (after patch a) → rapier translation 161, projectPoint 50. elbowSwivel → clrGap 178, armOk 120, gapAt 96, reach 74, wristOk 52, dev 50.

## 2. Candidates considered
| # | place | verdict / reason |
|---|---|---|
| 1 | ai.js:1082 `recovering = recentHandSpeed(..)>3.5 && hypot(hv)<1.8`. The ring scan (~72 entries, hypot each) runs before a one-hypot test | **built g1**: both sides pure, so swapping them leaves the boolean identical |
| 2 | elbowSwivel two-arm branch `clrGap(th) && wristOk(th)`. clrGap = 2 armGap = 8 segSegDist, wristOk is cheaper | **built g2**: all pure (scratch vectors are not shared across the closures), so the order cannot change the result |
| 3 | wristPlane 120-step loop: computes atan2 `dev` before the cheap ① test. reach() uses it only as a boolean, yet it searches for the best n | **built g3**: test ① first, and return on the first feasible n for reach() only |
| 4 | driveBalance resetForces/resetTorques on every body (line 2876, ~1.5%) | rejected: user forces persist in Rapier, so skipping needs proof that no force was added; wakeUp also mutates state |
| 5 | armClearNear every step for two-handed weapons | rejected: writes armClrT and armClrGap (state with memory) |
| 6 | artTrailTick bladeHist push/shift | rejected: stored history read by artFlash (state) |
| 7 | corrStep: 14 foe `translation()` per step | rejected: the band/reach test needs live positions. foe.cache is from before the previous world.step (stale). A distance pre-cull would add a threshold |
| 8 | 2v2 recordSenses for non-target foes (8 records/step) | rejected: ring buffers are state, read after a target switch |
| 9 | teamFeet busyFoe for every foe | rejected: only 22 ms of 29.5 s |
| 10 | seize() `swung` scan | rejected: already throttled to 0.08–0.16 s; negligible |
| 11 | elbowSwivel computes dev(0)/reach(0) up to 3 times | rejected: dev is 50 ms in total; too small to measure |

## 3. Patches
g1 `g1_hand_speed_lazy.patch`: ai.js, 1 line. `Math.hypot(s.hvx,s.hvy) < 1.8 && recentHandSpeed(...) > 3.5`. Identical because both operands are side-effect-free (recentHandSpeed only reads buf) and `&&` of pure booleans commutes. No Math.random in either.
g2 `g2_swivel_cheap_first.patch`: fighter.js, 2 lines. `wristOk(0) && clrGap(0)` and `armOk(th) && wristOk(th) && clrGap(th)`. Identical: clrGap writes _swC1-3/_acO/_acC, and wristOk (dev/reach/wristPlane) writes _sw2-7/_wpE1-2. Each closure writes its scratch before reading it, and none of them touches q(_sw1), bD/bp/bq(_swC4-6), D, nF or cx.
g3 `g3_wrist_plane_any.patch`: fighter.js, 4 lines. (i) In wristPlane, test ① `|s·cp|>feMax` before computing dev. That is the same filter set, and dev's float ops are unchanged when it is computed. (ii) A new `any` argument: reach() passes true and gets `out` back at the first n that passes ①②③, without writing `out` (_sw7; armOk overwrites it before every read). wristGuardAim and secret_instant are untouched: wristGuardAim's bisection leaves its `out` (f.wristPlaneW) in a state that a full search defines.

## 4. Identity gates
Command: `bash gates.sh $PWD/<tree> <tree>`, then `cmp out_wa_<g>.txt out_<tree>_<g>.txt` for 6 gates, and corr_s0 compared after `sed 's/ · [0-9.]* s$//'` (file `cmp_123.txt`).
wa shas (gates_wa.txt): fights12 ca80b048 | live_battery 1c110583 | match_twin ca80b048 | finish_thrust c0e8c0fc | weapon_smoke 82583ac6 | team_fights 4f72fa18 (same as P3/gates_wa.txt).
| tree | fights12 | live_battery | match_twin | finish_thrust | corr_s0* | weapon_smoke | team_fights |
|---|---|---|---|---|---|---|---|
| w1 | same | same | same | same | same | same | same |
| w2 | same | same | same | same | same | same | same |
| w3 | same | same | same | same | same | same | same |
| wall | same | same | same | same | same | same | same |
*after stripping the time suffix.

## 5. Timing
Command: `bash timing_run.sh` → timing.txt. Five rounds, alternating wa,w1,w2,w3,wall, `node st_<t>.mjs 12 15`. Machine quiet, nothing else running. meanMs per run:
| tree | r1 | r2 | r3 | r4 | r5 | mean of means | spread (max−min) | vs wa |
|---|---|---|---|---|---|---|---|---|
| wa | 0.967 | 0.957 | 0.905 | 0.961 | 0.926 | 0.943 | 0.062 (6.6%) | — |
| w1 | 0.935 | 0.949 | 0.924 | 0.944 | 1.199 | 0.990 (0.938 without r5) | 0.275 | +5.0% (−0.5% without r5) |
| w2 | 1.010 | 0.924 | 0.999 | 0.940 | 0.999 | 0.974 | 0.086 | +3.3% |
| w3 | 0.949 | 0.995 | 0.934 | 0.903 | 0.960 | 0.948 | 0.092 | +0.5% |
| wall | 0.922 | 0.949 | 0.928 | 0.992 | 0.886 | 0.935 | 0.106 | −0.8% |
Every difference is smaller than wa's own spread (6.6%), so no gain is shown. w1 r5 (1.199) is a one-off noise burst; without it w1 equals wa. w2 is, if anything, slower. This fits its profile cost: clrGap was cheap whenever wristOk passed, so wristOk now runs on more angles.
team_perf, once each (`cd <t> && node tools/sim/team_perf.mjs --only=perf --counts=2,4,6`), mean ms/step (median / p95 / mean in timing.txt):
| fighters | wa | wall | Δ |
|---|---|---|---|
| 2 | 0.948 | 0.917 | −3.3% |
| 4 | 1.917 | 1.769 | −7.7% |
| 6 | 2.970 | 2.818 | −5.1% |
These are single runs. The P3 single runs of the same command varied by up to 30% for an identical-cost tree (P3/timing.txt, 2 fighters: 0.942 vs 1.223), and the 1v1 alternation above shows no gain. The 2v2 profile puts the code these patches touch (recentHandSpeed 171 self, elbowSwivel 724 incl., wristPlane 166 self) at ≤3% of the run. So a 5–8% gain from them is implausible. Treat these figures as noise, not as a shown gain.

## 6. Verdicts
- g1 hand-speed-lazy: identical, no gain shown → **DROP**.
- g2 swivel cheap-first: identical, no gain (possibly slower) → **DROP**.
- g3 wrist-plane any/①-first: identical, no gain shown → **DROP**.
- wall: identical, −0.8% on 1v1 (noise) → nothing to keep.
Why: after patch a, nothing pure, skippable and large is left in the per-step JS. The remaining cost is spread over many functions under 3% each, the Rapier step (23%), and wrapper reads that feed state. The few clearly unused computations found cost under 1% each, which is below what this machine can measure in 5 rounds (±3–5%). The larger items (resetForces loop, cacheState, armClearNear, sense rings, corr foe reads) all write state or need a new threshold to skip, so they are out of scope for a no-behaviour-change patch.
