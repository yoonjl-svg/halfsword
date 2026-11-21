// Feint-defect browser probe: real page, 1:1 fight, second AI drives the player; records page errors, sim-time progress, foe AI state.
//  node feint_browser.mjs <baseUrl> <query> <seconds> <outJson> [driver=ai|still] [forceFeint=0|<value>]
//  forceFeint: NOT a player path — overwrites game.ai.level.feint in the page so the feint branch of AI.startAttack is taken
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, query, secsS = '75', out = '/dev/stdout', driver = 'ai', forceS = '0'] = process.argv.slice(2);
const FORCE = +forceS;
const SECS = +secsS;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errs = []; const consoleErr = [];
const T0 = Date.now();
page.on('pageerror', (e) => errs.push({ ms: Date.now() - T0, msg: String(e.message).slice(0, 200), top: String(e.stack || '').split('\n').slice(0, 3).join(' | ').slice(0, 400) }));
page.on('console', (m) => { if (m.type() === 'error') consoleErr.push({ ms: Date.now() - T0, text: m.text().slice(0, 200) }); });
await page.goto(`${base}/?${query}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 180000 });
await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
const tFight = Date.now() - T0;
const info = await page.evaluate(() => { const g = window.game, a = g.ai; return { enemyName: g.enemy.name, enemyWeapon: g.enemy.weapon?.id, playerWeapon: g.player.weapon?.id, school: a.school?.id ?? a.school?.name, tradition: a.art?.tradition, personaSchool: a.persona?.school ?? null, level: a.levelName ?? null, levelFeint: a.level?.feint, anger: a.anger, missingFeints: (a.school.feints ?? []).filter((f) => !a.school.techByName[f.fake]).map((f) => f.name + '>' + f.fake), feintCount: (a.school.feints ?? []).length }; });
const errCountAt = () => errs.length;
await page.evaluate(([driver, force]) => {
  const g = window.game;
  const W = (window.__probe = { samples: [], frames: 0, fightFrames: 0, stallFrames: 0, lastSim: g.stats.simTime, errs: [], wrapped: null, rounds: 0 });
  window.addEventListener('error', (e) => W.errs.push({ sim: +g.stats.simTime.toFixed(3), wall: performance.now(), mode: g.ai?.mode, phase: g.ai?.phase, why: g.ai?.why, frame: W.frames }));
  const wrap = () => {
    const a = g.ai; if (!a || W.wrapped === a) return; W.wrapped = a; W.rounds++;
    if (force > 0) a.level = { ...a.level, feint: force };
    if (driver !== 'ai') return;
    const ai2 = new g.AI(g.player, g.enemy, 'normal');
    const orig = a.update.bind(a);
    a.update = (dt) => { orig(dt); try { ai2.update(dt); } catch (e) { W.ai2err = String(e); } }; // same as P_measure.mjs: foe AI errors propagate exactly as before
  };
  wrap();
  const t0 = performance.now(); let nextS = 0;
  function f() {
    requestAnimationFrame(f);
    W.frames++;
    wrap();
    const sim = g.stats.simTime;
    if (g.state === 'fight') { W.fightFrames++; if (sim === W.lastSim) W.stallFrames++; }
    W.lastSim = sim;
    const t = (performance.now() - t0) / 1000;
    if (t >= nextS) { nextS += 1; const a = g.ai, e = g.enemy; const p = e.bodies.pelvis.translation();
      W.samples.push({ t: +t.toFixed(1), state: g.state, sim: +sim.toFixed(2), frames: W.frames, errs: W.errs.length, mode: a?.mode, phase: a?.phase, why: a?.why, tech: a?.tech?.name, attacks: a?.stats?.attacks, feints: a?.stats?.feints, parries: a?.stats?.parries ?? a?.stats?.blocks, eState: e.state, eAlive: e.alive, eBlood: +e.blood?.toFixed?.(3), pAlive: g.player.alive, ex: +p.x.toFixed(2), ez: +p.z.toFixed(2), hand: [+e.handOffset.x.toFixed(2), +e.handOffset.y.toFixed(2)] }); }
  }
  requestAnimationFrame(f);
}, [driver, FORCE]);
await page.waitForTimeout(SECS * 1000);
const P = await page.evaluate(() => { const W = window.__probe; return { samples: W.samples, frames: W.frames, fightFrames: W.fightFrames, stallFrames: W.stallFrames, errs: W.errs, rounds: W.rounds, ai2err: W.ai2err ?? null, stats: { ...window.game.ai.stats } }; });
await browser.close();
const byMsg = {}; for (const e of errs) byMsg[e.msg] = (byMsg[e.msg] || 0) + 1;
const summary = { query, driver, forceFeint: FORCE, secs: SECS, tFightMs: tFight, info, pageErrors: errs.length, byMsg, firstErr: errs[0] ?? null, firstErrSimInPage: P.errs[0] ?? null, consoleErrors: consoleErr.length, consoleFirst: consoleErr[0] ?? null, frames: P.frames, fightFrames: P.fightFrames, stallFrames: P.stallFrames, rounds: P.rounds, ai2err: P.ai2err, endSample: P.samples.at(-1), aiStats: { attacks: P.stats.attacks, feints: P.stats.feints } };
fs.writeFileSync(out, JSON.stringify({ summary, samples: P.samples, pageErrs: errs, inPageErrs: P.errs }, null, 1));
console.log(JSON.stringify(summary, null, 1));
