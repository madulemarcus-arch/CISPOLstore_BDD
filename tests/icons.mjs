// Renders icons/icon.svg to the PNG sizes required by the manifest: node tests/icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Full-bleed background so the icon survives "maskable" cropping on Android
  await page.setContent(`<body style="margin:0;background:#1f5fb0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `).replace('rx="112"', 'rx="0"')}</body>`);
  await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname });
}
await browser.close();
