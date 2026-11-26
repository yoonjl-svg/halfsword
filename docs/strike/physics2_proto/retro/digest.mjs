// 세션 기록에서 사장님 말씀 · 물리 2.0 세션의 보고(글 덩이) · 다른 세션 알림만 시간순으로 뽑는다 (도구 호출 · 도구 출력 · 생각은 뺌)
import fs from 'node:fs';
const F = process.argv[2], OUT = process.argv[3];
const lines = fs.readFileSync(F, 'utf8').split('\n').filter(Boolean);
const types = {};
const out = [];
const clip = (s, n) => (s.length > n ? s.slice(0, n) + ` …(${s.length - n}자 줄임)` : s);
for (const ln of lines) {
  let j; try { j = JSON.parse(ln); } catch { continue; }
  types[j.type] = (types[j.type] || 0) + 1;
  const ts = (j.timestamp || '').slice(0, 16).replace('T', ' ');
  if (j.type === 'queue-operation' && j.operation === 'enqueue' && typeof j.content === 'string') {
    if (/^\[(디렉터|감사)/.test(j.content.trim())) out.push(`### ${ts} · 다른 세션 알림\n${clip(j.content.trim(), 1200)}\n`);
    continue;
  }
  const m = j.message;
  if (!m) continue;
  if (j.type === 'user') {
    const parts = typeof m.content === 'string' ? [m.content] : (m.content || []).filter((c) => c.type === 'text').map((c) => c.text);
    for (let t of parts) {
      t = t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
      if (!t) continue;
      if (/^\[SYSTEM NOTIFICATION|^<task-notification|^This session is being continued|^Caveat:|^\[Request interrupted|^<command-message>|^Base directory for this skill|^# Workflow authoring|^This session's worker process|^Stop hook feedback|^<local-command|^# \S+ skill/.test(t)) continue;
      if (/^Another \S+ session sent a message/.test(t)) { out.push(`### ${ts} · 일꾼 보고(요약)\n${clip(t.replace(/^[\s\S]*?The report follows:\s*/, ''), 900)}\n`); continue; }
      out.push(`### ${ts} · **사장님**\n${clip(t, 2500)}\n`);
    }
  } else if (j.type === 'assistant') {
    const texts = (m.content || []).filter((c) => c.type === 'text').map((c) => c.text.trim()).filter((t) => t.length >= 220);
    for (const t of texts) out.push(`### ${ts} · 물리 2.0 세션의 보고\n${clip(t, 2200)}\n`);
  }
}
fs.writeFileSync(OUT, `# 물리 2.0 세션 기록 요약본 (대본이 뽑음 — 사장님 말씀 · 세션의 보고 · 다른 세션 알림 · 일꾼 보고 요약 · 시간은 UTC)\n\n` + out.join('\n'));
console.log(JSON.stringify(types), '· 뽑은 덩이', out.length, '· 글자', out.join('\n').length);
console.log('사장님 말씀', out.filter((x) => x.includes('**사장님**')).length, '· 보고', out.filter((x) => x.includes('세션의 보고')).length, '· 알림', out.filter((x) => x.includes('다른 세션 알림')).length, '· 일꾼', out.filter((x) => x.includes('일꾼 보고')).length);
