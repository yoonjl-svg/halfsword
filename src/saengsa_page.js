// 생사전 화면 (사장님 10/29 14:1x 요지 — '생사전 입장'을 누르면 생사전 화면 · 토너먼트 대진표 · 대진표 경기를 누르면 전투 진입 화면에서 출전할 수 있는 캐릭터 카드와 상태):
//  game_entry.js showSaengsa 가 대기실과 같은 덮개(Shadow DOM) 안에 연다 · '대기실' 단추로 돌아감. 꾸밈 = 대기실과 같은 숲 배경 · 액자 1 틀 · 싸움 화면 단추 꼴(entrance_ui.css).
//  ① 대진표: 대진마다 한 줄(16강 · 8강 · 4강 · 결승 · 우승) — 경기 칸 = 시각 · 남은 시간이나 한 줄 결과 · 두 팀(얼굴 셋 + 이름). 내 길은 금색 줄 · 지금 할 수 있는 내 경기는 금색 칸 '입장 가능'.
//     칸이 많아(16 팀) 틀 안에서 위아래로 내려 본다 — 열면 내 경기 자리로. 30 초마다 다시 셈(상대끼리 경기는 시각이 지나면 저절로 끝남 — saengsa_store.js syncSaengsa).
//  ② 경기 화면(경기 칸을 누름 — 화면 전체를 덮는 층): 상대 팀 카드 셋 · 내 팀 카드 셋(얼굴 · 이름 · 체력 막대 · 부상 · 무기 · 다섯 유파 숙련도 · 죽은 사람은 흐림).
//     내 경기면 내 카드를 한두 장 골라 '전투 입장' — 상대는 가린 채 함께 고르고 입장 때 함께 보인다(사장님 10/29 14:5x). 결과는 카드 위에 그대로(경기 뒤 체력 · 부상 · 죽음 · 출전 표시).
//     1단계는 엔진이 없어 빠른 셈으로 끝난다(saengsa_engine.js — 2단계 자리).
import uiStyle from './entrance_ui.css?inline';
import lobbyStyle from './lobby.css?inline';
import sgStyle from './saengsa.css?inline';
import typeStyle from './entrance_type.css?inline';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';
import { SAENGSA } from './config.js';
import { clockFrom, signupWindow, roundAt } from './saengsa_clock.js';
import { scheduleState, sidesOf, winnerOf, readyAt, matchState, myMatch, myTeamOut, roundsOf, matchById, matchSetup, chestCount, seatOrder, isSerious, isMine } from './saengsa_rules.js';
import { syncSaengsa, readSaengsa, playMine, claimChests, signUp, newSeed } from './saengsa_store.js';
import { fighterName, portraitOf, weaponName, weaponThumb, SAENGSA_DATA, ownedWeapons, hireCostOf } from './saengsa_roster.js';
import { makeNamelessFaces } from './saengsa_nameless.js';
import { SAENGSA_TEXT as T, SCHOOL_KO, stateLine, clockText as clockWords, untilText, roundName, teamName, resultLine, myResultLine, nextMatchLine, outLine, chestLine, chestGot, injuryText, signupHours } from './saengsa_text.js';
import { makeEngine } from './saengsa_engine.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SCHOOL_CELLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const clockText = (at) => (SAENGSA.testMode ? '' : clockWords(at)); // 시험판은 시각을 보이지 않는다(모든 경기 바로 — 사장님 10/29 17:5x)

/** root: 덮개 Shadow root · game: 게임 모듈(2단계 launchSaengsa) · onBack(): 대기실로 */
export function mountSaengsa({ root, game, onBack, now = clockFrom() }) {
  root.innerHTML = `<style>${uiStyle}\n${lobbyStyle}\n${sgStyle}\n${typeStyle}</style><main class="saengsa" aria-labelledby="sgHeading">
    <canvas class="lobby-backdrop" id="sgGrove" aria-hidden="true"></canvas><div class="lobby-shade" aria-hidden="true"></div>
    <header class="lobby-header sg-header"><div class="sg-titles"><h1 id="sgHeading" tabindex="-1"><span>${T.title}</span></h1><span class="sg-sub">${T.subtitle}</span></div>
      <p id="sgStatus" class="lobby-status" role="status"></p><button id="sgBack" class="secondary small on-art utility">${T.back}</button></header>
    <section class="sg-board" aria-labelledby="sgBoardTitle">
      <div class="sg-board-head"><h2 class="sr-only" id="sgBoardTitle">${T.bracket}</h2><span class="sg-state" id="sgChip"></span><p class="sg-next" id="sgNext"></p>
        <div class="sg-prize" id="sgPrize" hidden><span id="sgPrizeText"></span><button type="button" class="primary" id="sgOpen">${T.open}</button></div>
        <button type="button" class="primary sg-nextcup" id="sgNextCup" hidden>${T.nextCup}</button></div>
      <div class="sg-scroll" id="sgScroll"><div class="sg-bracket" id="sgBracket" role="list"></div><p class="sg-empty" id="sgEmpty" hidden></p></div>
    </section>
    <section class="sg-match" id="sgMatch" hidden aria-labelledby="sgMatchTitle">
      <header class="sg-mh"><button type="button" class="secondary small" id="sgMatchBack">${T.bracket}</button><b id="sgMatchTitle" tabindex="-1"></b><span class="sg-mh-sub" id="sgMatchSub"></span></header>
      <div class="sg-rows"><div class="sg-row"><p class="sg-row-label" id="sgRowA"></p><div class="sg-cards" id="sgCardsA"></div></div>
        <div class="sg-row"><p class="sg-row-label" id="sgRowB"></p><div class="sg-cards" id="sgCardsB"></div></div></div>
      <footer class="sg-mf"><p class="sg-outcome" id="sgOutcome" hidden><b id="sgOutBig"></b><span id="sgOutLine"></span></p><p class="sg-hint" id="sgHint"></p>
        <button type="button" class="primary" id="sgFight">${T.fightEnter}</button><button type="button" class="primary" id="sgDone" hidden>${T.confirm}</button></footer>
    </section></main>`;
  const $ = (id) => root.getElementById(id), events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const grove = createPixelGrove($('sgGrove'), matchMedia('(prefers-reduced-motion: reduce)')); grove.gust();
  paintPixelWordmark($('sgHeading'), { text: T.title, font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 2 });
  const engine = makeEngine(game);
  const status = (text, tone = '') => { $('sgStatus').textContent = text; if (tone) $('sgStatus').dataset.tone = tone; else delete $('sgStatus').dataset.tone; };
  let t = null, open = null; // open = { id, picks: [key], result } — 경기 화면이 열린 동안
  let busy = false;

  // ── 이름 · 얼굴 ──
  const seatNo = (team) => seatOrder(t).indexOf(team) + 1;
  const tName = (team) => (team == null ? '' : teamName(seatNo(team), team === 0));
  const faces = (team) => (team == null ? '' : `<span class="sg-faces">${t.teams[team].members.map((f) => `<img src="${esc(portraitOf(f.id, f.cloth))}" alt="" draggable="false"${f.dead ? ' data-dead' : ''}>`).join('')}</span>`);
  const deathsIn = (m) => Object.values(m.result?.fighters ?? {}).filter((o) => !o.alive).length;
  /** 내 길 (내 팀이 지나왔거나 — 아직 남아 있으면 — 지나갈 경기) */
  function onPath(m) {
    if (isMine(t, m)) return true;
    if (myTeamOut(t)) return false;
    const seat = seatOrder(t).indexOf(0);
    return m.round > 0 && Math.floor(seat / 2 ** (m.round + 1)) === m.index;
  }
  // ── ① 대진표 ──
  function stateOf(m, t0) {
    const st = matchState(t, m, t0), at = readyAt(t, m);
    if (st === 'done') {
      const [A, B] = sidesOf(t, m), W = winnerOf(t, m);
      return { st, time: clockText(m.result.at), text: resultLine(tName(W), tName(W === A ? B : A), m.result, deathsIn(m)) };
    }
    const time = clockText(at ?? roundAt(t.day, m.round));
    if (st === 'soon') return { st, time, text: untilText(at - t0) };
    if (st === 'ready') return { st, time, text: T.ready };
    return { st, time, text: '' }; // 'wait' 앞 경기를 기다림 · 'due' 다음 셈에 끝남
  }
  function renderBracket(t0) {
    const n = t.teams.length, R = roundsOf(n), rows = n / 2;
    const box = $('sgBracket');
    box.style.setProperty('--rounds', R);
    box.style.setProperty('--rows', rows);
    let html = '';
    for (let r = 0; r < R; r++) html += `<p class="sg-col-head" style="grid-column:${r + 1}">${roundName(n, r)}</p>`;
    html += `<p class="sg-col-head" style="grid-column:${R + 1}">${T.champion}</p>`;
    for (const m of t.matches) {
      const span = 2 ** m.round, [A, B] = sidesOf(t, m), W = winnerOf(t, m), s = stateOf(m, t0);
      const team = (x) => `<span class="sg-t"${x != null && W === x ? ' data-win' : ''}${x != null && W != null && W !== x ? ' data-lose' : ''}${x === 0 ? ' data-me' : ''}>${faces(x)}<span class="sg-tn">${x == null ? '—' : esc(tName(x))}</span></span>`;
      const label = `${roundName(n, m.round)}${s.time ? ` ${s.time}` : ''} · ${tName(A) || '—'} · ${tName(B) || '—'}${s.text ? ` · ${s.text}` : ''}`;
      html += `<button type="button" class="sg-m" role="listitem" data-match="${m.id}" data-state="${s.st}"${onPath(m) ? ' data-path' : ''}${A == null || B == null ? ' disabled' : ''} style="grid-column:${m.round + 1};grid-row:${2 + m.index * span} / span ${span}" aria-label="${esc(label)}">
        <span class="sg-m-head"><span class="sg-m-time">${s.time}</span><span class="sg-m-state">${esc(s.text)}</span></span>${team(A)}${team(B)}</button>`;
    }
    const champ = t.champion;
    html += `<div class="sg-champ" style="grid-column:${R + 1};grid-row:2 / span ${rows}"${champ === 0 ? ' data-me' : ''}>${champ == null ? '<span class="sg-tn">—</span>' : `${faces(champ)}<span class="sg-tn">${esc(tName(champ))}</span>`}</div>`;
    box.innerHTML = html;
  }
  function render({ scroll = false } = {}) {
    const t0 = now(), st = syncSaengsa(t0);
    t = st.current;
    const sched = scheduleState(t0, t);
    $('sgChip').textContent = stateLine(sched);
    $('sgChip').dataset.kind = sched.kind;
    $('sgBracket').hidden = !t;
    $('sgEmpty').hidden = !!t;
    $('sgPrize').hidden = true;
    $('sgNextCup').hidden = true;
    if (!t) {
      const w = signupWindow(t0);
      $('sgNext').textContent = '';
      $('sgEmpty').textContent = `${T.noTournament} ${signupHours(w.from, w.to)}`;
      return;
    }
    const n = t.teams.length, m = myMatch(t);
    if (t.status === 'done') {
      $('sgNext').textContent = `${T.champion} · ${tName(t.champion)}`;
      const chests = chestCount(t);
      if (chests && !t.chests) { $('sgPrize').hidden = false; $('sgPrizeText').textContent = chestLine(chests); }
      else if (SAENGSA.testMode) $('sgNextCup').hidden = false; // 시험판: 하사품을 연 뒤(없으면 바로) 다음 대회
    } else if (m) $('sgNext').textContent = nextMatchLine(roundName(n, m.round), readyAt(t, m) ?? 0, matchState(t, m, t0), t0);
    else if (myTeamOut(t)) {
      const lost = t.matches.find((x) => x.result && sidesOf(t, x).includes(0) && winnerOf(t, x) !== 0);
      $('sgNext').textContent = outLine(roundName(n, lost.round), lost.result.by === 'forfeit');
    }
    renderBracket(t0);
    if (scroll) {
      const target = (m && $('sgBracket').querySelector(`[data-match="${m.id}"]`)) || $('sgBracket').querySelector('.sg-m[data-path]');
      if (target) { const sc = $('sgScroll'), r = target.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop += r.top - b.top - (sc.clientHeight - r.height) / 2; }
    }
    if (open && !open.result) renderMatch(); // 경기 화면이 열려 있으면 시각 · 상태만 새로
  }
  on($('sgBracket'), 'click', (e) => { const b = e.target.closest('.sg-m'); if (b && !b.disabled) openMatch(b.dataset.match); });
  on($('sgOpen'), 'click', () => {
    const got = claimChests();
    if (got) status(chestGot(got.reduce((s, x) => s + (x.kind === 'coins' ? x.amount : 0), 0)), 'notice');
    render();
    if (!$('sgNextCup').hidden) $('sgNextCup').focus({ preventScroll: true });
  });
  // 시험판 '다음 대회': 지난 팀(동료 · 빌려 준 무기) 그대로 바로 새 대회 — 고용 금화는 시험판 지갑에서
  on($('sgNextCup'), 'click', () => {
    const t0 = now(), d = readSaengsa().draft;
    const res = signUp({ now: t0, companions: d.companions, lend: d.lend, seed: newSeed(), data: { ...SAENGSA_DATA, owned: ownedWeapons(), hireCostOf } });
    if (!res.ok) { status({ coins: T.noCoins, busy: T.busy, team: T.pickTwo }[res.why] ?? T.saveFail, 'alert'); return; }
    status(T.signed, 'notice');
    render({ scroll: true });
    $('sgHeading').focus({ preventScroll: true });
  });

  // ── ② 경기 화면 ──
  function card(f, { mine, pick, picked, entrant, result }) {
    const o = result?.fighters?.[f.key], hp = o ? o.hp : f.hp, inj = o ? o.injuries : f.injuries, dead = o ? !o.alive : f.dead;
    const hpPct = Math.max(0, Math.min(100, Math.round((hp / SAENGSA.hpMax) * 100)));
    // 다섯 유파 + 무유파가 주 유파인 인물만 무유파 칸 (숙련도 표에 none 이 있는 사람 — 브론 · 마야 · 김씨) · 든 무기의 유파 칸을 강조
    const cells = f.prof && 'none' in f.prof && f.id !== 'player' ? [...SCHOOL_CELLS, 'none'] : SCHOOL_CELLS;
    const prof = cells.map((s) => `<span class="sg-pc"${s === f.school ? ' data-on' : ''}><small>${SCHOOL_KO[s]}</small><b>${f.prof?.[s] ?? 0}</b></span>`).join('');
    const tag = pick ? 'button' : 'div';
    const label = `${fighterName(f)} · 체력 ${hp} · ${injuryText(inj, (i) => isSerious(i))} · ${weaponName(f.weapon)}${dead ? ` · ${T.dead}` : ''}`;
    return `<${tag} ${pick ? 'type="button" ' : ''}class="sg-card" data-key="${f.key}"${pick ? ` aria-pressed="${picked}"` : ''}${dead ? ' data-dead' : ''}${entrant ? ' data-entrant' : ''}${mine ? ' data-mine' : ''}${pick && dead ? ' disabled' : ''} aria-label="${esc(label)}">
      <img class="sg-face" src="${esc(portraitOf(f.id, f.cloth))}" alt="" draggable="false">
      <span class="sg-card-body"><b class="sg-name">${esc(fighterName(f))}</b>
        <span class="sg-hp"><span class="sg-hp-bar"><i style="width:${hpPct}%"></i></span><span class="sg-hp-num">${hp}</span></span>
        <span class="sg-wpn"><img src="${esc(weaponThumb(f.weapon))}" alt="" draggable="false"><span>${esc(weaponName(f.weapon))}</span>${f.lent ? `<i class="sg-tag">${T.lentTag}</i>` : ''}</span>
        <span class="sg-inj"${inj.length ? ' data-hurt' : ''}>${esc(injuryText(inj, (i) => isSerious(i)))}</span></span>
      <span class="sg-prof" aria-hidden="true">${prof}</span>${dead ? `<span class="sg-badge" data-kind="dead">${T.dead}</span>` : entrant ? `<span class="sg-badge">${T.entrant}</span>` : ''}</${tag}>`;
  }
  function openMatch(id) {
    open = { id, picks: [], result: null };
    renderMatch();
    $('sgMatch').hidden = false;
    $('sgMatchTitle').focus({ preventScroll: true });
  }
  function closeMatch() {
    const id = open?.id;
    open = null;
    $('sgMatch').hidden = true;
    render();
    $('sgBracket').querySelector(`[data-match="${id}"]`)?.focus({ preventScroll: true });
  }
  function renderMatch() {
    const m = matchById(t, open.id), t0 = now();
    if (!m) { closeMatch(); return; }
    const [A, B] = sidesOf(t, m), result = open.result ?? m.result, n = t.teams.length;
    const mineSide = A === 0 ? 'a' : B === 0 ? 'b' : null;
    const playable = !result && mineSide && myMatch(t)?.id === m.id && matchState(t, m, t0) === 'ready';
    // 내 경기면 위 = 상대 · 아래 = 내 팀 / 그 밖은 위 = a · 아래 = b
    const top = mineSide === 'a' ? 'b' : 'a', bottom = top === 'a' ? 'b' : 'a';
    const teamOf = (side) => (side === 'a' ? A : B);
    const s = stateOf(m, t0);
    $('sgMatchTitle').textContent = s.time ? `${roundName(n, m.round)} · ${s.time}` : roundName(n, m.round);
    $('sgMatchSub').textContent = result ? '' : s.text;
    // 결과 뒤 카드: 결과 전 상태(pre)에 결과 몫을 겹쳐 그린다 — 쉬며 되찾은 체력 · 나은 경상은 대진표 카드에
    const membersAt = (side) => (result?.pre ? result.pre[side] : t.teams[teamOf(side)].members);
    const row = (side, el, labelEl) => {
      const team = teamOf(side), mine = team === 0, entrants = result?.entrants?.[side] ?? [];
      labelEl.textContent = mine ? T.myTeam : `${mineSide ? `${T.foeTeam} · ` : ''}${tName(team)}`;
      $(el).innerHTML = membersAt(side).map((f) => card(f, { mine, pick: playable && mine, picked: open.picks.includes(f.key), entrant: entrants.includes(f.key), result })).join('');
    };
    row(top, 'sgCardsA', $('sgRowA'));
    row(bottom, 'sgCardsB', $('sgRowB'));
    $('sgFight').hidden = !playable;
    $('sgFight').disabled = !(open.picks.length >= 1 && open.picks.length <= SAENGSA.entrantsMax) || busy;
    $('sgDone').hidden = !open.result;
    $('sgHint').textContent = playable ? `${T.pickHint} ${T.foeHidden}` : '';
    $('sgHint').hidden = !playable;
    const out = $('sgOutcome');
    out.hidden = !result;
    if (result) {
      const W = winnerOf(t, m) ?? (result.winner === 'a' ? A : B);
      if (mineSide) {
        const won = W === 0;
        $('sgOutBig').textContent = won ? T.win : T.loss;
        $('sgOutLine').textContent = myResultLine(won, result.by === 'forfeit' && !won);
        out.dataset.won = String(won);
      } else {
        $('sgOutBig').textContent = '';
        $('sgOutLine').textContent = resultLine(tName(W), tName(W === A ? B : A), result, deathsIn({ result }));
        delete out.dataset.won;
      }
    }
  }
  on($('sgMatch'), 'click', (e) => {
    const c = e.target.closest('button.sg-card');
    if (!c || c.disabled || !open || open.result) return;
    const k = c.dataset.key, i = open.picks.indexOf(k);
    if (i >= 0) open.picks.splice(i, 1);
    else { open.picks.push(k); if (open.picks.length > SAENGSA.entrantsMax) open.picks.shift(); } // 셋째를 누르면 먼저 고른 사람을 뺀다
    renderMatch();
    root.querySelector(`button.sg-card[data-key="${k}"]`)?.focus({ preventScroll: true });
  });
  on($('sgFight'), 'click', async () => {
    if (!open || busy) return;
    const t0 = now(), m = matchById(t, open.id), setup = matchSetup(t, m, open.picks, t0);
    if (!setup) { status(T.notReady); render(); return; }
    busy = true;
    try {
      let res = null;
      if (engine.real) { res = await engine.play(setup); if (!res) return; } // 2단계: 실제 싸움 (그만두고 나오면 결과 없음)
      const result = playMine(open.id, open.picks, now(), res);
      if (!result) { status(T.saveFail); return; }
      render();
      open.result = result;
      renderMatch();
      $('sgDone').focus({ preventScroll: true });
    } finally { busy = false; if (open) renderMatch(); }
  });
  on($('sgDone'), 'click', closeMatch);
  on($('sgMatchBack'), 'click', closeMatch);
  on(root, 'keydown', (e) => { if (e.key === 'Escape' && open) { e.preventDefault(); closeMatch(); } });
  on($('sgBack'), 'click', () => onBack?.());

  render({ scroll: true });
  makeNamelessFaces().then((ok) => { if (!ok) return; render(); if (open) renderMatch(); }); // 무명 검객 얼굴(옷 색마다)을 칠한 뒤 다시 그림
  $('sgHeading').focus({ preventScroll: true });
  const timer = setInterval(() => render(), 30e3);
  return {
    refresh: () => render(),
    destroy() { clearInterval(timer); events.abort(); grove.dispose(); },
    openMatch, // 사진 도구 · 시험: page.openMatch('r0m3')
  };
}
