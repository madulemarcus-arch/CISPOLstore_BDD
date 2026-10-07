// Builds every icon from the brand logo (icons/logo-source.png): node tests/icons.mjs
// - icon-192.png / icon-512.png: app icons (mark on white, inside the Android "maskable" safe zone)
// - logo-mark.png: the mark alone with a transparent background (header, login screens)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../icons/', import.meta.url);
const src = 'data:image/png;base64,' + readFileSync(new URL('logo-source.png', dir)).toString('base64');
const MARK = { x: 250, y: 184, w: 226, h: 244 }; // "C + hexagon" area of logo-source.png, above the wordmark

const browser = await chromium.launch();
const page = await browser.newPage();
const out = await page.evaluate(async ({ src, MARK }) => {
  const im = new Image(); im.src = src; await im.decode();
  const draw = (size, { white, scale }) => {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    if (white) { x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); }
    const k = size * scale / Math.max(MARK.w, MARK.h);
    const w = MARK.w * k, h = MARK.h * k;
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, MARK.x, MARK.y, MARK.w, MARK.h, (size - w) / 2, (size - h) / 2, w, h);
    if (!white) { // turn the white background transparent, keeping anti-aliased edges
      const d = x.getImageData(0, 0, size, size);
      for (let i = 0; i < d.data.length; i += 4) {
        const m = Math.min(d.data[i], d.data[i + 1], d.data[i + 2]);
        if (m > 200) d.data[i + 3] = Math.round(255 * (255 - m) / 55);
      }
      x.putImageData(d, 0, 0);
    }
    return c.toDataURL('image/png').split(',')[1];
  };
  return {
    'icon-192.png': draw(192, { white: true, scale: 0.62 }),
    'icon-512.png': draw(512, { white: true, scale: 0.62 }),
    'logo-mark.png': draw(128, { white: false, scale: 1 }),
  };
}, { src, MARK });
for (const [name, b64] of Object.entries(out)) writeFileSync(new URL(name, dir), Buffer.from(b64, 'base64'));
await browser.close();
console.log('Icons written:', Object.keys(out).join(', '));
