// 대기실 ③ '생사전' 칸 (사장님 10/29 14:1x 요지 — 탭 '이벤트'를 '생사전'으로 · 3단 영역에 부제 '3인의 맹약' · 짧은 설명 · 기본 설정 · 맨 아래 '생사전 입장' 단추):
//  스킬 칸처럼 ③ 창 안을 채우는 판 하나(lobby.css .saengsa-host — 창 안 폭 · 높이 그대로) — 설명 두 문장 · 내 팀 세 칸(나 · 동료 둘) · 안내 한 줄 · 고용 금화 · '생사전 입장'.
//  팀 칸을 누르면 판 안을 덮는 고르기 카드(스킬 상세 카드 자리 — 동료 고르기 · 빌려 줄 내 무기 · 확인).
//  신청 창(밤 10시 ~ 새벽 2시) 안에서 '생사전 입장' = 이 팀으로 신청(고용 금화를 냄) + 생사전 화면 · 창 밖이거나 신청한 뒤에는 화면만 연다.
//  신청한 대회가 있으면 팀 칸은 그 대회의 팀(뽑힌 무기)을 보이기만 한다.
import { SAENGSA } from './config.js';
import { clockFrom, signupWindow } from './saengsa_clock.js';
import { scheduleState, canSignUp, myMatch, myTeamOut, sidesOf, winnerOf, readyAt, matchState, chestCount, seatOrder } from './saengsa_rules.js';
import { syncSaengsa, readSaengsa, saveDraft, signUp, newSeed } from './saengsa_store.js';
import { SAENGSA_DATA, HIRE_ROSTER, ownedWeapons, hireCostOf, nameOf, spokenName, fighterName, portraitOf, weaponName } from './saengsa_roster.js';
import { NAMELESS } from './saengsa_rules.js';
import { makeNamelessFaces } from './saengsa_nameless.js';
import { SAENGSA_TEXT as T, stateLine, signupHours, nextMatchLine, outLine, chestLine, hireLine, roundName, teamName } from './saengsa_text.js';
import { COIN_ICON } from './wallet_icons.js';
import { readProgress } from './lobby_progress.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * host: ③ 창 안 판(#saengsaHost) · chip: 제목 줄 오른쪽 일정 알약 · status(text, tone): 대기실 알림 줄 · onEnter(): 생사전 화면으로 · onWallet(): 금화가 바뀜
 */
export function mountSaengsaPanel(host, { chip, status = () => {}, onEnter = () => {}, onWallet = () => {}, now = clockFrom() } = {}) {
  host.innerHTML = `<div class="sg-body"><p class="sg-desc">${esc(T.desc)}</p>
    <div class="sg-team" role="group" aria-label="${T.myTeam}">${[0, 1, 2].map((i) => `<button type="button" class="sg-slot" data-slot="${i}"></button>`).join('')}</div>
    <p class="sg-note" id="sgNote"></p></div>
    <div class="sg-foot"><span class="sg-cost wallet" id="sgCost" hidden>${COIN_ICON}<b></b></span><button type="button" class="primary sg-enter" id="saengsaEnter">${T.enter}</button></div>
    <section class="sg-picker" id="sgPicker" hidden aria-labelledby="sgPickTitle"><button type="button" class="detail-close" id="sgPickClose" aria-label="닫기">×</button>
      <b class="sg-pick-title" id="sgPickTitle" tabindex="-1"></b>
      <div class="sg-roster" id="sgRoster" role="listbox" aria-label="${T.pick}"></div>
      <div class="sg-lend"><span class="sg-lend-label">${T.weapon}</span><div class="sg-chips" id="sgChips" role="radiogroup" aria-label="${T.weapon}"></div>
        <div class="sg-pick-actions"><button type="button" class="primary" id="sgPickOk">${T.confirm}</button></div></div>
    </section>`;
  const $ = (sel) => host.querySelector(sel), events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const slots = [...host.querySelectorAll('.sg-slot')];
  let picker = null; // { slot, id, weapon } — 고르기 카드가 열린 동안
  let view = null; // 지금 그린 것 { editable, draft, t, cost }

  const draftOf = () => readSaengsa().draft;
  const lendText = (w) => (w ? weaponName(w) : T.random); // 칸이 좁아 '무작위' (고르기 카드의 '무기' 줄과 같은 말)
  function slotHtml({ id, weapon, lent, price, empty, cloth = 0, name = nameOf(id) }) {
    if (empty) return `<span class="sg-slot-empty">${T.pick}</span>${price ?? ''}`;
    // 칸 = 얼굴 · 이름 · (무기 · 고용 금화) — '나' · '동료' 는 칸 자리로 읽히고 화면 읽기 글(aria-label)에 있다
    return `<img class="sg-slot-face" src="${esc(portraitOf(id, cloth))}" alt="" draggable="false"><span class="sg-slot-body"><b class="sg-slot-name">${esc(name)}</b><span class="sg-slot-meta"><small class="sg-slot-weapon"${lent ? ' data-lent' : ''}>${esc(weapon)}</small>${price ?? ''}</span></span>`;
  }
  const priceHtml = (id) => { const c = hireCostOf(id); return c.coins != null ? `<span class="sg-price">${COIN_ICON}${c.coins}</span>` : ''; };

  function render() {
    const t0 = now(), st = syncSaengsa(t0), t = st.current, sched = scheduleState(t0, t), w = signupWindow(t0);
    chip.textContent = stateLine(sched);
    chip.dataset.kind = sched.kind;
    const editable = !t || canSignUp(t0, t); // 신청할 수 있거나(창 안) 신청한 대회가 없을 때(창 밖 — 미리 골라 둠)
    const draft = st.draft, lend = draft.lend;
    view = { editable, draft, t };
    if (editable) {
      // 신청 전: 고른 것(draft)
      const ids = ['player', ...draft.companions];
      slots.forEach((b, i) => {
        const id = ids[i];
        b.disabled = false;
        b.dataset.state = id ? 'set' : 'empty';
        b.innerHTML = slotHtml({ id, empty: !id, weapon: lendText(lend?.to === i ? lend.weapon : null), lent: lend?.to === i, price: id && i ? priceHtml(id) : '', cloth: i - 1 }); // 내 무명 검객 옷 색 = 자리 1 → 줄 0 · 자리 2 → 줄 1 (saengsa_rules.js createTournament 와 같게)
        const price = id && i ? hireCostOf(id).coins : null;
        b.setAttribute('aria-label', id ? `${i ? T.companion : T.me} · ${spokenName(id, i - 1)} · ${lend?.to === i ? `${weaponName(lend.weapon)} · ${T.lentTag}` : T.randomWeapon}${price != null ? ` · ${hireLine(price)}` : ''}` : T.pick);
      });
      const cost = draft.companions.filter(Boolean).reduce((s, id) => s + (hireCostOf(id).coins ?? 0), 0);
      view.cost = cost;
      $('#sgCost').hidden = !cost;
      $('#sgCost b').textContent = cost.toLocaleString('ko-KR');
      $('#sgCost').setAttribute('aria-label', hireLine(cost));
      const full = draft.companions.every(Boolean);
      $('#sgNote').textContent = !w.open ? signupHours(w.from, w.to) : !full ? T.pickTwo : readProgress().coins < cost ? T.noCoins : T.willSign;
      $('#sgNote').dataset.tone = w.open && full && readProgress().coins < cost ? 'alert' : '';
    } else {
      // 신청한 대회 (또는 끝난 대회): 그 팀 그대로 · 누를 수 없음
      const members = t.teams[0].members;
      slots.forEach((b, i) => {
        const f = members[i];
        b.disabled = true;
        b.dataset.state = f?.dead ? 'dead' : 'set';
        b.innerHTML = f ? slotHtml({ id: f.id, weapon: weaponName(f.weapon), lent: f.lent, cloth: f.cloth, name: fighterName(f) }) : '';
        b.setAttribute('aria-label', f ? `${i ? T.companion : T.me} · ${fighterName(f)} · ${weaponName(f.weapon)}${f.lent ? ` · ${T.lentTag}` : ''}${f.dead ? ` · ${T.dead}` : ''}` : '');
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

  // ── 고르기 카드 ──
  function openPicker(slot) {
    const d = draftOf();
    picker = { slot, id: slot ? d.companions[slot - 1] : 'player', weapon: d.lend?.to === slot ? d.lend.weapon : null };
    $('#sgRoster').hidden = !slot;
    drawPicker();
    $('#sgPicker').hidden = false;
    $('#sgPickTitle').focus({ preventScroll: true });
  }
  function drawPicker() {
    const d = draftOf(), other = picker.slot ? d.companions[2 - picker.slot] : null;
    if (picker.slot) {
      $('#sgRoster').innerHTML = HIRE_ROSTER.map((id) => {
        const taken = id === other && id !== NAMELESS, on = id === picker.id; // 무명 검객은 두 자리 모두 고를 수 있다
        return `<button type="button" class="sg-pick" role="option" data-id="${id}" aria-selected="${on}" ${taken ? 'disabled' : ''}><img src="${esc(portraitOf(id, picker.slot - 1))}" alt="" draggable="false"><span class="sg-pick-name">${esc(nameOf(id))}</span>${priceHtml(id)}</button>`;
      }).join('');
    }
    $('#sgChips').innerHTML = [null, ...ownedWeapons()].map((w) => `<button type="button" class="sg-chip-btn" role="radio" data-weapon="${w ?? ''}" aria-checked="${(picker.weapon ?? null) === w}">${esc(w ? weaponName(w) : T.random)}</button>`).join('');
    $('#sgPickOk').disabled = !!picker.slot && !picker.id;
    $('#sgPickTitle').textContent = `${picker.slot ? `${T.companion} ${picker.slot}` : T.me}${picker.id && picker.slot ? ` · ${nameOf(picker.id)}` : ''}`; // 고른 사람 이름 (칸 이름표는 좁아 줄어들 수 있다)
  }
  function closePicker(save) {
    if (save && picker) {
      const d = draftOf();
      if (picker.slot) d.companions[picker.slot - 1] = picker.id;
      if (picker.weapon) d.lend = SAENGSA.lendMax > 0 ? { weapon: picker.weapon, to: picker.slot } : null;
      else if (d.lend?.to === picker.slot) d.lend = null;
      if (!saveDraft(d)) status(T.saveFail);
    }
    const slot = picker?.slot;
    picker = null;
    $('#sgPicker').hidden = true;
    render();
    if (slot != null) slots[slot].focus({ preventScroll: true });
  }
  for (const b of slots) on(b, 'click', () => { if (!b.disabled) openPicker(+b.dataset.slot); });
  on($('#sgRoster'), 'click', (e) => { const b = e.target.closest('.sg-pick'); if (!b || b.disabled) return; picker.id = b.dataset.id; drawPicker(); });
  on($('#sgChips'), 'click', (e) => { const b = e.target.closest('.sg-chip-btn'); if (!b) return; picker.weapon = b.dataset.weapon || null; drawPicker(); });
  on($('#sgPickOk'), 'click', () => closePicker(true));
  on($('#sgPickClose'), 'click', () => closePicker(false));
  on(host, 'keydown', (e) => { if (e.key === 'Escape' && picker) { e.preventDefault(); e.stopPropagation(); closePicker(false); } });

  // ── 생사전 입장: 신청 창 안 · 신청 전이면 신청 → 화면 / 그 밖은 화면만 ──
  on($('#saengsaEnter'), 'click', () => {
    const t0 = now(), st = readSaengsa();
    if (canSignUp(t0, st.current) && view?.editable) {
      const d = st.draft;
      if (!d.companions.every(Boolean)) { status(T.pickTwo); return; }
      const res = signUp({ now: t0, companions: d.companions, lend: d.lend, seed: newSeed(), data: { ...SAENGSA_DATA, owned: ownedWeapons(), hireCostOf } });
      if (!res.ok) { status({ coins: T.noCoins, busy: T.busy, team: T.pickTwo, closed: signupHours(signupWindow(t0).from, signupWindow(t0).to) }[res.why] ?? T.saveFail); render(); return; }
      onWallet();
      status(T.signed, 'notice');
    }
    onEnter();
  });

  render();
  makeNamelessFaces().then((ok) => { if (ok) { if (picker) drawPicker(); else render(); } }); // 무명 검객 얼굴(옷 색마다)을 칠한 뒤 다시 그림
  const timer = setInterval(() => { if (host.offsetParent && !picker) render(); }, 30e3);
  return {
    refresh: () => { if (!picker) render(); },
    destroy() { clearInterval(timer); events.abort(); },
  };
}
