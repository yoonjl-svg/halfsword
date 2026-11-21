# Round-over-round leak check (main checkout, 2026-11-21)

## Verdict
1. JS heap after forced GC: no real leak. Same stage replayed (Run B): +0.21 MB/round (60.28 -> 61.14 MB, rounds 2-6). After 20 rounds that is about +4 MB. Across stages (Run A) the heap follows the stage (59-66 MB). It does not climb.
2. three.js GPU resources (renderer.info geometries/textures/programs) and scene objects/meshes/materials: no leak. Flat on a repeated stage and stage-dependent across stages. Wound textures are cached per kind and add +1 at a time only until every kind has been seen.
3. Fighter, AI, Rapier World/RigidBody/Collider, wasm linear memory, DOM nodes and listeners: no leak. Exactly 2 Fighter, 2 AI, 1 World and 34 bodies-wrappers every round. Wasm memory stays at 1408 KB from round 2 on.
4. One confirmed leak in WebAudio. Each stage change that swaps the room reverb leaves 1 ConvolverNode, 2 GainNodes and the impulse-response buffer alive. In Run A that was +7 Convolvers over 10 rounds (6 orphaned), about +0.6/round on the default stage order. Run B (no stage change) gains none. It is native audio memory, not JS heap. A cathedral IR alone is 2.8 s x 2 ch x 48 kHz x 4 B = about 1.1 MB, before Chrome's FFT copies. After 20 rounds, expect about 12 orphaned reverbs, roughly 3-15 MB native. CPU impact is probably nil: the orphans are no longer connected to the output (inferred, not measured).
5. Not a leak, but a big resident cost: stage builders keep every merge-source geometry alive while that stage is up. That is up to 2,400 live BufferGeometry on cathedral against 153 on the GPU. All of it is freed when the stage changes.
6. Why heap here is ~60 MB and not 100-170 MB: these are post-GC numbers at DPR 1 with a tiny canvas. The earlier figures were performance.memory (garbage included) at DPR 3. Compare the trend, not the level.

## Method
- Server: `npx vite --port 5193 --strictPort` in $M (now stopped). Headless Chromium uses swiftshader GL, the 844x390 mobile/touch context, DPR 1 and a canvas drawing buffer shrunk to 8x4.
- Script: `H/leak_rounds.mjs <baseUrl> <query> <rounds> <outJson> [fightSecs] [forceWin]`. Each round runs about 8 s wall (10-14 s game time) of AI vs AI: a second `game.AI` drives the player, as in P_measure.mjs, which produces wounds, blood, trails and occasional debris. The round is then ended through the in-game death path `game.enemy.die('목', true)`, unless someone already died. The script waits for the real result panel (state `paused`) and clicks the real `#btnStart` ('다음 여정' after a win, '재대결' when the stage is pinned). That goes through startFight -> nextRoundStage -> useStage/stages.build -> newRound/resetWorld, the same path a player hits.
- Snapshot: taken 1.5 s after each new fight starts, plus once on the final result panel. Steps: `HeapProfiler.collectGarbage` x3, then `Runtime.getHeapUsage`, `Memory.getDOMCounters`, renderer.info via `game.renderInfo()`, a scene traverse, Rapier `world.bodies.len()`/`colliders.len()`, and `Runtime.queryObjects` on each prototype. Subclass prototype objects are excluded from the counts. For geometry, material, texture, Object3D and AudioNode the script also records a histogram of type|name|vertex count|attributes. `WebAssembly.Memory` byteLength is read via queryObjects.
- Tables: `node H/table.mjs H/runA.json 2` and `node H/table.mjs H/runB.json 1`. Audio and geometry per row: `node H/rows_detail.mjs H/runA.json`. (H = this folder)

## Run A: 10 rounds, default stage order (stage changes every round)
`node H/leak_rounds.mjs http://127.0.0.1:5193 "fps=1&weapon=longsword&emo=0" 10 H/runA.json 8`

| rnd | stage | heapMB | geo | tex | prog | sObj | sMesh | sMat | bod | col | wasmKB | domN | domL | Fighter | AI | BufGeo | Material | Texture | Object3D | Mesh | RWorld | RBody | RColl | AudioNode | Convolver |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | poseidon | 59.44 | 145 | 15 | 31 | 238 | 181 | 166 | 33 | 69 | 1344 | 354 | 93 | 2 | 2 | 429 | 230 | 26 | 267 | 196 | 1 | 34 | 69 | 21 | 0 |
| 2 | clearing | 61.79 | 161 | 17 | 38 | 235 | 170 | 154 | 33 | 69 | 1408 | 351 | 93 | 2 | 2 | 692 | 218 | 28 | 264 | 185 | 1 | 34 | 69 | 30 | 0 |
| 3 | castle | 61.33 | 131 | 15 | 62 | 204 | 146 | 132 | 33 | 69 | 1408 | 349 | 93 | 2 | 2 | 752 | 196 | 26 | 233 | 161 | 1 | 34 | 69 | 32 | 2 |
| 4 | loggia | 63.15 | 151 | 16 | 51 | 219 | 162 | 148 | 33 | 69 | 1408 | 349 | 98 | 2 | 2 | 1387 | 212 | 26 | 248 | 177 | 1 | 34 | 69 | 40 | 3 |
| 5 | cathedral | 65.70 | 153 | 17 | 58 | 247 | 182 | 169 | 33 | 69 | 1408 | 350 | 93 | 2 | 2 | 2405 | 233 | 27 | 276 | 197 | 1 | 34 | 69 | 36 | 4 |
| 6 | poseidon_night | 65.04 | 160 | 28 | 60 | 269 | 191 | 197 | 33 | 69 | 1408 | 360 | 93 | 2 | 2 | 679 | 401 | 37 | 502 | 361 | 1 | 34 | 69 | 39 | 4 |
| 7 | clearing_night | 63.86 | 168 | 22 | 60 | 262 | 177 | 176 | 33 | 69 | 1408 | 354 | 93 | 2 | 2 | 702 | 240 | 31 | 293 | 192 | 1 | 34 | 69 | 38 | 4 |
| 8 | castle_night | 63.62 | 137 | 22 | 70 | 231 | 151 | 156 | 33 | 69 | 1408 | 354 | 93 | 2 | 2 | 802 | 220 | 31 | 260 | 166 | 1 | 34 | 69 | 42 | 5 |
| 9 | loggia_night | 64.91 | 175 | 24 | 55 | 261 | 182 | 170 | 33 | 69 | 1408 | 355 | 98 | 2 | 2 | 1408 | 234 | 32 | 290 | 197 | 1 | 34 | 69 | 51 | 6 |
| 10 | cathedral_night | 65.77 | 155 | 23 | 61 | 266 | 182 | 187 | 33 | 69 | 1408 | 355 | 93 | 2 | 2 | 2330 | 251 | 31 | 296 | 197 | 1 | 34 | 69 | 46 | 7 |
| end (result panel) | cathedral_night | 66.13 | 158 | 23 | 61 | 269 | 185 | 190 | 33 | 69 | 1408 | 357 | 93 | 2 | 2 | 2333 | 254 | 31 | 299 | 200 | 1 | 34 | 69 | 50 | 7 |

(geo/tex/prog = renderer.info; sObj/sMesh/sMat = scene traverse; bod/col = current Rapier world; the remaining columns are queryObjects instance counts after GC. RenderTarget was 3 and AudioBuffer 235-236 in every row.)
Reading: the order cycles five places, day then night. Each place shows almost the same geometry count on its second visit: clearing 692/702, castle 752/802, loggia 1387/1408, cathedral 2405/2330. Heap on revisits is within 0-2.3 MB, and the night variants carry extra props. Programs depend on the stage (31-70) and do not climb monotonically. The only steady climber is Convolver.

## Run B: 6 rounds, pinned stage (`stage=poseidon` makes STAGE_PIN; the button is '재대결')
`node H/leak_rounds.mjs http://127.0.0.1:5193 "fps=1&stage=poseidon&weapon=longsword&emo=0" 6 H/runB.json 8`

| rnd | heapMB | geo | tex | prog | sObj | sMesh | sMat | bod | col | wasmKB | domN | domL | BufGeo | Material | Texture | Object3D | Mesh | AudioNode | Convolver |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 58.87 | 144 | 15 | 31 | 238 | 181 | 166 | 33 | 69 | 1344 | 349 | 93 | 429 | 230 | 26 | 267 | 196 | 21 | 0 |
| 2 | 60.28 | 146 | 20 | 32 | 238 | 181 | 166 | 33 | 69 | 1408 | 354 | 93 | 432 | 230 | 31 | 267 | 196 | 24 | 0 |
| 3 | 60.48 | 146 | 20 | 32 | 238 | 181 | 166 | 33 | 69 | 1408 | 354 | 93 | 432 | 230 | 31 | 267 | 196 | 27 | 0 |
| 4 | 60.96 | 146 | 21 | 32 | 238 | 181 | 166 | 33 | 69 | 1408 | 355 | 93 | 432 | 230 | 32 | 267 | 196 | 24 | 0 |
| 5 | 61.01 | 146 | 21 | 32 | 238 | 181 | 166 | 33 | 69 | 1408 | 355 | 93 | 432 | 230 | 32 | 267 | 196 | 24 | 0 |
| 6 | 61.14 | 146 | 22 | 32 | 238 | 181 | 166 | 33 | 69 | 1408 | 357 | 93 | 432 | 230 | 33 | 267 | 196 | 24 | 0 |
| end | 62.01 | 165 | 22 | 33 | 262 | 203 | 185 | 33 | 69 | 1408 | 359 | 93 | 448 | 246 | 33 | 267* | 218 | 29 | 0 |

Fighter 2, AI 2, World 1, RigidBody 34, Collider 69 in every row. *The end row is the result panel after deaths. Its extra 24 scene objects are the dead fighters' loose parts and debris, which the next newRound/clearFlying removes.
Histogram diff, rounds 2 -> 6 (`node H/table.mjs H/runB.json 1`): BufferGeometry +0, Material +0, Object3D +0, Texture +2 (`CanvasTexture 128x128`), AudioNode +1 (StereoPanner, transient).
The 128x128 textures are wound-decal images, cached once per kind/palette in `src/effects.js:238-331` (`texCache`), so they grow only until all kinds have appeared. Bounded.

## Confirmed leak: room reverb nodes left connected on stage change
- Evidence: the ConvolverNode count from queryObjects after GC (`node H/rows_detail.mjs H/runA.json`) goes 0,0,2,3,4,4,4,5,6,7 over Run A. It rises by +1 exactly at castle, loggia, cathedral, castle_night, loggia_night and cathedral_night, the stages that have a `room`. GainNode rises 10 -> 24 alongside it. Run B: Convolver 0 throughout, Gain flat at 10-11.
- Creating code: `src/sound.js:2914-2942` `_applyRoom()` (called by `setStage`, `sound.js:2892`). Each call makes `conv = c.createConvolver()` with a new IR AudioBuffer (`2926-2932`) and two send gains wired `metalBus/fleshBus -> g -> conv` (`2935-2939`).
- Missing cleanup: retiring the old room only fades the sends and, after 4 s, runs `old.conv.disconnect()` (`2920-2921`). That cuts conv -> master, but the inputs `bus -> g -> conv` stay connected. The long-lived buses (`sound.js:1808-1809`) therefore keep the gains, the convolver and its IR alive forever. Fix: also `g.disconnect()` for each of `old.sends` (or `bus.disconnect(g)`) in the same timeout.
- Certainty: the instance count is confirmed by queryObjects; the cause is confirmed by reading the code. Native memory size is estimated from the IR length `room.dur` (`sound.js:1668-1685`: castle 0.8 s, loggia 0.65 s, cathedral 2.8 s, darkhall 1.6 s). I did not measure native audio memory.

## Not a leak, but worth knowing: stage merge sources stay resident
- On cathedral, 1,262+ extra live `BufferGeometry` (non-indexed, attributes position, normal, uv, color, mostly 24/36/96 vertices) exist that are neither drawn nor on the GPU: renderer.info geometries = 153, queryObjects = 2405.
- Source: `src/stage_kit.js:120-157` `putM()` pushes a cloned and coloured geometry into `this.bins[bin]`. `mesh()` (`:161-168`) merges the bin with `mergeGeometries` but never drops or disposes the bin. While the stage's kit object is reachable, every source geometry and its typed arrays stays in the JS heap. The heap difference between cathedral and poseidon is about 4-6 MB, which this likely explains (inferred).
- It is freed on stage change: cathedral 2405 -> poseidon_night 679. So it is bounded by the current stage, not cumulative. Cheap win: `this.bins[bin] = null` (and dispose the sources) after merging.

## Clean (flat after round 1-2), stated explicitly
- Fighter and AI instances: always 2 + 2. Old fighters and AIs are released.
- Rapier: 1 World alive, 33 bodies / 69 colliders in the current world, wrapper counts 34/69 every round. `world.free()` / `eventQueue.free()` run in `src/main.js:505-506`. Wasm linear memory grows once, 1344 -> 1408 KB, then stays at 1408 KB for 10 rounds.
- three.js on a repeated stage: GPU geometries 146, programs 32, scene objects 238, meshes 181, materials 166 and live Material/Object3D/Mesh instances are all flat for 5 rounds. Across stages, `stages.clear()` (`src/stages.js:257-275`) releases the previous stage: counts drop back on lighter stages.
- WebGLRenderTarget: 3 throughout. AudioBuffer: 235-236 throughout. AudioBufferSourceNode: 6-14, which tracks currently playing sounds and does not accumulate.
- DOM: nodes 349-360, jsEventListeners 93 (98 on loggia stages), documents 1 (from Memory.getDOMCounters). Flat.
- JS heap on a repeated stage: +0.21 MB/round over rounds 2-6. That is small and its source was not identified. It could be stats or logs or V8 noise. Not pursued.

## Caveats / not done
- Headless swiftshader with a tiny drawing buffer, DPR 1: GPU-side memory sizes are not representative of a phone, but resource counts are.
- AI vs AI with rounds ended by `enemy.die()` after about 8 s wall. Few full dismemberments or debris showers happened (debris is cleared by `clearFlying` at round start anyway). Long, gory rounds were not covered.
- Only 10 rounds / 10 stages of the order in Run A, and only poseidon in Run B. Stages with special systems (etna terrain, wetland, saengsa maps, team/wander modes) were not exercised.
- Native/wasm audio memory and GPU memory bytes were not measured directly. No `performance.memory` timing or heat measurement was done; the background CPU job makes timings meaningless.
- Each snapshot is taken 1.5 s into the new fight, so a few transient audio nodes and particles are counted. Counts were compared across rounds at the same phase.
