// 호칭 표 · 얻는 규칙 (10/24 사장님 — 감독 전달):
//  03:2x "호칭도 추가하자. 한 유파의 스킬을 모두 배우면 유파 비기의 원전을 따라 00 계승자 이런 식의 호칭을 주자. 내림박스에서 선택 가능하게. 처음 호칭을 받을 때 알림 뜨게하고."
//  03:3x "아니 책 이름으로. 오륜서 계승자 이런 식. 스테이지 다 깨서 방랑 열리면 방랑자 호칭 제공" · 03:4x "호칭 하나마다 레벨+1 해." ·
//  03:5x "방랑 다 깨면 정복자. 모든 유파 스킬 다 배우면 소드마스터." · 04:0x "스케르모 계승자 에스그리마 계승자 이렇게 쓰는 건?"(감독 동의) ·
//  04:1x "정복자 = 연속으로 모든 방랑 클리어" · 04:2x "한 번의 방랑에서 아르토리아 롤랑 베르나르도를 모두 죽이면 왕 시해자 (광기의 아르토리아는 조건에서 제외)" ·
//  03:5x 도살자(머리 100) · 대부호(금화 10000) — 감독 전달 · '지금까지 번 것'은 감독 기본(사장님 확인 전) · 03:5x 나무꾼(나뭇가지로 왕을 이김) · '여행자' 뺌
//  이 파일 = 이름 표 하나(TITLE_NAMES — 이름을 바꾸면 이미 얻은 호칭 · 고른 호칭도 새 이름으로 보인다: 저장은 사건 열쇠로 읽음 — lobby_progress.js) + 얻는 조건(dueTitles) + 알림 글.
//  저장 · 화면은 모른다 — 저장은 lobby_progress.js(저장할 때마다 dueTitles 로 맞춤 — 그 거래와 같은 저장) · 알림 창은 lobby.js(대기실 · 스킬 화면) · title_notice.js(싸움 결과 창 위).
//  얻은 호칭은 잃지 않는다(유파 초기화 · 방랑 패배 뒤에도 — 사장님 확인 전). '여행자'는 호칭이 아니다(사장님 10/24 — 호칭이 없으면 대기실 '호칭 없음' · NO_TITLE_TEXT).
import { TREE_SCHOOLS, nodesOf, isClosed, SCHOOL_KO } from './skill_tree_data.js';

/**
 * 감독 스위치
 *  countsLevel: 얻은 호칭 하나마다 Lv +1 (사장님 10/24 03:4x '호칭 하나마다 레벨+1 해' · 끄면 레벨 = 1 + 얻은 것 그대로)
 *  conquerWins: 정복자 = 한 번의 방랑(지지 않은 연승)에서 이긴 판 수 — 감독 해석 '30 무대와 같은 수'(사장님 04:1x '연속으로 모든 방랑 클리어')
 *  butcherHeads · tycoonCoins: 도살자 · 대부호 = 지금까지 싸움에서 번 머리 · 금화(lobby_progress.js earned — 감독 기본 '번 것' · 가진 것이 아님 — 쓰면 손해가 되지 않게)
 *  legendStep: 가진 호칭 하나마다 내 카드 뽑기의 레전드 등급 확률 +이만큼(%p) · 커먼 −이만큼 (사장님 10/24 04:0x — tierDrawFor · 0 이면 끔)
 */
export const TITLE = { countsLevel: true, conquerWins: 30, butcherHeads: 100, tycoonCoins: 10000, legendStep: 0.2 };
/** 왕 시해자: 한 번의 방랑에서 이 셋을 모두 이김(차례 상관없음 · 광기의 아르토리아 artoria_mad 는 셈 밖 — 사장님 04:2x) · 나무꾼: 이 셋 중 하나를 나뭇가지로 이김 */
export const KING_FOES = Object.freeze(['artoria', 'roland', 'bernardo']);
/** 나무꾼 무기 = 나뭇가지 (weapons.js 'tree_branch') */
export const WOODCUTTER_WEAPON = 'tree_branch';
/** 호칭이 없을 때 대기실 레벨 옆 글 (흐린 색 · 누를 수 없음 — 사장님 10/24) */
export const NO_TITLE_TEXT = '호칭 없음';

/**
 * 호칭 이름 — 사건 열쇠(event) → 화면 이름. 차례 = 얻는 차례 · 알림 차례(같은 저장에서 둘 이상이면 이 차례로 한 창씩).
 *  유파 호칭 = 유파 비기 원전의 책 이름 + '계승자'(사장님 03:3x '책 이름으로') — 서양 책은 원어 소리(화면 글 지침 §1 외래어 표기 · 원어 글자는 쓰지 않음), 동양 책은 한자의 우리 소리.
 */
export const TITLE_NAMES = Object.freeze({
  'school:german': '캄프페히텐 계승자', // G10 모르트슐라크 — 지그문트 링엑 『Kampffechten』(15세기)
  'school:italian': '스케르모 계승자', // I4 안다레 리솔루토 — 살바토르 파브리스 『Lo Schermo』(1606) (04:0x — 전 '로 스케르모 계승자')
  'school:iberian': '에스그리마 계승자', // B7 싱지르 — 고디뉴 『Arte de Esgrima』(1599) (04:0x — 전 '아르테 데 에스그리마 계승자')
  'school:japanese': '오륜서 계승자', // J5 고노센 — 미야모토 무사시 『오륜서』(1645)
  'school:chinese': '무비지 계승자', // C9 격살 — 모원의 『무비지』(1621) 권86 조선세법
  swordmaster: '소드마스터', // 유파 호칭 다섯을 모두 가짐
  wander: '방랑자', // 방랑이 열림(30 무대를 모두 깸 — 옛 저장 인정 포함)
  regicide: '왕 시해자', // 한 번의 방랑에서 아르토리아 · 롤랑 · 베르나르도를 모두 이김
  conqueror: '정복자', // 한 번의 방랑에서 지지 않고 TITLE.conquerWins 판을 이김
  butcher: '도살자', // 지금까지 번 머리 TITLE.butcherHeads (사장님 10/24 03:5x)
  tycoon: '대부호', // 지금까지 번 금화 TITLE.tycoonCoins (사장님 10/24 03:5x)
  woodcutter: '나무꾼', // 왕(KING_FOES) 하나를 나뭇가지로 이김 (사장님 10/24 03:5x)
});
export const titleName = (event) => TITLE_NAMES[event] ?? null;

const SKILL = /^skill:([a-z]+):([A-Z]+\d+)$/;
/**
 * 유파 호칭에 드는 칸: 그 유파 칸 모두(편지 · 곁가지 포함) — 닫힌 칸('준비 중' · 살 수 없음 — 지금 없음 · 일본 J8 손목 치기 심화는 10/24 칼 떨구기로 열려 이제 듦)은 뺀다.
 *  비기는 늘 든다(닫힌 유파면 아직 못 얻음 — SECRET.openSchools · 지금 다섯 유파 모두 열림). 닫힌 칸이 나중에 열려도 이미 얻은 호칭은 그대로
 */
export const titleNodes = (school) => nodesOf(school).filter((n) => n.cat === 'secret' || !isClosed(school, n)).map((n) => n.id);
/** 이 유파 칸을 모두 익혔나 (acquisitions = 저장의 얻은 것 — 'skill:<유파>:<칸 id>') */
export function schoolComplete(school, acquisitions = []) {
  const have = new Set();
  for (const a of acquisitions) { const m = a?.kind === 'skill' && SKILL.exec(a.receipt); if (m && m[1] === school) have.add(m[2]); }
  const need = titleNodes(school);
  return need.length > 0 && need.every((id) => have.has(id));
}

/**
 * 지금 값(p = 저장 값: acquisitions · titles · wander · regicide · earned)으로 새로 얻을 호칭 사건 — TITLE_NAMES 차례. 이미 가진 사건은 빼고, 이번에 얻는 유파 호칭도 소드마스터 셈에 넣는다.
 *  regicide = { run, foes } (lobby_progress.js 가 방랑 이긴 판에서 적는 이번 방랑의 이긴 왕 — 방랑 id 가 바뀌면(진 뒤 새 방랑) 비움)
 */
export function dueTitles(p) {
  const has = new Set((p?.titles ?? []).map((t) => t.event)), out = [];
  const add = (event, ok) => { if (ok && !has.has(event)) { has.add(event); out.push(event); } };
  for (const s of TREE_SCHOOLS) add(`school:${s}`, schoolComplete(s, p?.acquisitions));
  add('swordmaster', TREE_SCHOOLS.every((s) => has.has(`school:${s}`)));
  const w = p?.wander, run = w?.run;
  add('wander', w?.unlocked === true);
  add('regicide', !!run && p?.regicide?.run === run.id && KING_FOES.every((f) => p.regicide.foes.includes(f)));
  add('conqueror', !!run && Number.isSafeInteger(run.wins) && run.wins >= TITLE.conquerWins);
  add('butcher', (p?.earned?.heads ?? 0) >= TITLE.butcherHeads);
  add('tycoon', (p?.earned?.coins ?? 0) >= TITLE.tycoonCoins);
  add('woodcutter', !!run && run.status === 'won' && KING_FOES.includes(run.foe) && playerWeapon(run) === WOODCUTTER_WEAPON);
  return out;
}
/** 방랑 판에서 내가 든 무기 — 카드로 고른 무기(weapon) · 대기실에서 장착해 카드 없이 든 무기는 lastWeapon(main.js saveJourneyRound — weapon null) */
export const playerWeapon = (run) => run?.weapon ?? run?.lastWeapon ?? null;
/**
 * 방랑 이긴 판의 왕 기록 (저장할 때 — lobby_progress.js): 지금 판이 이긴 판(status 'won')이고 상대가 KING_FOES 면 이번 방랑(run.id)의 기록에 더한다.
 *  기록이 다른 방랑 것이면 새로 시작(진 판 뒤 새 방랑 = 새 id → 셋을 다시 모아야 함). 돌려줌: 새 기록 { run, foes } (바뀌지 않으면 그대로 · 기록이 없으면 null)
 */
export function noteKing(regicide, run) {
  if (!run || run.status !== 'won' || !KING_FOES.includes(run.foe) || typeof run.id !== 'string') return regicide ?? null;
  const foes = regicide?.run === run.id ? regicide.foes : [];
  return foes.includes(run.foe) ? { run: run.id, foes } : { run: run.id, foes: [...foes, run.foe] };
}
/** 저장된 왕 기록 모양 맞춤 — 맞으면 사본, 아니면 null */
export const regicideOf = (r) => (r && typeof r.run === 'string' && r.run.length <= 160 && Array.isArray(r.foes)
  ? { run: r.run, foes: [...new Set(r.foes.filter((f) => KING_FOES.includes(f)))] } : null);

/**
 * 호칭 수 k 만큼 바꾼 등급 확률 표 (사장님 10/24 04:0x): 레전드 + legendStep × k · 커먼 − 같은 만큼(커먼은 0 밑으로 안 감) · 나머지 그대로 — 합은 그대로(100).
 *  base = weapons.js TIER_DRAW (바꾸지 않고 새 표를 돌려줌 · k = 0 이면 base 그대로 — 같은 난수 · 같은 카드). 소수 셈 찌꺼기는 백만분의 일에서 반올림
 */
export function tierDrawFor(base, k) {
  const n = Number.isSafeInteger(k) && k > 0 ? k : 0;
  if (!n || !(TITLE.legendStep > 0)) return base;
  const r6 = (v) => Math.round(v * 1e6) / 1e6, moved = Math.min(base.common ?? 0, TITLE.legendStep * n);
  return { ...base, common: r6((base.common ?? 0) - moved), legend: r6((base.legend ?? 0) + moved) };
}

// ── 알림 글 ('~합니다' — 화면 글 지침 §2) ──
const ga = (word) => { const c = word.charCodeAt(word.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가'; }; // 받침이 있으면 '이'
export const TITLE_NOTICE_HEAD = '호칭을 얻었습니다';
/** 얻은 까닭 한 줄 (알림 창 이름 아래) — 표 밖 호칭(unlockEventTitle)은 고르는 곳 안내 */
export function titleReason(event, name = titleName(event) ?? '') {
  const school = /^school:([a-z]+)$/.exec(event)?.[1];
  const why = school && SCHOOL_KO[school] ? `${SCHOOL_KO[school]} 유파의 모든 기술을 익혀`
    : event === 'swordmaster' ? '다섯 유파의 모든 기술을 익혀'
    : event === 'wander' ? '모든 무대를 깨고 방랑을 열어'
    : event === 'regicide' ? '한 번의 방랑에서 아르토리아와 롤랑, 베르나르도를 모두 쓰러뜨려'
    : event === 'conqueror' ? `한 번의 방랑에서 지지 않고 ${TITLE.conquerWins}번을 내리 이겨`
    : event === 'butcher' ? `지금까지 머리를 ${TITLE.butcherHeads.toLocaleString('ko-KR')}개 얻어`
    : event === 'tycoon' ? `지금까지 금화를 ${TITLE.tycoonCoins.toLocaleString('ko-KR')} 벌어`
    : event === 'woodcutter' ? '나뭇가지 하나로 왕을 쓰러뜨려'
    : null;
  return why ? `${why} ${name}${ga(name)} 되었습니다.` : '대기실의 호칭 상자에서 고를 수 있습니다.';
}
