# Idle cost of non-fight screens (844x390 mobile ctx, CPU throttle 1, 3 s settle + 6-8 s sample, no input)
Reproduce: `cd V/new && npx vite --port 5196 --strictPort &` then `node Q/idle_screens.mjs http://127.0.0.1:5196` (raw: Q/idle_screens.json).
rAF-source attribution (stack of each requestAnimationFrame caller): `node Q/raf_sources.mjs http://127.0.0.1:5196`.

| screen | rAF/s | 3D frames/s | task ms/s | script ms/s | layout ms/s | style ms/s | running anims (infinite) | setInterval fired/s | live intervals |
|---|---|---|---|---|---|---|---|---|---|
| 1a title + auto notice dialog (first visit) | 120 | 0 | 9-11 | 3-5 | 0 | 0 | 0 (0) | 0 | 2 |
| 1 title, bare | 180 | 0 | 18-19 | 5-7 | 0 | 0 | 0 (0) | 0 | 2 |
| 1b/1c/1d title + notices / settings / account open | 180 | 0 | 21-31 | 6-9 | 0 | 0 | 0 (0) | 0-0.3 | 2 |
| 2a lobby + auto skill-tree notice dialog | 180 | 0 | 27 | 10 | 0 | 0 | 0 (0) | 0.3 | 3 |
| 2 lobby, items tab | 180 | 0 | 26 | 10 | 0 | 0 | 0 (0) | 0 | 3 |
| 3a lobby shop tab | 180 | 0 | 21 | 7 | 0.3 | 0.3 | 0 (0) | 0.2 | 3 |
| 3b lobby skills tab | 180 | 0 | 17 | 6 | 0 | 0 | 0 (0) | 0.3 | 3 |
| 3c lobby saengsa tab | 180 | 0 | 19 | 7 | 0 | 0 | 0 (0) | 0 | 3 |
| 3d lobby capture (거점전) tab | 180 | 0 | 23 | 9 | 0 | 0 | 0 (0) | 0 | 3 |
| 3e saengsa page (opened via "대진표" button) | 180 | 0 | 28 | 11 | 0 | 0 | 0 (0) | 0.25 | 3 |
| 4 /test.html | 0 | n/a (no game) | 0.3 | 0 | 0 | 0 | 0 (0) | 0 | 1 |
(Each cell is one run; noise between runs is roughly +-30%. Title bare vs lobby difference is within that. setTimeout fired/s ~0 everywhere.)

## Reachability notes
- Title buttons: Stage / 대기실 / 공지사항 / 설정 / 계정 연결. Real clicks on `#enterLobby`, tabs `#tabItems #tabShop #tabSkills #tabEvent(생사전) #tabCapture`.
- First visit auto-opens a notices dialog on the title and a "스킬트리" notice dialog in the lobby (fresh storage); both sampled, then confirmed.
- No separate equipment/progress/account pages beyond: items tab = equipment, skills tab = skill tree, account/settings/notices = title dialogs (sampled as 1b-1d).
- 생사전: tab opens fine; "생사전 입장" is disabled in a fresh profile (needs 정복자 title + 5 weapons, saengsa_panel.js:77), but the "대진표" look button was enabled, so the bracket page (3e) was reached by a real click. Full match flow not forced.

## Biggest idle costs (all the same three loops, on every entrance screen)
1. Three rAF loops at 60/s each = 180 callbacks/s on title, lobby, tabs and saengsa page (each verified by caller stack, ~60/s apiece):
   - `src/main.js:3198` `frame()` re-queues itself first, then early-returns at once while `data-start-open` is set (the 3D render is correctly skipped: 0 3D frames/s). Cost is just the wakeups plus a `sound.setPaused` call path being skipped. Wakeup-only, small.
   - `src/gun_fx.js:450` `tick()` runs `requestAnimationFrame(tick)` forever from install; every frame calls `viewNow()`, loops the effect pool (`step`/`updateLasers` unless game state is 'paused'). Not gated by `data-start-open`, so it runs on title/lobby too. Pure waste while the pistol effect is unused.
   - `src/pixel_grove.js:161` `tick()` polls at 60 rAF/s but only draws at 20/s (`now-last>=1000/20`); it keeps running in the lobby as well as the title (same 60/s there). Canvas 2D repaint 20/s of a pixel tree background plus gust boxes. Stops only if `document.hidden` or reduced-motion.
2. Together these account for the ~17-28 ms/s main-thread task time (about 2-3% of one core on this desktop CPU) and 5-11 ms/s script. No layout/style churn. On a phone with 4-6x slower CPU, a low-single-digit-percent CPU plus continuous 60 Hz wakeups (prevents display/CPU idle) is the cost, not heavy work.
3. Timers: `setInterval` 30 s in `src/saengsa_page.js:377` and `src/saengsa_panel.js:203` (panel one checks `host.offsetParent`), plus 2 other intervals from the entry (not located; fire <0.1/s). Negligible.

## Already quiet
- 3D renderer: 0 frames/s on every entrance screen (main.js skips render while `data-start-open`).
- CSS animations/transitions: 0 running on every screen (counted `document.getAnimations()` plus open shadow roots incl. `#gameEntrance`), so no infinite animation exists to classify (transform/opacity vs layout) at idle.
- Layout and style recalc: 0 ms/s except ~0.3 ms/s once on the shop tab. Dialogs open (notices/settings/account) add no steady cost.
- `/test.html`: 0 rAF, 0.3 ms/s, one interval only (no game loaded).

## Caveats
Headless Chromium, software GL (swiftshader), desktop CPU, one run per screen; rAF counts of 60 per loop assume the headless 60 Hz vsync. These counts and ms/s are a proxy for phone heat, not a measurement of it. Compositor/GPU work (canvas upload for the 20 Hz grove, shadow-DOM paints) is not in Task/Script/Layout metrics.
