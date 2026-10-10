// 이베리아 비기 흐름 그림 (10/11 — docs/strike/iberian_secret_v5_2026-10-11.md): iberian_flow_probe.mjs 가 남긴 스텝 기록 둘(flow · v4)로
//  칼끝 빠르기 그래프(비기를 낸 때 = 0, 두 판을 위아래 칸으로 — 같은 시간 축, 칸마다 제 눈금)와 흐름 세 순간 이어 붙인 그림을 PNG 로 찍는다. 읽기만.
//  실행: node tools/browser/iberian_flow_chart.mjs <probe 폴더> <내놓을 폴더> [무기 zweihander]
import { chromium } from 'playwright';
import fs from 'node:fs';
const src = process.argv[2] || '.';
const out = process.argv[3] || '.';
const weapon = process.argv[4] || 'zweihander';
fs.mkdirSync(out, { recursive: true });
const load = (v) => JSON.parse(fs.readFileSync(`${src}/ibflow_${v}_${weapon}.json`, 'utf8'));
const series = (v) => {
  const { rec, fireT } = load(v);
  return rec.filter((x) => x.t >= fireT - 0.2 && x.t <= fireT + 2.4).map((x) => ({ t: x.t - fireT, v: x.v, st: x.st, n: x.n }));
};
const F = series('flow');
const V = series('v4');
const W = 760, H = 210, L = 46, R = 14, T = 26, B = 30;
const X = (t) => L + ((t + 0.2) / 2.6) * (W - L - R);
function panel(data, color, title, ymax) {
  const Y = (v) => T + (1 - Math.min(v, ymax) / ymax) * (H - T - B);
  const pts = data.map((d) => `${X(d.t).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  let g = '';
  for (let y = 0; y <= ymax; y += ymax > 40 ? 20 : 5) g += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="#e4e2dc"/><text x="${L - 6}" y="${Y(y) + 4}" text-anchor="end" font-size="11" fill="#6b6a64">${y}</text>`;
  for (let t = 0; t <= 2.4; t += 0.4) g += `<text x="${X(t)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#6b6a64">${t.toFixed(1)}</text>`;
  // 단계 띠: 경직
  let band = '';
  const stiff = data.filter((d) => d.st === 'stiff');
  if (stiff.length) band = `<rect x="${X(stiff[0].t)}" y="${T}" width="${X(stiff[stiff.length - 1].t) - X(stiff[0].t)}" height="${H - T - B}" fill="#f1efe9"/><text x="${(X(stiff[0].t) + X(stiff[stiff.length - 1].t)) / 2}" y="${T + 14}" text-anchor="middle" font-size="11" fill="#6b6a64">경직 0.5 s</text>`;
  // 토막 경계 (흐름)
  let marks = '';
  let prev = null;
  for (const d of data) {
    if (d.n && d.st === 'strike' && d.n !== prev && /Baixo|Cingido/.test(d.n)) marks += `<line x1="${X(d.t)}" x2="${X(d.t)}" y1="${T}" y2="${H - B}" stroke="#c3c2b7" stroke-dasharray="3 3"/><text x="${X(d.t) + 3}" y="${T + 28}" font-size="10" fill="#4a4944">${d.n.replace('flow', '')}</text>`;
    prev = d.st === 'strike' ? d.n : prev;
  }
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fcfcfb"/>${band}${g}${marks}<line x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H - B}" stroke="#4a4944"/><text x="${X(0) + 3}" y="${H - B - 4}" font-size="10" fill="#4a4944">비기 냄</text><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/><text x="${L}" y="16" font-size="13" font-weight="700" fill="#1f1e1b">${title}</text><text x="${W - R}" y="16" text-anchor="end" font-size="11" fill="#6b6a64">칼끝 빠르기 m/s · 가로 = 비기를 낸 뒤 s</text></svg>`;
}
const fMax = Math.max(...F.filter((d) => d.t >= 0).map((d) => d.v));
const vMax = Math.max(...V.filter((d) => d.t >= 0).map((d) => d.v));
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fcfcfb;font-family:'Noto Sans KR',sans-serif">
${panel(F, '#2a78d6', `새 · 멈추지 않는 흐름 (최고 ${fMax.toFixed(1)} m/s)`, 20)}
${panel(V, '#eb6834', `옛 · v4 휩쓸기 (최고 ${vMax.toFixed(1)} m/s — 스텝마다 자리 지정)`, 80)}
</body>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H * 2 } });
await page.setContent(html);
await page.screenshot({ path: `${out}/iberian_flow_tipspeed.png` });
// 세 순간 이어 붙이기
for (const v of ['flow', 'v4']) {
  const shots = [1, 2, 3].map((k) => `${src}/ibflow_${v}_${weapon}_${k}.png`).filter((p) => fs.existsSync(p));
  if (!shots.length) continue;
  const imgs = shots.map((p) => `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" style="width:420px;height:209px;object-fit:cover;display:block">`).join('');
  await page.setViewportSize({ width: 420 * shots.length, height: 209 });
  await page.setContent(`<!doctype html><body style="margin:0;display:flex">${imgs}</body>`);
  await page.screenshot({ path: `${out}/iberian_flow_strip_${v}.png` });
}
await browser.close();
console.log('OK', out);
