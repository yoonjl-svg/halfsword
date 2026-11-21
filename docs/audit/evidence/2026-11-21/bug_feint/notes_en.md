# Feint defect (ai.js:1911) in the real browser game: reachability and effect

N = scratchpad/N, $M = scratchpad/wt_main (main, untouched). All commands run from N with `../wt_main` as the checkout.

## Verdict
1. **The real game does not reach the throw today.** The real game builds an affected art only for `bran` and `bran_mad`. Both have `persona.level.feint = 0` (characters.js:62; in the page `game.ai.level.feint = 0`), so `Math.random() < 0` is never true and the filter at ai.js:1911 never runs.
2. feint_check.mjs's 220 combinations overstate the exposure. main.js:619 (1:1) and main.js:715 (team/saengsa) set `persona.school = <weapon id>` whenever a character holds a weapon other than its own, unless the character has `noSwordsmanship`. With the game's own persona rule, only bran/bran_mad × 19 swords stay affected (38/1258). renji, renji_mad, the 6 thrust-less weapons and nameless fighters are all clean.
3. Where the latent combination shows up: journey `clearing_night` (bran_mad × falchion, every fight), `clearing` (bran, falchion 10%), wander 2.97% of encounters, saengsa (below), and the `?team=` / test=1 / `?foeWeapon=` routes.
4. Saengsa, 2,000 tournaments, latent combination in the player's own engine fights: 1.64% of foe-AI appearances, 4.37% of the player's matches, 6.85% of tournaments (73.75% if you count AI-vs-AI matches anywhere in the bracket, but those are quick-resolved and never run the AI).
5. Effect when the branch is forced (not player-reachable: `level.feint` overwritten in the page): exactly one TypeError, then the game loop keeps running. The foe AI is stuck in `mode 'attack' / phase 'ready'`: its sword hand is frozen, it never attacks or defends again, and its body drifts away (stuck for 23 s of sim until the run ended).
6. Risk: a latent soft-lock. It goes live if anyone gives bran/bran_mad a feint value above 0 (a temperament tweak, a level scale, or the `mad` scaling if `appearanceOnly` is dropped), or adds another `noSwordsmanship` character with feints.

## PART 1: exposure (Node, game modules only)
**Combinations under the real persona rule**: `node real_persona_check.mjs ../wt_main`
- 1v1 rule (main.js:618-619): 1258 combinations, **38 affected**: bran 19, bran_mad 19. The weapons are zweihander, estoc, sabre, rapier, falchion, monohoshizao, qinggang, ganjiang, moye, sain, flamberge, goujian, dartagnan, hwando, balisarda, tizona, durandal, pappenheimer, chixiao. Own-weapon case: bran_mad (falchion). bran's weaponAlt (10%) picks falchion, which is affected.
- Why the result differs from feint_check.mjs: that script feeds `ch.ai.persona` unchanged (school = the character's own pack). The game swaps the pack to the held weapon's pack except for `noSwordsmanship` (bran; bran_mad inherits it via characters.js:701).
- **Feint gate**: `node feint_rate.mjs ../wt_main` → bran and bran_mad `persona.level.feint 0`, and `AI_LEVELS.easy.feint 0`. setLevel (ai.js:652) spreads `persona.level` over the base. The only other read of `school.feints` (ai.js:4223) is null-guarded.

**Saengsa tournaments**: `node saengsa_exposure.mjs ../wt_main 2000` (output in exposure_2000.txt)
- Method: `createTournament` with the game's `SAENGSA_DATA` (roster 37, including bran, bran_mad and renji; drawPool; aiArm; weapon boxes; signatures), then `advance`, `myMatch`, `matchSetup` (foe entrants from aiPick) and `finishMine`. After each match, aiArm re-arms the foes and boxes are opened (giveItems). The persona is a replica of main.js `teamAiOf` (707-721, minus bodyProficiency, which feints do not read). The affected test is `resolveSwordArt(weapon, persona, {proficiency: persona.proficiency ?? ofLevel[level], aiKit:true})` (ai.js:230-232), looking for any feint whose `fake` is missing from `techByName`.
- Approximations: `cfg.testMode=true` (no clock; the rules are otherwise the same). Companions are 2 random entries from HIRE_ROSTER. The player team holds longsword / kriegsmesser / rapier with prof 3. The player's matches are settled by `quickResolve` instead of a real engine fight, so how far the player's path goes is approximate.
- Foe members holding an affected combination at sign-up: 1589/90000 = 1.77%.
- **Player's matches (engine fights)**: foe-AI appearances 139/8499 = **1.64%**; matches with ≥1 affected foe 138/3157 = **4.37%**; tournaments with such a match 137/2000 = **6.85%**.
- AI-vs-AI matches (quick-resolved, no AI runs): appearances 2130/139084 = 1.53%; matches 2118/26720 = 7.93%. Tournaments with an affected fighter anywhere: 1475/2000 = **73.75%**.
- Top pairs in the player's matches: bran×tizona 20, bran×chixiao 20, bran×goujian 17, bran×qinggang 14, bran×monohoshizao 14, bran×dartagnan 12, bran×durandal 9, bran×balisarda 9, bran×sain 5, bran×flamberge 5. Every affected pair is bran. bran_mad (german 1) is always given a non-affected german weapon.
- All of these are latent: L.feint = 0 for bran, so the count of real throws is 0.
- Not counted: a bran/bran_mad *companion* is an AI teammate in the engine fight, and is affected if the player assigns one of the 19 swords. That depends on the player's choice; still latent (feint 0).

**Other places an AI can hold a weapon that is not its own** (all still feint 0)
- 1:1 journey/stage: main.js:411 `pickCharacterWeapon` (characters.js:1040). `node journey_wander_share.mjs ../wt_main` → 30 stages; affected foe at clearing:bran p=0.1 and clearing_night:bran_mad p=1 (stages.js:125).
- Wander: main.js:1980-1982 (uniform stage × uniform foe, pickCharacterWeapon) → **2.97%** of encounters (bran 0.1, bran_mad 1).
- `?foeWeapon=` / `?weapon=` (main.js:100,411): any character × any weapon, but only bran/bran_mad × 19 swords are affected.
- test.html → `?test=1`: test_route.js:54 foeWeapon = pickCharacterWeapon (same as journey); foe=random via test_route.js:48.
- `?team=2v2|2v1|1v2|3v3|watch`: main.js:1041-1066 teamTestSpec uses pickCharacterWeapon for mates and foes, with persona from teamAiOf. bran 10% / bran_mad 100% affected when drawn.
- Saengsa: saengsa_rules.js:108-109 makePool + aiArm (sign-up), :390 box then aiArm, :577 aiArm after each win. The player's team gets the player's assignment (assignWeapons :254).
- Weapon pickup: pickup.js:233 `aiPickup` only walks back to the AI's own dropped sword, so the AI never gains a new weapon this way. No shop or owned-weapon path for foes.

## PART 2: browser (vite 5194, headless Chromium, swiftshader, 844x390 touch, canvas shrunk to 8x4)
Script: `node feint_browser.mjs http://127.0.0.1:5194 "<query>" <secs> <out.json> [ai|still] [forceFeint]`. driver `ai` means a second AI drives the player, as in P_measure.mjs; the foe AI's errors propagate untouched.
- Route: `stage=clearing_night&weapon=longsword&foeWeapon=falchion&emo=0`, then the journey-start button. `weapon=` is needed to skip the card draw (without it the fight never started within 180 s), but `weapon=` also sets the foe's weapon (main.js:411), so `foeWeapon=falchion` restores the sheet weapon the plain journey gives bran_mad. The combination is the player-reachable one.
- In the page: foe "광기의 브론 오소리", weapon falchion, school `tree_branch`, tradition none, `level.feint 0`, anger 0.7, feints 4, missing `찌르기→베기>stichPflug`.

| run | query / driver / force | sim s (wall s) | page errors | stall frames | foe attacks | end |
|---|---|---|---|---|---|---|
| A natural | clearing_night falchion, ai, 0 | 35.6 (90) | 0 | 0 | 9 (feints 0) | player died |
| C natural | clearing tree_branch, ai, 0 | 24.5 (90) | 0 | 0 | 5 | foe died |
| A forced | clearing_night falchion, ai, 1 | 13.0 (75) | 1 | 1 | 1 | foe died at sim 12.1 |
| C forced | clearing tree_branch, ai, 1 | 22.7 (75) | 0 | 0 | 5 (feints 0) | foe died |
| A forced still | clearing_night falchion, still, 1 | 36.4 (75) | 1 | 1 | 3 | foe alive, stuck |

(The out.json files hold the full data: run_affected*.json, run_control*.json.)
- Error text (A forced, 33.0 s wall, sim 10.1): `TypeError: Cannot read properties of undefined (reading 'from') at src/ai.js:1911:85 at Array.filter`. At the throw the AI was in `mode attack`, `phase ready`, why `patience`. The A forced still run threw at sim 13.15 with the same text. Console errors: 0 in every run.
- Loop: `requestAnimationFrame(frame)` is the first line of `frame()` (main.js:3179), so the loop survives. The throw comes from `ai.update` (main.js:3221) inside the step loop. In that one frame, player/enemy step, `world.step`, `simTime`/`acc` accounting, mesh sync, HUD, `checkRoundEnd` and `renderer.render` are all skipped. Measured: 1 frame with no simTime advance (stallFrames 1), and frames kept coming (827 and 734 in total). `acc` is not consumed, so the next frame catches up (capped at maxStepsPerFrame).
- State after the error: `startAttack` had already set `mode='attack'`, `tech`, `attacks++` and `feint=null` before the throw (ai.js:1880-1906), but never set `phase`. `attack()` has no branch for phase `ready` (ai.js:1986-2076), so there is no abort timer either. The AI never calls startAttack again, so there is **no retry: exactly 1 error per fight** and 0/min afterwards.
- A forced still: after the error, 48 one-second samples show only `attack/ready`, one hand pose [0,0.03], attacks frozen at 3, and the pelvis moving from x -0.59 to 4.40 over 23.3 s of sim. The foe never attacks or parries again; the fight cannot end unless the player attacks.
- A forced ai: the same freeze (hand [0.18,-0.28], no new attack), and the driven player killed it 2 s of sim later.
- What a player would see: the foe raises nothing, holds one sword pose, backs off and stays passive (an easy kill, or a stall if the player waits). There was no visible hitch at 8x4 software GL.
- Control (bran × own tree_branch, forced feint 1): 0 errors, 0 stalls, 5 attacks. The tree_branch pack has 3 feints, all present, and none fired in 22.7 s (feints only roll on patience/open/weak, ×(1−anger 0.7)).

## Caveats
- Headless swiftshader runs sim at about 0.3-0.5× wall speed, so the counts are per sim second, not timings. Each case is one run (n=1). The second-AI driver follows P_measure.mjs.
- **Forced runs are not player-reachable**: `game.ai.level.feint` was overwritten from page.evaluate. Natural runs show 0 errors because feint = 0.
- The saengsa player path uses quickResolve instead of real fights, and companions/assignment are approximated (see PART 1). The share measures the *latent* combination, not throws.
- Nothing under $M was edited. The vite server and browser were stopped.
