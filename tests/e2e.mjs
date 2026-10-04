// End-to-end check in headless Chromium: node tests/e2e.mjs [screenshotDir]
// Covers setup, sales, PIN login/lockout, agent permissions, daily report, dashboard and exports.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const shots = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try { res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }); res.end(await readFile(path)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Erreur de forfait' : undefined));
const shot = async name => shots && page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const step = (name) => console.log('✓', name);

await page.goto(url);

// First run: manager + pilot zone
await page.fill('input[name=zone]', 'Zone Basoko');
await page.fill('input[name=name]', 'Marcus');
await page.fill('input[name=pin]', '1234');
await page.fill('input[name=pin2]', '1234');
await shot('01-installation');
await page.click('text=Commencer');
await page.waitForSelector('text=Nouvelle vente');
step('setup');

// Sell: 1 h cash, 3 h Mobile Money, 30 min free, Journée with a router-printed code
async function sell(label, pay, code) {
  await page.click(`.tariff:has-text("${label}")`);
  await page.click(`[data-pay=${pay}]`);
  if (code) { await page.click('summary'); await page.fill('#manualCode', code); }
  await page.click('#sellBtn');
  await page.waitForSelector('dialog[open] .voucher');
  const shown = await page.textContent('dialog .voucher .code');
  if (code) assert.equal(shown, code.toUpperCase());
  else assert.match(shown, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  return shown;
}
await sell('1 heure', 'cash');
await shot('02-voucher');
await page.click('[data-m=close]');
await sell('3 heures', 'mm'); await page.click('[data-m=close]');
await sell('30 minutes', 'free'); await page.click('[data-m=close]');
await sell('Journée', 'cash', 'ab12-cd34'); await page.click('[data-m=close]');
await shot('03-vente');
step('sales recorded');

// Duplicate printed code is refused
await page.click('.tariff:has-text("1 heure")');
await page.click('summary');
await page.fill('#manualCode', 'AB12-CD34');
await page.click('#sellBtn');
await page.waitForSelector('.toast.show:has-text("déjà été vendu")');
step('duplicate code refused');

// Daily report numbers (cash 500 + 2000, MM 1000, 1 free)
await page.click('a[data-tab=rapport]');
await page.waitForSelector('text=Rapport journalier');
const report = await page.textContent('main');
for (const expected of ['Clients3', 'Recettes cash2 500 FC', 'Recettes Mobile Money1 000 FC', 'Total recettes3 500 FC', 'Vouchers gratuits1'])
  assert.ok(report.replace(/\s/g, '').includes(expected.replace(/\s/g, '')), `report should contain "${expected}"`);
await page.fill('#incForm input', 'Coupure électricité 14h-15h');
await page.click('#incForm button');
await page.waitForSelector('text=Coupure électricité 14h-15h');
await shot('04-rapport');
// Void the 1 h sale -> totals drop by 500
await page.click('tr:has-text("1 heure") [data-void]');
await page.waitForSelector('tr.void');
assert.ok((await page.textContent('main')).replace(/\s/g, '').includes('Totalrecettes3000FC'));
step('daily report + incident + void');

// Dashboard
await page.click('a[data-tab=tableau]');
await page.waitForSelector('#chart svg .bar');
await page.hover('#chart .hit[data-i="' + (new Date().getDate() - 1) + '"]');
await page.waitForSelector('.tooltip:not([hidden])');
await shot('05-tableau');
step('dashboard');

// Add an agent with PIN 4321
await page.click('a[data-tab=reglages]');
await page.click('#addAgent');
await page.fill('#agentForm input[name=name]', 'Grace');
await page.fill('#agentForm input[name=pin]', '4321');
await page.click('#agentForm button.primary');
await page.waitForSelector('td:has-text("Grace")');
await shot('06-reglages');
step('agent created');

// Exports
const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#expSales')]);
const csvText = await readFile(await csv.path(), 'utf8');
assert.ok(csvText.startsWith('﻿Date;Heure;Zone'));
assert.equal(csvText.trim().split('\r\n').length, 5); // header + 4 sales (voided one kept, flagged)
const [backup] = await Promise.all([page.waitForEvent('download'), page.click('#expBackup')]);
const json = JSON.parse(await readFile(await backup.path(), 'utf8'));
assert.equal(json.sales.length, 4); assert.equal(json.agents.length, 2);
assert.ok(!JSON.stringify(json.agents).includes('4321'), 'PIN must not be stored in clear');
step('exports');

// Lock, then log in as Grace: wrong PIN, then right PIN
await page.click('#userChip');
await page.click('[data-m=lock]');
await page.click('[data-agent]:has-text("Grace")');
for (const k of '9999') await page.click(`[data-key="${k}"]`);
await page.waitForSelector('#pinMsg:has-text("PIN incorrect")');
await shot('07-pin');
for (const k of '4321') await page.click(`[data-key="${k}"]`);
await page.waitForSelector('text=Nouvelle vente');
assert.ok(await page.isHidden('a[data-tab=tableau]'), 'agents must not see the dashboard');
assert.ok(await page.isHidden('a[data-tab=reglages]'), 'agents must not see settings');
await page.goto(url + '#/reglages');
await page.waitForSelector('text=Nouvelle vente'); // redirected
await sell('7 jours', 'mm'); await page.click('[data-m=close]');
await page.click('a[data-tab=rapport]');
await page.waitForSelector('text=Mes ventes du jour');
assert.equal(await page.locator('[data-void]').count(), 0, 'agents cannot void sales');
assert.equal(await page.locator('tbody tr:has(.code)').count(), 1, 'agent sees only own sales');
step('agent login + permissions');

// Lockout after 5 wrong PINs
await page.click('#userChip'); await page.click('[data-m=lock]');
await page.click('[data-agent]:has-text("Marcus")');
for (let i = 0; i < 5; i++) for (const k of '0000') await page.click(`[data-key="${k}"]`);
await page.waitForSelector('#pinMsg:has-text("Trop")');
for (const k of '1234') await page.click(`[data-key="${k}"]`);
await page.waitForSelector('#pinMsg:has-text("Trop")'); // still locked even with the right PIN
step('lockout');

// Data survives a reload
await page.reload();
await page.waitForSelector('[data-agent]');
assert.equal(await page.evaluate(() => new Promise(r => { const q = indexedDB.open('cispolstore'); q.onsuccess = () => { const g = q.result.transaction('sales').objectStore('sales').count(); g.onsuccess = () => r(g.result); }; })), 5);
step('persistence');

assert.deepEqual(errors, [], 'no console errors');
await browser.close();
server.close();
console.log('All checks passed');
