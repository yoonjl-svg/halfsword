// 금지 이름 검사 (11/21 감사 N-003) — 저장소에 올라간 글 · 코드 파일과 파일 경로에서 모델 · 다른 회사 에이전트 이름을 찾는다
//  name_policy.mjs 가 부른다. 따로 돌려도 된다: node tools/text/forbidden_names.mjs (종료 코드: 걸림 0 → 0, 있으면 1)
//  목록 글자를 그대로 적으면 이 파일이 걸리므로 rot13 으로 적는다. 대소문자는 가리지 않는다
//  뺌: 빌드해 넣은 시험판 묶음(public/<판>/assets — 인라인 wasm base64 의 우연한 글자) · dist · 이진 파일(git grep -I)
//  봐줌(바꿀 수 없는 실제 이름만): 도구 설정 숨은 폴더 경로 '.<이름>/' · 아티팩트 주소 'https://<이름>.ai/artifact/…' · 검술 자료 사이트 이름 'hema-<이름>'
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rot13 = (s) => s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));
export const FORBIDDEN = ['pynhqr', 'bchf', 'fbaarg', 'tcg', 'pbqrk', 'snoyr', 'naguebcvp', 'bcranv'].map(rot13);
const [TOOL, , , , MANUSCRIPT] = FORBIDDEN;
const ALLOWED = [new RegExp(`\\.${TOOL}/`, 'gi'), new RegExp(`https://${TOOL}\\.ai/artifact/[A-Za-z0-9]+`, 'gi'), new RegExp(`hema-${MANUSCRIPT}`, 'gi')];
const EXCLUDE = [':(exclude,glob)public/*/assets/**', ':(exclude)dist'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function git(args) {
  try {
    return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch (e) {
    if (e.status === 1 && !e.stderr?.length) return ''; // git grep: 찾은 것 없음
    throw e;
  }
}

// 걸린 줄 [{ path, line, text }] — 경로 이름에 걸리면 line 0
export function forbiddenHits() {
  const re = new RegExp(FORBIDDEN.join('|'), 'i');
  const hits = [];
  for (const p of git(['ls-files', '-z']).split('\0')) if (p && re.test(p)) hits.push({ path: p, line: 0, text: '(파일 경로)' });
  const out = git(['grep', '-I', '-n', '-i', '--null', '-E', FORBIDDEN.join('|'), '--', '.', ...EXCLUDE]);
  for (const row of out.split('\n')) {
    if (!row) continue;
    const [p, line, ...rest] = row.split('\0'); // --null: 경로\0줄\0글
    const text = rest.join('\0');
    if (!re.test(ALLOWED.reduce((t, a) => t.replace(a, ''), text))) continue;
    hits.push({ path: p, line: Number(line), text });
  }
  return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hits = forbiddenHits();
  for (const h of hits) console.log(`  ${h.path}:${h.line}  ${h.text.trim().slice(0, 160)}`);
  console.log(`금지 이름 검사 — 걸림 ${hits.length}`);
  process.exit(hits.length ? 1 : 0);
}
