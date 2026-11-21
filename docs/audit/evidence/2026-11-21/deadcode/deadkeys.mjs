import fs from 'node:fs';
const M = process.argv[2];
const C = await import(M + '/src/config.js');
const files = fs.readdirSync(M + '/src').filter((f) => f.endsWith('.js') && f !== 'config.js').map((f) => fs.readFileSync(M + '/src/' + f, 'utf8')).join('\n');
const tools = fs.readdirSync(M + '/tools/sim').filter((f) => /\.m?js$/.test(f)).map((f) => fs.readFileSync(M + '/tools/sim/' + f, 'utf8')).join('\n');
const cfgSrc = fs.readFileSync(M + '/src/config.js', 'utf8');
const fams = ['STRIKE','ARMOR','ANATOMY','VITALS','COMBAT','FINISH','STAMINA','SECRET','UNIQUE_ASSIST','SCHOOL_PASSIVE','JP_TANK','IT_OUTBOX','IB_FLOW','IB_LINK','IB_PARRY_BEAT','CN_STEP','NAGASHI','FLOW_REDESIGN','FLOW_RECOVERY','BIND','GUARD_LINE','SKILL','THRUST','BURST_WHIFF','WHIP_KNEEL','OKORI','MINDSET','AI_PROFICIENCY','AI_KIT','DE_VITALITY','DE_DIRTY','DIG_PROTO','AI_PLAN','AI_PLAN_JP','AI_PLAN_DE','AI_PLAN_FREE','STEEL','BALANCE','CLOSE','RECOIL','POMMEL','LONE','LETTER','PROF_BODY','SKILL_BODY','WEAPON_ABILITY'];
let tot = 0, totDead = 0, totToolOnly = 0; const rows = [];
for (const F of fams) {
  const o = C[F]; if (!o || typeof o !== 'object') continue;
  const keys = Object.keys(o); const dead = [], toolOnly = [];
  for (const k of keys) {
    const re = new RegExp('\\b' + k + '\\b');
    const inSrc = re.test(files) || (cfgSrc.match(new RegExp('\\b' + k + '\\b', 'g')) || []).length > 1;
    if (!re.test(files)) { if (re.test(tools)) toolOnly.push(k); else dead.push(k); }
  }
  tot += keys.length; totDead += dead.length; totToolOnly += toolOnly.length;
  rows.push(`${F}: keys ${keys.length} · not read in src ${dead.length + toolOnly.length} (tools-only ${toolOnly.length}) ${dead.concat(toolOnly.map((k) => k + '*')).join(' ')}`);
}
console.log(rows.join('\n')); console.log(`TOTAL keys ${tot} · not read by src ${totDead + totToolOnly} (tools-only ${totToolOnly})`);
