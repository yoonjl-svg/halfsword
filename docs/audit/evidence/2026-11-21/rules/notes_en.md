# D — 판정·셈 규칙 갈래 감사 (main e13401a6, 2026-11-21)

Read-only. Game files untouched. Every experiment ran in a copy: `scratchpad/jd` (src+tools copied, node_modules symlinked).
Evidence files sit next to this report in `scratchpad/`: `D_static_ids.txt`, `D_family_lines.txt`, `D_cfg_sizes.txt`, `D_deadkeys.txt`, `jd/out/*.txt`, patch scripts `patch_combat.py`, `patch_fighter.py`, and `jd/src/_j.js`.

## 0. Method
- **Counters and ablation switches** are env-guarded (`J_COUNTS=1`, `J_ABL=a,b`). They live only in `jd/src/{_j.js,combat.js,fighter.js,secret_instant.js}`. With the counters on, outcomes were byte-identical to the uninstrumented copy on the seeds I compared.
- **Duel set** `jd/tools/sim/D_fights.mjs`: 48 hybrid AI-vs-AI duels, 45 s each, ending 2 s after the first death.
  - Weapons: the ten representative weapons only (never estoc or sabre). Player weapon `W[i%10]`, enemy weapon `W[(3i+5)%10]`.
  - Enemy slot: a character sheet (persona, level, look, revive), cycling through margarethe (plate + horned helmet), isolde (revive), heinrich (plate), liao, artoria (plate), omari, tome, eira.
  - Player slot: every third fight it also wears a character look, so both sides can be plated.
  - Proficiency: by default it follows the character level (easy 1 / normal 2 / hard 3). `PROF=5` gives both sides proficiency 5, so secrets are on.
- **Null band**: the base run plus three runs with `BODY.uprightStiffness × (1+k·1e-6)`, k = 1, 2, 3:

| | deaths /48 | player wins | downs | revives | neck deaths | bleed deaths | mean t_dead (s) |
|---|---|---|---|---|---|---|---|
| null band (4 runs) | **36–42** | **16–23** | **41–47** | 3–5 | 6–13 | 22–30 | 19.5–24.3 |

- **Team fights** `jd/tools/sim/D_team.mjs`: 2v2, 8 fights, mixed representative weapons, counters on. Results are in `jd/out/team_base.txt` if that run finished.

## 1. Family map (static; core-file special cases)

Special-case keys inside the core files. These were counted from grep lines (`D_static_ids.txt`, `D_family_lines.txt`):

| core file | lines | tradition-id branches | tech-id branches | weapon-id / weapon-ability branches | school/kit-specific identifiers |
|---|---|---|---|---|---|
| fighter.js | 5061 | 8 (iberian 5, italian 1, chinese 1, wristK 1) | 0 | `spec.id==='longsword'` 1 (twistScale) | ib* 83 lines (updateIbFlow…ibChainCostK, ~140 lines at 2311–2451); kitOff 4; schoolPassive 13 |
| combat.js | 1277 | 1 (iberian parry) | kote 3, imbroccata 3, yaoji 2, schielhau 2, gyeoksal (effMul) | woundRage, duelOneHand, secretBlade, bleedMult, ignoreArmor, ignoreArmorDamage, spike, kneelHit, flexible | ib* 14; schoolPassive 8; secret 12; instant 13 |
| skill.js | 1832 | italian 1 | gyeoksal 3, riso 2 | — | secret 109 lines |
| gait.js | 2189 | german 4 (chase/burst) | — | — | kitOff 5 |
| match.js | 193 | 0 | 0 | 0 | 0 (clean) |
| ai.js | 4924 | 37 | many (tech tables) | 1 | secret 368 lines; proficiency 72; emotion 85 |

| family | categories / tiers / states / options | tunables | special cases | main lines |
|---|---|---|---|---|
| Hit class + wound | 3 types (cut/stab/blunt, plus spike→stab); 7 zones; severity = (eff−thr)/90 or /60. Lethal: neck>0.5, head cut>0.8, stab>0.5. Bleed: stab ×1.6. Head blunt KD at 45/90 J. 2 deaths by vitals (bleed, consciousness) | STRIKE 18 keys, ANATOMY 8, VITALS 7 | **~29 factors multiply judgment energy or severity in `analyze` (combat.js:280–522)**; **18 of them are keyed by school, weapon or technique** (list in §3-A) | combat.js 280–522, fighter.js 1975–2055 |
| Armour | cloth guard; helmet (kettle + types, integrity, `fullUntil`); plate (guardMin, blunt, limb ×) | ARMOR 6 keys / 58 lines | ignoreArmor (lightsaber), ignoreArmorDamage (morgenstern), gap/imbroccataGap | fighter.js 2239–2565 (~330) |
| Sever / decap | limbSever on/count/off, severity ≥1.0, radius 0.11; decapitate = cut + pass + passing; terracotta body (`deathRequiresHeadDetachment`) | COMBAT 4 | 1 character physiology | fighter.js 2056–2240 |
| States | stand / down / getup / kneel / dead (+ revival overlay) | BODY, BALANCE 5 | KD causes: tilt, balance, footing, legs, headBlunt, **dice: buckle, whip-kneel**; lockouts: secret stiff, burst-whiff stiff, skill stiff, daze, buckleKneel, kote drop | fighter.js 1821–1908 |
| Clash / bind / parry | bladeClash → clashGroup → nagashi / ibParryBeat / koteSword / bindFeel; parry button + per-school parry kits; GUARD_LINE | BIND 7, NAGASHI 2, FLOW_REDESIGN 15, IB_PARRY_BEAT 1, GUARD_LINE 3 | iberian beat, japanese nagashi, kote | combat.js 658–968; parry_button 254; nagashi_* 142 |
| Finishers (찍기 / cleave) | tap-finish + cleave; power ×2.5 / ×2 on judgment energy | FINISH | — | finish.js 370 + finish_entry 48 |
| Stamina | attack/contact/secret spend, tired/severe | STAMINA 42 keys (2 read only by tools) | — | stamina.js 492 |
| Emotion | 3 emotions × {dealt, taken, pass, move, tremor} | EMO_ABILITY | — | emotions.js 146 |
| Schools | 5 traditions + none; per school: 4–6 unique, 1–3 passives, 1 secret, 12 techs, 2–4 feints, 5–11 guards; skill tree 60 nodes / 7 categories; school modules (italian_outbox 158, cn_step 97, cn_hunt 74, jp_tank 16, ib_block_regen 51, de_dirty 85, school_passive 485) | SCHOOL_PASSIVE, JP_TANK 9, IT_OUTBOX 4, IB_FLOW 5, IB_LINK 7, CN_STEP 7, DE_* | everything here is per-school by definition | schools.js 1459; ai_plan_* ≈1846 |
| Sword-art layers | resolveSwordArt + frames + guards | — | — | sword_art 339, frames 374, guards 456 |
| Proficiency | 7 levels (0–6), schoolK 0.7…1.6, secretAt 5 | AI_PROFICIENCY 7 | — | ai.js (72 refs) |
| Secrets (비기) | 5 secrets plus risoluto / gyeoksal variants; **secret_instant = declared exception to the physics rule** (teleport, fixed energy `SECRET.instantJ`) | SECRET 132 keys / 294 lines (**7 unread**) | all per-school | secret.js 1202, secret_instant.js 3429 |
| Unique assist | per-technique boosts: buckle, kote drop, yaoji bleed, imbroccata gap… | UNIQUE_ASSIST 58 keys / 275 lines (**3 unread**) | all per-technique | unique_assist.js 1738 |
| Iai | obi / draw | SECRET.iaiObi… | japanese | iai_obi.js 1498 |
| Weapon abilities | woundRage (1 weapon), duelOneHand (1), secretBlade (1), ignoreArmor (1), ignoreArmorDamage (1), kneelHit (1), spike (2), **bleedMult (0 weapons)** | — | 1 weapon each | combat.js analyze |
| AI | 4 modes + secret; 13 decision reasons (`why`) observed; per-school plans de/jp/cn/ib/free | AI_PLAN* ≈159 lines | 37 tradition branches in ai.js | ai.js + ai_plan_* |

Size notes: config.js has 79 export groups. The largest are SECRET 294 lines, UNIQUE_ASSIST 275, GAIT 213 and SAENGSA 153. Of 556 top-level keys in the 46 combat-related groups, 12 are not read by src. Ten of those are dead (SECRET ×7, UA ×3) and 2 are read only by tools.

## 2. What fires (counts)

Base run: 48 duels, levelled proficiency. Counts are per applied hit.
- **Hits**:
  - 1005 strikes judged: blunt 356, cut+ 261, stab+ 46.
  - Zones: arm 225, chest 124, leg 91, pelvis 60, abdomen 55, head 55, neck 53.
  - Wound severity bands:

    | | <0.1 | <0.5 | <1 | ≥1 |
    |---|---|---|---|---|
    | cut | 45 | 97 | 49 | 61 |
    | stab | 11 | 25 | 7 | 5 |

- **Multipliers that fired**: stepMass 229, emoPass 190, emoDealt 188, bladeWeight 146, plate 74, itThrust 56, thrustAssist 44, gap 43, schoolPassive 38, cnStep 26, helmet 17, emoTaken 14, ibFlow 5, yaojiBleed 4, aiParryKeep 3.
- **Multipliers that never fired (0)**: secretHit, fingerCut, finishPower, effMul, rage, duel, parryKeep (player only), flowShield, rock, opposition, secretBlade, bleedMult.
- **Deaths**: bleed 22, neck 13 (all 13 are decapitations), head 3, consciousness 1.
  - Revives: 4 (isolde).
  - Severs: 14. All are forearm, upper arm or shin.
  - Sword drops: 3. Helmet knocked off: 0. Armour broken: 0.
- **Knockdowns**: balance 24, tilt 5, headBlunt 5, footing 3, legs 1. All but one were light (kneel). Heavy falls are rare.
- **Dice rules**:

  | rule | rolls | outcomes |
  |---|---|---|
  | buckle | 5 | 2 kneels |
  | kote | 0 | — |
  | whip | 0 | no whip in the set |

- **Clash**: 603 fresh blade contacts, nagashi 1, ibTraded 0.
- **AI**: 729 attacks. Reasons: patience 170, recover 153, stepin 85, counter 73, riposte 70, press 69, finish 41, dive 24, offbalance 13, stop 9, windup 9, dig 8, slant 5.
- **PROF=5 run** (`jd/out/prof5.txt`):
  - 17 secret entries (chinese 9, japanese 4, italian 2, german 1, iberian 1).
  - Now firing: rock 13, ibFlow 24, schoolPassive 73, aiParryKeep 9, kote roll 1, ibTraded 3, helmetOff 2, armour broken 4.
  - Still zero through the strike path: secretHit, effMul, finishPower, flowShield, opposition, secretBlade, rage, duel. Secret blades land through `secret_instant.instantWound`, which I counted only after this run.
  - Outcome stayed inside the null band: deaths 38, wins 23, downs 44.
- **AI finish attempts**: 41–45 per 48 fights, but **0 finishPower wounds** in either run (96 fights in total).

- **Team 2v2** (8 fights, `jd/out/team_base.txt`):
  - 19 dead, 14 downs.
  - Deaths: bleed 13, head 4, neck 2 (2 decapitations). 10 severs.
  - Multipliers: stepMass 84, bladeWeight 47, cnStep 10, itThrust 9, thrustAssist 8, gap 8.
  - Through the instant (secret-kinematic) path: 5 instant cut wounds, **all with secretBlade** (monohoshizao tsubame). So secretBlade is live in team play even though it was 0 in the strike path.
  - No plate (all fighters wear `LOOKS.enemy`), no dice rolls.

## 3. Ablations (one at a time, 48 duels; compare with null band deaths 36–42, wins 16–23, downs 41–47)

| ablated | deaths | wins | downs | verdict |
|---|---|---|---|---|
| **stepMass** (walking body mass added to cut, combat.js:355) | **29** | 15 | 46 | **load-bearing**: deaths 7 below the band, neck deaths 5 (band 6–13) |
| emo (all emotion dealt / taken / pass) | 37 | 20 | **37** | borderline: deaths in band, downs 4 below |
| headBluntKD (head blunt ≥45 J knock-down) | 40 | 19 | 40 | in band (downs −1 at the edge; it removes about 5 KDs by construction) |
| bladeWeight (hilt-side cut weaker) | 39 | 22 | 44 | in band: immaterial here |
| thrustAssist (arm mass behind a tap/AI thrust) | 36 | 17 | 47 | in band |
| bundle: cnStep + schoolPassive + itThrust + parryKeep + ibFlow + yaojiBleed + buckle | 42 | 19 | 45 | in band: all seven together immaterial in AI-vs-AI at levelled proficiency |
| COMBAT.limbSever=off | 37 | 17 | 48 | in band (downs +1) |

"In band" means no effect was detected at this sample size. It does not prove zero. Every rule above is a player-facing mechanic, and the human player was not simulated.

## 4. Simplification candidates (ranked by removed ÷ risk)

1. **Dead config keys, plus one dead factor.**
   - Remove 7 SECRET keys (`iberianLat japaneseDist iberianPower iberianLoopHand iberianStrength iberianBack chineseLoopHand`, config.js 1227–1244).
   - Remove 3 UNIQUE_ASSIST keys (`secretStage idleRelease oppositeDeg`).
   - Remove `att.weapon?.bleedMult` (combat.js:499; no weapon defines it).
   - Behaviour-identical. Not owner-decided (`secretStage` carries an owner note from 10/13, but `AI_PROFICIENCY.secretAt` is the live copy, so mention it to the owner). Risk ≈ 0.
2. **Duplicate post-wound pipeline.** `secret_instant.instantWound` (secret_instant.js:304–396) re-implements `combat.strike`'s after-wound steps twice: applyWound, schoolPassive.onHit, itOnStrike, huntWound, hooks.
   - Proposal: one `combat.land(att, vic, r, part)` used by strike and by both instant branches. That cuts about 25 lines and removes one place where the two can drift.
   - The two are not identical today: strike also does stamina, ibTrade, ibBlockHit, buckle and kote. Making the instant path call land would change behaviour where those apply, so merge only the shared part to stay behaviour-identical. Not an owner decision (plumbing). Not measured.
3. **"Damage-taken" family → one rule.** Five ways a defender takes less severity are stacked in `analyze`:
   - parryKeep / cnParryDmgCut 0.5 (:457)
   - aiParryKeep (:458)
   - cnStepKeep (:459)
   - flowShield 0.7 (:469)
   - JP rock (:472)

   Plus two zero-valued keys: `jpParryDmgCut 0` and `ibParryDmgCut 0` (config.js:1125–1126, dead after the owner's 11/15 decision). The physical quantity they all stand for is **blade-to-blade energy absorbed before the cut lands**.
   - Removing the two zero keys and their branch: behaviour-identical.
   - Merging the other five into one `taken(vic, att)` call with one per-school table: behaviour-identical refactor, about 5 call sites → 1.
   - Replacing the table with physics: **owner decides** (every value has an owner date).
   - Measured: inside the bundle ablation, no detectable AI-vs-AI effect.
4. **"Damage-dealt" judgment multipliers → one field.** These ride on judgment energy only, with physics unchanged:
   - secretHit, fingerCut, itThrust, finishPower, effMul (gyeoksal)
   - woundRage, duelOneHand, opposition, schoolPassive dealt, secretBlade, ibFlow

   That is 11 sites, each with its own blunt/severity two-way `if`. One `att.judgeK(r)` returning a product would remove about 30 lines and 10 duplicated `if (type==='blunt') energy*=k; else severity*=k` lines. That part is behaviour-identical.
   - Turning them into physics (speed or mass) is the Kengo-style "one physical rule", but it is **owner decides** (each was ordered by the owner, e.g. 10/21, 10/25, 10/28, 11/14).
   - Measured: 5 of the 11 (secretHit, fingerCut, finishPower, effMul, rage/duel) never fired in 96 AI duels. secretBlade fired 5 times in the 2v2 set through instant wounds; the rest sit inside the bundle ablation band.
5. **Three dice rules → one physical rule.** buckle p 0.5 (combat.js:1058), kote drop (combat.js:1118) and whip kneel (combat.js:1022) all roll `buckleRandom()`. The physical quantity is **impulse delivered to the knee or wrist joint versus that joint's hold torque** (the same test the balance and stand logic already uses).
   - Measured: 5 buckle rolls with 2 hits, 1 kote roll, 0 whip rolls in 96 fights. Present but immaterial for the AI.
   - Removes 3 functions (~70 lines) plus koteSword (~15).
   - **Owner decides**: the owner set the probabilities on 10/21, 10/23 and 10/24. This conflicts with the owner's own 10/01 "확률 아닌 물리" (physics, not probability). Put the conflict to the owner; do not remove silently.
6. **Lockout timers → one "recovery" state.** Secret stiff (SECRET.stiff), burst-whiff stiff (burst_whiff.js 202 lines, BURST_WHIFF 8 keys), skill stiff, buckleKneel and koteDropAt each hold the body or the AI with their own timer. One `recoverUntil` field read by AI, skill and gait would remove 4 parallel checks (ai.js has 25 `경직` sites). Behaviour-identical if the times are kept. Not measured. Burst-whiff stiff is **owner decides** (11/19).
7. **Iberian block inside fighter.js.** Lines 2311–2451 (updateIbFlow, ibTrade*, ibChain*, ibFlowK, ibChainCostK) plus 83 ib* lines are school logic sitting in the core body file.
   - Move them to `ib_flow.js`, the way italian_outbox, cn_step and jp_tank already work: about −140 core lines, behaviour-identical.
   - Do the same for gait.js german chase/burst (4 branches) and fighter.js italian tipAim / chinese useEast.
   - The ibFlow multiplier fired 5 times at levelled proficiency and 24 at proficiency 5, inside the band. It is owner-decided as a mechanic (10/28), but moving the file is not an owner decision.
8. **Emotion multipliers.** 3 emotions × 3–4 factors (EMO_ABILITY), 3 factors in analyze.
   - Measured: removing them is borderline (downs 37 vs 41–47, deaths in band).
   - Possible merge: anger and obsession both raise dealt and pass. That could be one "commit" scalar instead of 6 numbers.
   - **Owner decides** (emotions are a design pillar).
- Also worth noting:
  - bladeWeight and thrustAssist were each immaterial in this set. Both are owner-decided 11/17 / STRIKE, so keep them unless the owner chooses.
  - headBluntKD duplicates the balance knock-down. A head blow already drains balance through stagger, so it could merge into "head impulse → balance". Measured: in band. Not owner-decided as far as I found; I did not verify this in decisions.md.

## 5. Must NOT be simplified (load-bearing per measurement)
- **stepMass** (walking body mass in cuts): removing it moves deaths 39 → 29, outside the band.
- **Plate / helmet guard** (74 + 106 plate hits, helmet 17–29). Not ablated because it is core armour, but it fires in every plated fight.
- **Decapitation / neck lethal**: 13 of 39 deaths in the base run.
- **Bleed death**: 22–30 deaths per run, the main death cause.
- **Balance knockdown**: 24 of 38 KDs.
- **Revive**: fires 3–5 times per run, as designed.

## 6. Repro
```
S=<작업 폴더>; cd $S/jd
J_COUNTS=1 nice -n 10 node tools/sim/D_fights.mjs > out/base.txt            # 48 duels + counters
PERTURB=1 nice -n 10 node tools/sim/D_fights.mjs                            # null band (also 2, 3)
J_COUNTS=1 PROF=5 nice -n 10 node tools/sim/D_fights.mjs                    # secrets on
J_ABL=stepMass nice -n 10 node tools/sim/D_fights.mjs                       # ablations (names in jd/src combat.js JA('…'))
J_ABL=cnStep,schoolPassive,itThrust,parryKeep,ibFlow,yaojiBleed,buckle nice -n 10 node tools/sim/D_fights.mjs
nice -n 10 node tools/sim/with_config.mjs COMBAT.limbSever=off D_fights.mjs
J_COUNTS=1 nice -n 10 node tools/sim/D_team.mjs                             # 2v2 x8
node $S/deadkeys.mjs $S/wt_main                                             # unread config keys
```
Instrumentation was applied with `python3 $S/patch_combat.py src/combat.js` and `python3 $S/patch_fighter.py src/fighter.js`, then the sed alias fix (`J as __J` in fighter.js) and `src/_j.js`.
