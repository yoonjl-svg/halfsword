// 생사전 경기 엔진 자리 (설계 docs/design/saengsa_2026-10-29.md §8 — 2단계 실제 2:2 싸움이 들어올 곳)
//  1단계: 엔진이 없다 → play() 가 null 을 돌려주고 saengsa_store.js playMine 이 빠른 셈(saengsa_rules.js quickResolve)으로 끝낸다.
//  2단계: main.js 가 launchSaengsa(setup) 를 내보내면(게임 모듈 game) 여기서 그것을 쓴다 —
//   setup = saengsa_rules.js matchSetup 꼴 { matchId, round, seed, mineSide, entrants, sides: { a: [사람], b: [사람] }, control 'player' | 'watch' }
//   돌려줄 것 = Promise<{ winner: 'a' | 'b', fighters: { key: { hp, injuries, alive } } }> — injuries 는 saengsa_rules.js injuriesFromWounds(경기 전 부상, 그 몸의 wounds)
//   (실제 싸움을 그만두고 나오면 null → 결과를 적지 않는다 · 2단계에서 정함)
// TODO(2단계): main.js launchSaengsa — 2:2 판 세우기 · 내 몸(control 'player') / 지켜보기('watch') · 판 끝에 위 꼴로 돌려주기 · 대기실 덮개로 돌아오기
export function makeEngine(game) {
  if (typeof game?.launchSaengsa === 'function') return { real: true, play: (setup) => game.launchSaengsa(setup) };
  return { real: false, play: async () => null };
}
