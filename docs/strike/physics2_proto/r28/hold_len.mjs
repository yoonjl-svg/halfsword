// r28 B1 — 탭 찌르기 '당김 머묾'(겨눔 끝에 손이 아직 칼 선 뒤로 가는 중이면 겨눈 채 머묾)이 얼마나 가나 · 왜 끝나나 (읽기만)
//  node hold_len.mjs --root=<나무 (B 가 든 칸)> --base=<바탕 gate json>[,…] [--seeds=4001-4020] [--json=파일]
//  장면: 지문 장면(씨앗 4801 · 가까운 · 간격 = 팔 닿음 + 0.11 − 0.2) 두 무기 + 관문 가까운 찌르기 사람 길 줄(씨앗 · 간격은 바탕 json 의 그 줄) 두 무기
//  칸: hold = 머묾 길이 (찌르기 시계 s — tp.chamberT 가 chamberDone 때 가진 값 · 머묾 없으면 0) · why = 끝난 까닭(speed: 손이 chamberV 밑 · twistEnd: 위팔이 범위 끝 띠 · cap: K.extend 다 참)
//      stepOk = 걸음을 내도 되는 때(탭부터 실제 초) · chFit = 당김 몫(fighter.drawFit · m) · ch = 원래 당김(m)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const { Skill } = await import(pathToFileURL(join(ROOT, 'src/skill.js')).href);
const { THRUST } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const M = makeMeasure(H); const DT = M.DT;
const [s0, s1] = String(args.seeds ?? '4001-4020').split('-').map(Number);
const base = String(args.base).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
let P = null, rec = null, step = 0;
const oU = Skill.prototype.updateThrust;
Skill.prototype.updateThrust = function (dt) { const tp = this.tap; const was = tp?.chamberDone; const r = oU.call(this, dt);
  if (this.f === P && tp && rec) { if (rec.chFit == null && tp.chFit !== undefined) { rec.chFit = tp.chFit; rec.high = this.aimRaw.y > THRUST.headPad; if (tp.line) rec.fit03 = this.f.drawFit(tp.h0, { x: tp.line[0], y: tp.line[1], z: tp.line[2] }, THRUST.driveChamber); } // fit03 = 몸 싣기 당김(driveChamber)을 높은 자세에도 줬다면 drawFit 이 허락했을 몫 (읽기 — 높은 자세 덧칸이 아직 필요한가)
    if (!was && tp.chamberDone && rec.hold == null) { rec.hold = tp.chamberT ?? 0; rec.why = this.f.twistEnd ? 'twistEnd' : (tp.chamberT ?? 0) > tp.K.extend ? 'cap' : 'speed'; }
    if (tp.stepOk && rec.stepOk == null) rec.stepOk = step * DT; }
  return r; };
const runs = [];
const REACH = { rapier: 1.791, longsword: 1.701 };
for (const w of ['rapier', 'longsword']) runs.push({ name: `fp4801 ${w}`, seed: 4801, w, gap: REACH[w] + 0.11 - 0.2, pg: undefined });
for (let s = s0; s <= s1; s++) for (const w of ['rapier', 'longsword']) { const r = base.find((x) => x.seed === s && x.scene === 'near' && x.path === 'human' && x.weapon === w); if (r) runs.push({ name: `${s} ${w}`, seed: s, w, gap: r.gap, pg: r.gap, baseTip: r.tipPk }); }
const out = [];
for (const u of runs) { rec = { hold: null, why: null, stepOk: null, chFit: null, high: null, fit03: null }; step = 0;
  M.runThrust(u.seed, u.w, { gap: u.gap, pelvisGap: u.pg, post: 1.0, raw: true, onTap: (G, Pl) => { P = Pl; }, onStep: () => { step++; } });
  out.push({ ...u, ...rec }); console.log(`${u.name.padEnd(16)} hold ${rec.hold == null ? '-' : rec.hold.toFixed(3)} s · ${rec.why ?? '-'} · stepOk ${rec.stepOk == null ? '-' : rec.stepOk.toFixed(3)} s · chFit ${rec.chFit == null ? '-' : rec.chFit.toFixed(2)} m${rec.high ? ` · 높은 자세 (fit0.3 ${rec.fit03?.toFixed(2)})` : ''}${u.baseTip > 8 ? ' (바탕 휘둘림 줄)' : ''}`); P = null; }
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
for (const w of ['rapier', 'longsword']) { const g = out.filter((r) => r.w === w && r.seed !== 4801); const why = {}; g.forEach((r) => (why[r.why] = (why[r.why] ?? 0) + 1));
  console.log(`${w} 관문 ${g.length} 줄: 머묾 가운데 ${med(g.map((r) => r.hold)).toFixed(3)} s · 가장 긺 ${Math.max(...g.map((r) => r.hold ?? 0)).toFixed(3)} s · 머묾 0 인 줄 ${g.filter((r) => !(r.hold > 0)).length} · 끝난 까닭 ${JSON.stringify(why)} · stepOk 가운데 ${med(g.map((r) => r.stepOk)).toFixed(3)} s`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
