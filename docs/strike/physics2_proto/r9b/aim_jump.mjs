// 겨눔 명령(aimDirW)이 한 스텝에 10° 넘게 뛰는 스텝 세기 + 뛰는 스텝에서 뒤집힌 가지 · 조건 (재기만)
//  node aim_jump.mjs --root=<inst_aim.py 를 넣은 나무> [--weapons=longsword,zweihander,rapier] [--seeds=1,2] [--secs=20] [--json=<파일>]
//  판 = off_cmd.mjs 와 같은 판(harness_m newRound · 벽 · AI 둘) · 두 싸움꾼 · 서 있는 스텝(앞 스텝도 서 있음)만.
//  고리 없는 나무면 aimDirW 뜀 수와 빈 위팔 명령 뜀만 셈(까닭 표 없음).
//  까닭: 교정 전 겨눔(aimRawW)이 10° 넘게 뜀 → '교정 전'(자세 지도 · 보정 · 그 뒤) / 아니면 손목 교정(wristGuardAim) — 지난 스텝과 이 스텝의 가지 · wristClamp 조건을 '앞 → 뒤' 로
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const DT = 1 / 120, HD = 180 / Math.PI;
const GAP = (await import(u('src/config.js'))).SKILL.armClear.gap;
const ang = (a, b) => (a && b ? Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * HD : 0);
const weapons = String(args.weapons ?? 'longsword').split(',');
const seeds = String(args.seeds ?? '1').split(',').map(Number);
const secs = +(args.secs ?? 20);
globalThis.__A = {};
const tag = (d) => (d ? `${d.br ?? '-'}/${d.wc ? d.wc.g + (d.wc.g === 'clamp' ? (d.wc.d > 0 ? '+' : '−') : '') : '-'}` : '?');
const out = {};
for (const w of weapons) {
  const R = (out[w] = { steps: 0, jump: 0, flip2: 0, cause: {}, ex: [], off: { n: 0, jump: 0, withAim: 0, cause: {}, ex: [] }, twoHand: null });
  for (const seed of seeds) {
    const G = H.newRound({ walls: true, seed, weapon: w, weapon2: w, AI2Class: H.AI });
    const st = [G.player, G.enemy].map((f) => ({ f, p: null, pp: null, ad: null, q: null, stand: false, aimJ: false }));
    R.twoHand = !!G.player.weaponCfg.twoHand;
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      for (const S of st) {
        const f = S.f;
        const ok = f.state === 'stand' && f.armed;
        const a = f.aimDirW.clone();
        const ad = f._ad ?? null;
        const q = f.jointByName.uarmO?.target.clone() ?? null;
        if (ok && S.stand) {
          R.steps++;
          const j = ang(a, S.p);
          const aimJ = j > 10;
          if (aimJ) {
            R.jump++;
            if (S.pp && ang(a, S.pp) < j / 3) R.flip2++; // 두 스텝 전 자리로 되돌아옴 = 두 자리를 오감
            let k;
            if (!ad || !S.ad) k = '(고리 없음)';
            else if (ang(ad.s2, S.ad.s2) > 10) k = '교정 전: ' + (ang(ad.s0, S.ad.s0) > 10 ? '자세 지도 · 기술 겨눔' : ang(ad.s1, S.ad.s1) > 10 ? '보정(corrStep)' : '세로 이월 · 기력');
            else k = `손목 교정: ${tag(S.ad)} → ${tag(ad)}`;
            R.cause[k] = (R.cause[k] ?? 0) + 1;
            if (ad && S.ad && k.startsWith('손목') && R.ex.length < 8) R.ex.push(`seed ${seed} t ${(i * DT).toFixed(3)} ${j.toFixed(0)}° ${k} · 앞 ${JSON.stringify(S.ad.wc, (kk, v) => (typeof v === 'number' ? +v.toFixed(1) : v))} 뒤 ${JSON.stringify(ad.wc, (kk, v) => (typeof v === 'number' ? +v.toFixed(1) : v))} · 교정 전 뜀 ${ang(ad.s2, S.ad.s2).toFixed(1)}° · 팔꿈치 돌림 ${(S.ad.sw * HD).toFixed(0)} → ${(ad.sw * HD).toFixed(0)}`);
          }
          if (q && S.q) {
            R.off.n++;
            if (2 * Math.acos(Math.min(1, Math.abs(q.dot(S.q)))) * HD > 8) {
              R.off.jump++;
              if (aimJ || S.aimJ) R.off.withAim++;
              // 빈 위팔 명령 뜀의 까닭: 빈손 목표(gripAim)의 어느 몫이 뛰었나 (offHand 고리 — 이 스텝과 앞 스텝)
              const o = f._od, po = S.od;
              let k;
              if (!o || !po) k = '(고리 없음 · 쥐지 않는 스텝)';
              else if (o.push > 1e-6 !== po.push > 1e-6) k = `빈손 비킴 켜짐 ↔ 꺼짐: ${o.clrOn !== po.clrOn ? '두 팔 붙음 신호(_clrOn)' : o.gap < GAP !== po.gap < GAP ? '겉 틈 문턱(armClrGap < gap)' : '칼 아래팔에서 grip 밖 ↔ 안'}`;
              else if (o.push > 1e-6 && o.g.clone().sub(o.g0).distanceTo(po.g.clone().sub(po.g0)) > 0.02) k = '빈손 비킴 미는 몫 · 쪽이 2 cm 넘게 바뀜';
              else if (o.g0.distanceTo(po.g0) > 0.03) k = aimJ ? '겨눔(aimDirW) 뜀' : '칼 자리(몸)가 3 cm 넘게 옮김';
              else k = '목표 점은 이어짐 (offArmIK 안 · 가슴 돌아감)';
              R.off.cause[k] = (R.off.cause[k] ?? 0) + 1;
              if (o && po && R.off.ex.length < 6) R.off.ex.push(`seed ${seed} t ${(i * DT).toFixed(3)} ${k} · 틈 ${po.gap?.toFixed(3)} → ${o.gap?.toFixed(3)} · 민 몫 ${po.push.toFixed(3)} → ${o.push.toFixed(3)} m · 목표 점 옮김 ${o.g.distanceTo(po.g).toFixed(3)} m`);
            }
          }
          S.aimJ = aimJ;
        } else S.aimJ = false;
        S.pp = ok && S.stand ? S.p : null;
        S.p = a;
        S.ad = ad;
        if (ok && f._od) {
          // 빈손 비킴 조건별 스텝 수: 실제로 민 스텝 · 조건 없이(칼 아래팔에서 grip 안이면 늘) 밀 스텝 · 그 가운데 두 팔 붙음 신호 켜진 스텝
          const C = (R.clr ||= { n: 0, pushed: 0, geo: 0, geoOn: 0, geoGap: 0 });
          C.n++;
          if (f._od.push > 1e-6) C.pushed++;
          if (f._od.pushFull > 1e-6) {
            C.geo++;
            if (f._od.clrOn) C.geoOn++;
            if (f._od.gap < GAP) C.geoGap++;
          }
        }
        S.od = f._od ?? null;
        f._od = null;
        S.q = q;
        S.stand = ok;
      }
    }
    G.world?.free?.();
  }
  console.log(`${w} (두손 ${R.twoHand}) 씨앗 ${seeds.join(',')} · ${secs} s: aimDirW 10° 넘게 뜀 ${R.jump}/${R.steps} (두 자리 오감 ${R.flip2}) · 빈 위팔 명령 8° 넘게 뜀 ${R.off.jump}/${R.off.n} (그 가운데 겨눔 뜀과 같은 · 다음 스텝 ${R.off.withAim})`);
  for (const [k, v] of Object.entries(R.cause).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);
  for (const e of R.ex) console.log('    ' + e);
  if (R.clr) console.log(`  빈손 비킴: 쥔 스텝 ${R.clr.n} · 실제로 민 스텝 ${R.clr.pushed} · 칼 아래팔에서 grip 안(조건 없이 밀 스텝) ${R.clr.geo} — 그 가운데 두 팔 붙음 신호 ${R.clr.geoOn} · 겉 틈 < gap ${R.clr.geoGap}`);
  console.log('  빈 위팔 명령 뜀의 까닭:');
  for (const [k, v] of Object.entries(R.off.cause).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);
  for (const e of R.off.ex) console.log('    ' + e);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
