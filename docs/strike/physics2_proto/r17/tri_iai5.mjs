// iai_obi ⑤ 가르기 (재기만): node tri_iai5.mjs <칸 뿌리> [씨앗 1,2,..] — 시험과 같은 sayaScript(look player · visual 끔)를 씨앗마다, 줄마다 잣대 값
const [root, sa = '1,2,3,4,5,6,7,8'] = process.argv.slice(2);
const { sayaScript } = await import(`${root}/tools/sim/iai_obi.mjs`);
for (const seed of sa.split(',').map(Number)) for (const weapon of ['uchigatana', 'monohoshizao']) {
  const r = sayaScript({ weapon, look: 'player', visual: false, seed });
  let pass = true; const bad = [];
  for (const [k, v] of Object.entries(r.rows)) {
    const ok = v.n > 0 && v.torso >= -0.005 && v.leg > 0 && v.chest > 0 && v.ground >= -0.005 && (!['stand', 'walk', 'run', 'back'].includes(k) || (v.gapMin >= 0 && v.gapMax <= 0.015));
    if (!ok) { pass = false; bad.push(`${k} torso ${v.torso} ground ${v.ground} leg ${v.leg} chest ${v.chest}`); }
  }
  console.log(JSON.stringify({ root: root.split('/').pop(), seed, weapon, pass, dead: r.rows.dead && { ground: r.rows.dead.ground, torso: r.rows.dead.torso }, bad }));
}
