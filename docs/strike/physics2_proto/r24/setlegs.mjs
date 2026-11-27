// r24 시험용: 도구를 돌리기 전에 그 나무의 config LEGS 값을 바꿈.  R24_ROOT=<나무> R24_LEGS="muscleLag=0.5,…" node --import file://<이 파일> <도구>
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const C = await import(pathToFileURL(join(process.env.R24_ROOT, 'src/config.js')).href);
for (const kv of (process.env.R24_LEGS ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); C.LEGS[k] = +v; }
