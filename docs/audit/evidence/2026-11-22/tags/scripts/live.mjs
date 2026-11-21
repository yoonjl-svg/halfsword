// usage: node live.mjs <config.js> <keys.json>  — compares parsed key paths with the live exported objects
import fs from 'fs'; import path from 'path'; import { pathToFileURL } from 'url';
const [cfg, kj] = process.argv.slice(2);
const m = await import(pathToFileURL(path.resolve(cfg)).href);
const live = new Set();
const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function walk(v, p) { live.add(p); if (isPlain(v)) for (const k of Object.keys(v)) walk(v[k], p + '.' + k); }
for (const [k, v] of Object.entries(m)) walk(v, k);
const parsed = new Set(JSON.parse(fs.readFileSync(kj, 'utf8')).filter((k) => !k.skipped).map((k) => k.path));
const onlyLive = [...live].filter((p) => !parsed.has(p)), onlyParsed = [...parsed].filter((p) => !live.has(p));
console.log(cfg, 'live', live.size, 'parsed', parsed.size, 'onlyLive', onlyLive.length, onlyLive.slice(0, 15).join(' '), '| onlyParsed', onlyParsed.length, onlyParsed.slice(0, 15).join(' '));
