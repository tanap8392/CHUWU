/* CHUWU (初·五) — Meta Pixel and Google Analytics 4, switched on by filling in their IDs at
   /admin → Site Settings → Marketing. With no IDs set, nothing is loaded and every call below
   does nothing.

   Events sent: page views (automatic), AddToCart, InitiateCheckout and Purchase — the ones Meta
   and Google use to measure which ads lead to sales. */
(function (root) {
  let pixel = false;
  let ga = false;

  function loadScript(src) {
    const s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function initPixel(id) {
    /* Meta's standard loader: defines fbq() and queues calls until the library arrives. */
    const f = root;
    if (f.fbq) return;
    const n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    f.fbq('init', id);
    f.fbq('track', 'PageView');
    pixel = true;
  }

  function initGa(id) {
    root.dataLayer = root.dataLayer || [];
    root.gtag = function () { root.dataLayer.push(arguments); };
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
    root.gtag('js', new Date());
    root.gtag('config', id);
    ga = true;
  }

  const currency = () => (root.ChuwuContent && ChuwuContent.get('settings.currency')) || 'SGD';
  const gaItems = lines => lines.map(l => ({ item_id: l.productId, item_name: l.product.name || l.product.code, price: l.unitPrice, quantity: l.quantity }));

  function addToCart(product, quantity, size) {
    if (!product) return;
    const sz = root.ChuwuContent.sizeOf(product, size);
    const price = sz ? sz.price : product.price;
    const value = price * quantity;
    if (pixel) root.fbq('track', 'AddToCart', { content_ids: [product.id], content_type: 'product', value, currency: currency() });
    if (ga) root.gtag('event', 'add_to_cart', { currency: currency(), value, items: [{ item_id: product.id, item_name: product.name || product.code, item_variant: size || undefined, price, quantity }] });
  }

  function beginCheckout(total, lines) {
    if (pixel) root.fbq('track', 'InitiateCheckout', { value: total, currency: currency(), num_items: lines.length });
    if (ga) root.gtag('event', 'begin_checkout', { currency: currency(), value: total, items: gaItems(lines) });
  }

  // Sent when the order is placed (payment by PayNow happens afterwards, outside the site).
  function purchase(orderId, total, lines) {
    if (pixel) root.fbq('track', 'Purchase', { value: total, currency: currency(), content_ids: lines.map(l => l.productId), content_type: 'product' });
    if (ga) root.gtag('event', 'purchase', { transaction_id: orderId, currency: currency(), value: total, items: gaItems(lines) });
  }

  if (root.ChuwuContent) {
    ChuwuContent.ready.then(data => {
      const m = (data.settings && data.settings.marketing) || {};
      if (m.meta_pixel_id) initPixel(String(m.meta_pixel_id).trim());
      if (m.ga4_id) initGa(String(m.ga4_id).trim());
    });
  }

  // Someone unlocked the free Bazi reading with their email.
  function lead() {
    if (pixel) root.fbq('track', 'Lead', { content_name: 'Free Bazi reading' });
    if (ga) root.gtag('event', 'generate_lead', { method: 'Free Bazi reading' });
  }

  root.ChuwuTrack = { addToCart, beginCheckout, purchase, lead };
})(typeof window !== 'undefined' ? window : globalThis);
