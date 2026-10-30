/* CHUWU (初·五) — Shop page: renders products from content/products.json (edited at /admin). */
(function () {
  const ELEMENT_COLOR_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

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
      body.push(el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text([...new Set([p.profile, p.family].filter(Boolean))].join(' · '))]));
      body.push(el('div', { class: 'product-tags' }, tagEls));
      const mix = ChuwuProductUI.elementMix(p);
      if (mix) body.push(mix);
      if (p.inspired_by) body.push(el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text('Similar in scent to ' + p.inspired_by)]));
      if (p.description) body.push(el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text(p.description)]));
      if (p.notes) body.push(el('div', { class: 'note-line notes-block' }, [text(p.notes)]));
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
      fill('shop-grid-elements', elementScents);
      document.getElementById('element-scents-section').classList.remove('hidden');
    }
    if (data.settings.features && data.settings.features.custom_blend === false) {
      document.querySelectorAll('[data-personalized-section]').forEach(n => n.classList.add('hidden'));
    }
  });
})();
