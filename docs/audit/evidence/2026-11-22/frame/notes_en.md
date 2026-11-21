# C2: per-frame cost outside physics, and round-start hitches (main @ 9c5ba917)

## Verdict (8 lines)
1. Main-thread CPU per rendered frame (poseidon, AI vs AI, CPU 4x, 3 runs; GPU wait removed): physics 62.5 % (59.7–64.6), three.js render 25.3 % (22.8–27.1; shadow pass 8.0 % of that), HUD/DOM+input 5.1 % (5.1–5.5), frame glue 2.5 %, effects 0.7 %, sound 0.4–0.6 %, GC 0.5–2.3 %, camera 0.2 %, perfmeter 0.3–0.5 %.
2. Main-thread wall time is ~57 % (56.1–61.5) "GPU wait": the main thread blocked in ReadPixels/WaitForGetOffset at commit. That is a software-GL + software-compositor artifact, the same thing the 30 Sep baseline called "idle (waiting on GPU)".
3. Largest non-physics costs: (a) three.js main-pass JS (setProgram, renderBufferDirect, uniform upload, updateMatrix, projectObject), 8.5 ms/frame at 4x = 14 % of CPU; (b) shadow pass, 4.8 ms/frame = 8 %; (c) HUD: strike_cue.update 1.7 ms/frame plus stamina_hud.update 0.9 ms/frame, running every frame.
4. Stage changes the render share only a little: render is 25 % of CPU on poseidon, 31 % on poseidon_night, 23 % on cathedral. Physics stays at 57–65 %. Effects stay ≤ 1 %. HUD stays at 4.6–5.5 %.
5. Hitch, longest frame (production build): first start from the menu 283 ms at 1x and 650 ms at 4x; next round on the same stage 133 ms at 1x and 233 ms at 4x (about 2x a normal frame); stage change median 1250 ms (917–1317) at 1x and 2117 ms (1967–2350) at 4x, over 4 transitions.
6. Cause 1 of the stage-change hitch: about 0.8 s of JS in startFight at 4x. Of that, nextRoundStage takes 674 ms: stages.build 297 ms and stages.warm 369 ms (shader compile/link about 203 ms of it). newRound takes 119 ms. sound takes about 28 ms.
7. Cause 2: about 1.1 s more of GPU-process wait right after it, while swiftshader compiles and links shaders and does the first draw of the new stage. The warm step moves that work in front of the fight; it does not remove it.
8. Stage change is a one-off per stage visit (it adds new programs: 31→37, 37→61, 50→57). The same-stage rematch adds 0 programs and has no real hitch. Repetitions are short of the 3 asked for (see "Not done").

Absolute ms come from a shared 4-core desktop CPU running software GL (swiftshader), with another low-priority job running at the same time. They are not phone numbers. Use the shares and the ratios.

## Method / commands (scripts in C2/, URLs as argv)
- Q1 ran on the dev server (`npx vite --port 5197 --strictPort` in the checkout), so file and function names are readable. Q2 ran on the production build (`npx vite build --outDir C2/dist --sourcemap`, then `npx vite preview --outDir C2/dist --port 5198`). All servers and browsers are stopped.
- Q1: `node q1_profile.mjs http://127.0.0.1:5197 <stage> <rate> out/q1_<stage>_r<rate>_<k> 20`. Setup: 844x390, DPR 3, mobile; second AI on the player; canvas buffer shrunk to 8x4 (TINY); 2 s settle; CDP Profiler at 200 µs for 20 s. The same run records a MutationObserver count on body (perf readout excluded) and Performance.getMetrics.
- Bucketing: `node prof_bucket.mjs <cpuprofile> <frames> --nonphys`. Each sample is assigned by the direct callee of main.js `frame()`. Physics = the step-loop callees (fighter.step, ai.update wrapper, world.step via body_reads, combat.afterStep, cacheState, parry_button.step). Render = WebGLRenderer.render and below; the shadow pass is samples under WebGLShadowMap.render (three.js lines 47119–47414). "(program)" = GPU wait.
- GPU-wait proof: `node q1_trace.mjs http://127.0.0.1:5197 poseidon 1 out/q1_trace_r1.json 4`. Main thread at 1x: 70.9 % exclusive in CommandBufferProxyImpl::WaitForGetOffset, under Commit → GLES2::ReadPixels (22 ms/frame). FunctionCall (JS) is 18.7 %.
- Shadow A/B: `NOSHADOW=1 node q1_profile.mjs … poseidon 1 …`. The GPU wait drops only from 50.4 to 39.1 ms/frame, so the shadow map is not the main GPU cost here.
- Q2: `node q2_hitch.mjs http://127.0.0.1:5198 <rate> out/q2_r<rate>_<k>.json 4 1`. A rAF recorder is installed by an init script. Rounds end through `enemy.die`/`player.die` and the real `#btnStart` click (journey order poseidon→clearing→castle→loggia→cathedral, then a lost-round rematch). Re-analysis: `node q2_analyze.mjs out/q2_r4_a.json out/q2_r1_a.json`. A frame is in the window if it STARTS between the click and the first fight frame + 2 s.
- Hitch profile: `PROFILE=out/q2_prof_r4 node q2_hitch.mjs … 4 …`, mapped to source with `node prof_map.mjs out/q2_prof_r4.cpuprofile dist out/q2_prof_r4.mapped.cpuprofile <checkout>/node_modules`. Read with `node prof_hitch.mjs out/q2_prof_r4.mapped.cpuprofile 25` and with `--long` (samples inside the longest gap between frame() samples only).

## a. Steady fight, poseidon, TINY, CPU 4x (3 runs a/b/c; ms/frame = ms ÷ rendered frames)
| bucket | share of CPU (a / b / c) | ms/frame (a) |
|---|---|---|
| physics (incl. 2nd AI) | 62.5 / 64.6 / 59.7 % | 37.7 |
| render: main pass JS | 14.1 / 13.7 / 14.7 % | 8.5 |
| render: shadow pass (JS+GL) | 8.0 / 6.0 / 8.7 % | 4.8 |
| render: GL calls main pass | 3.3 / 3.1 / 3.8 % | 2.0 |
| HUD/DOM + input (strike_cue, stamina_hud, playerInputFrame, tech cue) | 5.1 / 5.5 / 5.1 % | 3.1 |
| frame() self (main.js glue, inlined callees) | 2.7 / 2.5 / 2.4 % | 1.6 |
| effects (trails, drips, decap/limb fx, aura, particles, cape, fighter_light, trail.draw) | 0.7 / 1.0 / 0.7 % | 0.43 |
| sound (whoosh, bind, body sounds, sound.update) | 0.6 / 0.4 / 0.6 % | 0.35 |
| GC | 0.5 / 0.7 / 2.3 % | 0.32 |
| mesh sync (fighter.syncMeshes) | 0.5 / 0.5 / 0.4 % | 0.29 |
| other tasks (timers, gun_fx's own rAF loop, handlers) | 1.0 / 0.8 / 0.8 % | 0.58 |
| perfmeter (?fps=1, measurement) | 0.5 / 0.4 / 0.3 % | 0.31 |
| stage anim (arena.update) / camera | 0.3 / 0.2 % | 0.15 / 0.11 |
CPU per frame 60.4 / 58.1 / 59.7 ms. GPU wait on top: 56.1 / 56.7 / 61.5 % of wall. FPS 7.0 / 7.1 / 6.2; game speed 35 / 35 / 31 %; steps capped at 6 per frame. The perfmeter shows physics 42–43 ms and draw 14–19 ms per frame.
At 1x (`… poseidon 1 …`, 1 run): physics 59.3 %, render 28.7 % (shadow 8.0), HUD 4.8 %, glue 1.9 %, GC 1.4 %, effects 1.0 %, sound 0.5 %. CPU is 14.4 ms/frame, plus 50.4 ms/frame of GPU wait (15 fps).
Physics split at 4x (run a, share of all non-idle): fighter.js 8.1 %, rapier wasm 6.4 %, ai.js 2.7 %, rapier JS 2.2 %, gait.js 1.7 %, three math inside step 1.1 %.

## b. Other stages (CPU 4x, 1 run each)
| stage | physics | render total (shadow) | HUD | effects | stage anim | CPU ms/fr | GPU wait % | calls / tris / programs |
|---|---|---|---|---|---|---|---|---|
| poseidon (median of 3) | 62.5 % | 25.3 % (8.0) | 5.1 % | 0.7 % | 0.2 % | 59.7 | 56.7 | 264 / 82k / 31 |
| poseidon_night | 57.1 % | 30.7 % (9.2) | 5.2 % | 1.0 % | 0.8 % | 66.8 | 57.8 | 287 / 85k / 37 |
| cathedral | 65.1 % | 22.8 % (5.0) | 4.6 % | 0.8 % | 0.6 % | 61.8 | — | 269 / 84k / 36 |
The stage-dependent parts are render (night: more draw calls, lights and shadow) and stage animation (0.2 → 0.8 %). Everything else stays about the same.

## c. Top 15 non-physics functions by self time (poseidon 4x run a; % of CPU)
| % | ms/fr | function file:line | what it does / runs when |
|---|---|---|---|
| 2.9 | 1.74 | update src/strike_cue.js:168 | cue above the head: readCueWindow, sprite placement, tint edge. Every frame, even with no cue open. |
| 2.7 | 1.62 | frame src/main.js:3208 | the loop body itself, with its inlined callees. Every frame. |
| 1.5 | 0.90 | setProgram three.module:52328 | per-object program and uniform binding. Every object, every frame. |
| 1.1 | 0.66 | bindVertexArray (native), shadow pass | GL VAO binds in the shadow map pass. Every frame. |
| 1.0 | 0.61 | upload three.module:45414 | uniform upload per object. Every frame. |
| 1.0 | 0.59 | (anon) src/stamina_hud.js:49 | per-bar closure: head projection, style.left/top, dataset, aria, transform. Writes every frame even when unchanged. |
| 0.9 | 0.56 | bindVertexArray (native), main pass | GL. Every frame. |
| 0.9 | 0.55 | renderBufferDirect three.module:51786 | per-draw setup. Every frame. |
| 0.8 | 0.51 | uniformMatrix4fv (native) | matrix uniforms. Every object, every frame. |
| 0.8 | 0.50 | updateMatrix three.module:10023 | local matrix recompute for every object with matrixAutoUpdate, including static stage meshes. Every frame. |
| 0.8 | 0.47 | renderObject three.module:47372 (shadow) | shadow-caster draws. Every frame. |
| 0.7 | 0.44 | markUniformsLightsNeedsUpdate :52491 | light uniform dirtying. Every object, every frame. |
| 0.6 | 0.37 | projectObject :52080 | scene traversal and culling. Every frame. |
| 0.6 | 0.35 | getBindingState :42912 (shadow) | VAO lookup. Every frame. |
| 0.5 | 0.33 | refreshUniformsCommon :50083 | material uniforms. Every frame. |
Next on the list: GC 0.5 %, stamina_hud update:46 0.5 %, perfmeter show:66 0.4 % (only with ?fps=1). Night stage shows the same top list (strike_cue 3.1 %, shadow renderObject 1.7 %).

## d. DOM writes during a fight (MutationObserver records/s on body; Performance.getMetrics)
| run | mutations/s | per frame | style recalc ms/s | layout ms/s |
|---|---|---|---|---|
| poseidon 4x a/b/c | 138 / 141 / 122 | ~19–20 | 8.7 / 9.1 / 7.7 | 7.5 / 7.1 / 5.8 |
| poseidon 1x | 302 | 19.6 | 4.7 | 3.8 |
| poseidon_night 4x / cathedral 4x | 119 / 139 | ~19 | 9.2 / 8.0 | 7.1 / 7.2 |
Almost all records are attribute writes (child-list changes ≤ 0.4/s). At 4x: 138/s ÷ 7 fps ≈ 19–20 per frame. That matches stamina_hud writing about 9–10 attributes per bar per frame for 2 bars. Style plus layout is about 0.5–2 % of the main thread.

## e. Against the 30 Sep baseline (night stage, 4x; shares of the whole profile, idle/GPU wait included)
| bucket | 30 Sep | now poseidon_night | now poseidon (a) |
|---|---|---|---|
| three.js render JS | 23.6 % | 11.0 % | 9.8 % |
| idle / GPU wait | 25.7 % | 57.8 % | 56.1 % |
| Rapier compute (wasm) | 12 % | 5.9 % | 6.4 % |
| fighter.js | 9.2 % | 7.5 % | 8.2 % |
| GL calls | 6.7 % | 3.1 % | 2.5 % |
| Rapier JS wrappers | 6.3 % | 1.9 % | 2.3 % |
| GC | 3 % | 0.2 % | 0.2 % |
| trails/glow/aura/debris/effects/sound | ≤ 0.3 % each | 0.1–0.5 % each | same |
Reading: everything that is not GPU wait has shrunk as a share of the whole profile, because the GPU-wait share roughly doubled under this harness: canvas 8x4 but DPR 3 context, readback on every frame, a shared CPU. Compare CPU-only ratios instead: render:physics is about 0.4 (25 % vs 62 %). These numbers are not a regression claim.

## f. Hitches, production build, TINY canvas (longest frame in [click, first fight frame + 2 s])
| situation | 1x longest | 4x longest | steady median frame (1x / 4x) | >50 ms frames summed (1x / 4x) |
|---|---|---|---|---|
| first start from menu (poseidon) | 283 ms | 650 ms | 67 / 150 | 2967 / 4117 ms |
| same stage rematch (cathedral) | 133 | 233 | 67 / 117 | 1617 / 3117 |
| poseidon→clearing | 1250 | 2117 | 100 / 217 | 2083 / 2933 |
| clearing→castle | 1083 | 2017 | 33 / 100 | 2284 / 3300 |
| castle→loggia | 917 | 1967 | 50 / 133 | 1200 / 2817 |
| loggia→cathedral | 1317 | 2350 | 200 / 300 | 2267 / 3283 |
Stage change: median 1250 ms [917–1317] at 1x and 2117 ms [1967–2350] at 4x. The long frame comes about 1 frame after state becomes 'fight' (raw frame list in out/q2_r4_a.json).
">50 ms summed" is not useful as a hitch measure here, because steady frames on software GL are already ≥ 33 ms. The excess over 2x the steady median is 1150 / 1634 / 867 / 1117 ms at 1x and 1900 / 1917 / 1833 / 2050 ms at 4x.
Game's own counters (stages.buildMs / warmMs at 1x): clearing 83/232, castle 114/168, loggia 231/143, cathedral 157/123 ms. At 4x: 293/382, 388/250, 797/261, 569/266.
The result-panel side (death → click window) has longest frames of 50–117 ms at 1x and 167–383 ms at 4x. That is small next to the stage-change frame.

## g. What is inside the stage-change hitch (poseidon→clearing, 4x, profile mapped to source)
- In the click task, startFight (main.js:1891) takes 802 ms total. nextRoundStage takes 674 ms of it:
  - stages.build 297 ms (buildClearingB 280; stage_clearing.js ashGround 63; stage_kit putM/merge about 70)
  - stages.warm 369 ms: renderer.compile 117 ms, getProgram/WebGLProgram/getUniforms about 180 ms, getProgramInfoLog 141 ms (a sync GL call), texture texSubImage2D/upload about 24 ms
- newRound (fighters, Rapier world, outfits) takes 119 ms. sound (setStage/_applyRoom) about 28 ms. GC 29 ms in the whole 4.5 s profile. reverbIR does not appear for clearing.
- The longest gap between frame() samples is 1139 ms and is 99.9 % "(program)". After the JS, the main thread waits for the GPU process (swiftshader compiling and linking the new programs, then the first draw).
- Share of the long frame (about 2.1 s): JS about 40 % (stage build about 15 %, shader compile JS side about 15 %, newRound about 6 %, sound about 1 %); GPU-process wait about 55–60 %.
- renderer.info.programs: 31→37 (clearing), 37→61 (castle), 61→50 (loggia, old programs released), 50→57 (cathedral). Same stage: 57→57. First start: 31→31.

## h. One-off versus every round
- Once per stage visit: stages.build (clear plus build), stages.warm (shader compile and link, texture upload, first draw), sound.setStage room change, and the GPU-side compile. Stage changes happen on every won round in the journey, so on a winning streak this hitch comes every round.
- Every round, including the same stage: newRound (fighter and outfit construction, Rapier world reset; about 120 ms at 4x) and prepareRound. Result: 133 ms at 1x and 233 ms at 4x on the same stage, with no new programs.
- First start from the menu: no stage build, because the stage is built at page load. Its hitch is newRound plus the first draw of the fighters and effects: 283 ms at 1x, 650 ms at 4x.

## Caveats
- Software GL: the main thread blocks in ReadPixels at every commit (software compositor). That block shows up as "(program)" in profiles and swallows 56–62 % of wall time. On a phone the GPU works in parallel and the readback does not happen. GPU time here says nothing about a phone GPU.
- Shader compile and link on swiftshader is CPU work in the GPU process. A phone driver may be faster or slower; mobile drivers often compile lazily at first draw.
- Q1 used the dev server (unminified ESM, prebundled three/rapier). Q2 used the production build, profile mapped back through source maps.
- Shared CPU: another job ran at the same time. q2_debug.json (not used above) ran alongside a Q1 profile.
- AI vs AI: the second AI doubles AI cost inside physics. Physics at 4x is capped at 6 steps per frame (game speed 31–35 %), so per-frame physics ms is a ceiling.
- The profiler at 200 µs adds overhead (about 15 fps at 1x with the profiler; steady frames without it are 33–67 ms).

## Not done
- Q2 has 1 run per throttle rate (4 transitions + 1 same-stage + 1 first start each), not 3. The r4 b/c and r1 b/c runs were cut for time.
- Q1 has 1 run at 1x and 1 run on each other stage. No sluice stage.
- No reverb-IR transition: the stages measured did not show reverbIR. Cathedral or castle as the target may contain it, but it was not isolated.
- No phone run.
