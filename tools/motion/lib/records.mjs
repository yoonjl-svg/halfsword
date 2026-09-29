// 게임 기록 파일 쓰기 + docs/motion/records/index.json 갱신 (같은 id 는 바꿔 끼운다)
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function writeRecord(dir, r) {
  writeFileSync(join(dir, `${r.id}.json`), JSON.stringify(r));
  const ip = join(dir, 'index.json');
  let index = { format: 'stillness-motion-records/1', records: [] };
  if (existsSync(ip)) {
    try {
      index = JSON.parse(readFileSync(ip, 'utf8'));
    } catch {}
  }
  const entry = { id: r.id, cut: r.cut, kind: r.kind ?? 'game-arm', file: `${r.id}.json`, source: r.source, summary: r.summary };
  const i = index.records.findIndex((x) => x.id === r.id);
  if (i >= 0) index.records[i] = entry;
  else index.records.push(entry);
  index.records.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(ip, JSON.stringify(index, null, 1));
}
