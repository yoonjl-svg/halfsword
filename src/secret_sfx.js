// 비기 소리 걸쇠 (10/25 사장님 '샛별이 비기 소리 보낸 거 입혀' — 샛별 저장소 2fa0b2ae · 남김말 MSG-S-015 답신 · docs/import/secret_audio_import_2026-10-25.md).
//  소리만 — 판정 · 물리 · 난수와 무관 (수를 읽기만 한다). 녹음 · 음량은 src/sound.js secretSfx · src/config.js SOUND.secretSfx* (확인표 2542 ~ 2545).
//  언제: 비기가 실제로 터진 순간 = 낸 전투자의 '터뜨림 수'가 오른 때 — main.js 결정타 화면 늦춤(SECRET.slowMo)과 같은 수.
//   main.js 는 화면마다 물리 스텝 뒤에 tick 한다(그 화면 안 — 화면 늦춤이 그 수를 보는 다음 화면 머리보다 늦지 않음) → 그 스텝 끝 실행 결과까지 본 뒤 낸다.
//   다만 화면 늦춤이 보는 합(ai + 사람)이 아니라 전투자마다 따로 본다 → 누가 냈는지 알고 그 사람 유파의 소리를 고른다 (둘이 같은 화면에 내면 둘 다 한 번씩).
//   · 사람: player.skill.secretBursts — skill.js secret(곧장 터지는 비기) · secretStrikeStart(run.burst 걸쇠 — 연환 · 여러 타격 비기도 한 번)
//   · AI: ai.secretBursts — ai.js secretGo · startStrike(secretRun.burst 걸쇠) · spinGo(싱지르) · mordGo(모르트슐라크).
//     AI 몸의 검술 층 수(enemy.skill.secretBursts)는 보지 않는다: 싱지르 · 모르트슐라크 AI 는 skill.secret 과 AI 실행부가 둘 다 세서, 둘을 보면 한 비기에 두 번 난다.
//  안 냄: 창이 열림('!' · secretReady) · 고노센 · 길목 · 싱지르 준비(secretArm · 무장) · 못 냄(secret() / secretGo() false — 수가 안 오름) ·
//   비기 잔상(f.instantArc — 비기가 아닌 고유 동작 잔상도 같은 칸이라 보지 않는다) ·
//   곧장 터지는 비기(발도 · 연환 · 격살 · 런지 · 운동학 모르트슐라크)가 그 스텝 끝 실행에서 못 걸림(instantResult.ok false — 쓰러짐 · 칼 놓침: secretFizzled).
//  어느 소리: 낸 전투자의 유파(fighter.swordArt.tradition) → SOUND.secretSfxFiles (사장님 10/25 결정 — 일본 · 이탈리아 · 동방 g1 · 이베리아 · 독일 g2). 표에 없는 유파는 소리 없음.
//  새 판: main.js newRound 가 새로 만든다 — 만든 때의 수를 바탕으로 삼으니 지난 판 수가 판 시작에 터지지 않는다.
import { SOUND } from './config.js';

/** 유파 → 소리 파일(public/sfx 기준 · 확장자 없음). 없으면 null */
export const secretSfxFile = (school, files = SOUND.secretSfxFiles) => (school && files?.[school]) || null;

/** 주소 `?secretSfx=0` → 끔(0) · 그 밖 = base (기본 SOUND.secretSfx 1). main.js 가 SOUND.secretSfx 에 넣는다 */
export const secretSfxMode = (params, base = 1) => (params.get('secretSfx') === '0' ? 0 : base);

/** 곧장 터지는 비기가 그 스텝 끝 실행에서 못 걸렸나: 실행 결과가 실패이고 비기가 이미 끝났거나 아직 그 결과를 기다리는 칸이면 (다른 칸이면 지난 동작의 묵은 결과) */
export const secretFizzled = (f, run) => f?.instantResult?.ok === false && (!run || run.stage === 'instant');

/**
 * 전투자마다 터뜨림 수를 보는 걸쇠. srcs = [{ who, fighter, count: () => 수, run: () => 지금 비기(없으면 null) }] · play(file, who, school) = 소리 내기.
 * tick() 을 화면마다 부르면(main.js — 물리 스텝 뒤) 이번에 터진 비기를 [{ who, school, file }] 로 돌려주고 파일이 있으면 play 를 한 번씩 부른다.
 */
export class SecretSfxWatch {
  constructor(srcs, play = null) {
    this.srcs = srcs.map((s) => ({ ...s, seen: s.count() ?? 0 }));
    this.play = play;
  }
  tick() {
    const out = [];
    for (const s of this.srcs) {
      const n = s.count() ?? 0;
      if (n === s.seen) continue;
      const up = n > s.seen;
      s.seen = n; // 한 화면에 수가 둘 넘게 올라도 한 번 (한 전투자는 굳음 때문에 한 화면에 비기 둘을 못 낸다)
      if (!up || secretFizzled(s.fighter, s.run?.())) continue;
      const school = s.fighter?.swordArt?.tradition ?? null;
      const file = secretSfxFile(school);
      out.push({ who: s.who, school, file });
      if (file) this.play?.(file, s.who, school);
    }
    return out;
  }
}
