// 물리 2.0 시험판 저장 가르기 — build.mjs 가 이 글을 시험 페이지 머리에 그대로 넣는다(모듈보다 먼저 돈다). 게임 코드는 이 파일을 들여오지 않는다.
//  시험 페이지는 본 게임과 같은 출처(github.io)라 localStorage 를 함께 쓴다. 이 페이지의 localStorage 읽기 · 쓰기를 모두 열쇠 앞에 'stillness.p2trial.' 을 붙여 돌린다
//   (getItem · setItem · removeItem · key · length · clear — localStorage 일 때만 · sessionStorage 는 그대로).
//  그래서 본 게임의 저장(금화 · 스킬트리 · 장비 · 여정 · 계정 연결)은 읽지도 고치지도 않는다. clear() 도 시험판 열쇠만 지운다.
//  꼴은 생사전 시험판(src/test_storage.js)과 같다. 열쇠 앞이 달라 두 시험판의 저장도 서로 안 섞인다.
(function () {
  var PREFIX = 'stillness.p2trial.';
  var ls = null;
  try { ls = window.localStorage || null; } catch (e) { return; }
  if (!ls || typeof Storage === 'undefined') return;
  var P = Storage.prototype;
  if (P.__stillnessP2Trial) return;
  var getItem = P.getItem, setItem = P.setItem, removeItem = P.removeItem, key = P.key, clear = P.clear;
  var lengthOf = Object.getOwnPropertyDescriptor(P, 'length').get;
  var isLocal = function (s) { return s === ls; };
  var trialKeys = function (s) {
    var out = [];
    for (var i = 0, n = lengthOf.call(s); i < n; i++) {
      var k = key.call(s, i);
      if (k != null && k.indexOf(PREFIX) === 0) out.push(k);
    }
    return out;
  };
  P.getItem = function (k) { return getItem.call(this, isLocal(this) ? PREFIX + k : k); };
  P.setItem = function (k, v) { return setItem.call(this, isLocal(this) ? PREFIX + k : k, v); };
  P.removeItem = function (k) { return removeItem.call(this, isLocal(this) ? PREFIX + k : k); };
  P.key = function (i) {
    if (!isLocal(this)) return key.call(this, i);
    var k = trialKeys(this)[i];
    return k == null ? null : k.slice(PREFIX.length);
  };
  P.clear = function () {
    if (!isLocal(this)) return clear.call(this);
    var ks = trialKeys(this);
    for (var i = 0; i < ks.length; i++) removeItem.call(this, ks[i]);
  };
  Object.defineProperty(P, 'length', { configurable: true, get: function () { return isLocal(this) ? trialKeys(this).length : lengthOf.call(this); } });
  Object.defineProperty(P, '__stillnessP2Trial', { value: true });
})();
