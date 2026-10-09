// 칼 팔 관절 가동 범위 전/후 그림 (docs/motion/joint_range_2026-10-09.md): 실제 게임 화면에서 같은 손가락 길(분노의 베기 → 세로 → 왼쪽 위 → 오른쪽 아래)을
//  관절 교정 끔(?joints=off)과 켬(?joints=<mode>)으로 똑같이 그어, 끔에서 범위를 가장 크게 벗어난 순간들을 같은 프레임 번호로 두 번 찍는다.
//  시간은 playwright 가짜 시계로 한 프레임(17 ms)씩 → 두 번의 실행이 같은 프레임에서 같은 손가락 자리다. 상대는 가만히 선다(AI 멈춤).
//  카메라: 칼 든 쪽 옆에서 (매 프레임 따라감). 각은 tools/sim/joint_range.mjs armAngles 를 그대로 부른다.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/joint_shots.mjs http://127.0.0.1:5173 <출력 폴더> [무기=longsword] [켬 모드=anat] [장 수=4]
//   출력: <폴더>/joint_range_before_<n>.png · joint_range_after_<n>.png · joint_shots.json (프레임마다 각)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '.';
const W = process.argv[4] || 'longsword';
const ON = process.argv[5] || 'anat';
const NSHOT = +(process.argv[6] || 4);
fs.mkdirSync(out, { recursive: true });
const FRAME = 17; // ms
const G = { tagR: [0.42, 0.42], tagL: [-0.4, 0.42], wechselL: [-0.4, -0.42], wechselR: [0.38, -0.44], nebenR: [0.55, -0.26], mid: [0.12, 0.14], midL: [-0.1, 0.14] };
// 손가락 길 (패드 점들): 오른쪽 위 → 왼쪽 아래(분노의 베기), 왼쪽 위로 들고 → 오른쪽 아래, 옆으로 → 다시 오른쪽 위. 사이사이 멈춤(프레임 수)
const SCRIPT = [
  ['hold', 70],
  ['go', [G.mid, G.wechselL], 5],
  ['hold', 30],
  ['go', [G.tagL], 3],
  ['hold', 20],
  ['go', [G.midL, G.wechselR], 5],
  ['hold', 30],
  ['go', [G.nebenR, G.tagR], 3],
  ['hold', 20],
  ['go', [G.mid, G.wechselL], 5],
  ['hold', 40],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];

async function pass(mode, shotAt, tag) {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  await page.clock.install({ time: new Date('2026-10-09T12:00:00') });
  await page.clock.pauseAt(new Date('2026-10-09T12:00:01'));
  await page.goto(`${base}/?foe=default&stage=arena&weapon=${W}&foeWeapon=longsword&joints=${mode}`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
  await page.clock.runFor(200);
  await page.evaluate(async (from) => {
    const g = window.game;
    document.getElementById('btnStart').click();
    const { armAngles } = await import('/tools/sim/joint_range.mjs');
    window.__jr = { rows: [], from };
    window.__pad = from.slice();
    const wire = () => {
      const P = g.player;
      if (!P || P.__jrWired) return;
      P.__jrWired = true;
      if (g.ai) g.ai.update = () => {}; // 상대는 가만히
      const st = P.step.bind(P);
      P.step = (dt) => {
        P.handOffset?.set?.(window.__pad[0], window.__pad[1]);
        P.skill.aimRaw?.set?.(window.__pad[0], window.__pad[1]);
        st(dt);
        window.__jr.last = armAngles(P);
      };
    };
    window.__jrWire = wire;
    wire();
    // 카메라: 칼 든 쪽 옆
    g.freeCam = true;
    const T = g.THREE;
    const cam = () => {
      const P = g.player;
      g.freeCam = true; // 판이 시작되며 풀려도 매 프레임 다시
      if (P) {
        const c = P.bodies.chest.translation();
        const fw = P.forward(new T.Vector3());
        const side = new T.Vector3(fw.z, 0, -fw.x); // 칼 든 쪽 (탐침: (−fw.z, 0, fw.x) 는 빈팔 쪽이었다)
        g.camera.position.set(c.x, c.y, c.z).addScaledVector(side, 2.2).addScaledVector(fw, 0.45).add(new T.Vector3(0, 0.1, 0));
        g.camera.up.set(0, 1, 0);
        g.camera.lookAt(c.x + fw.x * 0.45, c.y - 0.05, c.z + fw.z * 0.45);
      }
      requestAnimationFrame(cam);
    };
    cam();
    const lab = document.createElement('div');
    lab.id = 'jrLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;font:14px/1.35 sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:6px 8px;border-radius:4px;white-space:pre';
    document.body.appendChild(lab);
  }, G.tagR);
  // 판이 시작될 때까지 (카드 뽑기가 뜨면 첫 장)
  for (let i = 0; i < 600; i++) {
    await page.clock.runFor(FRAME);
    const s = await page.evaluate(() => (window.__jrWire(), window.game.state + '|' + (window.game.draw?.stage ?? '')));
    if (s.startsWith('fight')) break;
    if (s.startsWith('draw|choose')) await page.evaluate(() => document.querySelector('#draw .wcard[data-i="0"]')?.click());
  }
  await page.evaluate(() => window.__jrWire());
  await page.addStyleTag({ content: 'body *{visibility:hidden!important} canvas,#jrLabel{visibility:visible!important}' }); // 화면 글자(HUD)를 숨긴다
  const rows = [];
  let fi = 0;
  const shots = [];
  const frame = async (label) => {
    await page.clock.runFor(FRAME);
    const a = await page.evaluate(() => window.__jr.last);
    rows.push({ i: fi, label, ...(a ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(1) : v])) : {}) });
    if (shotAt?.includes(fi)) {
      const r = rows[rows.length - 1];
      const n = shotAt.indexOf(fi) + 1;
      await page.evaluate((t) => (document.getElementById('jrLabel').textContent = t), `${tag} · ${W} · 프레임 ${fi} (${label})\n팔꿈치 ${r.elbow}° · 위팔 돌림 ${r.shRot ?? '-'}° (명령과 ${r.twistLag ?? '-'}° 어긋남)\n손목 굽힘·폄 ${r.wristFE ?? '-'}° · 아래팔-칼 ${r.wrist ?? '-'}°`);
      const f = path.join(out, `joint_range_${tag}_${n}.png`);
      fs.writeFileSync(f, await page.screenshot());
      shots.push(f);
    }
    fi++;
  };
  for (const [kind, a, speed] of SCRIPT) {
    if (kind === 'hold') {
      for (let k = 0; k < a; k++) await frame('멈춤');
      continue;
    }
    const q = a.map((p) => p.slice());
    while (q.length) {
      let d = (speed * FRAME) / 1000;
      const pad = await page.evaluate(() => window.__pad);
      while (d > 0 && q.length) {
        const [tx, ty] = q[0];
        const dx = tx - pad[0], dy = ty - pad[1], dd = Math.hypot(dx, dy);
        if (dd <= d) (pad[0] = tx), (pad[1] = ty), q.shift(), (d -= dd);
        else (pad[0] += (dx / dd) * d), (pad[1] += (dy / dd) * d), (d = 0);
      }
      await page.evaluate((p) => (window.__pad = p), pad);
      await frame('긋기');
    }
  }
  await page.close();
  return { rows, shots };
}

// 1) 끔으로 한 번: 범위를 가장 크게 벗어난 순간 고르기
const A = await pass('off', null, 'probe');
const bad = (r) => Math.max((r.twistLag ?? 0) - 45, Math.abs(r.wristFE ?? 0) - 70, -(r.elbow ?? 0) - 5, (r.shRot ?? 0) - 90, -70 - (r.shRot ?? 0), 10 - (r.elbow ?? 90));
const cand = A.rows.filter((r) => r.i > 60).map((r) => ({ i: r.i, b: bad(r) })).sort((x, y) => y.b - x.b);
const pick = [];
for (const c of cand) if (pick.length < NSHOT && c.b > 0 && pick.every((p) => Math.abs(p - c.i) > 12)) pick.push(c.i);
pick.sort((x, y) => x - y);
// 2) 같은 프레임에서 끔·켬을 찍는다
const B = await pass('off', pick, 'before');
const C = await pass(ON, pick, 'after');
const sum = (rows) => {
  const n = rows.length;
  const c = (f) => rows.filter(f).length;
  return { frames: n, twistLag45: c((r) => (r.twistLag ?? 0) > 45), wristFE70: c((r) => Math.abs(r.wristFE ?? 0) > 70), shRotOut: c((r) => r.shRot != null && (r.shRot < -70 || r.shRot > 90)), straight10: c((r) => (r.elbow ?? 90) < 10), maxTwistLag: Math.max(...rows.map((r) => r.twistLag ?? 0)) };
};
const rec = { weapon: W, on: ON, picked: pick, probeSameAsBefore: JSON.stringify(A.rows) === JSON.stringify(B.rows), before: sum(B.rows), after: sum(C.rows), shots: [...B.shots, ...C.shots], errors, rows: { before: B.rows, after: C.rows } };
fs.writeFileSync(path.join(out, 'joint_shots.json'), JSON.stringify(rec, null, 1));
console.log(`joint_shots ${W} 끔 vs ${ON}: 고른 프레임 ${pick.join(', ')} · 끔 다시 그어도 같음 ${rec.probeSameAsBefore}`);
console.log(`  끔: ${JSON.stringify(rec.before)}`);
console.log(`  켬: ${JSON.stringify(rec.after)}`);
console.log(`  그림 ${rec.shots.length} 장 · 콘솔 오류 ${errors.length}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
