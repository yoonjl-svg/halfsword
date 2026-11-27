// r24: 다리 관절 기준 자세(rest)가 단위 회전인지 · 판 하나 몇 스텝 돈 뒤 restInv·(qp⁻¹ qc) 와 qp⁻¹ qc 의 회전 벡터 차.  node rest_check.mjs (나무 = 이 파일 세 칸 위)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const H = await import(join(ROOT, 'tools/sim/harness_m.mjs'));
const { THREE } = H;
const r = H.newRound({ seed: 1 });
const f = r.player;
for (const n of ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB']) {
  const j = f.jointByName[n];
  const q = j.restInv.clone().invert();
  console.log(n, j.type, 'rest', [q.x, q.y, q.z, q.w].map((v) => v.toFixed(4)).join(' '), 'frame1', JSON.stringify(j.joint.frameX1?.() ?? null));
}
