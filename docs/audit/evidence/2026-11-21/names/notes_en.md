# G_names: naming and format consistency (read-only measurement of main @ e13401a6)

All scripts: scratchpad/G/ (run_all.sh <checkout> reruns everything; each takes the checkout dir as argv).
M = checkout root. Counts of "leaves" = leaf values of the 82 exported config consts (1,617 leaves, 1,133 distinct key names, via `node cfgkeys.mjs $M`).

## Summary (the ranking is JUDGEMENT; the counts are measured)
1. (judgement) Config "factor" vocabulary: 15 different words (K, Mul, Mult, Scale, Gain, Keep, Cut, Ratio, Frac, Factor, Rate, Share, Amp, Damp, Weight) with no rule; `k`/`cut`/`keep` even change meaning between blocks (value 0.5 vs 20000 vs 50). Biggest reading cost.
2. (judgement) Time/angle units are carried by neither name nor one wrapper: 134 leaves use `realS(`, 42 time-named leaves are raw, 2 are ms (`tapMs`); angles: only 6 keys say `Deg`, 80 other angle-named numbers carry no unit, mix of degrees and radians.
3. (judgement) Comment weight: 45.7% of src bytes are comments (3.35 MB of 7.34 MB); config.js is 91% comment; 1,055 lines >200 chars.
4. (judgement) School tag has 3 spellings for one school in files/config: `ib_`/`iberian_`/`IB_`/`altib`; `it`/`italian`/`IT_`; `cn`/`chinese`/`CN_`; `de`/`german`/`DE_`. File names and config consts disagree in 5 of 10 cases.
5. (judgement) Local math helpers: `clamp` declared in 21 files (13 own bodies in 7 distinct spellings + 8 aliases of THREE.MathUtils.clamp), `smooth` in 16 files with 3 different signatures. No shared util module.
Already consistent (good news): all 267 src/*.js names are snake_case lowercase, no hyphens/uppercase; no `_old/_new/_tmp/_copy` files; docs md names have no date style B (`-YYYYMMDD` exists only in 1 public/ file); docs date suffix `_YYYY-MM-DD` is used by all 325 dated topic docs; no topic has 3+ dated versions (max 2); the three big flat families (stage_, outfit_, ai_) are prefix-clean (registry files `stages.js`/`outfits.js` are the only unprefixed hubs); boolean on-switch is `on` in all 5 object switches; no `limit`/`ceil` words in config; "m/s" never written as other spellings.

## 1. Config key vocabulary (src/config.js, 2,801 lines)
Method: `node cfgkeys.mjs $M` then `python3 cfg_vocab.py $M` (key -> first line of `key:` inside its export block; value text = rest of that line). Line numbers approximate (first match in block).

### 1a Multiplier-like words (leaves / distinct key names)
| word | leaves | keys | examples |
|---|---|---|---|
| K (camel `xxxK` or `k`) | 50 | 37 | TIME.k:16, GAIT.cadenceK:385, SKILL.cnBraceK:1121, JOINTS.kElbow:2578 |
| cut / Cut | 28 | 13 | FLOW_REDESIGN.flowDmgCut:694 =0.7, NAGASHI.joltCut:682, CN_STEP.cut:2108 =0.5, ANATOMY.head.cut:892 =30 |
| gain / Gain | 14 | 11 | FLOW_REDESIGN.exitGain:697, GAIT.stanceGain:464 =2, MINDSET.latGain:2249 =24 |
| rate / Rate | 12 | 8 | GAIT.heightRate:410, GAIT.capRate:430 (not all multipliers; realRate is a function) |
| Mul | 11 | 11 | ARMOR.moveMul:996, SECRET.hitMul:1400, RUN.mul:543, IT_OUTBOX.thrustMul:1466 |
| share / Share | 9 | 8 | BODY.upperShare:263, SECRET.iaiDrawShare:1267 |
| keep / Keep | 7 | 6 | AI_PLAN.digKeep:1952 =0.6, DIG_PROTO.keep:2054 =0.5, AI_RUN.keep:592 =50 |
| frac / Frac | 5 | 4 | GAIT.dsFrac:387, JOINTS.playerReachFrac:2584 |
| scale / Scale | 4 | 4 | SECRET.slowMo.scale:1401, ARENA_SCALE:96 |
| amp / Amp | 4 | 3 | AI_PLAN.luckAmp:1947 |
| factor | 2 | 2 | GAIT.sideFactor:458 =0.4, GAIT.backFactor:459 =0.7 |
| damp | 2 | 2 | RUN.flyDamp:565, STRIKE.stuckDamp:640 |
| mult / ratio / weight | 1 each | 1 each | LETTER.mult:1143, FLOW_REDESIGN.minSweepRatio:695, GAIT.weightFront:399 |
| boost, coef, pct, mix | 0 | 0 | |
Total distinct words: 15 (K, cut, gain, rate, Mul, share, keep, frac, scale, amp, factor, damp, mult, ratio, weight). Mul is a 0.x-2.5 multiplier everywhere; K spans 0.5 (AI_PLAN_JP.habitK:1984) up to 20000 (GAIT.pinK:480, a spring constant).
Same meaning, different word, neighbouring places:
- GAIT:458-465 uses `sideFactor`/`backFactor` (x0.4/x0.7) and, 6 lines later, `stanceGain`/`swingGain` (x2); FLOW_REDESIGN:697 `sideGain` =0.06 is a distance-like gain, MINDSET:2249 `latGain` =24.
- Damage reduction by a fraction: `flowDmgCut` (FLOW_REDESIGN:694), `cnParryDmgCut`/`jpParryDmgCut` (SKILL:1122/1125), `joltCut` (NAGASHI:682) vs hit-multiplier `hitMul` (SECRET:1400) vs `keep` "fraction kept" (DIG_PROTO:2054).
- `cut` has two meanings: blade-cut threshold in ANATOMY.*.cut:892 / ARMOR.*.cut:963 (30..200) vs reduction factor (0.5) above.
- `keep` is 50 in AI_RUN:592 (not a fraction) but 0.5 in DIG_PROTO:2054.

### 1b Boolean switches
| form | leaves | note |
|---|---|---|
| boolean-valued (true/false) | 17 | AI_REACT.on:817, ARMOR.on:944, GRIP.on:1038, TEAM_FIGHT.lever.lineUp.on:143 (5x `on`) |
| `on` | 5 | all boolean |
| testMode, anytime, instant, resumeState, decapitate, assignUnique, keepBrokenAfterCup ... | 12 | bare words, no is/use/enabled prefix: SAENGSA.testMode:2650, SHOP.testMode:2612 |
| `enabled` / `use*` / `is*` / `allow*` / `no*` / `*On` | 0 each | not used |
| `*Off` / `off*` | 3 | camMaxOff:2497, catchOff:468, offArm:1261 are NOT switches (names collide with the word) |
| numeric 0/1 used as a switch | 128 numeric leaves are 0 or 1; 17 have a comment saying 켬/끔/스위치 | e.g. JOINTS.cutPronate:2556 =1, DIG_PROTO.ai:2050 =1, GAIT.catchHurry:470 =1, SAENGSA.testMode uses `VITE_ENV === '1'` string compare |

### 1c Time values
| measure | count |
|---|---|
| leaves with `realS(` in value | 134 (file has 138 `realS(` occurrences; also 5 `realV(`, 7 `realRate(`) |
| time-named numeric leaves (T/Time/Wait/Hold/Delay/Lag/Window/Dur/Life/Cool/Beat/Tick suffix) | 96 |
|  - of them wrapped in realS | 54 |
|  - of them raw seconds (not wrapped) | 42 |
|  - of them ms (name ends `Ms`) | 2: INPUT.tapMs:2348 =180, INPUT.clickMs:2359 =250 (comment says ms) |
| wrapped leaves whose name has no time word (hold, reaction, lag, beat, kneel, window...) | 80 |
Same-block mixes: SECRET has 7-8 wrapped (`altib.armTime`:1277, `iaiArmTime`:1324) and 13-14 raw (`stance.iai.inTime`:1260 =0.3, `instantArcLife`:1253 =0.5); AI_PLAN_JP: habitT:1983/repeatT:1985 wrapped vs iaiWait:1980/gnsVoidT:1994 raw; STAMINA 1 wrapped vs 4 raw; SKILL `recoverDelay`:1068 wrapped vs `lungeTime`:1057 raw; INPUT block holds `tapMs`:2348 (ms) next to `idleRelease`:1505 (s). 6 blocks mix wrapped and raw time-like keys (time_mixed.json). Caveat: whether raw means "already game seconds" is a design fact I did not check; comments such as 1253 say "(s, 화면 시간)".
Suffix spread of time names: T 28, Time 17, Wait 8, Window 6, Hold 5, Delay 4, Sec 3, Ms 2, Lag 1, other 19.

### 1d Angles
| measure | count |
|---|---|
| keys with `Deg` | 6 leaves: arriveDeg:744, fallTiltDeg:270 =55, turnDeg:1489 =90, oppositeDeg:1506 =120, `deg`x2 |
| keys with `Rad` | 0 |
| angle-named numeric leaves (yaw/pitch/roll/angle/tilt/turn/spread/arc/fov) | 86 |
|  - with |value| > 6.3 (necessarily degrees) | 49 |
|  - with |value| <= 6.3 (radians or other) | 31 |
Mixed in one block: BODY.fallTiltDeg:270 =55 (deg, marked) vs BODY.anchorYawMax:261 =100 (deg, unmarked) vs BODY.turnSpeed:267 =2.4 (rad/s); CAMERA.fov:210 =55 (deg) vs CAMERA.yawMax:236 =0.7 (rad); UNIQUE_ASSIST.angle:1487 =40 and turnDeg:1489 =90 (same block, one marked); GAIT.catchTilt:467 =35 vs GAIT.yawTol:396 =0.35. Comments: `°` after a digit 70x, `도` 7x, `deg` 1x, `rad`/라디안 16x (units.py).

### 1e max/min naming (leaves)
| form | leaves | | form | leaves |
|---|---|---|---|---|
| max* (maxAccel...) | 17 | | min* (minDist...) | 10 |
| *Max (alignMax...) | 31 | | *Min (bridgeMin...) | 21 |
| cap / *Cap | 6 | | floor / *Floor | 4 |
| limit / ceil | 0 / 0 | | hi / lo | 2 |
Total max-ish 48+6, min-ish 31+4: both orders (prefix and suffix) are used about 1:2 for the suffix form.

### 1f School prefixes: config vs file names
Config block names with school tag: IB_PARRY_BEAT, IB_FLOW, IB_LINK, JP_TANK, DE_DIRTY, DE_VITALITY, IT_OUTBOX, CN_STEP, AI_PLAN_JP, AI_PLAN_DE (10). Inside objects the same schools also appear as long words: iberian 45 key-segments, italian 15, japanese 21, chinese 15, german 10 vs short tags ib 34, it 18, cn 33, de 16, jp 10 (cfg_vocab.py snippet in fam notes; segments counted from leaf paths). Sub-block keys in one object use both: `cn`/`chinese`, `de`/`german`, `ib`/`iberian`/`altib`, `it`/`italian`.
| config const | file with same prefix? |
|---|---|
| JP_TANK | jp_tank.js yes |
| DE_DIRTY | de_dirty.js yes |
| CN_STEP | cn_step.js yes |
| AI_PLAN_JP / _DE | ai_plan_jp.js / ai_plan_de.js yes |
| IB_LINK | users: iberian_link.js (no ib_link.js) mismatch |
| IB_FLOW | users: iberian_redondo.js, ai_plan_ib.js mismatch |
| IB_PARRY_BEAT | only used in combat.js (no ib_parry_beat.js) |
| IT_OUTBOX | italian_outbox.js (it_ vs italian_) mismatch |
| DE_VITALITY | no file de_vitality.js; users ai.js, prof_body.js |
File names: `italian_*` 3 (opposition, outbox, risoluto), `iberian_*` 2 (link, redondo) but `ib_block_regen.js` 1 and `ai_plan_ib.js`; `cn_` 2 + `chixiao_*` 2 + `ai_plan_cn`; `jp_` 1; `de_` 1; no `kr_`/german/japanese/chinese-named files. In code, school ids are long words: `school: 'chinese'` 6, 'japanese' 3, 'italian' 3, 'iberian' 2 and `=== 'de'` 5, `=== 'cn'` 3 coexist with `=== 'german'` 13, `=== 'italian'` 12 (grep -ohE on src). So the same school is `german`/`de`, `chinese`/`cn`, `iberian`/`ib`, `italian`/`it`.

## 2. Duplicate small helpers in src (python3 dups.py $M; defs found by regex, nested ones included)
Shared util module: none (no file named math/util/helpers/common; zero imports of clamp/lerp from any module). De-facto shared layer = THREE.MathUtils: `MathUtils.clamp` used in 40 files, `.lerp` 22, `.smoothstep` 26 (`grep -l`). Own `realS`: defined once in config.js:18, imported by 20 files.
| name | files defining | distinct bodies (norm.) | largest identical group | dup lines (all but largest copy) | examples |
|---|---|---|---|---|---|
| clamp (own body) | 13 (+8 files alias `const clamp = THREE.MathUtils.clamp`) | 7 | 5 | 12 | ai_mindset.js:32, ai_plan_ib.js:24, run.js:34, emotions.js:57 |
| clamp01 | 8 | 5 | 3 | 7 | camera_rig.js:12, revive_fx.js:45, sound.js:39, skill.js:60 |
| smooth | 16 | 15 | 2 | 21 | burst_whiff.js:164, pickup.js:33, iberian_redondo.js:36, camera_rig.js:13; 3 signatures: (x), (u), (a,b,x) |
| smooth01 / smoother | 2 / 2 | 2 / 2 | 1 | 1 / 1 | iai_obi.js:120 / outfits.js:1591 |
| rand | 4 | 3 | 2 | 6 | ai.js:89, ai_plan_ib.js:23 (identical) |
| rnd / rng / random | 2 / 3 / 3 | 2 / 2 / 3 | | 1 / 8 / 2 | decap_fx.js:60, arena.js:12, saengsa_rules.js:45 |
| mix | 7 | 7 | 1 | 6 | secret_instant.js:1233 |
| angDeg / angAt | 3 / 2 | 3 / 1 | | 11 / 7 | attack_stroke.js:4, iberian_link.js:34 / team_sense.js:377, team_support.js:111 (identical) |
| wrap / dist / pick / vec / normalize | 2 each | 1-2 | | 1-5 | gait.js:72 + run.js:35 (identical) |
| lerp, sign, wrapAngle, angleDiff, easeOut... | lerp 2 local (stage_loggia.js:443, stage_sluice_weather.js:9); easeOut 1 (burst_whiff.js:163); no wrapAngle/angleDiff definitions | | | | |
Math-helper names total (list above): 77 definitions, 98 duplicated lines. All names defined in >=2 files: 322 (6,934 dup lines, dominated by per-outfit/per-stage part builders: chest 15 files, head 13, skyTexture 7, esc 2 = saengsa_page.js:26 and saengsa_panel.js:28); those are domain builders, not math helpers.
Also: `clamp` argument order is (x, lo, hi) in all 13 bodies but body styles differ (Math.min/max order x4, ternary x5, default-args 1).

## 3. Line length and comment density (python3 density.py $M; comment = `//` and `/* */` outside strings, regex literals not parsed)
src totals: 267 files in src/*.js, 7,336,693 bytes, comment bytes 3,349,932 = 45.7%.
Top 10 by comment share, files > 20 KB (85 files qualify):
| file | KB | comment KB | share |
|---|---|---|---|
| config.js | 425 | 389 | 91% |
| weapon_measured.js | 25 | 22 | 87% |
| finish.js | 29 | 21 | 72% |
| italian_risoluto.js | 21 | 14 | 70% |
| schools.js | 234 | 158 | 68% |
| stages.js | 30 | 19 | 65% |
| weapons.js | 183 | 116 | 63% |
| character_temperament.js | 25 | 16 | 62% |
| ai_plan_de.js | 29 | 18 | 62% |
| ai_plan_jp.js | 22 | 14 | 62% |
Line length (chars): > 200: 1,055 lines in src (136 files); > 400: 94; > 1000: 1.
5 longest in src: skill_tree_data.js:25 (1,136), schools.js:991 (988), secret_instant.js:3301 (958), secret_instant.js:1359 (951), skill_tree_data.js:79 (926).
config.js alone: 436,186 bytes, comments 398,620 (91.4%); lines > 200: 79, > 400: 10, > 1000: 0; longest config.js:1616 (869), :1417 (864), :1388 (860), :1176 (858), :1219 (740). Files with most > 200 lines: schools.js 111, config.js 79, ai.js 76, update_notes.js 71, skill_tree_data.js 52, secret_instant.js 41. (Comment total here 3.35 MB counts text from `//` to end of line, so it includes trailing line comments.)

## 4. File naming families (src/*.js = 267 files; plus src/account/ with 2 files and 7 css)
Prefix counts (n / first token): stage 40, outfit 33, ai 16 (incl. ai.js), saengsa 13 (+ saengsa.css), skill 7, character 6, shop 4, team 4, weapon 3, secret 3, lobby 3, test 3, italian 3, stamina 3 (incl.), field 2, wetland 2, title 2, sword 2, nagashi 2, iberian 2, cn 2, chixiao 2, attack 2; jp 1, ib 1, de 1, ui 1. 45 files are single-word names with no underscore (ai, main, arena, fighter...). `ls $M/src | sed 's/_.*//' | sort | uniq -c`.
Unprefixed hub files of a family (import graph, fam.py): `outfits.js` imports 19 outfit_* ; `stages.js` imports 26 stage_*; `owned_weapons.js` mostly lobby_*. Unprefixed files used by one family only: field_route, guard_line, terrain_navigation (all imported only by ai_*), wetland_storm (only stage_*), attack_tempo (only skill_*), oklch (team_*), update_notes (start_*). Weapon family without prefix: 10 `*_details.js` (balisarda, chixiao, durandal, goujian, historical_weapon, kusanagi, muramasa, pappenheimer, rare_sword, tizona) + chixiao_profile + flamberge_look, druid_whip, whip_sound, gun, gun_fx; `weapon_` prefix has only 3.
Suffix / variant names (13): outfit_bernardo_v2, outfit_roland_v2, outfit_silver_wanderer_v9 and _v10 (alongside outfit_silver_wanderer plus _detail/_qaba/_court_hair/_full_hair), stage_clearing_b, stage_night_second/third/fifth, outfit_alter_fourth/fifth, character_julia_alter + outfit_julia_alter + outfit_alter (same concept in 3 names). Ordinals are words (second/third/fourth/fifth), version marks are `_v2`, `_v9`, `_v10`, `_b`: 3 styles in 13 files. No `_old/_new/_tmp/_copy/_final`, no numeric-glued names (foo2.js) in src.
Near-duplicate names (edit distance <= 2): outfit_silver_wanderer_v9 / _v10; saengsa_page / saengsa_panel; shop_test / shop_text; stage_clearing / stage_clearing_b; ai_plan_cn/de/ib/jp (intended). 
Orphans (no importer, not entry): 7: game_entry, motion_library, pwa, soundgen, soundlab, test_pick, voicelab (fam.py; html pages may load them).
src/account/config.js (9 lines) shares its name with src/config.js (a second `config.js`).

## 5. docs/ (python3 docs_scan.py $M; docs_dates.py $M)
3,236 files: png 1,146, webp 790, md 592, jpg 326, json 247, txt 30, log/stdout/stderr 77, mjs 7.
| top folder | md | images | json | other | total |
|---|---|---|---|---|---|
| handoff | 21 | 1,516 | 50 | 10 | 1,597 |
| import | 53 | 173 | 53 | 100 | 379 |
| strike | 220 | 53 | 10 | 19 | 302 |
| ui | 7 | 187 | 1 | 0 | 195 |
| motion | 47 | 0 | 88 | 0 | 135 |
| character_looks | 0 | 113 | 0 | 0 | 113 |
| devmeet | 60 | 2 | 44 | 0 | 106 |
| dev_exchange | 94 | 0 | 0 | 0 | 94 |
| design / stages / weapon_shots | 27 / 0 / 0 | 62 / 88 / 61 | | | 91 / 88 / 61 |
| (docs root) | 41 | 0 | 0 | 0 | 41 |
md name patterns (592 md): `_YYYY-MM-DD` suffix (style A) 325; pure date name (2026-11-07.md) 139 (devmeet, dev_exchange/inbox, dev_exchange/notes); date prefix+words 13 (devmeet/notes/2026-10-06-uhwa.md); no date 115; style B `-YYYYMMDD`: 0 md (1 non-docs file: public/stillness-20261018.webmanifest). Hyphen in md names: 483 (nearly all dates); uppercase 14; hangul in names 0.
Topics with 3+ dated versions (same stem, different dates): 0 topic stems (max 2: strike/school_balance, strike/run, strike/ib_link). Only log folders have many dated files with an empty stem: dev_exchange/inbox 48, devmeet 47, dev_exchange/notes 44, devmeet/notes 11. Loose families by first 2 name tokens with 3+ dated files: chinese_parry 4, app_icon 4, ai_plan 3, team_sense 3 (4 families total).
md > 200 KB: strike/owner_defaults_table.md 2.1 MB, decisions.md 1.1 MB, strike/school_kit_map.md 253 KB. md > 50 KB: 56 files. Total md bytes 16.4 MB (strike 8.8 MB, docs root 2.4 MB, import 1.3 MB).
Index/README: docs root none; of 18 top-level folders only 3 have README/index.md (devmeet, sound_reserve, motion); 15 without (incl. strike with 220 md, handoff, import, dev_exchange). Folders containing md: 25, with README/index: 10.

## 6. Commit titles (git -C $M log -600 --format=%s; python3 commits.py subjects.txt)
History = 3,077 commits; sample = last 600.
| measure | value |
|---|---|
| median title length / mean / max | 64 / 97.5 / 988 chars |
| titles > 120 / > 200 chars | 87 / 46 |
| titles with an `X:` prefix before a colon | 324 (54%) |
| top prefixes | 기록 94, 합침 89, 결정 기록 59, 공지 10, Devmeet 6, 유파 마음가짐 5, 시험 4 -> top 3 = 242 (40%) |
| no-colon titles | 276 (46%): auto `Merge branch ...` 27, `생사전 ...` 15, `서포트 ...` 15, `샛별 ...` 13, `dev <hash> 합침 ...` 6 |
| titles mentioning 사장님 (owner quote) | 275 (46%); with a date like 11/21: 329 |
| non-Korean (no hangul) titles | 29 (27 auto merge titles, `tmp2`, 1 other) |
| clearly meaningless (tmp/wip/test/fix/"."/update exact) | 1 (`tmp2`); the one `WIP ...` title is descriptive |
Titles carry the same facts as docs (decision text, owner quotes, merge branch ids), which is why the longest reach 800-990 chars.

## 7. Unit notation in config.js comments (python3 units.py $M; `//` comment text 396 KB)
| notation | count | notation | count |
|---|---|---|---|
| `m/s` | 103 | `㎧`, `미터/초` | 0, 0 |
| digit + `m` (meter) | 105 | `미터` | 2 |
| digit + `s` | 153 | digit + `초` (all `초` incl. 초당: 310) | 101 |
| digit + `ms` | 2 | `밀리초` | 0 |
| digit + `°` | 70 | digit + `도` | 7 |
| `deg` | 1 | `rad` / 라디안 | 16 |
| digit + `N` | 6 | `뉴턴` | 1 |
| digit + `kg` | 5 | `킬로` | 1 |
| digit + `J` | 50 | `줄` / N·m | 14 |
| digit + `px` | 15 | digit + `%` | 217 |
| `×` | 391 | `배` after digit | 33 |
Reading: SI symbols dominate (m/s, s, °, N, kg, J) with the Korean word as minority; `s` vs `초` is the one real split (153 vs 101); the header comment (config.js:5) states units as m, kg, s, N. Multiplier is written `×` (391) far more than `배` (33).

## Caveats
- Config leaves come from a live `import()` of config.js (worked, no browser globals), so keys built by loops or spreads are included; line numbers are found by regex (first `key:` in the block) and can be off for repeated keys (e.g. `cut`, `pitch`, `k`). Arrays are leaves (130) and are not expanded.
- "Time-named" and "angle-named" classes are name regexes, not semantic; counts of raw vs wrapped time depend on the regex suffix list. Value-based angle split (6.3 rad) is a heuristic.
- Whether a raw-seconds key is meant as real or game seconds was not checked.
- Helper detection (dups.py) uses regex + bracket matching; arrow bodies without braces end at `;`/newline; nested local functions are included (inflating builder names like chest/head); aliases `const x = THREE.MathUtils.x` were counted separately by grep.
- Comment bytes ignore regex literals and template-literal `${}` nesting; config.js comment total differs slightly between density.py (398,620) and units.py (396 KB; only counted lines with `//`).
- Family outliers by content use the import graph only (relative `./x.js` imports); html entry pages and dynamic string imports were not scanned.
- Commit sample = first 600 of `git log` from HEAD of the checkout; the history may include merge commits not authored by people.
- Not measured: tools/ (known), public/, camelCase vs snake_case inside js identifiers, CSS names.
