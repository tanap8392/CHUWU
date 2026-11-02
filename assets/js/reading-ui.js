/* CHUWU (初·五) — the Bazi reading on the Bazi page: a free sneak peek and the S$1.99 full reading.

   After "Calculate My Bazi", customize.js calls ChuwuReadingUI.show(adjustedInput, birth):
   - Free: a preview worked out in the browser (Day Master, zodiac, strength, elements to lean on),
     then the start of "Who You Are" written by Claude. After a couple of paragraphs the text fades
     out behind the unlock card.
   - Unlock: the Full Bazi Reading (S$1.99) goes in the cart with the birth details; it's free when
     a perfume is in the same order. After checkout, checkout.js remembers the order on this device
     ("chuwu_unlock:…"). Until the order is marked Paid this page says the reading is on its way;
     once paid it shows every part (the reading is emailed at the same moment).

   Parts come from netlify/functions/bazi-reading.mjs. Texts come from content/customize.json →
   reading (Page Content → Bazi Reading Page). */
(function (root) {
  const API = '/.netlify/functions/bazi-reading';
  const READING_ID = 'full-reading';
  const PAID_SECTIONS = ['luck', 'year', 'months'];
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

  // Same "reading year" rule as the server: it turns over at 立春, about 4 February (Singapore time).
  function readingYear() {
    const sg = new Date(Date.now() + 8 * 3600000);
    const y = sg.getUTCFullYear();
    return sg.getUTCMonth() > 1 || (sg.getUTCMonth() === 1 && sg.getUTCDate() >= 4) ? y : y - 1;
  }
  // The next-year preview shows from the start month (default November) until the new Bazi year.
  function nextYearOpen() {
    const sg = new Date(Date.now() + 8 * 3600000);
    const from = Number(t('next_from_month', 11)) || 11;
    return sg.getUTCFullYear() > readingYear() || sg.getUTCMonth() + 1 >= from;
  }
  const paidSections = () => (nextYearOpen() ? PAID_SECTIONS.concat('next') : PAID_SECTIONS);

  // Unlock saved by checkout.js for this chart (either gender), or null.
  function findUnlock() {
    const b = current.birth;
    for (const gender of ['female', 'male']) {
      const u = storage(s => JSON.parse(s.getItem(`chuwu_unlock:${b.date}|${b.time}|${b.place}|${gender}`)));
      if (u && u.order_id) return { ...u, gender };
    }
    return null;
  }
  const facts = gender => ChuwuReading.analyse(current.adjusted, gender || 'female', current.year).facts;

  // ---------------------------------------------------------------- preview cards
  function renderTeaser() {
    const f = facts();
    const s = f.strength;
    const card = (label, big, small, extra) => el('div', { class: 'teaser-card' }, [
      el('div', { class: 'teaser-label' }, [label]), el('div', { class: 'teaser-big' }, [big]), el('div', { class: 'teaser-small' }, [small]), extra || null
    ]);
    $('reading-teaser').replaceChildren(
      card('Day Master 日主', `${f.dayMaster.stem} ${f.dayMaster.element}`, f.dayMaster.image),
      card('Zodiac', `${f.zodiac.branch} ${f.zodiac.animal}`, `Year of the ${f.zodiac.animal}`),
      card('Day Master strength', s.label.charAt(0).toUpperCase() + s.label.slice(1), `${s.supportPct}% support${s.inSeason ? ', born in season' : ''}`),
      card('Elements to lean on', '', 'From a simplified strength reading', el('div', { class: 'teaser-chips' }, s.favourable.map(chip)))
    );
  }

  // ---------------------------------------------------------------- the reading parts
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
  function renderLuck(r, gender) {
    const lp = facts(gender).luck.pillars;
    return [
      ...paragraphs(r.overview),
      el('div', { class: 'luck-track' }, (r.pillars || []).map((p, i) => el('div', { class: 'luck-card' + (lp[i] && lp[i].current ? ' now' : '') }, [
        lp[i] && lp[i].current ? el('span', { class: 'luck-now' }, ['Now']) : null,
        el('div', { class: 'luck-pillar' }, [p.pillar]), el('div', { class: 'luck-ages' }, ['Ages ' + p.ages]),
        el('div', { class: 'luck-title' }, [p.title]), el('p', {}, [p.text])
      ]))),
      el('div', { class: 'reading-callout' }, [el('h4', {}, ['Your current chapter']), ...paragraphs(r.current_focus)])
    ];
  }
  const themeCards = themes => el('div', { class: 'reading-themes' }, (themes || []).map(x => el('div', { class: 'theme-card' }, [el('h4', {}, [x.area]), el('p', {}, [x.text])])));
  const monthCard = (m, withTitle) => el('div', { class: 'month-card' }, [
    el('div', { class: 'month-head' }, [el('span', { class: 'month-pillar' }, [m.pillar]), el('span', { class: 'month-dates' }, [m.dates])]),
    withTitle ? el('div', { class: 'month-title' }, [m.title]) : null,
    el('p', {}, [m.text])
  ]);
  function renderYear(r) {
    return [...paragraphs(r.overview), themeCards(r.themes), el('div', { class: 'reading-callout' }, [
      el('h4', {}, ['Your scent for the year']), ...paragraphs(r.scent_tip),
      el('a', { href: '#recommend-section', class: 'btn btn-gold', style: 'margin-top:8px' }, ['See your recommended scents'])
    ])];
  }
  const renderMonths = r => [el('div', { class: 'reading-months' }, (r.months || []).map(m => monthCard(m, true)))];
  const renderNext = r => [...paragraphs(r.overview), themeCards(r.themes), el('h4', {}, ['Months to watch']), el('div', { class: 'reading-months' }, (r.key_months || []).map(m => monthCard(m, false)))];
  const RENDER = { profile: renderProfile, luck: renderLuck, year: renderYear, months: renderMonths, next: renderNext };

  function nextYearLabel(y) {
    const ny = ChuwuReading.yearAhead(ChuwuBazi.computeBazi(current.adjusted), y);
    return `Preview · ${ny.pillar} ${ny.stemElement} ${ny.animal} year`;
  }
  const SHELLS = {
    profile: () => ['Who You Are', 'Day Master & Ten Gods'],
    luck: () => ['Your Luck Pillars 大运', 'Ten-year chapters'],
    year: () => [`Your ${current.year} Year Ahead`, 'The year 流年'],
    months: () => [`${current.year} Month by Month`, 'Solar months 流月'],
    next: () => [`Looking Ahead to ${current.year + 1}`, nextYearLabel(current.year + 1)]
  };
  function shell(key) {
    const [title, eyebrow] = SHELLS[key]();
    return el('div', { class: 'reading-part', id: 'reading-' + key }, [
      el('p', { class: 'eyebrow' }, [eyebrow]),
      el('h3', { class: 'reading-title' }, [title]),
      el('div', { class: 'reading-body' }, [
        el('div', { class: 'reading-skeleton' }, [el('span'), el('span'), el('span', { class: 'short' })]),
        el('p', { class: 'reading-wait' }, [t('loading', 'Writing your reading — this takes about half a minute…')])
      ])
    ]);
  }
  const bodyOf = key => document.querySelector(`#reading-${key} .reading-body`);
  function fail(key, message, retry) {
    const body = bodyOf(key);
    if (!body) return;
    body.replaceChildren(...[el('p', { class: 'reading-error' }, [message]), retry ? el('button', { type: 'button', class: 'btn' }, ['Try again']) : null].filter(Boolean));
    if (retry) body.querySelector('button').addEventListener('click', retry);
  }

  // Fetch one part. Paid parts send the order as proof; 202 means the email job is still writing
  // it, so wait and ask again. One automatic retry for a timeout or temporary error.
  function load(key, extra, onDone) {
    const attempt = (tries, waits) => fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...current.birth, section: key, ...extra })
    })
      .then(r => r.json().then(data => ({ status: r.status, data }), () => ({ status: r.status, data: {} })))
      .catch(() => ({ status: 0, data: {} }))
      .then(({ status, data }) => {
        if (status === 200) return onDone(data.reading);
        if (status === 202 && waits < 30) return setTimeout(() => attempt(tries, waits + 1), 6000);
        if (data.error === 'not_configured') return fail(key, t('not_ready', 'Readings are launching very soon — please check back shortly.'));
        if (status === 402) return fail(key, 'This part unlocks with the Full Bazi Reading.');
        if (status === 400 || status === 429) return fail(key, data.error);
        if (tries < 1) return setTimeout(() => attempt(tries + 1, waits), 2500);
        fail(key, 'We couldn’t write this part of your reading just now.', () => { bodyOf(key).replaceChildren(el('div', { class: 'reading-skeleton' }, [el('span'), el('span')])); load(key, extra, onDone); });
      });
    attempt(0, 0);
  }

  // ---------------------------------------------------------------- free sneak peek
  function addToCart(gender, btn) {
    const f = facts(gender);
    const b = current.birth;
    ChuwuCart.add(READING_ID, 1, [
      { key: 'Birth date', value: b.date },
      { key: 'Birth time', value: b.time },
      { key: 'Birth place', value: b.place || 'Not specified' },
      { key: 'Gender', value: gender },
      { key: 'Chart', value: f.pillars.map(p => p.characters).join(' ') }
    ]);
    if (window.ChuwuCartUI) ChuwuCartUI.open();
    btn.replaceWith(el('a', { class: 'btn btn-primary paywall-btn', href: 'checkout.html' }, ['Added ✓ — Go to Checkout']));
  }

  function paywall() {
    const product = (ChuwuContent.data.products || []).find(p => p.id === READING_ID && p.status === 'active');
    const price = product ? ChuwuContent.formatPrice(product.price) : 'S$1.99';
    const includes = String(t('paywall_includes', 'The rest of Who You Are, with your Ten Gods\nYour eight ten-year luck pillars\nYour year ahead, month by month\nEmailed to you to keep')).split('\n').filter(Boolean);
    const btn = el('button', { type: 'button', class: 'btn btn-primary paywall-btn' }, [`${t('paywall_button', 'Unlock My Full Reading')} — ${price}`]);
    const err = el('p', { class: 'form-msg error' }, []);
    const card = el('div', { class: 'paywall' }, [
      el('p', { class: 'eyebrow' }, [t('paywall_eyebrow', 'Keep reading')]),
      el('h3', {}, [t('paywall_title', 'Unlock Your Full Bazi Reading')]),
      el('ul', { class: 'paywall-list' }, includes.map(i => el('li', {}, [i]))),
      el('div', { class: 'reading-gender' }, ['female', 'male'].map(g => el('label', { class: 'option-card' }, [el('input', { type: 'radio', name: 'pw-gender', value: g }), g === 'female' ? ' Female' : ' Male']))),
      el('p', { class: 'muted reading-note' }, [t('gender_note', 'In Bazi, gender sets the direction of your ten-year luck pillars.')]),
      btn, err,
      el('p', { class: 'paywall-offset' }, [t('paywall_offset', 'Free with any perfume in the same order — or get S$1.99 back as credit on your next perfume.')]),
      product ? null : el('p', { class: 'form-msg error' }, ['The full reading isn’t available right now.'])
    ]);
    btn.addEventListener('click', () => {
      const g = card.querySelector('input[name="pw-gender"]:checked');
      if (!g) { err.textContent = 'Please choose female or male — it sets the direction of your luck pillars.'; return; }
      if (!product) return;
      err.textContent = '';
      addToCart(g.value, btn);
    });
    return card;
  }

  // Ordered, but the PayNow payment isn't confirmed yet.
  function pendingCard(unlock) {
    const btn = el('button', { type: 'button', class: 'btn paywall-btn' }, ['Check again']);
    btn.addEventListener('click', () => show(current.adjusted, current.birth));
    return el('div', { class: 'paywall' }, [
      el('p', { class: 'eyebrow' }, ['Order ' + unlock.order_id]),
      el('h3', {}, [t('pending_title', 'Your Full Reading Is On Its Way')]),
      ...paragraphs(t('pending_text', 'As soon as we confirm your PayNow payment, we’ll email your full reading to you — and it unlocks right here too.')),
      btn
    ]);
  }

  function showPeek(unlock) {
    const out = $('reading-output');
    out.replaceChildren(shell('profile'));
    out.classList.remove('hidden');
    load('profile', {}, r => {
      const body = bodyOf('profile');
      const all = renderProfile(r);
      // Show the headline and first paragraph; from the second paragraph the text fades out
      // under the unlock card.
      const visible = all.slice(0, 2);
      const faded = el('div', { class: 'reading-faded', 'aria-hidden': 'true' }, all.slice(2));
      body.replaceChildren(...visible, faded);
      out.appendChild(unlock ? pendingCard(unlock) : paywall());
    });
  }

  // ---------------------------------------------------------------- unlocked
  function showFull(unlock) {
    const out = $('reading-output');
    const keys = ['profile'].concat(paidSections());
    out.replaceChildren(...keys.map(shell), el('div', { class: 'reading-actions' }, [el('button', { type: 'button', class: 'btn', id: 'reading-print' }, ['Save or print my reading'])]));
    out.classList.remove('hidden');
    $('reading-print').addEventListener('click', () => window.print());
    const proof = { order_id: unlock.order_id, email: unlock.email, gender: unlock.gender };
    keys.forEach(key => load(key, key === 'profile' ? {} : proof, r => bodyOf(key).replaceChildren(...RENDER[key](r, unlock.gender).filter(Boolean))));
    renderCta(unlock.gender);
  }

  // ---------------------------------------------------------------- personal reading offer
  function renderCta(gender) {
    const box = $('reading-cta');
    const f = facts(gender);
    const summary = `${f.pillars.map(p => p.characters).join(' ')} · Day Master ${f.dayMaster.stem} ${f.dayMaster.element}`;
    const product = (ChuwuContent.data.products || []).find(p => p.type === 'service' && p.status === 'active');
    const action = product
      ? el('button', { type: 'button', class: 'btn btn-primary' }, [`${t('cta_book_label', 'Book a Personal Reading')} — ${ChuwuContent.formatPrice(product.price)}`])
      : el('a', { class: 'btn btn-primary', target: '_blank', rel: 'noopener', href: ChuwuContent.whatsappLink(`Hi CHUWU! I'd like a personal Bazi reading. My chart: ${summary}`) }, [t('cta_whatsapp_label', 'Ask Us on WhatsApp')]);
    if (product) {
      action.addEventListener('click', () => {
        ChuwuCart.add(product.id, 1, [{ key: 'Chart', value: summary }, { key: 'Born', value: `${current.birth.date} · ${current.birth.time} block · ${current.birth.place || 'place not given'}` }, { key: 'Gender', value: gender || '' }]);
        if (window.ChuwuCartUI) ChuwuCartUI.open();
      });
    }
    box.replaceChildren(
      el('h3', {}, [t('cta_title', 'Want a Deeper, Personal Reading?')]),
      ...paragraphs(t('cta_text', 'This reading is a general guide. For a detailed, personal look at your chart — your questions, your timing — our team can prepare a reading just for you.')),
      action
    );
    box.classList.remove('hidden');
  }

  function show(adjusted, birth) {
    current = { adjusted, birth, year: readingYear() };
    $('reading-cta').classList.add('hidden');
    renderTeaser();
    const unlock = findUnlock();
    if (!unlock) showPeek();
    else {
      // Ask for one paid part to learn whether the order has been paid yet.
      fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...birth, section: 'luck', order_id: unlock.order_id, email: unlock.email, gender: unlock.gender }) })
        .then(r => r.json().then(d => ({ status: r.status, error: d.error })), () => ({}))
        .then(({ status, error }) => {
          if (status === 402 && error === 'awaiting_payment') return showPeek(unlock);
          if (status === 402) { // not this order's chart, or cancelled: forget it
            storage(st => st.removeItem(`chuwu_unlock:${birth.date}|${birth.time}|${birth.place}|${unlock.gender}`));
            return showPeek();
          }
          showFull(unlock);
        });
    }
    $('reading-section').classList.remove('hidden');
  }

  root.ChuwuReadingUI = { show };
})(typeof window !== 'undefined' ? window : globalThis);
