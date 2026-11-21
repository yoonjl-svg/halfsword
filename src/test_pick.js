// 테스트 고르기 화면 (test.html) — 사장님 10/10 16:5x "무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤"
//  무기: weapons.js WEAPON_LIST 전부 (오늘 바뀐 무기 묶음을 위에) · 캐릭터: characters.js CHARACTERS 전부 + 기본 주인공(LOOKS.player)
//  상대: '무작위'(본판 회전 CHARACTERS — 판마다) 또는 손님 인물(characters.js CHARACTER_GUESTS — 10/14 라트나·다라이시: 무작위 회전에 없어 여기서 고른다. 10/14 19:4x 부터 여정에서는 제 무대의 검객)
//  '시작' → index.html?test=1&weapon=<id>&hero=<id|player>&foe=<random|인물 id>&stage=<random|무대 id> (그쪽 인자 뜻은 src/test_route.js)
//  무대(10/14): 기본은 무작위(여정 무대 — 지금 그대로). 새 무대(잠든 습지 · 철불 절벽 · 소금 사막 — 10/14 19:4x 여정에 들어감)를 고르면 stage=<id> 로 그 무대에 고정된다 (기억하지 않는다)
//  마지막 고른 무기·캐릭터·상대는 localStorage 에 기억한다 (읽기·쓰기 실패해도 그냥 동작).
//  상대 헛스윙(10/15 사장님 '테스트 경로에 헛스윙 넣어' — src/whiff_drill.js): 켜면 시작 주소에 foeWhiff=1. 기본 끔이고 기억하지 않는다(무대와 같음)
import { WEAPON_LIST, TIER_LABEL, RETIRED_WEAPONS, WEAPONS } from './weapons.js';
import { CHARACTERS, CHARACTER_GUESTS } from './characters.js';
import { WANDER_EXCLUSIVE } from './wander_rules.js'; // 무작위 줄 인원에서 방랑 전용을 뺀다 (10/23)
import { TRADITIONS, traditionOf } from './schools.js';

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
// 상대 (10/14 — 사장님 '라트나는 테스트 경로의 상대 고르기와 ?foe=ratna 로'): 무작위(본판 회전) + 손님 인물. 손님 인물은 본판 무작위 상대 목록에 없다
//  (10/14 19:4x 사장님 결정으로 여정에서는 제 무대 — 잠든 습지 · 소금 사막 — 의 검객으로 나온다. 그래서 '여정 밖' 대신 '무작위 밖')
const foes = [
  { id: 'random', name: '무작위', sub: `본판 인물 ${CHARACTERS.filter((c) => !WANDER_EXCLUSIVE.includes(c.id)).length}명 · 판마다`, armour: '고른 캐릭터는 빼고' }, // 방랑 전용(아르토리아)은 무작위에서 빠짐 (10/23)
  ...CHARACTER_GUESTS.map((c) => ({ id: c.id, name: c.name, sub: `${c.epithet} · 무작위 밖`, armour: WEAPONS[c.weapon]?.nameKo ?? c.weapon })),
];

// 무대 (10/14 — 새 무대 잠든 습지·소금 사막·철불 절벽을 여는 곳, docs/import/sluice_port_2026-10-14.md · 확인표 1119 / docs/import/salt_desert_port_2026-10-14.md · 확인표 1214 /
//  docs/import/ironcliff_port_2026-10-14.md · 확인표 1386). 기본은 무작위(지금 그대로). 10/14 19:4x 사장님 결정으로 셋 다 여정 정식 경로(12 · 13 · 14 번째)에 들어갔고,
//  무작위(여정 무대)에도 나온다 — 여기서 고르면 그 무대에 고정. 괄호 안 번호는 stages.js STAGE_ORDER 자리(왼쪽 위 '스테이지 N')와 같게 — 화산섬(docs/import/volcano_port_2026-10-14.md · 확인표 1463 · 1479)이
//  철불 절벽 뒤 14 번째로 들어와 소금 사막은 15. 10/17: 스물아홉 판 여정(봉인의 중정이 산호 항구 뒤 12 번째로 — 사장님 15:4x '다 고쳐서 올려')에 맞춰 번호를 다시 적고 중정 줄을 더함.
//  10/21: 서른 판 여정(밤의 봉인의 중정이 밤의 산호 항구 뒤 17 번째로)에 맞춰 번호를 다시 적고 밤의 중정 줄을 더함
//  stages.js 를 부르면 무대 짓는 코드가 이 화면에 다 딸려 오므로 이름만 여기 적는다 (stages.js STAGE_NAME_KO 와 같은 이름)
const STAGE_PICKS = [
  { id: 'random', name: '무작위 (여정 무대)', sub: '판마다 여정 무대 가운데 하나 — 지금 그대로' },
  { id: 'courtyard', name: '봉인의 중정 (여정 12)', sub: '새 무대 (10/17) — 장마 앞 늦은 오후 모래바람 · 마야 뒤 계단 우물과 붉은 봉인의 문 · 가운데 급수정 엄폐물. 판이 바뀌어도 이 무대' },
  { id: 'courtyard_night', name: '밤의 봉인의 중정 (여정 17)', sub: '새 무대 (10/21) — 새벽 3 시 포격에 무너진 중정 · 검은 연기 · 깨진 급수정에서 새는 물 · 상대는 광기의 마야. 판이 바뀌어도 이 무대' },
  { id: 'sluice', name: '잠든 습지 (여정 13)', sub: '새 무대 (10/14) — 가운데 말레이곰 석상 · 진흙 웅덩이 감속. 판이 바뀌어도 이 무대' },
  { id: 'dunhuang', name: '철불 절벽 (여정 24)', sub: '새 무대 (10/14) — 석굴 절벽 앞뜰의 초가을 아침 · 6 층 누각과 벽화. 판이 바뀌어도 이 무대' },
  { id: 'etna', name: '화산섬 (여정 14)', sub: '새 무대 (10/14) — 결투장 전체가 산비탈 · 낮은 쪽 용암에 닿으면 화상(다리 → 무릎). 판이 바뀌어도 이 무대' },
  { id: 'dayr', name: '소금 사막 (여정 25)', sub: '새 무대 (10/14) — 소금 벌판 역참의 해 질 녘 · 낮은 해와 긴 그림자. 판이 바뀌어도 이 무대' },
];
// 상대 헛스윙 (10/15 — 독일 보법 '간격 잡기'는 상대가 헛쳐야 켜져 AI 와는 시험이 어려웠다 · docs/strike/german_hold_2026-10-15.md §7): 켜면 상대가 제 칼이 닿지 않는 거리에서
//  2~3 s 마다 허공을 벤다(main.js → whiff_drill.js). 다가가면 평소대로 싸운다. 기억하지 않는다 — 켜 둔 것이 남아 '왜 상대가 허공을 베나' 헷갈리지 않게
const WHIFF_PICKS = [
  { id: 'off', name: '끔', sub: '평소 상대' },
  { id: 'on', name: '켬', sub: '닿지 않는 거리에서 2~3초마다 허공을 벰 · 다가가면 평소대로' },
];
// 동시 대전 (10/29 사장님 14:2x 생사전 — 한 판에 넷이 함께 · docs/strike/team_fight_2026-10-29.md §11 · 11/20 3:3 — 넷 제한 걷음): 시작 주소의 team 으로 (main.js TEAM_TEST)
//  나 = 고른 무기 · 겉모습 · 동료 · 상대 = 무작위 인물(상대 첫째는 고른 상대). 기억하지 않는다
const TEAM_PICKS = [
  { id: 'off', name: '1:1', sub: '지금 게임 (한 명씩)' },
  { id: '2v2', name: '2:2', sub: '나 + 동료 하나 대 둘' },
  { id: '2v1', name: '2:1', sub: '나 + 동료 대 하나' },
  { id: '1v2', name: '1:2', sub: '나 혼자 대 둘' },
  { id: '3v3', name: '3:3', sub: '나 + 동료 둘 대 셋' },
  { id: 'watch', name: '지켜보기', sub: '넷 모두 AI · 나는 본다' },
];
// 생사전 맵 (사장님 11/21 '생사전 맵 1과 3으로 두 개 만들어.' — src/saengsa_maps.js 무대 표): 동시 대전 판을 그 맵에서. 고르면 무대 칸 대신 그 맵(주소 stage=) · 1:1 이면 3:3 으로.
//  기억하지 않는다. 이름은 무대 표와 같게 (saengsa_maps.js 를 부르면 그림 코드가 딸려 오므로 이름만)
const MAP_PICKS = [
  { id: 'off', name: '맵 없음', sub: '동시 대전도 무대 칸대로 (지금 그대로)' },
  { id: 'saengsa_bridges', name: '두 다리 개울', sub: '생사전 전용 맵 — 개울을 건너는 다리 둘 · 36 × 24 m' },
  { id: 'saengsa_court', name: '성벽 안뜰', sub: '생사전 전용 맵 — 가운데 성벽을 지나는 문 둘 · 34 × 22 m' },
];
// 거점전 (사장님 11/21 '생사전은 전멸을 목표로 해야 생사전이야. 거점전은 따로 만들자.' — src/capture.js): 생사전 전용 맵 둘의 거점 원 둘 · 3 초 쥐면 그 편 것 · 둘을 20 초 쥐면 이김 · 전멸도 이김.
//  시작 주소의 team 으로 (main.js CAPTURE_TEST — 동시 대전과 같은 칸 · 함께 고를 수 없음) · 맵은 위 '생사전 맵'(안 고르면 두 다리 개울). 기억하지 않는다
const CAPTURE_PICKS = [
  { id: 'off', name: '끔', sub: '거점전 아님 (위 동시 대전대로)' },
  { id: 'cap2v2', name: '2:2', sub: '나 + 동료 하나 대 둘' },
  { id: 'cap2v3', name: '2:3', sub: '나 + 동료 하나 대 셋' },
  { id: 'cap3v3', name: '3:3', sub: '나 + 동료 둘 대 셋' },
];
const isCap = (id) => CAPTURE_PICKS.some((x) => x.id === id && id !== 'off');
const saved = loadPick();
const pick = {
  weapon: weapons.some((w) => w.id === saved.weapon) ? saved.weapon : NEW_WEAPONS[0],
  hero: heroes.some((h) => h.id === saved.hero) ? saved.hero : 'player',
  foe: foes.some((f) => f.id === saved.foe) ? saved.foe : 'random',
  stage: 'random', // 무대도 기억하지 않는다 (열 때마다 무작위에서 — 고른 무대가 남아 '왜 늘 습지인가' 헷갈리지 않게)
  whiff: 'off', // 상대 헛스윙도 기억하지 않는다 (열 때마다 끔)
  team: 'off', // 동시 대전도 기억하지 않는다 (열 때마다 1:1)
  map: 'off', // 생사전 맵도 기억하지 않는다
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

function optionButton(x, kind) {
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
  if (kind === 'cap') { // 거점전은 동시 대전과 같은 칸(pick.team)을 쓴다 — 끄면 1:1 · 맵은 안 골랐으면 두 다리 개울
    pick.team = id;
    if (id !== 'off' && pick.map === 'off') pick.map = 'saengsa_bridges';
    if (id === 'off') pick.map = 'off';
    savePick(pick);
    render();
    return;
  }
  pick[kind] = id;
  if (kind === 'map' && id !== 'off' && pick.team === 'off') pick.team = '3v3'; // 맵은 동시 대전 판에서만 (1:1 은 원 무대)
  if (kind === 'map' && id === 'off' && isCap(pick.team)) pick.team = 'off'; // 거점전은 맵이 있어야
  if (kind === 'team' && id === 'off') pick.map = 'off';
  savePick(pick);
  render();
}

function render() {
  for (const el of document.querySelectorAll('#weaponsNew .pick, #weaponsRest .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.weapon));
  for (const el of document.querySelectorAll('#heroes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.hero));
  for (const el of document.querySelectorAll('#foes .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.foe));
  for (const el of document.querySelectorAll('#stagePick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.stage));
  for (const el of document.querySelectorAll('#whiffPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.whiff));
  for (const el of document.querySelectorAll('#teamPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.team));
  for (const el of document.querySelectorAll('#mapPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === pick.map));
  for (const el of document.querySelectorAll('#capPick .pick')) el.setAttribute('aria-pressed', String(el.dataset.id === (isCap(pick.team) ? pick.team : 'off')));
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
  s.append(bw, ' · ', bh, document.createElement('br'), `${foeTxt || stageTxt ? `${foeTxt || '상대 무작위'} · ${stageTxt || '무대 무작위'}` : '상대·무대 무작위'}${pick.whiff === 'on' ? ' · 상대 헛스윙' : ''}${isCap(pick.team) ? ` · 거점전 ${CAPTURE_PICKS.find((x) => x.id === pick.team)?.name ?? ''}` : pick.team !== 'off' ? ` · 동시 대전 ${TEAM_PICKS.find((x) => x.id === pick.team)?.name ?? ''}` : ''}${pick.map !== 'off' ? ` · 맵 ${MAP_PICKS.find((x) => x.id === pick.map)?.name ?? ''}` : ''}`);
}

function startUrl() {
  const q = new URLSearchParams({ test: '1', weapon: pick.weapon, hero: pick.hero, foe: pick.foe, stage: pick.stage }); // stage=<id> 면 main.js STAGE_PIN 으로 그 무대 고정 · foe=<id> 면 그 상대 (main.js pickFoe)
  if (pick.whiff === 'on') q.set('foeWhiff', '1'); // 상대 헛스윙 (main.js → whiff_drill.js) — 끄면 주소에 안 적는다
  if (pick.team !== 'off') q.set('team', pick.team); // 동시 대전 (main.js TEAM_TEST → startTeamTest) — 1:1 이면 안 적는다
  if (pick.map !== 'off' && pick.team !== 'off') q.set('stage', pick.map); // 생사전 맵 = 그 맵 무대에 고정 (main.js STAGE_PIN — 동시 대전 판만)
  return `./index.html?${q.toString()}`;
}

for (const id of NEW_WEAPONS) {
  const w = weapons.find((x) => x.id === id);
  if (w) $('weaponsNew').append(weaponButton(w, true));
}
for (const w of weapons) if (!NEW_WEAPONS.includes(w.id)) $('weaponsRest').append(weaponButton(w, false));
for (const h of heroes) $('heroes').append(heroButton(h));
for (const f of foes) $('foes').append(heroButton(f, 'foe'));
for (const x of STAGE_PICKS) $('stagePick').append(optionButton(x, 'stage'));
for (const x of WHIFF_PICKS) $('whiffPick').append(optionButton(x, 'whiff'));
for (const x of TEAM_PICKS) $('teamPick').append(optionButton(x, 'team'));
for (const x of MAP_PICKS) $('mapPick').append(optionButton(x, 'map'));
for (const x of CAPTURE_PICKS) $('capPick').append(optionButton(x, 'cap'));
$('weaponCount').textContent = `${weapons.length}종`;
$('heroNote').textContent =
  '고른 캐릭터는 겉모습과 이름만 가져옵니다. 투구·판금은 겉모습에 딸려 있어 실제로 막아 줍니다(기본 주인공은 투구). ' +
  '인물의 성격·부활(이졸데) 같은 고유 능력은 받지 않습니다. 광기의 하인리히는 겉모습이 하인리히와 같아 뺐습니다.';
$('btnGo').addEventListener('click', () => {
  savePick(pick);
  location.href = startUrl();
});
render();
