// 게임 들머리 (index.html 의 첫 모듈 — 샛별 저장소 215d7b7e · 817db21c · 3b280a1b 를 우리 판에 맞춤, docs/import/lobby_port_2026-10-16.md §3 · §5)
//  인자 없는 주소: 공지 → 첫 화면 → 대기실 → 여정(무기 카드, 또는 이어하기 지점). 게임(main.js)은 첫 화면 뒤에서 받아 두고,
//   첫 화면·대기실이 앞에 있는 동안(html[data-start-open]) 게임의 3D 그리기·물리는 멈춘다 (main.js frame).
//  게임 인자가 하나라도 있는 주소(?stage= ?weapon= ?foe= ?test=1 ?stamina=0 ?foeWhiff=1 …): 지금처럼 바로 게임 메뉴 (journey_save.js skipsTitle)
//  첫 화면·대기실은 Shadow DOM 안 — 꾸밈은 그 안에서만, 글자는 게임 HUD 규칙의 토큰(index.html :root)을 물려받아 entrance_type.css 한 곳에서 (lobby_fix §1).
//  디자인 보기용 주소 `?coins=N` = 대기실 금화를 N 으로 (lobby_progress.js setCoins — 게임 인자로 세지 않아 첫 화면이 뜬다 · lobby_fix §6)
import baseStyle from './start_screen.css?inline';
import pixelStyle from './start_pixel.css?inline';
import typeStyle from './entrance_type.css?inline';
import { ENTRANCE_HTML, mountStartScreen } from './start_screen.js';
import { skipsTitle } from './journey_save.js';
import { setCoins } from './lobby_progress.js';

const params = new URLSearchParams(location.search.slice(1).replace(/\?/g, '&'));
if (params.has('coins')) setCoins(Number(params.get('coins')));
if (skipsTitle(params)) {
  document.documentElement.removeAttribute('data-start-open');
  await import('./main.js');
} else {
  const host = document.createElement('div');
  host.id = 'gameEntrance';
  host.style.cssText = 'position:fixed;inset:0;z-index:100;background:#30291e';
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const covered = [...document.body.children].filter(el => el !== host && el.tagName !== 'SCRIPT');
  for (const el of covered) el.inert = true;
  const loaded = import('./main.js');
  let screen, lobby;
  function showTitle() {
    lobby?.destroy(); lobby = null;
    const style = document.createElement('style');
    // 빌드가 속성 선택자의 따옴표를 뺄 수 있어 따옴표가 있든 없든 바꾼다 (샛별 쪽에서 찾은 문제)
    style.textContent = (baseStyle + pixelStyle)
      .replace(/(?:html)?\[data-start-theme=["']?pixel["']?\]/g, ':host')
      .replaceAll(':root', ':host').replace(/html,\s*body/g, ':host')
      + '\n#selectionStatus:not(.sr-only){position:absolute;left:0;right:0;margin:12px 0 0;}\n' + typeStyle;
    const markup = document.createElement('template');
    markup.innerHTML = ENTRANCE_HTML;
    root.replaceChildren(style, markup.content);
    let choosing = false;
    screen = mountStartScreen({
      root,
      settings: async () => { const game = await loaded; return { get: game.getLobbySettings, set: game.setLobbyFps }; },
      accountLoader: () => import('./account/title_account.js'),
      async onChoice(choice) {
        if (choosing) return;
        choosing = true; screen.setBusy(true); screen.setStatus('');
        try {
          const game = await loaded;
          if (choice === 'continue' && !game.canContinueJourney()) {
            screen.setStatus('이어갈 여정이 없습니다. 처음부터 시작해 주세요.');
            screen.setBusy(false); choosing = false; return;
          }
          const { mountLobby } = await import('./lobby.js'); // 대기실 묶음(3D 미리보기)은 고를 때 받는다 — 첫 화면을 늦추지 않게
          screen.destroy();
          lobby = mountLobby({ root, game, choice, onBack: showTitle, async onDepart() {
            if (!await game.launchJourney(choice)) throw new Error('Missing journey');
            document.documentElement.removeAttribute('data-start-open');
            for (const el of covered) el.inert = false;
            // 대기실을 0.3 s 걷어 낸다 — 뒤의 카드·싸움 화면(세로 폰이면 돌려 달라는 안내)이 비쳐 보이며 넘어가게 (리뷰 §8-6 '갑작스럽다')
            host.style.pointerEvents = 'none'; host.style.background = 'transparent';
            root.querySelector('.lobby')?.setAttribute('data-leaving', '');
            await new Promise(r => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300));
            lobby.destroy(); host.remove();
          } });
        } catch {
          if (!root.getElementById('selectionStatus')) showTitle();
          screen.setStatus('게임을 준비하지 못했습니다. 다시 시도해 주세요.');
          choosing = false; screen.setBusy(false);
        }
      },
    });
  }
  showTitle();
  loaded.catch(() => screen.setStatus('게임을 준비하지 못했습니다. 새로고침해 주세요.'));
}
