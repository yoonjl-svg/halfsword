// 허공 수 재기: node moves.mjs <나무> — 수마다 dur · path · vmax (motion_regress.mjs MOVES 그대로)
const root = process.argv[2];
const { MOVES } = await import(root + '/tools/sim/motion_regress.mjs');
for (const k of ['schielhau', 'imbroccata', 'inquartata', 'talhoRodeado', 'cingir', 'altib', 'kote', 'tsubameGaeshi', 'gonosen', 'chebuYaoji', 'lianchi', 'gyeoksal', 'mordschlag', 'risoluto']) {
  const r = MOVES[k]();
  console.log([k, r.err || '', r.dur, r.path, r.vmax, JSON.stringify(r.fired)].join('\t'));
}
