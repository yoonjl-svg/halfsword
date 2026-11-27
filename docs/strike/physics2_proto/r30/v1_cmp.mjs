// r30 V1 견줌: 두 나무 출력에서 다른 줄을 적는다. node v1_cmp.mjs <폴더>
//  다른 줄마다: 줄 번호 · 그 줄 머리 · 다리 아닌 칸(관절 토크 줄의 thigh · shin · foot 밖 칸)의 값이 같은지
import { readFileSync } from 'node:fs';
const dir = process.argv[2];
let allOk = true;
for (const sc of ['stand', 'walk', 'back', 'strafe', 'fights12']) {
  const a = readFileSync(`${dir}/base_${sc}.txt`, 'utf8').split('\n'), b = readFileSync(`${dir}/judge_${sc}.txt`, 'utf8').split('\n');
  const diff = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(i);
  const notes = diff.map((i) => {
    const x = a[i] ?? '', y = b[i] ?? '';
    const isJ = /^\s*관절 토크/.test(x) && /^\s*관절 토크/.test(y);
    if (!isJ) { allOk = false; return `줄 ${i + 1} (관절 토크 줄 아님!)`; }
    const cells = (s) => Object.fromEntries(s.slice(s.indexOf('): ') + 3).split(' · ').map((c) => [c.split(' ')[0], c]));
    const cx = cells(x), cy = cells(y), bad = Object.keys(cx).filter((k) => !/^(thigh|shin|foot)/.test(k) && cx[k] !== cy[k]);
    const legSame = Object.keys(cx).filter((k) => /^(thigh|shin|foot)/.test(k)).map((k) => `${k}: ${cx[k].split(' ').slice(1).join(' ')} → ${cy[k].split(' ').slice(1).join(' ')}`);
    if (bad.length) allOk = false;
    return `줄 ${i + 1} ${y.trim().slice(0, 22)}… · 다리 아닌 칸 값 다름: ${bad.length ? bad.join(',') : '없음'}\n      ${legSame.join('\n      ')}`;
  });
  console.log(`${sc}: 줄 수 ${a.length}/${b.length} · 다른 줄 ${diff.length}${notes.length ? '\n    ' + notes.join('\n    ') : ''}`);
}
console.log(allOk ? '판정: 관절 토크 두 줄의 다리 칸 말고는 모두 같음' : '판정: 다른 곳이 있음');
