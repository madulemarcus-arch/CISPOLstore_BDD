(() => {
  'use strict';

  // ---------- Defaults (from the CISPOLstore-Bandundu business plan, Sept. 2026) ----------
  const DAY = 1440;
  const DEFAULT_TARIFFS = [
    { id: 't30m', label: '30 minutes', minutes: 30, price: 250 },
    { id: 't1h', label: '1 heure', minutes: 60, price: 500 },
    { id: 't3h', label: '3 heures', minutes: 180, price: 1000 },
    { id: 't1d', label: 'Journée', minutes: DAY, price: 2000 },
    { id: 't3d', label: '3 jours', minutes: 3 * DAY, price: 3500 },
    { id: 't7d', label: '7 jours', minutes: 7 * DAY, price: 5000 },
    { id: 't30d', label: '30 jours', minutes: 30 * DAY, price: 15000 },
    { id: 's7d', label: 'Student semaine', minutes: 7 * DAY, price: 5000, student: true },
    { id: 's30d', label: 'Student mois', minutes: 30 * DAY, price: 15000, student: true },
  ].map(t => ({ student: false, active: true, rateLimit: '', ...t }));

  const DEFAULT_CHARGES = [
    { label: 'Internet (Starlink)', amount: 250000 },
    { label: 'Agent', amount: 250000 },
    { label: 'Électricité', amount: 150000 },
    { label: 'Emplacement', amount: 150000 },
    { label: 'Maintenance', amount: 100000 },
    { label: 'Marketing', amount: 100000 },
    { label: 'Divers', amount: 100000 },
  ];

  const DEFAULT_TARGETS = [50, 65, 80, 90, 100, 110, 120, 130, 140, 150, 165, 180];
  const PAYMENTS = { cash: 'Cash', mm: 'Mobile Money', free: 'Gratuit' };
  const DEFAULT_MIKROTIK = { enabled: true, ssid: 'CispolStore WiFi' };
  const TICKET_STATUS = { stock: 'En stock', sold: 'Vendu', void: 'Annulé' };
  const MAX_BATCH = 500;
  const LOCK_AFTER_MS = 5 * 60 * 1000;
  const MAX_PIN_TRIES = 5;

  // ---------- Utils ----------
  const $ = sel => document.querySelector(sel);
  const nf = new Intl.NumberFormat('fr-FR');
  const fc = n => nf.format(Math.round(n || 0)) + ' FC';
  const usd = n => '≈ ' + new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' $';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Logo wordmark: "Cispol" in navy, "Store" in orange (any name containing "store")
  const brandHtml = name => {
    const m = String(name).match(/^(.*?)(store)(.*)$/i);
    return m ? `${esc(m[1])}<span class="accent2">${esc(m[2])}</span>${esc(m[3])}` : esc(name);
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const today = () => dayKey(new Date());
  const timeOf = iso => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDay = key => new Date(key + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMonth = key => new Date(key + '-15T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const fmtDateTime = iso => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const shiftMonth = (key, delta) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
  const monthsBetween = (from, to) => { const [y1, m1] = from.split('-').map(Number), [y2, m2] = to.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const fmtDuration = min => min % DAY === 0 ? (min / DAY === 1 ? '1 jour' : `${min / DAY} jours`) : min % 60 === 0 ? `${min / 60} h` : `${min} min`;

  // Unambiguous alphabet (no 0/O, 1/I/L) so codes can be read aloud or copied by hand
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  // Hotspot tickets: lowercase, no separator, so they are easy to type on a phone keyboard
  const TICKET_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  function newTicketCode(taken) {
    for (;;) {
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const c = Array.from(bytes, b => TICKET_ALPHABET[b % TICKET_ALPHABET.length]).join('');
      if (!taken.has(c)) { taken.add(c); return c; }
    }
  }
  function newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const s = Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
    return s.slice(0, 4) + '-' + s.slice(4);
  }

  async function hashPin(pin, salt) {
    const data = new TextEncoder().encode(salt + ':' + pin);
    if (crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback for non-secure contexts (plain http on a LAN): FNV-1a, weaker but keeps PINs out of plain text
    let h = 0x811c9dc5;
    for (const b of data) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv' + h.toString(16);
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Copié'); }
    catch { prompt('Copiez le texte :', text); }
  }

  async function shareText(text) {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Storage (IndexedDB, everything cached in memory) ----------
  const STORES = ['meta', 'agents', 'zones', 'sales', 'incidents', 'tickets'];
  let idb = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('cispolstore', 2);
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const tx = (store, mode, fn) => new Promise((resolve, reject) => {
    const t = idb.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
  const getAll = store => tx(store, 'readonly', s => s.getAll());
  const put = (store, obj) => tx(store, 'readwrite', s => s.put(obj));
  const clearStore = store => tx(store, 'readwrite', s => s.clear());
  const putMany = (store, list) => tx(store, 'readwrite', s => { for (const o of list) s.put(o); });

  const db = { settings: null, agents: [], zones: [], sales: [], incidents: [], tickets: [] };

  function defaultSettings() {
    return {
      id: 'settings', businessName: 'CispolStore', rate: 2300, avgBasket: 750,
      launchMonth: monthKey(new Date()), targets: DEFAULT_TARGETS.slice(),
      charges: DEFAULT_CHARGES.map(c => ({ ...c })), tariffs: DEFAULT_TARIFFS.map(t => ({ ...t })),
      mikrotik: { ...DEFAULT_MIKROTIK },
    };
  }

  async function loadAll() {
    const [meta, agents, zones, sales, incidents, tickets] = await Promise.all(STORES.map(getAll));
    db.settings = meta.find(m => m.id === 'settings') || null;
    db.agents = agents; db.zones = zones; db.incidents = incidents;
    db.tickets = tickets.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.n - b.n);
    db.sales = sales.sort((a, b) => a.at.localeCompare(b.at));
  }
  const saveSettings = () => put('meta', db.settings);

  // ---------- Domain ----------
  const zoneName = id => db.zones.find(z => z.id === id)?.name || '—';
  const agentName = id => db.agents.find(a => a.id === id)?.name || '—';
  const activeZones = () => db.zones.filter(z => z.active);
  const activeTariffs = () => db.settings.tariffs.filter(t => t.active);
  const monthlyCharges = () => db.settings.charges.reduce((s, c) => s + (+c.amount || 0), 0);
  // Daily paying clients needed to cover one zone's monthly charges (plan §6.4: ≈ 49)
  const breakEven = () => Math.ceil(monthlyCharges() / (db.settings.avgBasket * 30));
  const targetFor = month => {
    const i = monthsBetween(db.settings.launchMonth, month);
    if (i < 0) return null;
    return db.settings.targets[Math.min(i, db.settings.targets.length - 1)];
  };

  function salesWhere({ day, month, zoneId, agentId, includeVoid = false }) {
    return db.sales.filter(s =>
      (includeVoid || !s.void) &&
      (!day || s.day === day) &&
      (!month || s.day.startsWith(month)) &&
      (!zoneId || s.zoneId === zoneId) &&
      (!agentId || s.agentId === agentId));
  }

  function summarize(list) {
    const paid = list.filter(s => s.payment !== 'free');
    const cash = paid.filter(s => s.payment === 'cash').reduce((t, s) => t + s.price, 0);
    const mm = paid.filter(s => s.payment === 'mm').reduce((t, s) => t + s.price, 0);
    const byTariff = {};
    for (const s of list) {
      const k = s.tariffLabel;
      byTariff[k] = byTariff[k] || { count: 0, free: 0, amount: 0 };
      if (s.payment === 'free') byTariff[k].free++;
      else { byTariff[k].count++; byTariff[k].amount += s.price; }
    }
    return { clients: paid.length, free: list.length - paid.length, cash, mm, total: cash + mm, byTariff };
  }

  const mikrotikOn = () => !!db.settings.mikrotik?.enabled;
  const stockOf = (zoneId, tariffId) => db.tickets.filter(t => t.status === 'stock' && t.zoneId === zoneId && (!tariffId || t.tariffId === tariffId));
  const allCodes = () => new Set([...db.tickets.map(t => t.code), ...db.sales.map(s => s.code)]);

  // ticket: a stock ticket to mark as sold (its code becomes the sale code)
  async function recordSale({ tariff, payment, zoneId, code, ticket }) {
    const now = new Date();
    if (ticket) code = ticket.code;
    const sale = {
      id: uid(), code: code || newCode(), ticketId: ticket?.id || null, tariffId: tariff.id, tariffLabel: tariff.label,
      minutes: tariff.minutes, price: payment === 'free' ? 0 : tariff.price, listPrice: tariff.price,
      payment, zoneId, agentId: session.agentId,
      at: now.toISOString(), day: dayKey(now),
      expires: new Date(now.getTime() + tariff.minutes * 60000).toISOString(), void: false,
    };
    if (ticket) {
      Object.assign(ticket, { status: 'sold', saleId: sale.id, soldAt: sale.at });
      await put('tickets', ticket);
    }
    await put('sales', sale);
    db.sales.push(sale);
    return sale;
  }

  // ---------- Session & PIN ----------
  let session = null; // { agentId, at }
  const me = () => db.agents.find(a => a.id === session?.agentId);
  const isManager = () => me()?.role === 'gerant';
  const tries = {}; // agentId -> { n, until }

  function restoreSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem('session') || 'null');
      if (s && Date.now() - s.at < LOCK_AFTER_MS && db.agents.some(a => a.id === s.agentId && a.active)) session = s;
    } catch {}
  }
  function touchSession() {
    if (!session) return;
    session.at = Date.now();
    try { sessionStorage.setItem('session', JSON.stringify(session)); } catch {}
  }
  function lock() {
    session = null;
    try { sessionStorage.removeItem('session'); } catch {}
    closeModal();
    route();
  }
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, touchSession, { passive: true }));
  setInterval(() => { if (session && Date.now() - session.at > LOCK_AFTER_MS) lock(); }, 15000);

  async function checkPin(agent, pin) {
    const t = tries[agent.id] || (tries[agent.id] = { n: 0, until: 0 });
    if (Date.now() < t.until) return 'locked';
    if (await hashPin(pin, agent.salt) === agent.pinHash) { t.n = 0; return 'ok'; }
    if (++t.n >= MAX_PIN_TRIES) { t.n = 0; t.until = Date.now() + 30000; return 'locked'; }
    return 'bad';
  }

  async function setPin(agent, pin) {
    agent.salt = uid();
    agent.pinHash = await hashPin(pin, agent.salt);
    agent.pinLen = pin.length;
  }
  const validPin = pin => /^\d{4,6}$/.test(pin);

  // ---------- Modal ----------
  const modal = $('#modal');
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    if (!modal.open) modal.showModal();
  }
  function closeModal() { if (modal.open) modal.close(); }
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  // ---------- Router ----------
  const view = $('#view');
  const ui = { // per-screen UI state kept across re-renders
    sell: { tariffId: null, payment: 'cash', zoneId: null },
    report: { day: null, zoneId: '' },
    dash: { month: null, zoneId: '' },
    tickets: { zoneId: '' },
  };

  function route() {
    const loggedIn = !!session;
    $('#topbar').hidden = !loggedIn;
    $('#tabbar').hidden = !loggedIn;
    if (!db.agents.length) return renderSetup();
    if (!loggedIn) return renderLogin();

    $('#brandName').innerHTML = brandHtml(db.settings.businessName);
    $('#userChip').textContent = `${me().name} · ${me().role === 'gerant' ? 'Gérant' : 'Agent'} ▾`;
    document.querySelectorAll('[data-role="gerant"]').forEach(el => { el.hidden = !isManager(); });

    let tab = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'vendre';
    if (!isManager() && ['tableau', 'reglages', 'tickets'].includes(tab)) tab = 'vendre';
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    ({ vendre: renderSell, rapport: renderReport, tickets: renderTickets, tableau: renderDashboard, reglages: renderSettings }[tab] || renderSell)();
  }
  window.addEventListener('hashchange', route);

  // ---------- Screen: first-run setup ----------
  function renderSetup() {
    view.innerHTML = `
      <div class="card stack">
        <img class="hero-mark" src="icons/logo-mark.png" alt="" width="72" height="72">
        <h1 style="text-align:center">Bienvenue chez <span class="wordmark">Cispol<span class="accent2">Store</span></span></h1>
        <p class="muted">Première utilisation : créez le compte du gérant et la zone pilote. Les données restent sur cet appareil.</p>
        <form id="setupForm" class="stack">
          <label class="field"><span>Nom de l'entreprise</span><input name="business" value="CispolStore" required></label>
          <label class="field"><span>Nom de la zone pilote</span><input name="zone" placeholder="ex. Zone Basoko" required></label>
          <label class="field"><span>Votre nom (gérant)</span><input name="name" autocomplete="name" required></label>
          <div class="grid2">
            <label class="field"><span>Code PIN (4 à 6 chiffres)</span><input name="pin" type="password" inputmode="numeric" autocomplete="new-password" required></label>
            <label class="field"><span>Confirmer le PIN</span><input name="pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
          </div>
          <button class="btn primary block big">Commencer</button>
        </form>
      </div>`;
    $('#setupForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!validPin(f.pin)) return toast('Le PIN doit contenir 4 à 6 chiffres');
      if (f.pin !== f.pin2) return toast('Les deux PIN ne correspondent pas');
      db.settings = defaultSettings();
      db.settings.businessName = f.business.trim() || 'CispolStore';
      const zone = { id: uid(), name: f.zone.trim(), active: true };
      const agent = { id: uid(), name: f.name.trim(), role: 'gerant', zoneId: zone.id, active: true };
      await setPin(agent, f.pin);
      await saveSettings(); await put('zones', zone); await put('agents', agent);
      db.zones.push(zone); db.agents.push(agent);
      session = { agentId: agent.id, at: Date.now() }; touchSession();
      location.hash = '#/vendre'; route();
    });
  }

  // ---------- Screen: login (agent + PIN) ----------
  let loginAgentId = null, pinBuffer = '';

  function renderLogin() {
    const agents = db.agents.filter(a => a.active);
    const agent = agents.find(a => a.id === loginAgentId);
    if (!agent) {
      view.innerHTML = `
        <div class="card">
          <img class="hero-mark" src="icons/logo-mark.png" alt="" width="64" height="64">
          <h1 class="wordmark" style="text-align:center">${brandHtml(db.settings.businessName)}</h1>
          <p class="muted">Qui êtes-vous ?</p>
          <div class="agents">
            ${agents.map(a => `<button class="btn agent-btn" data-agent="${a.id}">${esc(a.name)}<small>${a.role === 'gerant' ? 'Gérant' : 'Agent'} · ${esc(zoneName(a.zoneId))}</small></button>`).join('')}
          </div>
        </div>`;
      view.querySelectorAll('[data-agent]').forEach(b => b.addEventListener('click', () => { loginAgentId = b.dataset.agent; pinBuffer = ''; renderLogin(); }));
      return;
    }
    view.innerHTML = `
      <div class="card" style="text-align:center">
        <h1>${esc(agent.name)}</h1>
        <p class="muted" id="pinMsg">Entrez votre code PIN</p>
        <div class="pin-dots" id="pinDots"></div>
        <div class="keypad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-key="${n}">${n}</button>`).join('')}
          <button class="ghost" data-key="back">Retour</button>
          <button data-key="0">0</button>
          <button class="ghost" data-key="del" aria-label="Effacer">⌫</button>
        </div>
        <p><button class="btn sm" data-key="ok" id="pinOk" hidden>Valider</button></p>
      </div>`;
    const draw = () => {
      const n = Math.max(4, pinBuffer.length);
      $('#pinDots').innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pinBuffer.length ? 'on' : ''}"></i>`).join('');
      $('#pinOk').hidden = pinBuffer.length < 4;
    };
    const submit = async () => {
      const res = await checkPin(agent, pinBuffer);
      pinBuffer = '';
      if (res === 'ok') {
        session = { agentId: agent.id, at: Date.now() }; touchSession();
        loginAgentId = null;
        ui.sell.zoneId = null;
        return route();
      }
      $('#pinMsg').textContent = res === 'locked' ? 'Trop d’essais. Réessayez dans 30 secondes.' : 'PIN incorrect';
      draw();
    };
    const press = async key => {
      if (key === 'back') { loginAgentId = null; return renderLogin(); }
      if (key === 'del') pinBuffer = pinBuffer.slice(0, -1);
      else if (key === 'ok') return submit();
      else if (pinBuffer.length < 6) pinBuffer += key;
      draw();
      // Submit as soon as the agent's PIN length is reached; every attempt counts towards the lockout
      if (pinBuffer.length === (agent.pinLen || 6)) submit();
    };
    view.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => press(b.dataset.key)));
    document.onkeydown = e => {
      if (session || loginAgentId !== agent.id) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter' && pinBuffer.length >= 4) press('ok');
    };
    draw();
  }

  // ---------- Screen: sell ----------
  function zoneSelect(name, value, { allowAll = false } = {}) {
    return `<select name="${name}">${allowAll ? `<option value="">Toutes les zones</option>` : ''}
      ${activeZones().map(z => `<option value="${z.id}" ${z.id === value ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>`;
  }

  function renderSell() {
    const st = ui.sell;
    if (!st.zoneId || !activeZones().some(z => z.id === st.zoneId)) st.zoneId = me().zoneId || activeZones()[0]?.id;
    const tariffs = activeTariffs();
    if (!tariffs.some(t => t.id === st.tariffId)) st.tariffId = null;
    const mine = salesWhere({ day: today(), agentId: me().id });
    const sum = summarize(mine);
    const last = mine.slice(-5).reverse();
    const mk = mikrotikOn();
    const stock = id => stockOf(st.zoneId, id).length;

    view.innerHTML = `
      <div class="card stack">
        <div class="row between"><h1>Nouvelle vente</h1>
          ${isManager() && activeZones().length > 1 ? `<div style="min-width:160px">${zoneSelect('zone', st.zoneId)}</div>` : `<span class="muted small">📍 ${esc(zoneName(st.zoneId))}</span>`}
        </div>
        ${mk && !stockOf(st.zoneId).length ? `<p class="notice">Aucun ticket MikroTik en stock pour cette zone. ${isManager() ? 'Générez un lot dans <a href="#/tickets">Tickets</a>.' : 'Demandez au gérant de générer un lot.'} En attendant, vous pouvez saisir le code d’un ticket imprimé.</p>` : ''}
        <h3>Forfait</h3>
        <div class="tariffs">
          ${tariffs.map(t => `<button class="tariff" data-tariff="${t.id}" aria-pressed="${t.id === st.tariffId}">
            <b>${esc(t.label)}${t.student ? '<span class="tag">Étudiant</span>' : ''}</b><span class="price">${fc(t.price)}</span>
            ${mk ? `<span class="stock ${stock(t.id) ? (stock(t.id) < 10 ? 'low' : '') : 'none'}">${stock(t.id)} en stock</span>` : ''}</button>`).join('')}
        </div>
        <h3>Paiement</h3>
        <div class="seg" role="group" aria-label="Mode de paiement">
          ${Object.entries(PAYMENTS).map(([k, l]) => `<button data-pay="${k}" aria-pressed="${k === st.payment}">${l}</button>`).join('')}
        </div>
        <details ${st.manualOpen ? 'open' : ''} id="manualBox">
          <summary class="small">Vendre un ticket imprimé (saisir son code)</summary>
          <p class="small muted">${mk ? 'Saisissez le code inscrit sur le ticket : le forfait est repris automatiquement.' : 'Si vous vendez un ticket déjà généré par le routeur, saisissez son code. Sinon, un code est créé automatiquement.'}</p>
          <input id="manualCode" class="code" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ex. k7qm3xpa">
        </details>
        <button class="btn primary block big" id="sellBtn" ${st.tariffId || st.manualOpen ? '' : 'disabled'}>${sellLabel()}</button>
      </div>
      <div class="card">
        <div class="row between"><h2>Mes ventes aujourd’hui</h2><span class="status ${sum.clients >= breakEven() ? 'good' : 'warn'}">${sum.clients} client${sum.clients > 1 ? 's' : ''}</span></div>
        <div class="grid3" style="margin:8px 0 12px">
          <div class="tile"><div class="label">Cash</div><div class="value">${fc(sum.cash)}</div></div>
          <div class="tile"><div class="label">Mobile Money</div><div class="value">${fc(sum.mm)}</div></div>
          <div class="tile"><div class="label">Total</div><div class="value">${fc(sum.total)}</div></div>
        </div>
        ${last.length ? `<ul class="list-plain">${last.map(s => `<li class="row between">
          <span><span class="code">${esc(s.code)}</span> · ${esc(s.tariffLabel)}</span>
          <span class="muted small tnum">${timeOf(s.at)} · ${s.payment === 'free' ? 'Gratuit' : fc(s.price)}</span></li>`).join('')}</ul>
          <p class="small"><a href="#/rapport">Voir le rapport du jour →</a></p>` : '<p class="muted small">Aucune vente pour l’instant.</p>'}
      </div>`;

    function sellLabel() {
      const t = tariffs.find(x => x.id === st.tariffId);
      if (!t) return st.manualOpen ? 'Vendre le ticket saisi' : 'Choisissez un forfait';
      return st.payment === 'free' ? `Offrir ${t.label}` : `Encaisser ${fc(t.price)} · ${PAYMENTS[st.payment]}`;
    }
    view.querySelectorAll('[data-tariff]').forEach(b => b.addEventListener('click', () => { st.tariffId = b.dataset.tariff; renderSell(); }));
    view.querySelectorAll('[data-pay]').forEach(b => b.addEventListener('click', () => { st.payment = b.dataset.pay; renderSell(); }));
    view.querySelector('select[name=zone]')?.addEventListener('change', e => { st.zoneId = e.target.value; renderSell(); });
    // Update the button in place: re-rendering here would wipe a code typed right after opening the box
    $('#manualBox').addEventListener('toggle', e => {
      st.manualOpen = e.target.open;
      $('#sellBtn').textContent = sellLabel();
      $('#sellBtn').disabled = !st.tariffId && !st.manualOpen;
      if (st.manualOpen) $('#manualCode').focus();
    });
    $('#sellBtn').addEventListener('click', async () => {
      const manual = $('#manualCode').value.replace(/\s+/g, '');
      let t = tariffs.find(x => x.id === st.tariffId);
      let ticket = null;
      if (manual) {
        if (db.sales.some(s => s.code === manual && !s.void)) return toast('Ce code a déjà été vendu');
        ticket = db.tickets.find(x => x.code === manual);
        if (ticket) {
          if (ticket.status !== 'stock') return toast(`Ce ticket est ${TICKET_STATUS[ticket.status].toLowerCase()}`);
          if (ticket.zoneId !== st.zoneId) return toast(`Ce ticket appartient à la zone ${zoneName(ticket.zoneId)}`);
          t = db.settings.tariffs.find(x => x.id === ticket.tariffId) || t;
        } else if (!t) return toast('Code inconnu : choisissez aussi le forfait');
      } else if (!t) return;
      else if (mikrotikOn()) {
        ticket = stockOf(st.zoneId, t.id)[0];
        if (!ticket) return toast(`Plus de tickets « ${t.label} » en stock`);
      }
      $('#sellBtn').disabled = true;
      const sale = await recordSale({ tariff: t, payment: st.payment, zoneId: st.zoneId, code: manual, ticket });
      st.payment = 'cash'; st.manualOpen = false;
      renderSell();
      showVoucher(sale);
    });
  }

  function voucherText(s) {
    const ssid = db.settings.mikrotik?.ssid || `${db.settings.businessName} WiFi`;
    return `${ssid}\nCode : ${s.code}\nForfait : ${s.tariffLabel} (${fmtDuration(s.minutes)} de connexion)\n` +
      `${s.payment === 'free' ? 'Offert' : 'Prix : ' + fc(s.price)}\nVendu le ${fmtDateTime(s.at)} – ${zoneName(s.zoneId)}\n` +
      `Connectez-vous au réseau « ${ssid} » et saisissez le code.`;
  }

  function showVoucher(s) {
    openModal(`
      <h2>✅ Vente enregistrée</h2>
      <div class="voucher">
        <div class="muted small">Code d’accès</div>
        <div class="code">${esc(s.code)}</div>
        <div>${esc(s.tariffLabel)} · ${s.payment === 'free' ? 'Gratuit' : fc(s.price) + ' · ' + PAYMENTS[s.payment]}</div>
        <div class="muted small">${mikrotikOn() ? `${fmtDuration(s.minutes)} de connexion sur «\u00a0${esc(db.settings.mikrotik.ssid)}\u00a0»` : `Valable jusqu’au ${fmtDateTime(s.expires)} au plus tard`}</div>
      </div>
      <div class="grid2">
        <button class="btn" data-m="copy">📋 Copier</button>
        <button class="btn" data-m="share">📤 Envoyer</button>
      </div>
      <button class="btn primary block" style="margin-top:10px" data-m="close">Nouvelle vente</button>`);
    $('#modalBody').querySelector('[data-m=copy]').onclick = () => copyText(voucherText(s));
    $('#modalBody').querySelector('[data-m=share]').onclick = () => shareText(voucherText(s));
    $('#modalBody').querySelector('[data-m=close]').onclick = closeModal;
  }

  // ---------- Screen: daily report (Annexe B) ----------
  function dailyReport(day, zoneId) {
    const list = salesWhere({ day, zoneId });
    const sum = summarize(list);
    const incidents = db.incidents.filter(i => i.day === day && (!zoneId || i.zoneId === zoneId));
    return { list, sum, incidents };
  }

  function reportText(day, zoneId) {
    const { sum, incidents } = dailyReport(day, zoneId);
    const lines = [
      `📋 RAPPORT JOURNALIER – ${db.settings.businessName}`,
      `Date : ${fmtDay(day)}`,
      `Zone : ${zoneId ? zoneName(zoneId) : 'Toutes les zones'}`,
      `Clients : ${sum.clients}`,
      `Vouchers :`,
      ...db.settings.tariffs.filter(t => sum.byTariff[t.label]).map(t => `  • ${t.label} : ${sum.byTariff[t.label].count}`),
      `Recettes cash : ${fc(sum.cash)}`,
      `Recettes Mobile Money : ${fc(sum.mm)}`,
      `Total recettes : ${fc(sum.total)}`,
      `Vouchers gratuits : ${sum.free}`,
      `Incidents : ${incidents.length ? incidents.map(i => `${timeOf(i.at)} ${i.text}`).join(' ; ') : 'aucun'}`,
    ];
    return lines.join('\n');
  }

  function renderReport() {
    const st = ui.report;
    st.day = st.day || today();
    if (!isManager()) st.zoneId = me().zoneId;
    const { list, sum, incidents } = dailyReport(st.day, st.zoneId);
    const allToday = salesWhere({ day: st.day, zoneId: st.zoneId, includeVoid: true });
    const shown = isManager() ? allToday : allToday.filter(s => s.agentId === me().id);
    const tariffRows = db.settings.tariffs.filter(t => sum.byTariff[t.label]);

    view.innerHTML = `
      <div class="card stack">
        <h1>Rapport journalier</h1>
        <div class="grid2">
          <label class="field"><span>Date</span><input type="date" id="repDay" value="${st.day}" max="${today()}"></label>
          <label class="field"><span>Zone</span>${isManager() ? zoneSelect('repZone', st.zoneId, { allowAll: true }) : `<input value="${esc(zoneName(st.zoneId))}" disabled>`}</label>
        </div>
        <div class="table-wrap"><table>
          <tbody>
            <tr><th>Date</th><td>${fmtDay(st.day)}</td></tr>
            <tr><th>Zone</th><td>${st.zoneId ? esc(zoneName(st.zoneId)) : 'Toutes les zones'}</td></tr>
            <tr><th>Clients</th><td class="num">${sum.clients}</td></tr>
            ${tariffRows.length ? tariffRows.map(t => `<tr><th>Vouchers ${esc(t.label)}</th><td class="num">${sum.byTariff[t.label].count}${sum.byTariff[t.label].free ? ` <span class="muted small">(+${sum.byTariff[t.label].free} gratuit)</span>` : ''}</td></tr>`).join('')
              : '<tr><th>Vouchers</th><td class="num">0</td></tr>'}
            <tr><th>Recettes cash</th><td class="num">${fc(sum.cash)}</td></tr>
            <tr><th>Recettes Mobile Money</th><td class="num">${fc(sum.mm)}</td></tr>
            <tr class="total"><th>Total recettes</th><td class="num">${fc(sum.total)}</td></tr>
            <tr><th>Vouchers gratuits</th><td class="num">${sum.free}</td></tr>
            <tr><th>Incidents</th><td>${incidents.length ? `<ul class="list-plain">${incidents.map(i => `<li><span class="tnum">${timeOf(i.at)}</span> – ${esc(i.text)} <span class="muted small">(${esc(agentName(i.agentId))}${st.zoneId ? '' : ', ' + esc(zoneName(i.zoneId))})</span></li>`).join('')}</ul>` : '<span class="muted">Aucun</span>'}</td></tr>
          </tbody>
        </table></div>
        <div class="grid2">
          <button class="btn" id="repShare">📤 Envoyer (WhatsApp)</button>
          <button class="btn" id="repCopy">📋 Copier</button>
        </div>
      </div>
      <div class="card stack">
        <h2>Signaler un incident</h2>
        <form id="incForm" class="row">
          <input name="text" placeholder="ex. Coupure d’électricité 14h–15h" required style="flex:1;min-width:180px">
          <button class="btn">Ajouter</button>
        </form>
      </div>
      <div class="card">
        <h2>${isManager() ? 'Ventes du jour' : 'Mes ventes du jour'} <span class="muted small">(${shown.filter(s => !s.void).length})</span></h2>
        ${shown.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Heure</th><th>Code</th><th>Forfait</th><th>Paiement</th>${isManager() ? '<th>Agent</th>' : ''}<th class="num">Montant</th>${isManager() ? '<th></th>' : ''}</tr></thead>
          <tbody>${shown.slice().reverse().map(s => `<tr class="${s.void ? 'void' : ''}" title="${s.void ? esc('Annulée : ' + (s.voidReason || '')) : ''}">
            <td class="tnum">${timeOf(s.at)}</td><td class="code">${esc(s.code)}</td><td>${esc(s.tariffLabel)}</td><td>${PAYMENTS[s.payment]}</td>
            ${isManager() ? `<td>${esc(agentName(s.agentId))}</td>` : ''}<td class="num">${fc(s.price)}</td>
            ${isManager() ? `<td>${s.void ? '<span class="muted small">annulée</span>' : `<button class="btn sm danger" data-void="${s.id}">Annuler</button>`}</td>` : ''}
          </tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Aucune vente ce jour-là.</p>'}
      </div>`;

    $('#repDay').addEventListener('change', e => { st.day = e.target.value || today(); renderReport(); });
    view.querySelector('select[name=repZone]')?.addEventListener('change', e => { st.zoneId = e.target.value; renderReport(); });
    $('#repShare').onclick = () => shareText(reportText(st.day, st.zoneId));
    $('#repCopy').onclick = () => copyText(reportText(st.day, st.zoneId));
    $('#incForm').addEventListener('submit', async e => {
      e.preventDefault();
      const text = e.target.text.value.trim();
      if (!text) return;
      const now = new Date();
      const inc = { id: uid(), day: st.day, at: st.day === today() ? now.toISOString() : new Date(st.day + 'T12:00:00').toISOString(),
        zoneId: st.zoneId || me().zoneId || activeZones()[0]?.id, agentId: me().id, text };
      await put('incidents', inc); db.incidents.push(inc);
      toast('Incident ajouté'); renderReport();
    });
    view.querySelectorAll('[data-void]').forEach(b => b.addEventListener('click', async () => {
      const s = db.sales.find(x => x.id === b.dataset.void);
      const reason = prompt(`Annuler la vente ${s.code} (${s.tariffLabel}, ${fc(s.price)}) ?\nMotif :`);
      if (reason === null) return;
      Object.assign(s, { void: true, voidReason: reason.trim(), voidAt: new Date().toISOString(), voidBy: me().id });
      // The code may already be in the customer's hands: never put it back in stock
      const ticket = db.tickets.find(t => t.id === s.ticketId);
      if (ticket) { ticket.status = 'void'; await put('tickets', ticket); }
      await put('sales', s); toast('Vente annulée'); renderReport();
    }));
  }

  // ---------- Screen: MikroTik tickets (manager) ----------
  // RouterOS time value, e.g. 90 -> "1h30m", 4320 -> "3d"
  const rosTime = min => [[Math.floor(min / DAY), 'd'], [Math.floor(min % DAY / 60), 'h'], [min % 60, 'm']]
    .filter(([v]) => v).map(([v, u]) => v + u).join('') || '0m';
  // RouterOS mangles non-ASCII text: strip accents ("Journée" -> "Journee") before writing to the router
  const ascii = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
  const rosStr = v => '"' + ascii(v).replace(/[\\"$]/g, c => '\\' + c) + '"';
  const profileName = t => 'cispol-' + t.id.replace(/[^\w-]/g, '');

  function batches(zoneId) {
    const map = new Map();
    for (const t of db.tickets) {
      if (zoneId && t.zoneId !== zoneId) continue;
      const b = map.get(t.batchId) || { id: t.batchId, label: t.batchLabel, zoneId: t.zoneId, tariffId: t.tariffId, tariffLabel: t.tariffLabel, createdAt: t.createdAt, tickets: [] };
      b.tickets.push(t); map.set(t.batchId, b);
    }
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function createBatch(zoneId, tariff, count) {
    const now = new Date().toISOString();
    const sameDay = new Set(db.tickets.filter(t => t.createdAt.slice(0, 10) === now.slice(0, 10)).map(t => t.batchId)).size;
    const label = `L${now.slice(0, 10).replace(/-/g, '')}-${pad(sameDay + 1)}`;
    const batchId = uid(), taken = allCodes();
    const list = Array.from({ length: count }, (_, n) => ({
      id: uid() + n, n, code: newTicketCode(taken), batchId, batchLabel: label, zoneId,
      tariffId: tariff.id, tariffLabel: tariff.label, minutes: tariff.minutes, price: tariff.price,
      status: 'stock', createdAt: now, createdBy: me().id,
    }));
    await putMany('tickets', list);
    db.tickets.push(...list);
    return batches().find(b => b.id === batchId);
  }

  function rscFor(batch) {
    const t = db.settings.tariffs.find(x => x.id === batch.tariffId) || { id: batch.tariffId, rateLimit: '' };
    const prof = profileName(t);
    const lines = [
      `# ${db.settings.businessName} - tickets Hotspot MikroTik`,
      `# Lot ${batch.label} - zone ${zoneName(batch.zoneId)} - ${batch.tickets.length} tickets "${batch.tariffLabel}" (${rosTime(batch.tickets[0].minutes)} de connexion)`,
      `# Genere le ${fmtDateTime(batch.createdAt)} par CISPOLstore Gestion`,
      `# Import : glisser ce fichier dans Winbox > Files, puis dans New Terminal :`,
      `#   /import file-name=cispol-${batch.label}.rsc`,
      `# Reimporter le meme fichier ne cree pas de doublons.`,
      ``,
      `:if ([:len [/ip hotspot user profile find where name=${rosStr(prof)}]] = 0) do={ /ip hotspot user profile add name=${rosStr(prof)} }`,
      `/ip hotspot user profile set [find where name=${rosStr(prof)}] shared-users=1${t.rateLimit ? ` rate-limit=${rosStr(t.rateLimit)}` : ''}`,
      ...batch.tickets.map(k => `:do { /ip hotspot user add name=${rosStr(k.code)} password=${rosStr(k.code)} profile=${rosStr(prof)} limit-uptime=${rosTime(k.minutes)} comment=${rosStr(`CISPOL ${batch.label} ${batch.tariffLabel}`)} } on-error={}`),
      `:log info ${rosStr(`CISPOL ${batch.label} : ${batch.tickets.length} tickets importes`)}`,
      ``,
    ];
    return lines.map(l => l.startsWith('#') ? ascii(l) : l).join('\r\n');
  }

  function downloadRsc(batch) { download(`cispol-${batch.label}.rsc`, rscFor(batch), 'text/plain'); }

  function batchCsv(batch) {
    const rows = [['Code', 'Forfait', 'Durée de connexion', 'Prix (FC)', 'Zone', 'Lot', 'Statut']];
    for (const k of batch.tickets) rows.push([k.code, k.tariffLabel, fmtDuration(k.minutes), k.price, zoneName(k.zoneId), batch.label, TICKET_STATUS[k.status]]);
    download(`cispol-${batch.label}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  }

  function printTickets(list) {
    const ssid = db.settings.mikrotik.ssid;
    let box = $('#print');
    if (!box) { box = document.createElement('div'); box.id = 'print'; document.body.append(box); }
    box.innerHTML = list.map(k => `<div class="ticket">
      <div class="t-brand">${brandHtml(db.settings.businessName)}</div>
      <div class="t-code">${esc(k.code)}</div>
      <div class="t-plan">${esc(k.tariffLabel)} · ${fc(k.price)}</div>
      <div class="t-help">Wi-Fi « ${esc(ssid)} » → saisir le code</div></div>`).join('');
    window.print();
  }

  async function logoDataUrl() {
    try {
      const blob = await (await fetch('icons/logo-mark.png')).blob();
      return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch { return ''; }
  }

  function loginHtml(logo = '') {
    const s = db.settings, ssid = esc(s.mikrotik.ssid);
    const rows = activeTariffs().map(t => `<tr><td>${esc(t.label)}</td><td>${nf.format(t.price)} FC</td></tr>`).join('');
    // MikroTik substitutes $(...) variables when serving the page; keep everything inline (no internet before login)
    return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="pragma" content="no-cache"><meta http-equiv="expires" content="-1">
<title>${ssid}</title>
<style>
body{margin:0;font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f4f5f7;color:#14171c}
main{max-width:420px;margin:0 auto;padding:24px 16px}
.card{background:#fff;border:1px solid #dde1e7;border-radius:16px;padding:20px;margin-bottom:14px}
h1{margin:0 0 4px;font-size:1.5rem;font-weight:800;color:#1e435e;text-align:center}h1 span{color:#d85833}p{margin:0 0 14px;color:#4d5562}
.logo{display:block;margin:0 auto 6px}
.card:first-child{border-top:4px solid #d85833}
input{width:100%;box-sizing:border-box;font:inherit;font-size:1.3rem;letter-spacing:.08em;text-align:center;padding:12px;border:1px solid #c9ced6;border-radius:12px;margin-bottom:12px}
button{width:100%;font:inherit;font-weight:700;padding:14px;border:0;border-radius:12px;background:#1e435e;color:#fff}
input:focus{outline:2px solid #d85833;border-color:#d85833}
.err{background:#fbe5e5;color:#b42323;border-radius:10px;padding:10px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:.95rem}td{padding:6px 0;border-bottom:1px solid #eef1f5}td+td{text-align:right;font-weight:600}
small{display:block;text-align:center;color:#7a8290;margin-top:8px}
</style></head><body>
$(if chap-id)
<form name="sendin" action="$(link-login-only)" method="post" style="display:none">
<input type="hidden" name="username"><input type="hidden" name="password">
<input type="hidden" name="dst" value="$(link-orig)"><input type="hidden" name="popup" value="true">
</form>
<script src="/md5.js"></script>
$(endif)
<main>
<div class="card">
${logo ? `<img class="logo" src="${logo}" alt="" width="72" height="72">` : ''}
<h1>${brandHtml(s.businessName)}</h1>
<p>Bienvenue sur le Wi-Fi « ${ssid} ». Saisissez le code de votre ticket.</p>
$(if error)<div class="err">$(error)</div>$(endif)
<form name="login" action="$(link-login-only)" method="post" onsubmit="return go()">
<input type="hidden" name="dst" value="$(link-orig)"><input type="hidden" name="popup" value="true">
<input type="hidden" name="password">
<input name="username" value="$(username)" placeholder="Code du ticket" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" required>
<button type="submit">Se connecter</button>
</form>
</div>
<div class="card"><p><b>Nos forfaits</b> (temps de connexion)</p><table>${rows}</table>
<small>Tickets en vente auprès de nos agents · Cash ou Mobile Money</small></div>
</main>
<script>
function go(){
  var f=document.login, c=f.username.value.replace(/\\s+/g,'');
  f.username.value=c; f.password.value=c;
  $(if chap-id)
  document.sendin.username.value=c;
  document.sendin.password.value=hexMD5('$(chap-id)'+c+'$(chap-challenge)');
  document.sendin.submit(); return false;
  $(endif)
  return true;
}
</script>
</body></html>
`;
  }

  function renderTickets() {
    const st = ui.tickets;
    const mk = db.settings.mikrotik;
    if (st.zoneId && !activeZones().some(z => z.id === st.zoneId)) st.zoneId = '';
    const zoneId = st.zoneId || (activeZones().length === 1 ? activeZones()[0].id : '');
    const list = db.tickets.filter(t => !zoneId || t.zoneId === zoneId);
    const count = (tid, status) => list.filter(t => t.tariffId === tid && t.status === status).length;
    const shownTariffs = db.settings.tariffs.filter(t => t.active || list.some(k => k.tariffId === t.id));
    const bs = batches(zoneId);

    view.innerHTML = `
      <div class="card stack">
        <h1>Tickets MikroTik</h1>
        <label class="row small" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" id="mkOn" ${mk.enabled ? 'checked' : ''} style="width:auto"> Vendre uniquement des tickets créés dans le routeur (stock)</label>
        <form id="mkForm" class="row">
          <label class="field" style="flex:1;min-width:180px"><span>Nom du réseau Wi-Fi (SSID)</span><input name="ssid" value="${esc(mk.ssid)}" required></label>
          <button class="btn" style="align-self:flex-end">Enregistrer</button>
        </form>
        ${activeZones().length > 1 ? `<label class="field"><span>Zone</span>${zoneSelect('tkZone', st.zoneId, { allowAll: true })}</label>` : ''}
      </div>

      <div class="card">
        <h2>Stock${zoneId ? ' · ' + esc(zoneName(zoneId)) : ''}</h2>
        <div class="table-wrap"><table><thead><tr><th>Forfait</th><th class="num">En stock</th><th class="num">Vendus</th><th class="num">Annulés</th></tr></thead><tbody>
          ${shownTariffs.map(t => { const n = count(t.id, 'stock'); return `<tr><td>${esc(t.label)}</td>
            <td class="num">${n ? n : ''} ${n < 10 ? `<span class="status ${n ? 'warn' : 'bad'}">${n ? 'Bas' : 'Vide'}</span>` : ''}</td>
            <td class="num">${count(t.id, 'sold')}</td><td class="num">${count(t.id, 'void')}</td></tr>`; }).join('')}
        </tbody></table></div>
      </div>

      <form class="card stack" id="batchForm">
        <h2>Générer un lot</h2>
        <div class="grid3">
          ${activeZones().length > 1 ? `<label class="field"><span>Zone</span>${zoneSelect('zoneId', zoneId || me().zoneId)}</label>` : ''}
          <label class="field"><span>Forfait</span><select name="tariffId">${activeTariffs().map(t => `<option value="${t.id}">${esc(t.label)} – ${fc(t.price)}</option>`).join('')}</select></label>
          <label class="field"><span>Quantité</span><input name="count" type="number" min="1" max="${MAX_BATCH}" value="50" required></label>
        </div>
        <button class="btn primary">Générer et télécharger le script MikroTik</button>
        <details><summary class="small">Comment importer le script dans le MikroTik ?</summary>
          <ol class="small">
            <li>Ouvrez <b>Winbox</b> (ou l’appli MikroTik Pro sur téléphone) et connectez-vous au routeur.</li>
            <li>Menu <b>Files</b> : glissez-y le fichier <span class="code">cispol-…rsc</span> téléchargé.</li>
            <li>Menu <b>New Terminal</b> : tapez <span class="code">/import file-name=cispol-…rsc</span> (avec le vrai nom du fichier) puis Entrée.</li>
            <li>Vérifiez dans <b>IP → Hotspot → Users</b> que les tickets apparaissent.</li>
          </ol>
          <p class="small muted">Chaque ticket : 1 appareil à la fois, temps décompté seulement pendant la connexion. Les tickets sont valables dès l’import : gardez les tickets imprimés en lieu sûr.</p>
        </details>
      </form>

      <div class="card stack">
        <h2>Page de connexion du Wi-Fi</h2>
        <p class="small muted">Page aux couleurs de ${esc(db.settings.businessName)} avec vos tarifs, que le client voit en se connectant. À mettre dans le routeur à la place de <span class="code">hotspot/login.html</span> (menu Files). Retéléchargez-la après un changement de prix.</p>
        <button class="btn" id="dlLogin">⬇️ Télécharger login.html</button>
      </div>

      <div class="card">
        <h2>Lots générés</h2>
        ${bs.length ? `<ul class="list-plain">${bs.map(b => { const left = b.tickets.filter(k => k.status === 'stock').length; return `<li class="stack">
          <div class="row between"><span><b>${esc(b.label)}</b> · ${esc(b.tariffLabel)} · ${b.tickets.length} tickets</span><span class="muted small">${fmtDateTime(b.createdAt)}${zoneId ? '' : ' · ' + esc(zoneName(b.zoneId))}</span></div>
          <div class="small muted">${left} en stock · ${b.tickets.length - left} vendus ou annulés</div>
          <div class="row"><button class="btn sm" data-rsc="${b.id}">Script MikroTik</button><button class="btn sm" data-print="${b.id}">🖨️ Imprimer</button><button class="btn sm" data-csv="${b.id}">CSV</button></div></li>`; }).join('')}</ul>`
          : '<p class="muted small">Aucun lot pour l’instant.</p>'}
      </div>`;

    const byId = id => batches().find(b => b.id === id);
    $('#mkOn').onchange = async e => { mk.enabled = e.target.checked; await saveSettings(); toast(mk.enabled ? 'Ventes depuis le stock activées' : 'Codes libres autorisés'); };
    $('#mkForm').addEventListener('submit', async e => { e.preventDefault(); mk.ssid = e.target.ssid.value.trim() || mk.ssid; await saveSettings(); toast('Enregistré'); renderTickets(); });
    view.querySelector('select[name=tkZone]')?.addEventListener('change', e => { st.zoneId = e.target.value; renderTickets(); });
    $('#batchForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const tariff = db.settings.tariffs.find(t => t.id === f.get('tariffId'));
      const n = Math.floor(+f.get('count'));
      if (!tariff || !(n >= 1 && n <= MAX_BATCH)) return toast(`Quantité entre 1 et ${MAX_BATCH}`);
      const batch = await createBatch(f.get('zoneId') || zoneId || me().zoneId || activeZones()[0].id, tariff, n);
      downloadRsc(batch);
      toast(`Lot ${batch.label} : ${n} tickets créés`);
      renderTickets();
    });
    $('#dlLogin').onclick = async () => download('login.html', loginHtml(await logoDataUrl()), 'text/html');
    view.querySelectorAll('[data-rsc]').forEach(b => b.onclick = () => downloadRsc(byId(b.dataset.rsc)));
    view.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => batchCsv(byId(b.dataset.csv)));
    view.querySelectorAll('[data-print]').forEach(b => b.onclick = () => {
      const left = byId(b.dataset.print).tickets.filter(k => k.status === 'stock');
      if (!left.length) return toast('Plus aucun ticket en stock dans ce lot');
      printTickets(left);
    });
  }

  // ---------- Screen: dashboard (manager) ----------
  function renderDashboard() {
    const st = ui.dash;
    st.month = st.month || monthKey(new Date());
    const zones = st.zoneId ? 1 : Math.max(1, activeZones().length);
    const monthSales = salesWhere({ month: st.month, zoneId: st.zoneId });
    const m = summarize(monthSales);
    const t = summarize(salesWhere({ day: today(), zoneId: st.zoneId }));
    const isCurrent = st.month === monthKey(new Date());
    const nDays = daysInMonth(st.month);
    const elapsed = isCurrent ? new Date().getDate() : (st.month < monthKey(new Date()) ? nDays : 0);
    const seuil = breakEven() * zones;
    const target = targetFor(st.month);
    const charges = monthlyCharges() * zones;
    const avgClients = elapsed ? m.clients / elapsed : 0;
    const basket = m.clients ? m.total / m.clients : 0;
    const status = (v, goal) => v >= goal ? ['good', '✓ Atteint'] : v >= goal * 0.8 ? ['warn', '▲ Proche'] : ['bad', '▼ En dessous'];
    const [tCls, tTxt] = status(t.clients, seuil);
    const [aCls, aTxt] = status(avgClients, target ?? seuil);

    // Daily series for the chart
    const perDay = Array.from({ length: nDays }, (_, i) => {
      const key = `${st.month}-${pad(i + 1)}`;
      return { key, day: i + 1, clients: monthSales.filter(s => s.day === key && s.payment !== 'free').length };
    });

    const byAgent = {};
    for (const s of monthSales) {
      const a = byAgent[s.agentId] || (byAgent[s.agentId] = { n: 0, total: 0 });
      if (s.payment !== 'free') { a.n++; a.total += s.price; }
    }

    view.innerHTML = `
      <div class="card stack">
        <div class="row between">
          <h1>Tableau de bord</h1>
          <div class="row">
            <button class="btn sm" data-month="-1" aria-label="Mois précédent">◀</button>
            <strong style="text-transform:capitalize">${fmtMonth(st.month)}</strong>
            <button class="btn sm" data-month="1" aria-label="Mois suivant" ${isCurrent ? 'disabled' : ''}>▶</button>
          </div>
        </div>
        ${activeZones().length > 1 ? `<label class="field"><span>Zone</span>${zoneSelect('dashZone', st.zoneId, { allowAll: true })}</label>` : ''}
      </div>

      ${isCurrent ? `<h2>Aujourd’hui</h2>
      <div class="grid2" style="margin-bottom:14px">
        <div class="tile"><div class="label">Clients payants</div><div class="value">${t.clients} <span class="muted small">/ ${seuil}</span></div>
          <div class="sub"><span class="status ${tCls}">${tTxt}</span> seuil de rentabilité</div></div>
        <div class="tile"><div class="label">Recettes du jour</div><div class="value">${fc(t.total)}</div>
          <div class="sub">Cash ${fc(t.cash)} · MM ${fc(t.mm)}</div></div>
      </div>` : ''}

      <h2>Le mois</h2>
      <div class="grid2" style="margin-bottom:14px">
        <div class="tile"><div class="label">Chiffre d’affaires</div><div class="value">${fc(m.total)}</div><div class="sub">${usd(m.total / db.settings.rate)}</div></div>
        <div class="tile"><div class="label">Résultat (CA − charges)</div><div class="value" style="color:var(${m.total - charges >= 0 ? '--good' : '--bad'})">${m.total - charges >= 0 ? '+' : ''}${fc(m.total - charges)}</div><div class="sub">Charges ${fc(charges)}</div></div>
        <div class="tile"><div class="label">Clients / jour (moyenne)</div><div class="value">${avgClients.toFixed(1).replace('.', ',')}</div>
          <div class="sub">${target != null ? `Objectif ${target}/j` : `Seuil ${seuil}/j`} <span class="status ${aCls}">${aTxt}</span></div></div>
        <div class="tile"><div class="label">Panier moyen</div><div class="value">${fc(basket)}</div><div class="sub">Hypothèse du plan : ${fc(db.settings.avgBasket)}</div></div>
      </div>

      <div class="card">
        <h2>Clients payants par jour</h2>
        <p class="small muted" style="margin-top:-4px">Lignes : seuil de rentabilité (${seuil}/j)${target != null && zones === 1 ? ` et objectif du mois ${monthsBetween(db.settings.launchMonth, st.month) + 1} (${target}/j)` : ''}.</p>
        <div class="chart" id="chart"></div>
        <details style="margin-top:8px"><summary class="small">Voir en tableau</summary>
          <div class="table-wrap"><table><thead><tr><th>Jour</th><th class="num">Clients</th></tr></thead>
          <tbody>${perDay.filter(d => d.clients).map(d => `<tr><td>${d.day}</td><td class="num">${d.clients}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Aucune vente</td></tr>'}</tbody></table></div>
        </details>
      </div>

      <div class="card">
        <h2>Par forfait</h2>
        <div class="table-wrap"><table><thead><tr><th>Forfait</th><th class="num">Vendus</th><th class="num">Gratuits</th><th class="num">Recettes</th></tr></thead><tbody>
          ${db.settings.tariffs.filter(x => m.byTariff[x.label]).map(x => `<tr><td>${esc(x.label)}</td><td class="num">${m.byTariff[x.label].count}</td><td class="num">${m.byTariff[x.label].free}</td><td class="num">${fc(m.byTariff[x.label].amount)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune vente</td></tr>'}
          <tr class="total"><td>Total</td><td class="num">${m.clients}</td><td class="num">${m.free}</td><td class="num">${fc(m.total)}</td></tr>
        </tbody></table></div>
        <p class="small muted">Cash ${fc(m.cash)} · Mobile Money ${fc(m.mm)}</p>
      </div>

      <div class="card">
        <h2>Par agent</h2>
        <div class="table-wrap"><table><thead><tr><th>Agent</th><th class="num">Clients</th><th class="num">Recettes</th></tr></thead><tbody>
          ${Object.entries(byAgent).sort((a, b) => b[1].total - a[1].total).map(([id, a]) => `<tr><td>${esc(agentName(id))}</td><td class="num">${a.n}</td><td class="num">${fc(a.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucune vente</td></tr>'}
        </tbody></table></div>
      </div>`;

    const redraw = () => drawChart($('#chart'), perDay, seuil, zones === 1 ? target : null, elapsed);
    redraw();
    window.onresize = () => { if ($('#chart')) redraw(); };
    view.querySelectorAll('[data-month]').forEach(b => b.addEventListener('click', () => { st.month = shiftMonth(st.month, +b.dataset.month); renderDashboard(); }));
    view.querySelector('select[name=dashZone]')?.addEventListener('change', e => { st.zoneId = e.target.value; renderDashboard(); });
  }

  function drawChart(el, data, seuil, target, elapsed) {
    // Drawn at the container's real pixel width so labels stay legible on phones
    const W = Math.max(280, Math.round(el.clientWidth || 320)), H = 200, L = 30, R = 8, T = 16, B = 22;
    const max = Math.max(10, seuil, target || 0, ...data.map(d => d.clients)) * 1.1;
    const y = v => T + (H - T - B) * (1 - v / max);
    const bw = (W - L - R) / data.length;
    const step = max > 150 ? 50 : max > 60 ? 20 : 10;
    const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
    const barW = Math.max(2, bw - 2);
    const bar = (d, i) => {
      if (!d.clients) return '';
      const x = L + i * bw + 1, top = y(d.clients), h = H - B - top, r = Math.min(4, barW / 2, h);
      // Rounded at the data end only, square on the baseline
      return `<path class="bar" d="M${x},${H - B} V${top + r} q0,-${r} ${r},-${r} H${x + barW - r} q${r},0 ${r},${r} V${H - B} Z"/>`;
    };
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Clients payants par jour">
      ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      ${data.map(bar).join('')}
      ${data.map((d, i) => (d.day === 1 || d.day % 5 === 0) ? `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${d.day}</text>` : '').join('')}
      <line class="ref" x1="${L}" x2="${W - R}" y1="${y(seuil)}" y2="${y(seuil)}"/>
      <text class="reflabel" x="${W - R}" y="${y(seuil) - 5}" text-anchor="end">Seuil ${seuil}</text>
      ${target != null && target !== seuil ? `<line class="ref target" x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}"/>
      <text class="reflabel target" x="${L + 4}" y="${y(target) - 5}">Objectif ${target}</text>` : ''}
      ${data.map((d, i) => `<rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}"/>`).join('')}
    </svg><div class="tooltip" hidden></div>`;
    const tip = el.querySelector('.tooltip');
    const svg = el.querySelector('svg');
    const show = e => {
      const r = e.target.closest('.hit'); if (!r) return;
      const d = data[+r.dataset.i];
      const box = svg.getBoundingClientRect(), k = box.width / W;
      tip.hidden = false;
      tip.textContent = `${d.day} ${fmtMonth(d.key.slice(0, 7))} : ${d.clients} client${d.clients > 1 ? 's' : ''}${d.day > elapsed ? ' (à venir)' : ''}`;
      tip.style.left = Math.min(Math.max((L + (+r.dataset.i + 0.5) * bw) * k, 70), box.width - 70) + 'px';
      tip.style.top = (y(Math.max(d.clients, 0)) * k) + 'px';
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  }

  // ---------- Screen: settings (manager) ----------
  function renderSettings() {
    const s = db.settings;
    view.innerHTML = `
      <div class="card stack">
        <h1>Réglages</h1>
        <p class="small muted">Données enregistrées sur cet appareil uniquement. Faites une sauvegarde régulière (en bas de page).</p>
      </div>

      <div class="card stack">
        <div class="row between"><h2>Agents</h2><button class="btn sm primary" id="addAgent">+ Agent</button></div>
        <div class="table-wrap"><table><thead><tr><th>Nom</th><th>Rôle</th><th>Zone</th><th></th></tr></thead><tbody>
          ${db.agents.map(a => `<tr class="${a.active ? '' : 'void'}"><td>${esc(a.name)}</td><td>${a.role === 'gerant' ? 'Gérant' : 'Agent'}</td><td>${esc(zoneName(a.zoneId))}</td>
            <td class="num"><button class="btn sm" data-edit-agent="${a.id}">Modifier</button></td></tr>`).join('')}
        </tbody></table></div>
      </div>

      <div class="card stack">
        <div class="row between"><h2>Zones Wi-Fi</h2><button class="btn sm primary" id="addZone">+ Zone</button></div>
        <ul class="list-plain">${db.zones.map(z => `<li class="row between"><span class="${z.active ? '' : 'muted'}">${esc(z.name)}${z.active ? '' : ' (fermée)'}</span>
          <span class="row"><button class="btn sm" data-rename-zone="${z.id}">Renommer</button><button class="btn sm" data-toggle-zone="${z.id}">${z.active ? 'Fermer' : 'Rouvrir'}</button></span></li>`).join('')}</ul>
      </div>

      <form class="card stack" id="tariffForm">
        <h2>Grille tarifaire</h2>
        <p class="small muted">Les prix sont des hypothèses de lancement (§4.2) : ajustez-les selon le marché. Les ventes passées gardent leur prix. Débit max (envoi/réception, ex. <span class="code">1M/2M</span>) : appliqué aux prochains lots de tickets MikroTik.</p>
        <div class="table-wrap"><table><thead><tr><th>Actif</th><th>Forfait</th><th>Durée (min)</th><th class="num">Prix (FC)</th><th>Débit max</th></tr></thead><tbody>
          ${s.tariffs.map((t, i) => `<tr><td><input type="checkbox" name="active${i}" ${t.active ? 'checked' : ''} style="width:auto"></td>
            <td><input name="label${i}" value="${esc(t.label)}" required></td>
            <td><input name="minutes${i}" type="number" min="1" value="${t.minutes}" required style="width:100px"></td>
            <td><input name="price${i}" type="number" min="0" step="50" value="${t.price}" required style="width:110px;text-align:right"></td>
            <td><input name="rate${i}" value="${esc(t.rateLimit || '')}" placeholder="ex. 2M/2M" pattern="[0-9]+[kM]?/[0-9]+[kM]?" style="width:110px"></td></tr>`).join('')}
        </tbody></table></div>
        <div class="row"><button class="btn primary">Enregistrer les tarifs</button><button type="button" class="btn sm" id="addTariff">+ Forfait</button></div>
      </form>

      <form class="card stack" id="planForm">
        <h2>Hypothèses du business plan</h2>
        <div class="grid2">
          <label class="field"><span>Nom de l'entreprise</span><input name="businessName" value="${esc(s.businessName)}" required></label>
          <label class="field"><span>Taux (FC pour 1 $)</span><input name="rate" type="number" min="1" value="${s.rate}" required></label>
          <label class="field"><span>Panier moyen prévu (FC)</span><input name="avgBasket" type="number" min="1" value="${s.avgBasket}" required></label>
          <label class="field"><span>Mois de lancement (mois 1)</span><input name="launchMonth" type="month" value="${s.launchMonth}" required></label>
        </div>
        <label class="field"><span>Objectifs clients/jour, mois 1 à 12 (séparés par des virgules)</span><input name="targets" value="${s.targets.join(', ')}" required></label>
        <h3>Charges mensuelles par zone (FC)</h3>
        <div class="grid2">${s.charges.map((c, i) => `<label class="field"><span>${esc(c.label)}</span><input name="charge${i}" type="number" min="0" step="1000" value="${c.amount}"></label>`).join('')}</div>
        <p class="small muted">Total : <strong>${fc(monthlyCharges())}</strong> (${usd(monthlyCharges() / s.rate)}) → seuil de rentabilité : <strong>${breakEven()} clients/jour</strong> par zone.</p>
        <button class="btn primary">Enregistrer</button>
      </form>

      <div class="card stack">
        <h2>Données</h2>
        <div class="grid2">
          <button class="btn" id="expSales">⬇️ Ventes (CSV / Excel)</button>
          <button class="btn" id="expDaily">⬇️ Rapports journaliers (CSV)</button>
          <button class="btn" id="expBackup">💾 Sauvegarde complète</button>
          <label class="btn" style="cursor:pointer">♻️ Restaurer<input type="file" id="impBackup" accept=".json,application/json" hidden></label>
        </div>
        <p class="small muted">${db.sales.length} vente(s) enregistrée(s). La sauvegarde (.json) permet de transférer les données sur un autre téléphone.</p>
        <button class="btn danger sm" id="wipe">Tout effacer…</button>
      </div>
      <p class="small muted" style="text-align:center">CISPOLstore Gestion · v1.0</p>`;

    $('#addAgent').onclick = () => editAgent(null);
    view.querySelectorAll('[data-edit-agent]').forEach(b => b.onclick = () => editAgent(b.dataset.editAgent));
    $('#addZone').onclick = async () => {
      const name = prompt('Nom de la nouvelle zone :');
      if (!name?.trim()) return;
      const z = { id: uid(), name: name.trim(), active: true };
      await put('zones', z); db.zones.push(z); renderSettings();
    };
    view.querySelectorAll('[data-rename-zone]').forEach(b => b.onclick = async () => {
      const z = db.zones.find(x => x.id === b.dataset.renameZone);
      const name = prompt('Nouveau nom :', z.name);
      if (!name?.trim()) return;
      z.name = name.trim(); await put('zones', z); renderSettings();
    });
    view.querySelectorAll('[data-toggle-zone]').forEach(b => b.onclick = async () => {
      const z = db.zones.find(x => x.id === b.dataset.toggleZone);
      if (z.active && activeZones().length === 1) return toast('Il faut au moins une zone ouverte');
      z.active = !z.active; await put('zones', z); renderSettings();
    });

    $('#addTariff').onclick = async () => {
      s.tariffs.push({ id: uid(), label: 'Nouveau forfait', minutes: 60, price: 500, student: false, active: false });
      await saveSettings(); renderSettings();
    };
    $('#tariffForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      s.tariffs.forEach((t, i) => {
        t.active = f.has('active' + i);
        t.label = String(f.get('label' + i)).trim() || t.label;
        t.minutes = Math.max(1, +f.get('minutes' + i) || t.minutes);
        t.price = Math.max(0, +f.get('price' + i) || 0);
        t.rateLimit = String(f.get('rate' + i) || '').trim();
      });
      await saveSettings(); toast('Tarifs enregistrés'); renderSettings();
    });

    $('#planForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const targets = String(f.get('targets')).split(/[,;\s]+/).map(Number).filter(n => n > 0);
      if (!targets.length) return toast('Objectifs invalides');
      Object.assign(s, {
        businessName: String(f.get('businessName')).trim() || s.businessName,
        rate: +f.get('rate') || s.rate, avgBasket: +f.get('avgBasket') || s.avgBasket,
        launchMonth: f.get('launchMonth') || s.launchMonth, targets,
      });
      s.charges.forEach((c, i) => { c.amount = Math.max(0, +f.get('charge' + i) || 0); });
      await saveSettings(); toast('Hypothèses enregistrées'); route();
    });

    $('#expSales').onclick = exportSalesCsv;
    $('#expDaily').onclick = exportDailyCsv;
    $('#expBackup').onclick = () => download(`cispolstore-sauvegarde-${today()}.json`,
      JSON.stringify({ app: 'cispolstore-gestion', version: 2, exportedAt: new Date().toISOString(), settings: db.settings, agents: db.agents, zones: db.zones, sales: db.sales, incidents: db.incidents, tickets: db.tickets }, null, 1),
      'application/json');
    $('#impBackup').onchange = e => e.target.files[0] && restoreBackup(e.target.files[0]);
    $('#wipe').onclick = async () => {
      if (prompt('Toutes les données de cet appareil seront supprimées.\nTapez EFFACER pour confirmer :') !== 'EFFACER') return;
      await Promise.all(STORES.map(clearStore));
      Object.assign(db, { settings: null, agents: [], zones: [], sales: [], incidents: [], tickets: [] });
      lock();
    };
  }

  function editAgent(id) {
    const a = db.agents.find(x => x.id === id);
    const isNew = !a;
    openModal(`
      <form id="agentForm" class="stack">
        <h2>${isNew ? 'Nouvel agent' : 'Modifier ' + esc(a.name)}</h2>
        <label class="field"><span>Nom</span><input name="name" value="${esc(a?.name || '')}" required></label>
        <div class="grid2">
          <label class="field"><span>Rôle</span><select name="role">
            <option value="agent" ${a?.role !== 'gerant' ? 'selected' : ''}>Agent (ventes)</option>
            <option value="gerant" ${a?.role === 'gerant' ? 'selected' : ''}>Gérant (tout)</option></select></label>
          <label class="field"><span>Zone</span>${zoneSelect('zoneId', a?.zoneId)}</label>
        </div>
        <label class="field"><span>${isNew ? 'Code PIN (4 à 6 chiffres)' : 'Nouveau PIN (laisser vide pour ne pas changer)'}</span>
          <input name="pin" type="password" inputmode="numeric" autocomplete="new-password" ${isNew ? 'required' : ''}></label>
        ${!isNew ? `<label class="row small"><input type="checkbox" name="active" ${a.active ? 'checked' : ''} style="width:auto"> Compte actif</label>` : ''}
        <div class="grid2"><button type="button" class="btn" data-m="cancel">Annuler</button><button class="btn primary">Enregistrer</button></div>
      </form>`);
    $('#modalBody').querySelector('[data-m=cancel]').onclick = closeModal;
    $('#agentForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if ((isNew || f.pin) && !validPin(f.pin)) return toast('Le PIN doit contenir 4 à 6 chiffres');
      const agent = a || { id: uid(), active: true };
      const active = isNew ? true : f.active === 'on';
      const managersLeft = db.agents.filter(x => x.id !== agent.id && x.role === 'gerant' && x.active).length;
      if ((f.role !== 'gerant' || !active) && agent.role === 'gerant' && !managersLeft) return toast('Il faut garder au moins un gérant actif');
      Object.assign(agent, { name: f.name.trim(), role: f.role, zoneId: f.zoneId, active });
      if (f.pin) await setPin(agent, f.pin);
      await put('agents', agent);
      if (isNew) db.agents.push(agent);
      closeModal(); toast('Agent enregistré');
      if (agent.id === session.agentId && (!active || agent.role !== 'gerant')) return lock();
      route();
    });
  }

  // ---------- Export / import ----------
  const csvCell = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // ';' separator + BOM so French-locale Excel opens the file directly with accents intact
  const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');

  function exportSalesCsv() {
    const rows = [['Date', 'Heure', 'Zone', 'Agent', 'Code', 'Forfait', 'Durée (min)', 'Paiement', 'Montant (FC)', 'Expiration', 'Statut', 'Motif annulation']];
    for (const s of db.sales) rows.push([s.day, timeOf(s.at), zoneName(s.zoneId), agentName(s.agentId), s.code, s.tariffLabel, s.minutes,
      PAYMENTS[s.payment], s.price, fmtDateTime(s.expires), s.void ? 'Annulée' : 'Valide', s.voidReason || '']);
    download(`cispolstore-ventes-${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  }

  function exportDailyCsv() {
    const labels = db.settings.tariffs.map(t => t.label);
    const rows = [['Date', 'Zone', 'Clients', ...labels.map(l => 'Vouchers ' + l), 'Recettes cash', 'Recettes Mobile Money', 'Total recettes', 'Vouchers gratuits', 'Incidents']];
    const keys = new Set(db.sales.filter(s => !s.void).map(s => s.day + '|' + s.zoneId));
    db.incidents.forEach(i => keys.add(i.day + '|' + i.zoneId));
    for (const k of [...keys].sort()) {
      const [day, zoneId] = k.split('|');
      const { sum, incidents } = dailyReport(day, zoneId);
      rows.push([day, zoneName(zoneId), sum.clients, ...labels.map(l => sum.byTariff[l]?.count || 0), sum.cash, sum.mm, sum.total, sum.free, incidents.map(i => i.text).join(' / ')]);
    }
    download(`cispolstore-rapports-${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  }

  async function restoreBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast('Fichier illisible'); }
    if (data.app !== 'cispolstore-gestion' || !data.settings || !Array.isArray(data.agents)) return toast('Ce fichier n’est pas une sauvegarde CISPOLstore');
    if (!confirm(`Remplacer les données de cet appareil par la sauvegarde du ${fmtDateTime(data.exportedAt)} (${data.sales.length} ventes) ?`)) return;
    await Promise.all(STORES.map(clearStore));
    await put('meta', data.settings);
    for (const k of ['agents', 'zones', 'sales', 'incidents', 'tickets']) await putMany(k, data[k] || []);
    await loadAll();
    toast('Sauvegarde restaurée');
    lock();
  }

  // ---------- User menu ----------
  $('#userChip').addEventListener('click', () => {
    openModal(`
      <h2>${esc(me().name)}</h2>
      <p class="muted small">${me().role === 'gerant' ? 'Gérant' : 'Agent'} · ${esc(zoneName(me().zoneId))}</p>
      <div class="stack">
        <button class="btn block" data-m="pin">🔑 Changer mon PIN</button>
        <button class="btn block primary" data-m="lock">🔒 Verrouiller / changer d’agent</button>
        <button class="btn block" data-m="close">Fermer</button>
      </div>`);
    const body = $('#modalBody');
    body.querySelector('[data-m=lock]').onclick = lock;
    body.querySelector('[data-m=close]').onclick = closeModal;
    body.querySelector('[data-m=pin]').onclick = () => {
      openModal(`<form id="pinForm" class="stack"><h2>Changer mon PIN</h2>
        <label class="field"><span>PIN actuel</span><input name="old" type="password" inputmode="numeric" required></label>
        <label class="field"><span>Nouveau PIN (4 à 6 chiffres)</span><input name="pin" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <label class="field"><span>Confirmer</span><input name="pin2" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <div class="grid2"><button type="button" class="btn" data-m="cancel">Annuler</button><button class="btn primary">Enregistrer</button></div></form>`);
      $('#modalBody').querySelector('[data-m=cancel]').onclick = closeModal;
      $('#pinForm').addEventListener('submit', async e => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.target));
        const res = await checkPin(me(), f.old);
        if (res !== 'ok') return toast(res === 'locked' ? 'Trop d’essais, patientez 30 s' : 'PIN actuel incorrect');
        if (!validPin(f.pin)) return toast('Le PIN doit contenir 4 à 6 chiffres');
        if (f.pin !== f.pin2) return toast('Les deux PIN ne correspondent pas');
        await setPin(me(), f.pin); await put('agents', me());
        closeModal(); toast('PIN modifié');
      });
    };
  });

  // ---------- Boot ----------
  (async () => {
    try {
      idb = await openDb();
      await loadAll();
    } catch (e) {
      view.innerHTML = `<div class="card"><h1>Stockage indisponible</h1><p>Ce navigateur bloque l’enregistrement des données (navigation privée ?). Ouvrez l’application dans un navigateur normal.</p><p class="small muted">${esc(e.message || e)}</p></div>`;
      return;
    }
    if (db.agents.length && !db.settings) db.settings = defaultSettings();
    if (db.settings && !db.settings.mikrotik) { // data created by v1
      db.settings.mikrotik = { ...DEFAULT_MIKROTIK };
      db.settings.tariffs.forEach(t => { t.rateLimit = t.rateLimit || ''; });
      await saveSettings();
    }
    restoreSession();
    route();
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
