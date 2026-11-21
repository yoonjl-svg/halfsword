// 설정 파일 두 판의 값을 통째로 견준다 (주석만 바뀌었는지): node cmp_config.mjs <옛 config.js> <새 config.js>
const [a, b] = await Promise.all(process.argv.slice(2, 4).map((p) => import(new URL(p, 'file://' + process.cwd() + '/').href)));
const diffs = []; let leaves = 0;
const walk = (x, y, path) => {
  if (typeof x === 'function' || typeof y === 'function') { if (String(x) !== String(y)) diffs.push(path + ' (함수 글이 다름)'); return; }
  if (x && y && typeof x === 'object' && typeof y === 'object') {
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
      if (!(k in x)) diffs.push(path + '.' + k + ' (새로 생김)'); else if (!(k in y)) diffs.push(path + '.' + k + ' (없어짐)'); else walk(x[k], y[k], path + '.' + k);
    }
    return;
  }
  leaves++;
  if (!Object.is(x, y)) diffs.push(`${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
};
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { if (!(k in a)) diffs.push(k + ' (새로 생김)'); else if (!(k in b)) diffs.push(k + ' (없어짐)'); else walk(a[k], b[k], k); }
console.log('견준 잎 값', leaves, '· 다른 곳', diffs.length); for (const d of diffs.slice(0, 30)) console.log(' ', d);
