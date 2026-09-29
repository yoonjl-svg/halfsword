import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SP = process.env.SP;
const ix = JSON.parse(readFileSync('docs/motion/clips/index.json', 'utf8'));
const cuts = ['zornhau', 'oberhau', 'zwerchhau', 'schielhau', 'unterhau', 'scheitelhau', 'krumphau', 'mittelhau'];
const cam = process.argv[2] || 'side';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 1100 } });
await page.goto('http://localhost:5199/tools/motion/viewer.html');
await page.waitForTimeout(3500);
// 재생 멈춤, 잔상·길 끄기, 크게
const playing = await page.$eval('#play', (b) => b.textContent);
if (playing.includes('멈춤')) await page.click('#play');
for (const id of ['ghosts', 'trail', 'foe']) { const on = await page.$eval('#' + id, (e) => e.checked); if (on) await page.click('#' + id); }
await page.click('#size button[data-v="large"]');
await page.click(`#cam button[data-v="${cam}"]`);
const shots = [];
for (const cut of cuts) {
  await page.click(`#cuts button[data-cut="${cut}"]`);
  await page.waitForTimeout(900);
  const e = ix.clips.find((c) => c.cut === cut && c.side === 'right' && c.size === 'large');
  const clip = JSON.parse(readFileSync('docs/motion/clips/' + e.file, 'utf8'));
  const T = clip.data.cols.t[clip.data.n - 1];
  for (const m of ['tw', 'tr', 'tc', 'tf']) {
    const v = Math.round((clip.marks[m] / T) * 1000);
    await page.evaluate((v) => { const s = document.getElementById('scrub'); s.value = v; s.dispatchEvent(new Event('input')); }, v);
    await page.waitForTimeout(250);
    const buf = await (await page.$('#stage')).screenshot({ type: 'jpeg', quality: 70 });
    shots.push({ cut, m, src: 'data:image/jpeg;base64,' + buf.toString('base64') });
  }
}
const html = `<html><body style="margin:0;background:#fff;font:12px sans-serif"><table cellspacing=2>${cuts.map((c) => `<tr><td style="writing-mode:vertical-rl">${c}</td>${shots.filter((s) => s.cut === c).map((s) => `<td><div>${s.m}</div><img src="${s.src}" width=320></td>`).join('')}</tr>`).join('')}</table></body></html>`;
const p2 = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await p2.setContent(html);
await p2.waitForTimeout(500);
await p2.screenshot({ path: `${SP}/qa_${cam}.png`, fullPage: true });
await browser.close();
console.log('ok', shots.length);
