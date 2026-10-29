/* CHUWU (初·五) — shared cart dropdown UI, wired to window.ChuwuCart (cart.js). */
(function () {
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

  function updateBadges() {
    const count = ChuwuCart.count();
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  function lineMedia(product) {
    return product && product.image
      ? el('img', { src: product.image, alt: product.name || product.code || '' }, [])
      : el('div', { class: 'cart-line-placeholder' }, []);
  }

  function qtyControl(line) {
    const minus = el('button', { class: 'qty-btn', 'aria-label': 'Decrease quantity' }, [text('−')]);
    const plus = el('button', { class: 'qty-btn', 'aria-label': 'Increase quantity' }, [text('+')]);
    minus.addEventListener('click', () => ChuwuCart.setQuantity(line.id, line.quantity - 1));
    plus.addEventListener('click', () => ChuwuCart.setQuantity(line.id, line.quantity + 1));
    return el('span', { class: 'qty-control' }, [minus, el('span', {}, [text(String(line.quantity))]), plus]);
  }

  function renderPanel() {
    const linesEl = document.getElementById('cart-lines');
    const subtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('cart-checkout');
    if (!linesEl || !subtotalEl || !checkoutBtn) return;
    linesEl.innerHTML = '';

    const { lines, unavailable } = ChuwuCart.priced(ChuwuContent.data.products || []);
    checkoutBtn.setAttribute('href', 'checkout.html');

    if (!lines.length && !unavailable.length) {
      linesEl.appendChild(el('p', { class: 'cart-empty' }, [text('Your cart is empty.')]));
      subtotalEl.textContent = '—';
      checkoutBtn.classList.add('hidden');
      return;
    }

    lines.forEach(function (line) {
      const attrsText = line.attributes.map(a => a.key + ': ' + a.value).join(' · ');
      const removeBtn = el('button', { class: 'cart-line-remove' }, [text('Remove')]);
      removeBtn.addEventListener('click', () => ChuwuCart.remove(line.id));
      const info = [el('div', { class: 'title' }, [text(ChuwuContent.productTitle(line.product))])];
      if (attrsText) info.push(el('div', { class: 'attrs' }, [text(attrsText)]));
      info.push(el('div', { class: 'qty-price' }, [qtyControl(line), el('span', {}, [text(ChuwuContent.formatPrice(line.lineTotal))])]));
      info.push(removeBtn);
      linesEl.appendChild(el('div', { class: 'cart-line' }, [lineMedia(line.product), el('div', { class: 'cart-line-info' }, info)]));
    });

    unavailable.forEach(function (line) {
      const removeBtn = el('button', { class: 'cart-line-remove' }, [text('Remove')]);
      removeBtn.addEventListener('click', () => ChuwuCart.remove(line.id));
      const title = line.product ? ChuwuContent.productTitle(line.product) : 'Item';
      linesEl.appendChild(el('div', { class: 'cart-line unavailable' }, [
        lineMedia(line.product),
        el('div', { class: 'cart-line-info' }, [
          el('div', { class: 'title' }, [text(title)]),
          el('div', { class: 'attrs' }, [text('No longer available — it won\'t be included in your order.')]),
          removeBtn
        ])
      ]));
    });

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    subtotalEl.textContent = ChuwuContent.formatPrice(subtotal);
    checkoutBtn.classList.toggle('hidden', !lines.length);
  }

  function refresh() {
    updateBadges();
    renderPanel();
    return Promise.resolve();
  }

  // Set while the click that opened the panel (e.g. "Add to Cart") is still bubbling, so the
  // outside-click handler below doesn't immediately close it again.
  let justOpened = false;

  function openPanel() {
    const panel = document.getElementById('cart-panel');
    if (!panel) return;
    panel.classList.add('open');
    justOpened = true;
    setTimeout(() => { justOpened = false; }, 0);
  }
  function closePanel() {
    const panel = document.getElementById('cart-panel');
    if (panel) panel.classList.remove('open');
  }
  function togglePanel() {
    const panel = document.getElementById('cart-panel');
    if (panel) panel.classList.toggle('open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.cart-toggle').forEach(function (btn) {
      btn.addEventListener('click', togglePanel);
    });
    const closeBtn = document.getElementById('cart-close');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Clicks on the +/−/Remove buttons re-render the panel, detaching the clicked node — ignore
    // those so the panel doesn't close mid-edit.
    document.addEventListener('click', function (e) {
      const panel = document.getElementById('cart-panel');
      if (!panel || !panel.classList.contains('open') || justOpened) return;
      if (!e.target.isConnected || panel.contains(e.target) || e.target.closest('.cart-toggle')) return;
      closePanel();
    });

    updateBadges();
    ChuwuContent.ready.then(refresh);
  });

  document.addEventListener('chuwu:cart', refresh);
  window.addEventListener('storage', function (e) { if (e.key === 'chuwu_cart_v1') refresh(); });

  window.ChuwuCartUI = { refresh: refresh, open: openPanel };
})();
