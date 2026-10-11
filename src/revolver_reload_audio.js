// ─────────────────────────────────────────────────────────────
//  리볼버 장전 녹음 (사장님 10/12 지시로 샛별 저장소 fe8b170·666c07f·b6c83ab 에서 가져옴)
//   녹음: AugustSandberg "Revolver Reload" (Ruger GP100, CC0) — 출처·구간·해시는 public/sfx/revolver/README.md · provenance.json
//   언제 울릴지는 gun.js 가 정한다(물리 스텝 시계). 여기는 한 번에 소리 하나만 낸다 — 따로 시계를 돌리거나, 내려받기가 끝난 뒤 늦게 울리지 않는다.
//   녹음을 못 받았거나 소리 조각이 꺼져 있으면(SOUND.samples) 짧은 합성 '딸깍'으로 대신한다. 합성은 자체 난수라 판의 Math.random 을 쓰지 않는다.
// ─────────────────────────────────────────────────────────────
const FILES = ['open', 'insert1', 'insert2', 'insert3', 'insert4', 'insert5', 'insert6', 'close'];
const banks = new WeakMap();
const rounds = new WeakMap();
// 소리 세기: 열기 · 한 발 넣기 · 닫기 (각각 ×1.2 — 그쪽 666c07f). 닫기는 여섯 번의 넣기와 구별되게 가장 크게. 원래 빠르기, 덧댄 알림음 없음
const GAIN = { open: 0.65 * 1.2, insert: 0.95 * 1.2, close: 1.2 * 1.2 };

function bankFor(ctx) {
  let bank = banks.get(ctx);
  if (!bank) {
    bank = { recorded: {}, fallback: {}, ready: null };
    banks.set(ctx, bank);
  }
  return bank;
}

/** 첫 발(소리가 풀린 뒤)에 부른다 — 장전 전에 녹음 여덟 개가 다 와 있게 */
export function prepareRevolverReload(snd) {
  if (!snd?.ctx || snd.useSamples === false) return Promise.resolve(false);
  const c = snd.ctx;
  const bank = bankFor(c);
  if (!bank.ready) {
    bank.ready = Promise.all(
      FILES.map(async (name) => {
        try {
          const res = await fetch(new URL(`sfx/revolver/${name}.wav`, document.baseURI));
          if (!res.ok) return false;
          const bytes = await res.arrayBuffer();
          // 콜백·프라미스 둘 다 받는다 (옛 사파리 — Sound.decodeSample 과 같게)
          const buffer = await new Promise((ok, bad) => c.decodeAudioData(bytes, ok, bad)?.then?.(ok, bad));
          bank.recorded[name] = buffer;
          return true;
        } catch {
          return false;
        }
      }),
    ).then((loaded) => loaded.every(Boolean));
  }
  return bank.ready;
}

// 녹음이 없을 때만: 짧게 잦아드는 넓은 대역 '딸깍'. 녹음이 아닌 합성 대신음. 자체 난수(판의 난수를 쓰지 않음)
function fallback(c, bank, key, kind, variant) {
  if (bank.fallback[key]) return bank.fallback[key];
  const duration = kind === 'open' ? 0.4 : kind === 'close' ? 0.23 : 0.18;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate);
  const x = buffer.getChannelData(0);
  let seed = (0x6a09e667 ^ ((variant + 1) * 0x85ebca6b)) >>> 0;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const contacts =
    kind === 'open'
      ? [[0, 0.6, 0.014], [0.1, 0.3, 0.03], [0.24, 0.18, 0.013]]
      : kind === 'close'
        ? [[0, 0.8, 0.018], [0.075, 0.4, 0.01]]
        : [[0, 0.35, 0.008], [0.055, 0.65, 0.017]];
  for (const [start, amp, decay] of contacts) {
    let low = 0;
    let body = 0;
    const first = Math.round(start * c.sampleRate);
    for (let i = first; i < x.length; i++) {
      const t = (i - first) / c.sampleRate;
      low += (random() - low) * (1 - Math.exp((-2 * Math.PI * 5200) / c.sampleRate));
      body += (low - body) * (1 - Math.exp((-2 * Math.PI * 180) / c.sampleRate));
      x[i] += (low - body) * amp * Math.min(1, t / 0.001) * Math.exp(-t / decay);
    }
  }
  const fade = Math.min(x.length, Math.round(c.sampleRate * 0.02));
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade;
  bank.fallback[key] = buffer;
  return buffer;
}

/** 열기·한 발 넣기·닫기 하나를 지금 스텝에 낸다. roundNumber = gun.js 가 넘기는 1~6 번째 탄 (두 사수가 같은 Sound 를 써도 서로 순서를 흐트러뜨리지 않게) */
export function playRevolverReload(snd, pos, kind, roundNumber) {
  if (!snd?.ctx || !snd._on || !Object.hasOwn(GAIN, kind)) return null;
  const bank = bankFor(snd.ctx);
  if (kind === 'open') rounds.set(snd, 0);
  const indexed = Number.isInteger(roundNumber) && roundNumber >= 1 && roundNumber <= 6;
  const variant = indexed ? roundNumber - 1 : rounds.get(snd) || 0;
  const key = kind === 'insert' ? `insert${(variant % 6) + 1}` : kind;
  if (kind === 'insert' && !indexed) rounds.set(snd, variant + 1);
  void prepareRevolverReload(snd);
  const recorded = snd.useSamples !== false && bank.recorded[key];
  const buffer = recorded || fallback(snd.ctx, bank, key, kind, variant % 6);
  const ev = snd.event({ bus: snd.metalBus, gain: GAIN[kind], prio: 1, pos });
  snd.layer(ev, buffer);
  return ev;
}
