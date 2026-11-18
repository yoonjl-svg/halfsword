// ─────────────────────────────────────────────────────────────
//  스택 칸 (사장님 11/18 '기세나 사냥 등의 스택이 캐릭터 머리 위에 뜨는데 위치도 이상하고 에러도 있어. 보기에도 좋지 않아.
//   스택을 표시하는 위치를 따로 만들고 머리 위에선 빼버려. 좌측 중상단이나 좌측 중단에 작게?')
//  왼쪽 가운데(#stackHud — index.html: 왼쪽 안전 여백 · 화면 높이 38 % 자리) 작은 판 하나 — 스택이 하나라도 쌓인(> 0) 산 몸마다 한 줄 · 나 먼저:
//   짧은 이름(f.shortName — 동시 대전 main.js teamShort · 1:1 newRound — short_names.js) + 스택 갈래마다 작은 이름표 · 칸(찬 칸 = 스택 수 · 칸 수 = 그 스택 상한).
//   글 꼴 = 기술 칸 둘째 줄(.slot small — 작게 · 보통 굵기 · 보조 색 · 외곽선). 1:1 · 동시 대전 같은 판.
//  스택 갈래 (게임 속 이름 그대로 — 스킬 화면 효과 글):
//   기세 = 일본 J10 기다림과 침 스택 (school_passive.js stackShow — 스택 판인 몸만 · 상한 JP_TANK.max 10) · 찬 칸 강조 색(금빛)
//   사냥 = 동방 C12 맹호은림 사냥 겹 (cn_hunt.js huntN — 겹이 쌓인 몸 = 맞은 몸 · 상한 UNIQUE_ASSIST.cnHunt.max 5) · 찬 칸 상태 색(옅은 붉은색)
//  전에는 머리 위(stamina_hud.js 기력 막대 밑 금빛 칸 · cn_hunt_hud.js 막대 위 발톱 자국)였다 — 11/18 걷음(까닭 · 오류는 docs/strike/saengsa_ui_2026-11-18.md §3).
//  규칙(stackRows)은 그림 없이 셈만 (Node 시험 tools/sim/stack_hud.test.mjs) · 판(createStackHud)은 바뀐 때만 DOM 을 고친다.
// ─────────────────────────────────────────────────────────────
import { JP_TANK, UNIQUE_ASSIST as UA } from './config.js';
import { huntN } from './cn_hunt.js';

/** 스택 갈래 (차례 = 줄 안 차례) — read(f) → 지금 수(없거나 그 판이 아니면 0) */
export const STACK_KINDS = Object.freeze([
  Object.freeze({ key: 'ki', label: '기세', max: () => JP_TANK.max, read: (f) => f.schoolPassive?.stackShow ?? 0 }),
  Object.freeze({ key: 'hunt', label: '사냥', max: () => UA.cnHunt?.max ?? 5, read: (f) => huntN(f) }),
]);

/** 줄 이름 (짧은 이름 · 없으면 나 = '나' · 그 밖 이름의 첫 낱말) */
export const rowName = (f, me) => f.shortName ?? (f === me ? '나' : String(f.name ?? '').split(/\s+/)[0]);

/**
 * 지금 그릴 줄: [{ f, name, stacks: [{ key, label, n, max }] }] — 산 몸 가운데 스택이 하나라도 > 0 인 몸만 · 갈래도 > 0 인 것만 ·
 *  차례 = 나(me — 사람 몸 · 지켜보기면 null) → 내 편(team 0 · 1:1 은 편 칸이 없어 모두 0 편) → 상대 · 같은 편 안에서는 자리 차례(index)
 */
export function stackRows(fighters, me = null) {
  const rows = [];
  for (const f of fighters ?? []) {
    if (!f?.alive || f.revival) continue;
    const stacks = [];
    for (const K of STACK_KINDS) {
      const max = K.max();
      const n = Math.max(0, Math.min(max, Math.round(K.read(f) || 0)));
      if (n > 0) stacks.push({ key: K.key, label: K.label, n, max });
    }
    if (stacks.length) rows.push({ f, name: rowName(f, me), stacks });
  }
  const rank = (f) => (f === me ? 0 : (f.team ?? 0) === (me?.team ?? 0) ? 1 : 2);
  return rows.sort((a, b) => rank(a.f) - rank(b.f) || (a.f.index ?? 0) - (b.f.index ?? 0));
}

/** 줄 묶음 → 같은지 가르는 열쇠 (바뀐 때만 DOM 을 고친다) */
const keyOf = (rows) => rows.map((r) => `${r.name}:${r.stacks.map((s) => `${s.key}${s.n}/${s.max}`).join(',')}`).join('|');

/** 판 (main.js 가 처음에 한 번 · root = #stackHud) — update(fighters, me, visible) 를 프레임마다 */
export function createStackHud(root) {
  let last = null;
  return {
    update(fighters, me, visible) {
      const rows = visible ? stackRows(fighters, me) : [];
      const key = keyOf(rows);
      if (key === last) return;
      last = key;
      root.hidden = !rows.length;
      const kinds = STACK_KINDS.filter((K) => rows.some((r) => r.stacks.some((s) => s.key === K.key))); // 판에 있는 갈래 — 줄마다 같은 자리에(없는 갈래는 빈 자리 · 세로로 맞춤)
      root.style.gridTemplateColumns = `repeat(${1 + kinds.length}, max-content)`; // 이름 칸 = 가장 긴 이름 · 갈래마다 한 칸 (index.html #stackHud 격자 · 줄은 display: contents)
      root.replaceChildren(
        ...rows.map((r) => {
          const row = document.createElement('div');
          row.className = 'sk-row';
          const n = document.createElement('span');
          n.className = 'sk-n';
          n.textContent = r.name;
          row.append(n);
          for (const K of kinds) {
            const s = r.stacks.find((x) => x.key === K.key) ?? { key: K.key, label: K.label, n: 0, max: K.max(), empty: true };
            const g = document.createElement('span');
            g.className = 'sk-s';
            g.dataset.kind = s.key;
            if (s.empty) { g.dataset.empty = ''; g.setAttribute('aria-hidden', 'true'); }
            else {
              g.setAttribute('role', 'meter');
              g.setAttribute('aria-label', `${r.name} ${s.label}`);
              g.setAttribute('aria-valuemin', '0');
              g.setAttribute('aria-valuemax', String(s.max));
              g.setAttribute('aria-valuenow', String(s.n));
            }
            const l = document.createElement('span');
            l.className = 'sk-l';
            l.textContent = s.label;
            const cells = document.createElement('span');
            cells.className = 'sk-c';
            cells.setAttribute('aria-hidden', 'true');
            for (let i = 0; i < s.max; i++) {
              const c = document.createElement('i');
              if (i < s.n) c.dataset.on = '';
              cells.append(c);
            }
            if (s.n >= s.max) cells.dataset.full = '';
            g.append(l, cells);
            row.append(g);
          }
          return row;
        }),
      );
    },
  };
}
