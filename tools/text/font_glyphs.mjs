// 화면 글꼴 빠진 글자 점검 (10/14 도트 글꼴 — docs/ui/pixel_font_2026-10-14.md)
//  화면 글(texts.mjs collectTexts — 유파·자세표·무기·인물·main.js·index.html 글 + 무대 이름 + test.html·test_pick.js 글)을
//  public/fonts 의 갈무리11 보통(400)·굵게(700) 글자표(cmap)와 대조한다. 굵게 그리는 자리(800·700)의 글은 굵은 파일에도 있어야 한다 —
//  없으면 그 글자만 다음 글꼴(시스템 굵은 글꼴)로 섞여 그려진다.
//   굵은 자리: 자세·기술·비기·패시브·고유 동작·속임수 이름의 한국어 몫(괄호 앞 — 오른쪽 위 첫 줄 · 왼쪽 위) · 무기 이름 괄호 앞(카드 .wname) · 등급 · 인물 이름 · 무대 줄.
//   보통 자리: 이름의 원어 몫(괄호 안 — 둘째 줄 500) · 설명 · 칭호 · 대사. 어느 쪽인지 가리기 어려운 글(main.js·HTML 글)은 두 파일 모두 본다.
//  WOFF2 는 의존성 없이 읽는다 (node:zlib 브로틀리 · cmap 형식 4/12).
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
const FONTS = path.join(ROOT, 'public/fonts');
const REG = woff2Cmap(path.join(FONTS, 'Galmuri11.woff2'));
const BOLD = woff2Cmap(path.join(FONTS, 'Galmuri11-Bold.woff2'));

// main.js splitName 과 같은 규칙: '한국어 (원어)' → [한국어(첫 줄, 굵게), 원어(둘째 줄, 500)]
function splitName(s) {
  const m = /^(.*?)\s*\(([^()]*)\)\s*(.*)$/.exec(s ?? '');
  if (!m || !m[1]) return [s ?? '', ''];
  const rest = m[3].replace(/^·\s*/, '');
  if (!rest || m[3].startsWith('·')) return [m[1], [m[2], rest].filter(Boolean).join(' · ')];
  return [`${m[1]} ${rest}`, m[2]];
}
const NAME_FIELDS = new Set(['guard.name', 'frame.name', 'cover.name', 'tech.name', 'unique.nameKo', 'feint.name', 'passive.nameKo', 'secret.nameKo', 'secret.seq.nameKo']);
const REG_FIELDS = new Set(['guard.desc', 'frame.desc', 'weapon.desc', 'weapon.ability', 'char.epithet', 'char.line', 'char.taunt', 'school.nameKo', 'branch.nameKo']);
const parts = []; // { text, need: 'bold' | 'regular' | 'both', loc }
const rows = await collectTexts({ characters: true });
for (const r of rows) {
  if (NAME_FIELDS.has(r.field)) {
    const [a, b] = splitName(r.text);
    parts.push({ text: a, need: 'bold', loc: r.loc }, { text: b, need: 'regular', loc: r.loc });
  } else if (r.field === 'weapon.nameKo') {
    const [, main, sub] = r.text.match(/^(.*?)\s*\((.*)\)\s*$/) || [null, r.text, ''];
    parts.push({ text: main, need: 'bold', loc: r.loc }, { text: sub, need: 'regular', loc: r.loc });
  } else if (r.field === 'tier' || r.field === 'char.name') parts.push({ text: r.text, need: 'bold', loc: r.loc });
  else if (REG_FIELDS.has(r.field)) parts.push({ text: r.text, need: 'regular', loc: r.loc });
  else parts.push({ text: r.text, need: 'both', loc: r.loc });
}
// 무대 줄 (왼쪽 위 800) — stages.js 는 무대 그림 모듈을 함께 읽어 무거우니 이름표만 글자 그대로 읽는다
const stagesSrc = fs.readFileSync(path.join(ROOT, 'src/stages.js'), 'utf8');
const nameKo = /export const STAGE_NAME_KO = \{([\s\S]*?)\};/.exec(stagesSrc)?.[1] ?? '';
for (const m of nameKo.matchAll(/'([^']+)'/g)) parts.push({ text: `스테이지 10 · ${m[1]}`, need: 'bold', loc: 'src/stages.js STAGE_NAME_KO' });
// index.html 의 한글 없는 글(collectTexts 가 건너뜀 — 돌려 달라는 안내의 📱↻ · 일시정지 Ⅱ · 제목 Stillness): 모두 보통 굵기 자리
for (const t of htmlTexts(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))) if (!/[가-힣]/.test(t.text)) parts.push({ text: t.text, need: 'regular', loc: `index.html:${t.line}` });
// 테스트 고르기 화면: test.html 글 · test_pick.js 글 (굵기가 섞여 두 파일 모두)
for (const t of htmlTexts(fs.readFileSync(path.join(ROOT, 'test.html'), 'utf8'))) parts.push({ text: t.text, need: 'both', loc: `test.html:${t.line}` });
for (const f of ['src/test_pick.js', 'src/test_route.js']) for (const s of jsStrings(fs.readFileSync(path.join(ROOT, f), 'utf8'))) if (/[^\x00-\x7f]/.test(s.text)) parts.push({ text: s.text, need: 'both', loc: `${f}:${s.line}` });

const EMOJI = (cp) => cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || cp === 0xfe0f || cp === 0x200d;
const miss = { bold: new Map(), regular: new Map(), emoji: new Map() };
const chars = { bold: new Set(), regular: new Set() };
for (const p of parts) {
  for (const ch of p.text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20) continue;
    const want = p.need === 'both' ? ['bold', 'regular'] : [p.need];
    for (const k of want) {
      chars[k].add(ch);
      const has = (k === 'bold' ? BOLD : REG).has(cp);
      if (has) continue;
      const bucket = EMOJI(cp) ? miss.emoji : miss[k];
      const e = bucket.get(ch) ?? { n: 0, loc: new Set(), ex: p.text };
      e.n++;
      e.loc.add(p.loc);
      bucket.set(ch, e);
    }
  }
}
const hex = (ch) => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const show = (m) => [...m].map(([ch, e]) => `  ${ch} ${hex(ch)} × ${e.n} — ${[...e.loc].slice(0, 3).join(' · ')}${e.loc.size > 3 ? ' …' : ''}\n      예: ${e.ex.slice(0, 60)}`).join('\n');
console.log(`글꼴: 갈무리11 보통 ${REG.size} 자 · 굵게 ${BOLD.size} 자 (한글 음절 보통 ${[...REG].filter((c) => c >= 0xac00 && c <= 0xd7a3).length} · 굵게 ${[...BOLD].filter((c) => c >= 0xac00 && c <= 0xd7a3).length})`);
console.log(`화면 글 ${rows.length} 줄 + 무대·테스트 화면 → 조각 ${parts.length} 개 · 굵게 그릴 수 있는 글자 ${chars.bold.size} 종 · 보통으로 그리는 글자 ${chars.regular.size} 종`);
console.log(`굵은 자리인데 굵은 파일에 없는 글자: ${miss.bold.size} 종${miss.bold.size ? '\n' + show(miss.bold) : ''}`);
console.log(`보통 자리인데 보통 파일에 없는 글자: ${miss.regular.size} 종${miss.regular.size ? '\n' + show(miss.regular) : ''}`);
console.log(`이모지 (시스템 글꼴로 그림 — 맞음): ${miss.emoji.size} 종${miss.emoji.size ? '\n' + show(miss.emoji) : ''}`);
process.exit(miss.bold.size || miss.regular.size ? 1 : 0);
