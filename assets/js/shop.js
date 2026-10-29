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

  function addToCart(product, btn) {
    const originalText = btn.textContent;
    btn.disabled = true;
    ChuwuCart.add(product.id, 1, []);
    btn.textContent = 'Added ✓';
    if (window.ChuwuCartUI) window.ChuwuCartUI.open();
    setTimeout(() => { btn.disabled = false; btn.textContent = originalText; }, 1800);
  }

  function priceEl(p) {
    const children = [text(ChuwuContent.formatPrice(p.price))];
    if (p.compare_at_price && p.compare_at_price > p.price) {
      children.unshift(el('s', { class: 'compare-price' }, [text(ChuwuContent.formatPrice(p.compare_at_price))]), text(' '));
    }
    return el('span', { class: 'price' }, children);
  }

  function buyButton(p) {
    if (p.status === 'sold_out') return el('button', { class: 'btn', disabled: 'disabled' }, [text('Sold Out')]);
    if (p.status === 'coming_soon') return el('button', { class: 'btn', disabled: 'disabled' }, [text('Coming Soon')]);
    if (p.type === 'personalized') return el('a', { href: 'customize.html', class: 'btn btn-primary' }, [text('Personalize')]);
    const btn = el('button', { class: 'btn btn-primary' }, [text('Add to Cart')]);
    btn.addEventListener('click', () => addToCart(p, btn));
    return btn;
  }

  // Main photo, plus thumbnails to switch between it and any extra photos (Products → More photos).
  function mediaFor(p) {
    const photos = [p.image].concat((p.gallery || []).map(g => (typeof g === 'string' ? g : g && g.image))).filter(Boolean);
    const box = el('div', { class: 'product-media' }, []);
    if (!photos.length) {
      box.appendChild(el('div', { class: 'bottle', style: 'background:linear-gradient(180deg,#C8B38A,#2D2A28)' }, []));
    } else {
      box.appendChild(el('img', { src: photos[0], alt: p.name || p.code, style: 'width:100%;height:100%;object-fit:cover' }, []));
    }
    if (p.badge) box.appendChild(el('span', { class: 'product-badge' }, [text(p.badge)]));
    if (photos.length < 2) return [box];

    const thumbs = el('div', { class: 'product-thumbs' }, []);
    photos.forEach((src, i) => {
      const b = el('button', { type: 'button', 'aria-label': 'Photo ' + (i + 1), class: i === 0 ? 'active' : '' }, [el('img', { src, alt: '' }, [])]);
      b.addEventListener('click', () => {
        box.querySelector('img').src = src;
        thumbs.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      });
      thumbs.appendChild(b);
    });
    return [box, thumbs];
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
      body.push(el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text(p.family + ' · ' + p.size)]));
      body.push(el('div', { class: 'product-tags' }, tagEls));
      if (p.inspired_by) body.push(el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text('Inspired by ' + p.inspired_by)]));
      if (p.notes) body.push(el('div', { class: 'note-line' }, [text(p.notes)]));
    } else {
      body.push(el('h3', {}, [text(ChuwuContent.productTitle(p))]));
      if (p.intention) body.push(el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text('For ' + p.intention)]));
      if (tagEls.length) body.push(el('div', { class: 'product-tags' }, tagEls));
      if (p.description) body.push(el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text(p.description)]));
      [['Top', p.top], ['Middle', p.middle], ['Base', p.base]].forEach(([label, value]) => {
        if (value) body.push(el('div', { class: 'note-line' }, [el('b', {}, [text(label + ':')]), text(' ' + value)]));
      });
    }
    body.push(el('div', { class: 'price-row' }, [priceEl(p), buyButton(p)]));

    return el('div', { class: 'product-card' + (p.status === 'sold_out' ? ' sold_out' : '') }, [
      ...mediaFor(p),
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

    // The element section only appears once at least one element scent is actually on sale.
    const elementScents = ofType('element_scent');
    if (elementScents.some(p => p.status === 'active')) {
      fill('shop-grid-elements', elementScents);
      document.getElementById('element-scents-section').classList.remove('hidden');
    }
    if (data.settings.features && data.settings.features.custom_blend === false) {
      document.querySelectorAll('[data-personalized-section]').forEach(n => n.classList.add('hidden'));
    }
  });
})();
