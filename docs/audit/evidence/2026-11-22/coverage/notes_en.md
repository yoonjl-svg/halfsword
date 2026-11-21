# Coverage of the "game unchanged" gates and the test suite (main @ 9c5ba917)

## Verdict
1. Game code `src/**/*.js`: 272 files, 80,013 code lines, 7,825 functions. Executed lines / functions: **3 core gates 25.0 % / 13.5 %**, **7 gates 33.8 % / 23.8 %**, **gates + `npm test` 52.8 % / 47.8 %**.
2. Never loaded at all: 119 files (A), 114 (B), 31 (C). `src/main.js` (2,827 lines, 302 functions) is never loaded by any gate or test: **0 %**.
3. Human-input path (17 files/ranges, 2,675 lines, 274 fns, main.js only as `playerInputFrame`): lines executed **A 12.8 %, B 23.2 %, C 87.9 %**. Counting all of main.js (5,422 lines): **A 6.3 %, B 11.5 %, C 43.4 %**. Gates exercise human-side code almost only through `finish_thrust` and `corr_s0`.
4. Tests reach the human-side modules (input.js, parry_button, atk_stick, unique_assist, pickup, close_hold) by calling their methods directly with fake events/state. None of the dispatch glue in `playerInputFrame`, which decides *which* of the ~17 tap actions a tap becomes and in what order, ever runs.
5. Tap chain, 17 branches: **3 are executed by nothing** (guard release on tap, greatsword cleave finish, plunge finish on a downed foe). **9 run only in tests**: secret window, sheathed draw, clinch lock, pommel, CN buffer, the 3 school taps, whip flick (4 of these in a single test file each). **5 run in a gate**: gun, vital thrust, Italian lunge, head thrust, plain thrust, mostly through AI calls. Only finish_thrust takes the player variant. Sub-paths executed by nothing: walk-to-range before a vital thrust, the school-tap fallback to a normal thrust, and the non-drive lunge step.
6. Yesterday's 10 "byte-identical" merges: 491 added/changed `src` code lines can be traced to HEAD. **43 of them (8.8 %) are executed by no gate and no test**. Leaving out the config comment rewrite: 43 / 280 = **15 %**. In the two browser-side commits (c879e381, a97050ce) **43 / 65 = 66 %** of lines are executed by nothing, mostly in main.js. All the perf-commit lines are executed by the 3 core gates.
7. Executed ≠ verified: the gates compare printed summaries, and a line being run says nothing about whether its result is checked. Tests alone execute 52.2 % (41,747 lines); the 7 gates add only 468 lines on top of the tests.
8. Browser side: 211 entries in `tools/browser/` (196 .mjs). None is run by `npm test` or CI, which only builds. 45 send real touch/pointer events; 8 of those can fail with a non-zero exit. None is part of any routine I could find.

## Method (all scripts in `scratchpad/C1/`, paths as argv)
- Collection: `C1/run_gates.sh <checkout> <outdir>` runs each gate as `NODE_V8_COVERAGE=<outdir>/raw/{A|Bx} nice -n 15 node tools/sim/<gate> …`. A = fights12, live_battery, `finish_thrust 1 --stand`. Bx = match_twin, `corr_s0 --limits=on,off`, weapon_smoke, `team_fights 6 60 --modes=2v2,3v3,2v1 --jobs=1`. I used --jobs=1 to stay at 2 processes. Its worker is a spawned child that inherits the env, so the worker's coverage file is captured: raw/Bx has 5 files.
- `C1/run_tests.sh <checkout> <outdir>` runs `NODE_V8_COVERAGE=… nice -n 15 node --test --test-concurrency=1 tools/sim/*.test.mjs`: 969 tests pass, 146 raw files, 810 s. This is the npm-test file set at concurrency 1 instead of 2, which changes no coverage. All 7 gates exited 0. `git status` in wt2 stayed empty afterwards: nothing was written into the tree.
- Merge: `node C1/merge.mjs <wt2> C1/{A,B,C}.json <rawdirs…>` (A = raw/A; B = raw/A raw/Bx; C = + raw/T). Raw dirs are kept in `C1/raw/`.
  Rule: in each process, every range of a script is painted outer-first, so the innermost range's count wins for each character. A character counts as executed if its count is > 0 in any process. Code characters are the non-whitespace characters outside comments (comments are found with the rolldown parser's literal spans). A **line is executed if at least one of its code characters is executed** (c8-like). A **function is executed if the character at its body start is executed**. Functions are listed from the AST (rolldown `parseAst`), so files that were never loaded also have a function total.
- Summaries: `node C1/analyze.mjs <wt2> A.json B.json C.json totals|top25|classify|input`. Branch probes: `node C1/probe.mjs <wt2> C1/tap_probes.json A=raw/A Bx=raw/Bx T=raw/T`, which checks one character per branch and names every gate/test process that ran it.

## 2. Whole game (`analyze.mjs … totals`)
| set | loaded | never loaded | code lines exec/total | % | functions exec/total | % |
|---|---|---|---|---|---|---|
| A 3 core gates | 153 | 119 | 19,986/80,013 | 25.0 | 1,058/7,825 | 13.5 |
| B 7 gates | 158 | 114 | 27,039/80,013 | 33.8 | 1,864/7,825 | 23.8 |
| C gates+tests | 241 | 31 | 42,215/80,013 | 52.8 | 3,744/7,825 | 47.8 |

Files loaded where only top-level code ran (no function ever called): A 43 files / 5,362 lines; B 22 / 2,006; C 47 / 14,224. In C these are mostly stages and outfits that tests import for their tables.

25 largest files (`analyze.mjs … top25`; nl = not loaded):
| file | lines | fns | A L% | B L% | C L% | A F% | B F% | C F% |
|---|---|---|---|---|---|---|---|---|
| ai.js | 3824 | 239 | 56.5 | 64.1 | 82.3 | 51.9 | 61.1 | 81.6 |
| fighter.js | 3769 | 248 | 77.8 | 85.3 | 95.6 | 69.0 | 77.0 | 93.5 |
| sound.js | 3073 | 262 | nl | nl | 13.5 | nl | nl | 6.5 |
| main.js | 2827 | 302 | nl | nl | nl | nl | nl | nl |
| secret_instant.js | 2779 | 188 | 4.6 | 25.6 | 86.6 | 2.1 | 24.5 | 85.6 |
| outfits.js | 2577 | 384 | 22.9 | 22.9 | 38.2 | 2.9 | 2.9 | 18.5 |
| gait.js | 1654 | 58 | 74.0 | 89.0 | 92.7 | 74.1 | 91.4 | 93.1 |
| stage_sluice_bear.js | 1612 | 146 | 13.9 | 13.9 | 13.9 | 6.2 | 6.2 | 6.2 |
| skill.js | 1434 | 49 | 33.5 | 43.0 | 66.9 | 30.6 | 42.9 | 83.7 |
| weapons.js | 1415 | 115 | 76.6 | 96.3 | 99.7 | 42.6 | 82.6 | 99.1 |
| unique_assist.js | 1279 | 128 | 8.5 | 8.5 | 90.1 | 7.0 | 7.0 | 92.2 |
| weapon_looks.js | 1279 | 102 | 27.1 | 98.2 | 98.4 | 23.5 | 98.0 | 98.0 |
| iai_obi.js | 1255 | 68 | 15.3 | 60.2 | 99.6 | 5.9 | 54.4 | 100.0 |
| arena.js | 1245 | 74 | nl | nl | 1.7 | nl | nl | 0.0 |
| config.js | 1196 | 4 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| stage_corsair.js | 1150 | 56 | nl | nl | 1.6 | nl | nl | 0.0 |
| combat.js | 943 | 63 | 87.2 | 92.5 | 98.8 | 77.8 | 90.5 | 96.8 |
| stage_cathedral.js | 935 | 43 | nl | nl | 1.9 | nl | nl | 0.0 |
| stage_temple.js | 932 | 57 | nl | nl | 2.9 | nl | nl | 0.0 |
| stage_sluice.js | 863 | 60 | nl | nl | 3.5 | nl | nl | 6.7 |
| secret.js | 860 | 82 | 8.6 | 8.6 | 70.9 | 2.4 | 2.4 | 62.2 |
| characters.js | 834 | 25 | 97.7 | 97.7 | 98.3 | 68.0 | 68.0 | 80.0 |
| looks.js | 776 | 1 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| stage_clearing.js | 754 | 43 | nl | nl | 6.6 | nl | nl | 0.0 |
| stage_loggia.js | 727 | 47 | nl | nl | 3.7 | nl | nl | 0.0 |
config.js and looks.js are data literals: they show 100 % as soon as the file is imported.

## 3. Never-loaded or <10 % files in C (`analyze.mjs … classify` + family roll-up)
79 files / 25,652 lines. 29 of them cannot be reached by static import from any `tools/sim/*.mjs` (browser-only by construction). The other 48 (stages, outfits, arena, 2 audio helpers) are imported by tests but only their top-level code runs: arena/stage_* through saengsa_maps, titles and wander tests; outfit_* through ~120 test processes via the fighter build.
| family | files | code lines | never loaded (files / lines) | never-loaded members ← importer |
|---|---|---|---|---|
| stage_* | 33 | 14,156 | 1 / 185 | pixel_grove ← lobby, saengsa_page |
| outfit_* | 14 | 2,871 | 0 / 0 | (all loaded, top level only, 3–9 %) |
| other (entry/app) | 6 | 3,160 | 6 / 3,160 | main ← game_entry; game_entry, pwa (html roots); account/config ← title_account; perfmeter ← main; test_storage ← game_entry |
| ui/lobby/saengsa/HUD | 10 | 1,656 | 10 / 1,656 | lobby, saengsa_page, start_screen, account/title_account ← game_entry; saengsa_panel, shop_panel ← lobby; update_notes ← start_screen; capture_hud, stamina_hud, title_notice ← main |
| camera/scene | 3 | 1,416 | 2 / 171 | hands ← main; render_cap ← main (arena.js loaded, 1.7 %) |
| effects | 6 | 1,239 | 6 / 1,239 | fighter_light, gun_fx, mad_eyes, revive_fx, screen_tint, trail ← main |
| sound | 4 | 809 | 3 / 726 | soundgen, soundlab, voicelab (own pages) |
| input/test route | 3 | 345 | 3 / 345 | test_route ← main; test_pick (page); whiff_drill ← main |
(ii) Reachable from the gate/test import graph but never executed: none among the never-loaded files. Every never-loaded file is reachable only through main.js / game_entry / page roots. Also notable, though above 10 %: sound.js runs at 13.5 % (4 tests load it).

## 4. Human input path (`INPUT_FILES=… analyze.mjs … input`)
| file / range | lines | fns | A F% | B F% | C F% | A L% | B L% | C L% | functions never run in C |
|---|---|---|---|---|---|---|---|---|---|
| input.js | 318 | 46 | 0 | 13.0 | 69.6 | 0 | 29.9 | 95.3 | all 14 DOM listener wrappers (pointerdown/move/up/cancel, key, blur @42-54, 283-284, 356-363) |
| main.js playerInputFrame 3078-3187 | 80 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | playerInputFrame (main.js never loaded) |
| parry_button.js | 192 | 13 | 0 | 0 | 84.6 | 0 | 0 | 95.3 | addFoe, setFoe |
| atk_stick.js | 59 | 6 | 0 | 0 | 100 | 0 | 13.6 | 100 | – |
| attack_stroke.js | 24 | 3 | 100 | 100 | 100 | 100 | 100 | 100 | – |
| attack_tempo.js | 35 | 4 | 50 | 100 | 100 | 71.4 | 100 | 100 | – |
| finger_cut.js | 22 | 3 | 66.7 | 100 | 100 | 59.1 | 100 | 100 | – |
| unique_assist.js | 1279 | 128 | 7.0 | 7.0 | 92.2 | 8.5 | 8.5 | 90.1 | prevAtk, join, windCancel, spend@1306, +6 anon |
| stick_turn.js | 1 | 0 | – | – | – | 0 | 100 | 100 | (one constant) |
| run.js | 150 | 12 | 0 | 100 | 100 | 8.7 | 100 | 100 | – |
| pickup.js | 196 | 21 | 23.8 | 23.8 | 85.7 | 24.0 | 24.0 | 94.4 | revivalHandoff, +2 anon |
| close_hold.js | 65 | 10 | 80 | 80 | 100 | 61.5 | 61.5 | 100 | – |
| skill.js thrust 235-327 | 68 | 1 | 100 | 100 | 100 | 61.8 | 70.6 | 82.4 | – (branches below) |
| secret_instant.js drawTick 1151-1203 | 42 | 2 | 0 | 0 | 100 | 2.4 | 2.4 | 73.8 | – |
| secret_instant.js requestArt* 3318-3428 | 69 | 12 | 8.3 | 25.0 | 91.7 | 37.7 | 56.5 | 100 | artTechOf setter |
| test_route.js | 58 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | all (never loaded) |
| iai_obi.js drawInput/drawTapTake 333-351 | 17 | 2 | 0 | 0 | 100 | 11.8 | 11.8 | 100 | – |
| **TOTAL** | 2675 | 274 | 11.3 | 19.7 | 85.0 | 12.8 | 23.2 | 87.9 | with all of main.js: 5,422 lines, L% 6.3 / 11.5 / 43.4 |
The input.js methods (onDown/onMove/onUp, consumeTaps…) are run by 26 test files that call them with synthetic events. The listeners that bind them to real DOM events never run. In B, input.js is loaded only by corr_s0.

Tap decision chain (main.js 3092-3165 → skill.js `thrust` 235-327 → unique_assist `tapChain`/`launchTap` 602-680). One character probed per branch (`probe.mjs … tap_probes.json`, `extra_probes.json`):
| # | branch (probe) | gates | tests (files) |
|---|---|---|---|
| – | main.js dispatch itself (3106 / 3119 / 3128 / 3139 / 3165) | none | none |
| 1 | secret window → `secret.fire()` (secret.js 1166) | none | 7: gk_ghost, gonosen_risk, gyeoksal, motion_regress, riso_reach, secret_stamina, secret_uses |
| 2 | sheathed draw → `drawInput` start / `drawTapTake` (iai_obi 341/348) | none | secret_free only |
| 3 | clinch lock eats tap (close_hold 96) | none | de_dirty, jp_de_basics, rapier_defence |
| 4 | pommel at hilt distance (close_hold 105) | none (skill.pommel itself: AI in fights12, corr_s0, match_twin, team_fights) | de_dirty, jp_de_basics, jp_tank, rapier_defence |
| 5 | Chinese block buffer → `secret.buffer` (1092) | none | gyeoksal only |
| 6 | guard release on tap (`G.broken = true`, main.js 3139 only) | **none** | **none** |
| 7 | school tap: cavazione (ua 646) | none | cavazione_tap, rapier_defence, special_cooldown |
| 8 | school tap: inquartata side-step (ua 651) | none | cavazione_tap, motion_regress, special_cooldown |
| 9 | school tap: lian wing-fold (ua 661) | none | lianchi_tap, motion_regress, special_cooldown |
| – | school tap falls back to a normal thrust (ua 672) | none | **none** |
| 10 | gun fires (skill 242) | weapon_smoke (AI) | none |
| 11 | greatsword cleave finish on a downed foe (skill 305) | **none** | **none** |
| 12 | plunge finish (skill 310; `down` block 304) | **none** | **none** |
| 13 | whip flick (skill 256) | none | druid_whip only |
| 14 | vital thrust (skill 297) / player picks target (270) | team_fights (AI) / finish_thrust | 5 / 18 files; walk-to-range first (275): **none** |
| 15 | Italian lunge (skill 294 / step 323) | weapon_smoke, team_fights (AI) | 13 / 7 files |
| 16 | head thrust (skill 426 `'head'`) | finish_thrust | onehand_arm, wrist_audit |
| 17 | plain thrust: drive step (320) | finish_thrust | 12 files; non-drive gait step (322): **none**; no-gait lunge (324): italian_opposition |
(Duplieren via tap is disabled by design: `TAP_TRIG.dup` returns null.)

## 5. Recent "game unchanged" merges (`node C1/commits.mjs <wt2> A.json B.json C.json <commits…>`)
Added lines are mapped from each commit's tree to HEAD through `git diff -U0 <c> HEAD`. Lines that were changed again later count as "relaid" and are not scored. Coverage is from the HEAD runs. "partly" = executed lines that still contain a never-executed character (e.g. a short-circuit).
| commit | added | comment/blank | relaid | code lines | A | B | C | partly (C) | by nothing |
|---|---|---|---|---|---|---|---|---|---|
| 967351d6 dead code | 49 | 23 | 10 | 16 | 13 | 13 | 16 | 2 | 0 |
| aac30931 perf | 143 | 31 | 5 | 107 | 107 | 107 | 107 | 1 | 0 |
| 4bf064a2 perf | 31 | 1 | 0 | 30 | 30 | 30 | 30 | 0 | 0 |
| f5cfcea1 perf | 46 | 5 | 0 | 41 | 41 | 41 | 41 | 1 | 0 |
| 834f071a perf | 24 | 7 | 0 | 17 | 17 | 17 | 17 | 1 | 0 |
| 65c0a9f2 perf | 5 | 2 | 0 | 3 | 3 | 3 | 3 | 0 | 0 |
| c879e381 pause freeze | 86 | 22 | 0 | 64 | 7 | 7 | 22 | 1 | **42** (main 29, gun_fx 4, sword_trail 3, fighter_light 2, hands 2, outfit_tuyana 2) |
| a97050ce test-screen table | 3 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | **1** (main) |
| 3df96888 tiredPower | 1 | 0 | 0 | 1 | 1 | 1 | 1 | 0 | 0 |
| 1a1e36c7 config comments | 416 | 205 | 0 | 211 | 211 | 211 | 211 | 0 | 0 (data literals: run on import, values not asserted) |
Dead-code commit 967351d6, removed lines on the parent tree. The parent was exported with `git archive 967351d6^` into C1/parent, all gates and tests were rerun there (962 pass), then `VERBOSE=1 node C1/removed.mjs <wt2> 967351d6 P_A.json P_B.json P_C.json` (output in C1/out_removed.txt).
Removed 395 lines, 246 of them code. **Executed on the parent: A 103, B 103, C 151.**
- In the gates (103): config keys, imports and top-level tables evaluated on load (config 35, WEAPON_LAYER 10, …). Guard lines on switches that are off (`if (DIG_PROTO.run && …)`, `JOINTS.wristSwing && …`, `BODY.footReaction === 0`). Identity factors (`bleedMult ?? 1`, `uprightRelax()` returning 1). The `accelLean` block in fighter.js 3007-3018, which ran every step and computed a lean that was then scaled by `BODY.accelLean = 0` (inert, but not unexecuted). Plus 3 false positives from the V8 continuation quirk (uprightRelax 2860-2862, see caveats).
- In tests only (+48): the switched-off prototypes ran in full: dig_proto `aiFrontDash`/`runTick` (34 lines), fighter `gripDevOn` (wrist rope), gait 867-870. Tests turned those switches on, so this code was dead for the game but live in the suite (the parent has 962 tests, HEAD 969).
- Verdict: nothing removed changed what the gates compute, but "dead" here means inert, not unexecuted. The accelLean block was live code multiplied by 0.

## 6. Browser-side checking (grep, not run)
- `tools/browser/`: 211 top-level entries, 229 files (196 .mjs, 24 .py, `director_checks/` with 18 scripts + README).
- `npm test` runs only `tools/sim/*.test.mjs`. 4 test files mention tools/browser, but only in comments or by reading a script's text (druid_whip.test reads weapon_thumbs.mjs). CI (`.github/workflows/deploy.yml`) runs `npm ci` and the builds, with no check step.
- Docs mention individual scripts as one-off verifications (e.g. game_entry_smoke in 17 docs, parry_button_probe in 4, touch_stamina_probe in 3). I found no documented routine or "before merge" list that runs them.
- Real touch/pointer input in a browser: 45 scripts dispatch `dispatchTouchEvent` / `touchscreen.tap` / `TouchEvent` / `pointerType:'touch'` (e.g. touch_stamina_probe, parry_button_probe, cavazione_probe, gonosen_window_probe, cn_combo_probe, longpress_probe, atk_stick_shots). Only 8 of them can fail (`process.exit(1)`/`exitCode=1`/`assert`): game_entry_smoke, ui_fix_smoke, stamina_smoke, skill_tree_layout, player_stiff_freeze, hero_tear_smoke, redondo_motion_shots, mordschlag_real_check. The rest produce screenshots or numbers for a person to read. None of them is automated.
- At least 11 test files read `src/main.js` as text and assert on the source (atk_stick, druid_whip, hp_strip, impact_fx, pappenheimer, pause_freeze, prof_body, secret_sfx, shop, skill_cmd, whip_sound). These pin wording and wiring; they do not execute it.

## Caveats
- **Executed ≠ verified.** Gates print summaries and the tests assert what they assert. A line counted here only ran at least once, in any process. Data/config files score 100 % on import.
- Line rule is c8-like and generous: a line counts as soon as one code character on it ran. The line of an uncalled `const f = () => {` and the closing `};` both count as run, because the binding and the `;` belong to the outer scope. Function % is the stricter measure.
- V8 continuation quirk (seen in the raw data): after an early `return`, V8's zero-count continuation range can stop at the last nested expression, so the remaining lines inherit the function's count. Example: parent fighter.js `uprightRelax`, where the range 2851:88-2860:55 has count 0 but 2860:77 to the end is unranged, so lines 2860-2862 read as executed although `anchorRelax` was false. This inflates line % somewhat everywhere, as it does in c8. Function % and the branch probes are not affected.
- V8 block coverage: one-character probes depend on V8's range splitting. Ternaries and `&&` are split, but some single-expression branches are not. The tap probes were placed on statement starts inside the branch, except #16 (ternary) and #10 (return after `if`).
- The gates' "human" code is mostly reached through AI calls that share functions: skill.thrust with `vital` passed, skill.pommel, gun. Only finish_thrust runs the player-thrust variant (`vital` undefined, stamina charge for a non-AI fighter).
- Tests ran at concurrency 1 (npm test uses 2) and team_fights ran with --jobs=1. Same files and games, so coverage is the same.
- Commit mapping: 15 lines (967351d6: 10, aac30931: 5) were changed again later and are not scored. Coverage is measured on HEAD, not on each commit's own tree.
- Not done: per-test attribution for every file (only for probes and the files named above); main.js player-side helpers beyond `playerInputFrame` (parryHold handlers, showPlayerCue…) are not broken out separately. They are 0 % anyway, since main.js never loads.
