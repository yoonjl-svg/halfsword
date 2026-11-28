// u1_cache_rows.mjs — 제자리 뜀 관문 캐시(판 파일)를 판마다 한 줄로 풀어 읽기만 한다 (시뮬 안 돌림 · 몸에 아무것도 안 검).
//   node docs/strike/physics2_proto/r34/u1_cache_rows.mjs <캐시>/<해시>/hop.<무기>.<판>.json [더 많은 판 파일…]
//   줄: 판 · 디딤 수 · 0.05 s 넘게 뜬 디딤 몫(못 넘은 디딤 수) · 충격량 비 가장 작음 ~ 큼 · 자리 흐름 · 앞 3 s 흐름의 아래 끝 · 무릎/발목 99 % · 관절 끝 가장 큰 칸.
//   덧: 몸 전체 수직 힘 줄(fyBW · 재는 창 fyWin)에서 '몸무게 3 % 밑' 구간 = 두 발 뜸으로 보고, 뛰기 시작 뒤 몇 초에 0.05 s 못 넘는 뜸이 왔는지 적는다(어림 — 관문의 발마다 셈과 같지 않음).
import { readFileSync } from 'node:fs';

const DT = 1 / 120;
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d));
const all = [];
for (const p of process.argv.slice(2)) for (const r of JSON.parse(readFileSync(p, 'utf8')).runs) all.push(r);
console.log('판 | 넘어짐 | 디딤 | 뜬>0.05 몫 (못 넘은 수) | 충격량 비 | 받침 수 | 흐름 6s | 앞 3s 흐름 ≥ | 뒤 3s 빠르기 | 무릎 99 · 발목 99 | 관절 끝 칸 | 무릎 깊이° | 시킨 최고 BW | 거른 땅 힘 BW | 깎인 몫 | 압력 중심 평균 m | fy 줄 뜸: 수 · 0.05 못 넘은 때(뛰기 시작 뒤 s) | 첫 뜸 s | 0.33 s 넘는 받침 (시작 s(길이))');
for (const r of all) {
  const bad = r.tdN != null && r.flightShare05 != null ? Math.round((1 - r.flightShare05) * r.tdN) : null;
  const lead = r.drift != null && r.drift3sSpeed != null ? Math.max(0, r.drift - 3 * r.drift3sSpeed) : null;
  let endK = '-', endV = -1;
  for (const [k, v] of Object.entries(r.ends ?? {})) if (v.share > endV) { endV = v.share; endK = k; }
  // fy 줄에서 뜸 구간
  let fl = [];
  if (r.fyBW && r.fyWin) {
    const [i0, i1] = r.fyWin; let run = 0, s0 = null;
    for (let i = i0; i <= i1; i++) {
      const off = r.fyBW[i] < 0.03;
      if (off) { if (!run) s0 = i; run++; }
      else if (run) { fl.push({ t: (s0 - i0) * DT, T: run * DT }); run = 0; }
    }
  }
  // 받침(두 발 뜸 사이) 길이 — 0.33 s 넘는 받침은 한 받침에 디딤 둘이 든 것으로 어림 (계획 디딤 0.26 s)
  const sup = []; for (let j = 0; j + 1 < fl.length; j++) sup.push({ t: fl[j].t + fl[j].T, T: fl[j + 1].t - fl[j].t - fl[j].T });
  const first = fl.length ? fl[0].t : null;
  const longSup = sup.filter((x) => x.T > 0.33).map((x) => f2(x.t, 2) + '(' + f2(x.T, 2) + ')');
  const short = fl.filter((x) => x.T < 0.05 - 1e-9).map((x) => f2(x.t, 2) + '(' + Math.round(x.T * 120) + ')');
  console.log(`${r.weapon}#${r.variant} | ${r.fell ? 'Y@' + r.tFall : '-'} | ${r.tdN} | ${f2(r.flightShare05)} (${bad}) | ${f2(r.impRatioMin, 3)} ~ ${f2(r.impRatioMax, 3)} | ${r.impPhases} | ${f2(r.drift)} | ${f2(lead)} | ${f2(r.drift3sSpeed, 3)} | ${f2(r.share?.knee?.st99)} · ${f2(r.share?.ankle?.st99)} | ${endK} ${f2(endV, 3)} | ${f2(r.kneeDeepDeg, 0)} | ${f2(r.fyPlanPeakBW)} | ${f2(r.fyPeakLpBW)} | ${f2(r.cutShare, 3)} | ${f2(r.copMean, 3)} | ${fl.length} · ${short.join(' ') || '없음'} | ${f2(first)} | ${longSup.join(' ') || '없음'}`);
}
