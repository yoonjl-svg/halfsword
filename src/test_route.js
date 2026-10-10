// 테스트 전용 경로 (사장님 10/10 16:5x: "무기와 캐릭터 고르도록 해. 상대와 스테이지는 랜덤") — docs/test_route_2026-10-10.md
//  고르는 화면은 test.html(src/test_pick.js), 그 화면이 여는 주소: index.html?test=1&weapon=<id>&hero=<id|player>&foe=random&stage=random
//  여기서는 index.html(main.js) 쪽 주소 인자만 읽는다. 인자가 없으면 아무것도 바꾸지 않는다(본판 그대로):
//   hero=<인물 id>  : 플레이어 겉모습(look) · 플레이어 이름을 그 인물로. 유파·비기·패시브는 지금 규칙대로 무기를 따르고,
//                     인물의 AI 성격·부활·붉은 안광 같은 고유 능력은 주지 않는다. 투구·판금은 겉모습에 딸려 있어 함께 온다(fighter.js look.helmet·armor)
//   stage=random    : 판을 열 때 무대를 STAGE_ORDER 안에서 무작위로 (같은 무대 연속 없음, 어두운 홀은 순서표에 없으니 안 나온다). 첫 판(메뉴 뒤)도 무작위
//   test=1          : ① 상대는 자기 무기(weapon= 가 상대에게 번지지 않게) ② 이기든 지든 다음 판으로(무대·상대 새로) ③ 메뉴에 '테스트 고르기로' 단추
//                     ④ 무기 카드 뽑기는 weapon= 가 이미 건너뛴다(main.js startFight FIXED_WEAPON)
//                     foe=random 이면 상대 후보에서 고른 인물은 뺀다(같은 겉모습 둘이 서지 않게)
import { CHARACTERS, CHARACTERS_BY_ID, pickCharacterWeapon } from './characters.js';
import { STAGE_ORDER } from './stages.js';

export const TEST_PICK_URL = './test.html';

export function createTestRoute(params) {
  const active = params.get('test') === '1';
  const heroId = params.get('hero');
  const hero = heroId && heroId !== 'player' ? CHARACTERS_BY_ID[heroId] || null : null;
  const stageRandom = params.get('stage') === 'random';
  return {
    active,
    hero,
    stageRandom,
    /** 플레이어 Fighter 옵션에 덮을 몫 (고른 인물이 없으면 빈 객체 — 지금 그대로) */
    player: hero ? { name: hero.name, look: hero.look } : {},
    /** 다음 판을 열 때 무대를 넘길지: test=1 이면 이기든 지든 넘긴다 */
    advance(won) {
      return won || active;
    },
    /** 다음 무대 id (stage=random 이 아니면 null — 부르는 쪽의 순서표를 쓴다) */
    nextStage(prev) {
      if (!stageRandom) return null;
      const pool = STAGE_ORDER.filter((id) => id !== prev);
      return pool[Math.floor(Math.random() * pool.length)];
    },
    /** test=1 · foe=random: 무작위 상대 (지난 상대·고른 인물 빼고). 그 밖엔 null — 부르는 쪽 규칙 그대로 */
    pickFoe(prevId, foeRandom) {
      if (!active || !foeRandom) return null;
      const pool = CHARACTERS.filter((c) => c.id !== prevId && c.id !== hero?.id);
      return pool[Math.floor(Math.random() * pool.length)] || null;
    },
    /** test=1: 상대는 자기 무기 (null 이면 부르는 쪽 규칙) */
    foeWeapon(foe) {
      return active && foe ? pickCharacterWeapon(foe) : null;
    },
    /** 판 끝 결과 메뉴의 시작 단추 글 (test=1 은 늘 새 판) */
    resultLabel(btn) {
      if (active && btn) btn.textContent = '다음 판 (무작위)';
    },
    /** 메뉴(시작·일시정지·결과가 함께 쓰는 #menu .actions)에 '테스트 고르기로' 단추, 제목 아래에 테스트 경로 한 줄을 한 번 붙인다 */
    mount(doc, weaponName) {
      if (!active) return;
      const actions = doc.querySelector('#menu .actions');
      if (!actions || doc.getElementById('btnTestPick')) return;
      const btn = doc.createElement('button');
      btn.id = 'btnTestPick';
      btn.className = 'secondary';
      btn.type = 'button';
      btn.textContent = '테스트 고르기로';
      btn.addEventListener('click', () => {
        location.href = TEST_PICK_URL;
      });
      const note = doc.createElement('p');
      note.id = 'testRouteNote';
      note.style.cssText = 'margin:-8px 0 12px;font-size:12px;color:var(--accent);line-height:1.4';
      note.textContent = `테스트 경로 · ${weaponName} · ${hero ? hero.name : '기본 주인공'} · 상대·무대 무작위`;
      actions.append(btn);
      doc.getElementById('menuSub')?.after(note); // 제목 아래 한 줄 (아래 단추 줄을 두껍게 하지 않게)
    },
  };
}
