// CHUWU (初·五) — saves a new order from the checkout page into the "orders" store (Netlify Blobs),
// where the dashboard's Orders screen reads it. The checkout also sends the same order to Netlify
// Forms, which is what emails you; this copy is the one you can track (paid, shipped…).
//
// Public endpoint: anyone can call it, so it only accepts a well-formed order, caps every field's
// length, and never overwrites an existing order.
//
// Full Bazi Reading (digital, S$1.99):
// - the order's reading is queued and reading-email-background.mjs writes and emails it;
// - bought without any perfume, it earns a one-use S$1.99 perfume credit code (BAZI-XXXXXX);
// - a credit code used on this order is checked and marked used here.
// Customers who bought a reading or ticked "news & offers" are added to Subscribers.
import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';
import { readingItems, isPhysical, validateBirth, chartFacts, chartSummary, readingYear } from '../lib/reading-core.mjs';

const CREDIT_AMOUNT = 1.99;
const newCreditCode = () => 'BAZI-' + Array.from(randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

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
    totals: { subtotal: num(body.subtotal), discount: num(body.discount), reading_waiver: num(body.reading_waiver), credit: num(body.credit), delivery_fee: num(body.delivery_fee), total: num(body.total) },
    promotion: str(body.promotion, 120),
    credit_used: str(body.credit_code, 20).toUpperCase(),
    marketing: body.marketing === true,
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
  const credits = getStore({ name: 'credits', consistency: 'strong' });
  const now = order.created_at;

  // A credit code used on this order: must exist and be unused; it's used up now.
  if (order.credit_used) {
    const credit = await credits.get(order.credit_used, { type: 'json' });
    if (!credit || credit.used_at) return Response.json({ error: 'credit_invalid' }, { status: 409 });
    await credits.setJSON(order.credit_used, { ...credit, used_at: now, used_order: order.id });
  }

  const readings = readingItems(order);
  if (readings.length) {
    order.reading = { status: 'queued', queued_at: now };
    // Bought without perfume: S$1.99 back as a perfume credit.
    if (!order.items.some(isPhysical)) {
      const code = newCreditCode();
      const amount = Math.round(CREDIT_AMOUNT * readings.reduce((n, r) => n + r.item.quantity, 0) * 100) / 100;
      await credits.setJSON(code, { code, amount, order_id: order.id, email: order.customer.email, created_at: now, used_at: null });
      order.credit_issued = { code, amount };
    }
  }
  await store.setJSON(order.id, order);

  // Subscribers: reading buyers (with their chart) and anyone who ticked "news & offers".
  if (readings.length || order.marketing) {
    const subscribers = getStore({ name: 'subscribers', consistency: 'strong' });
    const email = order.customer.email.trim().toLowerCase();
    const prev = (await subscribers.get(email, { type: 'json' })) || { email, created_at: now, readings: 0 };
    const rec = { ...prev, name: order.customer.name || prev.name || '', marketing: order.marketing || prev.marketing || false, updated_at: now, readings: (prev.readings || 0) + readings.length, last_order: order.id };
    const v = readings.length && validateBirth(readings[0].birth);
    if (v && !v.error) {
      rec.birth = { date: v.date, time: v.time, place: v.place || 'Not specified', gender: v.gender };
      rec.chart = chartSummary(chartFacts(v, readingYear()));
    }
    await subscribers.setJSON(email, rec);
  }

  // Write and email the reading in the background (returns straight away).
  if (readings.length) {
    try {
      await fetch(new URL('/.netlify/functions/reading-email-background', req.url), { method: 'POST', body: JSON.stringify({ order_id: order.id }) });
    } catch (e) { console.error('could not start the reading email job', e); }
  }

  return Response.json({ ok: true, id: order.id, credit_code: order.credit_issued ? order.credit_issued.code : null, reading: !!readings.length }, { status: 201 });
};
