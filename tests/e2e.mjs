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

// MikroTik mode is on by default: without stock, selling is blocked
await page.waitForSelector('.notice:has-text("Aucun ticket MikroTik")');
await page.click('.tariff:has-text("1 heure")');
await page.click('#sellBtn');
await page.waitForSelector('.toast.show:has-text("Plus de tickets")');
step('empty stock blocks sales');

// Generate ticket batches and check the RouterOS script
await page.evaluate(() => { window.print = () => { window.__printed = document.querySelectorAll('#print .ticket').length; }; });
await page.click('a[data-tab=tickets]');
await page.waitForSelector('#batchForm');
async function batch(label, n) {
  const value = await page.$eval('#batchForm select[name=tariffId]', (sel, l) => [...sel.options].find(o => o.text.startsWith(l + ' –')).value, label);
  await page.selectOption('#batchForm select[name=tariffId]', value);
  await page.fill('#batchForm input[name=count]', String(n));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#batchForm button.primary')]);
  assert.match(dl.suggestedFilename(), /^cispol-L\d{8}-\d\d\.rsc$/);
  const rsc = await readFile(await dl.path(), 'utf8');
  assert.ok(/^[\x00-\x7e]*$/.test(rsc), 'script must be plain ASCII');
  const codes = [...rsc.matchAll(/user add name="([a-z2-9]{8})" password="\1"/g)].map(m => m[1]);
  assert.equal(codes.length, n);
  return { rsc, codes };
}
const h1 = await batch('1 heure', 5);
assert.ok(h1.rsc.includes('profile="cispol-t1h" limit-uptime=1h'));
assert.ok(h1.rsc.includes('shared-users=1'));
assert.ok(h1.rsc.includes('on-error={}'), 're-import must be idempotent');
await batch('3 heures', 2);
await batch('30 minutes', 2);
const day = await batch('Journée', 2);
assert.ok(day.rsc.includes('limit-uptime=1d') && day.rsc.includes('Journee'));
await batch('7 jours', 1);
await page.waitForSelector('text=L' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-05');
const [login] = await Promise.all([page.waitForEvent('download'), page.click('#dlLogin')]);
const loginPage = await readFile(await login.path(), 'utf8');
for (const k of ['$(link-login-only)', '$(if chap-id)', "hexMD5('$(chap-id)'+c+'$(chap-challenge)')", '$(if error)', 'CISPOLstore WiFi'])
  assert.ok(loginPage.includes(k), `login.html should contain ${k}`);
assert.match(loginPage, /<td>Journée<\/td><td>2\s000 FC<\/td>/);
await page.click('li:has-text("1 heure") [data-print]');
assert.equal(await page.evaluate(() => window.__printed), 5);
await shot('02-tickets');
step('ticket batches + script + login page + print');

// Sell from stock: 1 h cash, 3 h Mobile Money, 30 min free, then a printed Journée ticket by code
async function sell(label, pay, code) {
  if (label) await page.click(`.tariff:has-text("${label}")`);
  await page.click(`[data-pay=${pay}]`);
  if (code) { await page.click('#manualBox summary'); await page.fill('#manualCode', code); }
  await page.click('#sellBtn');
  await page.waitForSelector('dialog[open] .voucher');
  return page.textContent('dialog .voucher .code');
}
await page.click('a[data-tab=vendre]');
await page.waitForSelector('.tariff:has-text("1 heure") .stock:has-text("5 en stock")');
assert.equal(await sell('1 heure', 'cash'), h1.codes[0], 'first stock ticket is sold first');
await shot('03-voucher');
await page.click('[data-m=close]');
await page.waitForSelector('.tariff:has-text("1 heure") .stock:has-text("4 en stock")');
await sell('3 heures', 'mm'); await page.click('[data-m=close]');
await sell('30 minutes', 'free'); await page.click('[data-m=close]');
assert.equal(await sell(null, 'cash', ' ' + day.codes[1] + ' '), day.codes[1]);
assert.ok((await page.textContent('dialog .voucher')).includes('Journée'), 'tariff comes from the printed ticket');
await page.click('[data-m=close]');
await page.waitForSelector('.tariff:has-text("Journée") .stock:has-text("1 en stock")');
await shot('04-vente');
step('sales from stock');

// A sold code cannot be sold again
await page.click('#manualBox summary');
await page.fill('#manualCode', day.codes[1]);
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
await shot('05-rapport');
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
await shot('06-tableau');
step('dashboard');

// Add an agent with PIN 4321
await page.click('a[data-tab=reglages]');
await page.click('#addAgent');
await page.fill('#agentForm input[name=name]', 'Grace');
await page.fill('#agentForm input[name=pin]', '4321');
await page.click('#agentForm button.primary');
await page.waitForSelector('td:has-text("Grace")');
await shot('07-reglages');
step('agent created');

// Exports
const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#expSales')]);
const csvText = await readFile(await csv.path(), 'utf8');
assert.ok(csvText.startsWith('﻿Date;Heure;Zone'));
assert.equal(csvText.trim().split('\r\n').length, 5); // header + 4 sales (voided one kept, flagged)
const [backup] = await Promise.all([page.waitForEvent('download'), page.click('#expBackup')]);
const json = JSON.parse(await readFile(await backup.path(), 'utf8'));
assert.equal(json.sales.length, 4); assert.equal(json.agents.length, 2);
assert.equal(json.tickets.length, 12);
assert.deepEqual(['sold', 'stock', 'void'].map(st => json.tickets.filter(t => t.status === st).length), [3, 8, 1]); // voided 1 h sale -> ticket void
assert.ok(!JSON.stringify(json.agents).includes('4321'), 'PIN must not be stored in clear');
step('exports');

// Lock, then log in as Grace: wrong PIN, then right PIN
await page.click('#userChip');
await page.click('[data-m=lock]');
await page.click('[data-agent]:has-text("Grace")');
for (const k of '9999') await page.click(`[data-key="${k}"]`);
await page.waitForSelector('#pinMsg:has-text("PIN incorrect")');
await shot('08-pin');
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
