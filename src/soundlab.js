// ─────────────────────────────────────────────────────────────
//  소리 들어보기 페이지 (sounds.html)
//  소리마다 약·중·강으로 틀어 보고, 예전 소리와 비교하고, 녹음 소리·울림을 켜고 끌 수 있다.
//  (분석용: window.lab.render(...) 가 소리를 OfflineAudioContext 로 그려서 숫자로 돌려준다)
// ─────────────────────────────────────────────────────────────
import { Sound } from './sound.js';
import { SOUND } from './config.js';

// 아이폰: 무음 스위치를 켜 둬도 소리가 나게 ("재생" 용도로 알린다, iOS 17+)
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch {
  /* 지원하지 않는 브라우저 */
}

// ── 예전 소리 (비교용): 사인파 3개짜리 쇳소리, 짧은 잡음 베기 소리 (c092081 까지 쓰던 방식 그대로) ──
class OldSound {
  constructor() {
    this.ctx = null;
    this.on = true;
  }
  unlock(ctx) {
    if (!this.ctx) {
      this.ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createGain();
      this.out.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.4;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended' && !this.ctx.startRendering) this.ctx.resume();
  }
  noiseBurst({ type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.002, decay = 0.15, delay = 0, freqEnd = null }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + decay + 0.05);
  }
  tone(freq, freqEnd, vol, decay, type = 'sine', delay = 0) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
  cut(energy, through) {
    const e = Math.min(1, energy / 140);
    this.noiseBurst({ type: 'bandpass', freq: 3200, freqEnd: 900, q: 1.2, vol: 0.25 + 0.4 * e, decay: through ? 0.22 : 0.12 });
    this.noiseBurst({ type: 'lowpass', freq: 500, vol: 0.2 + 0.5 * e, decay: 0.16 });
    this.tone(160, 60, 0.2 + 0.4 * e, 0.15);
  }
  stab(energy) {
    const e = Math.min(1, energy / 100);
    this.noiseBurst({ type: 'lowpass', freq: 700, vol: 0.3 + 0.4 * e, decay: 0.12 });
    this.tone(120, 50, 0.3 + 0.4 * e, 0.14);
    this.noiseBurst({ type: 'bandpass', freq: 1800, q: 3, vol: 0.12, decay: 0.08, delay: 0.02 });
  }
  blunt(energy) {
    const e = Math.min(1, energy / 120);
    this.tone(110, 45, 0.25 + 0.5 * e, 0.18);
    this.noiseBurst({ type: 'lowpass', freq: 400 + 600 * e, vol: 0.2 + 0.4 * e, decay: 0.14 });
  }
  bone(energy) {
    this.noiseBurst({ type: 'highpass', freq: 2500, vol: Math.min(0.5, energy / 200), decay: 0.04 });
    this.noiseBurst({ type: 'bandpass', freq: 1200, q: 4, vol: Math.min(0.3, energy / 300), decay: 0.06, delay: 0.01 });
  }
  clash(intensity) {
    const c = this.ctx;
    const t = c.currentTime;
    const vol = Math.min(0.5, 0.08 + intensity / 60);
    const base = 900 + Math.random() * 500;
    for (const [mul, dec] of [
      [1, 0.6],
      [2.76, 0.35],
      [5.4, 0.2],
    ]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mul;
      const g = c.createGain();
      g.gain.setValueAtTime(vol / mul ** 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }
  // 예전 게임: 투구 = clash(E/6) (+ 타박은 목록에서 따로 부른다), 칼끼리 스침/맞대기 = 0.09초마다 clash(속도)
  helmet(energy) {
    this.clash(Math.min(20, energy / 6));
  }
  whooshLoop() {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.value = 300;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.out);
    src.start();
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16));
        const t = c.currentTime;
        g.gain.setTargetAtTime(0.3 * Math.pow(x, 2.2), t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
      },
    };
  }
}

// ── 소리 목록: [이름, 설명, [약, 중, 강] 값, 트는 함수(엔진, 값)] ──
// 값은 게임 속 실제 범위(AI 대결 통계)에서 골랐다: 칼 충돌 속도 중간값 2m/s·상위 10% 6m/s, 베기 에너지 30~200J
const ROWS = [
  ['칼끼리 부딪힘', '맞닿는 속도 2 / 5 / 10 m/s', [2, 5, 10], (s, v) => s.clash(v, 0)],
  ['스치며 긁고 지나감', '빗맞은 칼: 부딪힘 1.5 / 3 / 6 + 미끄러짐 7 m/s', [1.5, 3, 6], (s, v) => s.clash(v, 7)],
  ['투구', '투구 + 타박 30 / 70 / 120 J (게임에서 함께 난다)', [30, 70, 120], (s, v) => (s.helmet(v), s.blunt(v))],
  ['베기', '35 / 70 / 140 J', [35, 70, 140], (s, v) => s.cut(v, false)],
  ['베고 지나감', '60 / 110 / 180 J', [60, 110, 180], (s, v) => s.cut(v, true)],
  ['찌르기', '20 / 50 / 100 J', [20, 50, 100], (s, v) => s.stab(v)],
  ['타박 (칼 면·손잡이)', '10 / 35 / 100 J', [10, 35, 100], (s, v) => s.blunt(v)],
  ['뼈 (머리·팔·다리 베기)', '베기 + 뼈 80 / 130 / 200 J', [80, 130, 200], (s, v) => (s.cut(v, false), s.bone(v))],
];

const $ = (id) => document.getElementById(id);
const engines = { new: null, old: null };
let which = 'new';
function engine() {
  if (!engines[which]) {
    engines[which] = which === 'new' ? new Sound() : new OldSound();
    engines[which].unlock(); // 새 소리: 소리 조각은 일꾼 스레드가 뒤에서 만든다
  }
  engines[which].unlock(); // 폰이 잠깐 소리를 멈췄으면 다시 켠다
  return engines[which];
}

// ── 화면 만들기 ──
function buildUI() {
  const list = $('rows');
  for (const [name, desc, vals, fn] of ROWS) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div><b>${name}</b><small>${desc}</small></div>`;
    const btns = document.createElement('div');
    btns.className = 'btns';
    ['약', '중', '강'].forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => {
        fn(engine(), vals[i]);
        showInfo();
      });
      btns.appendChild(b);
    });
    row.appendChild(btns);
    list.appendChild(row);
  }
  // 누르고 있는 동안: 칼 맞대고 긁기(바인드), 휘두르기
  const holds = [
    ['칼 맞대고 밀며 긁기 (누르고 있기)', '미끄러짐 1 / 2.5 / 4.5 m/s', [1, 2.5, 4.5], 'bind'],
    ['휘두르는 바람 소리 (누르고 있기)', '칼끝 10 / 15 / 20 m/s', [10, 15, 20], 'whoosh'],
  ];
  for (const [name, desc, vals, kind] of holds) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div><b>${name}</b><small>${desc}</small></div>`;
    const btns = document.createElement('div');
    btns.className = 'btns';
    ['약', '중', '강'].forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      const down = (e) => {
        e.preventDefault();
        startHold(kind, vals[i]);
      };
      b.addEventListener('pointerdown', down);
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stopHold);
      btns.appendChild(b);
    });
    row.appendChild(btns);
    list.appendChild(row);
  }
  $('demo').addEventListener('click', demo);
  document.querySelectorAll('[data-engine]').forEach((b) =>
    b.addEventListener('click', () => {
      stopHold();
      which = b.dataset.engine;
      document.querySelectorAll('[data-engine]').forEach((x) => x.classList.toggle('on', x === b));
      engine();
    }),
  );
  $('samples').addEventListener('click', (e) => {
    const s = engine();
    if (!(s instanceof Sound)) return;
    s.useSamples = !s.useSamples;
    if (s.useSamples && !Object.keys(s.samples).length) s.loadSamples();
    e.target.classList.toggle('on', s.useSamples);
  });
  $('reverb').addEventListener('click', (e) => {
    const s = engine();
    if (!(s instanceof Sound)) return;
    const on = !e.target.classList.contains('on');
    s.setReverb(on ? SOUND.reverb : 0);
    e.target.classList.toggle('on', on);
  });
}

// ── 누르고 있는 동안 도는 소리 ──
let hold = null;
function startHold(kind, v) {
  stopHold();
  const s = engine();
  const t0 = performance.now();
  if (kind === 'whoosh') {
    const loop = (engines[which + 'Whoosh'] = engines[which + 'Whoosh'] || s.whooshLoop());
    // 한 번 휘두르기 = 0.45초 동안 빨라졌다 느려짐, 누르고 있으면 되풀이
    hold = setInterval(() => {
      const u = ((performance.now() - t0) / 450) % 1;
      loop.set(v * Math.sin(Math.PI * u) ** 1.5);
    }, 16);
    hold.stop = () => loop.set(0);
  } else {
    let lastTick = 0;
    hold = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      // 미끄러지는 속도가 조금씩 흔들린다 (사람이 밀고 당기니까)
      const slide = v * (0.75 + 0.25 * Math.sin(t * 7.3) + 0.1 * Math.sin(t * 19));
      const press = 40 + 60 * v;
      if (s instanceof Sound) s.scrape(slide, press);
      else if (slide >= 2.5 && t - lastTick > 0.09) {
        // 예전 게임은 칼을 맞댄 동안 0.09초마다 "딩"을 다시 냈다
        s.clash(slide);
        lastTick = t;
      }
    }, 16);
    hold.stop = () => s instanceof Sound && s.scrape(0, 0);
  }
}
function stopHold() {
  if (!hold) return;
  clearInterval(hold);
  hold.stop();
  hold = null;
}

// ── 짧은 공방 한 장면: 휘두름 → 부딪힘 → 맞대고 긁기 → 스침 → 베기 + 뼈 ──
async function demo() {
  const s = engine();
  const w = (engines[which + 'Whoosh'] = engines[which + 'Whoosh'] || s.whooshLoop());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const swing = async (peak, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      w.set(peak * Math.sin((Math.PI * (performance.now() - t0)) / ms) ** 1.5);
      await wait(16);
    }
    w.set(0);
  };
  await swing(17, 380);
  s.clash(8, 1);
  await wait(120);
  for (let t = 0; t < 600; t += 16) {
    if (s instanceof Sound) s.scrape(1.5 + 2 * Math.sin(t / 90) ** 2, 120);
    else if (t % 96 === 0) s.clash(2.6);
    await wait(16);
  }
  if (s instanceof Sound) s.scrape(0, 0);
  await wait(200);
  await swing(14, 300);
  s.clash(2.5, 7);
  await wait(500);
  await swing(19, 350);
  s.cut(150, false);
  s.bone(150);
  await wait(700);
  await swing(15, 300);
  s.helmet(90);
  s.blunt(90);
  await wait(500);
  s.stab(60);
  showInfo();
}

function showInfo() {
  const s = engines.new;
  if (!s || which !== 'new') {
    $('info').textContent = which === 'old' ? '예전 소리: 사인파·잡음을 그때그때 만든다' : '';
    return;
  }
  const smp = Object.values(s.samples).reduce((n, l) => n + l.length, 0);
  $('info').textContent = `소리 조각 ${Object.values(s.bank).reduce((n, l) => n + l.length, 0)}개 (만드는 데 ${s.stats.genMs.toFixed(0)}ms) · 녹음 ${smp}개 · 지금까지 ${s.stats.events}번, 노드 ${s.stats.nodes}개 · 동시에 울리는 소리 ${s.voices.length}/${SOUND.maxVoices}`;
}

// ─────────────────────────────────────────────────────────────
//  분석용: 소리를 OfflineAudioContext 로 그려서 돌려준다 (헤드리스 브라우저 시험에서 쓴다)
//  events: [{ t: 초, call: '이름', args: [...] }]
// ─────────────────────────────────────────────────────────────
window.lab = {
  async render({ engine: kind = 'new', events, dur = 2, sr = 48000, samples = true, reverb = SOUND.reverb, returnAudio = true, seed = 1234 }) {
    const off = new OfflineAudioContext(2, Math.round(dur * sr), sr);
    // 만든 노드 수 세기
    const count = {};
    for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) {
      if (!k.startsWith('create') || k === 'createBuffer' || k === 'createPeriodicWave' || typeof off[k] !== 'function') continue;
      const orig = off[k].bind(off);
      off[k] = (...a) => {
        count[k] = (count[k] || 0) + 1;
        return orig(...a);
      };
    }
    let s;
    const tg = performance.now();
    if (kind === 'new') {
      s = new Sound();
      s.seed = seed;
      s.useSamples = samples;
      const r0 = SOUND.reverb;
      SOUND.reverb = reverb;
      s.unlock(off);
      SOUND.reverb = r0;
      s.prepareAll();
      if (samples) await s.samplesReady;
    } else {
      s = new OldSound();
      s.unlock(off);
    }
    const genMs = performance.now() - tg;
    const setupNodes = Object.values(count).reduce((a, b) => a + b, 0);
    const loops = {};
    const call = (e) => {
      if (e.call === 'whoosh') (loops[e.args[1] || 0] = loops[e.args[1] || 0] || s.whooshLoop()).set(e.args[0]);
      else if (e.call === 'scrape') s.scrape?.(...e.args);
      else s[e.call](...e.args);
    };
    // 같은 순간(128샘플 단위)의 소리는 한 번에 부른다 (멈춤 지점은 한 순간에 하나만 걸 수 있다)
    const groups = new Map();
    for (const e of events) {
      const q = Math.round((e.t * sr) / 128);
      if (!groups.has(q)) groups.set(q, []);
      groups.get(q).push(e);
    }
    for (const [q, list] of groups) {
      if (q <= 0) list.forEach(call);
      else off.suspend((q * 128) / sr).then(() => {
        try {
          list.forEach(call);
        } catch (err) {
          console.error(err); // 오류가 나도 그리기는 계속 (멈추면 결과가 안 나온다)
        }
        off.resume();
      });
    }
    const t0 = performance.now();
    const buf = await off.startRendering();
    const renderMs = performance.now() - t0;
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    let peak = 0;
    for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const nodes = Object.values(count).reduce((a, b) => a + b, 0);
    return {
      genMs,
      renderMs,
      peak,
      nodes: nodes - setupNodes,
      setupNodes,
      count,
      stolen: s.stats?.stolen || 0,
      audio: returnAudio === 'b64' ? b64(L) : returnAudio ? Array.from(L) : null,
    };
  },
};

function b64(f32) {
  const u8 = new Uint8Array(f32.buffer.slice(0));
  let str = '';
  for (let i = 0; i < u8.length; i += 0x8000) str += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(str);
}

buildUI();
