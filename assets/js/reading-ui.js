/* CHUWU (初·五) — the free Bazi reading on the Bazi page.

   After "Calculate My Bazi", customize.js calls ChuwuReadingUI.show(adjustedInput, birth). This
   shows a free preview worked out in the browser (Day Master, zodiac, strength, favourable
   elements) and an email form. Submitting it asks netlify/functions/bazi-reading.mjs for the three
   parts of the reading at once and fills each in as it arrives. A finished reading is remembered in
   this browser, so coming back to the same chart shows it again without asking for the email.

   Texts come from content/customize.json → reading (Page Content → Bazi Reading Page). */
(function (root) {
  const API = '/.netlify/functions/bazi-reading';
  const SECTIONS = ['profile', 'luck', 'year'];
  const READER_KEY = 'chuwu_reader';
  const ELEMENT_COLOR = { Wood: 'var(--wood)', Fire: 'var(--fire)', Earth: 'var(--earth)', Metal: 'var(--metal)', Water: 'var(--water)' };
  const ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  let current = null; // { adjusted, birth, year }

  const $ = id => document.getElementById(id);
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => { if (v != null && v !== false) n.setAttribute(k, v === true ? '' : v); });
    (children || []).forEach(c => c != null && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }
  const t = (key, fallback) => (root.ChuwuContent && ChuwuContent.get('customize.reading.' + key)) || fallback;
  const paragraphs = text => String(text || '').split(/\n+/).filter(Boolean).map(p => el('p', {}, [p]));
  const chip = e => el('span', { class: 'reading-el' }, [el('i', { style: `background:${ELEMENT_COLOR[e]}` }), `${e} ${ZH[e]}`]);

  function storage(fn) { try { return fn(localStorage); } catch (e) { return null; } }
  const reader = () => storage(s => JSON.parse(s.getItem(READER_KEY))) || {};

  // Same "reading year" rule as the server: it turns over at 立春, about 4 February (Singapore time).
  function readingYear() {
    const sg = new Date(Date.now() + 8 * 3600000);
    const y = sg.getUTCFullYear();
    return sg.getUTCMonth() > 1 || (sg.getUTCMonth() === 1 && sg.getUTCDate() >= 4) ? y : y - 1;
  }
  const cacheKey = gender => `chuwu_reading_v1:${current.birth.date}|${current.birth.time}|${current.birth.place}|${gender}|${current.year}`;

  // ---------------------------------------------------------------- free preview
  function renderTeaser() {
    const { facts } = ChuwuReading.analyse(current.adjusted, 'female', current.year);
    const s = facts.strength;
    const card = (label, big, small, extra) => el('div', { class: 'teaser-card' }, [
      el('div', { class: 'teaser-label' }, [label]), el('div', { class: 'teaser-big' }, [big]), el('div', { class: 'teaser-small' }, [small]), extra || null
    ]);
    $('reading-teaser').replaceChildren(
      card('Day Master 日主', `${facts.dayMaster.stem} ${facts.dayMaster.element}`, facts.dayMaster.image),
      card('Zodiac', `${facts.zodiac.branch} ${facts.zodiac.animal}`, `Year of the ${facts.zodiac.animal}`),
      card('Day Master strength', s.label.charAt(0).toUpperCase() + s.label.slice(1), `${s.supportPct}% support${s.inSeason ? ', born in season' : ''}`),
      card('Elements to lean on', '', 'From a simplified strength reading', el('div', { class: 'teaser-chips' }, s.favourable.map(chip)))
    );
  }

  // ---------------------------------------------------------------- the reading
  function sectionShell(key, title, subtitle) {
    return el('div', { class: 'reading-part', id: 'reading-' + key }, [
      el('p', { class: 'eyebrow' }, [subtitle]),
      el('h3', { class: 'reading-title' }, [title]),
      el('div', { class: 'reading-body' }, [
        el('div', { class: 'reading-skeleton' }, [el('span'), el('span'), el('span', { class: 'short' })]),
        el('p', { class: 'reading-wait' }, [t('loading', 'Writing your reading — this takes about half a minute…')])
      ])
    ]);
  }

  function renderProfile(r) {
    return [
      el('p', { class: 'reading-headline' }, [r.headline]),
      ...paragraphs(r.personality),
      el('div', { class: 'reading-twocol' }, [
        el('div', {}, [el('h4', {}, ['Strengths']), el('ul', {}, (r.strengths || []).map(x => el('li', {}, [x])))]),
        el('div', {}, [el('h4', {}, ['To nurture']), el('ul', {}, (r.growth || []).map(x => el('li', {}, [x])))])
      ]),
      el('h4', {}, ['Your element balance']),
      ...paragraphs(r.balance),
      el('h4', {}, ['Your Ten Gods 十神']),
      el('div', { class: 'reading-gods' }, (r.ten_gods || []).map(g => el('div', { class: 'god-card' }, [
        el('div', { class: 'god-name' }, [g.god]), el('div', { class: 'god-area' }, [g.area]), el('p', {}, [g.text])
      ])))
    ];
  }

  function renderLuck(r) {
    const facts = ChuwuReading.analyse(current.adjusted, reader().gender || 'female', current.year).facts;
    const isNow = i => facts.luck.pillars[i] && facts.luck.pillars[i].current;
    return [
      ...paragraphs(r.overview),
      el('div', { class: 'luck-track' }, (r.pillars || []).map((p, i) => el('div', { class: 'luck-card' + (isNow(i) ? ' now' : '') }, [
        isNow(i) ? el('span', { class: 'luck-now' }, ['Now']) : null,
        el('div', { class: 'luck-pillar' }, [p.pillar]),
        el('div', { class: 'luck-ages' }, ['Ages ' + p.ages]),
        el('div', { class: 'luck-title' }, [p.title]),
        el('p', {}, [p.text])
      ]))),
      el('div', { class: 'reading-callout' }, [el('h4', {}, ['Your current chapter']), ...paragraphs(r.current_focus)])
    ];
  }

  function renderYear(r) {
    return [
      ...paragraphs(r.overview),
      el('div', { class: 'reading-themes' }, (r.themes || []).map(x => el('div', { class: 'theme-card' }, [el('h4', {}, [x.area]), el('p', {}, [x.text])]))),
      el('h4', {}, ['Month by month']),
      el('div', { class: 'reading-months' }, (r.months || []).map(m => el('div', { class: 'month-card' }, [
        el('div', { class: 'month-head' }, [el('span', { class: 'month-pillar' }, [m.pillar]), el('span', { class: 'month-dates' }, [m.dates])]),
        el('div', { class: 'month-title' }, [m.title]),
        el('p', {}, [m.text])
      ]))),
      el('div', { class: 'reading-callout' }, [
        el('h4', {}, ['Your scent for the year']),
        ...paragraphs(r.scent_tip),
        el('a', { href: '#recommend-section', class: 'btn btn-gold', style: 'margin-top:8px' }, ['See your recommended scents'])
      ])
    ];
  }
  const RENDER = { profile: renderProfile, luck: renderLuck, year: renderYear };

  function fill(key, reading) {
    const body = document.querySelector(`#reading-${key} .reading-body`);
    if (body) body.replaceChildren(...RENDER[key](reading).filter(Boolean));
  }

  function fail(key, message, retry) {
    const body = document.querySelector(`#reading-${key} .reading-body`);
    if (!body) return;
    body.replaceChildren(...[el('p', { class: 'reading-error' }, [message]), retry ? el('button', { type: 'button', class: 'btn' }, ['Try again']) : null].filter(Boolean));
    if (retry) body.querySelector('button').addEventListener('click', retry);
  }

  function startReading(details, stored) {
    const year = current.year;
    const out = $('reading-output');
    out.replaceChildren(
      sectionShell('profile', 'Who You Are', 'Day Master & Ten Gods'),
      sectionShell('luck', 'Your Luck Pillars 大运', 'Ten-year chapters'),
      sectionShell('year', `Your ${year} Year Ahead`, 'Year & month by month 流年流月'),
      el('div', { class: 'reading-actions' }, [el('button', { type: 'button', class: 'btn', id: 'reading-print' }, ['Save or print my reading'])])
    );
    out.classList.remove('hidden');
    $('reading-form').classList.add('hidden');
    $('reading-print').addEventListener('click', () => window.print());
    renderCta();

    const saved = stored || {};
    const save = () => storage(s => s.setItem(cacheKey(details.gender), JSON.stringify(saved)));
    SECTIONS.forEach(function load(key) {
      if (saved[key]) { fill(key, saved[key]); return; }
      fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, ...current.birth, section: key })
      })
        .then(r => r.json().then(data => ({ ok: r.ok, status: r.status, data })))
        .then(({ ok, status, data }) => {
          if (ok) { saved[key] = data.reading; save(); fill(key, data.reading); return; }
          if (data.error === 'not_configured') fail(key, t('not_ready', 'Free readings are launching very soon — we’ve saved your email and will send yours as soon as they’re ready.'));
          else if (status === 429 || status === 400) fail(key, data.error);
          else fail(key, 'We couldn’t write this part of your reading just now.', () => startReading(details, saved));
        })
        .catch(() => fail(key, 'We couldn’t reach the reading service.', () => startReading(details, saved)));
    });
  }

  // ---------------------------------------------------------------- personal reading offer
  function renderCta() {
    const box = $('reading-cta');
    const f = ChuwuReading.analyse(current.adjusted, reader().gender || 'female', current.year).facts;
    const summary = `${f.pillars.map(p => p.characters).join(' ')} · Day Master ${f.dayMaster.stem} ${f.dayMaster.element}`;
    const product = (ChuwuContent.data.products || []).find(p => p.type === 'service' && p.status === 'active');
    const action = product
      ? el('button', { type: 'button', class: 'btn btn-primary' }, [`${t('cta_book_label', 'Book a Personal Reading')} — ${ChuwuContent.formatPrice(product.price)}`])
      : el('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener', href: ChuwuContent.whatsappLink(`Hi CHUWU! I'd like a personal Bazi reading. My chart: ${summary}`) }, [t('cta_whatsapp_label', 'Ask Us on WhatsApp')]);
    if (product) {
      action.addEventListener('click', () => {
        ChuwuCart.add(product.id, 1, [
          { key: 'Chart', value: summary },
          { key: 'Born', value: `${current.birth.date} · ${current.birth.time} block · ${current.birth.place || 'place not given'}` },
          { key: 'Gender', value: reader().gender || '' }
        ]);
        if (window.ChuwuCartUI) ChuwuCartUI.open();
      });
    }
    box.replaceChildren(
      el('h3', {}, [t('cta_title', 'Want a Deeper, Personal Reading?')]),
      ...paragraphs(t('cta_text', 'This free reading is a general guide. For a detailed, personal look at your chart — your questions, your timing — our team can prepare a reading just for you.')),
      action
    );
    box.classList.remove('hidden');
  }

  // ---------------------------------------------------------------- form
  function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const err = $('reading-form-error');
    const details = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      gender: (form.querySelector('input[name="gender"]:checked') || {}).value,
      marketing: form.elements.marketing.checked
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email)) { err.textContent = 'Please enter a valid email address.'; return; }
    if (!details.gender) { err.textContent = 'Please choose female or male — it sets the direction of your luck pillars.'; return; }
    err.textContent = '';
    storage(s => s.setItem(READER_KEY, JSON.stringify({ name: details.name, email: details.email, gender: details.gender })));
    if (root.ChuwuTrack && ChuwuTrack.lead) ChuwuTrack.lead();
    startReading(details, storage(s => JSON.parse(s.getItem(cacheKey(details.gender)))));
  }

  function show(adjusted, birth) {
    current = { adjusted, birth, year: readingYear() };
    $('reading-output').classList.add('hidden');
    $('reading-cta').classList.add('hidden');
    renderTeaser();

    const r = reader();
    const form = $('reading-form');
    form.classList.remove('hidden');
    if (r.email) form.elements.email.value = r.email;
    if (r.name) form.elements.name.value = r.name;
    if (r.gender) { const g = form.querySelector(`input[name="gender"][value="${r.gender}"]`); if (g) g.checked = true; }
    // Same chart read before in this browser: show it straight away.
    const stored = r.gender && storage(s => JSON.parse(s.getItem(cacheKey(r.gender))));
    if (stored && SECTIONS.every(k => stored[k])) startReading({ name: r.name, email: r.email, gender: r.gender, marketing: false }, stored);
    $('reading-section').classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('reading-form');
    if (form) form.addEventListener('submit', onSubmit);
  });

  root.ChuwuReadingUI = { show };
})(typeof window !== 'undefined' ? window : globalThis);
