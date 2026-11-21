## Result
All 11 cells fire with the input the card describes, in the real page with real CDP touch events. None needed forcing: no AI was frozen and no foe was moved. G7, G10 and B4 ran against the real foe AI.

`report.md` was not written: the file tool here refuses to create report .md files from a sub-agent, and I did not get around that. The full report is below, ready to save as `<scratch>/a/report.md`.

Files in `<scratch>/a/`:
- `results.json`: raw per-run observations, with frame signals, cues, HUD text and pointer logs.
- `lib.mjs`, `cells.mjs`: the harness. Run `node cells.mjs <baseUrl> <outDir> [cells]`; the env vars `RUNS`, `VARIANT`, `KEY` and `UPCUT` pick the variants.
- `run_main.sh`, `run_extra.sh`: the exact two passes.
- `merge.mjs`, `summarize.mjs`: build `results.json` and print one line per run.
- `out_de/`, `out_ib/`, `out_x/`: the per-pass outputs.

## Where the card and the code differ
- **G5, G8, B3 (the card says less than the code requires):** the swipe has to start at a stance pad, and the card does not say so. G5 and B3 need the hand at the right-shoulder pad (tagR, 0.42/0.42) before swiping ↙; G8 needs the right side pad (sideR) before swiping ←. The same swipe from the resting hand position gives a plain cut, with no technique and nothing on the HUD.
- **G7 (fires further away than "가까이서" suggests):** the two-clashes route has no upper distance limit (`unique_assist.js` dupAutoTick checks only `d > lo`). With no guard pressed, it fired at a chest distance of 2.24 m. It also fires on its own during G10's close-in shoving.
- **B7 (an unstated condition):** the second cut must go in a big-cut direction whose start pad is away from the hand. With ↗ as the second cut there was no link. The same two-cut input also switches on B5's flow.
- **G2:** a half push (about 62 % of the stick's travel) also fires. A control run with the Iberian school (no G2) gave no burst, so the signal belongs to G2.
- **B4:** the HUD shows "알티바슈 포르트 · 비기" as soon as the window opens, so the HUD text alone cannot show whether the secret fired. A fast swipe while the window was open did not fire it.
- **Measured times agree with the card:**
  - G10: 1.65 / 1.67 s of unbroken shoving before the window opened. That is 1.5 s real at the game's 1.1 time factor. One run took 3.25 s because contact broke off and restarted.
  - B4: the window opened 2.2 game-s (2.0 s real) after input became live. The press reached the wind-up after 0.65 s.
  - B5 and B7: they chain at gaps up to 0.65 s and not at 0.74 s. The config window is 0.6 s real, 0.66 game-s.
- **No HUD text at all** for the bursts (G1, G2, B2) or for B5/B7. Their verdicts rest on internal state only.

## Harness notes
- **Tap/hold correction:** no cell was affected. I never used wall-clock sleeps; every press length was in stepped fake-clock time. The only hold (B4) lasted about 0.65 s of stepped frames, so it can't have been counted as a tap. No re-run was needed for this.
- **touchEnd fix:** applied, and all cells were re-run after it. Each run's pointer log shows the sword finger lifted before the stick thumb.
- **Stamina:** infinite in this stage, so burst push charges are never recorded. Bursts were confirmed with a record-only wrapper on `gait.fastBegin` that does not change its inputs or result.
- **Start timing:** the round-start freeze makes early inputs all take effect at the same moment (t ≈ 3.30). Varying the wait therefore did not change burst timing. The swipe runs vary in finger position, stick side and timing.
- **Not run:** a mirrored ↘ variant for G5/B3; the G7 hold-the-blades route without the guard button (the two-clashes route fired first); the reason the B4 window was gone after the swipe.
- **I killed other people's harness runs.** Around 19:12 UTC I ran `pkill -f "cells.mjs http"` to stop my own runs. Other auditors' harness files have the same name, so their runs (out/jc, out/it2) were killed too. They seem to have been restarted. The dev server and the checkout were not touched, and my browsers are closed.

---
# report.md (content)

# Skill-card input check: German (G1 G2 G5 G8 G7 G10) and Iberian (B2 B3 B4 B5 B7)
Checkout: main at bd9228dd, served at http://127.0.0.1:5310. Card text is `NODE_CMD` in `src/skill_tree_data.js:204-221`.

## Method
- Headless Chromium, 844×390 touch viewport.
- Normal path: the page opens at `/` with no parameters. The save is pre-filled with all 12 cells of the school plus the weapon (German: longsword, Iberian: zweihander; the page confirmed tradition german / iberian). Then the notice is dismissed, `#newJourney` is tapped, and the fight starts against Stage 1 (foe 하인리히 도른).
- Fake clock advanced 17 ms per frame; painting off.
- All input is CDP `Input.dispatchTouchEvent`: id 1 = stick thumb on `#moveStick`, id 2 = right sword finger, id 3 = guard thumb on `#btnParry`.
- Every run is a fresh page. Each run's `pointerLog` in results.json shows the correct finger being lifted.
- Signals:
  - Stroke cells: `player.uniqueCue` and `playerUnique.stats.fired`.
  - Bursts: the burst object a step consumes, read through a record-only wrapper on `gait.fastBegin`.
  - G10 / B4: `playerSecret.open` and its event, the `skill.sec` stages, and the secret cue.
  - B5: `ibFlowOn` / `ibCutN`. B7: `stats.link`.
  - HUD: `#techSlot .slot`.
- Times are fight-clock seconds (game time). A config value written as `realS(x)` equals x × 1.1 in this clock.
- No wall-clock sleeps; every press length is in stepped time.
- Stamina is infinite in this stage, so no ledger charges are recorded.
- The round-start freeze makes early inputs take effect together at t ≈ 3.30.

## Results
| Cell | Card | Weapon | Precondition | Touch sequence | Expected (code) | Observed + HUD | Verdict | Card vs code |
|---|---|---|---|---|---|---|---|---|
| G1 | 멈춘 상태에서 뒤로 이동(↓) | longsword | game path, standing, foe ≈5.6 m | stick straight back (run 2: slightly right of back), held 60 frames | back burst from standstill; stick ≥0.6, back ≥ side, German (gait.js:842-854, config.js:247-248) | burst {fore:-1} used at t 3.30, fastK 1.96, ×3; no HUD | fires 3/3 | variant: back-left with side larger → no burst; matches the card |
| G2 | 멈춘 상태에서 앞으로 이동(↑) | longsword | game path, standing | stick straight forward (run 2: slightly right), held | dig-in: two burst steps (gait.js:861-863, GAIT.digSteps 2) | {fore:1, dig:2} at 3.30, then {dig:1} at 3.58, ×3; no HUD | fires 3/3 | half push (≈62 % of knob travel) also fires; Iberian control (no G2): no burst |
| G5 | 사선 긋기(↙) | longsword | game path | slow drag (≤2 px/frame) to tagR (0.42, 0.42), then 4×(-25,+25) px, lift | schielhau replaces zornhau; start ≤0.15 from tagR, direction within 40° (unique_assist.js:106, attack_stroke.js:11-23, ai_techniques.js:58) | read zornhau/tagR/schielhau; HUD "곁눈 베기 실하우 · 내 독일 · 고유 동작" | fires 3/3 | card wider: ↙ from resting hand (0.15, 0) gives nothing; the shoulder start is not on the card |
| G8 | 좌우 이동(←/→)과 동시에 수평 긋기(←) | longsword | game path | stick right (run 2: left), drag to sideR, 4×(-35,0) px | stick side (≥0.3) + zwerch from sideR (unique_assist.js:100, 280-283; ai_techniques.js:62) | read zwerch/sideR/zwerchAbtritt; HUD "비껴 딛는 가로베기 …" | fires 3/3 | card wider: ← from resting hand with stick side gives nothing |
| G7 | 가까이서 칼을 맞대거나 연달아 부딪히면 자동 발동 | longsword | game path, real AI; walked in to ≈1.4 m | guard button held up to 20 s | 'bind': blades touching at 1.0-1.6 m for 0.44 s; 'clash2': two contacts within 1.32 s at any d > 1.0 (unique_assist.js:1328-1375, config.js:1085-1088) | bind at d 1.26 and 1.09; clash2 at d 1.31; HUD "겹치기 두플리렌 …" | fires 3/3 | variant (no guard): fired by clash2 at d 2.24 m, so "가까이서" is narrower than the code |
| G10 | 상대와 몸이 붙은 채 1.5초 이상 밀치면(↑) 비기 활성화 | longsword | game path, real AI | stick ↑ held; when the window opens, swipe 3×(-35,+30) px | shove ≥ mordPress 1.65 game-s at chests ≤0.8 m (secret.js:893, config.js:799-802) | window 'press' after 3.25 / 1.67 / 1.65 s from first close frame; longest unbroken close run 1.65 s each; stages instant → stiff; HUD "모르트슐라크 · 비기" | fires 3/3 | matches 1.5 s; variant (stick lifted at contact): no window in 6 s although close for 5.4 s |
| B2 | 좌우 이동(←/→) | zweihander | game path, standing | stick right / left / right with a slight forward part | side burst (gait.js:845-853, 866-876) | {side:±1}, fastK 1.59, ×3; no HUD | fires 3/3 | variant: forward-right diagonal (forward share 0.53 > 0.3) → no burst |
| B3 | 좌우 이동(←/→)과 동시에 사선 긋기(↙) | zweihander | game path | stick right (run 2: left), drag to tagR, 4×(-25,+25) px | talhoRodeado (unique_assist.js:127) | read zornhau/tagR/talhoRodeado; HUD "나선 걸음 베기 …" | fires 3/3 | card wider: ↙ from resting hand gives nothing |
| B4 | 칼 길이 바깥에서 2초 기다리면 비기 활성화 · 탭을 길게 누르다 떼기로 발동 | zweihander | game path, real AI (window opened at d 4.3) | finger down, still (0 px), stepped frames until hold 'wind' (+0.15 s), lift | arm: outside reach for 2.2 game-s → window 'altib' (secret.js:908-930); hold ≥0.66 → wind, release → strike (unique_assist.js:747-795, main.js:3105-3106, 3150-3156) | window at t 5.51 (2.2 s after input live at 3.30); press → wind 0.65 s; secret cue altib at 6.35; HUD "알티바슈 포르트 · 비기" | fires 4/4 (first-pass "variant" ran the canonical sequence) | swipe in the window does not fire; the HUD shows the name while the window is open, so HUD alone is not proof |
| B5 | 긋기를 쉬지 않고 이어 가기 | zweihander | game path | one finger: cut 1 4×(-25,+30), keep down, gap, cut 2 4× (← first pass, ↗ second pass), lift | updateIbFlow: real cut, then another within 0.66 (fighter.js:2343-2400, config.js:503, 1028) | ibFlowOn at gaps 0.05 / 0.16 / 0.25 (also with ↗); sweep fires at 0.35-0.65, not at 0.74; no HUD | fires 3/3 | 1.0 s gap does not chain; edge 0.65-0.74 s, matching 0.66 |
| B7 | 긋기 뒤 곧장 다음 긋기 | zweihander | game path | as B5 with cut 2 ← | linkTry: big-cut direction with its start pad >0.15 from the hand (unique_assist.js:909-950, iberian_link.js:51-70) | link.fired = 1 (zwerch), phases turn → arrive → replay; fires at 0.35-0.65, none at 0.74 or 1.0; no HUD | fires 3/3 | direction condition not on the card (↗ second cut: no link); the same input also turns on B5 |

## Not tested / limits
- Mirrored ↘ for G5/B3.
- G7's hold-the-blades route without the guard button (the two-clashes route fired first).
- The cause of the B4 window being gone after the swipe.
- No HUD evidence for the bursts or for B5/B7.
- Discarded earlier passes: one lifted the wrong finger, one used stamina as the burst signal. Only the corrected runs are in results.json.
- Incident: `pkill -f "cells.mjs http"` around 19:12 UTC also killed other auditors' harness runs with the same file name.

---

## Inputs while the player's body can't act (German longsword, foe AI frozen)
Both situations are forced: (1) `player.knockDown(true)` and (2) `player.dropSword()` called by script, with `game.ai.update = () => game.enemy.move.set(0,0)`. Each ran 3 times with input and 3 times as a control (12 runs), all real CDP touches. Every touchMove waited for the page's pointermove counter to go up before the frame was stepped; `lateMoves` was 0 in every run. No wall-clock sleeps, and I stopped only processes by their PIDs.

**Two things leak in both situations: a swipe while lying down counts as a cut, and the guard button stays held.** Nothing fires late after standing up or after picking the sword up.

### (1) Lying down
Inputs started 10 frames after the knockdown. The sequence was a tap (f12), a fast swipe (f19, 4 moves of 30/30 px), the guard held 15 frames (f20–35), then the stick fully right from f36 until standing.

| Measure | Input runs (×3) | Control runs (×3) | What it means |
|---|---|---|---|
| Thrust count | 0 | 0 | The tap is dropped |
| Cut count | +1 in every run | 0 | **The swipe while lying counts as a cut** |
| `skill.tap` frames | 0 | 0 | |
| `skill.swinging` frames | 6 / 6 / 5 | 0 | The swipe registers as swinging |
| `playerGuard.held` frames | 15 / 15 / 15 | 0 | **The guard flag is true while lying** |
| Frames with `player.move` non-zero | 207–208 | 0 | The stick is passed to the body |
| Pelvis end point when standing | x about -2.195 | x about -2.108 | The stick moves the lying body only about 8 cm; path length is the same (1.69 m) |
| Time down | 4.541 / 4.542 / 4.541 s (standing at f242–243) | the same | Input does not change it |
| In the 60 frames after standing | no tap, swing, guard, move, secret or count change | the same | Nothing fires late |

### (2) Sword dropped (auto-pickup)
The pickup sequence was the same in every run, with or without input:
- `autoPick` is on at f1–8/9.
- **Then a gap of about 19 frames (f9/10 – f27/28) where `autoPick` is off and the sword is still not held.**
- Then `autoPick` and `pickup` are on (f28/29 – f58/74).
- The sword is held again at f56–75 (1.05–1.39 s).

Inputs were sent from f2: tap f2, swipe f3–9, guard f10–25, stick from f26 held until the sword was held. Because of the gap, the tap and most of the swipe landed during `autoPick`, but the guard and the stick landed in the gap.

| Measure | Input runs (×3) | Control runs (×3) | What it means |
|---|---|---|---|
| Thrust and cut counts | 0 | 0 | Tap and swipe are dropped (during `autoPick`, or with no sword) |
| `skill.swinging` frames | 0 | 0 | |
| `playerGuard.held` frames | 14 / 14 / 15 (f10/11–24) | 0 | **The guard is held in the gap** |
| Frames with `player.move` non-zero | 3 / 3 / 2 (f26–28) | 0 | The stick drives the body in the gap; `move` goes back to 0 once `autoPick` is on again |
| Time until the sword is held | 1.39 / 1.39 / 1.11 s | 1.39 / 1.14 / 1.05 s | No clear effect; the controls themselves vary by 0.3 s |
| Pelvis end point | within about 4 cm of the matching control | | No real change to the path |
| After the sword is held (60 frames) | nothing late | nothing late | |

**Unfinished in (2): the stick did not point away from the sword as you asked.** I could not read the sword's position (`player.sword` gave no position), so the script fell back to stick fully right. Each run's JSON records the vector actually used, `stickVec [1,0]`.

The guard and stick leak in (2) is a gap in the auto-pickup itself: the gap shows up in the control runs too, where nothing was pressed.

### Files
Scripts and raw results are in `<scratch>/a/blocked/`:
- `run.mjs`: one run. Usage: `node blocked/run.mjs <baseUrl> <outDir> <down|drop> <input|control> <i>`. It reuses `../lib.mjs`.
- `run_all.sh`: runs all six for one situation.
- `out/*.json`: one file per run, with a summary, per-frame records and the pointer log.
- `log_down.txt`, `log_drop.txt`: console output.

My browsers are closed; the dev server and the checkout were not touched.
