// 대기실 프로필 (샛별 저장소 817db21c): 이름 · 대면 결과(승·패). 이 기기에만 저장한다.
//  승패는 이 기능이 들어간 뒤 첫 화면·대기실에서 연 여정의 판 끝마다 한 번 센다(main.js checkRoundEnd — 주소 시험 판은 세지 않음).
//  지난 판 깬 수(stillness.journeyClears.v1)로 알 수 없는 승패를 거꾸로 셈하지 않는다.
export const PROFILE_KEY = 'stillness.lobby.profile.v1';
let session = { name: '방랑자', wins: 0, losses: 0 };
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export function cleanName(value) {
  return Array.from(String(value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim()).slice(0, 16).join('');
}
export function readProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(PROFILE_KEY));
    if (value?.version === 1) session = { name: cleanName(value.name) || '방랑자', wins: count(value.wins), losses: count(value.losses) };
  } catch { /* 저장이 막힌 환경에서는 이번 실행 동안만 유지한다. */ }
  return { ...session };
}
function save(profile) {
  session = profile;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ version: 1, ...profile })); return true; }
  catch { return false; }
}
export function renamePlayer(name) {
  const cleaned = cleanName(name);
  if (!cleaned) return { ok: false, saved: false };
  return { ok: true, saved: save({ ...readProfile(), name: cleaned }) };
}
export function recordDuel(win) {
  const profile = readProfile();
  profile[win ? 'wins' : 'losses']++;
  save(profile);
}
