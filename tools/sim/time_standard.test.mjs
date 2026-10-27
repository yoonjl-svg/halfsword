// 표준 시간 (사장님 10/25 22:3x '지금 이 속도를 표준 시간으로 보는 게 맞아 … 절대적 시간이 맞게끔' · '걷기 2.0도 진행하고 고노센 달려듦 1.2도 실제 시간으로 해'
//  — src/config.js TIME · docs/strike/time_standard_2026-10-25.md · 확인표 2590 ~ 2599):
//  ① 장치: 시뮬 기본 = 켬 · 템포 1.1 · 실제 초 → 게임 초 × 1.1 · 실제 m/s → 게임 m/s ÷ 1.1
//  ② 걷기 실제 2.0 m/s · 고노센 달려듦 실제 1.2 m/s · 비기 창 실제 0.6 s
//  ③ 비기 규칙 시간 열쇠(SECRET 안 이름 끝이 Time · Window · Hold · Grace · Stiff · Rest · Press · Dwell · Full · Reset · Gap · Cool · Delay · ArmSlow · BeatMin)는
//     config.js 에 realS( … ) 로 적혀 있어야 한다 — 다른 가지를 합칠 때 맨 수(게임 초)로 들어오면 여기서 걸린다. 몸 · 칼 동작 시간 · 이미 실제 시간인 열쇠는 KEEP 에 까닭과 함께
//  ④ 옛 판 TIME_STD=0 = 적힌 수가 그대로 게임 값
//  node --test tools/sim/time_standard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as CONFIG from '../../src/config.js';

const { TIME, realS, realV, realRate, GAIT, SECRET } = CONFIG;
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≈ ${b}`);
const OLD = TIME.on === 0; // 시험 묶음을 TIME_STD=0 으로 돌린 때

test('장치: 켬 · 템포 1.1 · realS × 1.1 · realV ÷ 1.1 · realRate ÷ 1.1', () => {
  if (OLD) return;
  assert.equal(TIME.on, 1);
  near(TIME.tempo, 1.1); near(TIME.std, TIME.tempo); near(TIME.k, 1.1);
  near(realS(0.6), 0.66); near(realV(1.1), 1); near(realRate(11), 10);
});

test('사장님 10/25 22:3x: 걷기 실제 2.0 m/s · 고노센 달려듦 실제 1.2 m/s · 비기 창 실제 0.6 s', () => {
  if (OLD) return;
  near(GAIT.moveSpeed * TIME.k, 2.0);
  near(SECRET.foeChargeSpeed * TIME.k, 1.2);
  near(SECRET.playerWindow / TIME.k, 0.6);
});

// SECRET 안에서 이름은 시간 같지만 실제 초로 바꾸지 않는 열쇠 (까닭 — 기록 §2)
const KEEP = {
  iaiTime: '발도 동작 길이(몸 · 칼 동작)', iaiPlayerTime: '발도 동작 길이', iberianSweepTime: '휩쓸기 동작 길이', time: '동작 대본 길이(런지 · 한 바퀴)',
  inTime: '몸 덧씌우기 동작', outTime: '몸 덧씌우기 동작', releaseT: '닿기까지 내다봄(동작 기하)', recoverT: '런지 앞발 거둠 걸음 길이(동작)',
  circleTime: '이미 실제 시간(화면 프레임으로 셈)', stickTime: '이미 실제 시간', circleGap: '이미 실제 시간',
  risoStreakLife: '화면 시간', risoGlintLife: '화면 시간', instantArcLife: '화면 시간',
  secretHold: '스위치(0 · 1)', risolutoGap: '스위치(0 · 1)', handRest: '스위치(0 · 1 — 손 쉼 자리)',
};
const SUFFIX = /(?:Time|Window|Hold|Grace|Stiff|Rest|Press|Dwell|Full|Reset|Gap|Cool|Delay|ArmSlow|BeatMin)$|^(?:stiff|press|time)$/;

test('비기 규칙 시간 열쇠는 config.js 에 realS( … ) 로 (맨 수 = 게임 초가 들어오면 걸림)', () => {
  const file = fileURLToPath(new URL('../../src/config.js', import.meta.url));
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const a = lines.findIndex((l) => l.startsWith('export const SECRET = {'));
  let b = a + 1;
  while (b < lines.length && !lines[b].startsWith('};')) b++;
  assert.ok(a > 0 && b < lines.length, 'SECRET 덩이');
  const bad = [];
  for (let i = a + 1; i < b; i++) {
    const code = lines[i].replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '');
    for (const m of code.matchAll(/([A-Za-z_]\w*)\s*:\s*(\{|real[SVR]\w*\(|-?[0-9.]+)/g)) {
      const [, k, v] = m;
      if (!SUFFIX.test(k) || k in KEEP) continue;
      if (v === '{') { // stiff: { german: realS(…), … } — 칸마다
        const inner = code.slice(m.index).match(/\{([^}]*)\}/)?.[1] ?? '';
        for (const [, kk, vv] of inner.matchAll(/(\w+)\s*:\s*(real[SVR]\w*\(|-?[0-9.]+)/g)) if (!/^real/.test(vv)) bad.push(`${i + 1}: ${k}.${kk}`);
        continue;
      }
      if (!/^real/.test(v)) bad.push(`${i + 1}: ${k}`);
    }
  }
  assert.deepEqual(bad, [], `실제 초로 적을 열쇠가 맨 수: ${bad.join(' · ')} — realS(초)로 감싸거나 KEEP 에 까닭과 함께`);
});

test('옛 판 TIME_STD=0: 적힌 수가 그대로 게임 값 (걷기 1.8 · 달려듦 1.2 · 창 0.6 · 일본 굳음 1.2)', () => {
  const code = "import('./src/config.js').then((c) => console.log(JSON.stringify([c.TIME.k, c.GAIT.moveSpeed, c.SECRET.foeChargeSpeed, c.SECRET.playerWindow, c.SECRET.stiff.japanese, c.STAMINA.recoverPerSecond])))";
  const cwd = fileURLToPath(new URL('../../', import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, ['-e', code], { cwd, env: { ...process.env, TIME_STD: '0' } }).toString());
  assert.deepEqual(out, [1, 1.8, 1.2, 0.6, 1.2, 15]);
});
