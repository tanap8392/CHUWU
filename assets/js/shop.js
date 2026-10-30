/* CHUWU (初·五) — Shop page: renders products from content/products.json (edited at /admin). */
(function () {
  const ELEMENT_COLOR_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  const ELEMENTS = ['Metal', 'Wood', 'Water', 'Fire', 'Earth'];
  const FAMILY_LABEL = { Fresh: 'Fresh & Citrus', Floral: 'Floral', Woody: 'Woody & Spicy', Sweet: 'Sweet & Gourmand', Musky: 'Musky & Sensual' };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'style') node.setAttribute('style', v);
      else node.setAttribute(k, v);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }
  function text(t) { return document.createTextNode(t); }

  function addToCart(product, size, btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    ChuwuCart.add(product.id, 1, [], size);
    btn.textContent = 'Added ✓';
    if (window.ChuwuCartUI) window.ChuwuCartUI.open();
    setTimeout(() => { btn.disabled = false; btn.textContent = originalText; }, 1800);
  }

  // `picker` is the card's size picker; the button adds whichever size is selected when clicked.
  function buyButton(p, picker) {
    if (p.status === 'sold_out') return el('button', { class: 'btn', disabled: 'disabled' }, [text('Sold Out')]);
    if (p.status === 'coming_soon') return el('button', { class: 'btn', disabled: 'disabled' }, [text('Coming Soon')]);
    if (p.type === 'personalized') return el('a', { href: 'customize.html', class: 'btn btn-primary' }, [text('Personalize')]);
    const btn = el('button', { class: 'btn btn-primary' }, [text('Add to Cart')]);
    btn.addEventListener('click', () => addToCart(p, p.sizes && p.sizes.length ? picker.selected().size : null, btn));
    return btn;
  }

  function productCard(p) {

    const elements = p.type === 'element_scent' ? [p.element] : (p.elements || []);
    const tagEls = elements.map(e =>
      el('span', { class: 'tag', style: `background:var(${ELEMENT_COLOR_VAR[e]});color:#fff` }, [text(e)])
    );

    const body = [];
    if (p.status === 'sold_out') body.push(el('span', { class: 'stock-badge sold_out' }, [text('Sold Out')]));
    if (p.status === 'coming_soon') body.push(el('span', { class: 'stock-badge low_stock' }, [text('Coming Soon')]));

    if (p.type === 'element_scent') {
      body.push(el('h3', {}, [text(`${p.code} · ${p.element} ${ELEMENT_ZH[p.element] || ''}`)]));
      // Shown in the order set at Site Settings → Product card layout.
      const sections = {
        profile: () => {
          const line = [...new Set([p.profile, FAMILY_LABEL[p.family] || p.family].filter(Boolean))].join(' · ');
          return line ? el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text(line)]) : null;
        },
        element: () => el('div', { class: 'product-tags' }, tagEls),
        mix: () => ChuwuProductUI.elementMix(p),
        description: () => (p.description ? el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text(p.description)]) : null),
        notes: () => (p.notes ? el('div', { class: 'note-line notes-block' }, [text(p.notes)]) : null),
        similar: () => (p.inspired_by ? el('p', { class: 'muted similar-line' }, [text('Similar in scent to ' + p.inspired_by)]) : null)
      };
      ChuwuProductUI.cardLayout().forEach(key => { const node = sections[key](); if (node) body.push(node); });
    } else {
      body.push(el('h3', {}, [text(ChuwuContent.productTitle(p))]));
      if (p.intention) body.push(el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text('For ' + p.intention)]));
      if (tagEls.length) body.push(el('div', { class: 'product-tags' }, tagEls));
      if (p.description) body.push(el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text(p.description)]));
      [['Top', p.top], ['Middle', p.middle], ['Base', p.base]].forEach(([label, value]) => {
        if (value) body.push(el('div', { class: 'note-line' }, [el('b', {}, [text(label + ':')]), text(' ' + value)]));
      });
    }
    const price = el('span', { class: 'price' }, []);
    const picker = ChuwuProductUI.sizePicker(p, entry => ChuwuProductUI.renderPrice(price, entry));
    ChuwuProductUI.renderPrice(price, picker.selected());
    if (picker.node) body.push(picker.node);
    body.push(el('div', { class: 'price-row' }, [price, buyButton(p, picker)]));

    return el('div', { class: 'product-card' + (p.status === 'sold_out' ? ' sold_out' : '') }, [
      ChuwuProductUI.media(p, 'product-media'),
      el('div', { class: 'product-body' }, body)
    ]);
  }

  function fill(gridId, products) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    products.forEach(p => grid.appendChild(productCard(p)));
  }

  // ---------------------------------------------------------------- filters
  // Filter the element scents by main element and by scent family. Only options that have at least
  // one scent are offered. The choice is kept in the address (e.g. shop.html?element=Fire), so a
  // filtered view can be linked to directly.
  function setupFilters(scents) {
    const params = new URLSearchParams(location.search);
    const state = { element: params.get('element') || 'all', family: params.get('family') || 'all' };
    const wrap = document.getElementById('shop-filters');
    const status = document.getElementById('filter-status');

    const elements = ELEMENTS.filter(e => scents.some(p => p.element === e));
    const families = Object.keys(FAMILY_LABEL).filter(f => scents.some(p => p.family === f));
    if (!elements.includes(state.element)) state.element = 'all';
    if (!families.includes(state.family)) state.family = 'all';

    function chip(group, value, label, dot) {
      const b = el('button', { type: 'button', class: 'filter-chip', 'data-group': group, 'data-value': value, 'aria-pressed': 'false' }, [
        ...(dot ? [el('i', { style: `background:var(${ELEMENT_COLOR_VAR[dot]})` }, [])] : []),
        text(label)
      ]);
      b.addEventListener('click', () => { state[group] = value; apply(); });
      return b;
    }
    const row = (label, chips) => el('div', { class: 'filter-row' }, [el('span', { class: 'filter-label' }, [text(label)]), el('div', { class: 'filter-chips' }, chips)]);

    wrap.innerHTML = '';
    wrap.appendChild(row('Element', [chip('element', 'all', 'All')].concat(elements.map(e => chip('element', e, `${e} ${ELEMENT_ZH[e]}`, e)))));
    if (families.length > 1) wrap.appendChild(row('Scent family', [chip('family', 'all', 'All')].concat(families.map(f => chip('family', f, FAMILY_LABEL[f])))));

    function apply() {
      wrap.querySelectorAll('.filter-chip').forEach(b => {
        const on = state[b.dataset.group] === b.dataset.value;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const shown = scents.filter(p => (state.element === 'all' || p.element === state.element) && (state.family === 'all' || p.family === state.family));
      fill('shop-grid-elements', shown);

      const filtered = state.element !== 'all' || state.family !== 'all';
      status.innerHTML = '';
      status.appendChild(text(shown.length
        ? `Showing ${shown.length} of ${scents.length} scents`
        : 'No scents match these filters.'));
      if (filtered) {
        const clear = el('button', { type: 'button', class: 'filter-clear' }, [text('Clear filters')]);
        clear.addEventListener('click', () => { state.element = 'all'; state.family = 'all'; apply(); });
        status.appendChild(clear);
      }

      const q = new URLSearchParams();
      if (state.element !== 'all') q.set('element', state.element);
      if (state.family !== 'all') q.set('family', state.family);
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    }
    apply();
  }

  ChuwuContent.ready.then(data => {
    const visible = data.products.filter(p => p.status !== 'hidden');
    const ofType = type => visible.filter(p => p.type === type);

    fill('shop-grid', ofType('signature'));
    fill('shop-grid-personalized', ofType('personalized').sort((a, b) => a.price - b.price));

    // Sections with nothing to show are hidden rather than left as an empty heading. With no
    // signature blends, the element scents become the top of the page, without the divider line.
    const hideAll = sel => document.querySelectorAll(sel).forEach(n => n.classList.add('hidden'));
    if (!ofType('signature').length) {
      hideAll('[data-signature-section]');
      document.getElementById('element-scents-section').classList.add('first-section');
    }
    if (!ofType('personalized').length) hideAll('[data-personalized-section]');

    // Every element scent that isn't hidden is listed, including ones still "coming soon".
    const elementScents = ofType('element_scent');
    if (elementScents.length) {
      setupFilters(elementScents);
      document.getElementById('element-scents-section').classList.remove('hidden');
    }
    if (data.settings.features && data.settings.features.custom_blend === false) {
      document.querySelectorAll('[data-personalized-section]').forEach(n => n.classList.add('hidden'));
    }
  });
})();
