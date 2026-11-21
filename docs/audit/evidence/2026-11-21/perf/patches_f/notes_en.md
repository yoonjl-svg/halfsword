# P3 — per-step body read cache (patch f), evidence

Trees: `P3/base` (main copy), `P3/wa` (base + a_corr_early.patch), `P3/wf` (wa + f). Patch: `P3/f_read_cache.patch` (`diff -ruN wa/src wf/src`).
All paths below relative to `P3/`. Tools written for this: `tools/redund.mjs`, `tools/micro.mjs`, `tools/wasm_count.mjs`, `tools/smoke.mjs`.

## What the patch does
- New `src/body_read.js` (77 lines) + 2 lines in `src/fighter.js` (import; `installBodyRead(RAPIER)` first line of `Fighter` constructor, idempotent). +79 / -0, 2 files.
- Patches the Rapier JS classes once (prototype level, so every body in every world is covered, incl. browser-only code):
  - `RigidBody.translation/rotation/linvel/angvel/worldCom`: memo per body (symbol-keyed slot, invisible to for-in/JSON). Hit returns a NEW `RAPIER.Vector3`/`Quaternion` built from the stored numbers, so a caller that mutates the result cannot poison the cache (correctness point (i) holds without auditing callers). Miss returns the engine's own object unchanged.
  - Global generation `gen`: bumped before AND after every World / RigidBodySet / ColliderSet / ImpulseJointSet / MultibodyJointSet / Collider method that is not on an explicit read-only whitelist. That includes `world.step`, `createRigidBody`, `createCollider`, `remove*`, `free`. While such a call runs (`busy`), reads bypass the cache and fill nothing (point (iii): contact hooks inside `step` always read the engine; points (iv): removal/recreation bumps `gen`).
  - Per-body drop: any `RigidBody` method not on the whitelist (setTranslation, setRotation, setLinvel, setAngvel, applyImpulse*, applyTorqueImpulse, sleep, setNextKinematic*, setAdditionalMass, setBodyType, lock*, setEnabled, ...) clears that body's slot only.
  - Left untouched (no invalidation): read-only getters, and `addForce`, `addTorque`, `addForceAtPoint`, `resetForces`, `resetTorques`, `wakeUp`, and raw joint-set motor/limit calls (fighter.js calls `joint.rawSet.jointConfigureMotor*` / `jointSetLimits` directly) — micro-test below shows none of them changes any body read before the step.
- Unknown/new methods default to "invalidate" (whitelist design): a missed whitelist entry costs hit rate, never correctness.
- Not cached: `velocityAtPoint` (takes an argument, 6/step), `mass` (36/step, cheap scalar), collider poses.

## Invalidation rules — micro-test
`node tools/micro.mjs $PWD/wa` (two dynamic bodies A,B joined by a spherical joint, after one step; compares all five reads bitwise before/after one call):
```
applyImpulse / setLinvel           A: v        B: -
applyTorqueImpulse / setAngvel     A: w        B: -
applyImpulseAtPoint                A: v,w      B: -
setTranslation / setRotation       A: t|r,com  B: -
sleep                              A: v,w      B: -
addForce/addTorque/addForceAtPoint/resetForces/resetTorques/wakeUp   A: -  B: -
setAdditionalMass, collider.setMass                                   A: -  B: -   (still invalidated: conservative)
jointConfigureMotor / ...Position / jointSetLimits (raw)              A: -  B: -
world.createCollider on A          A: com      B: -   (covered by global bump)
world.removeImpulseJoint           A: -        B: -
world.step                         A: all      B: all
```
So: impulses/setters change only their own body immediately; joints never move the other body before `step`; forces act only at `step`.

## Redundancy (wa, 1v1 seed 3, 600 steps after 120 warm-up)
`node tools/redund.mjs $PWD/wa 600` — reads/step: rotation 186.05, translation 179.57, worldCom 72.64, linvel 69.97, angvel 50.69 (= 558.9). Zero reads happen inside `world.step` (hooks use `Fighter.cacheState`).
Repeat reads with no intervening step and no own-body call of ANY mutating kind (forces counted as mutating): rotation 122.66, translation 105.27, worldCom 24.65, linvel 23.94, angvel 4.63. Joint calls (56 jointConfigureMotor + 6 ...Position/step) would cut that to 151 if treated as invalidating — micro-test shows they need not be.
Top site: `rot()` helper fighter.js:248, 138 rotation reads/step; `cacheState put` fighter.js:4174-4178 reads all five for 30 bodies right before the step.
With forces also neutral (the patch), the actual hit rate is higher — see next table.

## Saving (wa -> wf)
`node tools/wasm_count.mjs $PWD/wa` / `$PWD/wf` (same scenario; counts both JS API calls and every raw wasm-bindgen call, vector getters and `free` included):
| | wa | wf |
|---|---|---|
| JS API calls/step (rapier_count definition) | 730.9 | 730.9 (unchanged: cache sits behind the API) |
| raw wasm calls/step | 3273.3 | 1073.8 (-67 %) |
| rbRotation / rbTranslation | 186.05 / 179.57 | 30.06 / 30.06 |
| rbWorldCom / rbLinvel / rbAngvel | 72.64 / 69.97 / 50.69 | 30.06 / 30.06 / 30.00 |
| body reads reaching wasm | 558.9 | 150.2 (408.7 served from cache, 73 %) |
Each body read was 6 wasm calls (rb*, x, y, z[, w], free); now ~1 read per body per step remains (30 bodies).
Note: rapier_count.mjs wraps outside the cache, so it still reports 729-731; the saving is visible only at the raw level.

Allocation: `node heap_alloc.mjs $PWD/wa 3 8` 409 321 B/step; `$PWD/wf` 406 708 B/step (-0.6 %, noise level). Hits still allocate a fresh object by design; wasm-wrapper `register` drops 93 k -> 35 k B/step but `body_read.js` adds ~67 k.

## Identity gates
`bash gates.sh $PWD/<tree> <label>` (copy of the evidence gates.sh, writes into P3/), outputs `out_<label>_<gate>.txt`:
| gate | base | wa | wf |
|---|---|---|---|
| fights12 | ca80b048b457d597 | same | same |
| live_battery | 1c11058356efd4b1 | same | same |
| match_twin | ca80b048b457d597 | same | same |
| finish_thrust | c0e8c0fc8e513472 | same | same |
| corr_s0 (raw, has wall clock) | 0d0a59b5… | 388e9b2f… | 87dce061… |
| corr_s0 `sed 's/ · [0-9.]* s$//' \| sha256sum` | e01a42ef227d18df | same | same |
| weapon_smoke | 82583ac6144d1a3f | same | same |
| team_fights (2v2,3v3,2v1) | 4f72fa18273c03b2 | same | same |
`cmp out_base_<g>.txt out_wf_<g>.txt`: identical for all six non-clock gates. base hashes equal the evidence `gates_base.txt`.
Extra: `node tools/sim/revive_check.mjs 4` wa vs wf `cmp` identical (PASS 4/4); `node tools/sim/whip_duel.mjs --weapons=druid_whip --opps=isolde --seeds=1 --dur=20` identical; `node tools/smoke.mjs <tree> 2400` (all body poses+velocities every 100 steps) 36c2296fb3750876 both.
Tests on wf: `node --test --test-concurrency=2` on the 12 tests that touch sever/revive/drop/snapshot (list in `tests_list.txt`): 68/70 pass; the 2 fails are hp_strip reading `index.html` absent from the scratch copy — with index.html copied in: 7/7 pass.

## Timing
PENDING. `D_fights_real.mjs` jobs were still running at the end (`pgrep -f "D_fights|audit_ai"` non-empty, load 1-4 on 4 cores), so no ms/step numbers were taken under load. Ready to run when quiet: `bash P3/timing_run.sh` (alternates wa/wf 3 rounds of `st_<tree>.mjs 12 15` = step_time.mjs pointed at each tree, then `team_perf.mjs --only=perf --counts=2,4,6` once each; writes `P3/timing.txt`).

## Risks
- Browser-only paths (main.js loop, camera, effects, debugRender) not exercised; they go through the same patched prototypes and same rules. `world.debugRender` is not whitelisted -> bumps `gen` (correct, slightly lower hit rate).
- The cache is global monkey-patching of a third-party library: a Rapier upgrade that adds a mutating method is safe (default invalidate), but one that makes a whitelisted getter mutate, or adds a new path into wasm outside these classes (e.g. game code calling `body.rawSet.rbSet*` directly), would bypass invalidation. Today the only raw calls in src are joint motor/limit calls (`grep -rn "rawSet\." src`).
- Two JS objects for one body would not share a slot; Rapier keeps one object per handle (`RigidBodySet.map`), and src never constructs `RigidBody` itself.
- Installed from the Fighter constructor: worlds with no Fighter yet run uncached (harmless).

## Judgement
Mechanism: 77 lines, one install call, no change to any consumer. Benefit measured so far: wasm crossings -67 % per step (3273 -> 1074), body reads into wasm 559 -> 150, allocation unchanged. Whether that buys wall-clock time is the open question (timing pending); crossings cost little each in V8+wasm, so expect a modest ms/step gain. The approach is correct by construction (whitelist + generation), confirmed by 7/7 identical gates and 3 extra identity checks. Recommend adopting only if timing shows a gain beyond run-to-run noise; otherwise it is a clean null result and the alternative (no cache) is simpler.
