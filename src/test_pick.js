// 테스트 고르기 화면 (test.html) — 사장님 10/10 16:5x "무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤"
//  무기: weapons.js WEAPON_LIST 전부 (오늘 바뀐 무기 묶음을 위에) · 캐릭터: characters.js CHARACTERS 전부 + 기본 주인공(LOOKS.player)
//  상대: '무작위'(본판 회전 CHARACTERS — 판마다) 또는 여정 밖 인물(characters.js CHARACTER_GUESTS — 10/14 라트나, 무대보다 먼저 온 인물은 여기서만 고른다)
//  '시작' → index.html?test=1&weapon=<id>&hero=<id|player>&foe=<random|인물 id>&stage=<random|무대 id> (그쪽 인자 뜻은 src/test_route.js)
//  무대(10/14): 기본은 무작위(여정 무대 — 지금 그대로). 여정 밖 무대(잠든 습지)를 고르면 stage=<id> 로 그 무대에 고정된다 (기억하지 않는다)
//  마지막 고른 무기·캐릭터·상대는 localStorage 에 기억한다 (읽기·쓰기 실패해도 그냥 동작).
//  비기 판(이베리아·중국·독일)은 기억하지 않는다 — 10/13 사장님 'test 경로로는 아직 끊기지 않는 흐름이 발동' = 예전에 고른 v5 가 기억돼 있던 것. 열 때마다 본판 기본값에서 시작
import { WEAPON_LIST, TIER_LABEL, RETIRED_WEAPONS, WEAPONS } from './weapons.js';
import { CHARACTERS, CHARACTER_GUESTS } from './characters.js';
import { TRADITIONS, traditionOf } from './schools.js';
import { SECRET } from './config.js'; // 비기 판 기본값 = 본판(main) 기본값 (10/13 — 고른 판을 기억하지 않는다)

const STORE_KEY = 'stillness.testRoute.v1';
// 오늘(10/10) 사장님이 해 볼 무기: 츠바이핸더(이베리아 몬탄테 고증) · 우치가타나(일본 고증) · 10/14 플랑베르주(샛별 가져오기 3차 — 셋째에 두어 처음 고름은 그대로)
const NEW_WEAPONS = ['zweihander', 'uchigatana', 'flamberge'];
const NEW_NOTE = { zweihander: '몬탄테 자세표·기술 (10/10)', uchigatana: '일본 자세 고증 (10/10)', flamberge: '샛별 가져오기 3차 · 이베리아 (10/14)' };

const $ = (id) => document.getElementById(id);

function loadPick() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}
function savePick(p) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    /* 저장 못 해도 이동은 한다 */
  }
}

/** 무기의 유파 이름 한 줄 (가지가 있으면 가지 이름) */
function schoolLine(w) {
  const t = TRADITIONS[traditionOf(w)];
  if (!t) return '';
  const br = t.branches?.[`${w.frame}:${w.style}`];
  return br ? `${t.nameKo} · ${br.nameKo}` : t.id === 'none' ? '무유파' : `${t.nameKo} 유파`;
}

/** 겉모습에 딸린 방어구 (fighter.js: look.helmet = 투구, look.armor 'plate' = 판금) */
function armourLine(look) {
  const a = [];
  if (look?.armor === 'plate') a.push('판금');
  if (look?.helmet) a.push('투구');
  return a.length ? a.join('·') : '방어구 없음';
}

const weapons = WEAPON_LIST.filter((w) => !RETIRED_WEAPONS.has(w.id)).map((w) => ({ id: w.id, name: w.nameKo, tier: w.tier, school: schoolLine(w) })); // 빼 둔 무기(사장님 10/13 23:2x)는 고르기 화면에서도 뺀다
const heroes = [
  { id: 'player', name: '기본 주인공', sub: '지금 플레이어 겉모습', armour: '투구' },
  ...CHARACTERS.map((c) => ({ id: c.id, name: c.name, sub: c.epithet || '—', armour: armourLine(c.look) })),
];
// 상대 (10/14 — 사장님 '라트나는 테스트 경로의 상대 고르기와 ?foe=ratna 로'): 무작위(본판 회전) + 여정 밖 인물. 여정 밖 인물은 본판 무작위 상대 목록에 없다
const foes = [
  { id: 'random', name: '무작위', sub: `본판 인물 ${CHARACTERS.length}명 · 판마다`, armour: '고른 캐릭터는 빼고' },
  ...CHARACTER_GUESTS.map((c) => ({ id: c.id, name: c.name, sub: `${c.epithet} · 여정 밖`, armour: WEAPONS[c.weapon]?.nameKo ?? c.weapon })),
];

// 이베리아 비기 판 (10/11 — docs/strike/iberian_secret_v6_2026-10-11.md): 새 '길목 지키기'(v6 기본) · v5 '멈추지 않는 흐름' · 옛 v4 '비켜 서며 크게 가로베기' — 시작 주소의 ibSecret 로 (main.js)
const IB_SECRETS = [
  { id: 'gilmok', name: '새 · 길목 지키기', sub: '칼끝 거리 밖에서 준비 → 상대가 경계를 넘어 드는 순간 둘러 베는 한 칼 (v6)' },
  { id: 'flow', name: 'v5 · 멈추지 않는 흐름', sub: '번갈아 올려베기 둘 → 머리 위로 넘겨 둘러 베는 큰 한 칼 (10/11)' },
  { id: 'v4', name: '옛 · 비켜 서며 가로베기', sub: '휩쓸기 v4 (10/10) — 견주어 보기' },
];

// 중국·독일 비기 판 (10/11 — docs/strike/parry_combo_secret_2026-10-11.md): 새 '막기 연환'(기본) · 옛 v1 — 시작 주소의 cnSecret·deSecret 로 (main.js)
const CN_SECRETS = [
  { id: 'parry', name: '새 · 연환삼격 (막기 연환)', sub: '거정세·표두세·봉두세로 막아 칼이 떨어진 직후 입력 → 찌름·두 벰, 셋째 수 반걸음 물러남 (10/12)' },
  { id: 'v1', name: '옛 · 연환삼격', sub: '쉬었다 친 첫 칼이 맞으면 세 수 (10/10) — 견주어 보기' },
];
const DE_SECRETS = [
  { id: 'v1', name: '기본 · 받아 베기 (Versetzen)', sub: '머리·목을 노리는 칼을 맞받아 벰 — 지금 본판 기본' },
  { id: 'parry', name: '시험 · 감아 들기 (Indes)', sub: '황소·왕관으로 받아 칼이 붙은 동안 입력 → 받은 칼을 타고 한 수 (붙음이 짧아 잘 안 열림)' },
];
// 무대 (10/14 — 여정 밖 무대 잠든 습지를 여는 곳, docs/import/sluice_port_2026-10-14.md · 확인표 1119). 기본은 무작위(지금 그대로).
//  stages.js 를 부르면 무대 짓는 코드가 이 화면에 다 딸려 오므로 이름만 여기 적는다 (stages.js STAGE_NAME_KO 와 같은 이름)
const STAGE_PICKS = [
  { id: 'random', name: '무작위 (여정 무대)', sub: '판마다 여정 무대 가운데 하나 — 지금 그대로' },
  { id: 'sluice', name: '잠든 습지 (여정 밖)', sub: '새 무대 (10/14) — 가운데 말레이곰 석상 · 진흙 웅덩이 감속. 판이 바뀌어도 이 무대' },
];
const saved = loadPick();
const pick = {
  weapon: weapons.some((w) => w.id === saved.weapon) ? saved.weapon : NEW_WEAPONS[0],
  hero: heroes.some((h) => h.id === saved.hero) ? saved.hero : 'player',
  foe: foes.some((f) => f.id === saved.foe) ? saved.foe : 'random',
  ibSecret: SECRET.iberianSecret, // 비기 판은 기억하지 않고 본판 기본값에서 (10/13)
  cnSecret: SECRET.cnSecret,
  deSecret: SECRET.deSecret,
  stage: 'random', // 무대도 기억하지 않는다 (열 때마다 무작위에서 — 고른 무대가 남아 '왜 늘 습지인가' 헷갈리지 않게)
};

function weaponButton(w, big) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.tier = w.tier;
  b.dataset.id = w.id;
  const thumb = document.createElement('span');
  thumb.className = 'thumb';
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.src = `ui/weapons/${w.id}.webp`;
  img.onerror = () => img.remove();
  thumb.append(img);
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  const m = /^(.*?)\s*\((.*)\)$/.exec(w.name); // '에스톡 (찌르기검)' → 이름 + 작은 풀이
  name.textContent = m ? m[1] : w.name;
  if (m) {
    const alias = document.createElement('small');
    alias.textContent = m[2];
    name.append(alias);
  }
  const line = document.createElement('span');
  const tier = document.createElement('span');
  tier.className = 'tier';
  tier.textContent = TIER_LABEL[w.tier] ?? w.tier;
  line.append(tier, ` · ${w.school}`);
  txt.append(name, line);
  if (big && NEW_NOTE[w.id]) {
    const n = document.createElement('span');
    n.textContent = NEW_NOTE[w.id];
    txt.append(n);
  }
  b.append(thumb, txt);
  b.addEventListener('click', () => select('weapon', w.id));
  return b;
}

function heroButton(h, kind = 'hero') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.id = h.id;
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.textContent = h.id === 'player' ? '나' : h.id === 'random' ? '?' : h.name.slice(0, 1);
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  name.textContent = h.name;
  const sub = document.createElement('span');
  sub.textContent = h.sub;
  const arm = document.createElement('span');
  arm.textContent = h.armour;
  txt.append(name, sub, arm);
  b.append(mark, txt);
  b.addEventListener('click', () => select(kind, h.id));
  return b;
}

function ibSecretButton(x, kind = 'ibSecret') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pick';
  b.dataset.id = x.id;
  const txt = document.createElement('span');
  txt.className = 'txt';
  const name = document.createElement('b');
  name.textContent = x.name;
  const sub = document.createElement('span');
  sub.textContent = x.sub;
  txt.append(name, sub);
  b.append(txt);
  b.addEventListener('click', () => select(kind, x.id));
  return b;
}

function select(kind, id) {
  pick[kind] = id;
  savePick(pick);
  render();
}

function render() {
  for (const el of document.querySelectorAll('#weaponsNew .pick, #weaponsRest .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.weapon));
  for (const el of document.querySelectorAll('#heroes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.hero));
  for (const el of document.querySelectorAll('#foes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.foe));
  for (const el of document.querySelectorAll('#ibSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.ibSecret));
  for (const el of document.querySelectorAll('#cnSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.cnSecret));
  for (const el of document.querySelectorAll('#deSecret .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.deSecret));
  for (const el of document.querySelectorAll('#stagePick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.stage));
  const w = weapons.find((x) => x.id === pick.weapon);
  const h = heroes.find((x) => x.id === pick.hero);
  const s = $('summary');
  s.textContent = '';
  const bw = document.createElement('b');
  bw.textContent = w.name;
  const bh = document.createElement('b');
  bh.textContent = h.name;
  const st = STAGE_PICKS.find((x) => x.id === pick.stage);
  const f = foes.find((x) => x.id === pick.foe);
  const foeTxt = f && f.id !== 'random' ? `상대 ${f.name}` : '';
  const stageTxt = pick.stage !== 'random' && st ? `무대 ${st.name}` : '';
  s.append(bw, ' · ', bh, document.createElement('br'), foeTxt || stageTxt ? `${foeTxt || '상대 무작위'} · ${stageTxt || '무대 무작위'}` : '상대·무대 무작위');
}

function startUrl() {
  const q = new URLSearchParams({ test: '1', weapon: pick.weapon, hero: pick.hero, foe: pick.foe, stage: pick.stage }); // stage=<id> 면 main.js STAGE_PIN 으로 그 무대 고정 · foe=<id> 면 그 상대 (main.js pickFoe)
  if (pick.ibSecret !== SECRET.iberianSecret) q.set('ibSecret', pick.ibSecret); // 본판 기본값이 아니면 판을 주소에 (10/13 — 전엔 독일 기본을 'parry' 로 잘못 알아 감아 들기를 고를 수 없었다)
  if (pick.cnSecret !== SECRET.cnSecret) q.set('cnSecret', pick.cnSecret);
  if (pick.deSecret !== SECRET.deSecret) q.set('deSecret', pick.deSecret);
  return `./index.html?${q.toString()}`;
}

for (const id of NEW_WEAPONS) {
  const w = weapons.find((x) => x.id === id);
  if (w) $('weaponsNew').append(weaponButton(w, true));
}
for (const w of weapons) if (!NEW_WEAPONS.includes(w.id)) $('weaponsRest').append(weaponButton(w, false));
for (const h of heroes) $('heroes').append(heroButton(h));
for (const f of foes) $('foes').append(heroButton(f, 'foe'));
for (const x of IB_SECRETS) $('ibSecret').append(ibSecretButton(x));
for (const x of CN_SECRETS) $('cnSecret').append(ibSecretButton(x, 'cnSecret'));
for (const x of DE_SECRETS) $('deSecret').append(ibSecretButton(x, 'deSecret'));
for (const x of STAGE_PICKS) $('stagePick').append(ibSecretButton(x, 'stage'));
$('weaponCount').textContent = `${weapons.length}종`;
$('heroNote').textContent =
  '고른 캐릭터는 겉모습과 이름만 가져옵니다. 투구·판금은 겉모습에 딸려 있어 실제로 막아 줍니다(기본 주인공은 투구). ' +
  '인물의 성격·부활(이졸데) 같은 고유 능력은 받지 않습니다. 광기의 하인리히는 겉모습이 하인리히와 같아 뺐습니다.';
$('btnGo').addEventListener('click', () => {
  savePick(pick);
  location.href = startUrl();
});
render();
