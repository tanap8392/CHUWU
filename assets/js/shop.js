(function () {
  const STOCK_LABEL = { in_stock: 'In Stock', low_stock: 'Low Stock', sold_out: 'Sold Out' };
  const ELEMENT_COLOR_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };

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

  function productCard(p) {
    const tags = p.elements.map(e =>
      el('span', { class: 'tag', style: `background:var(${ELEMENT_COLOR_VAR[e]});color:#fff` }, [text(e)])
    );

    const enquireHref = `mailto:hello@chuwu.com?subject=${encodeURIComponent('Order - ' + p.name)}`;
    const enquireBtn = p.stock === 'sold_out'
      ? el('button', { class: 'btn', disabled: 'disabled' }, [text('Sold Out')])
      : el('a', { href: enquireHref, class: 'btn btn-primary' }, [text('Enquire')]);

    return el('div', { class: 'product-card ' + p.stock }, [
      el('div', { class: 'product-media' }, [
        el('div', { class: 'bottle', style: `background:linear-gradient(180deg,${p.colorFrom},${p.colorTo})` }, [])
      ]),
      el('div', { class: 'product-body' }, [
        el('span', { class: 'stock-badge ' + p.stock }, [text(STOCK_LABEL[p.stock] || '')]),
        el('span', { class: 'zh' }, [text(p.zh)]),
        el('h3', {}, [text(p.name)]),
        el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text('For ' + p.aspect + ' · ' + p.elements.join(' & '))]),
        el('div', { class: 'product-tags' }, tags),
        el('div', { class: 'note-line' }, [el('b', {}, [text('Top:')]), text(' ' + p.top)]),
        el('div', { class: 'note-line' }, [el('b', {}, [text('Middle:')]), text(' ' + p.middle)]),
        el('div', { class: 'note-line' }, [el('b', {}, [text('Base:')]), text(' ' + p.base)]),
        el('div', { class: 'price-row' }, [
          el('span', { class: 'price' }, [text('$' + p.price)]),
          enquireBtn
        ])
      ])
    ]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const grid = document.getElementById('shop-grid');
    fetch('content/products.json')
      .then(r => r.json())
      .then(data => {
        grid.innerHTML = '';
        data.products.forEach(p => grid.appendChild(productCard(p)));
      })
      .catch(err => {
        grid.innerHTML = '';
        grid.appendChild(el('p', { class: 'muted center' }, [text('Unable to load products right now — please try again shortly.')]));
        console.error(err);
      });
  });
})();
