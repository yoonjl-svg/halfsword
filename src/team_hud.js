// ─────────────────────────────────────────────────────────────
//  동시 대전 화면 — 4단계 최소 (10/29 · docs/strike/team_fight_2026-10-29.md §11)
//   체력: 11/18 사장님 '생사전에서 좌측 상단에 캐릭터 체력바가 뜨는데 그거 없애고 기력바랑 같이 뜨게 해' — 왼쪽 위 이름 · 체력 목록(#teamList — 10/29 22:3x · 10/30 01:0x)을 걷고
//    머리 위 기력 막대 바로 위 체력 칸(stamina_hud.js · 규칙 hp_strip.js)으로. 이 파일은 화살표 · 편 표시 · 카메라 물러남만.
//   화면 밖 화살표: 살아 있는 싸움꾼이 화면 밖(또는 카메라 뒤)이면 화면 가장자리에 그쪽을 가리키는 작은 화살표 (편 색)
//   편 표시: 화면 안의 산 상대(1 편) 머리 위에 같은 화살표를 작게 붉게 아래로 — 무명 검객처럼 겉모습이 같아도 편이 보이게 (내 편 금색 세모는 뺌 — 사장님 10/29 20:3x '우리편 머리의 금색 세모는 없어도 돼')
//    자리 (11/18): 기력 막대 자리(머리 위 0.28 m — stamina_hud.js)에서 체력 칸 위로 화면 px 만큼(HEAD_MARK_UP) — 전엔 머리 위 0.5 m 라 멀면 막대 위 칸에 겹쳤다
//   등 뒤 알림 (사장님 11/18 '권고대로' — 무리 싸움 판단 설계 §8-7): 나(사람 몸)를 겨눈 AI 가 등 뒤에서 칠 참이면(team_sense.js backThreat) 그 몸의 화면 밖 화살표가
//    밝은 붉은색 · 조금 크게 깜빡임(TEAM_SENSE.back.blink Hz) — 글 · 소리 없음 · 화면 안이면 없음 · 지켜보기(사람 몸 없음)면 없음
//   카메라 물러남 몫: 보는 몸(focus)에서 TEAM_FIGHT.cam.radius 안의 산 싸움꾼이 모두 들어오게 뒤로 · 위로 (main.js updateCamera 가 부드럽게)
//  1:1 판에서는 만들지도 부르지도 않는다 (main.js — teamRun 이 있을 때만)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TEAM_FIGHT, TEAM_SENSE, CAMERA } from './config.js';
import { backThreat } from './team_sense.js'; // 등 뒤 알림 (11/18 — 무리 싸움 판단 P3)
import { BLOOD_RED } from './blood_palette.js';
import { hexToOklch, oklchToCss } from './oklch.js';
import { hpLift } from './hp_strip.js';

/** 적 색 (사장님 10/30 02:0x '적군 체력바 색과 적군 머리 위 기호 색을 현재 전투에서 쓰고 있는 피 색으로 바꾸자. 저기서 채도만 낮춰서.'):
 *  피 색 BLOOD_RED.splash #8a0000 = OKLCH(0.398 0.163 29°) → 채도만 × TEAM_FIGHT.hudColor.foeChromaK(0.7) = #792820 */
const BLOOD_LCH = hexToOklch(BLOOD_RED.splash);
const FOE_LCH = [BLOOD_LCH[0], BLOOD_LCH[1] * TEAM_FIGHT.hudColor.foeChromaK, BLOOD_LCH[2]];
export const FOE_COLOR = oklchToCss(FOE_LCH);
/** 편 색: 0 편(내 편) 금색(--c-accent 와 같음) · 1 편 = 적 색 — 화면 밖 화살표 · 머리 위 세모 (11/18 아군 녹색 · 체력 막대 색은 체력 칸과 함께 걷음 — 체력 칸 색은 hp_strip.js) */
export const TEAM_COLORS = Object.freeze(['#d9a441', FOE_COLOR]);
/** 머리 위 세모 자리: 기력 막대 자리(머리 위 0.28 m)에서 위로 px = 막대 높이 2 + 체력 칸(hpLift) + 틈 3 + 세모 반 높이(13 × 0.6 ÷ 2 ≈ 4) */
export const HEAD_MARK_UP = () => 2 + hpLift() + 3 + 4;

/**
 * 카메라 물러남 몫 (m): 보는 몸에서 radius 안의 산 싸움꾼이 모두 화면에 들게 — 어깨 너머 카메라(보는 몸 뒤 CAMERA.back · 오른쪽 shoulder · 바라보는 쪽 dir)에서
 *  그 몸의 깊이(카메라 앞 수평 거리)와 옆 거리로: 옆 거리 ≤ 깊이 × 가로 반폭(tan(fov/2) × 화면 비) × fit · 깊이 ≥ minDepth 가 되도록 뒤로 물러날 몫의 가장 큰 값을 0 ~ max 로.
 *  돌려줌 { back, up } — back 만큼 뒤로 · up 만큼 위로 (main.js 가 시간 상수 tau 로 거른다). 카메라 뒤로 간 몸은 max 까지만 (화면 밖 화살표가 가리킴)
 */
export function teamFramePull(focus, fighters, dir, aspect, C = TEAM_FIGHT.cam, cam = CAMERA) {
  const p = focus.pelvisPos;
  const rx = -dir.z;
  const rz = dir.x;
  const tanH = Math.tan((cam.fov * Math.PI) / 360) * aspect * C.fit;
  let need = 0;
  for (const g of fighters) {
    if (g === focus || !g.alive) continue;
    const q = g.bodies.pelvis.translation();
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    if (Math.hypot(dx, dz) > C.radius) continue;
    const depth = dx * dir.x + dz * dir.z + cam.back;
    const lat = dx * rx + dz * rz - cam.shoulder;
    need = Math.max(need, Math.abs(lat) / tanH - depth, C.minDepth - depth);
  }
  const back = Math.min(C.max, Math.max(0, need));
  return { back, up: back * C.upK };
}

export function createTeamHud(doc = document) {
  const root = doc.createElement('div');
  root.id = 'teamHud';
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;display:none;font-family:var(--font-ui, system-ui);';
  const arrows = doc.createElement('div');
  arrows.style.cssText = 'position:absolute;inset:0;';
  root.append(arrows);
  doc.body.appendChild(root);
  let marks = [];
  const _v = new THREE.Vector3();

  /** 판을 열 때: 싸움꾼마다 화살표 하나 (focus 는 화면 밖 화살표 없음 — 늘 화면 안) */
  function show(fighters) {
    arrows.replaceChildren();
    marks = fighters.map((f) => {
      const a = doc.createElement('div');
      a.className = 'th-arrow';
      const color = TEAM_COLORS[f.team] ?? '#888';
      a.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:13px solid ${color};filter:drop-shadow(0 0 2px #000);display:none;`;
      arrows.appendChild(a);
      return { f, a };
    });
    root.style.display = '';
  }

  function hide() {
    root.style.display = 'none';
  }

  /** 프레임마다: 화살표 · 편 표시 (visible 거짓이면 모두 숨김 — 메뉴 · 판 끝). me = 사람 몸 (지켜보기면 null) · now = 등 뒤 알림 깜빡임 시계 */
  function update(camera, focus, visible, me = null, width = window.innerWidth, height = window.innerHeight, now = performance.now()) {
    const m = 22; // 가장자리 여백 (px)
    for (const { f, a } of marks) {
      if (!visible || !f.alive || (f === focus && f === me)) {
        a.style.display = 'none';
        continue;
      }
      _v.copy(f.bodies.chest.translation()).project(camera);
      const behind = _v.z > 1;
      let x = behind ? -_v.x : _v.x;
      let y = behind ? -_v.y : _v.y;
      if (!behind && Math.abs(x) <= 1 && Math.abs(y) <= 1) {
        // 화면 안: 상대(1 편)만 머리 위(기력 막대 · 체력 칸 위)에 작게 아래로 — 내 편은 없음 · 11/18 막대 자리(머리 위 0.28 m)에서 화면 px 로 위 (HEAD_MARK_UP — 멀어도 칸에 안 겹침)
        const h = f.bodies.head.translation();
        _v.set(h.x, h.y + 0.28, h.z).project(camera);
        const hy = ((1 - _v.y) / 2) * height - HEAD_MARK_UP();
        if (f.team === 0 || f === me || _v.z > 1 || Math.abs(_v.x) > 1 || Math.abs(_v.y) > 1 || hy < 0) {
          a.style.display = 'none';
          continue;
        }
        a.style.display = '';
        a.dataset.kind = 'head';
        if (a.dataset.warn) (a.dataset.warn = ''), (a.style.borderBottomColor = TEAM_COLORS[f.team] ?? '#888'); // 등 뒤 알림이 걷힘 (화면 안)
        a.style.opacity = '0.85';
        a.style.transform = `translate(${(((_v.x + 1) / 2) * width - 7).toFixed(1)}px, ${(hy - 6.5).toFixed(1)}px) rotate(${Math.PI.toFixed(3)}rad) scale(0.6)`;
        continue;
      }
      if (f === focus) {
        a.style.display = 'none';
        continue;
      }
      a.style.opacity = '1';
      a.dataset.kind = 'edge';
      // 등 뒤 알림 (11/18): 나를 등 뒤에서 칠 참인 AI — 화살표가 밝은 붉은색 · 1.3 배로 깜빡 (꺼진 박자는 제 편 색)
      const warn = !!me && backThreat(me, f);
      const on = warn && Math.floor((now / 1000) * TEAM_SENSE.back.blink * 2) % 2 === 0;
      a.dataset.warn = warn ? '1' : '';
      a.style.borderBottomColor = on ? TEAM_SENSE.back.color : TEAM_COLORS[f.team] ?? '#888';
      // 화면 가운데 → 그 몸 방향의 선이 가장자리(여백 안)와 만나는 곳
      const s = 1 / Math.max(Math.abs(x) / (1 - (2 * m) / width), Math.abs(y) / (1 - (2 * m) / height), 1e-6);
      x *= s;
      y *= s;
      const px = ((x + 1) / 2) * width;
      const py = ((1 - y) / 2) * height;
      const ang = Math.atan2(x * width, y * height); // 위(+y)가 0 · 시계 방향
      a.style.display = '';
      a.style.transform = `translate(${(px - 7).toFixed(1)}px, ${(py - 6.5).toFixed(1)}px) rotate(${ang.toFixed(3)}rad)${warn ? ' scale(1.3)' : ''}`;
    }
  }

  return { show, hide, update, root };
}
