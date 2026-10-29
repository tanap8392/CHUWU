/* CHUWU (初·五) — loads the dashboard-editable content (content/*.json, edited at /admin) and
   applies what every page shares: theme colours, announcement bar, logos, footer contact details,
   page titles, and any element marked with a data-cms attribute.

   The HTML keeps its own copy of the default text, so pages still read correctly if a content
   file fails to load. Scripts that need products, notes or settings wait on ChuwuContent.ready. */
(function (root) {
  const FILES = ['settings', 'home', 'shop', 'customize', 'products', 'promotions', 'notes'];
  const INFO_PAGES = ['about', 'faq', 'shipping', 'privacy'];
  const data = {};

  function fetchJSON(name) {
    return fetch('content/' + name + '.json', { cache: 'no-cache' }).then(r => {
      if (!r.ok) throw new Error('content/' + name + '.json: HTTP ' + r.status);
      return r.json();
    });
  }

  // Dot-path lookup, e.g. get('home.hero.title').
  function get(path) {
    return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), data);
  }

  function formatPrice(amount) {
    const currency = get('settings.currency') || 'SGD';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount) || 0);
    } catch (e) {
      return `${amount} ${currency}`;
    }
  }

  // Element scents are keyed by their code (J01, M02…); other products carry an explicit id.
  function normalizeProducts(list) {
    return (list || []).map(p => ({
      ...p,
      id: p.id || p.code,
      price: Number(p.price) || 0,
      compare_at_price: Number(p.compare_at_price) > 0 ? Number(p.compare_at_price) : null,
      status: p.status || 'active'
    }));
  }

  function productTitle(p) {
    if (p.type === 'signature') return `${p.name}${p.name_zh ? ' (' + p.name_zh + ')' : ''} — ${p.size}`;
    if (p.type === 'element_scent') return `${p.code} · ${p.element} — ${p.size}`;
    return `${p.name} — ${p.size}`;
  }

  function whatsappLink(message) {
    const number = String(get('settings.contact.whatsapp_number') || '').replace(/\D/g, '');
    return 'https://wa.me/' + number + (message ? '?text=' + encodeURIComponent(message) : '');
  }

  function setText(node, value) {
    if (typeof value !== 'string' || !value) return;
    node.textContent = value;
    if (value.includes('\n')) node.style.whiteSpace = 'pre-line';
  }

  function applyBindings() {
    document.querySelectorAll('[data-cms]').forEach(n => setText(n, get(n.getAttribute('data-cms'))));
    document.querySelectorAll('[data-cms-href]').forEach(n => {
      const v = get(n.getAttribute('data-cms-href'));
      if (v) n.setAttribute('href', v);
    });
    document.querySelectorAll('[data-cms-src]').forEach(n => {
      const v = get(n.getAttribute('data-cms-src'));
      if (!v || n.getAttribute('src') === v) return;
      n.setAttribute('src', v);
      if (n.tagName === 'SOURCE' && n.parentElement.tagName === 'VIDEO') n.parentElement.load();
    });
    document.querySelectorAll('[data-cms-poster]').forEach(n => {
      const v = get(n.getAttribute('data-cms-poster'));
      if (v) n.setAttribute('poster', v);
    });
    // data-cms-if hides the element when the setting is switched off.
    document.querySelectorAll('[data-cms-if]').forEach(n => {
      if (get(n.getAttribute('data-cms-if')) === false) n.classList.add('hidden');
    });
  }

  function applyTheme() {
    const theme = get('settings.theme') || {};
    Object.entries(theme).forEach(([key, value]) => {
      if (value) document.documentElement.style.setProperty('--' + key, value);
    });
  }

  function applyAnnouncement() {
    const a = get('settings.announcement');
    if (!a || !a.enabled || !a.text) return;
    const bar = document.createElement(a.link ? 'a' : 'div');
    bar.className = 'announcement-bar';
    bar.textContent = a.text;
    if (a.link) bar.setAttribute('href', a.link);
    // Inside the sticky header, so it stays visible while scrolling.
    const header = document.querySelector('header.site-nav');
    if (header) header.insertBefore(bar, header.firstChild);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function applyBrandAndContact() {
    const brand = get('settings.brand') || {};
    document.querySelectorAll('[data-logo="dark"]').forEach(n => { if (brand.logo) n.src = brand.logo; });
    document.querySelectorAll('[data-logo="light"]').forEach(n => { if (brand.logo_light) n.src = brand.logo_light; });

    const c = get('settings.contact') || {};
    document.querySelectorAll('[data-contact="email"]').forEach(n => {
      if (!c.email) return;
      n.href = 'mailto:' + c.email;
      n.textContent = c.email;
    });
    document.querySelectorAll('[data-contact="whatsapp"]').forEach(n => {
      if (!c.whatsapp_number) return;
      n.href = whatsappLink();
      n.textContent = 'WhatsApp: ' + (c.whatsapp_display || c.whatsapp_number);
    });
    // Social links only show once their URL is filled in.
    document.querySelectorAll('[data-contact="instagram"]').forEach(n => {
      if (c.instagram_url) n.href = c.instagram_url;
      else n.classList.add('hidden');
      SOCIALS.slice().reverse().forEach(([key, label]) => {
        if (!c[key]) return;
        const a = document.createElement('a');
        a.href = c[key];
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = label;
        n.insertAdjacentElement('afterend', a);
      });
    });
  }

  const SOCIALS = [['facebook_url', 'Facebook'], ['tiktok_url', 'TikTok'], ['xiaohongshu_url', 'Xiaohongshu 小红书']];

  // Footer "Info" column: the info pages switched on in the dashboard (Info Pages → Show on site).
  function applyInfoLinks() {
    const published = INFO_PAGES.filter(slug => data.pages[slug] && data.pages[slug].published);
    document.querySelectorAll('[data-info-links]').forEach(col => {
      if (!published.length) return;
      published.forEach(slug => {
        const a = document.createElement('a');
        a.href = slug + '.html';
        a.textContent = data.pages[slug].title || slug;
        col.appendChild(a);
      });
      col.classList.remove('hidden');
    });
  }

  function applySeo() {
    const page = document.body.getAttribute('data-content-page');
    const seo = page && get(page + '.seo');
    if (!seo) return;
    if (seo.title) document.title = seo.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && seo.description) meta.setAttribute('content', seo.description);
  }

  const raw = {};
  const ready = Promise.all(FILES.concat(INFO_PAGES.map(slug => 'pages/' + slug)).map(name =>
    fetchJSON(name)
      .then(json => { raw[name] = json; })
      .catch(err => { console.error('Could not load content:', err); raw[name] = {}; })
  )).then(() => {
    const pages = {};
    INFO_PAGES.forEach(slug => { pages[slug] = raw['pages/' + slug]; delete raw['pages/' + slug]; });
    Object.assign(data, raw, {
      products: normalizeProducts(raw.products.products),
      promotions: raw.promotions.promotions || [],
      notes: raw.notes.notes || [],
      pages
    });
    const apply = () => {
      applyTheme();
      applyAnnouncement();
      applyBrandAndContact();
      applyInfoLinks();
      applySeo();
      applyBindings();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
    else apply();
    return data;
  });

  root.ChuwuContent = { ready, data, get, formatPrice, productTitle, whatsappLink, INFO_PAGES };
})(typeof window !== 'undefined' ? window : globalThis);
