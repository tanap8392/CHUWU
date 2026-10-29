// CHUWU (初·五) — saves a new order from the checkout page into the "orders" store (Netlify Blobs),
// where the dashboard's Orders screen reads it. The checkout also sends the same order to Netlify
// Forms, which is what emails you; this copy is the one you can track (paid, shipped…).
//
// Public endpoint: anyone can call it, so it only accepts a well-formed order, caps every field's
// length, and never overwrites an existing order.
import { getStore } from '@netlify/blobs';

const ID_PATTERN = /^CW-\d{6}-[A-Z0-9]{4}$/;

const str = (v, max) => String(v == null ? '' : v).slice(0, max);
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);

function cleanOrder(body) {
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map(i => ({
    product_id: str(i.product_id, 60),
    title: str(i.title, 200),
    quantity: Math.max(1, Math.min(99, parseInt(i.quantity, 10) || 1)),
    unit_price: num(i.unit_price),
    line_total: num(i.line_total),
    attributes: (Array.isArray(i.attributes) ? i.attributes : []).slice(0, 12).map(a => ({ key: str(a.key, 60), value: str(a.value, 300) }))
  }));
  const now = new Date().toISOString();
  return {
    id: str(body.id, 20),
    created_at: now,
    status: 'awaiting_payment',
    status_history: [{ status: 'awaiting_payment', at: now }],
    customer: { name: str(body.name, 120), email: str(body.email, 160), phone: str(body.phone, 40) },
    delivery: { method: str(body.delivery_method, 120), address: str(body.address, 500) },
    items,
    totals: { subtotal: num(body.subtotal), discount: num(body.discount), delivery_fee: num(body.delivery_fee), total: num(body.total) },
    promotion: str(body.promotion, 120),
    payment_method: str(body.payment_method, 60),
    notes: str(body.notes, 1000),
    gift: { is_gift: !!body.is_gift, message: str(body.gift_message, 500) },
    admin_note: ''
  };
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const text = await req.text();
  if (text.length > 50000) return new Response('Order too large', { status: 413 });

  let body;
  try { body = JSON.parse(text || '{}'); } catch (e) { return new Response('Invalid JSON', { status: 400 }); }

  const order = cleanOrder(body);
  if (!ID_PATTERN.test(order.id) || !order.items.length || !order.customer.name || !order.customer.phone) {
    return new Response('Missing order details', { status: 400 });
  }

  const store = getStore({ name: 'orders', consistency: 'strong' });
  if (await store.get(order.id)) return new Response('Order already exists', { status: 409 });
  await store.setJSON(order.id, order);
  return Response.json({ ok: true, id: order.id }, { status: 201 });
};
