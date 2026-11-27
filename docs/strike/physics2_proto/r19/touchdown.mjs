// r19 Q4: 디딘 뒤 첫 4 스텝의 땅 힘 — (가) 그대로 돌린 스텝 기록에서 디딤마다 셈 · (나) 고른 디딤을 다시 돌리며 그 다리 세 관절 모터 감쇠를 그 4 스텝만 0 으로.
//  node touchdown.mjs <step.jsonl> --root=<나무> --scene=hop --weapon=longsword [--k=10] [--who=P]
//  다시 돌리기 = 같은 도구를 같은 판(--variants=<wid>)으로 처음부터 결정적으로 되풀이(probe R19_ZD_STEP · R19_STOP) — 디딘 스텝 앞까지는 비트까지 같다(대조 R19_ZD_OFF 로 확인).
//  땅 힘 = 몸 전체 운동량으로 잰 접촉 수직 힘 fyM (run_scenes 의 fyPeakBW 와 같은 셈) ÷ 몸무게 · 발마다 = 엔진 접촉 충격량(fyF · fyB — 평균이 16 % 쯤 크게 나옴 · 디딤 판정에만 씀)
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const PROBE = new URL('./probe.mjs', import.meta.url).href;
const L = readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse).filter((l) => (l.who ?? 'P') === (args.who ?? 'P'));
const byW = {}; for (const l of L) (byW[l.wid ?? 0] ||= []).push(l);
const tds = [];
for (const [wid, A] of Object.entries(byW)) {
  const at = new Map(A.map((l) => [l.s, l]));
  for (const k of ['F', 'B']) {
    let on = false;
    for (const l of A) {
      const fy = k === 'F' ? l.fyF : l.fyB, now = fy > 0.03;
      if (now && !on && l.run) {
        const w = [0, 1, 2, 3].map((i) => at.get(l.s + i)).filter(Boolean);
        if (w.length === 4) tds.push({ wid: +wid, k, s: l.s, fyM: w.map((x) => x.fyM), foot: w.map((x) => (k === 'F' ? x.fyF : x.fyB)), N: w.map((x) => x.N), other: w.map((x) => (k === 'F' ? x.fyB : x.fyF)) });
      }
      on = now;
    }
  }
}
const pk = (a) => Math.max(...a);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
console.log(`(가) 뛰는 동안 디딤 ${tds.length} 번 — 첫 4 스텝 몸 전체 접촉 수직 힘 최고 ÷ 몸무게: 중앙 ${q(tds.map((t) => pk(t.fyM)), 0.5).toFixed(2)} · 90 % ${q(tds.map((t) => pk(t.fyM)), 0.9).toFixed(2)} · 최고 ${pk(tds.map((t) => pk(t.fyM))).toFixed(2)} · 2.4 넘은 디딤 ${tds.filter((t) => pk(t.fyM) > 2.4).length}`);
const atStep = [0, 1, 2, 3].map((i) => q(tds.map((t) => t.fyM[i]), 0.5).toFixed(2));
console.log(`   스텝별 중앙값 (디딘 스텝 0 ~ 3): ${atStep.join(' · ')} · 최고가 든 스텝 몫: ${[0, 1, 2, 3].map((i) => (100 * tds.filter((t) => t.fyM.indexOf(pk(t.fyM)) === i).length / tds.length).toFixed(0) + '%').join(' · ')}`);
const hasN = tds.some((t) => t.N.some((x) => x != null));
if (hasN) console.log(`   시킨 수직 힘(legDrive.dbg.N ÷ 몸무게) 첫 4 스텝 최고: 중앙 ${q(tds.map((t) => pk(t.N.map((x) => x ?? 0))), 0.5).toFixed(2)} · 최고 ${pk(tds.map((t) => pk(t.N.map((x) => x ?? 0)))).toFixed(2)}`);
// (나) 다시 돌리기
const K = +(args.k ?? 10);
const pick = [...tds].sort((a, b) => pk(b.fyM) - pk(a.fyM)).slice(0, K);
const replay = (t, off) => {
  const out = `/tmp/r19_td_${process.pid}.jsonl`; if (existsSync(out)) rmSync(out);
  const env = { ...process.env, R19_ROOT: args.root, R19_NOAB: '1', R19_STEPLOG: out, R19_ZD_STEP: String(t.s), R19_ZD_LEG: t.k, R19_ZD_N: '4', R19_STOP: String(t.s + 5) };
  if (off) env.R19_ZD_OFF = '1';
  if (args.all) env.R19_ZD_ALL = '1';
  spawnSync(process.execPath, ['--import', PROBE, 'tools/sim/run_scenes.mjs', `--scene=${args.scene ?? 'hop'}`, `--variants=${t.wid}`, `--weapon=${args.weapon ?? 'longsword'}`, '--quiet'], { cwd: args.root, env, stdio: ['ignore', 'ignore', 'ignore'] });
  const R = existsSync(out) ? readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse).filter((l) => (l.who ?? 'P') === 'P') : [];
  rmSync(out, { force: true });
  const at = new Map(R.map((l) => [l.s, l]));
  return [0, 1, 2, 3].map((i) => at.get(t.s + i)?.fyM ?? NaN);
};
console.log(`\n(나) 땅 힘이 가장 큰 디딤 ${pick.length} 번: 그 다리(엉덩이 · 무릎 · 발목) 모터 감쇠 = 0 (디딘 스텝부터 4 스텝) — 첫 4 스텝 접촉 수직 힘 ÷ 몸무게`);
console.log('판 발 스텝   그대로(기록)              대조(다시 · 감쇠 그대로)    감쇠 0                    최고 그대로 → 감쇠 0');
const rows = [];
for (const t of pick) {
  const ctl = replay(t, true), zd = replay(t, false);
  const same = ctl.every((v, i) => Math.abs(v - t.fyM[i]) < 1e-3);
  rows.push({ a: pk(t.fyM), z: pk(zd) });
  console.log(`${String(t.wid).padStart(2)}  ${t.k}  ${String(t.s).padStart(5)}  ${t.fyM.map((x) => x.toFixed(2)).join(' ').padEnd(24)} ${ctl.map((x) => x.toFixed(2)).join(' ').padEnd(24)}${same ? '=' : '≠'} ${zd.map((x) => x.toFixed(2)).join(' ').padEnd(24)} ${pk(t.fyM).toFixed(2)} → ${pk(zd).toFixed(2)}`);
}
const m = (a) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`평균 첫 4 스텝 최고: 그대로 ${m(rows.map((r) => r.a)).toFixed(2)} · 감쇠 0 ${m(rows.map((r) => r.z)).toFixed(2)}`);
