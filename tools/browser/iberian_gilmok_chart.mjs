// 이베리아 비기 v6 길목 지키기 그림 (10/11 — docs/strike/iberian_secret_v6_2026-10-11.md). iberian_flow_chart.mjs 를 고쳐 씀. 읽기만.
//  iberian_gilmok_probe.mjs hold 가 남긴 스텝 기록으로 칼끝 빠르기 그래프(비기를 낸 때 = 0, 경직 띠 · 토막 경계)와 세 순간(준비 · 창 · 한 칼) 이어 붙인 그림을 PNG 로.
//  실행: node tools/browser/iberian_gilmok_chart.mjs <probe 폴더> <내놓을 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const src = process.argv[2] || '.';
const out = process.argv[3] || '.';
fs.mkdirSync(out, { recursive: true });
const J = JSON.parse(fs.readFileSync(`${src}/ibgil_hold_gilmok.json`, 'utf8'));
const D = J.series.map((x) => ({ t: x.t - J.fireT, v: x.v, st: x.st, n: x.n }));
const W = 760, H = 230, L = 46, R = 14, T = 26, B = 30;
const X = (t) => L + ((t + 0.3) / 1.8) * (W - L - R);
const ymax = 20;
const Y = (v) => T + (1 - Math.min(v, ymax) / ymax) * (H - T - B);
let g = '';
for (let y = 0; y <= ymax; y += 5) g += `<line x1="${L}" x2="${W - R}" y1="${Y(y)}" y2="${Y(y)}" stroke="#e4e2dc"/><text x="${L - 6}" y="${Y(y) + 4}" text-anchor="end" font-size="11" fill="#6b6a64">${y}</text>`;
for (let t = 0; t <= 1.4; t += 0.2) g += `<text x="${X(t)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="#6b6a64">${t.toFixed(1)}</text>`;
const stiff = D.filter((d) => d.st === 'stiff');
const band = stiff.length ? `<rect x="${X(stiff[0].t)}" y="${T}" width="${X(stiff[stiff.length - 1].t) - X(stiff[0].t)}" height="${H - T - B}" fill="#f1efe9"/><text x="${(X(stiff[0].t) + X(stiff[stiff.length - 1].t)) / 2}" y="${T + 14}" text-anchor="middle" font-size="11" fill="#6b6a64">경직 0.5 s</text>` : '';
let marks = '';
let prev = null;
for (const d of D) {
  if (d.n && d.st === 'strike' && d.n !== prev) marks += `<line x1="${X(d.t)}" x2="${X(d.t)}" y1="${T}" y2="${H - B}" stroke="#c3c2b7" stroke-dasharray="3 3"/><text x="${X(d.t) + 3}" y="${T + 30}" font-size="10" fill="#4a4944">${d.n.replace('gilmok', '')}</text>`;
  if (d.st === 'strike') prev = d.n;
}
// 보통 가로베기(zwerch) 칼끝 최고 — 시뮬 탐침(tools/sim/iberian_flow_probe.mjs CMP=zwerch ARM=0, 6 판 평균 8.5 m/s)
const zw = `<line x1="${L}" x2="${W - R}" y1="${Y(8.5)}" y2="${Y(8.5)}" stroke="#eb6834" stroke-dasharray="5 4"/><text x="${W - R}" y="${Y(8.5) - 4}" text-anchor="end" font-size="10" fill="#eb6834">보통 가로베기(zwerch) 칼끝 최고 평균 8.5 m/s (시뮬 탐침)</text>`;
const pts = D.map((d) => `${X(d.t).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
const vmax = Math.max(...D.filter((d) => d.t >= 0).map((d) => d.v));
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fcfcfb"/>${band}${g}${marks}${zw}<line x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H - B}" stroke="#4a4944"/><text x="${X(0) + 3}" y="${H - B - 4}" font-size="10" fill="#4a4944">비기 냄 (창 안 끌기)</text><polyline points="${pts}" fill="none" stroke="#2a78d6" stroke-width="2"/><text x="${L}" y="16" font-size="13" font-weight="700" fill="#1f1e1b">길목 지키기 — 플레이어 칼끝 빠르기 (최고 ${vmax.toFixed(1)} m/s)</text><text x="${W - R}" y="16" text-anchor="end" font-size="11" fill="#6b6a64">m/s · 가로 = 비기를 낸 뒤 s</text></svg>`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fcfcfb;font-family:'Noto Sans KR',sans-serif">${svg}</body>`);
await page.screenshot({ path: `${out}/iberian_gilmok_tipspeed.png` });
const shots = [1, 2, 3, 4].map((k) => `${src}/ibgil_hold_${k}.png`).filter((p) => fs.existsSync(p));
if (shots.length) {
  const imgs = shots.map((p) => `<img src="data:image/png;base64,${fs.readFileSync(p).toString('base64')}" style="width:420px;height:209px;object-fit:cover;display:block">`).join('');
  await page.setViewportSize({ width: 420 * shots.length, height: 209 });
  await page.setContent(`<!doctype html><body style="margin:0;display:flex">${imgs}</body>`);
  await page.screenshot({ path: `${out}/iberian_gilmok_strip.png` });
}
await browser.close();
console.log('OK', out);
