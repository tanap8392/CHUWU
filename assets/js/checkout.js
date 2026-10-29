/* CHUWU (初·五) — checkout: customer details, delivery, promo code, then the order is sent to
   Netlify Forms (it appears under Netlify → Forms → "order", and Netlify can email it to you).
   After the order is placed the customer sees how to pay.

   Payment methods are listed in PAYMENT_METHODS. Today there is PayNow (manual: the customer pays,
   then sends a screenshot on WhatsApp). To add card payments later, add an entry whose `after`
   step sends the customer to a Stripe Checkout page created by a small Netlify Function. */
(function () {
  const LAST_ORDER_KEY = 'chuwu_last_order';

  const PAYMENT_METHODS = [
    {
      key: 'paynow',
      label: 'PayNow',
      describe: 'Pay by PayNow once you\'ve placed your order — we\'ll show you the details next.',
      enabled: checkout => checkout.paynow && checkout.paynow.enabled !== false,
      after: order => showConfirmation(order)
    }
  ];
  // Used when no method above is switched on in the dashboard.
  const FALLBACK_METHOD = {
    key: 'arrange',
    label: 'Arrange payment with us',
    describe: 'We\'ll contact you on WhatsApp to arrange payment.',
    after: order => showConfirmation(order)
  };

  let data;
  let selectedDelivery = null;
  let selectedPayment = null;
  let appliedCode = '';
  let orderPlaced = false;

  const $ = id => document.getElementById(id);

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  const money = amount => ChuwuContent.formatPrice(amount);
  const checkoutSettings = () => (data.settings && data.settings.checkout) || {};

  function currentLines() {
    return ChuwuCart.priced(data.products).lines;
  }

  function currentTotals() {
    return ChuwuCart.totals(currentLines(), data.promotions, appliedCode, selectedDelivery);
  }

  function renderOptions() {
    const deliveryWrap = $('delivery-options');
    deliveryWrap.innerHTML = '';
    const deliveries = checkoutSettings().delivery_options || [];
    deliveries.forEach((d, i) => {
      const fee = Number(d.fee) || 0;
      const freeOver = Number(d.free_over) || 0;
      let meta = fee > 0 ? money(fee) : 'Free';
      if (fee > 0 && freeOver > 0) meta += ` · free over ${money(freeOver)}`;
      const input = el('input', { type: 'radio', name: 'delivery', value: String(i) });
      if (i === 0) { input.checked = true; selectedDelivery = d; }
      input.addEventListener('change', () => { selectedDelivery = d; updateAddressField(); renderSummary(); });
      deliveryWrap.appendChild(el('label', { class: 'option-card' }, [input, el('span', {}, [d.label || 'Delivery', el('span', { class: 'option-meta' }, [meta])])]));
    });
    updateAddressField();

    const paymentWrap = $('payment-options');
    paymentWrap.innerHTML = '';
    const methods = PAYMENT_METHODS.filter(m => m.enabled(checkoutSettings()));
    (methods.length ? methods : [FALLBACK_METHOD]).forEach((m, i) => {
      const input = el('input', { type: 'radio', name: 'payment', value: m.key });
      if (i === 0) { input.checked = true; selectedPayment = m; }
      input.addEventListener('change', () => { selectedPayment = m; });
      paymentWrap.appendChild(el('label', { class: 'option-card' }, [input, el('span', {}, [m.label, el('span', { class: 'option-meta' }, [m.describe])])]));
    });
  }

  function updateAddressField() {
    // With no delivery options set up, still ask for an address.
    const needs = !selectedDelivery || selectedDelivery.needs_address !== false;
    $('address-field').classList.toggle('hidden', !needs);
  }

  function renderSummary() {
    const lines = currentLines();
    const linesWrap = $('summary-lines');
    linesWrap.innerHTML = '';
    lines.forEach(l => {
      const attrs = l.attributes.map(a => a.key + ': ' + a.value).join(' · ');
      linesWrap.appendChild(el('div', { class: 'summary-row' }, [
        el('span', {}, [
          `${l.quantity} × ${ChuwuContent.productTitle(l.product)}`,
          ...(attrs ? [el('span', { class: 'option-meta' }, [attrs])] : [])
        ]),
        el('span', {}, [money(l.lineTotal)])
      ]));
    });

    const t = currentTotals();
    const totalsWrap = $('summary-totals');
    totalsWrap.innerHTML = '';
    totalsWrap.appendChild(el('div', { class: 'summary-row' }, [el('span', {}, ['Subtotal']), el('span', {}, [money(t.subtotal)])]));
    if (t.discount > 0) {
      totalsWrap.appendChild(el('div', { class: 'summary-row discount' }, [el('span', {}, [t.promotion.name]), el('span', {}, ['−' + money(t.discount)])]));
    }
    if (selectedDelivery) {
      const label = t.deliveryWaivedByPromotion ? `Delivery (${t.promotion.name})` : 'Delivery';
      totalsWrap.appendChild(el('div', { class: 'summary-row' }, [el('span', {}, [label]), el('span', {}, [t.deliveryFee > 0 ? money(t.deliveryFee) : 'Free'])]));
    }
    totalsWrap.appendChild(el('div', { class: 'summary-row total' }, [el('span', {}, ['Total']), el('span', {}, [money(t.total)])]));

    const msg = $('promo-msg');
    if (appliedCode) {
      msg.classList.remove('hidden');
      msg.className = 'form-msg ' + (t.codeError ? 'error' : 'ok');
      msg.textContent = t.codeError || (t.promotion ? `${t.promotion.name} applied.` : '');
    } else {
      msg.classList.add('hidden');
    }
    return t;
  }

  function orderId() {
    const d = new Date();
    const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return `CW-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function itemsText(lines) {
    return lines.map(l => {
      const head = `${l.quantity} × ${ChuwuContent.productTitle(l.product)} — ${money(l.lineTotal)}`;
      return [head, ...l.attributes.map(a => `    ${a.key}: ${a.value}`)].join('\n');
    }).join('\n');
  }

  function validate(form) {
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const needsAddress = !$('address-field').classList.contains('hidden');
    if (!name) return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    if (phone.replace(/\D/g, '').length < 8) return 'Please enter your mobile number.';
    if (needsAddress && !form.address.value.trim()) return 'Please enter your delivery address.';
    return null;
  }

  function submitToNetlify(fields) {
    const body = new URLSearchParams({ 'form-name': 'order', ...fields }).toString();
    return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      .then(r => { if (!r.ok) throw new Error('Order form returned HTTP ' + r.status); });
  }

  function orderMessage(order) {
    return [
      `Hi CHUWU! New order ${order.id}`,
      '',
      order.items,
      '',
      `Total: ${money(order.total)}`,
      `Name: ${order.name}`,
      `Mobile: ${order.phone}`,
      `Email: ${order.email}`,
      `Delivery: ${order.delivery}`,
      ...(order.address ? [`Address: ${order.address}`] : []),
      ...(order.notes ? [`Notes: ${order.notes}`] : [])
    ].join('\n');
  }

  function showConfirmation(order) {
    $('checkout-main').classList.add('hidden');
    $('checkout-empty').classList.add('hidden');
    $('checkout-heading').textContent = order.sent ? 'Order Received' : 'Almost Done';
    const wrap = $('order-confirmation');
    wrap.innerHTML = '';
    wrap.classList.remove('hidden');

    const settings = checkoutSettings();
    if (order.sent) {
      wrap.appendChild(el('p', { class: 'center' }, [settings.thank_you_message || 'Thank you — we\'ve received your order.']));
    } else {
      wrap.appendChild(el('p', { class: 'form-msg error center', style: 'font-size:0.95rem' }, [
        'We couldn\'t send your order automatically. Please tap the WhatsApp button below to send it to us — your order isn\'t confirmed until we receive it.'
      ]));
    }

    const p = settings.paynow || {};
    const box = el('div', { class: 'paynow-box' });
    const rows = [['Order number', order.id], ['Amount', money(order.total)]];
    if (order.payment === 'paynow') {
      box.appendChild(el('h3', {}, ['Pay by PayNow']));
      if (p.payee_name) rows.push(['Pay to', p.payee_name]);
      if (p.uen_or_mobile) rows.push(['PayNow UEN / mobile', p.uen_or_mobile]);
      rows.push(['Reference', order.id]);
    } else {
      box.appendChild(el('h3', {}, ['Payment']));
    }
    box.appendChild(el('dl', {}, rows.flatMap(([k, v]) => [el('dt', {}, [k]), el('dd', {}, [v])])));
    if (order.payment === 'paynow' && p.qr_image) box.appendChild(el('img', { src: p.qr_image, alt: 'PayNow QR code' }));
    const instructions = order.payment === 'paynow' && (p.payee_name || p.uen_or_mobile || p.qr_image)
      ? p.instructions
      : 'We\'ll send you payment details on WhatsApp shortly.';
    if (instructions) box.appendChild(el('p', { class: 'muted', style: 'margin:16px 0 0;font-size:0.88rem' }, [instructions]));
    wrap.appendChild(box);

    const waText = order.sent
      ? `Hi CHUWU! I've placed order ${order.id} (${money(order.total)}). Here's my payment screenshot.`
      : orderMessage(order);
    wrap.appendChild(el('p', { class: 'center' }, [
      el('a', { class: 'btn btn-primary', href: ChuwuContent.whatsappLink(waText), target: '_blank', rel: 'noopener' }, [
        order.sent ? 'Send Payment Screenshot on WhatsApp' : 'Send Order on WhatsApp'
      ])
    ]));
    wrap.appendChild(el('p', { class: 'center', style: 'margin-top:16px' }, [el('a', { href: 'shop.html', style: 'text-decoration:underline' }, ['Continue shopping'])]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function placeOrder(e) {
    e.preventDefault();
    const form = e.target;
    const errorEl = $('checkout-error');
    errorEl.classList.add('hidden');
    const problem = validate(form);
    if (problem) {
      errorEl.textContent = problem;
      errorEl.classList.remove('hidden');
      return;
    }

    const lines = currentLines();
    const t = renderSummary();
    if (!lines.length) return;
    const needsAddress = !$('address-field').classList.contains('hidden');
    const order = {
      id: orderId(),
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      delivery: selectedDelivery ? selectedDelivery.label : '',
      address: needsAddress ? form.address.value.trim() : '',
      notes: form.notes.value.trim(),
      items: itemsText(lines),
      total: t.total,
      payment: selectedPayment.key
    };

    const btn = $('place-order');
    btn.disabled = true;
    btn.textContent = 'Placing order…';

    submitToNetlify({
      order_id: order.id,
      created_at: new Date().toISOString(),
      name: order.name,
      email: order.email,
      phone: order.phone,
      delivery_method: order.delivery,
      address: order.address,
      items: order.items,
      subtotal: t.subtotal.toFixed(2),
      promotion: t.promotion ? `${t.promotion.name}${t.promotion.code ? ' (' + t.promotion.code + ')' : ''}` : '',
      discount: t.discount.toFixed(2),
      delivery_fee: t.deliveryFee.toFixed(2),
      total: t.total.toFixed(2),
      payment_method: selectedPayment.label,
      notes: order.notes
    })
      .then(() => {
        order.sent = true;
        orderPlaced = true;
        try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order)); } catch (err) { /* ignore */ }
        ChuwuCart.clear();
      })
      .catch(err => {
        console.error(err);
        order.sent = false;
      })
      .then(() => {
        btn.disabled = false;
        btn.textContent = 'Place Order';
        selectedPayment.after(order);
      });
  }

  ChuwuContent.ready.then(loaded => {
    data = loaded;
    if (!currentLines().length) {
      let last = null;
      try { last = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY)); } catch (err) { /* ignore */ }
      if (last) showConfirmation(last);
      else $('checkout-empty').classList.remove('hidden');
      return;
    }
    $('checkout-main').classList.remove('hidden');
    renderOptions();
    renderSummary();

    $('apply-promo').addEventListener('click', () => {
      appliedCode = $('co-promo').value.trim();
      renderSummary();
    });
    $('co-promo').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); $('apply-promo').click(); }
    });
    $('checkout-form').addEventListener('submit', placeOrder);
    // Cart edits made from the cart panel on this page update the summary.
    document.addEventListener('chuwu:cart', () => {
      if (orderPlaced) return;
      if (!currentLines().length) location.reload();
      else renderSummary();
    });
  });
})();
