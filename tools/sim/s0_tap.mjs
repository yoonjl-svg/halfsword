// s0_diff.mjs 의 스텝 탭 (node --import 로 먼저 읽는다). 물리를 바꾸지 않는다: 읽기만, 난수·차례 영향 없음
//  S0_TAP=<파일> 이면 물리 스텝(world.step)마다 한 줄: 몸 전부(자리·자세·속도)의 해시, 파이터마다 손짓 S·드라이브 w·옛 결심 on
//  S0_ROOT=<체크아웃> (기본 이 저장소): 그 체크아웃의 Rapier 모듈을 고친다 (도구와 같은 모듈 인스턴스)
//  파이터 찾기: src 를 미리 읽지 않는다 (with_config 가 설정을 바꾸기 전에 모듈 윗단 상수가 굳으면 안 된다) →
//   Object.prototype 에 'ges' 세터를 두어 Fighter 생성자의 this.ges = … 대입 때 그 파이터를 적는다 (그 뒤는 보통 속성)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = process.env.S0_TAP;
if (OUT) {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(process.env.S0_ROOT || path.resolve(HERE, '..', '..'));
  const R = (await import(pathToFileURL(path.join(ROOT, 'node_modules/@dimforge/rapier3d-compat/rapier.mjs')).href)).default;
  const byWorld = new WeakMap(); // world → 파이터들
  Object.defineProperty(Object.prototype, 'ges', {
    configurable: true,
    get: () => undefined,
    set(v) {
      if (this && this.world && this.index != null) (byWorld.get(this.world) || byWorld.set(this.world, []).get(this.world)).push(this);
      Object.defineProperty(this, 'ges', { value: v, writable: true, enumerable: true, configurable: true });
    },
  });
  // 줄: 판 번호, 판 안 스텝, 해시, S(P), w(P), cm(P), S(E), w(E), cm(E)
  let cap = 1 << 16, n = 0;
  let H = new Uint32Array(cap), RD = new Int32Array(cap), ST = new Int32Array(cap), SP = new Float64Array(cap * 2), WP = new Float64Array(cap * 2), CM = new Uint8Array(cap * 2);
  const grow = () => {
    cap *= 2;
    const g = (A, k = 1) => { const B = new A.constructor(cap * k); B.set(A); return B; };
    H = g(H); RD = g(RD); ST = g(ST); SP = g(SP, 2); WP = g(WP, 2); CM = g(CM, 2);
  };
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  let h = 0;
  const mix = (x) => {
    f64[0] = x;
    h = Math.imul(h ^ u32[0], 16777619) >>> 0;
    h = Math.imul(h ^ u32[1], 16777619) >>> 0;
  };
  const worlds = new WeakMap();
  let nWorld = 0;
  const step0 = R.World.prototype.step;
  R.World.prototype.step = function (...a) {
    const r = step0.apply(this, a);
    let w = worlds.get(this);
    if (!w) worlds.set(this, (w = { id: nWorld++, k: 0 }));
    h = 2166136261;
    this.bodies.forEach((b) => {
      const t = b.translation(), q = b.rotation(), v = b.linvel(), o = b.angvel();
      mix(t.x), mix(t.y), mix(t.z), mix(q.x), mix(q.y), mix(q.z), mix(q.w), mix(v.x), mix(v.y), mix(v.z), mix(o.x), mix(o.y), mix(o.z);
    });
    if (n >= cap) grow();
    H[n] = h;
    RD[n] = w.id;
    ST[n] = w.k++;
    for (const f of byWorld.get(this) || []) {
      const j = f.index === 1 ? 1 : 0;
      SP[n * 2 + j] = f.ges?.S ?? 0;
      WP[n * 2 + j] = f.drive?.w ?? 0;
      CM[n * 2 + j] = f.commit?.on ? 1 : 0;
    }
    n++;
    return r;
  };
  process.on('exit', () => {
    const b64 = (A) => Buffer.from(A.buffer, 0, n * A.BYTES_PER_ELEMENT * (A.length / cap)).toString('base64');
    fs.writeFileSync(OUT, JSON.stringify({ format: 's0-tap/1', n, hash: b64(H), round: b64(RD), step: b64(ST), S: b64(SP), w: b64(WP), cm: b64(CM) }));
  });
}
