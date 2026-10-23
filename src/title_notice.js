// 싸움 결과 창 위 호칭 알림 창 (사장님 10/24 03:2x '처음 호칭을 받을 때 알림 뜨게하고' — 방랑자 · 왕 시해자 · 정복자처럼 판 끝에 얻는 호칭):
//  결과 창(#menu)이 뜬 뒤 · 방랑 알림 창(#wanderNotice — 30 무대를 처음 다 깬 판)이 떠 있으면 그 창을 닫은 뒤 한 창씩 (main.js — 두 줄).
//  꼴 = 방랑 알림 창과 같은 결과 창 꼴(index.html .overlay.notice .card) · 확인 = 금색 주 단추(.primary — 방랑 청동색 아님) · 글은 대기실 창과 같음(title_rules.js · lobby_progress.js titleNotices).
//  확인을 누르면 본 것으로 적는다(lobby_progress.js markTitleSeen) — 누르지 않고 떠나면 대기실이 띄운다. 창은 처음 띄울 때 문서에 한 번 만든다(index.html 은 그대로).
import { titleNotices, markTitleSeen } from './lobby_progress.js';
import { TITLE_NOTICE_HEAD } from './title_rules.js';

let box = null, back = null;
function make(doc) {
  box = doc.createElement('div');
  box.className = 'overlay notice'; box.id = 'titleNotice';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'titleNoticeHead'); box.setAttribute('aria-describedby', 'titleNoticeName titleNoticeWhy');
  // 호칭 이름 = 금색 · 창 제목 크기 · 굵게(대기실 창 .title-earned 와 같은 몫) · 낱말 안에서 꺾지 않음
  box.innerHTML = `<div class="card"><h1 id="titleNoticeHead"></h1><p id="titleNoticeName" style="margin:4px 0 8px;color:var(--c-accent);font-size:var(--fs-l);font-weight:var(--fw-head);line-height:var(--lh-tight);word-break:keep-all"></p>`
    + `<p class="sub" id="titleNoticeWhy" style="margin-bottom:0;word-break:keep-all"></p><div class="actions"><button class="primary" id="btnTitleNotice">확인</button></div></div>`;
  box.querySelector('h1').textContent = TITLE_NOTICE_HEAD;
  doc.body.append(box);
  box.querySelector('button').addEventListener('click', () => {
    markTitleSeen(box.dataset.event);
    box.classList.remove('show');
    if (!showTitleNotice(doc)) { back?.focus?.({ preventScroll: true }); back = null; }
  });
}
/** 아직 안 본 호칭이 있으면 창을 띄우고 true (이미 떠 있으면 true) · 없으면 false */
export function showTitleNotice(doc = document) {
  if (box?.classList.contains('show')) return true;
  const next = titleNotices()[0];
  if (!next) return false;
  if (!box) make(doc);
  if (!back) back = doc.activeElement;
  box.dataset.event = next.event;
  box.querySelector('#titleNoticeName').textContent = next.name;
  box.querySelector('#titleNoticeWhy').textContent = next.why;
  box.classList.add('show');
  box.querySelector('button').focus({ preventScroll: true });
  return true;
}
