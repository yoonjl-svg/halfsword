// 계정 연결 공개 설정 (브라우저 클라이언트에 그대로 실리는 값 — 공개 주소와 공개(publishable) 키만).
//  관리자 키(service_role)·비밀 키(sb_secret_…)는 절대 여기에 넣지 않는다 (저장소·배포판·브라우저 어디에도).
//  인증 프로젝트는 사장님이 일부러 만든 것 (사장님 10/16 01:0x — docs/import/lobby_port_2026-10-16.md §4 · 사장님 쪽 설정 §4-4)
//  appId: 이 기기의 로그인 저장 열쇠 이름에 쓴다 ('stillness-account:v1:auth' — title_account.js). 같은 출처(github.io)의 다른 판과 열쇠가 겹치지 않게
export default Object.freeze({
  appId: 'stillness',
  url: 'https://xrdxiyhhvdqiyklevgap.supabase.co',
  publishableKey: 'sb_publishable_ABBFDPwdl-uSZzECrkhVAw_IX9Eel8B',
});
