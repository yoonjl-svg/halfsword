// r39 확인표 28 — AI 찌르기 탭 앞 손가락 뗌(ai.js tapLineHold)을 재기만: r35/ai_tip_trace.mjs 를 그대로 돌리며 기다림마다 길이 · 상한에 걸림 · 그 사이 그 몸이 받은 상처를 적음
//  node ai_line_trace.mjs --root=<칸> --out=<폴더> --seeds=4001-4040 [--w=rapier,longsword] [--hon=0] [--tag=…]   (ai_tip_trace.mjs 의 인자 그대로 · 바탕 칸이면 tapLineHold 가 없어 기다림 기록이 비어 있음)
//  나옴: <out>/trace_<tag>.json (ai_tip_trace 그대로) · <out>/waits_<tag>.json [{ w, dur, end, hurt }]
//  dur · capWait 는 게임 초(실제 초 × TIME.k) · end = line(칼이 선에 옴) · cap(상한) · abort(공격이 접힘) · lost(끝을 못 봄 — 다른 길로 꼴이 바뀜) · hurt = 기다리는 동안 그 몸의 상처 수가 는 만큼
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const OUT = String(args.out ?? '.'); mkdirSync(OUT, { recursive: true });
const { AI } = await import(pathToFileURL(join(ROOT, 'src/ai.js')).href);
const waits = []; const open = new Map();
const closeOpen = (ai, why, dur) => { const r = open.get(ai); if (!r) return; open.delete(ai); r.dur = dur; r.end = why; r.hurt = (ai.me.wounds?.length ?? 0) - r.w0; delete r.w0; waits.push(r); };
let capWait = null;
if (AI.prototype.tapLineHold) {
  const cfg = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
  capWait = cfg.realS(cfg.AI_TAP_LINE.wait); // 게임 초 상한 — ai.js tapLineHold 와 같은 셈 (L.t 는 게임 초 · dur 도 게임 초)
  const o = AI.prototype.tapLineHold;
  AI.prototype.tapLineHold = function (dt) {
    const had = this.tapLine; const r = o.call(this, dt);
    if (!had && this.tapLine) { if (open.has(this)) closeOpen(this, 'lost', null); open.set(this, { w: this.me.weapon?.id ?? null, w0: this.me.wounds?.length ?? 0 }); }
    if (had && !this.tapLine) closeOpen(this, had.t >= capWait ? 'cap' : 'line', +had.t.toFixed(4));
    return r;
  };
  const oa = AI.prototype.abortAttack; AI.prototype.abortAttack = function (...x) { if (this.tapLine && open.has(this)) closeOpen(this, 'abort', +this.tapLine.t.toFixed(4)); return oa.apply(this, x); };
}
process.on('exit', () => { const tag = String(args.tag ?? 'run'); writeFileSync(join(OUT, `waits_${tag}.json`), JSON.stringify({ capWait, open: open.size, waits })); });
await import(pathToFileURL(resolve(new URL('../r35/ai_tip_trace.mjs', import.meta.url).pathname)).href);
