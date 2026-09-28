# 동작 라이브러리를 게임에 잇는 법 (다음 버전용 — 무기 PM)

지금은 `src/motion_library.js` 를 점검 도구만 켠다. 게임에 넣을 때는 아래 이음을 **`MOTION.lib` 스위치 하나**에 걸어 둔다. 끄면 지금 게임 그대로(바이트 동일) 가게 한다.
- 이미 넣은 것: `guards.js` guardAt 이 `out.table` 을 읽는다(한 줄).
- 근거·측정: `docs/weapon_motions.md`

## 1. 자세표 — fighter.js (무기를 쥘 때, 디렉터)
지금 `this.guardPose.oneHand = this.bodyGuard.oneHand = !!spec.oneHandStance;` 줄 바로 아래에 둔다.
```js
// 동작 라이브러리: 몸 틀별 자세표 (끄면 undefined → guardAt 이 예전 표를 쓴다)
const tbl = MOTION.lib ? frameTable(spec.frame, spec.style, spec.motionSkip ?? []) : null;
this.guardPose.table = this.bodyGuard.table = tbl ?? undefined;
```
`import { MOTION, frameTable } from './motion_library.js';`

## 2. 자세 이름 표시 — main.js updateGuardName (디렉터)
```js
const T = player.guardPose.table; // 라이브러리 표 (없으면 GUARDS)
const info = gun ? GUN_STANCE : (T && g < T.length ? T[g] : GUARDS[g]);
```
마무리 자세(g ≥ 14)는 늘 GUARDS 에서 읽는다.

## 3. 기술 목록 — schools.js (캐릭터 PM)
무기 꾸러미를 만드는 끝에 둔다.
```js
if (MOTION.lib) for (const w of WEAPON_LIST) {
  const s = SCHOOLS[w.id];
  if (!s || w.frame === 'two' && w.style === 'versatile') continue; // A 두루는 바뀌는 것이 없다
  const tech = styleTech(w.style, w.frame);
  SCHOOLS[w.id] = { ...s, tech, techByName: Object.fromEntries(tech.map((t) => [t.name, t])), feints: styleFeints(w.style) };
}
```
- 캐릭터 고유 꾸러미(랴오 등)는 캐릭터 PM 이 고른다. 무기 기본 꾸러미만 이렇게 바꾼다.
- 막기 자리(`LIB_PARRY`)는 기본으로 넣지 않는다(§5-2 규칙 2).

## 4. 런지 — skill.js thrust (무기 PM, 디렉터 확인)
지금 `installLunge` 가 감싸서 하는 일을 thrust 안으로 옮긴다.
```js
const lunge = MOTION.lib && f.motion?.overlay?.lunge; // motionFor(weapon).overlay
if (lunge) { K.reach += lunge.reach; this.tap.lunge = lunge; }
// 내딛기: THRUST.step 대신 lunge.step (사람의 탭)
// updateThrust 의 몸 자세: T.body 대신 tp.lunge?.body ?? T.body
```
**다리 걸음:** 런지 몸 낮춤(0.16 m)을 다리가 받아야 한다. 지금은 3~8 cm 에 그친다(`GAIT.heightRate` 를 0.6 으로 올려도 4 cm).

## 5. 흐름 — skill.js update (디렉터)
```js
if (SKILL.flow || (MOTION.lib && this.f.motion?.flow)) this.updateFlow(dt, swinging);
```
- 앞무게(B) 무기만 켜진다.
- 츠바이핸더 28 → 36% 의 대부분이 이것이다. 흐름을 빼면 30% 다.
- 손목 제동 풀기(fighter.js)가 들어오면 더 커질 것이다.

## 6. 막기 덧씌우기 — skill.js update + ai.js (시제품, 기본 끔)
`installCover` 가 하는 일이다: AI 가 `mode === 'defend'` 이고 칼로 막는 동안(`!defVoid`), 그 줄(`defLine`)의 막기 자세로 `thrustPose` 를 덮는다(0.08초에 덮고 0.15초에 걷는다).
- 한손 무기의 머리 막기·걸친 막기가 여기에 있다(`COVERS`).
- 잰 값이 섞여서(세이버 44 → 33%, 레이피어 40 → 46%) 기본은 끈다.
- 켜려면 AI 의 막기 판단이 막기 자세의 모양(칼끝이 아래로)을 알아야 한다.

## 7. 순서
1. **§1 + §2:** 보이는 것부터 넣는다. 앞무게·한손 자세 이름과 모양이 바뀐다. 승률 영향은 작다(`docs/weapon_motions.md` §5-0).
2. **§3:** 기술 목록. 몬탄테 탈류→레베스, 손목 베기.
3. **§5:** 흐름을 앞무게 무기만 켠다.
4. **§4:** 런지. 다리 걸음 작업과 함께한다.
5. **§6:** 막기 덧씌우기. AI 판단과 함께한다.
6. **단계마다:** fights12 · hybrid · live_battery 바이트 동일(스위치 끔)을 확인한다. 켠 상태로 `motion_lab duel <무기> 24 off|on` 48판 비교를 한다.
