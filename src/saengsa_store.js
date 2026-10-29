// 생사전 저장 (localStorage 'stillness.saengsa.v1' — 방랑 판(lobby_progress.js wander.run)처럼 한 번의 저장으로 고치는 update 틀)
//  { version 1, current: 대회 | null (끝난 대회도 다음 신청까지 둔다 — 대기실 칸이 '지난 대회'를 보임), draft: { companions: [id | null, id | null], lend: { weapon, to } | null } }
//  금화(고용 값 · 왕의 하사품)는 lobby_progress.js 지갑 — 두 저장의 차례: 고용은 금화를 먼저 내고 대회를 적는다(대회를 못 적으면 돌려줌) ·
//   하사품은 연 것을 대회에 먼저 적고 금화를 더한다(새로고침해도 두 번 받지 않음 — 그 사이에 막히면 그 하사품 금화를 잃을 수 있다).
//  저장이 막히면 이번 실행 동안만 메모리 값(다음 실행은 저장된 옛 값).
import { SAENGSA } from './config.js';
import { createTournament, advance, canSignUp, openChests, myMatch, matchById, finishMine, NAMELESS } from './saengsa_rules.js';
import { signupWindow } from './saengsa_clock.js';
import { update as updateWallet, addCoins } from './lobby_progress.js';

export const SAENGSA_KEY = 'stillness.saengsa.v1';
const blank = () => ({ version: 1, current: null, draft: { companions: [null, null], lend: null } });
let session = blank();
const store = (s) => { try { return s ?? globalThis.localStorage ?? null; } catch { return null; } };

const isDay = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isFighter = (f) => f && typeof f.key === 'string' && typeof f.id === 'string' && typeof f.weapon === 'string' && Number.isFinite(f.hp) && Array.isArray(f.injuries) && f.prof && typeof f.prof === 'object';
/** 저장된 대회 모양이 맞나 (아니면 버림 — 옛 판 · 깨진 글) */
export function validTournament(t) {
  if (!t || t.v !== 1 || !isDay(t.day) || !Number.isFinite(t.seed) || !Array.isArray(t.teams) || !Array.isArray(t.matches)) return false;
  const n = t.teams.length;
  if (n < 2 || (n & (n - 1)) || t.matches.length !== n - 1) return false;
  if (!t.teams.every((team) => Array.isArray(team?.members) && team.members.length && team.members.every(isFighter))) return false;
  return t.matches.every((m) => m && typeof m.id === 'string' && Number.isInteger(m.round) && Number.isInteger(m.index));
}
function normalize(v) {
  const out = blank();
  if (v?.version !== 1) return out;
  if (validTournament(v.current)) out.current = v.current;
  const c = Array.isArray(v.draft?.companions) ? v.draft.companions : [];
  out.draft.companions = [0, 1].map((i) => (typeof c[i] === 'string' && (c[i] !== c[1 - i] || c[i] === NAMELESS) ? c[i] : null)); // 무명 검객은 둘 다여도 됨
  const l = v.draft?.lend;
  if (l && typeof l.weapon === 'string' && Number.isInteger(l.to) && l.to >= 0 && l.to < SAENGSA.teamSize) out.draft.lend = { weapon: l.weapon, to: l.to };
  return out;
}
/** 지금 저장 (사본) */
export function readSaengsa(storage) {
  const s = store(storage);
  try {
    const raw = s?.getItem(SAENGSA_KEY);
    if (raw != null) session = normalize(JSON.parse(raw));
  } catch { /* 이번 실행 동안 유지한다 */ }
  return structuredClone(session);
}
/** 한 번의 저장으로 고치기: fn(draft) 가 참을 돌려주면 저장 · 돌려줌 { changed, saved } */
export function updateSaengsa(fn, storage) {
  readSaengsa(storage);
  const draft = structuredClone(session);
  if (!fn(draft)) return { changed: false, saved: false };
  session = normalize(draft);
  try { store(storage).setItem(SAENGSA_KEY, JSON.stringify(session)); return { changed: true, saved: true }; }
  catch { return { changed: true, saved: false }; }
}
/** 지금 시각까지 끝날 경기(상대끼리 · 마감 지난 내 경기)를 끝내고 저장 · 돌려줌: 지금 저장(사본) */
export function syncSaengsa(now, { cfg = SAENGSA, storage } = {}) {
  updateSaengsa((d) => advance(d.current, now, cfg) > 0, storage);
  return readSaengsa(storage);
}
/** 신청 전 고른 것(동료 · 빌려 줄 무기)을 둔다 */
export function saveDraft(draft, storage) {
  return updateSaengsa((d) => { d.draft = { companions: [...draft.companions], lend: draft.lend ? { ...draft.lend } : null }; return true; }, storage).saved;
}
/**
 * 신청 (사장님 10/29 — 신청 창 안에서만): 동료 둘 · 빌려 줄 무기(lendMax 까지) · 고용 금화를 내고 대회를 만든다.
 *  data = { roster(이름난 인물), drawWeapon, weaponInfo, profOf, owned: [내 무기], hireCostOf(id) → { coins } | { token } } · 동료 = 로스터 인물(서로 다르게) 또는 무명 검객(NAMELESS — 둘 다여도 됨)
 *  지난 대회가 남아 있으면(내 팀은 떨어짐) 남은 경기를 끝내고 하사품을 연 뒤 바꾼다.
 *  돌려줌 { ok, why, cost } — why: 'closed' 신청 창 밖 · 'busy' 진행 중인 내 대회 · 'team' 동료가 틀림 · 'lend' 빌려 줄 무기가 틀림 · 'token' 아직 없는 고용 · 'coins' 금화 모자람
 */
export function signUp({ now, companions, lend = null, seed, data, cfg = SAENGSA, storage }) {
  const before = syncSaengsa(now, { cfg, storage });
  if (!signupWindow(now, cfg).open) return { ok: false, why: 'closed' };
  if (!canSignUp(now, before.current, cfg)) return { ok: false, why: 'busy' };
  const team = (companions ?? []).filter((id, i, all) => id === NAMELESS || (data.roster.includes(id) && all.indexOf(id) === i));
  if (team.length !== cfg.teamSize - 1 || team.length !== (companions ?? []).length) return { ok: false, why: 'team' };
  if (lend && (cfg.lendMax < 1 || !data.owned.includes(lend.weapon) || !(lend.to >= 0 && lend.to < cfg.teamSize))) return { ok: false, why: 'lend' };
  const costs = team.map((id) => data.hireCostOf(id));
  if (costs.some((c) => c.token)) return { ok: false, why: 'token' };
  const cost = costs.reduce((s, c) => s + c.coins, 0);
  if (!updateWallet((w) => { if (w.coins < cost) return false; w.coins -= cost; return true; }).changed) return { ok: false, why: 'coins', cost };
  const old = before.current;
  if (old && old.status !== 'done') advance(old, Infinity, cfg); // 떨어진 지난 대회는 남은 경기를 끝까지
  const prize = old ? openChests(old, cfg) : null;
  const t = createTournament({ day: signupWindow(now, cfg).day, seed, at: now, companions: team, roster: data.roster, lend, drawWeapon: data.drawWeapon, weaponInfo: data.weaponInfo, profOf: data.profOf, cfg });
  const res = updateSaengsa((d) => { d.current = t; d.draft = { companions: [...team], lend: lend ? { ...lend } : null }; return true; }, storage);
  if (!res.changed) { updateWallet((w) => { w.coins += cost; return true; }); return { ok: false, why: 'save' }; }
  if (prize) addCoins(prize.reduce((s, x) => s + (x.kind === 'coins' ? x.amount : 0), 0));
  return { ok: true, why: null, cost, saved: res.saved };
}
/** 내 경기 결과 적기 (엔진 결과가 없으면 빠른 셈) · 돌려줌: 경기 결과 | null */
export function playMine(matchId, picks, now, engineResult = null, { cfg = SAENGSA, storage } = {}) {
  syncSaengsa(now, { cfg, storage });
  let out = null;
  updateSaengsa((d) => {
    const t = d.current, m = t && matchById(t, matchId);
    if (!m || myMatch(t)?.id !== matchId) return false;
    out = finishMine(t, m, picks, now, engineResult, cfg);
    return !!out;
  }, storage);
  return out;
}
/** 왕의 하사품 열기 (우승 셋 · 준우승 하나) · 돌려줌: [{ kind, amount }] | null (열 것이 없음) */
export function claimChests({ cfg = SAENGSA, storage } = {}) {
  let got = null;
  updateSaengsa((d) => { got = d.current && openChests(d.current, cfg); if (got) d.current.chests = got; return !!got; }, storage);
  if (got) addCoins(got.reduce((s, x) => s + (x.kind === 'coins' ? x.amount : 0), 0));
  return got;
}
