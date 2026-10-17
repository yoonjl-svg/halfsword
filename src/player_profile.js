// 대기실 프로필 (샛별 저장소 817db21c): 이름 · 대면 결과(승·패). 이 기기에만 저장한다.
//  승패는 이 기능이 들어간 뒤 첫 화면·대기실에서 연 여정의 판 끝마다 한 번 센다(main.js checkRoundEnd — 주소 시험 판은 세지 않음).
//  지난 판 깬 수(stillness.journeyClears.v1)로 알 수 없는 승패를 거꾸로 셈하지 않는다.
//  기본 이름 'Noname' (사장님 10/18 04:1x '처음에 기본 이름 방랑자로 되어 있는 거 Noname 으로 고쳐줘' — 전 '방랑자').
//   판 끝마다 프로필을 통째로 저장해(recordDuel) 이름을 고친 적이 없어도 그때의 기본 이름이 같이 저장된다 — 그래서 저장된 이름이 꼭 전 기본 이름 '방랑자'이고
//   직접 고친 표시(named)가 없으면 'Noname' 으로 읽는다. 직접 고친 이름은 그대로(10/18 부터 고치면 named: true 를 같이 저장 — 그 뒤 '방랑자'로 고쳐도 그대로)
export const PROFILE_KEY = 'stillness.lobby.profile.v1';
export const DEFAULT_NAME = 'Noname';
const OLD_DEFAULT_NAME = '방랑자'; // 10/18 전 기본 이름 (저장된 것을 읽을 때만)
let session = { name: DEFAULT_NAME, wins: 0, losses: 0 };
let named = false; // 이 프로필의 이름을 플레이어가 직접 고쳤나 (저장 칸 named — 없으면 false)
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export function cleanName(value) {
  return Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).slice(0, 16).join('');
}
export function readProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (value?.version === 1) {
      const name = cleanName(value.name);
      named = value.named === true;
      session = { name: !name || (!named && name === OLD_DEFAULT_NAME) ? DEFAULT_NAME : name, wins: count(value.wins), losses: count(value.losses) };
    }
  } catch { /* 저장이 막힌 환경에서는 이번 실행 동안만 유지한다. */ }
  return { ...session };
}
function save(profile) {
  session = profile;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, ...profile, ...(named ? { named: true } : {}) })); return true; }
  catch { return false; }
}
export function renamePlayer(name) {
  const cleaned = cleanName(name);
  if (!cleaned) return { ok: false, saved: false };
  const profile = { ...readProfile(), name: cleaned };
  named = true;
  return { ok: true, saved: save(profile) };
}
export function recordDuel(win) {
  const profile = readProfile();
  profile[win ? 'wins' : 'losses']++;
  save(profile);
}
