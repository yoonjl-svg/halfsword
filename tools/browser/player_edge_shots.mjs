// 플레이어 칼 면 전/후 그림 (docs/motion/player_edge_2026-10-10.md): 실제 게임 화면에서 같은 손가락 대본(감기 → 빠르게 긋기, 옆에서 가로 · 사선)을
//  ?playerEdge=off(전)와 켬(후)으로 똑같이 그어, 플레이어 칼날이 상대 몸에 새 상처를 내는 순간마다 칼 든 쪽 옆에서 찍는다.
//  시간은 playwright 가짜 시계로 한 프레임(17 ms)씩. 상대는 가만히 선다(AI 멈춤). 날 각 = tools/sim/joint_range.mjs edgeAngleOf (계기와 같은 정의, > 45° = 칼 면).
//  손가락: main.js 가 매 프레임 handOffset 에 패드 이동을 더하는 대신, 플레이어 step 앞에서 handOffset 을 대본 자리로 두고 handHeld·inputActive 를 손가락처럼 둔다.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/player_edge_shots.mjs http://127.0.0.1:5173 <출력 폴더> [무기=longsword] [켬 값=input] [장 수=3]
//   출력: <폴더>/player_edge_{before,after}_<무기>_<n>.png · player_edge_shots_<무기>.json
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '.';
const W = process.argv[4] || 'longsword';
const ON = process.argv[5] || 'input';
const NSHOT = +(process.argv[6] || 3);
fs.mkdirSync(out, { recursive: true });
const FRAME = 17;
// 대본: [패드 자리, 빠르기 m/s] — 느리게 감고 빠르게 긋기, 사이 손 뗌(프레임)
const P0 = { tagR: [0.42, 0.42], wechselL: [-0.4, -0.42], zwerchR: [0.52, 0.06], zwerchL: [-0.5, 0.06], tagL: [-0.4, 0.42], wechselR: [0.38, -0.44], unterR: [0.38, -0.44], highR: [0.3, 0.26] };
const SCRIPT = [
  ['lift', 240],
  ['go', P0.zwerchR, 2], ['go', P0.zwerchL, 6], ['lift', 50],
  ['go', P0.tagR, 2], ['go', P0.wechselL, 8], ['lift', 50],
  ['go', P0.tagL, 2], ['go', P0.wechselR, 5], ['lift', 50],
  ['go', P0.unterR, 2], ['go', P0.highR, 6], ['lift', 50],
  ['go', P0.zwerchR, 2], ['go', P0.zwerchL, 10], ['lift', 50],
  ['go', P0.tagR, 2], ['go', P0.wechselL, 4], ['lift', 50],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

async function pass(mode, tag, shootFlatOnly) {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  await page.clock.install({ time: new Date('2026-10-10T12:00:00') });
  await page.clock.pauseAt(new Date('2026-10-10T12:00:01'));
  await page.goto(`${base}/?foe=default&stage=arena&weapon=${W}&foeWeapon=longsword&playerEdge=${mode}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await page.clock.runFor(200);
  await page.evaluate(async () => {
    const g = window.game;
    document.getElementById('btnStart').click();
    const { edgeAngleOf } = await import('/tools/sim/joint_range.mjs');
    const { Combat } = await import('/src/combat.js');
    window.__pe = { hits: [], frameHits: [], pad: null, held: false, moved: false };
    if (!Combat.prototype.__peWrapped) {
      Combat.prototype.__peWrapped = true;
      const strike = Combat.prototype.strike;
      Combat.prototype.strike = function (pr, point, passing) {
        const att = pr.w.fighter, vic = pr.v.fighter;
        const key = `${att.index}:${pr.v.part}`;
        const fresh = !vic.hitCooldowns.has(key);
        const S = att.cache?.sword;
        const r = strike.call(this, pr, point, passing);
        if (att === window.game.player && fresh && r && S && vic.hitCooldowns.has(key) && pr.w.part === 'blade' && att.weaponCfg.edged && r.type !== 'stab') {
          const ang = edgeAngleOf(S, r);
          if (ang != null) window.__pe.frameHits.push({ ang: +ang.toFixed(1), part: pr.v.part, J: +r.energy.toFixed(1), type: r.type, v: +r.speed.toFixed(2) });
        }
        return r;
      };
    }
    const wire = () => {
      const P = g.player;
      if (!P || P.__peWired) return;
      P.__peWired = true;
      if (g.ai) g.ai.update = () => {};
      const st = P.step.bind(P);
      P.step = (dt) => {
        const s = window.__pe;
        if (s.pad) P.handOffset.set(s.pad[0], s.pad[1]);
        P.handHeld = s.held;
        P.inputActive = s.moved;
        const d = P.foeDistance(); // 조이스틱 흉내: 칼 길이에 맞춰 다가가기 (시뮬 계기와 같은 꼴)
        P.move.set(0, d > window.__peDist + 0.1 ? 0.9 : d < window.__peDist - 0.25 ? -0.6 : 0);
        st(dt);
      };
    };
    window.__peDist = 0.55 + 0.65 * (g.player.weaponCfg.hiltLength + g.player.weaponCfg.bladeLength);
    window.__peWire = wire;
    wire();
    g.freeCam = true;
    const T = g.THREE;
    const cam = () => {
      const P = g.player;
      g.freeCam = true;
      if (P) {
        const c = P.bodies.chest.translation();
        const f = P.foe?.bodies?.chest?.translation?.() ?? { x: c.x + 1, y: c.y, z: c.z };
        const fw = new T.Vector3(f.x - c.x, 0, f.z - c.z).normalize();
        const side = new T.Vector3(-fw.z, 0, fw.x).multiplyScalar(P.side ?? 1);
        const mid = new T.Vector3((c.x + f.x) / 2, c.y, (c.z + f.z) / 2);
        g.camera.position.copy(mid).addScaledVector(side, 2.6).add(new T.Vector3(0, 0.25, 0));
        g.camera.up.set(0, 1, 0);
        g.camera.lookAt(mid.x, mid.y - 0.1, mid.z);
      }
      requestAnimationFrame(cam);
    };
    cam();
    const lab = document.createElement('div');
    lab.id = 'peLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;font:14px/1.35 sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:4px;white-space:pre';
    document.body.appendChild(lab);
  });
  for (let i = 0; i < 600; i++) {
    await page.clock.runFor(FRAME);
    const s = await page.evaluate(() => (window.__peWire(), window.game.state + '|' + (window.game.draw?.stage ?? '')));
    if (s.startsWith('fight')) break;
    if (s.startsWith('draw|choose')) await page.evaluate(() => document.querySelector('#draw .wcard[data-i="0"]')?.click());
  }
  await page.evaluate(() => { window.__peWire(); const P = window.game.player; window.__pe.pad = [P.handOffset.x, P.handOffset.y]; });
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas,#peLabel{visibility:visible!important}' });
  const hits = [];
  const shots = [];
  let fi = 0;
  let stroke = 0; // 대본 획 번호 (전·후 같은 획끼리 견준다)
  const frame = async (label) => {
    await page.clock.runFor(FRAME);
    const fh = await page.evaluate(() => { const h = window.__pe.frameHits; window.__pe.frameHits = []; return h; });
    for (const h of fh) {
      hits.push({ i: fi, stroke, label, ...h });
      const flat = h.ang > 45;
      if (shots.length < NSHOT * 6 && (!shootFlatOnly || flat)) {
        await page.evaluate((t) => (document.getElementById('peLabel').textContent = t), `${tag} (playerEdge=${mode}) · ${W} · 획 ${stroke} · 프레임 ${fi}\n날 각 ${h.ang}° ${flat ? '= 칼 면' : '= 날'} · ${h.part} · ${h.J} J · ${h.v} m/s`);
        const f = path.join(out, `player_edge_${tag}_${W}_${shots.length + 1}.png`);
        fs.writeFileSync(f, await page.screenshot());
        shots.push({ f, i: fi, stroke, ...h });
      }
    }
    fi++;
  };
  for (const [kind, a, speed] of SCRIPT) {
    if (kind === 'lift') {
      await page.evaluate(() => { const s = window.__pe; s.held = false; s.moved = false; s.pad = null; });
      for (let k = 0; k < a; k++) await frame('손 뗌');
      await page.evaluate(() => { const P = window.game.player; window.__pe.pad = [P.handOffset.x, P.handOffset.y]; });
      stroke++;
      continue;
    }
    for (;;) {
      const done = await page.evaluate(([tx, ty, sp, dt]) => {
        const s = window.__pe;
        const dx = tx - s.pad[0], dy = ty - s.pad[1], dd = Math.hypot(dx, dy), d = sp * dt;
        s.held = true;
        if (dd <= d) { s.pad = [tx, ty]; s.moved = dd > 1e-5; return true; }
        s.pad = [s.pad[0] + (dx / dd) * d, s.pad[1] + (dy / dd) * d];
        s.moved = true;
        return false;
      }, [a[0], a[1], speed, FRAME / 1000]);
      await frame('긋기');
      if (done) break;
    }
  }
  await page.close();
  return { hits, shots };
}

const B = await pass('off', 'before', false);
const C = await pass(ON, 'after', false);
const pct = (h) => (h.length ? +((100 * h.filter((x) => x.ang > 45).length) / h.length).toFixed(1) : null);
const rec = { weapon: W, on: ON, before: { hits: B.hits.length, flatPct: pct(B.hits), list: B.hits }, after: { hits: C.hits.length, flatPct: pct(C.hits), list: C.hits }, shots: [...B.shots, ...C.shots], errors };
fs.writeFileSync(path.join(out, `player_edge_shots_${W}.json`), JSON.stringify(rec, null, 1));
console.log(`player_edge_shots ${W} off vs ${ON}: 전 ${rec.before.hits} 맞음 칼 면 ${rec.before.flatPct}% · 후 ${rec.after.hits} 맞음 칼 면 ${rec.after.flatPct}% · 그림 ${rec.shots.length} · 콘솔 오류 ${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
