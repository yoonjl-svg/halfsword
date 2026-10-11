// 중국 막기 연환 수 빠르기 재기 (10/12 — docs/strike/cn_combo_play_2026-10-12.md §5). 읽기만.
//  시험 AI 가 서 있는 롱소드 몸(입력 없음)에게 다가가 간격(reach − 0.1) 안에 들면 비기를 직접 낸다(secretGo — tools/sim/parry_combo_probe.mjs 와 같은 대본).
//   중국 청강검: 막기 연환 자리마다(geojeong·pyodu) · 일본 打刀: 고노센(발도 — 대기 자세가 아니라 '왼 허리를 거쳐' 길, 베는 몫만 따로).
//  잰 것: 수마다 칼끝이 지나간 길이(스텝마다 칼끝 자리 차의 합, m) · 걸린 시간(s) · 평균 = 길이/시간 · 칼끝 최고(m/s, 스텝 차/dt) · 그 수 동안 낸 상처 에너지(J).
//  실행: node tools/sim/cn_combo_speed.mjs [씨앗 수 8]   ·   비교: node tools/sim/with_config.mjs SECRET.cnFast=0 cn_combo_speed.mjs 8
import { newRound, DT, THREE } from './harness_m.mjs';
const N = +(process.argv[2] || 8);
const runs = [
  { id: 'qinggang', slot: 'geojeong' },
  { id: 'qinggang', slot: 'pyodu' },
  { id: 'qinggang', slot: 'bongdu' },
  { id: 'uchigatana', slot: null },
];
const tp = new THREE.Vector3();
for (const R of runs) {
  const agg = {};
  let fired = 0;
  let landed = 0;
  for (let seed = 1; seed <= N; seed++) {
    const G = newRound({ walls: false, weapon: 'longsword', weapon2: R.id, seed });
    const me = G.enemy;
    const A = G.ai;
    const S = A.secret;
    if (R.slot && !S.do.combo?.[R.slot]) break;
    let t0 = null;
    let cur = null;
    let prev = null;
    let w0 = 0;
    let hit = false;
    for (let i = 0; i < 120 * 10; i++) {
      G.step();
      const near = t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < A.M.reach - 0.1 && A.secretFree();
      if (near && A.secretGo(S, R.slot ? { slot: R.slot, held: 0 } : {})) (t0 = G.t), fired++, (w0 = G.wounds.length);
      if (t0 == null) continue;
      const run = A.secretRun;
      if (!run || run.stage === 'stiff') break;
      const I = me.iai;
      let nm;
      if (I?.kind === 'iai') nm = I.u >= I.ab ? '발도 베는 몫' : '발도 뽑는 몫';
      else if (I?.kind === 'combo') nm = I.moveName + (I.cutting ? '' : ' (준비)');
      else if (run.stage === 'instant') nm = '-';
      else nm = A.tech?.name ?? '-';
      me.bladePoint(1, tp);
      if (nm !== cur?.n) {
        cur = { n: nm, L: 0, T: 0, vmax: 0, E: 0 };
        (agg[nm] ??= []).push(cur);
      } else if (prev) {
        const d = tp.distanceTo(prev);
        cur.L += d;
        cur.T += DT;
        cur.vmax = Math.max(cur.vmax, d / DT);
      }
      prev = tp.clone();
      for (const w of G.wounds.slice(w0)) if (w.att === me) (cur.E += w.energy), (hit = true);
      w0 = G.wounds.length;
    }
    if (hit) landed++;
  }
  console.log(`${R.id}${R.slot ? ` 연환 ${R.slot}` : ' 고노센(발도)'} — 낸 ${fired}/${N} · 상처 낸 판 ${landed}`);
  for (const [k, a] of Object.entries(agg)) {
    if (k === '-') continue;
    const L = a.reduce((s, x) => s + x.L, 0);
    const T = a.reduce((s, x) => s + x.T, 0);
    const av = (f) => (a.reduce((s, x) => s + f(x), 0) / a.length).toFixed(3);
    const hits = a.filter((x) => x.E > 0);
    console.log(`  ${k}: 칼끝 길이 ${av((x) => x.L)} m · 시간 ${av((x) => x.T)} s · 평균 ${(L / Math.max(T, 1e-9)).toFixed(2)} m/s · 최고 ${av((x) => x.vmax)} m/s · 상처 ${hits.length} (평균 ${hits.length ? (hits.reduce((s, x) => s + x.E, 0) / hits.length).toFixed(0) : '-'} J) (n ${a.length})`);
  }
}
