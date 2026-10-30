// 낸 비기 하나하나의 결과 (맞힘 · 자리 · 상처 · 맞은 뒤 1 s · 3 s 안 죽음 · 막힘 · 미끄러짐 · 맞기까지 시간) — 다른 도구를 감싸서 돌림 (읽기만)
//  SET='{"risolutoShare":0.7}' (SECRET 칸) node tools/sim/secret_kill.mjs <도구> [인자…]   · 줄은 표준 오류로 · KILL_JSON=파일 이면 낸 것마다 한 줄
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { Skill } from '../../src/skill.js';
import { SECRET, TIME } from '../../src/config.js';
import { bladesTouch } from '../../src/secret.js';
import { coverDist } from '../../src/italian_risoluto.js';
if (process.env.SET) Object.assign(SECRET, JSON.parse(process.env.SET));
const K = TIME.k;
const recs = [];
const live = [];
const clock = (f) => f?.stamina?.time ?? 0;
const sec0 = Skill.prototype.secret;
Skill.prototype.secret = function (o) {
  const ok = sec0.call(this, o);
  if (ok) {
    const f = this.f;
    const foe = f.foe;
    const r = { name: o?.S?.name ?? '?', who: f.aiControlled ? 'AI' : '사람', f, foe, run: this.sec, t0: clock(f), w0: foe?.wounds?.length ?? 0, pain0: foe?.pain ?? 0, wounds: [], hitT: null, endT: null, deadT: null, res: null, alive0: !!foe?.alive, d0: f.foeDistance?.() ?? null, decap0: !!foe?.decapitated, decap: false, touch0: !!(foe && bladesTouch(f, foe)), cover0: foe ? coverDist(f, foe) : null, cutT: null, blockT: null, glideSteps: 0 };
    recs.push(r);
    live.push(r);
  }
  return ok;
};
const up0 = Skill.prototype.update;
Skill.prototype.update = function (dt) {
  const out = up0.call(this, dt);
  const f = this.f;
  for (let i = live.length - 1; i >= 0; i--) {
    const r = live[i];
    if (r.f !== f) continue;
    const now = clock(f);
    const foe = r.foe;
    const running = this.sec === r.run;
    const I = f.iai;
    if (running && I?.kind === 'combo') {
      if (r.tCut0 == null && I.segs?.length) {
        let t = I.segT0 ?? 0;
        for (const sg of I.segs) {
          if (sg.cut) break;
          t += sg.T;
        }
        r.tCut0 = t; // 찌르는 토막이 시작하는 때 (연환 시계 I.t)
      }
      if (r.cutT == null && I.cutting) r.cutT = now;
      if (r.blockT == null && I.blockM) {
        r.blockT = now;
        r.blockI = I.t;
      }
      r.glideSteps = I.glided ?? r.glideSteps;
      if (r.offT == null && I.glideOff) r.offT = now; // 붙은 칼에서 떨어진 때 (미끄러짐 끝)
    }
    if (r.endT == null && !running) {
      r.endT = now;
      r.res = f.instantResult ? { ...f.instantResult } : null;
    }
    // 이 비기가 도는 동안(+ 끝 뒤 0.05 s) 상대에게 생긴 상처
    if (r.endT == null || now - r.endT <= 0.05) {
      const W = foe?.wounds ?? [];
      while (r.w0 + r.wounds.length < W.length) r.wounds.push(W[r.w0 + r.wounds.length]);
      if (r.hitT == null && (r.wounds.length || (foe?.pain ?? 0) > r.pain0 + 0.05 || !foe?.alive)) r.hitT = now;
    }
    if (r.deadT == null && foe && !foe.alive) r.deadT = now;
    if (foe?.decapitated && !r.decap0) r.decap = true; // 참수 (fighter.decapitated — 낸 뒤 생긴 것만)
    const ref = r.hitT ?? r.t0;
    if (r.endT != null && now - ref > 3.3) live.splice(i, 1);
  }
  return out;
};
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], resolve(script), ...rest];
process.on('exit', () => {
  const by = {};
  for (const r of recs) (by[`${r.who}|${r.name}`] ??= []).push(r);
  const q = (a, p) => { const s = [...a].filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  const pc = (n, d) => `${n} (${d ? Math.round((100 * n) / d) : 0} %)`;
  const lines = ['| 누구 | 비기 | 낸 수 | 맞힘 | 자리 | 상처 심각도 합 p50 · 평균 (맞힘) | 맞은 뒤 1 s 안 죽음 | 3 s 안 죽음 | 막힘 | 붙은 칼 미끄러짐 | 낸 때 → 맞음 실제 s p50 | 동작 실제 s p50 | 낸 때 가슴 사이 p50 | 낸 때 칼 닿음 | 막힘 가운데 찌름 시작 0.05 s 안 | 막힘 가운데 낸 때 칼 닿음 |'];
  for (const [k, R] of Object.entries(by)) {
    const [who, name] = k.split('|');
    const hitOf = (r) => !!(r.res?.hit || r.wounds.some((w) => w.severity > 0) || (r.hitT != null && r.hitT - r.t0 < 2));
    const H = R.filter(hitOf);
    const zones = {};
    for (const r of H) {
      const z = r.res?.zone ?? r.res?.part ?? [...r.wounds].sort((a, b) => b.severity - a.severity)[0]?.part ?? '?';
      zones[z] = (zones[z] ?? 0) + 1;
    }
    const sev = H.map((r) => r.wounds.reduce((a, w) => a + w.severity, 0));
    const ref = (r) => r.hitT ?? r.t0;
    const d1 = H.filter((r) => r.deadT != null && r.deadT - ref(r) <= 1 * K).length;
    const d3 = H.filter((r) => r.deadT != null && r.deadT - ref(r) <= 3 * K).length;
    const blk = R.filter((r) => r.res?.blocked).length;
    const gl = R.filter((r) => (r.res?.glided ?? 0) > 0).length;
    const B = R.filter((r) => r.res?.blocked);
    const early = B.filter((r) => r.blockI != null && r.tCut0 != null && r.blockI - r.tCut0 <= 0.05 * K).length;
    const bt = B.filter((r) => r.touch0).length;
    lines.push(`| ${who} | ${name} | ${R.length} | ${pc(H.length, R.length)} | ${JSON.stringify(zones)} | ${f2(q(sev, 0.5))} · ${f2(sev.reduce((a, b) => a + b, 0) / Math.max(1, sev.length))} | ${pc(d1, H.length)} | ${pc(d3, H.length)} | ${pc(blk, R.length)} | ${pc(gl, R.length)} | ${f2(q(H.map((r) => (r.hitT - r.t0) / K), 0.5))} | ${f2(q(R.map((r) => (r.res?.T ?? NaN) / K), 0.5))} | ${f2(q(R.map((r) => r.d0), 0.5))} | ${pc(R.filter((r) => r.touch0).length, R.length)} | ${pc(early, B.length)} | ${pc(bt, B.length)} |`);
  }
  process.stderr.write(`\n[SET ${process.env.SET ?? '-'}]\n` + lines.join('\n') + '\n');
  if (process.env.KILL_JSON) fs.writeFileSync(process.env.KILL_JSON, recs.map((r) => JSON.stringify({ who: r.who, name: r.name, t0: r.t0 / K, hitT: r.hitT != null ? r.hitT / K : null, deadT: r.deadT != null ? r.deadT / K : null, sev: r.wounds.reduce((a, w) => a + w.severity, 0), wounds: r.wounds.map((w) => [w.part, w.type, +w.severity.toFixed(2)]), touch0: r.touch0, cover0: r.cover0, cutT: r.cutT != null ? (r.cutT - r.t0) / K : null, blockT: r.blockT != null ? (r.blockT - r.t0) / K : null, blockIntoCut: r.blockI != null && r.tCut0 != null ? (r.blockI - r.tCut0) / K : null, offT: r.offT != null ? (r.offT - r.t0) / K : null, decap: r.decap, res: r.res && { hit: r.res.hit, zone: r.res.zone, part: r.res.part, blocked: r.res.blocked, glided: r.res.glided, E: r.res.energy, T: r.res.T, tipV: r.res.tipV }, d0: r.d0 })).join('\n'));
});
await import(pathToFileURL(resolve(script)).href);
