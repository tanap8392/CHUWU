/* CHUWU (初·五) — shared cart dropdown UI, wired to window.ChuwuShopify's persistent cart. */
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

  function formatPrice(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
    } catch (e) {
      return `${amount} ${currencyCode}`;
    }
  }

  let currentCart = null;

  function updateBadges() {
    const count = currentCart ? currentCart.totalQuantity : 0;
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  }

  function renderPanel() {
    const linesEl = document.getElementById('cart-lines');
    const subtotalEl = document.getElementById('cart-subtotal');
    const checkoutBtn = document.getElementById('cart-checkout');
    if (!linesEl || !subtotalEl || !checkoutBtn) return;
    linesEl.innerHTML = '';

    if (!currentCart || !currentCart.lines.nodes.length) {
      linesEl.appendChild(el('p', { class: 'cart-empty' }, [text('Your cart is empty.')]));
      subtotalEl.textContent = '—';
      checkoutBtn.classList.add('hidden');
      return;
    }

    checkoutBtn.classList.remove('hidden');
    checkoutBtn.setAttribute('href', currentCart.checkoutUrl);

    currentCart.lines.nodes.forEach(function (line) {
      const variant = line.merchandise;
      const product = variant.product;
      const attrs = (line.attributes || []).filter(function (a) { return a.value; });
      const attrsText = attrs.map(function (a) { return a.key + ': ' + a.value; }).join(' · ');

      const media = product.featuredImage
        ? el('img', { src: product.featuredImage.url, alt: product.featuredImage.altText || product.title }, [])
        : el('div', { class: 'cart-line-placeholder' }, []);

      const removeBtn = el('button', { class: 'cart-line-remove' }, [text('Remove')]);
      removeBtn.addEventListener('click', function () { removeLine(line.id); });

      const infoChildren = [
        el('div', { class: 'title' }, [text(product.title)])
      ];
      if (attrsText) infoChildren.push(el('div', { class: 'attrs' }, [text(attrsText)]));
      infoChildren.push(el('div', { class: 'qty-price' }, [
        el('span', {}, [text('Qty ' + line.quantity)]),
        el('span', {}, [text(formatPrice(variant.price.amount, variant.price.currencyCode))])
      ]));
      infoChildren.push(removeBtn);

      linesEl.appendChild(el('div', { class: 'cart-line' }, [media, el('div', { class: 'cart-line-info' }, infoChildren)]));
    });

    subtotalEl.textContent = formatPrice(currentCart.cost.subtotalAmount.amount, currentCart.cost.subtotalAmount.currencyCode);
  }

  async function refreshCart() {
    try {
      currentCart = await ChuwuShopify.getCurrentCart();
    } catch (err) {
      console.error('Could not load cart:', err);
      currentCart = null;
    }
    updateBadges();
    renderPanel();
  }

  async function removeLine(lineId) {
    try {
      currentCart = await ChuwuShopify.removeCartLine(lineId);
      updateBadges();
      renderPanel();
    } catch (err) {
      console.error('Could not remove cart line:', err);
    }
  }

  function openPanel() {
    const panel = document.getElementById('cart-panel');
    if (panel) panel.classList.add('open');
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

    document.addEventListener('click', function (e) {
      const panel = document.getElementById('cart-panel');
      if (!panel || !panel.classList.contains('open')) return;
      if (panel.contains(e.target) || e.target.closest('.cart-toggle')) return;
      closePanel();
    });

    refreshCart();
  });

  window.ChuwuCartUI = { refresh: refreshCart, open: openPanel };
})();
