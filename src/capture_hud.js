// ─────────────────────────────────────────────────────────────
//  거점전 화면 (사장님 11/21 거점전 — 설계 docs/design/saengsa_3v3_2026-11-21.md §3-5 '휴대폰 화면' · 기록 docs/strike/capture_mode_2026-11-21.md)
//   작고 조용하게 (사장님 '줄마다 큰 머리 글 두지마. 보기 싫어.'): 위 가운데 일시정지 단추 양옆 작은 동그라미 둘 = 두 거점(쥔 편 색 · 빔은 흐린 테두리 · 쥐는 중이면 바깥 고리가 그 편 색으로 참)
//    + 한 편이 두 거점을 다 쥐면 단추 밑에 남은 초(그 편 색 · 상대가 원 안에 서 있어 멈추면 흐리게). 글 머리 · 띠 없음
//   땅: 거점 원마다 얇은 고리(쥔 편 색 · 빔은 흐린 흰색) + 쥐는 중이면 그 편 색 호가 차오름
//  읽는 것 = capture.js 상태뿐 (규칙은 그쪽). 거점전 판에서만 만들어 부름 (main.js — teamRun.M.capture 가 있을 때)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { TEAM_COLORS } from './team_hud.js';

const EMPTY = 'rgba(236, 230, 214, 0.55)';
/** 결과 줄 (쥐기로 끝난 판 — 결과 글은 '~다' 체 · docs/text/editing_guide.md §2) */
export const captureLine = (won) => (won ? '거점 둘을 쥐었다' : '거점 둘을 빼앗겼다');
const SEG = 48; // 땅 고리 조각 수

/** 동그라미 하나 (SVG 18 px): 바깥 고리(쥐는 중 몫) · 안 점(주인) */
function marker(doc) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const base = doc.createElementNS(NS, 'circle');
  base.setAttribute('cx', '10'); base.setAttribute('cy', '10'); base.setAttribute('r', '8');
  base.setAttribute('fill', 'none'); base.setAttribute('stroke', 'rgba(0,0,0,0.35)'); base.setAttribute('stroke-width', '2.2');
  const ring = doc.createElementNS(NS, 'circle');
  ring.setAttribute('cx', '10'); ring.setAttribute('cy', '10'); ring.setAttribute('r', '8');
  ring.setAttribute('fill', 'none'); ring.setAttribute('stroke-width', '2.2'); ring.setAttribute('transform', 'rotate(-90 10 10)');
  const len = 2 * Math.PI * 8;
  ring.setAttribute('stroke-dasharray', `0 ${len}`);
  const dot = doc.createElementNS(NS, 'circle');
  dot.setAttribute('cx', '10'); dot.setAttribute('cy', '10'); dot.setAttribute('r', '5');
  dot.setAttribute('stroke-width', '1.4');
  svg.append(base, ring, dot);
  return { svg, ring, dot, len };
}

export function createCaptureHud(doc = document) {
  const root = doc.createElement('div');
  root.id = 'captureHud';
  root.setAttribute('role', 'img');
  // 자리: 가운데 위 일시정지 단추(index.html #topButtons — 38 px 동그라미 · 위 max(8px, 안전 여백)) 양옆에 동그라미 둘 · 남은 초는 그 단추 바로 밑 (단추를 가리지 않게)
  root.style.cssText = 'position:fixed;top:max(8px, env(safe-area-inset-top, 0px));left:50%;width:0;height:38px;display:none;pointer-events:none;z-index:2;' +
    'font:600 12px/1 var(--font-ui, system-ui);font-variant-numeric:tabular-nums;text-shadow:0 1px 2px rgba(0,0,0,0.7);';
  const m0 = marker(doc), m1 = marker(doc);
  m0.svg.style.cssText = 'position:absolute;left:-46px;top:10px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));';
  m1.svg.style.cssText = 'position:absolute;left:28px;top:10px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));';
  const clock = doc.createElement('span');
  clock.style.cssText = 'position:absolute;left:-20px;width:40px;top:42px;text-align:center;visibility:hidden;';
  root.append(m0.svg, clock, m1.svg);
  doc.body.append(root);
  const marks = [m0, m1];
  let rings = null, scene = null, label = '';

  function groundRings(C) {
    const out = [];
    for (const P of C.points) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ece6d6', transparent: true, opacity: 0.22, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(P.r - 0.06, P.r, SEG), mat);
      const pmat = new THREE.MeshBasicMaterial({ color: TEAM_COLORS[0], transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
      const arc = new THREE.Mesh(new THREE.RingGeometry(P.r - 0.13, P.r - 0.06, SEG, 1, Math.PI / 2, -Math.PI * 2), pmat);
      for (const m of [ring, arc]) {
        m.rotation.x = -Math.PI / 2;
        m.position.set(P.x, 0.045, P.z);
        m.renderOrder = 1;
        m.castShadow = m.receiveShadow = false;
      }
      arc.geometry.setDrawRange(0, 0);
      out.push({ ring, arc });
    }
    return out;
  }

  /** 거점전 판 시작: C = match.js M.capture · s = 장면 (땅 고리를 넣음) */
  function show(C, s) {
    hide();
    scene = s;
    rings = groundRings(C);
    for (const r of rings) scene.add(r.ring, r.arc);
    root.style.display = 'block';
    update(C);
  }
  function hide() {
    root.style.display = 'none';
    if (rings && scene) for (const r of rings) for (const m of [r.ring, r.arc]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    rings = null;
    scene = null;
    label = '';
  }
  const ownerText = (o) => (o === 0 ? '내 편' : o === 1 ? '상대' : '빔');
  /** 프레임마다 */
  function update(C, visible = true) {
    if (!rings) return;
    root.style.visibility = visible ? 'visible' : 'hidden';
    C.points.forEach((P, i) => {
      const m = marks[i];
      const col = P.owner == null ? null : TEAM_COLORS[P.owner];
      m.dot.setAttribute('fill', col ?? 'rgba(0,0,0,0.25)');
      m.dot.setAttribute('stroke', col ?? EMPTY);
      const k = P.by == null ? 0 : Math.min(1, P.k / C.take);
      m.ring.setAttribute('stroke', P.by == null ? 'none' : TEAM_COLORS[P.by]);
      m.ring.setAttribute('stroke-dasharray', `${(k * m.len).toFixed(2)} ${m.len.toFixed(2)}`);
      const g = rings[i];
      g.ring.material.color.set(col ?? '#ece6d6');
      g.ring.material.opacity = col ? 0.5 : 0.22;
      if (P.by == null) g.arc.geometry.setDrawRange(0, 0);
      else {
        g.arc.material.color.set(TEAM_COLORS[P.by]);
        g.arc.geometry.setDrawRange(0, 6 * Math.round(SEG * k));
      }
    });
    const H = C.holder;
    clock.style.visibility = H == null ? 'hidden' : 'visible';
    if (H != null) {
      clock.textContent = String(Math.ceil(C.clock - 1e-6));
      clock.style.color = TEAM_COLORS[H];
      clock.style.opacity = C.paused ? '0.45' : '1';
    }
    const L = `거점 ${ownerText(C.points[0].owner)} · ${ownerText(C.points[1].owner)}${H != null ? ` · ${ownerText(H)} ${Math.ceil(C.clock - 1e-6)}초` : ''}`;
    if (L !== label) root.setAttribute('aria-label', (label = L));
  }
  return { show, hide, update, root };
}
