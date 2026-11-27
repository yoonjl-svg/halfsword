// r22p 걸음 칸 확인(재기만): 칸 폴더에서 node pchk.mjs — 판 1 ~ 6 의 두 몸이 기본 걸음 GAIT 를 쓰는지, 유파 걸음이면 그 guardHeight
const H = await import(process.cwd() + '/tools/sim/harness_m.mjs');
const C = await import(process.cwd() + '/src/config.js');
const FW = ['longsword', 'rapier', 'zweihander'];
for (let s = 1; s <= 6; s++) { const G = H.newRound({ walls: true, seed: s, weapon: FW[(s - 1) % 3], weapon2: FW[s % 3], AI2Class: H.AI }); for (let i = 0; i < 30; i++) G.step(); console.log(s, [G.player, G.enemy].map((f) => f.gait.P === C.GAIT ? 'GAIT' : 'school:' + f.gait.P.guardHeight)); }
