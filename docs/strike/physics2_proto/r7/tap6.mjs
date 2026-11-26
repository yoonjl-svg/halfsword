// 한손 탭 찌르기 여섯 (onehand_arm 시험과 같은 판) — ROOT 나무의 wrist_audit tapRun
const root = process.env.ROOT;
const { tapRun } = await import(root + '/tools/sim/wrist_audit.mjs');
for (const w of ['rapier', 'hwando']) for (const gd of ['pflug', 'ochs', 'langort']) { const r = tapRun(w, gd); console.log(w, gd, r.fired); }
