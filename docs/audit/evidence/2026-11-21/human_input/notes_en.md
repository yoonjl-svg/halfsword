# I — Do the never-fired multipliers fire under scripted human-style input? (main e13401a6, 2026-11-21)

Read-only count. No game logic changed. Work dir `scratchpad/I/` (copy of $M `src`, `tools`, `package.json`; `node_modules` symlinked).
Counting: earlier pass's `patch_combat.py`, `patch_fighter.py`, `_j.js` + two additions (below). Runner `I/batch.sh I` → `I/out/<tool>.txt|.err`; summary `node I/agg.mjs I/out` → `I/out/_agg.txt`.
"Wounds" = strike-path wounds (`hit.*` counter, which sits just before `applyWound` in `combat.strike`) + instant-path wounds (`inst.applied`, secret kinematic path).
`m.X` = multiplier X attached to a strike-path wound. `mi.X` = the same on an instant-path wound. Counts are per wound, for **either** attacker (player or AI) in that tool's fight.

## 1. Verdict table

AI-vs-AI = D_rules.md §2 (96 duels + 8 team fights). Human-style = the 13 human-input tools in §2 (excludes `secret_free`, which turned out to be AI-vs-AI).

| multiplier / rule | AI-vs-AI | human-style (sum) | where | verdict |
|---|---|---|---|---|
| secretHit 비기 맞음 (≠1) | 0 (strike path only counted) | **0** | — (AI-vs-AI control `secret_free`: mi.secretHit 2) | REACHABLE-NOT-EXERCISED by human tools. The condition is `att.secretHit≠1`, combat.js:313. Values: SECRET.hitMul 1.3 (config.js:1400) for german/japanese/iberian secrets, skill.js:906 servo path / secret_instant.js:361 instant path. The tools I ran use the secrets that are ×1: gyeoksal `gyeoksalHitMul 1` (config.js:1453), mordschlag `mordHitMul 1` (config.js:1456). Risoluto (0.5, config.js:1408) never opened a window in risoluto_tap. No tool scripts a human japanese/iberian secret, the ones that would carry 1.3. Also fires AI-vs-AI via instant wounds; the earlier 0 missed that path |
| fingerCut 손가락 베기 | 0 | **140** | finger_cut 22, kote_drop_duel 52, special_fight 31, whip_duel 30, cn_gk_human 5 | **FIRES**. Human-only by design: `skill.autoGuard===true` (finger_cut.js:33, set main.js:653), hit ×2 (config.js:1066) |
| finishPower 찍기 위력 | 0 | **120** | finish_thrust 76 (tap on a downed foe, longsword), greatsword_finish 44 (cleave, zweihander/flamberge) | **FIRES** on a scripted tap. Condition combat.js:381 needs `att.skill.tap.down` (a human tap). finish_probe (AI fight + tap bot, 6 fights): 0 |
| effMul 격살 배율 | 0 | **0** | gyeoksal_probe 2 instant wounds, cn_gk_human 3: none carry effMul | **UNREACHABLE (as ≠1)**. Setters: skill.js:907 `f.effMul = secretEffMul(D)` and skill.js:73 `gyeoksalReq`. secretEffMul (skill.js:62–65) is ≠1 only for `power:'finish'` or a number. Secret `power` values in schools.js are only `'power'` :709, `'japanesePower'` :743 and `'gyeoksal'` :888. For `'gyeoksal'`, gkHit is set (skill.js:905), so effMul is not set, and gyeoksalReq maps it to `'hit'` (skill.js:70). So effMul is always undefined or 1. Gyeoksal's other lever is secretHit = gyeoksalHitMul = 1 (config.js:1453) |
| rage 분노 무기 (woundRage) | 0 | **6** | italian_press (attacker = AI foe `terracotta`, weapon goujian, characters.js:871) | **FIRES**, but on the AI side of a human-scripted fight. Only goujian defines woundRage (weapons.js:1794), and it is not one of the ten weapons. No tool has a human holding goujian. `wound_rage_check.mjs` calls analyze directly and is not an input script, so I did not run it |
| duel 한손 결투 (duelOneHand) | 0 | **8** | risoluto_tap (player dartagnan vs tome = rapier, one-hand) | **FIRES**. Needs the dartagnan weapon (weapons.js:732) against a one-hand sword (combat.js:166–168). Dartagnan is not one of the ten weapons, so the AI-vs-AI set could never trigger it |
| flowShield 흘림 방패 | 0 | **1** | special_fight (japanese row) | **FIRES** (rare): `clash.nagashi` 2 → 1 wound kept ×0.3 (FLOW_REDESIGN.flowDmgCut 0.7, config.js:694; nagashi_redesign.js:91–95; set combat.js:856). AI-vs-AI control `secret_free` (prof 5): 2 |
| opposition 막아찌르기 반대 | 0 | **33** | italian_press 30, special_fight 3 | **FIRES**. Human only: `parryGuard.opposition` is made in parry_button.js:82 (PlayerParryGuard). combat.js:475 |
| bleedMult | 0 | **0** | — | **UNREACHABLE**. `grep -rn bleedMult src` → only combat.js:499 (the read). No weapon or spec defines it (old public/*/assets bundles still mention it; they are not src) |
| dice: buckle p 0.5 | 5 rolls / 2 hits | **7 rolls / 2 hits** | kote_drop_duel 2/2, special_fight 4/0, italian_press 1/0 | **FIRES** (combat.js:1058 roll; config.js:1520 p 0.5) |
| dice: koteDrop p 0.5 | 1 roll (prof5) | **4 rolls / 0 drops** (arm 3, sword 1) | kote_drop_duel arm 1 + sword 1, special_fight arm 2 | **FIRES** (rolls happen; no drop in 4). combat.js:1118, config.js:1736 |
| dice: whip kneel p 0.5 | 0 | **0** | whip_duel (druid_whip, 4 fights): 17 judgments/fight, but 0 wounding hits by the whip (tool table "상처 맞힘/판 0.0") | REACHABLE-NOT-EXERCISED. The roll is combat.js:1010→1022, after strike's early returns. It needs druid_whip (`kneelHit`, weapons.js:1973) and `flexWeapon.strokes > rolled` (druid_whip.js:61). WHIP_KNEEL.p 0.5 (config.js:93). The scripted whip contacts never got through to the roll |

## 2. Tool inventory and per-tool counts

Commands: everything is run as `J_COUNTS=1 nice -n 10 node jrun.mjs <tool> <args>` inside `I/` (see `I/batch.sh`). The env vars listed with a tool are set on that same command.

| tool | args | what it scripts (player input → opponent) | wounds strike+inst | multipliers attached (m.* / mi.*), dice |
|---|---|---|---|---|
| finger_cut.mjs | `drill --cells=german:longsword,japanese:uchigatana --seeds=1-3 --dur=14` | finger pad strokes → standing foe | 23+0 | fingerCut 22, stepMass 10, bladeWeight 4, schoolPassive 2 |
| finish_thrust.mjs | `1 longsword` | `skill.thrust()` tap at a downed foe, 4 guards × 5 dist × 4 dirs (80 cells; "즉사 5/80") | 197+0 | thrustAssist 122, **finishPower 76**, plate 68, stepMass 4, bladeWeight 2 |
| greatsword_finish.mjs | `zweihander,flamberge --n=1` | one tap at a down/getup/kneel foe (cleave) | 173+0 | **finishPower 44**, bladeWeight 43, stepMass 38, thrustAssist 1; decap 4 |
| finish_probe.mjs | `6 longsword 40` | AI-driven player plus a tap bot on downed foe → longsword AI | 120+0 | stepMass 42, bladeWeight 36, helmet 7 (finishPower 0) |
| gyeoksal_probe.mjs | `qinggang,hwando - 1,2 45` | parry button + gyeoksal secret window (PlayerSecretWatch) → longsword AI | 44+2 | stepMass 14+2, bladeWeight 21+1, helmet 3 |
| cn_gk_measure.mjs | `human --seeds=1-2` | human bot, chinese hwando, gyeoksal → longsword AI. Crashed after variant `cur` (TypeError 'A', line 146); counts cover `cur` only | 52+3 | fingerCut 5, stepMass 21+3, bladeWeight 21+1, thrustAssist 1 |
| risoluto_tap.mjs | `rapier,dartagnan isolde,tome 1 30` | human taps in the risoluto window (main.js frame order) | 96+0 | **duel 8**, itThrust 20, stepMass 20, bladeWeight 28, gap 4, helmet 4, thrustAssist 4. Risoluto windows opened: 0 |
| mordschlag_duel.mjs | `longsword "" 2` | walk-in + shove press + mordschlag window → foes | 32+13 | itThrust 3, emoDealt 2, emoPass 2+3, gap 2, rock 1+1, thrustAssist 2 (secretHit 0: mordHitMul 1) |
| kote_drop_duel.mjs | env `SEEDS=901,902 OPPS=longsword,rapier DUR=30` | finger bot, uchigatana, kote strokes + parry → AI | 114+0 | fingerCut 52, gap 18, itThrust 26, schoolPassive 12, thrustAssist 14; **buckle 2/2, kote arm 1 + sword 1, 0 drops** |
| whip_duel.mjs | `--weapons=druid_whip --opps=longsword,isolde --seeds=1-2 --dur=40` | finger bot with whip → character AI | 78+0 | fingerCut 30, emoDealt 4, helmet 3; **whip roll 0** |
| special_balance.mjs | `fight --rows=japanese,kote,german,italian --opps=longsword,uchigatana --fseeds=901 --delays=0.22 --variants=on` | finger bot (special strokes, taps, parry button, full skill tree) → AI prof 3 | 122+1 | fingerCut 31, **flowShield 1**, **opposition 3**, schoolPassive 22, gap 16, itThrust 20; buckle 4/0, kote arm 2/0; nagashi 2 |
| italian_press_fight.mjs | env `VARIANTS=p50 SEEDS=1-2 DUR=20` | rapier player holding the parry button, presses on a read attack → journey characters | 194+3 | **opposition 30**, parryKeep 19+2, **rage 6 (AI goujian)**, emoDealt/Pass/Taken 36/38/4, ibFlow 7, cnStep 4, itThrust 49; buckle 1/0 |
| live_battery.mjs | `cuts,hits,kata` | scripted live strokes (acceptance battery) | 13+0 | stepMass 3, bladeWeight 9 |
| **control, not human:** secret_free_measure.mjs | `--pairs=japanese:german,italian:iberian,german:chinese --vars=new --seeds=1` | AI vs AI at proficiency 5 (`AI2Class: AI`, line 59) | 228+10 | **secretHit 2 (instant)**, **flowShield 2**, secretBlade 1 (instant), rock 14, aiParryKeep 5, ibFlow 4 |
| not run: unique_study_player.mjs | `SCHOOL=german SEEDS=1,2` | finger bot with taps | — | ERR_MODULE_NOT_FOUND `chinese_benefit_model.mjs` (missing in $M too) |

Human-style totals (13 tools): 1258 strike-path wounds + 22 instant-path wounds. `I/out/_agg.txt` TOTAL also includes secret_free.

## 3. Other multipliers that fired AI-vs-AI but show 0 in every human-style tool

- **ibFlow and cnStep**: not zero; italian_press fired them on the AI side.
- **aiParryKeep**: 0 in all 13 human tools (5 only in the AI control).
- **yaojiBleed**: 0 everywhere. No tool scripts monohoshizao yaoji.
- **secretBlade**: 0 in human tools (1 in the AI control, instant path).
- **rock**: fired only in mordschlag (1+1).
- **emoTaken**: 4 (italian_press only).
- **plate**: fired only in finish_thrust (its plate rows).

These zeros most likely mean the tools do not cover the case (wrong weapon, school or opponent). They are not evidence that the mechanic is dead.

## 4. Behaviour-neutral check

`node tools/sim/fights12.mjs | sha256sum`:
- $M: `ca80b048…ce31`.
- `I/` (counting off): `ca80b048…ce31`.
- `I/` with `J_COUNTS=1 node jrun.mjs tools/sim/fights12.mjs`, @@JC lines stripped: `ca80b048…ce31`.

## 5. Changes to the instrumentation (counters only)

1. `fighter.js` decapitate now declares a local `const J` (head joint) before the counter call, so the earlier patch's `J('decap')` crashed (TypeError). In `I/` I replaced it with `globalThis.__JCf?.('decap')`. **The earlier patch no longer applies cleanly to main e13401a6.**
2. The earlier patch counts only `combat.strike`. Secret kinematic hits go through `secret_instant.js instantWound → combat.analyze → applyWound` and were not counted at all. `I/patch_instant.py` adds `inst.applied` + `mi.<name>` just before both `applyWound` calls there. This is why AI-vs-AI secretHit read 0 before. With this counter, secretHit fires in AI-vs-AI at proficiency 5 (secret_free 2).
3. `I/jrun.mjs`: imports a tool and prints the counters in a process 'exit' hook.
4. Patch caveat: `m.effMul` is pushed whenever `att.effMul` is truthy, including 1. It still read 0, so the servo branch that sets effMul=1 (skill.js:907) never coincided with a wound either.

## 6. Caveats

- "Human-style" means deterministic bots: pad strokes, taps, parry presses and secret windows driven through the game's input functions (skill.thrust, PlayerParryGuard, PlayerSecretWatch, finger pad).
  - There is no real finger noise beyond each tool's own jitter, and no adaptive play.
  - Opponents are fixed (longsword AI, character AIs, standing or downed bodies).
  - Counts depend on what each tool chose to script. They are not rates per real match.
- Several tools are drills (standing or downed foe, 80-cell grids). Their counts show reachability, not how often it happens in play.
- Counters do not tell player from AI attacker. rage 6 is the AI's goujian. duel 8 is the player's dartagnan (the foes hold longsword/rapier). opposition, fingerCut and finishPower can only come from the human side (see the conditions in §1).
- Weapon rule: the ten representative weapons were used wherever a multiplier allowed. Three exceptions are forced, because each is the only weapon carrying its ability: dartagnan (duel), druid_whip (whip kneel), and goujian (rage; it appeared only as an AI foe). No estoc and no sabre.
- Not run: unique_study_player (missing module). cn_gk_measure human ran only its `cur` variant before crashing.
- No human-input tool for japanese/iberian secrets was found or run; that is the gap for secretHit 1.3.
