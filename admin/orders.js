/* CHUWU (初·五) — Orders screen (/admin/orders.html). Lists the orders saved by checkout
   (netlify/functions/place-order.mjs) and lets you move each one through
   Awaiting payment → Paid → Shipped → Completed (or Cancelled), keep a private note, message the
   customer on WhatsApp, and export everything to CSV.

   Login uses the same Netlify Identity account as the content editor; the account also needs the
   "admin" role (Netlify → Identity → your user → Edit settings → Roles). */
(function () {
  const API = '/.netlify/functions/orders';
  const STATUSES = [
    { key: 'awaiting_payment', label: 'Awaiting payment' },
    { key: 'paid', label: 'Paid · to ship' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' }
  ];
  const LABEL = Object.fromEntries(STATUSES.map(s => [s.key, s.label]));
  const NEXT = { awaiting_payment: ['paid', 'Mark as paid'], paid: ['shipped', 'Mark as shipped'], shipped: ['completed', 'Mark as completed'] };

  let orders = [];
  let filter = 'all';
  let query = '';
  const openIds = new Set();
  let settings = {};

  const $ = id => document.getElementById(id);
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'onclick') n.addEventListener('click', v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (children || []).forEach(c => c != null && n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c));
    return n;
  }
  const money = n => 'S$' + (Number(n) || 0).toFixed(2);
  const fmtDate = iso => new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.add('hidden'), 2400);
  }

  // ---------------------------------------------------------------- API
  async function token() {
    const user = window.netlifyIdentity && netlifyIdentity.currentUser();
    if (!user) throw Object.assign(new Error('Not logged in'), { status: 401 });
    return user.jwt();
  }

  async function api(method, body, qs) {
    const res = await fetch(API + (qs || ''), {
      method,
      headers: { Authorization: 'Bearer ' + (await token()), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'HTTP ' + res.status), { status: res.status, data });
    return data;
  }

  // ---------------------------------------------------------------- gate (login / missing role)
  function showGate(kind, extra) {
    $('app').classList.add('hidden');
    $('loading').classList.add('hidden');
    const g = $('gate');
    g.innerHTML = '';
    g.classList.remove('hidden');
    if (kind === 'login') {
      g.append(el('h2', {}, ['Orders']), el('p', {}, ['Log in with your dashboard account to see orders.']),
        el('button', { class: 'btn primary', onclick: () => netlifyIdentity.open('login') }, ['Log in']));
    } else if (kind === 'role') {
      g.append(
        el('h2', {}, ['One more step']),
        el('p', {}, [`You're logged in as ${extra || 'this account'}, but orders are only shown to accounts with the admin role.`]),
        el('ol', {}, [
          el('li', {}, ['Open app.netlify.com → chuwu-fragrance → ', el('b', {}, ['Identity'])]),
          el('li', {}, ['Click your email → ', el('b', {}, ['Edit settings'])]),
          el('li', {}, ['Under Roles type ', el('code', {}, ['admin']), ', press Enter, then Save']),
          el('li', {}, ['Come back here, log out and log in again'])
        ]),
        el('p', {}, [el('button', { class: 'btn', onclick: () => netlifyIdentity.logout() }, ['Log out'])])
      );
    } else {
      g.append(el('h2', {}, ['Couldn\'t load orders']), el('p', {}, [extra || 'Please try again.']),
        el('button', { class: 'btn', onclick: load }, ['Try again']));
    }
  }

  // ---------------------------------------------------------------- rendering
  function matches(o) {
    if (filter !== 'all' && o.status !== filter) return false;
    if (!query) return true;
    const hay = [o.id, o.customer.name, o.customer.email, o.customer.phone].join(' ').toLowerCase();
    return hay.includes(query);
  }

  function renderStats() {
    const now = new Date();
    const thisMonth = o => { const d = new Date(o.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
    const awaiting = orders.filter(o => o.status === 'awaiting_payment');
    const toShip = orders.filter(o => o.status === 'paid');
    const paidMonth = orders.filter(o => ['paid', 'shipped', 'completed'].includes(o.status) && thisMonth(o));
    const live = orders.filter(o => o.status !== 'cancelled');
    const stat = (cls, n, label, sub, status) => el('button', { class: 'stat ' + cls, onclick: () => setFilter(status) }, [
      el('span', { class: 'n' }, [n]), el('span', { class: 'l' }, [label]), sub ? el('span', { class: 's' }, [sub]) : null
    ]);
    $('stats').replaceChildren(
      stat(awaiting.length ? 'attention' : '', awaiting.length, 'Awaiting payment', money(awaiting.reduce((s, o) => s + o.totals.total, 0)) + ' to collect', 'awaiting_payment'),
      stat(toShip.length ? 'ship' : '', toShip.length, 'Paid · to ship', toShip.length ? 'Ready to pack' : 'All caught up', 'paid'),
      stat('', money(paidMonth.reduce((s, o) => s + o.totals.total, 0)), 'Paid this month', paidMonth.length + ' order' + (paidMonth.length === 1 ? '' : 's'), 'all'),
      stat('', live.length, 'All orders', 'excluding cancelled', 'all')
    );
  }

  function renderTabs() {
    const count = key => orders.filter(o => key === 'all' || o.status === key).length;
    $('tabs').replaceChildren(...[{ key: 'all', label: 'All' }].concat(STATUSES).map(s =>
      el('button', { class: 'tab' + (filter === s.key ? ' active' : ''), role: 'tab', onclick: () => setFilter(s.key) }, [s.label, el('b', {}, [count(s.key)])])));
  }

  function setFilter(key) {
    filter = key;
    render();
  }

  function waNumber(phone) {
    const d = String(phone || '').replace(/\D/g, '');
    return d.length === 8 ? '65' + d : d;
  }

  function waTemplates(o) {
    const first = (o.customer.name || '').split(' ')[0] || 'there';
    const pn = (settings.checkout && settings.checkout.paynow) || {};
    return [
      ['Payment reminder', `Hi ${first}, thank you for your CHUWU order ${o.id} (${money(o.totals.total)}). We haven't received the PayNow payment yet — please PayNow ${money(o.totals.total)}${pn.uen_or_mobile ? ' to ' + pn.uen_or_mobile : ''} with reference ${o.id}. Thank you!`],
      ['Payment received', `Hi ${first}, we've received your payment for CHUWU order ${o.id} — thank you! We'll let you know as soon as it's on its way.`],
      ['Order shipped', `Hi ${first}, your CHUWU order ${o.id} is on its way! Thank you for choosing CHUWU 初·五.`]
    ];
  }

  async function update(o, changes, btn) {
    if (btn) btn.disabled = true;
    try {
      const { order } = await api('PATCH', { id: o.id, ...changes });
      orders[orders.findIndex(x => x.id === o.id)] = order;
      render();
      toast(changes.status ? `${o.id} → ${LABEL[changes.status]}` : 'Note saved');
    } catch (e) {
      toast('Couldn\'t save: ' + e.message);
      if (btn) btn.disabled = false;
    }
  }

  async function remove(o) {
    if (!confirm(`Delete order ${o.id} permanently? Use this only for test orders — otherwise mark it Cancelled.`)) return;
    try {
      await api('DELETE', null, '?id=' + encodeURIComponent(o.id));
      orders = orders.filter(x => x.id !== o.id);
      render();
      toast('Order deleted');
    } catch (e) { toast('Couldn\'t delete: ' + e.message); }
  }

  function detail(o) {
    const items = el('div', { class: 'items' }, o.items.map(i => el('div', { class: 'item' }, [
      el('div', {}, [
        el('div', {}, [`${i.quantity} × ${i.title}`]),
        i.attributes && i.attributes.length ? el('div', { class: 'attrs' }, [i.attributes.map(a => `${a.key}: ${a.value}`).join(' · ')]) : null
      ]),
      el('div', {}, [money(i.line_total)])
    ])));
    const t = o.totals;
    const sums = el('div', { class: 'sums' }, [
      el('div', {}, [el('span', {}, ['Subtotal']), el('span', {}, [money(t.subtotal)])]),
      t.discount ? el('div', {}, [el('span', {}, [o.promotion || 'Discount']), el('span', {}, ['−' + money(t.discount)])]) : null,
      el('div', {}, [el('span', {}, ['Delivery']), el('span', {}, [t.delivery_fee ? money(t.delivery_fee) : 'Free'])]),
      el('div', { class: 'total' }, [el('span', {}, ['Total']), el('span', {}, [money(t.total)])])
    ]);

    const next = NEXT[o.status];
    const actions = el('div', { class: 'actions' }, [
      next ? el('button', { class: 'btn primary', onclick: e => update(o, { status: next[0] }, e.target) }, [next[1]]) : null,
      o.status !== 'cancelled' ? el('button', { class: 'btn', onclick: e => { if (confirm(`Cancel order ${o.id}?`)) update(o, { status: 'cancelled' }, e.target); } }, ['Cancel order']) : null,
      el('select', { class: 'btn', 'aria-label': 'Set status', onclick: e => e.stopPropagation() },
        [el('option', { value: '' }, ['Set status…'])].concat(STATUSES.map(s => el('option', { value: s.key }, [s.label]))))
    ]);
    actions.querySelector('select').addEventListener('change', e => { if (e.target.value) update(o, { status: e.target.value }); });

    const note = el('textarea', { class: 'note', placeholder: 'Private note — only you see this (e.g. "Paid 3 Nov, DBS ref …")' }, []);
    note.value = o.admin_note || '';
    const saveNote = el('button', { class: 'btn', onclick: e => update(o, { admin_note: note.value }, e.target) }, ['Save note']);

    const wa = waNumber(o.customer.phone);
    return el('div', { class: 'order-detail' }, [
      el('div', {}, [
        el('div', { class: 'block' }, [el('h4', {}, ['Items']), items, sums]),
        o.gift && o.gift.is_gift ? el('div', { class: 'block gift-box' }, [el('b', {}, ['🎁 Gift order — leave prices off the packing slip']), el('p', {}, [o.gift.message ? `Message: “${o.gift.message}”` : 'No message'])]) : null,
        o.notes ? el('div', { class: 'block' }, [el('h4', {}, ['Customer notes']), el('p', {}, [o.notes])]) : null,
        el('div', { class: 'block' }, [el('h4', {}, ['Private note']), note, el('div', { style: 'margin-top:6px' }, [saveNote])])
      ]),
      el('div', {}, [
        el('div', { class: 'block' }, [el('h4', {}, ['Status']), el('p', { style: 'margin-bottom:10px' }, [el('span', { class: 'pill ' + o.status }, [LABEL[o.status]])]), actions]),
        el('div', { class: 'block' }, [
          el('h4', {}, ['Customer']),
          el('p', {}, [el('b', {}, [o.customer.name])]),
          el('p', {}, [el('a', { href: 'tel:' + o.customer.phone }, [o.customer.phone])]),
          el('p', {}, [el('a', { href: 'mailto:' + o.customer.email }, [o.customer.email])])
        ]),
        el('div', { class: 'block' }, [el('h4', {}, ['Delivery']), el('p', {}, [o.delivery.method || '—']), o.delivery.address ? el('p', { style: 'white-space:pre-line' }, [o.delivery.address]) : null]),
        wa ? el('div', { class: 'block' }, [el('h4', {}, ['Message customer on WhatsApp']), el('div', { class: 'actions' },
          waTemplates(o).map(([label, text]) => el('a', { class: 'btn', href: `https://wa.me/${wa}?text=${encodeURIComponent(text)}`, target: '_blank', rel: 'noopener' }, [label])))]) : null,
        el('div', { class: 'block' }, [el('h4', {}, ['History']), el('ul', { class: 'history' }, (o.status_history || []).map(hst =>
          el('li', {}, [`${LABEL[hst.status] || hst.status} — ${fmtDate(hst.at)}${hst.by ? ' (' + hst.by + ')' : ''}`])))]),
        el('div', { class: 'block' }, [el('button', { class: 'btn danger', onclick: () => remove(o) }, ['Delete (test orders only)'])])
      ])
    ]);
  }

  function row(o) {
    const isOpen = openIds.has(o.id);
    const wrap = el('div', { class: 'order' + (isOpen ? ' open' : '') }, []);
    const count = o.items.reduce((n, i) => n + i.quantity, 0);
    wrap.appendChild(el('div', { class: 'order-row', onclick: () => { isOpen ? openIds.delete(o.id) : openIds.add(o.id); render(); } }, [
      el('div', {}, [el('div', { class: 'order-id' }, [o.id]), el('div', { class: 'order-date' }, [fmtDate(o.created_at)])]),
      el('div', { class: 'order-who' }, [el('b', {}, [o.customer.name, o.gift && o.gift.is_gift ? el('span', { class: 'gift-flag' }, ['🎁 gift']) : null]), el('span', {}, [o.customer.phone])]),
      el('div', { class: 'muted', style: 'font-size:0.85rem' }, [count + ' item' + (count === 1 ? '' : 's')]),
      el('div', { class: 'order-total' }, [money(o.totals.total)]),
      el('div', {}, [el('span', { class: 'pill ' + o.status }, [LABEL[o.status] || o.status])]),
      el('div', { class: 'chev' }, ['›'])
    ]));
    if (isOpen) wrap.appendChild(detail(o));
    return wrap;
  }

  function render() {
    renderStats();
    renderTabs();
    const shown = orders.filter(matches);
    $('list').replaceChildren(...shown.map(row));
    const empty = $('empty');
    empty.classList.toggle('hidden', shown.length > 0);
    empty.textContent = orders.length
      ? 'No orders match.'
      : 'No orders yet. They\'ll appear here as soon as a customer checks out.';
  }

  // ---------------------------------------------------------------- CSV
  function exportCsv() {
    const cols = ['Order', 'Date', 'Status', 'Name', 'Email', 'Phone', 'Delivery', 'Address', 'Items', 'Subtotal', 'Discount', 'Promotion', 'Delivery fee', 'Total', 'Gift', 'Gift message', 'Customer notes', 'Private note'];
    const rows = orders.filter(matches).map(o => [
      o.id, o.created_at, LABEL[o.status], o.customer.name, o.customer.email, o.customer.phone, o.delivery.method, o.delivery.address,
      o.items.map(i => `${i.quantity} x ${i.title}` + (i.attributes && i.attributes.length ? ` [${i.attributes.map(a => a.key + ': ' + a.value).join('; ')}]` : '')).join(' | '),
      o.totals.subtotal, o.totals.discount, o.promotion, o.totals.delivery_fee, o.totals.total,
      o.gift && o.gift.is_gift ? 'Yes' : 'No', o.gift ? o.gift.message : '', o.notes, o.admin_note
    ]);
    const esc = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = '﻿' + [cols].concat(rows).map(r => r.map(esc).join(',')).join('\n');
    const a = el('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `chuwu-orders-${new Date().toISOString().slice(0, 10)}.csv` }, []);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------------------------------------------------------------- load
  async function load() {
    $('gate').classList.add('hidden');
    $('loading').classList.remove('hidden');
    try {
      const data = await api('GET');
      orders = data.orders || [];
      $('loading').classList.add('hidden');
      $('app').classList.remove('hidden');
      render();
    } catch (e) {
      if (e.status === 401) showGate('login');
      else if (e.status === 403) showGate('role', e.data && e.data.email);
      else showGate('error', e.message);
    }
  }

  function start(user) {
    $('user-email').textContent = user ? user.email : '';
    $('logout').classList.toggle('hidden', !user);
    if (user) load();
    else showGate('login');
  }

  fetch('/content/settings.json').then(r => r.json()).then(s => { settings = s; }).catch(() => {});
  $('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
  $('refresh').addEventListener('click', load);
  $('export').addEventListener('click', exportCsv);
  $('logout').addEventListener('click', () => netlifyIdentity.logout());

  netlifyIdentity.on('init', start);
  netlifyIdentity.on('login', user => { netlifyIdentity.close(); start(user); });
  netlifyIdentity.on('logout', () => start(null));
})();
