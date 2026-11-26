// probe (g): lungeAt (tools/sim/riso_reach.mjs — the helper gk_ghost reads) across gaps around the reach edge; 'old' = risolutoSlide 0.6
const T = process.argv[2];
const { lungeAt } = await import(T + '/tools/sim/riso_reach.mjs');
const { CONFIG } = await import(T + '/tools/sim/harness_m.mjs');
const old = process.env.OLD === '1';
const prev = CONFIG.SECRET.risolutoSlide; if (old) CONFIG.SECRET.risolutoSlide = 0.6;
for (const gap of process.argv.slice(3).map(Number)) { const r = lungeAt({ gap }); console.log(JSON.stringify({ old, gap, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? +v.toFixed(3) : v])) })); }
CONFIG.SECRET.risolutoSlide = prev;
process.exit(0);
