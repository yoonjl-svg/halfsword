// 대기실 ③ '생사전' 칸 (사장님 10/29 14:1x 요지 — 탭 '이벤트'를 '생사전'으로 · 3단 영역에 부제 '3인의 맹약' · 짧은 설명 · 기본 설정 · 맨 아래 '생사전 입장' 단추):
//  스킬 칸처럼 ③ 창 안을 채우는 판 하나(lobby.css .saengsa-host — 창 안 폭 · 높이 그대로) — 설명 두 문장 · 내 팀 세 칸(나 · 동료 둘) · 안내 한 줄 · 고용 금화 · '생사전 입장'.
//  동료 칸(둘 중 아무거나)을 누르면 판 안을 덮는 고르기 카드 하나 — 동료 둘을 한 번에 (사장님 11/18 '참여 캐릭터 고를 때 인원 1,2,3을 각각 고르는 게 불편해.
//   한 번에 모든 캐릭터를 복수 선택할 수 잇게 바꿔. 또한 캐릭터 선택 ui에는 무기까지 배정할 필요가 없어. … 캐릭터 선택에 나의 보유 무기 현황을 참고할 수 있는 것 자체는 좋은데'):
//   · 인물 카드를 누르면 고름 · 다시 누르면 뺌(남은 사람이 앞으로) — 둘까지 · 고른 차례 표 1 · 2 = 동료 1 · 동료 2 (saengsa_rules.js toggleCompanion — 무명 검객은 0 → 1 → 2 → 0)
//   · 카드마다 그 인물의 유파(숙련도가 가장 높은 유파) + 내가 가진 그 유파 무기 수(생사전에서 든 무기의 유파 숙련도로 싸움 — 기록 docs/strike/saengsa_ui_2026-11-18.md §1) · 무명 검객은 유파가 대회마다 정해져 빈칸
//   · 오른쪽 '가진 무기' — 유파마다 묶어 여러 줄로 감아 보임(누르지 않음 · 보기만)
//   · 무기 배정은 없다 — 무기는 생사전 화면에서 경기마다(saengsa_page.js '무기 배정' — 첫 경기 전에 처음 받음). '나' 칸은 고르지 않는다.
//  신청 창(밤 10시 ~ 새벽 2시) 안에서 '생사전 입장' = 이 팀으로 신청(고용 금화를 냄) + 생사전 화면 · 창 밖이거나 신청한 뒤에는 화면만 연다.
//  입장 조건(18:2x — 정복자 호칭 · 가진 무기 5 개)을 못 채우면 안내 줄에 모자란 것 · '생사전 입장'은 꺼짐 · '대진표' 단추로 화면을 보기만.
//  신청한 대회가 있으면 팀 칸은 그 대회의 팀(경기에서 든 무기)을 보이기만 한다(경기마다 무기는 생사전 화면에서).
//  바로 시작 (사장님 11/12 '참여하면 바로 시작 … 밤 10시부터 새벽 2시 사이'): 신청하면 생사전 화면이 내 첫 경기 화면을 곧바로 연다(onEnter({ fresh: true })) ·
//   열린 때 밖(새로 들어갈 수 없음 · 이어 할 대회도 없음)에는 '생사전 입장'이 꺼지고 일정 알약이 다음 열림 · 지난 대회가 있으면 '대진표'로 보기만 · 시작한 대회는 새벽 2시 뒤에도 '생사전 입장'으로 이어 함.
import { SAENGSA } from './config.js';
import { clockFrom, signupWindow } from './saengsa_clock.js';
import { scheduleState, canSignUp, myMatch, myTeamOut, sidesOf, winnerOf, readyAt, matchState, chestCount, seatOrder, noWait, NAMELESS, toggleCompanion } from './saengsa_rules.js';
import { syncSaengsa, readSaengsa, saveDraft, signUp, newSeed } from './saengsa_store.js';
import { SAENGSA_DATA, HIRE_ROSTER, entryState, hireCostOf, nameOf, spokenName, fighterName, portraitOf, weaponName, hireSchoolOf, ownedBySchool } from './saengsa_roster.js';
import { makeNamelessFaces } from './saengsa_nameless.js';
import { SAENGSA_TEXT as T, SCHOOL_KO, stateLine, signupHours, nextMatchLine, outLine, chestLine, hireLine, roundName, teamName, entryLine, schoolCountLine } from './saengsa_text.js';
import { COIN_ICON } from './wallet_icons.js';
// 칼 표 — 인물 카드의 '가진 그 유파 무기 수' 앞 (사장님 11/18 — '독일 3' 이 숙련도 3 으로 읽히지 않게). 대기실 고르개 표(lobby.js CHEVRON · CHECK)와 같은 꼴: 선 · 글자 색 · 둥근 끝.
//  칼날(굵게) · 짧은 코등이 · 손잡이 · 둥근 머리 — 코등이를 길게 그리면 9 px 에서 '×'(곱하기)로 읽혀 짧게 (견본으로 봄)
const SWORD = '<svg class="sg-sword" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1 4.4 5.6" stroke-width="1.7"/><path d="M3.2 4.7l2.1 2.1M4.3 5.7 2.2 7.8" stroke-width="1.3"/><circle cx="1.6" cy="8.4" r="1" fill="currentColor" stroke="none"/></svg>';
import { readProgress } from './lobby_progress.js';

const MAX = SAENGSA.teamSize - 1; // 동료 수 (나 + 둘)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * host: ③ 창 안 판(#saengsaHost) · chip: 제목 줄 오른쪽 일정 알약 · status(text, tone): 대기실 알림 줄 · onEnter(): 생사전 화면으로 · onWallet(): 금화가 바뀜
 */
export function mountSaengsaPanel(host, { chip, status = () => {}, onEnter = () => {}, onWallet = () => {}, now = clockFrom() } = {}) {
  host.innerHTML = `<div class="sg-body"><p class="sg-desc">${esc(T.desc)}</p>
    <div class="sg-team" role="group" aria-label="${T.myTeam}"><div class="sg-slot" data-slot="0" data-me></div>${[1, 2].map((i) => `<button type="button" class="sg-slot" data-slot="${i}"></button>`).join('')}</div>
    <p class="sg-note" id="sgNote"></p></div>
    <div class="sg-foot"><span class="sg-cost wallet" id="sgCost" hidden>${COIN_ICON}<b></b></span><button type="button" class="secondary small sg-look" id="sgLook" hidden>${T.bracket}</button><button type="button" class="primary sg-enter" id="saengsaEnter">${T.enter}</button></div>
    <section class="sg-picker" id="sgPicker" hidden aria-labelledby="sgPickTitle"><button type="button" class="detail-close" id="sgPickClose" aria-label="닫기">×</button>
      <b class="sg-pick-title" id="sgPickTitle" tabindex="-1">${T.pick}</b>
      <div class="sg-pick-main"><div class="sg-roster" id="sgRoster" role="listbox" aria-multiselectable="true" aria-label="${T.pick}"></div>
        <section class="sg-owned" aria-labelledby="sgOwnedTitle"><b class="sg-owned-title" id="sgOwnedTitle">${T.owned}</b><div class="sg-owned-list" id="sgOwned"></div></section></div>
      <div class="sg-pick-actions"><span class="sg-cost wallet" id="sgPickCost">${COIN_ICON}<b></b></span><button type="button" class="primary" id="sgPickOk">${T.confirm}</button></div>
    </section>`;
  const $ = (sel) => host.querySelector(sel), events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const slots = [...host.querySelectorAll('.sg-slot')];
  let picker = null; // { ids: [인물 id — 고른 차례 = 동료 1 · 2] } — 고르기 카드가 열린 동안
  let view = null; // 지금 그린 것 { editable, draft, t, blocked, cost }

  const draftOf = () => readSaengsa().draft;
  const costOf = (ids) => ids.filter(Boolean).reduce((s, id) => s + (hireCostOf(id).coins ?? 0), 0);
  /** 인물의 유파 줄 ('일본' + 가진 그 유파 무기 수 — saengsa_roster.js hireSchoolOf) — 무명 검객 · 모르는 인물은 null */
  const schoolOf = (id, owned) => { const s = hireSchoolOf(id); return s ? { s, n: owned[s]?.length ?? 0 } : null; };
  function slotHtml({ id, sub = '', price, empty, cloth = 0, name = nameOf(id) }) {
    if (empty) return `<span class="sg-slot-empty">${T.pick}</span>${price ?? ''}`;
    // 칸 = 얼굴 · 이름 · (유파 또는 든 무기 · 고용 금화) — '나' · '동료' 는 칸 자리로 읽히고 화면 읽기 글(aria-label)에 있다
    return `<img class="sg-slot-face" src="${esc(portraitOf(id, cloth))}" alt="" draggable="false"><span class="sg-slot-body"><b class="sg-slot-name">${esc(name)}</b><span class="sg-slot-meta"><small class="sg-slot-sub">${esc(sub)}</small>${price ?? ''}</span></span>`;
  }
  const priceHtml = (id) => { const c = hireCostOf(id); return c.coins != null ? `<span class="sg-price">${COIN_ICON}${c.coins}</span>` : ''; };

  function render() {
    const t0 = now(), st = syncSaengsa(t0), t = st.current, sched = scheduleState(t0, t), w = signupWindow(t0);
    chip.textContent = stateLine(sched);
    chip.dataset.kind = sched.kind;
    const editable = !t || canSignUp(t0, t); // 신청할 수 있거나(창 안) 신청한 대회가 없을 때(창 밖 — 미리 골라 둠)
    const draft = st.draft, entry = entryState(), blocked = editable && entry.missing.length > 0;
    // 열린 때 밖 (사장님 11/12 '특정 시간에만 열리게'): 새로 들어갈 수 없고 이어 할 내 대회도 없음 — 입장 꺼짐 · 지난 대회는 '대진표'로 보기만
    const shut = !blocked && !canSignUp(t0, t) && !(t && t.status !== 'done' && !myTeamOut(t));
    view = { editable, draft, t, blocked };
    $('#saengsaEnter').disabled = blocked || shut; // 입장 조건을 못 채움 — 신청은 못 하고 대진표 보기만(사장님 10/29 18:2x)
    $('#sgLook').hidden = !(blocked || (shut && t));
    if (editable) {
      // 신청 전: 고른 것(draft) — '나' 칸은 보이기만 · 동료 칸 = 본 유파 · 고용 금화
      const ids = ['player', ...draft.companions], owned = ownedBySchool(entry.owned);
      slots.forEach((b, i) => {
        const id = ids[i], sc = i && id ? schoolOf(id, owned) : null;
        if (i) b.disabled = false;
        b.dataset.state = id ? 'set' : 'empty';
        b.innerHTML = slotHtml({ id, empty: !id, sub: sc ? SCHOOL_KO[sc.s] : '', price: id && i ? priceHtml(id) : '', cloth: i - 1 }); // 내 무명 검객 옷 색 = 자리 1 → 줄 0 · 자리 2 → 줄 1 (saengsa_rules.js createTournament 와 같게)
        const price = id && i ? hireCostOf(id).coins : null;
        b.setAttribute('aria-label', id ? `${i ? T.companion : T.me} · ${spokenName(id, i - 1)}${sc ? ` · ${SCHOOL_KO[sc.s]}` : ''}${price != null ? ` · ${hireLine(price)}` : ''}` : T.pick);
      });
      const cost = costOf(draft.companions);
      view.cost = cost;
      $('#sgCost').hidden = !cost;
      $('#sgCost b').textContent = cost.toLocaleString('ko-KR');
      $('#sgCost').setAttribute('aria-label', hireLine(cost));
      const full = draft.companions.every(Boolean), poor = readProgress().coins < cost;
      $('#sgNote').textContent = blocked ? entryLine(entry.missing) : !w.open ? signupHours(w.from, w.to) : !full ? T.pickTwo : poor ? T.noCoins : noWait() ? T.willSignNow : T.willSign;
      $('#sgNote').dataset.tone = blocked || (w.open && full && poor) ? 'alert' : '';
    } else {
      // 신청한 대회 (또는 끝난 대회): 그 팀 그대로 · 누를 수 없음 · 둘째 줄 = 지금 든 무기(첫 경기 무기 배정 전에는 빈칸)
      const members = t.teams[0].members;
      slots.forEach((b, i) => {
        const f = members[i];
        if (i) b.disabled = true;
        b.dataset.state = f?.dead ? 'dead' : 'set';
        b.innerHTML = f ? slotHtml({ id: f.id, sub: f.weapon ? weaponName(f.weapon) : '', cloth: f.cloth, name: fighterName(f) }) : '';
        b.setAttribute('aria-label', f ? `${i ? T.companion : T.me} · ${fighterName(f)}${f.weapon ? ` · ${weaponName(f.weapon)}` : ''}${f.dead ? ` · ${T.dead}` : ''}` : '');
      });
      $('#sgCost').hidden = true;
      $('#sgNote').textContent = noteFor(t, t0);
      $('#sgNote').dataset.tone = '';
    }
  }
  function noteFor(t, t0) {
    const n = t.teams.length;
    if (t.status === 'done') {
      const chests = chestCount(t);
      if (chests && !t.chests) return chestLine(chests);
      return t.champion === 0 ? `${T.champion} · ${T.myTeam}` : `${T.champion} · ${teamName(seatNo(t, t.champion), false)}`;
    }
    if (myTeamOut(t)) {
      const lost = t.matches.find((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
      return outLine(roundName(n, lost.round), lost.result.by === 'forfeit');
    }
    const m = myMatch(t);
    if (!m) return '';
    return nextMatchLine(roundName(n, m.round), readyAt(t, m) ?? 0, matchState(t, m, t0), t0);
  }
  const seatNo = (t, team) => seatOrder(t).indexOf(team) + 1;

  // ── 고르기 카드 (동료 둘을 한 번에 — 사장님 11/18) ──
  function openPicker() {
    picker = { ids: draftOf().companions.filter(Boolean) };
    drawPicker();
    drawOwned();
    $('#sgPicker').hidden = false;
    $('#sgPickTitle').focus({ preventScroll: true });
  }
  function drawPicker() {
    const ids = picker.ids, full = ids.length >= MAX, owned = ownedBySchool(entryState().owned);
    $('#sgRoster').innerHTML = HIRE_ROSTER.map((id) => {
      const at = ids.flatMap((x, k) => (x === id ? [k] : [])); // 고른 자리 (무명 검객은 둘일 수 있음)
      const on = at.length > 0, shut = full && !on; // 둘을 다 골랐으면 고르지 않은 카드는 흐리게(누르면 아무 일 없음)
      const sc = schoolOf(id, owned), price = hireCostOf(id).coins;
      const badge = at.map((k) => `<i>${k + 1}</i>`).join('');
      const school = sc ? `<span class="sg-pick-school">${SCHOOL_KO[sc.s]} <span class="sg-pick-own"${sc.n ? '' : ' data-none'}>${SWORD}<b>${sc.n}</b></span></span>` : '<span class="sg-pick-school"></span>';
      const label = `${nameOf(id)}${sc ? ` · ${schoolCountLine(SCHOOL_KO[sc.s], sc.n)}` : ''}${price != null ? ` · ${hireLine(price)}` : ''}${on ? ` · ${at.map((k) => `${T.companion} ${k + 1}`).join(' · ')}` : ''}`;
      return `<button type="button" class="sg-pick" role="option" data-id="${id}" aria-selected="${on}"${shut ? ' aria-disabled="true" data-shut' : ''} aria-label="${esc(label)}">${badge ? `<span class="sg-order" aria-hidden="true">${badge}</span>` : ''}<img src="${esc(portraitOf(id, at[0] ?? 0))}" alt="" draggable="false"><span class="sg-pick-name">${esc(nameOf(id))}</span>${school}${priceHtml(id)}</button>`;
    }).join('');
    const cost = costOf(ids);
    $('#sgPickCost').hidden = !cost;
    $('#sgPickCost b').textContent = cost.toLocaleString('ko-KR');
    $('#sgPickCost').setAttribute('aria-label', hireLine(cost));
  }
  /** 가진 무기 (보기만 — 유파마다 한 묶음 · 이름은 감아 여러 줄 · 묶음 사이는 조금 띄움 · 유파 이름은 화면에 쓰지 않음 — 사장님 11/18 · 화면 읽기 글에만) */
  function drawOwned() {
    const owned = ownedBySchool(entryState().owned);
    $('#sgOwned').innerHTML = Object.entries(owned).map(([s, list]) => `<div class="sg-own-g" role="group" aria-label="${esc(SCHOOL_KO[s])}">${list.map((w) => `<span class="sg-own-w">${esc(weaponName(w))}</span>`).join('')}</div>`).join('');
  }
  function closePicker(save) {
    if (save && picker) {
      const d = draftOf();
      d.companions = [picker.ids[0] ?? null, picker.ids[1] ?? null];
      if (!saveDraft(d)) status(T.saveFail);
    }
    picker = null;
    $('#sgPicker').hidden = true;
    render();
    slots[1].focus({ preventScroll: true });
  }
  for (const b of slots.slice(1)) on(b, 'click', () => { if (!b.disabled) openPicker(); });
  on($('#sgRoster'), 'click', (e) => {
    const b = e.target.closest('.sg-pick');
    if (!b || !picker) return;
    const next = toggleCompanion(picker.ids, b.dataset.id, MAX);
    if (next.join() === picker.ids.join()) return; // 둘을 다 골랐는데 다른 카드를 누름
    picker.ids = next;
    drawPicker();
    host.querySelector(`.sg-pick[data-id="${b.dataset.id}"]`)?.focus({ preventScroll: true });
  });
  on($('#sgPickOk'), 'click', () => closePicker(true));
  on($('#sgPickClose'), 'click', () => closePicker(false));
  on(host, 'keydown', (e) => { if (e.key === 'Escape' && picker) { e.preventDefault(); e.stopPropagation(); closePicker(false); } });

  // ── 생사전 입장: 신청 창 안 · 신청 전이면 신청 → 화면(내 첫 경기) / 진행 중인 내 대회는 화면만(새벽 2시 뒤에도) / 열린 때 밖은 들어가지 않음 ──
  on($('#saengsaEnter'), 'click', () => {
    const t0 = now(), st = readSaengsa();
    if (canSignUp(t0, st.current)) {
      if (!view?.editable) { render(); return; } // 그 사이 열린 때가 됨 — 다시 그린 판(팀 고르기)으로
      const d = st.draft, entry = entryState();
      if (entry.missing.length) { status(entryLine(entry.missing)); render(); return; }
      if (!d.companions.every(Boolean)) { status(T.pickTwo); return; }
      const res = signUp({ now: t0, companions: d.companions, seed: newSeed(), data: { ...SAENGSA_DATA, owned: entry.owned, hasTitle: entry.hasTitle, hireCostOf } });
      if (!res.ok) { status({ coins: T.noCoins, busy: T.busy, team: T.pickTwo, entry: entryLine(entryState().missing), closed: signupHours(signupWindow(t0).from, signupWindow(t0).to) }[res.why] ?? T.saveFail); render(); return; }
      onWallet();
      status(T.signed, 'notice');
      onEnter({ fresh: true }); // 바로 시작 — 생사전 화면이 내 첫 경기를 곧바로 연다 (사장님 11/12)
      return;
    }
    const t = st.current;
    if (!(t && t.status !== 'done' && !myTeamOut(t))) { const w = signupWindow(t0); status(signupHours(w.from, w.to)); render(); return; } // 그 사이 열린 때가 지남(꺼지기 전에 누름) — 들어가지 않음
    onEnter();
  });

  on($('#sgLook'), 'click', () => onEnter()); // 입장 조건을 못 채웠을 때 · 열린 때 밖에 지난 대회 — 신청 없이 대진표만 본다

  render();
  makeNamelessFaces().then((ok) => { if (ok) { if (picker) drawPicker(); else render(); } }); // 무명 검객 얼굴(옷 색마다)을 칠한 뒤 다시 그림
  const timer = setInterval(() => { if (host.offsetParent && !picker) render(); }, 30e3);
  return {
    refresh: () => { if (!picker) render(); },
    destroy() { clearInterval(timer); events.abort(); },
  };
}
