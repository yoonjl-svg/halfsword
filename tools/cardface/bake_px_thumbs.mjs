// 무기 카드 앞면의 작은 그림을 픽셀 결로 굽는다 (외형 PM, docs/design_language.md §4)
//  public/ui/weapons/<id>.webp (256×256) → public/ui/weapons_px/<id>_32.png · <id>_24.png · <id>_16.png
//  줄이기(면적 평균) → 알파 문턱(반투명 가장자리를 없앤다) → 색 계단(채널마다 8단) → 한 칸 어두운 외곽선.
//  카드에서는 한 칸 = --px 로 정수 배 확대해 image-rendering: pixelated 로 그린다 (index.html .wthumb).
//  무기 그림(weapon_thumbs.mjs)을 다시 찍으면 이것도 다시 돌린다.
//  실행: vite 개발 서버를 띄운 뒤  node tools/cardface/bake_px_thumbs.mjs http://127.0.0.1:5173
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로를 바꾸려면 PW_CHROMIUM
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const root = process.env.REPO_ROOT ? new URL(`file://${process.env.REPO_ROOT.replace(/\/?$/, '/')}`) : new URL('../../', import.meta.url); // 다른 곳에 복사해 돌릴 때 REPO_ROOT
const srcDir = new URL('public/ui/weapons/', root);
const outDir = new URL('public/ui/weapons_px/', root);
fs.mkdirSync(outDir, { recursive: true });
const ids = fs.readdirSync(srcDir).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const page = await browser.newPage();
await page.goto(`${base}/`);
for (const id of ids)
  for (const n of [32, 24, 16]) {
    const data = await page.evaluate(
      async ({ url, n }) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        // 1) 두 번에 나눠 줄인다 (한 번에 줄이면 가는 칼날이 사라진다): 256 → 4n → n
        const mid = document.createElement('canvas');
        mid.width = mid.height = n * 4;
        const mx = mid.getContext('2d');
        mx.imageSmoothingQuality = 'high';
        mx.drawImage(img, 0, 0, n * 4, n * 4);
        const c = document.createElement('canvas');
        c.width = c.height = n;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(mid, 0, 0, n, n);
        const d = x.getImageData(0, 0, n, n);
        const p = d.data;
        const solid = new Uint8Array(n * n);
        const q = (v) => Math.round(Math.round((v / 255) * 7) * (255 / 7)); // 채널마다 8단
        for (let i = 0; i < n * n; i++) {
          const a = p[i * 4 + 3];
          if (a >= 70) {
            // 반투명 가장자리는 검은 바탕에 섞였던 색을 되살려 불투명하게
            for (let k = 0; k < 3; k++) p[i * 4 + k] = q(Math.min(255, (p[i * 4 + k] * 255) / a));
            p[i * 4 + 3] = 255;
            solid[i] = 1;
          } else p[i * 4 + 3] = 0;
        }
        // 2) 한 칸 외곽선: 빈 칸 중 상하좌우에 채운 칸이 있으면 짙은 갈색
        for (let yy = 0; yy < n; yy++)
          for (let xx = 0; xx < n; xx++) {
            const i = yy * n + xx;
            if (solid[i]) continue;
            const nb = [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ].some(([dx, dy]) => {
              const X = xx + dx;
              const Y = yy + dy;
              return X >= 0 && Y >= 0 && X < n && Y < n && solid[Y * n + X];
            });
            if (nb) {
              p[i * 4] = 20;
              p[i * 4 + 1] = 13;
              p[i * 4 + 2] = 9;
              p[i * 4 + 3] = 255;
            }
          }
        x.putImageData(d, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      },
      { url: `${base}/ui/weapons/${id}.webp`, n },
    );
    fs.writeFileSync(new URL(`${id}_${n}.png`, outDir), Buffer.from(data, 'base64'));
  }
console.log('baked', ids.length, 'weapons × 3 sizes');
await browser.close();
