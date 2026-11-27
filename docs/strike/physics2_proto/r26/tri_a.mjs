// arm_real.test.mjs A (두손 칼 15 개 오른쪽 끝) 을 씨앗 여럿으로 (읽기만): node tri_a.mjs <칸 뿌리> [씨앗 1,2,..] — 줄마다 씨앗 · 시험이 깨지는 무기와 까닭 (빈손 놓침 몫 · 깃발 · 손 앞)
const [root, seedArg = '1,2,3,4,5,6,7,8'] = process.argv.slice(2);
const { runDir } = await import(`${root}/tools/sim/arm_reach_audit.mjs`);
const { WEAPONS } = await import(`${root}/src/weapons.js`);
const TWO = Object.keys(WEAPONS).filter((w) => WEAPONS[w].twoHand && !WEAPONS[w].gun && WEAPONS[w].frame !== 'gun' && w !== 'estoc' && w !== 'sabre'); // 재기에 estoc · sabre 를 쓰지 않음 (시험의 15 개 가운데 14 개)
for (const seed of seedArg.split(',').map(Number)) {
  const bad = [];
  for (const w of TWO) {
    const r = runDir({ weapon: w, dir: 'right', mode: 'slow', seed });
    const why = [];
    if (r.flags.includes('shRot') || r.flags.includes('elbowUp')) why.push(r.flags.join('+'));
    if (r.flags.includes('grip') || r.frac.grip !== 0) why.push(`놓침 ${r.frac.grip.toFixed(2)}`);
    if (!(r.end.hand[0] > 0.15)) why.push(`손 앞 ${r.end.hand[0].toFixed(3)}`);
    if (why.length) bad.push(`${w}(${why.join(' ')})`);
  }
  console.log(JSON.stringify({ tag: root.split('/').pop(), seed, pass: bad.length === 0, bad }));
}
