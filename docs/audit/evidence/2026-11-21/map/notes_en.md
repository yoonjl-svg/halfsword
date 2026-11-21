# Map: what the player must know + AI decision categories (main, read-only)
Paths: `src/` = checkout of main; sims ran in an instrumented copy (`scratchpad/M`). Static = from reading code; measured = from a counted run.
## Summary (8 lines)
1. Combat gestures: **11** (+ settings toggle + gun mode). Input thresholds: **~20 space/time cut-offs** + **6 timing windows** (A1).
2. Gesture→action pairs: **~47**. Tap ~17, swipe ~12, stick ~9, guard button ~6, hold ~3 (A2). The tap has the most branches.
3. Fighter body states: **5** (stand/kneel/down/getup/dead). Skill-layer busy flags: **~14**. Timers that block input: **10** (A3).
4. Skill tree: 5 schools × 12 = **60 cells**. 5 are letters (card odds only). **22 have an input rule** (`NODE_CMD`, skill_tree_data.js:202); 10 parry cells change the guard pose; ~23 change numbers only (A4).
5. Player settings: **2** (fps cap, attack joystick). Only the attack joystick changes input (A5).
6. AI opportunity reasons in `opportunity()`: **7** in duels, +3 that exist only in team fights. `startAttack` why-labels: **20**. AI modes: **5**. Mindset: 4 axes × 8 react states (B1).
7. Measured over 64 AI duels, 10,478 decisions: **`patience` wins 95.3%**. `weak` never wins (0). `open` wins 0.98% and **never fires**. Only 3 kinds (patience/finish/stepin) make 97.6% of fired decisions (B3).
8. `startAttack` (all paths): the top 5 why-labels (patience, follow, recover, counter, stepin) = **73.2%** of starts. 8 of 20 labels were never or almost never seen (B3/B4).

## A1. Gesture inventory (static)
| # | Gesture | Recognised | Thresholds that separate it |
|---|---|---|---|
| 1 | Move stick tilt = walk | input.js:231-248 | dead zone STICK_DEAD 0.15 (stick_turn.js); walk full at RUN.walkFull 0.85 (config.js:534) |
| 2 | Stick at full tilt, held = run | run.js:101-110 | RUN.stickIn 0.95 / stickOut 0.85; RUN.hold 2.0 s; holdTurn 1.05; arc 1.62 + arcOut 0.1; stamina startAt 50. PC: Shift + direction (input.js:198) |
| 3 | Stick push from standstill = burst step | gait (GAIT.burstStick config.js:354) | burstStick 0.6 |
| 4 | Stick direction class fwd/side/back (modifies a cut or tap) | unique_assist.js stickOk | UNIQUE_ASSIST.stepStick 0.3 (config.js:~1497) |
| 5 | Slow drag = sword hand position | input.js:112-131, main.js:3132 | anything below the swipe speed |
| 6 | Fast drag (swipe) = cut; stroke classed by start pad + direction | main.js:3074; attack_stroke.js:10-23 | SKILL.swingSpeed 1.5 m/s (config.js:1051); padRadius 0.15, angle 40° (config.js:1486-1487) |
| 7 | Tap = thrust | input.js:138 | touch tapMs 180 / tapPx 12; mouse clickMs 250 / clickPx 6 (config.js:2343+) |
| 8 | Still hold | input.js:154 | holdPx 24; rdHoldTime 0.6 s (config.js:~1675) |
| 9 | "Grip" (drag past holdPx) | main.js:3141; atk_stick.js:41 | holdPx 24; joystick: outside the dead zone |
| 10 | Guard button / F key (hold) | main.js:2200, 2225-2243, 3114 | hold; new press (I6) |
| 11 | Guard held + swipe/tap = guard released for that attack | main.js:3115-3116 | same swipe/tap cut-offs |
| - | Gun weapon: a tap counts on touch-down | input.js:100, main.js:3068 | none |
| - | Ring around a stick ignored as sword input | input.js:268-282 | stickGuardPx 15, stickGuardGrab 1 |
Timing windows that change what a gesture means: afterWindow 0.6, turnWindow 0.25, cavFrom 0.2 / cavTo 1.2, inqThreat 0.25, lianWindow 0.6 (config.js:1490-1593).

## A2. Context branching (gesture × context → action, static)
**Tap (~17)**, resolved in order (main.js:3069-3142, then skill.js:235-330): secret window open → secret (3082); sword sheathed → 0.6 s draw (3095); clinch lock → dropped; hilt distance ≤1 m → pommel (close_hold.js, 3102); Chinese block buffer (3105); guard held → guard released, then attack (3116); I2 blade-contact window → cavazione (skill.js:239); I9 sidestep under threat / C6 backing off → special tap (unique_assist.js:339+); gun → fire (skill.js:242); foe down + greatsword → cleave finish (249, 301); foe down → plunge finish (251); whip → flick (253); foe kneeling/getting up → vital thrust, range-walk first (265-282); Italian → lunge thrust (286); high pad → head thrust (287); else plain thrust; exhausted / auto-pickup / busy → nothing (main.js:3070, skill.js:240).
**Swipe (~12):** secret window → secret, unless I4 tapOnly (main.js:3077); hilt distance → pommel; Chinese buffer; guard release; school stroke techniques by pad + direction (G5, G8, I7, B3, J6, J7, J9, C3, C5; attack_stroke.js classifyStroke); chained cuts B5, B7; G7 auto on blade contact; else plain physical cut; also breaks a run (main.js:3154).
**Stick (~9):** walk; run; G1 back-burst; G2 dig-in; B2 side-dash; side/fwd/back as a cut/tap modifier; close shove when touching (fighter.closeStep); G10 shove 1.5 s → Mordschlag armed (config.js:1177); I4 mirroring the foe's steps → Risoluto armed. Feet blocked while stiff (main.js:3148).
**Guard button (~6):** school parry pose (10 parry cells); I6 opposition on a new press; C9 secret by timing; starts the gonosen draw; ignored during draw / auto-pickup (3114); label switches to "pickup" (3166-3176; pickup itself automatic since 11/18, pickup.js).
**Hold (~3):** B4 wind-up while held, strike on release (normal or armed secret) (main.js:3125-3128); J5 idle 2 s arms gonosen.
**Total ≈ 47 pairs.** Most branches: tap (17) > swipe (12) > stick (9).

## A3. State machines and blocking timers (static)
- **Fighter state** fighter.js:652, 1873: stand, kneel, down, getup, dead = **5**. Transitions ≈ 7: stand→kneel/down; kneel→getup/stand; down→getup; getup→stand; any→dead. The thrust gate accepts only stand or kneel (skill.js:240).
- **Skill-layer flags** (each one changes how input is read), ~14: tap, pom, flick, sec (run/stiff), vitalRange, lunge, recovering, swinging, uniq.winding, iai draw, run.on, barge press/hold, guard held/broken, cnBuffer hold
- **AI-side attack phases** (ai.js `phase`): ready, approach, guard, strike, follow, plus ibLink, rdWind, rdStrike = 8.
Timers that block or alter input (10):
| Timer | Key | Blocks |
|---|---|---|
| Secret stiff | SECRET.stiff 0.6 ×5 schools (config.js:1219) | sword and feet |
| Back-burst whiff stiff | BURST_WHIFF.stiff 1.2 (config.js:1159) | same 'stiff' path (skill.js:1027) |
| Clinch lock | CLOSE.holdMin 1.2 (config.js:311) | all attacks |
| Clinch cooldown | CLOSE.holdCool 2.0 (config.js:315) | the lock on a new shove |
| Gonosen draw | SECRET.gnsDraw 0.6 (config.js:1387) | attack and guard |
| Special cooldown | UNIQUE_ASSIST.specialCooldown 3.0 (config.js:1602) | the special → plain move |
| Secret uses per round | secretUses 1 (Chinese 1) (config.js:1609) | secret |
| Exhausted | stamina | hand, tap, feet (main.js:3064, 3148) |
| Auto-pickup | pickup.js | everything (main.js:3063) |
| Hit-stop | IMPACT_FX | hand input ×0.25 (main.js:3066) |
Also: attack-speed tempo queue (attack_tempo.js:24-41) delays a stroke but does not drop it.

## A4. Per-school (static; skill_tree_data.js:35-79, NODE_CMD :202-231)
| School | foot | parry | atk | deep | passive | secret | Cells with an input rule (NODE_CMD) |
|---|---|---|---|---|---|---|---|
| German | 2 | 2 | 3 | 2 | 1 | 1 (Mordschlag: shove 1.5 s) | 6: G1, G2, G5, G8, G7 auto, G10 |
| Italian | 2 | 2 | 3 | 1 | 2 | 1 (Risoluto: mirror steps; tap-only) | 5: I7, I2, I6, I9, I4 |
| Iberian | 2 | 2 | 3 | 2 | 1 | 1 (Altibaixo: wait 2 s, hold-release) | 5: B2, B3, B4, B5, B7 |
| Japanese | 1 | 3 | 3 | 2 | 1 | 1 (Gonosen: idle 2 s; sheath draw 0.6 s) | 4: J6, J7, J9, J5 |
| Chinese | 2 | 2 | 3 | 2 | 1 | 1 (Gyeoksal: forward + timed block; buffer) | 4: C3, C5, C6, C9 |
Each school also has 1 letter cell (card odds only).
**Rules that exist for only one school:**
- Italian: tap-only secret, cavazione tap window
- Iberian: hold-release
- Japanese: sheathed draw lock
- Chinese: block buffer
- German: auto-duplieren
Totals: 60 cells; 22 change input; 10 parry cells change the guard pose; ~23 change numbers only (foot/deep/passive minus G1, G2, B2).

## A5. Settings
`DEFAULTS = { skill:'0.7', fpsCap:true, atkStick:false }` (main.js:146). Only fpsCap and atkStick are stored (:151). Skill is fixed at 0.7.
Only **atkStick** changes input: the joystick becomes the source of gestures 5-9, and screen drag and tap stop being sword input (input.js:86, 296-396).
Not settings, but they change rules: mouse vs touch thresholds, gun mode.

## A6. JUDGEMENT (auditor's reading; nothing new proposed)
1. **SECRET.stiff, five identical numbers** (0.6 each, config.js:1219). The only per-school table in config where every value is equal.
   - Merge into one value.
   - Same: behaviour.
   - Could change: nothing, unless the owner later wants them to differ.
2. **The two 'stiff' sources already share one input path** (skill.js:1027): secret stiff 0.6 and back-burst whiff 1.2.
   - Same rule, different number. Could be one "stiffness" with a duration per cause.
   - Same: what is blocked.
3. **Hold and grip use the same cut-off** (holdPx 24): input.js:158, main.js:3095, 3141, atk_stick.js:41.
   - Grip = moved ≥ holdPx; still-hold = moved < holdPx. The tap cut-off tapPx 12 sits beside it.
   - Option: tap = still-hold that ends before tapMs, keeping a single distance.
   - Could change: taps that move 12-24 px would become taps (today they are drags).
4. **Four tap specials are "tap + context window" with different windows** (I2 cavFrom/To, I9 inqThreat, C6 lianWindow 0.6, J9/B7 afterWindow 0.6).
   - lianWindow equals afterWindow (0.6). One "tap within window after event X" rule with a per-event window.
   - Same: the inputs.
   - Could change: window lengths, only if unified.
5. **"Burst" and "direction class" stick cut-offs** (burstStick 0.6, stepStick 0.3), on top of walkFull 0.85 and stickIn 0.95: 4 radial bands on one stick.
   - Could be read as 3 bands (step / walk / run).
   - Could change: when a burst or a side modifier triggers.

## B1. AI category inventory (static)
- **opportunity() reasons** (ai.js:1646-1686): recover :1660, stepin :1665/1666, finish :1668, offbalance :1669, open :1671, weak :1673, patience :1675-1676 = **7**. Team-only (only when `me.foes && teamSense`, :1678): ambush, press (team_sense.js:325, 351), support (team_support.js) = 3.
- **Gates on top:** SLOW_WHY = patience, open, weak, offbalance, drill (ai.js:122). GL_BEAT_WHY = the same minus drill (:128).
- **startAttack why-labels**, 34 call sites (grep): beat, counter, dig, dive, drill, finish, follow, lure, recover, riposte, secret, shove, slant, stepin, stop, windup, press, patience, offbalance, plus the opp kinds passed through = **20** distinct.
- **AI modes:** watch, attack, defend, withdraw, secret = **5**. invite/back/stop are a plan sub-object, ai.js:552-580.
- **Mindset** (config.js:2223-2264): 4 axes (ai_mindset.js:35), 5 school score rows, 13 knobs, **8 react states** (disarmed, tired, bleed, leg, arm, secretReady, quiet, repeat).
- **Plan files (exported steps):** cn 14, de 19, free 10, ib 19, jp 24, shared 11 = **97 functions** (grep `^export`).
- **Temperament** (character_temperament.js:129+): ~13 axes per character.
- **Technique lists:** 12-16 techniques per AI school, depending on kit (B3).

## B2. Instrumentation (counters only)
- Counters added in the copy's `src/ai.js`: `cand.<k>` when an `add()` value is > 0 `win.<k>` at the end of `opportunity()` `fire.<k>` when score ≥ need and in range (watch) wrappers on `startAttack` (`sa.try` / `sa.ok` per why) and `pickTech` (name picked)
- Mode transitions counted in the runner.
- No Math.random calls added, nothing reordered.
- **Neutral:** `node tools/sim/fights12.mjs | sha256sum` = `ca80b048…ce31` in both main and the copy.
- Runner: `nice -n 10 node tools/sim/audit_ai.mjs out.json N S0 45 [chars]`. Tables from `node tools/sim/audit_tab.mjs out40.json out24b.json`. Technique lists from `tools/sim/audit_techlist.mjs`.
- Runs: 40 duels (seeds 1-40, D_fights characters) + 24 duels (seeds 101-124, characters minami, roland, silver_wanderer, bernardo, chanda, white_scale, julia, liao). The first set had no Japanese AI, so the second set was added. Weapons: the 10 representative ones only (no estoc, no sabre). 241,426 AI steps in total.

## B3. Usage (measured, 64 duels)
**opportunity winner, 10,478 decisions**
| kind | share |
|---|---|
| patience | 95.29% |
| finish | 1.80% |
| stepin | 0.99% |
| open | 0.98% |
| offbalance | 0.56% |
| recover | 0.36% |
| weak | **0** |
How often each kind was a candidate (value > 0), per decision: patience 102% (added twice when desperate), open 85%, weak 7.5%, stepin 3.4%, finish 2.0%, offbalance 1.9%, recover 0.9%.
**Fired decisions** (1,930 = 18% of decisions): patience 86.8%, finish 5.5%, stepin 5.2%, recover 1.8%, offbalance 0.6%, **open 0**, **weak 0**.
**startAttack starts, all paths** (1,304 started of 1,813 tries):
| why | share | why | share |
|---|---|---|---|
| patience | 16.3% | finish | 5.1% |
| follow | 16.3% | dive | 3.3% |
| recover | 15.3% | stop | 1.5% |
| counter | 15.0% | windup | 0.8% |
| stepin | 10.4% | offbalance | 0.5% |
| riposte | 8.5% | secret | 0.5% |
| press | 5.4% | lure | 0.5% |
| | | slant | 0.5% |
| | | dig | 0.3% |
- Top 5 = 73.2%; ~80% is reached with the top 6.
- Never seen: beat, drill, open, weak, plus the team kinds ambush/press/support.
**AI modes** (5,018 transitions): withdraw 32%, defend 25%, watch 22%, attack 20%, secret 0.04% (2).
**Techniques started**, by school: German 441, Italian 260, Chinese 263, Iberian 203, Japanese 137. Not started at all:
| School | Never started |
|---|---|
| Italian | oberhau, zwerch, zwerchL, wristCut |
| Iberian | zwerch, zwerchL, stichAlber, cingir, wristCut |
| Japanese | zwerch, zwerchL, stichPflugL, talhoReves, wristCut |
| Chinese | talhoReves, wristCut |
| German | none (all started; zornhau only in kits without schielhau) |
Most started: italian.stichPflug 108, iberian.talhoRodeado 92, german.oberhau 79.

## B4. Never-selected: unreachable or context?
- **weak:** reachable, but it rarely tops the others. Value (1-vigor)·0.5 ≤ 0.5. patience is (1-patience)·1.1 and is > 0 on almost every call; open is 0.15-0.3 whenever the foe's point is off-line. It wins only against a badly hurt foe while patience is still high. A candidate 7.5% of the time, never the winner. Its share of `score` still counts toward the threshold, so as a label it changes nothing, but its number does. ai.js:1673.
- **open:** wins 0.98%, but never reaches need. Max add 0.3 (ai.js:1671) against need ≈ 1 ± 0.3 (ai.js:1299). When open is top, the others are smaller still, so the total stays under need. Practically unreachable as a firing label, but it does feed `score`. It can also gate a feint (ai.js:1911); that path is never seen.
- **finish / offbalance / recover / stepin:** context-specific (foe down/disarmed; foe off balance; after the foe whiffs; foe walking in). They are rare in duels by nature.
- **ambush / press / support:** unreachable in 1v1 (ai.js:1678 needs `me.foes && teamSense`). Team modes were not measured.
- **beat:** only in the no-school plan (ai_plan_free.js:73). There were no 'none' AIs in the sample.
- **drill:** test mode only (whiff_drill, ai.js:1404).
- **cingir:** in non-SLOW whys it is replaced by its plain move (ai.js:1816). Only possible under patience/open/weak/offbalance, and was not seen in 203 Iberian starts.
- **zwerch, zwerchL, wristCut, talhoReves** (several schools): not proved unreachable. They are in the lists. With n ≈ 140-260 starts per school, call them "< 1/150, context unknown".

## Caveats
- A1-A6 are static reading. Pair and flag counts are rounded (~); thresholds are cited at their key.
- B3 is measured: AI vs AI, 1v1 only, 64 duels, 45 s cap, representative weapons. School mix depends on the character persona, not the weapon (Japanese only in the second set, n=137 starts). Team modes and human-vs-AI were not measured.
- **Found in passing (main, unmodified):** an AI with the no-school persona `renji` crashed in `startAttack` at ai.js:1915 with `byName[f.fake]` undefined (a feint names a technique that is not in that school). Reproduced with main's `src` (seed 112, kriegsmesser vs hwando, renji + silver_wanderer). The runs avoided renji, so the no-school AI is absent from B3.

