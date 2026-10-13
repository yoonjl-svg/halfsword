// ─────────────────────────────────────────────────────────────
//  인물 목소리 · 리볼버 소리 듣기 (voices.html) — 목소리 갱신(10/12·10/13)과 리볼버 소리 가져오기를 귀로 확인하는 곳
//   사장님 10/12 지시로 샛별 저장소 77db8c5 의 듣기판 뜻을 가져옴. 인물 목록은 우리 characters.js 에서 읽는다(따로 json 을 두지 않는다).
//   10/13: 사장님 지시로 샛별 저장소 3f330f7 의 번호 버튼(피격·기절·출혈 1·2 를 하나씩 듣기)을 가져옴 — docs/import/saetbyeol_voice3_2026-10-13.md
//   게임의 Sound.hurt / Sound.death / gun.js 소리 함수를 그대로 부른다. 한 번에 하나만 울리고, 정지·화면 숨김 때 멈춘다. 게임 설정은 건드리지 않는다.
// ─────────────────────────────────────────────────────────────
import { Sound, VOICES } from './sound.js';
import { CHARACTERS } from './characters.js';
import { GUN, gunshotSound, gateOpenSound, loadRoundSound, reloadSound } from './gun.js';

/** 10/13 에 목소리 묶음 자체가 바뀐 인물의 옛 목소리 id (마야만 — 이졸데 묶음에서 나옴) */
const BEFORE = { samira: 'isolde' };
/** 10/13 에 녹음이 바뀌거나 보충된 인물 */
const CHANGED = new Set(['samira', 'eira', 'artoria', 'isolde', 'minami', 'margarethe', 'liao', 'omari', 'tome', 'renji']);
/** 줄 메모 */
const NOTE = {
  player: '기절·출혈 모두 조용한 날숨 하나. 피격 2개·이명은 그대로 (여기선 이명을 내지 않는다).',
  samira: '마야 전용 녹음(AuraVoice). 출혈 1·2는 한 호흡 조각, 피격 1은 교체, 출혈 2만 낮은 중역을 살짝 줄였다. 음높이·길이 그대로.',
  eira: '피격과 기절을 나눴다. 기절·출혈 네 녹음이 서로 다르다. 출혈 2는 말 없는 날숨.',
  artoria: '피격과 기절을 나눴다. 기절·출혈 네 녹음이 서로 다르다. 출혈 2는 말 없는 날숨.',
  isolde: '기존 녹음을 다시 써서 기절 2·출혈 2를 채웠다 (미나미와 같이).',
  minami: '기존 녹음을 다시 써서 기절 2·출혈 2를 채웠다 (이졸데와 같이).',
  margarethe: '출혈 1·피격 1은 그대로. 기절 1은 별도 들숨, 기절 2는 날숨, 출혈 2는 잦아드는 한숨, 피격 2 보충.',
  liao: '같은 목소리의 기절 2·출혈 2 보충. 옛 출혈 2번은 계속 뺀다.',
  omari: '단축본은 그대로. 같은 배우의 다른 연기로 기절 2·출혈 2 보충.',
  tome: '기절 1만 톤을 낮추고 날카로운 울림을 줄인 판 (김씨와 같이). 새 성우가 아니다.',
  renji: '토메 묶음 (토메와 같이). 기절 1은 다듬은 판.',
};

const sound = new Sound();
const status = document.querySelector('#status');
const container = document.querySelector('#characters');
let revision = 0;
let loadQueue = Promise.resolve();
let finishTimer;
let timers = [];
let activeButton;

function stopAudio() {
  revision++;
  clearTimeout(finishTimer);
  for (const t of timers) clearTimeout(t);
  timers = [];
  activeButton?.classList.remove('is-playing');
  activeButton = null;
  sound.on = false;
  if (!sound.ctx) return;
  const now = sound.ctx.currentTime;
  for (const ev of sound.voices) {
    ev.out.gain.cancelScheduledValues(now);
    ev.out.gain.setValueAtTime(0, now);
    for (const s of ev.srcs) {
      try {
        s.stop(now);
      } catch {
        /* 이미 끝났다 */
      }
    }
  }
  sound.voices = [];
}

document.querySelector('#stop').addEventListener('click', () => {
  stopAudio();
  status.textContent = '재생을 멈췄어요.';
});
window.addEventListener('pagehide', stopAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAudio();
    status.textContent = '재생을 멈췄어요. 버튼을 누르면 다시 들을 수 있어요.';
  }
});

function finishLater(request, button, text, extra = 0) {
  const end = Math.max(sound.ctx.currentTime, ...sound.voices.map((ev) => ev.end));
  finishTimer = setTimeout(() => {
    if (request !== revision) return;
    button.classList.remove('is-playing');
    activeButton = null;
    status.textContent = text;
  }, Math.max(0, end - sound.ctx.currentTime) * 1000 + 100 + extra);
}

function takeCount(voice, kind) {
  const takes = VOICES[voice]?.rec?.[kind];
  return Array.isArray(takes) ? takes.length : takes || 0;
}

async function play(row, voice, kind, variation, label, button) {
  stopAudio();
  const request = revision;
  try {
    sound.unlock(); // 누른 그 순간에 소리를 연다 (받기를 기다리기 전에)
    if (!sound.ctx) throw new Error('audio-unavailable');
    status.textContent = `${row.name} · ${label} 녹음을 불러오는 중…`;
    const ids = [...new Set([row.before, row.voice].filter(Boolean))];
    loadQueue = loadQueue
      .catch(() => {})
      .then(async () => {
        await sound.samplesReady;
        if (request !== revision) return;
        await sound.loadVoiceSamples(ids);
      });
    await loadQueue;
    if (request !== revision) return;
    const key = `voice:${voice}:${kind}`;
    if (sound.samples[key]?.length !== takeCount(voice, kind)) throw new Error('sample-unavailable'); // 다 받지 못했으면 번호가 어긋난다
    if (sound.ctx.state !== 'running') throw new Error('audio-suspended');
    sound.on = true;
    // 고른 번호의 녹음만 내도록 잠깐 바꿔 끼운다 (게임 쪽 Sound 는 그대로)
    const pickSample = sound.pickSample;
    sound.pickSample = function (name) {
      return name === key ? this.samples[name][variation] : pickSample.call(this, name);
    };
    try {
      if (kind === 'hurt') sound.hurt(voice, 0.7);
      else sound.death(voice, kind === 'ko' ? '기절' : '출혈');
    } finally {
      sound.pickSample = pickSample;
    }
    activeButton = button;
    button.classList.add('is-playing');
    const what = `${kind === 'hurt' ? '피격' : kind === 'ko' ? '기절' : '출혈'} ${variation + 1}`;
    status.textContent = `${row.name} · ${label} · ${what} 재생 중`;
    finishLater(request, button, `${row.name} · ${label} · ${what} · 다 들었어요`);
  } catch {
    if (request !== revision) return;
    stopAudio();
    status.textContent = '소리를 내지 못했어요. 연결과 폰 음량을 확인하고 다시 눌러 주세요.';
  }
}

/** 리볼버: 총성 한 발, 또는 장전 한 바퀴(열기 → 여섯 발 넣기 → 닫기)를 게임과 같은 시각표로 */
async function playGun(kind, button) {
  stopAudio();
  const request = revision;
  try {
    sound.unlock();
    if (!sound.ctx) throw new Error('audio-unavailable');
    await sound.samplesReady;
    if (request !== revision) return;
    if (sound.ctx.state !== 'running') throw new Error('audio-suspended');
    sound.on = true;
    activeButton = button;
    button.classList.add('is-playing');
    if (kind === 'shot') {
      gunshotSound(sound, null);
      status.textContent = '총성 재생 중';
      return finishLater(request, button, '총성 · 다 들었어요');
    }
    // 장전: gun.js updateGun 과 같은 시각 (열기 0 s, 넣기 = 닫기 구간 앞으로 reloadInsertInterval 간격, 닫기 = GUN.reload)
    gateOpenSound(sound, null);
    const lastInsert = GUN.reload - GUN.reloadClose;
    const iv = Math.min(GUN.reloadInsertInterval, (lastInsert - GUN.reloadOpen) / Math.max(1, GUN.rounds - 1));
    for (let i = 0; i < GUN.rounds; i++) {
      const at = lastInsert - iv * (GUN.rounds - 1 - i);
      timers.push(setTimeout(() => request === revision && loadRoundSound(sound, null, i + 1), at * 1000));
    }
    timers.push(setTimeout(() => request === revision && reloadSound(sound, null), GUN.reload * 1000));
    status.textContent = `장전 재생 중 (${GUN.reload} 초: 열기 → 여섯 발 → 닫기)`;
    finishLater(request, button, '장전 · 다 들었어요', GUN.reload * 1000 + 400);
  } catch {
    if (request !== revision) return;
    stopAudio();
    status.textContent = '소리를 내지 못했어요. 연결과 폰 음량을 확인하고 다시 눌러 주세요.';
  }
}

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (className) n.className = className;
  return n;
}

function controls(row, voice, label) {
  const group = el('fieldset');
  group.append(el('legend', `${label} (${voice})`));
  const box = el('div', '', 'buttons');
  for (let variation = 0; variation < 2; variation++) {
    for (const [kind, text] of [['hurt', '피격'], ['ko', '기절'], ['bleed', '출혈']]) {
      if (variation >= takeCount(voice, kind)) continue;
      const b = el('button', `${text} ${variation + 1}`);
      b.type = 'button';
      b.setAttribute('aria-label', `${row.name} ${label} ${text} ${variation + 1} 듣기`);
      b.addEventListener('click', () => play(row, voice, kind, variation, label, b));
      box.append(b);
    }
  }
  group.append(box);
  return group;
}

function gunCard() {
  const card = el('section', '', 'character changed');
  card.append(el('h2', '리볼버'));
  card.append(el('p', '총성 +15% · 장전 녹음(GP100, CC0) · 8 초 장전. 장전은 게임과 같은 시각표로 울린다.', 'meta'));
  const box = el('div', '', 'buttons');
  for (const [kind, text] of [['shot', '총성'], ['reload', '장전 한 바퀴']]) {
    const b = el('button', text);
    b.type = 'button';
    b.addEventListener('click', () => playGun(kind, b));
    box.append(b);
  }
  card.append(box);
  return card;
}

function showCast() {
  const rows = [{ id: 'player', name: '나 (주인공)', voice: 'player', changed: false }];
  for (const c of CHARACTERS) {
    const voice = c.voice || c.id;
    if (!VOICES[voice]) continue;
    rows.push({ id: c.id, name: c.name, age: c.age, voice, before: BEFORE[c.id], changed: CHANGED.has(c.id) });
  }
  rows.sort((a, b) => Number(b.changed) - Number(a.changed));
  container.append(gunCard());
  for (const row of rows) {
    const card = el('section', '', `character${row.changed ? ' changed' : ''}`);
    card.append(el('h2', row.name));
    const share = rows.filter((r) => r.voice === row.voice && r.id !== row.id).map((r) => r.name);
    card.append(el('p', `${row.age ? `${row.age}세 · ` : ''}${row.changed ? '10/13 바뀜' : '그대로'}${share.length ? ` · 같은 목소리: ${share.join(', ')}` : ''}`, 'meta'));
    if (NOTE[row.id]) card.append(el('p', NOTE[row.id]));
    if (row.before) card.append(controls(row, row.before, '이전'), controls(row, row.voice, '새 배정'));
    else card.append(controls(row, row.voice, '지금 목소리'));
    if (row.id !== 'player') {
      const a = el('a', '이 인물과 겨루기 →', 'game-link');
      a.href = `./?foe=${encodeURIComponent(row.id)}`;
      card.append(a);
    }
    container.append(card);
  }
  status.textContent = '듣고 싶은 버튼을 눌러 주세요.';
}

showCast();
