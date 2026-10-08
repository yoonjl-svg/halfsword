// 무기 검사 묶음 — 무기 추가·유파 변경 때의 영수증 (검술 보정 v2 확장 ① 구조 뼈대, 10/8 — docs/strike/sword_art_layers_design_2026-10-08.md §5·§13)
//   node tools/sim/weapon_check.mjs <무기id> [--quick] [--n=24] [--jobs=4] [--detail]
//  설계서 §5 의 7 검사 중 지금 도구로 바로 되는 것을 한 명령으로 묶어 표를 찍는다. 문턱값은 넣지 않는다(비교란) — 후보는 확인표에서.
//   1 14 자세 닿기    motion_lab poses <무기>  — 자세마다 손·칼끝이 목표에서 떨어진 거리 (라이브러리 표 = 본판, 1.0~1.4 s 평균)
//   2 베는 길 모양    TODO — 8 베기 줄을 롱소드 기준과 겹쳐 모양 오차 (규칙 1: 패드 자리 = 베는 길 경유점, 옮기면 길이 휜다)
//   3 베기 힘·속도    motion_lab swings <무기> — 기술별 칼날 70% 최고 속도·베기 지표 J (AI 보통 손 빠르기 11 m/s)
//   4 날 맞춤 성공률  TODO — 보정 ① 이 켜진 베기 중 닿을 때 날이 선 비율
//   5 결투            motion_lab duel <무기> <n> main — 롱소드 AI 상대, 자리 바꿔 n+n 판 (본판 길: 라이브러리 켬, 생성자가 입힘)
//   6 안전            weapon_smoke 의 그 무기 줄(예외·NaN) + 롱소드 기준선 셋(fights12·live_battery·finish_thrust 1 --stand)이 기준 sha 와 같은지
//   7 겉모습          TODO — 쥠 손·자세 4 장면 스크린샷 (사람 눈; 비슷한 것: tools/browser/motion_gallery.mjs)
//  --quick: 5(결투)와 6 의 기준선 셋을 건너뛴다(1·3·스모크만, 1 분 안쪽). 하위 도구는 node 로 따로 돌려(--jobs 동시) 결과 글만 읽는다
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEAPONS } from '../../src/weapons.js';
import { resolveSwordArt } from '../../src/sword_art.js';

// 롱소드 기준선 sha256 앞 8 자리 — tools/sim/README.md 관문 줄(10/8 19:05 동작 라이브러리 본판 켬 · 18:30 일어서기)과 같이 고친다
const BASELINE = { fights12: '578402e1', live_battery: 'c2072cd1', finish_thrust: 'd65cc1df' };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const quick = args.includes('--quick');
const N = +opt('n', 24);
const JOBS = Math.max(1, +opt('jobs', 4));
if (!id || !WEAPONS[id]) {
  console.log(`쓰는 법: node tools/sim/weapon_check.mjs <무기id> [--quick] [--n=24] [--jobs=4] [--detail]\n무기: ${Object.keys(WEAPONS).join(' ')}`);
  process.exit(id ? 1 : 0);
}

/** node 스크립트 하나를 저장소 루트에서 돌려 stdout 을 모은다 */
function run(script, scriptArgs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join('tools/sim', script), ...scriptArgs], { cwd: ROOT });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ out, err, code, sec: (Date.now() - t0) / 1000, cmd: `node tools/sim/${script} ${scriptArgs.join(' ')}`.trim() }));
  });
}
/** 동시 JOBS 개까지 */
async function pool(tasks) {
  const res = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      res[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker));
  return res;
}
const sha8 = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8);
const tableRows = (out) => out.split('\n').filter((l) => /^\| [^-]/.test(l) && !/^\| (패드|기술) \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);

const art = resolveSwordArt(WEAPONS[id]);
const t0 = Date.now();
const jobs = {
  poses: () => run('motion_lab.mjs', ['poses', id]),
  swings: () => run('motion_lab.mjs', ['swings', id]),
  smoke: () => run('weapon_smoke.mjs', []),
};
if (!quick) {
  jobs.duel = () => run('motion_lab.mjs', ['duel', id, String(N), 'main']);
  jobs.fights12 = () => run('fights12.mjs', []);
  jobs.live_battery = () => run('live_battery.mjs', []);
  jobs.finish_thrust = () => run('finish_thrust.mjs', ['1', '--stand']);
}
const names = Object.keys(jobs);
const done = Object.fromEntries((await pool(names.map((k) => jobs[k]))).map((r, i) => [names[i], r]));

const lines = [];
const row = (no, what, result, r) => lines.push(`| ${no} | ${what} | ${result} | ${r ? `${r.sec.toFixed(0)} s` : '-'} | ${r ? `\`${r.cmd}\`` : '-'} |`);

// 1 · 14 자세 닿기
{
  const r = done.poses;
  const rows = tableRows(r.out).filter((c) => c.length === 7);
  const hand = rows.map((c) => +c[5]);
  const ang = rows.map((c) => +c[6]);
  const wi = hand.indexOf(Math.max(...hand));
  const wa = ang.indexOf(Math.max(...ang));
  row(1, '14 자세 닿기 (본판 표)', rows.length ? `손 평균 ${mean(hand).toFixed(1)} cm · 최대 ${hand[wi].toFixed(1)} cm (${rows[wi][4]}) · 칼끝 평균 ${mean(ang).toFixed(1)}° · 최대 ${ang[wa].toFixed(1)}° (${rows[wa][4]}) — ${rows.length} 자세` : `읽지 못함 (종료 ${r.code})`, r);
}
row(2, '베는 길 모양', 'TODO — 8 베기 줄 × 롱소드 기준 겹침 오차 (도구 없음)', null);
// 3 · 베기 힘·속도
{
  const r = done.swings;
  const rows = tableRows(r.out).filter((c) => c.length === 8);
  const cut = rows.filter((c) => c[1] === 'cut');
  const thr = rows.filter((c) => c[1] === 'thrust');
  const top = rows.slice().sort((a, b) => +b[5] - +a[5])[0];
  const fmt = (g, nm) => (g.length ? `${nm} ${g.length} 개 최고 속도 평균 ${mean(g.map((c) => +c[4])).toFixed(1)} m/s · J 평균 ${mean(g.map((c) => +c[5])).toFixed(0)}` : `${nm} 없음`);
  row(3, '베기 힘·속도', rows.length ? `${fmt(cut, '베기')} · ${fmt(thr, '찌르기')} · 가장 센 것 ${top[0]} ${top[4]} m/s ${top[5]} J` : `읽지 못함 (종료 ${r.code})`, r);
}
row(4, '날 맞춤 성공률', 'TODO — 보정 ① 켜진 베기 중 닿을 때 날 선 비율 (도구 없음)', null);
// 5 · 결투
if (done.duel) {
  const r = done.duel;
  const m = r.out.match(/승 (\d+) 패 (\d+) 무 (\d+) \/ (\d+) · 승률 (\d+)% \(95% (\d+)%~(\d+)%\)[^N]*NaN (\d+)/);
  row(5, `결투 (롱소드 상대 ${2 * N} 판, 본판)`, m ? `승 ${m[1]} · 패 ${m[2]} · 무 ${m[3]} / ${m[4]} — 승률 ${m[5]} % (95 % ${m[6]}~${m[7]} %) · NaN ${m[8]}` : `읽지 못함 (종료 ${r.code})`, r);
} else row(5, '결투', '건너뜀 (--quick)', null);
// 6 · 안전
{
  const r = done.smoke;
  const l = r.out.split('\n').find((x) => x.startsWith(id.padEnd(16)) || x.startsWith(`${id} `));
  const ok = l && / OK /.test(l) && /nan=false/.test(l);
  row('6a', '안전: 스모크 (6 s, 예외·NaN)', l ? `${ok ? '통과' : '실패'} — ${l.replace(/\s+/g, ' ').trim()}` : `줄 없음 (종료 ${r.code})`, r);
  for (const k of ['fights12', 'live_battery', 'finish_thrust']) {
    const b = done[k];
    if (!b) {
      row('6b', `안전: 기준선 ${k}`, '건너뜀 (--quick)', null);
      continue;
    }
    const s = sha8(b.out);
    row('6b', `안전: 기준선 ${k}`, `${s} — 기준 ${BASELINE[k]} ${s === BASELINE[k] ? '같음' : '**다름**'}${b.code ? ` (종료 ${b.code})` : ''}`, b);
  }
}
row(7, '겉모습', 'TODO — 쥠 손·자세 4 장면 스크린샷 (사람 눈; 비슷한 것 tools/browser/motion_gallery.mjs)', null);

console.log(`## weapon_check ${id} — 틀 ${art.frame}·${art.style} · 쥠 ${art.grip.kind} · 유파 ${art.tradition} · 서보 상한 ${art.caps.maxAimTorque} N·m (비교란, 문턱 없음)`);
console.log('| # | 검사 | 결과 | 시간 | 명령 |');
console.log('|---|---|---|---|---|');
for (const l of lines) console.log(l);
console.log(`\n(모두 ${((Date.now() - t0) / 1000).toFixed(0)} s, 동시 ${JOBS})`);
if (args.includes('--detail')) for (const k of names) console.log(`\n### ${k}\n${done[k].out.trim()}`);
