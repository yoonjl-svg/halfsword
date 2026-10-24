// 일본 J8 손목 치기 심화 · 칼 떨구기 그림 (10/24 — 사장님 11:5x · 12:0x · config UNIQUE_ASSIST.koteDrop · combat.js koteCheck · docs/handoff/j8_kote_2026-10-24/)
//  ① 스킬트리: 일본 칸 몇(J1 · J6 · J7)을 익힌 저장으로 첫 화면 → 여정 → 정지 → 대기실 '스킬' → 일본 탭. J8 이 '준비 중' 아닌 배울 수 있는 칸(값 보임)인지 보고 판 한 장 ·
//     J8 을 눌러 상세 카드(제목 · 오의 · 출처 · 효과 한 줄 · 배우기 단추) 한 장.
//  ② 칼을 떨군 상대: ?skillNodes=all(테스트 경로 — J8 몫 켬) · 내 칼 우치가타나 · 상대 롱소드로 싸움을 연 뒤, 손목 치기가 칼 쥔 아래팔을 벤 순간과 같은 판정(combat.koteCheck —
//     지금 기술 = 손목 치기 · 굴림을 1 로)을 한 번 부른다 → 상대 칼이 땅에 떨어진 뒤(1.2 s) 물리를 멈추고 한 장.
//  실행: vite build(+ tools/pwa/build.mjs — sw.js 가 없으면 페이지마다 콘솔 오류 하나) → vite preview 를 띄운 뒤  node tools/browser/kote_drop_shots.mjs http://127.0.0.1:5491 [출력 폴더(기본 docs/handoff/j8_kote_2026-10-24)]
//  출력(WebP · 폰 가로 844 × 390 · 화면 배율 2): tree_j8_open.webp · tree_j8_card.webp · foe_disarmed.webp. 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium) · 끝 코드 0 = 콘솔 오류 0 · 글 · 상태 맞음
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { titleToLobby } from './to_lobby.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:5491').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/j8_kote_2026-10-24';
fs.mkdirSync(out, { recursive: true });
const W = 844, H = 390;
const errors = [], report = {};
const toWebp = (png, name) => { execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=82, method=6)", png, `${out}/${name}.webp`]); fs.rmSync(png); };
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console ${m.text()}`));
};
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

// ① 스킬트리
{
  const learned = ['J1', 'J6', 'J7'];
  const SAVE = { version: 1, coins: 640, heads: 12, titles: [], title: '', acquisitions: learned.map((id) => ({ receipt: `skill:japanese:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } })) };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  watch(p, 'tree');
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 120000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 60000 });
  await titleToLobby(p);
  await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot, d = r.getElementById('treeDialog'); if (d?.open) r.getElementById('closeTree').click(); });
  await p.locator('#tabSkills').click();
  await p.locator('.school-tabs [data-school=japanese]').click();
  const settle = () => p.evaluate(() => Promise.all([...document.querySelector('#gameEntrance').shadowRoot.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))));
  await settle();
  // J8 이 보이게 내려 둠 (J8 은 둘째 줄)
  await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot, n = r.querySelector('.tree-node[data-node="J8"]'), sc = r.querySelector('.tree-scroll'); sc.scrollTop = Math.max(0, n.offsetTop - sc.clientHeight * 0.35); });
  await settle();
  report.node = await p.evaluate(() => { const n = document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-node[data-node="J8"]'); return { state: n.dataset.state, text: n.textContent.trim().replace(/\s+/g, ' '), soon: !!n.querySelector('.node-soon'), price: n.querySelector('.node-price')?.textContent.trim() ?? null }; });
  if (report.node.state !== 'open' || report.node.soon || !report.node.text.includes('칼 떨구기')) errors.push(`J8 칸 ${JSON.stringify(report.node)}`);
  await p.screenshot({ path: `${out}/_tree.png` }); toWebp(`${out}/_tree.png`, 'tree_j8_open');
  await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.tree-node[data-node="J8"]').click());
  await settle();
  report.card = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot, g = (id) => r.getElementById(id)?.textContent.trim(); const box = r.querySelector('.node-detail'); return { open: !box.hidden, title: g('nodeTitle'), lore: g('nodeLore'), src: g('nodeSrc'), eff: g('nodeEffect'), state: g('nodeState'), price: g('nodePrice'), learn: !r.getElementById('learnNode').disabled, over: box.scrollHeight > box.clientHeight + 1 }; });
  const C = report.card;
  if (!C.open || C.title !== '손목 치기 심화 · 칼 떨구기' || C.eff !== '손목을 맞은 상대가 칼을 놓치기도 한다' || !C.lore.includes('칼은 반드시 떨어진다') || !C.src.includes('단풍 치기') || C.over) errors.push(`J8 카드 ${JSON.stringify(C)}`);
  await p.screenshot({ path: `${out}/_card.png` }); toWebp(`${out}/_card.png`, 'tree_j8_card');
  await ctx.close();
}

// ② 칼을 떨군 상대
{
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  watch(page, 'fight');
  await page.goto(`${base}/?stage=cathedral&foe=isolde&weapon=uchigatana&foeWeapon=longsword&skillNodes=all&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 2.4, null, { timeout: 900000 });
  report.drop = await page.evaluate(() => {
    const g = window.game, P = g.player, E = g.enemy, K = g.config.UNIQUE_ASSIST.koteDrop, p0 = K.p;
    P.artTech = 'kote'; K.p = 1; // 손목 치기가 칼 쥔 아래팔을 벤 순간 (굴림 1 — 그림용)
    try { g.combat.koteCheck(P, E, 'farmS', { type: 'cut', severity: 0.2 }); } finally { K.p = p0; P.artTech = null; }
    return { kit: !!P.skillKit?.perk?.has('kote'), armed: E.armed, log: g.combat.koteLog ?? [], weapon: P.weapon.id, foeWeapon: E.weapon.id };
  });
  if (!report.drop.kit || report.drop.armed !== false || report.drop.log.length !== 1) errors.push(`떨굼 ${JSON.stringify(report.drop)}`);
  const t0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForFunction((t) => window.game.stats.simTime > t + 1.2, t0, { timeout: 600000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  report.after = await page.evaluate(() => {
    const g = window.game, T = g.THREE, E = g.enemy, P = g.player;
    g.world.step = () => {};
    g.freeCam = true;
    const e = E.bodies.pelvis.translation(), s = E.sword.translation(), p = P.bodies.pelvis.translation();
    // 상대 · 떨어진 칼 · 내 몸이 한 화면에: 가운데 = 상대와 칼 사이, 옆에서 조금 위
    const mid = new T.Vector3((e.x + s.x) / 2, 0.75, (e.z + s.z) / 2);
    const toP = new T.Vector3(p.x - e.x, 0, p.z - e.z).normalize();
    const side = new T.Vector3(-toP.z, 0, toP.x);
    g.camera.position.copy(mid).addScaledVector(side, 2.9).addScaledVector(toP, 0.9).setY(1.45);
    g.camera.lookAt(mid);
    return { armed: E.armed, alive: E.alive, swordY: +s.y.toFixed(3), aiMode: g.ai.mode, state: E.state };
  });
  if (report.after.armed || !(report.after.swordY < 0.25)) errors.push(`떨군 뒤 ${JSON.stringify(report.after)}`);
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/_foe.png` }); toWebp(`${out}/_foe.png`, 'foe_disarmed');
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report, null, 1));
console.log(errors.length ? `FAIL ${errors.length}\n${errors.join('\n')}` : 'PASS');
process.exit(errors.length ? 1 : 0);
