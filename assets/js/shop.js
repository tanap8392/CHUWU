(function () {
  const ELEMENT_COLOR_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  const ELEMENT_KEYS = Object.keys(ELEMENT_COLOR_VAR);
  const NOTES_PATTERN = /Top:\s*([^·]+?)\s*·\s*Middle:\s*([^·]+?)\s*·\s*Base:\s*(.+)$/;

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

  function parseNotes(description) {
    const m = description.match(NOTES_PATTERN);
    if (!m) return { blurb: description, top: null, middle: null, base: null };
    return { blurb: description.slice(0, m.index).trim(), top: m[1].trim(), middle: m[2].trim(), base: m[3].trim() };
  }

  function buyNow(variantId, productTitle, btn) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Preparing checkout…';
    ChuwuShopify.createCartAndGetCheckoutUrl([{ merchandiseId: variantId, quantity: 1 }])
      .then(url => { window.location.href = url; })
      .catch(err => {
        console.error(err);
        btn.disabled = false;
        btn.textContent = originalText;
        alert(`Sorry, something went wrong starting checkout for ${productTitle}. Please try again.`);
      });
  }

  function productCard(p) {
    const variant = p.variants.nodes[0];
    const elementTags = p.tags.filter(t => ELEMENT_KEYS.includes(t));
    const aspectTag = p.tags.find(t => /Luck|Balance/i.test(t));
    const parsed = parseNotes(p.description || '');
    const soldOut = !variant.availableForSale;
    const isPersonalized = /personalized chu wu blend/i.test(p.title);

    const tagEls = elementTags.map(e =>
      el('span', { class: 'tag', style: `background:var(${ELEMENT_COLOR_VAR[e]});color:#fff` }, [text(e)])
    );

    let buyBtn;
    if (soldOut) {
      buyBtn = el('button', { class: 'btn', disabled: 'disabled' }, [text('Sold Out')]);
    } else if (isPersonalized) {
      buyBtn = el('a', { href: 'customize.html', class: 'btn btn-primary' }, [text('Personalize')]);
    } else {
      buyBtn = el('button', { class: 'btn btn-primary' }, [text('Buy Now')]);
      buyBtn.addEventListener('click', () => buyNow(variant.id, p.title, buyBtn));
    }

    const media = p.featuredImage
      ? el('img', { src: p.featuredImage.url, alt: p.featuredImage.altText || p.title, style: 'width:100%;height:100%;object-fit:cover' }, [])
      : el('div', { class: 'bottle', style: 'background:linear-gradient(180deg,#C8B38A,#2D2A28)' }, []);

    const noteLines = [];
    if (parsed.top) noteLines.push(el('div', { class: 'note-line' }, [el('b', {}, [text('Top:')]), text(' ' + parsed.top)]));
    if (parsed.middle) noteLines.push(el('div', { class: 'note-line' }, [el('b', {}, [text('Middle:')]), text(' ' + parsed.middle)]));
    if (parsed.base) noteLines.push(el('div', { class: 'note-line' }, [el('b', {}, [text('Base:')]), text(' ' + parsed.base)]));

    return el('div', { class: 'product-card' + (soldOut ? ' sold_out' : '') }, [
      el('div', { class: 'product-media' }, [media]),
      el('div', { class: 'product-body' }, [
        soldOut ? el('span', { class: 'stock-badge sold_out' }, [text('Sold Out')]) : text(''),
        el('h3', {}, [text(p.title)]),
        aspectTag ? el('p', { class: 'muted', style: 'font-size:0.9rem' }, [text('For ' + aspectTag)]) : text(''),
        el('div', { class: 'product-tags' }, tagEls),
        el('p', { class: 'muted', style: 'font-size:0.85rem' }, [text(parsed.blurb)]),
        ...noteLines,
        el('div', { class: 'price-row' }, [
          el('span', { class: 'price' }, [text(formatPrice(variant.price.amount, p.priceRange.minVariantPrice.currencyCode))]),
          buyBtn
        ])
      ])
    ]);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const grid = document.getElementById('shop-grid');
    const gridPersonalized = document.getElementById('shop-grid-personalized');
    ChuwuShopify.fetchProducts()
      .then(products => {
        const personalized = products.filter(p => /personalized chu wu blend/i.test(p.title));
        const signature = products.filter(p => !/personalized chu wu blend/i.test(p.title));

        grid.innerHTML = '';
        signature.forEach(p => grid.appendChild(productCard(p)));

        gridPersonalized.innerHTML = '';
        personalized
          .sort((a, b) => parseFloat(a.variants.nodes[0].price.amount) - parseFloat(b.variants.nodes[0].price.amount))
          .forEach(p => gridPersonalized.appendChild(productCard(p)));
      })
      .catch(err => {
        grid.innerHTML = '';
        grid.appendChild(el('p', { class: 'muted center' }, [text('Unable to load products right now — please try again shortly.')]));
        gridPersonalized.innerHTML = '';
        console.error(err);
      });
  });
})();
