// 화면 글꼴 빠진 글자 점검 (10/14 웹폰트 프리텐다드 + Cinzel — docs/ui/webfont_2026-10-14.md. 앞선 갈무리 판은 docs/ui/pixel_font_2026-10-14.md)
//  화면 글(texts.mjs collectTexts — 유파·자세표·무기·인물·main.js·index.html 글 + 무대 이름 + test.html·test_pick.js·test_route.js 글
//  + main.js 의 한글 없는 기호 글(독일 감아 들기 칸의 ▮▯ 등))을 index.html 의 @font-face 와 대조한다.
//   글꼴 줄(--font-ui) 차례대로: 그 글꼴의 unicode-range 안이고 파일 글자표(cmap)에 있으면 우리 글꼴로 그려진다 —
//   범위 안인데 파일에 없으면 브라우저가 다음 글꼴로 넘어가므로 같은 차례로 넘어간다. 끝까지 없으면 '빠진 글자'(시스템 글꼴로 그려짐).
//   한 글꼴에 굵기가 여럿이면(프리텐다드 400 · 600 · 700) 굵기 파일 모두에 있어야 그 글꼴로 친다 — 어느 굵기로 그려도 같은 글꼴이게.
//  WOFF2 는 의존성 없이 읽는다 (node:zlib 브로틀리 · cmap 형식 4/12). @font-face 는 index.html 에서 읽는다 (CSS 와 점검이 어긋나지 않게).
//  실행: node tools/text/font_glyphs.mjs   (빠진 글자가 있으면 종료 코드 1 — 이모지는 시스템 글꼴로 그리는 것이 맞아 따로 적기만 한다)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { collectTexts, jsStrings, htmlTexts, ROOT } from './texts.mjs';

// ── WOFF2 → cmap 글자 집합 ──
const TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];
function woff2Cmap(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file}: WOFF2 가 아니다`);
  const numTables = buf.readUInt16BE(12);
  const compressed = buf.readUInt32BE(20);
  const pos = { p: 48 };
  const b128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[pos.p++];
      v = v * 128 + (b & 0x7f);
      if (!(b & 0x80)) return v;
    }
    throw new Error('UIntBase128');
  };
  const dir = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.p++];
    const tag = (flags & 0x3f) === 63 ? buf.toString('latin1', pos.p, (pos.p += 4)) : TAGS[flags & 0x3f];
    const ver = flags >> 6;
    const orig = b128();
    const transformed = tag === 'glyf' || tag === 'loca' ? ver === 0 : ver !== 0;
    dir.push({ tag, len: transformed ? b128() : orig });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos.p, pos.p + compressed));
  let off = 0;
  let cmap = null;
  for (const t of dir) {
    if (t.tag === 'cmap') cmap = data.subarray(off, off + t.len);
    off += t.len;
  }
  const n = cmap.readUInt16BE(2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8);
    const eid = cmap.readUInt16BE(6 + i * 8);
    const o = cmap.readUInt32BE(8 + i * 8);
    const fmt = cmap.readUInt16BE(o);
    const score = fmt === 12 && (pid === 0 || (pid === 3 && eid === 10)) ? 2 : fmt === 4 && (pid === 0 || (pid === 3 && eid === 1)) ? 1 : 0;
    if (score && (!best || score > best.score)) best = { o, fmt, score };
  }
  const set = new Set();
  const o = best.o;
  if (best.fmt === 12) {
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const p = o + 16 + g * 12;
      const s = cmap.readUInt32BE(p);
      const e = cmap.readUInt32BE(p + 4);
      const gid = cmap.readUInt32BE(p + 8);
      for (let c = s; c <= e; c++) if (gid + c - s) set.add(c);
    }
  } else {
    const segX2 = cmap.readUInt16BE(o + 6);
    const endO = o + 14;
    const startO = endO + segX2 + 2;
    const deltaO = startO + segX2;
    const rangeO = deltaO + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = cmap.readUInt16BE(endO + 2 * i);
      const start = cmap.readUInt16BE(startO + 2 * i);
      const delta = cmap.readInt16BE(deltaO + 2 * i);
      const ro = cmap.readUInt16BE(rangeO + 2 * i);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let gid = ro ? cmap.readUInt16BE(rangeO + 2 * i + ro + 2 * (c - start)) : c;
        if (ro && !gid) continue;
        gid = (gid + delta) & 0xffff;
        if (gid) set.add(c);
      }
    }
  }
  return set;
}

// ── index.html 의 @font-face · 글꼴 줄(--font-ui) ──
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const faces = [...html.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
  const fam = /font-family:\s*'([^']+)'/.exec(body)?.[1];
  const url = /url\('\/fonts\/([^']+)'\)/.exec(body)?.[1];
  const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1].trim();
  const ur = /unicode-range:\s*([^;]+);?/.exec(body)?.[1];
  const ranges = ur ? ur.split(',').map((s) => s.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h, 16))).map(([a, b]) => [a, b ?? a]) : null;
  return { fam, url, weight, ranges, cmap: woff2Cmap(path.join(ROOT, 'public/fonts', url)) };
});
const stack = /--font-ui:\s*([^;]+);/.exec(html)[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
const inRange = (f, cp) => !f.ranges || f.ranges.some(([a, b]) => cp >= a && cp <= b);
/** 이 글자를 그리는 우리 글꼴 (글꼴 줄 차례) — 없으면 null. 범위 안인데 파일에 없는 것은 warn 에 적는다 */
const warn = new Map();
function drawnBy(cp) {
  for (const fam of stack) {
    const fs_ = faces.filter((f) => f.fam === fam && inRange(f, cp));
    if (!fs_.length) continue;
    if (fs_.every((f) => f.cmap.has(cp))) return fam;
    for (const f of fs_) if (!f.cmap.has(cp) && f.ranges) warn.set(`${f.url} U+${cp.toString(16).toUpperCase()}`, true);
  }
  return null;
}

// ── 화면 글 ──
const parts = []; // { text, loc }
const rows = await collectTexts({ characters: true });
for (const r of rows) parts.push({ text: r.text, loc: r.loc });
// 무대 줄 — stages.js 는 무대 그림 모듈을 함께 읽어 무거우니 이름표만 글자 그대로 읽는다
const stagesSrc = fs.readFileSync(path.join(ROOT, 'src/stages.js'), 'utf8');
const nameKo = /export const STAGE_NAME_KO = \{([\s\S]*?)\};/.exec(stagesSrc)?.[1] ?? '';
for (const m of nameKo.matchAll(/'([^']+)'/g)) parts.push({ text: `스테이지 10 · ${m[1]}`, loc: 'src/stages.js STAGE_NAME_KO' });
// index.html 의 한글 없는 글(collectTexts 가 건너뜀 — 돌려 달라는 안내의 📱↻ · 일시정지 Ⅱ · 제목 Stillness)
for (const t of htmlTexts(html)) if (!/[가-힣]/.test(t.text)) parts.push({ text: t.text, loc: `index.html:${t.line}` });
// main.js 의 한글 없는 기호 글 (독일 감아 들기 칸 ▮▯ 등 — collectTexts 는 한글 있는 글만 모은다)
for (const s of jsStrings(fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8'))) if (/[^\x00-\x7f]/.test(s.text) && !/[가-힣]/.test(s.text)) parts.push({ text: s.text, loc: `src/main.js:${s.line}` });
// 테스트 고르기 화면: test.html 글 · test_pick.js · test_route.js 글
for (const t of htmlTexts(fs.readFileSync(path.join(ROOT, 'test.html'), 'utf8'))) parts.push({ text: t.text, loc: `test.html:${t.line}` });
for (const f of ['src/test_pick.js', 'src/test_route.js']) for (const s of jsStrings(fs.readFileSync(path.join(ROOT, f), 'utf8'))) if (/[^\x00-\x7f]/.test(s.text)) parts.push({ text: s.text, loc: `${f}:${s.line}` });

const EMOJI = (cp) => cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f || cp === 0x200d;
const miss = new Map();
const emoji = new Map();
const byFam = new Map();
for (const p of parts) {
  for (const ch of p.text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x21) continue; // 빈칸·줄바꿈
    const fam = drawnBy(cp);
    if (fam) {
      if (!byFam.has(fam)) byFam.set(fam, new Set());
      byFam.get(fam).add(ch);
      continue;
    }
    const bucket = EMOJI(cp) ? emoji : miss;
    const e = bucket.get(ch) ?? { n: 0, loc: new Set(), ex: p.text };
    e.n++;
    e.loc.add(p.loc);
    bucket.set(ch, e);
  }
}
const hex = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const show = (m) => [...m].map(([ch, e]) => `  ${ch} ${hex(ch)} × ${e.n} — ${[...e.loc].slice(0, 3).join(' · ')}${e.loc.size > 3 ? ' …' : ''}\n      예: ${e.ex.slice(0, 60)}`).join('\n');
console.log(`글꼴 줄: ${stack.slice(0, 5).join(' → ')} → (시스템)`);
for (const f of faces) console.log(`  ${f.fam} ${f.weight} ${f.url}: ${f.cmap.size} 자${f.ranges ? ` · 범위 ${f.ranges.length} 토막` : ''}`);
console.log(`화면 글 ${rows.length} 줄 + 무대·기호·테스트 화면 → 조각 ${parts.length} 개`);
for (const [fam, set] of byFam) console.log(`  ${fam} 로 그리는 글자 ${set.size} 종${set.size <= 60 ? ': ' + [...set].join('') : ''}`);
console.log(`우리 글꼴에 없는 글자(시스템 글꼴로 그려짐): ${miss.size} 종${miss.size ? '\n' + show(miss) : ''}`);
console.log(`이모지 (시스템 글꼴로 그림 — 맞음): ${emoji.size} 종${emoji.size ? '\n' + show(emoji) : ''}`);
if (warn.size) console.log(`범위(unicode-range) 안인데 파일에 없는 글자 ${warn.size} — 다음 글꼴로 넘어감: ${[...warn.keys()].slice(0, 8).join(' · ')}`);
process.exit(miss.size ? 1 : 0);
