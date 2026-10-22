// ─────────────────────────────────────────────────────────────
//  칠 때 알림 (10/21 — 사장님: 오른쪽 위 자세 칸 글은 사람이 못 알아챈다. 눈은 가운데 싸움에 가 있으니
//   치명타의 붉은 화면 테두리처럼, 또는 MMORPG 퀘스트 NPC 머리 위의 작은 반투명 느낌표처럼 알려 달라)
//  플레이어에게 짧은 '지금 쳐' 창(약 0.6 s)이 열린 동안 눈이 가 있는 곳 — 상대 머리 위 — 에 '!' 를 띄운다.
//  자세 칸 글(main.js updateGuardName)은 그대로 두고 덧붙인다. 플레이어 창만 — AI 창에는 안 뜬다.
//   창 ① 이어 긋기: unique_assist.js ready (앞 긋기가 끝나고 afterWindow 0.6 s · 잇는 동작 뒷몫은 chainWait 0.15 s)
//      ② 비기 입력: secret.js PlayerSecretWatch.open { S, ctx, t } — t 가 줄어든다. 금빛
//      ③ 인데스(독일 패시브 — 다른 가지에서 들어옴): player.indesOpen === true · player.indesLeft(초 또는 null). 없으면 그냥 안 뜬다
//   여럿이 겹치면 비기 → 이어 긋기 → 인데스 차례로 하나만.
//  꼴: `?strikeCue=mark`(기본 — 머리 위 느낌표) · `edge`(화면 가장자리 옅은 금빛 — screen_tint.js 따로 칸) · `both` · `0`(끔). test.html '칠 때 알림'
//  남은 시간: 열린 때 불투명 0.7 → 닫힐 즈음 0.3 (남은 몫만큼 — 남은 시간을 모르면 열린 뒤 0.6 s 에 걸쳐). 0.08 s 에 커지며 나타나고
//   창이 닫히면 0.1 s 에 사라진다. 위아래 흔들림 없음. 늘 맨 위에 그린다(깊이 시험 없음 — 상대 몸 · 칼이 가리지 않게).
//  싸움 화면 밖 · 판 끝 · 상대가 죽었거나 화면 밖이면 그리지 않는다. 그림 하나(스프라이트)를 다시 쓰고 프레임마다 새로 만드는 것이 없다.
//  docs/ui/hud_type_system_2026-10-10.md §18 · docs/strike/owner_defaults_table.md 2133
// ─────────────────────────────────────────────────────────────
import { Sprite, SpriteMaterial, CanvasTexture, Color, Vector3, SRGBColorSpace } from 'three';
import { UNIQUE_ASSIST as UA } from './config.js';

export const STRIKE_CUE = {
  style: 'mark', // 기본 꼴 (`?strikeCue=` 가 없을 때)
  worldH: 0.12, // 느낌표 높이(m) — 머리(공 지름 0.2 m)의 반쯤
  minPx: 22, // 화면 높이 아래 한도(CSS px) — 상대가 멀어도 읽히게 (18 은 폰 크기 그림에서 잘 안 보였다 — docs/ui/strike_cue_2026-10-21/)
  maxPx: 36, // 위 한도 — 가까워도 너무 크지 않게
  lift: 0.28, // 머리 가운데 위 이만큼(m) = 기력 막대 자리(stamina_hud.js) — 느낌표는 그 위에 선다
  gapPx: 6, // 기력 막대(높이 2 px) 위 틈(CSS px)
  alphaOpen: 0.7, // 창이 막 열렸을 때 불투명
  alphaEnd: 0.3, // 창이 닫힐 즈음 불투명 (남은 몫만큼 그 사이)
  pop: 0.08, // 나타나는 시간(s) — 0.5 배 크기에서 커진다
  fade: 0.1, // 창이 닫힌 뒤 사라지는 시간(s)
  guess: 0.6, // 남은 시간을 모르는 창은 열린 뒤 이만큼(s)에 걸쳐 흐려진다
  edge: 1, // 테두리 세기 (screen_tint.js cue 칸 — 값 1 이어도 피 테두리보다 옅다)
  edgeEnd: 0.45, // 닫힐 즈음 테두리 세기 몫
  plain: 0xfff0d2, // 보통 창 — 따뜻한 흰빛
  anchor: 'self', // 느낌표 자리 — 사장님 10/23 00:2x '상대 머리가 아니라 내 머리에 뜨는 게 자연스러움' ('self' 내 머리 · 'foe' 전 상대 머리 — `?cueAnchor=foe`)
  secretEdge: 1, // 비기 창 금색 화면 테두리 — 사장님 10/23 '체력이 많이 줄었을 때 붉은 테두리와 동일하게, 색만 금색 · 겹치면 금색 우선' (screen_tint.js secret 칸 · `?secretEdge=0` 끔)
  gold: 0xffc23a, // 비기 창 — 금빛
};

/** 주소 값 → 꼴 'mark' | 'edge' | 'both' | 'off' (모르는 값이면 기본) */
export function cueStyle(v) {
  if (v == null || v === '') return STRIKE_CUE.style;
  if (v === '0' || v === 'off') return 'off';
  return v === 'mark' || v === 'edge' || v === 'both' ? v : STRIKE_CUE.style;
}

/**
 * 지금 열린 플레이어 창 하나 (읽기만 — 시험 tools/sim/strike_cue.test.mjs 도 부른다). out 에 적어 돌려준다:
 *  kind 'secret' | 'chain' | 'indes' | null · gold(비기) · token(같은 창인지 가르는 것) · left(남은 초, 모르면 null · 끝이 없으면 Infinity) · total(창 길이, 모르면 null)
 */
export function readCueWindow(player, unique, secret, out = {}) {
  out.kind = null;
  out.gold = false;
  out.token = null;
  out.left = null;
  out.total = null;
  if (!player?.alive) return out;
  const o = secret?.open;
  if (o) {
    out.kind = 'secret';
    out.gold = true;
    out.token = o; // 창마다 새 객체 (secret.js openWindow)
    out.left = Number.isFinite(o.t) ? Math.max(0, o.t) : Infinity; // 독일 막기 연환은 칼이 붙어 있는 동안 열림(Infinity)
    return out;
  }
  if (unique?.ready) {
    // unique_assist.js readyChain 과 같은 차례: 잇는 동작 뒷몫(chainFrom · chainWait)이 먼저, 아니면 앞 긋기 끝(last.tEnd)에서 afterWindow
    out.kind = 'chain';
    const C = unique.chainFrom, L = unique.last, t = unique.t;
    if (C && t - C.tEnd <= UA.chainWait) {
      out.token = C;
      out.total = UA.chainWait;
      out.left = Math.max(0, UA.chainWait - (t - C.tEnd));
    } else if (L && L.tEnd != null) {
      out.token = L; // 앞 긋기 기록 — 새 긋기가 끝나면 바뀐다
      out.total = UA.afterWindow;
      out.left = Math.max(0, UA.afterWindow - (t - L.tEnd));
    } else out.token = unique.ready.name ?? 'chain';
    return out;
  }
  if (player.indesOpen === true) {
    out.kind = 'indes';
    out.token = 'indes';
    const l = player.indesLeft;
    out.left = typeof l === 'number' && Number.isFinite(l) ? Math.max(0, l) : null;
    return out;
  }
  return out;
}

/** 느낌표 그림 (64 × 128 캔버스): 굵은 흰 글자 + 두꺼운 짙은 테 · 그림자 — 흐린 하늘에도 어두운 벽에도 보이게(작게 줄여 그려도 테가 남게 굵게).
 *  색은 재질 색이 곱한다(테는 짙은 채) */
function markTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const path = () => {
    g.beginPath();
    g.moveTo(16, 24);
    g.arc(32, 24, 16, Math.PI, 0); // 위 둥근 머리 (넓게)
    g.lineTo(41, 72);
    g.arc(32, 72, 9, 0, Math.PI); // 아래로 가늘어진 끝
    g.closePath();
    g.moveTo(45, 105);
    g.arc(32, 105, 13, 0, Math.PI * 2); // 점
  };
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(20, 14, 10, 0.55)';
  g.shadowBlur = 8;
  path();
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(27, 20, 16, 0.9)';
  g.stroke();
  g.shadowBlur = 0;
  path();
  g.fillStyle = '#ffffff';
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/**
 * 칠 때 알림 하나 (main.js 가 처음에 한 번 만든다). scene: 느낌표를 붙일 장면 · tint: screen_tint.js · param: 주소 `?strikeCue=` 값
 *  update(dt, camera, live, player, foe, unique, secret) — 매 프레임 그리기 전 (카메라 자리가 정해진 뒤). live = 싸움 화면이고 판이 안 끝났나
 */
export function createStrikeCue(scene, tint, param, opts = {}) {
  const C = STRIKE_CUE;
  const style = cueStyle(param);
  const anchor = opts.anchor === 'foe' || opts.anchor === 'self' ? opts.anchor : C.anchor; // 느낌표 자리 (10/23)
  const secretEdge = opts.secretEdge == null || opts.secretEdge === '' ? !!C.secretEdge : !['0', 'off', 'false'].includes(String(opts.secretEdge)); // 비기 금색 테두리 (10/23)
  const useMark = style === 'mark' || style === 'both';
  const useEdge = style === 'edge' || style === 'both';
  const win = {};
  const S = { open: false, kind: null, token: null, gold: false, age: 0, out: 1, total: 0, frac: 0, env: 0, alpha: 0, px: 0, shown: false, edge: 0 };
  const P = new Vector3(), Q = new Vector3();
  const plain = new Color(C.plain), gold = new Color(C.gold);
  let sprite = null, mat = null;
  if (useMark && scene) {
    mat = new SpriteMaterial({ map: markTexture(), color: plain, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
    sprite = new Sprite(mat);
    sprite.name = 'strikeCue';
    sprite.center.set(0.5, 0); // 아래 끝이 기준점 (기력 막대 위)
    sprite.renderOrder = 999; // 투명한 것 가운데 맨 나중
    sprite.frustumCulled = false; // 화면 밖은 아래에서 직접 거른다
    sprite.visible = false;
    scene.add(sprite); // 장면 짓기(stages.js · main.js newRound)보다 먼저 붙어 무대 · 검객 물건으로 세지 않는다. 숨겨도 stages.warm 의 compile 이 셰이더를 미리 만든다
  }

  /** 느낌표를 머리 위에 (who = 내 몸 · 상대 몸 — anchor · 그릴 수 없으면 false) */
  function place(camera, who, viewH) {
    if (!who?.alive || who.decapitated || who.revival) return false;
    const head = who.cache?.parts?.head?.p; // 지난 물리 스텝의 머리 자리 (fighter.js cacheState — 새 객체를 만들지 않는다)
    if (!head || !camera) return false;
    P.set(head.x, head.y + C.lift, head.z);
    Q.copy(P).applyMatrix4(camera.matrixWorldInverse);
    const depth = -Q.z;
    if (depth < 0.2) return false; // 카메라 뒤 · 너무 가까움
    const pxPerM = viewH / (2 * depth * Math.tan((camera.fov * Math.PI) / 360));
    const h = Math.min(Math.max(C.worldH, C.minPx / pxPerM), C.maxPx / pxPerM);
    P.y += C.gapPx / pxPerM;
    Q.copy(P).project(camera);
    if (Q.x < -0.98 || Q.x > 0.98 || Q.y < -1 || Q.y > 0.98) return false; // 화면 밖 (아래 끝이 위 가장자리 넘음 포함) — 그리지 않는다
    const k = 0.5 + 0.5 * (1 - (1 - Math.min(1, S.age / C.pop)) ** 3); // 나타날 때 0.5 → 1 (흔들림 없음 — 닫힐 땐 크기 그대로)
    sprite.position.copy(P);
    sprite.scale.set(h * 0.5 * k, h * k, 1);
    S.px = h * pxPerM * k;
    return true;
  }

  return {
    style,
    get sprite() {
      return sprite;
    },
    update(dt, camera, live, player, foe, unique, secret, viewH = globalThis.innerHeight || 390) {
      if (style === 'off') return;
      const w = readCueWindow(live ? player : null, unique, secret, win);
      if (w.kind) {
        if (!S.open || w.kind !== S.kind || w.token !== S.token) {
          // 새 창: 다시 나타난다
          S.kind = w.kind;
          S.token = w.token;
          S.gold = w.gold;
          S.age = 0;
          S.total = w.total ?? (Number.isFinite(w.left) ? w.left : 0);
        }
        S.open = true;
        S.out = 0;
        S.age += dt;
        if (w.total == null && Number.isFinite(w.left) && w.left > S.total) S.total = w.left; // 길이를 모르는 창은 처음 본 남은 시간
        const total = w.total ?? S.total;
        S.frac = w.left == null ? 1 - Math.min(1, S.age / C.guess) : !Number.isFinite(w.left) ? 1 : total > 0 ? Math.min(1, w.left / total) : 0;
      } else {
        S.open = false;
        S.out += dt;
      }
      S.env = !live ? 0 : S.open ? Math.min(1, S.age / C.pop) : Math.max(0, 1 - S.out / C.fade); // 싸움 밖이면 바로 숨김
      S.alpha = (C.alphaEnd + (C.alphaOpen - C.alphaEnd) * S.frac) * S.env;
      if (sprite) {
        S.shown = S.env > 0.001 && place(camera, anchor === 'self' ? player : foe, viewH); // 10/23 내 머리 위 (전 상대 머리)
        sprite.visible = S.shown;
        if (S.shown) {
          mat.opacity = S.alpha;
          mat.color.copy(S.gold ? gold : plain);
        }
      }
      if (tint?.setSecretEdge) tint.setSecretEdge(secretEdge && S.gold ? (C.edgeEnd + (1 - C.edgeEnd) * S.frac) * S.env : 0); // 비기 창 금색 테두리 (피 테두리 꼴 · 금빛 — 10/23)
      if (useEdge && tint?.setCue) {
        S.edge = C.edge * (C.edgeEnd + (1 - C.edgeEnd) * S.frac) * S.env;
        tint.setCue(S.edge, S.gold);
      }
    },
    /** 탐침 · 스크린샷용 (tools/browser/strike_cue_shots.mjs) */
    get state() {
      return { style, anchor, secretEdge, open: S.open, kind: S.kind, gold: S.gold, frac: +S.frac.toFixed(3), alpha: +S.alpha.toFixed(3), shown: S.shown, px: +S.px.toFixed(1), edge: +S.edge.toFixed(3) };
    },
  };
}
