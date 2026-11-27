// r30 부탁 런지 장면 + 심판(honesty.mjs) 붙임. legs_battery.mjs reqlunge 를 본뜬 것 (같은 newRound · park · 자리 잡기 2.0 + 0.11 v s · 1.6 s 마다 lunge 부탁 { fwd 0.6 · duration 0.4 · accel } ·
//  부탁 앞뒤 0.3 s 조종 1 · 그 밖 0.45 · 10 s · 넘어지면 멈춤). 다른 점: 자리 잡기 중 가슴 살짝 치기(hitChest)는 안 함 · 씨앗 수는 이 파일의 것.
//  node v3_reqlunge.mjs [--n=2] [--weapon=longsword] [--root=<나무>]   (심판 요약 줄을 찍음)
import { pathToFileURL } from 'node:url';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const Hn = await import(u('tools/sim/honesty.mjs'));
const N = +(args.n ?? 2), WEAPON = String(args.weapon ?? 'longsword'), DT = H.DT;
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };
const rng = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let v = 0; v < N; v++) {
  const G = H.newRound({ walls: false, weapon: WEAPON, seed: 100 + v }); G.park();
  const P = G.player, R = rng(1000 + v * 7919);
  const settle = Math.round((2.0 + 0.11 * v) / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); G.step(); }
  const L = Hn.attach(G.world, bodiesOf(P), { fighter: P }); Hn.hook(G, [L]);
  const ph = 0.4 + 0.8 * R(); let nReq = -1, ok = 0, fell = null;
  for (let i = 0; i < Math.round(10 / DT); i++) {
    const t = i * DT, k = (t - ph) / 1.6, near = Math.abs(k - Math.round(k)) * 1.6 < 0.3 && t > ph - 0.3;
    P.move.set(0, near ? 1 : 0.45);
    if (t >= ph && Math.floor((t - ph) / 1.6) !== nReq) { nReq = Math.floor((t - ph) / 1.6); if (P.gait?.requestStep?.({ kind: 'lunge', fwd: 0.6, duration: 0.4, accel: true })) ok++; }
    G.step();
    if (['down', 'getup', 'dead', 'kneel'].includes(P.state)) { fell = +t.toFixed(2); break; }
  }
  console.log(Hn.report(`reqlunge · ${WEAPON} · v${v} (받은 부탁 ${ok} · ${fell == null ? '안 넘어짐' : '넘어짐 ' + fell + ' s'})`, L.summary()));
  console.log('');
}
