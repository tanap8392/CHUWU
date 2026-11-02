// CHUWU (初·五) — after an order with the Full Bazi Reading is placed, this background function
// (Netlify allows up to 15 minutes) writes every part of the reading and emails it to the customer.
//
// Started by place-order.mjs, or by "Resend reading email" on the Orders screen. It only acts on an
// order whose reading status is "queued", so calling it again for the same order does nothing.
// Progress is kept on the order (order.reading): queued → writing → sent, or
// written (no email set up: GMAIL_USER / GMAIL_APP_PASSWORD missing) or failed (with the reason).
import {
  readingYear, validateBirth, chartFacts, getOrWrite, fullSections, ordersStore, readingItems
} from '../lib/reading-core.mjs';
import { buildReadingEmail, sendEmail, emailConfigured } from '../lib/reading-email.mjs';

async function setStatus(store, id, patch) {
  const order = await store.get(id, { type: 'json' });
  order.reading = { ...(order.reading || {}), ...patch };
  await store.setJSON(id, order);
  return order;
}

// Write one part, trying twice (a timeout or a busy moment shouldn't lose the email).
async function part(section, v, year, facts) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return (await getOrWrite(section, v, year, facts)).reading; }
    catch (e) { console.error(`reading part ${section} failed (try ${attempt + 1})`, e.message); }
  }
  return null;
}

export default async (req) => {
  let body = {};
  try { body = await req.json(); } catch (e) { return; }
  const store = ordersStore();
  const id = String(body.order_id || '');
  const order = id && (await store.get(id, { type: 'json' }));
  if (!order || !order.reading || order.reading.status !== 'queued') return;

  await setStatus(store, id, { status: 'writing', started_at: new Date().toISOString(), error: '' });
  const year = readingYear();
  const sections = fullSections(year);

  const readings = [];
  for (const { birth } of readingItems(order)) {
    const v = validateBirth(birth);
    if (v.error) continue;
    const facts = chartFacts(v, year);
    const written = await Promise.all(sections.map(s => part(s, v, year, facts)));
    readings.push({ facts, year, parts: Object.fromEntries(sections.map((s, i) => [s, written[i]])) });
  }
  const missing = readings.reduce((n, r) => n + Object.values(r.parts).filter(x => !x).length, 0);
  if (!readings.length || missing === sections.length * readings.length) {
    await setStatus(store, id, { status: 'failed', error: 'The reading could not be written. Use "Resend reading email" to try again.' });
    return;
  }

  if (!emailConfigured()) {
    await setStatus(store, id, { status: 'written', error: 'Reading written, but email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD).' });
    return;
  }
  try {
    const siteUrl = process.env.URL || new URL(req.url).origin;
    const email = buildReadingEmail({ order, readings, creditCode: order.credit_issued && order.credit_issued.code, siteUrl });
    await sendEmail({ to: order.customer.email, ...email });
    await setStatus(store, id, { status: 'sent', sent_at: new Date().toISOString(), error: missing ? `${missing} part(s) could not be written and were left out.` : '' });
  } catch (e) {
    console.error('reading email failed', e);
    await setStatus(store, id, { status: 'failed', error: 'Email could not be sent: ' + String(e.message || e).slice(0, 200) });
  }
};
