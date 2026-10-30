/* CHUWU (初·五) — pieces shared by the Shop page and the Bazi page's recommendations: the price
   (with an optional crossed-out original price) and the 10ml / 30ml size picker for products sold
   in several sizes (Products → Sizes in the dashboard). */
(function (root) {
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  // Fills `target` with the price of one size entry ({ price, compare_at_price }).
  function renderPrice(target, entry) {
    target.innerHTML = '';
    if (entry.compare_at_price && entry.compare_at_price > entry.price) {
      target.append(el('s', { class: 'compare-price' }, [ChuwuContent.formatPrice(entry.compare_at_price)]), ' ');
    }
    target.append(ChuwuContent.formatPrice(entry.price));
  }

  // Returns { node, selected() } — node is null for single-size products. The smallest size starts
  // selected; onChange(entry) runs whenever the customer picks another size.
  function sizePicker(p, onChange) {
    const sizes = p.sizes || [];
    let current = sizes[0] || { size: p.size, price: p.price, compare_at_price: p.compare_at_price };
    if (sizes.length < 2) return { node: null, selected: () => current };
    const node = el('div', { class: 'size-picker', role: 'radiogroup', 'aria-label': 'Size' }, []);
    sizes.forEach((s, i) => {
      const b = el('button', { type: 'button', class: 'size-opt' + (i === 0 ? ' active' : ''), role: 'radio', 'aria-checked': i === 0 ? 'true' : 'false' }, [s.size]);
      b.addEventListener('click', () => {
        current = s;
        node.querySelectorAll('.size-opt').forEach(x => {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        });
        onChange(s);
      });
      node.appendChild(b);
    });
    return { node, selected: () => current };
  }

  root.ChuwuProductUI = { renderPrice, sizePicker };
})(typeof window !== 'undefined' ? window : globalThis);
