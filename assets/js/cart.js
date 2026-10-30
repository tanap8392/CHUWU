/* CHUWU (初·五) — the shopping cart (kept in this browser's localStorage) and the pricing maths
   shared by the cart panel and checkout: subtotal, promotions, delivery fee, total.

   The cart stores only product ids, quantities and blend details. Prices are always read from
   content/products.json, so a price change made in the dashboard also applies to carts filled
   before the change. Items whose product was removed, hidden, or marked sold out / coming soon
   come back as `unavailable` and are left out of the total. */
(function (root) {
  const KEY = 'chuwu_cart_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(lines) {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) { /* storage blocked */ }
    document.dispatchEvent(new CustomEvent('chuwu:cart'));
  }

  // Identical items (same product, size and blend details) stack into one line. `size` is only
  // given for products sold in several sizes (e.g. "10ml" / "30ml").
  function add(productId, quantity, attributes, size) {
    const lines = load();
    const attrs = (attributes || []).filter(a => a.value);
    const sig = JSON.stringify(attrs);
    const existing = lines.find(l => l.productId === productId && (l.size || null) === (size || null) && JSON.stringify(l.attributes) === sig);
    if (existing) existing.quantity += quantity;
    else lines.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), productId, size: size || null, quantity, attributes: attrs });
    save(lines);
    if (root.ChuwuTrack && root.ChuwuContent) {
      root.ChuwuTrack.addToCart((root.ChuwuContent.data.products || []).find(p => p.id === productId), quantity, size);
    }
  }

  function setQuantity(lineId, quantity) {
    const lines = load();
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    if (quantity <= 0) lines.splice(lines.indexOf(line), 1);
    else line.quantity = quantity;
    save(lines);
  }

  function remove(lineId) { setQuantity(lineId, 0); }
  function clear() { save([]); }
  function count() { return load().reduce((n, l) => n + l.quantity, 0); }

  function priced(products) {
    const byId = {};
    products.forEach(p => { byId[p.id] = p; });
    const lines = [];
    const unavailable = [];
    load().forEach(l => {
      const product = byId[l.productId];
      // A size that was removed from the product in the dashboard makes the line unavailable.
      const sz = product && root.ChuwuContent.sizeOf(product, l.size);
      if (product && product.status === 'active' && sz) {
        lines.push({ ...l, product, size: sz.size, unitPrice: sz.price, lineTotal: round2(sz.price * l.quantity) });
      } else {
        unavailable.push({ ...l, product: product || null });
      }
    });
    return { lines, unavailable };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // Dates from the dashboard are plain YYYY-MM-DD; an end date includes that whole day.
  function parseDay(value, endOfDay) {
    if (!value) return null;
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (endOfDay) d.setDate(d.getDate() + 1);
    return d;
  }

  function isLive(promo, now) {
    if (!promo.active) return false;
    const starts = parseDay(promo.starts, false);
    const ends = parseDay(promo.ends, true);
    if (starts && now < starts) return false;
    if (ends && now >= ends) return false;
    return true;
  }

  // What one promotion is worth on this cart, or a reason it doesn't apply.
  function evaluate(promo, lines, subtotal, deliveryFee) {
    const min = Number(promo.min_subtotal) || 0;
    if (min > 0 && subtotal < min) return { error: `Spend ${root.ChuwuContent.formatPrice(min)} or more to use this code.` };
    const scope = promo.applies_to || 'all';
    const base = round2(lines.filter(l => scope === 'all' || l.product.type === scope).reduce((s, l) => s + l.lineTotal, 0));
    if (base <= 0) return { error: 'This code doesn\'t apply to the items in your cart.' };
    const value = Number(promo.value) || 0;
    if (promo.type === 'free_delivery') return { discount: 0, freeDelivery: true, saving: deliveryFee };
    const discount = promo.type === 'fixed' ? Math.min(value, base) : round2(base * Math.min(value, 100) / 100);
    return { discount, freeDelivery: false, saving: discount };
  }

  // delivery: one of settings.checkout.delivery_options (or null). code: what the customer typed.
  // Applies the single best offer among auto-applied promotions and the entered code.
  function totals(lines, promotions, code, delivery) {
    const now = new Date();
    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    let deliveryFee = delivery ? Number(delivery.fee) || 0 : 0;
    const freeOver = delivery ? Number(delivery.free_over) || 0 : 0;
    if (freeOver > 0 && subtotal >= freeOver) deliveryFee = 0;

    const typed = (code || '').trim().toUpperCase();
    let codeError = null;
    let best = null;
    promotions.forEach(promo => {
      const matchesCode = typed && promo.code && promo.code.trim().toUpperCase() === typed;
      if (!promo.auto_apply && !matchesCode) return;
      if (!isLive(promo, now)) return;
      const result = evaluate(promo, lines, subtotal, deliveryFee);
      if (result.error) { if (matchesCode) codeError = result.error; return; }
      if (!best || result.saving > best.saving) best = { ...result, promo };
    });
    const codeMatchedSomething = typed && promotions.some(p => p.code && p.code.trim().toUpperCase() === typed && isLive(p, now));
    if (typed && !codeMatchedSomething) codeError = 'This code isn\'t valid right now.';

    const discount = best ? best.discount : 0;
    const appliedDelivery = best && best.freeDelivery ? 0 : deliveryFee;
    return {
      subtotal,
      discount,
      deliveryFee: appliedDelivery,
      deliveryWaivedByPromotion: !!(best && best.freeDelivery && deliveryFee > 0),
      promotion: best ? { name: best.promo.name, code: best.promo.code || '' } : null,
      codeError,
      total: round2(Math.max(0, subtotal - discount) + appliedDelivery)
    };
  }

  root.ChuwuCart = { load, add, setQuantity, remove, clear, count, priced, totals };
})(typeof window !== 'undefined' ? window : globalThis);
