// 이탈리아 보법 갈래를 건 채로 다른 시뮬 스크립트를 돌린다 (10/21 보법 빠르기 제안 재기 — 판 값 그대로, 이 프로세스 안에서만)
// 실행: node tools/sim/with_italian.mjs s=0.72,0.99,1.3 w=1.15,1.15 motion_lab.mjs duel rapier 24 main
//  차례대로 건다(s= 가 짝 보폭을 다시 정하고 w= 가 가속 칸을 지우므로 p= · a= 는 그 뒤에) · p=m = 가까이 짝걸음 보폭 상한 · a=k = 짧은 디딤 몸 가속 한도 배율(rhythm.accel) · s=a,b,c = schools.js setItalianStride(짧은 · 긴 계수 · 짧은 디딤 몸 빠르기) · w=f,b | w=p:f,b = setItalianWalk(앞 · 뒤 걷는 빠르기 배율 — p: 는 플레이어만)
import { TRADITIONS, setItalianStride, setItalianWalk } from '../../src/schools.js';
import { simPath } from './is_main.mjs';
const args = process.argv.slice(2);
const g = TRADITIONS.italian.gait;
while (args.length && /^[swap]=/.test(args[0])) {
  const a = args.shift();
  const v = a.slice(2);
  const ok = a.startsWith('s=') ? setItalianStride(v) : a.startsWith('a=') ? (g.rhythm.accel = +v) > 0 : a.startsWith('p=') ? (g.even.pair.stride = +v) > 0 : setItalianWalk(v);
  if (!ok) throw new Error(`못 읽음 ${a}`);
}
const [script, ...rest] = args;
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
