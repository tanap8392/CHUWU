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

  // Fills `target` with the price of one size entry ({ price, compare_at_price }). With `from`,
  // it reads "From S$19.90" (no size chosen yet).
  function renderPrice(target, entry, from) {
    target.innerHTML = '';
    if (from) target.append(el('span', { class: 'price-from' }, ['From ']));
    if (entry.compare_at_price && entry.compare_at_price > entry.price) {
      target.append(el('s', { class: 'compare-price' }, [ChuwuContent.formatPrice(entry.compare_at_price)]), ' ');
    }
    target.append(ChuwuContent.formatPrice(entry.price));
  }

  // Returns { node, selected(), ask() } — node is null for single-size products. With several sizes
  // none is chosen to start with (selected() is null) and the price reads "From …"; onChange(entry)
  // runs whenever the customer picks a size. ask() points the customer at the picker when they try to
  // add to cart without choosing.
  function sizePicker(p, onChange) {
    const sizes = p.sizes || [];
    let current = sizes.length === 1 ? sizes[0] : sizes.length ? null : { size: p.size, price: p.price, compare_at_price: p.compare_at_price };
    if (sizes.length < 2) return { node: null, selected: () => current, ask() {} };
    const hint = el('span', { class: 'size-hint', role: 'alert' }, []);
    const node = el('div', { class: 'size-picker', role: 'radiogroup', 'aria-label': 'Size' }, []);
    sizes.forEach(s => {
      const b = el('button', { type: 'button', class: 'size-opt', role: 'radio', 'aria-checked': 'false' }, [s.size]);
      b.addEventListener('click', () => {
        current = s;
        node.classList.remove('needs-choice'); hint.textContent = '';
        node.querySelectorAll('.size-opt').forEach(x => {
          x.classList.toggle('active', x === b);
          x.setAttribute('aria-checked', x === b ? 'true' : 'false');
        });
        onChange(s);
      });
      node.appendChild(b);
    });
    node.appendChild(hint);
    return {
      node,
      selected: () => current,
      ask() {
        hint.textContent = 'Choose a size';
        node.classList.remove('needs-choice'); void node.offsetWidth; node.classList.add('needs-choice');
      }
    };
  }

  // The price for a card before/after a size is chosen.
  function showPrice(target, p, picker) {
    const entry = picker.selected();
    if (entry) return renderPrice(target, entry);
    const sizes = p.sizes || [];
    const cheapest = sizes.reduce((a, b) => (b.price < a.price ? b : a), sizes[0]);
    renderPrice(target, cheapest, true);
  }

  // Square product image. With a second photo (Products → More photos), hovering shows it on a
  // computer; on a phone, where there's no hover, tapping switches photos and dots show there's more.
  // box.showSize(entry) swaps the main photo for that size's own photo (Products → Sizes → Photo);
  // the second photo stays the same for every size.
  function media(p, className) {
    const photos = [p.image].concat((p.gallery || []).map(g => (typeof g === 'string' ? g : g && g.image))).filter(Boolean);
    const box = el('div', { class: className + (photos.length > 1 ? ' has-alt' : '') }, []);
    const alt = p.name || ((p.code || '') + ' ' + (p.element || '')).trim();
    if (!photos.length) {
      box.appendChild(el('div', { class: 'bottle', style: 'background:linear-gradient(180deg,#C8B38A,#2D2A28)' }, []));
    } else {
      box.appendChild(el('img', { src: photos[0], alt, class: 'media-main', loading: 'lazy' }, []));
      if (photos[1]) box.appendChild(el('img', { src: photos[1], alt: '', class: 'media-alt', loading: 'lazy', 'aria-hidden': 'true' }, []));
    }
    const main = box.querySelector('.media-main');
    box.showSize = entry => {
      const src = (entry && entry.image) || p.image;
      if (main && src && main.getAttribute('src') !== src) main.setAttribute('src', src);
      if (box.classList.contains('show-alt')) box.click(); // on a phone, go back to the bottle photo
    };
    // Preload the other sizes' photos so switching is instant.
    (p.sizes || []).forEach(s => { if (s.image && s.image !== photos[0]) { const i = new Image(); i.loading = 'lazy'; i.src = s.image; } });
    if (p.badge) box.appendChild(el('span', { class: 'product-badge' }, [p.badge]));
    if (photos.length > 1) {
      const dots = el('div', { class: 'media-dots', 'aria-hidden': 'true' }, [el('span', { class: 'on' }, []), el('span', {}, [])]);
      box.appendChild(dots);
      box.addEventListener('click', () => {
        if (window.matchMedia('(hover: hover)').matches) return;
        const showing = box.classList.toggle('show-alt');
        dots.children[0].classList.toggle('on', !showing);
        dots.children[1].classList.toggle('on', showing);
      });
    }
    return box;
  }

  // Whole-number percentages that always add up to 100 (largest-remainder rounding).
  function percentages(mix) {
    const total = mix.reduce((s, m) => s + m.votes, 0);
    const raw = mix.map(m => (m.votes / total) * 100);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((s, n) => s + n, 0);
    raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) out[i]++; });
    return out;
  }

  // "Element mix": a bar in the element colours, sized by each element's share, plus a legend.
  // Largest share first. Returns null when the product has no mix recorded.
  function elementMix(p) {
    const mix = (p.element_mix || []).slice().sort((a, b) => b.votes - a.votes);
    if (!mix.length) return null;
    const pct = percentages(mix);
    const color = e => `var(--${String(e).toLowerCase()})`;
    return el('div', { class: 'element-mix', title: 'Element mix' }, [
      el('div', { class: 'mix-bar' }, mix.map((m, i) => el('span', { style: `width:${pct[i]}%;background:${color(m.element)}` }, []))),
      el('div', { class: 'mix-legend' }, mix.map((m, i) => el('span', {}, [el('i', { style: `background:${color(m.element)}` }, []), `${m.element} ${pct[i]}%`])))
    ]);
  }

  // Order of the sections on an element-scent card (Site Settings → Product card layout).
  // Sections left out of the list are hidden.
  // The scent family is always recorded (it drives the Shop filter) but only shown when added here.
  const CARD_SECTIONS = ['profile', 'family', 'element', 'mix', 'description', 'notes', 'similar'];
  const DEFAULT_LAYOUT = ['profile', 'element', 'mix', 'description', 'notes', 'similar'];
  function cardLayout() {
    const order = ChuwuContent.get('settings.card_layout');
    return Array.isArray(order) && order.length ? order.filter(k => CARD_SECTIONS.includes(k)) : DEFAULT_LAYOUT;
  }

  root.ChuwuProductUI = { renderPrice, showPrice, sizePicker, media, elementMix, cardLayout };
})(typeof window !== 'undefined' ? window : globalThis);
