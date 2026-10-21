// 티소나 겉모습 — 승인된 상아색 · 검은 쇠 · 금빛 시안을 이베리아 양손 대검으로 각색한 절차적 기하.
// 샛별 저장소 f9aea01a 에서 가져옴 (10/21 — 주석만 한국어로 옮김, 기하는 바이트 그대로). 겉모습만 맡는다:
//  유물 고증 · 부품 질량 · 콜라이더 · 능력('위세')은 weapons.js · stamina.js 가 맡는다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { metalMat, weaponEnv } from './weapon_looks.js';

export const TIZONA_COLORS = { grip: 0xd6ccb3, hilt: 0x393a35, blade: 0xaab0af, gold: 0xb19861, inlay: 0xb78c4f };
const V = p => new THREE.Vector3(...p);
function add(group, geometry, material, p = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...p); mesh.castShadow = true; group.add(mesh); return mesh;
}
function line(group, points, radius, material, segments = 20) {
  return add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)), segments, radius, 4, false), material);
}
function extrude(points, depth) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2); return g;
}
// 작은 쇠 장식마다 그리기 호출을 내지 않고 재질별로 몇 덩이로 합친다.
function compact(group) {
  const bins = new Map(); group.updateMatrixWorld(true);
  group.traverse(m => {
    if (!m.isMesh) return;
    let g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.deleteAttribute('uv');
    if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
    const items = bins.get(m.material) || []; items.push(g); bins.set(m.material, items);
  });
  const result = new THREE.Group();
  for (const [mat, geometries] of bins) { add(result, mergeGeometries(geometries), mat); geometries.forEach(g => g.dispose()); }
  group.traverse(m => { if (m.isMesh) m.geometry.dispose(); });
  return result;
}
function grip(shape) {
  const group = new THREE.Group(), H = shape[2], radius = shape[1];
  const ivory = new THREE.MeshStandardMaterial({ color: TIZONA_COLORS.grip, roughness: .87, flatShading: true });
  const seam = new THREE.MeshStandardMaterial({ color: 0xa69b80, roughness: .95 });
  const gold = metalMat(TIZONA_COLORS.gold, { rough: .43 });
  add(group, new THREE.CylinderGeometry(radius * .92, radius, H * 2, 12), ivory).scale.z = .89;
  const points = [], turns = H * 2 / .027;
  for (let i = 0; i <= 180; i++) {
    const t = i / 180, a = t * Math.PI * 2 * turns, r = radius * (1 - .08 * t) + .0004;
    points.push([Math.cos(a) * r, -H + .005 + t * (H * 2 - .01), Math.sin(a) * r * .89]);
  }
  line(group, points, .00065, seam, 180);
  for (const [y, height] of [[-H + .004, .008], [H - .004, .008], [-H * .12, .007]]) {
    const m = add(group, new THREE.CylinderGeometry(radius + .0005, radius + .0005, height, 12), gold, [0, y, 0]); m.scale.z = .91;
  }
  return compact(group);
}
function pommel(shape) {
  const group = new THREE.Group(), r = shape[1] * .95;
  const iron = metalMat(TIZONA_COLORS.hilt, { rough: .47, flatShading: true });
  const gold = metalMat(TIZONA_COLORS.gold, { rough: .42, flatShading: true });
  const body = add(group, new THREE.CylinderGeometry(r, r, .021, 16), iron); body.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    add(group, new THREE.TorusGeometry(r * .88, .0011, 4, 20), gold, [0, 0, side * .011]);
    const sun = add(group, new THREE.CylinderGeometry(r * .22, r * .27, .002, 12), gold, [0, 0, side * .012]); sun.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6, length = r * (i % 2 ? .60 : .76);
      const geo = extrude([[-r * .065, r * .28], [0, length], [r * .065, r * .28]], .0007);
      const ray = add(group, geo, gold, [0, 0, side * .0118]); ray.rotation.z = a;
    }
  }
  return compact(group);
}
function guard(shape) {
  const group = new THREE.Group(), scale = shape[1] / .14;
  const iron = metalMat(TIZONA_COLORS.hilt, { rough: .43, flatShading: true });
  const gold = metalMat(TIZONA_COLORS.gold, { rough: .44 });
  // 휜 끝도 기존 곧은 상자 날밑 콜라이더에서 8 mm 안에 머문다.
  const right = [[0,.012],[.025,.006],[.057,-.002],[.094,-.014],[.12,-.018],[.139,-.009],[.14,-.023],[.124,-.028],[.095,-.025],[.054,-.014],[.025,-.007],[0,-.012]];
  for (const sign of [-1, 1]) {
    add(group, extrude(right.map(([x,y]) => [x * sign * scale, y]), .017), iron);
    for (const side of [-1, 1]) {
      line(group, [[.021,.003],[.055,-.004],[.095,-.017],[.122,-.021],[.134,-.017]].map(([x,y]) => [sign*x*scale,y,side*.009]), .00085, gold, 18);
    }
  }
  for (const side of [-1, 1]) {
    add(group, extrude([[0,.015],[.016,0],[0,-.015],[-.016,0]], .001), gold, [0,0,side*.010]);
    add(group, extrude([[0,.010],[.010,0],[0,-.010],[-.010,0]], .001), iron, [0,0,side*.011]);
    line(group, [[-.005,-.005,side*.012],[.005,.005,side*.012]], .00075, gold, 1);
    line(group, [[.005,-.005,side*.012],[-.005,.005,side*.012]], .00075, gold, 1);
  }
  return compact(group);
}
function blade(shape) {
  const L = shape[2] * 2, W = shape[1], position = [], color = [];
  const pale = new THREE.Color(TIZONA_COLORS.blade), dark = new THREE.Color(0x424845), ridge = new THREE.Color(0x626b68);
  const stops = [0,.025,.12,.32,.55,.76,.90,1];
  function section(t) {
    const tip = Math.max(0, (t - .9) / .1), w = W * (1 - .28 * t) * (1 - tip);
    const thick = .0044 * (1 - .45 * t) * (1 - tip);
    const face = [[-w,0,pale],[-w*.77,thick*.43,pale],[-w*.65,thick*.64,dark],[0,thick,ridge],[w*.65,thick*.64,dark],[w*.77,thick*.43,pale],[w,0,pale]];
    return [...face,...face.slice(1,-1).reverse().map(([x,z,c])=>[x,-z,c])].map(([x,z,c])=>({p:[x,(t-.5)*L,z],c}));
  }
  function tri(a,b,c) { for (const q of [a,b,c]) { position.push(...q.p); color.push(q.c.r,q.c.g,q.c.b); } }
  for(let i=1;i<stops.length;i++) { const a=section(stops[i-1]),b=section(stops[i]);for(let j=0;j<a.length;j++){const k=(j+1)%a.length;tri(a[j],b[j],b[k]);tri(a[j],b[k],a[k]);} }
  const cap=section(0);for(let i=1;i<cap.length-1;i++)tri(cap[0],cap[i+1],cap[i]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geo.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.34,metalness:.83,envMap:weaponEnv(),envMapIntensity:.85,side:THREE.DoubleSide});
  // 뿌리를 Mesh 하나로 둬야 기존 피 묻음 · 부러진 무기 길이 그대로 돈다.
  const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.name='tizona-blade';
  const inlays=new THREE.Group(),gold=metalMat(TIZONA_COLORS.inlay,{rough:.54});
  // 양면에 실제 기하로 새긴 은은한 금빛 상감 — 자체 발광 · 피해 효과 없음.
  // 글자 같은 무늬는 장식일 뿐, 유물의 명문을 옮긴 것이 아니다.
  for(const side of [-1,1])for(let i=0;i<13;i++){
    const y=-L/2+.045+i*.018,t=(y+L/2)/L,z=side*(.0044*(1-.45*t)+.00025),s=i%3;
    const strokes=s===0?[[[-.003,-.005],[.003,-.005]],[[0,-.005],[0,.006]]]:s===1?[[[-.003,-.005],[-.003,.005],[.003,.005],[.003,0],[-.003,0]]]:[[[-.003,-.005],[.003,.005]],[[-.003,.005],[.003,-.005]]];
    for(const path of strokes)line(inlays,path.map(([x,dy])=>[x,y+dy,z]),.00048,gold,path.length===2?1:4);
  }
  mesh.add(compact(inlays));return mesh;
}
export function tizonaPartMesh(index,isBlade,shape) {
  if(isBlade)return blade(shape);
  if(index===0)return grip(shape);
  if(index===1)return pommel(shape);
  if(index===2)return guard(shape);
}
