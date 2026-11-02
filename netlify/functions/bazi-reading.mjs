// CHUWU (初·五) — the Bazi reading on the Bazi page.
//
// POST { section, date, time, place, gender, order_id?, email? }
//   - "profile" (Who You Are) is the free sneak peek: anyone can ask for it. The page shows the
//     first paragraphs and fades the rest behind the S$1.99 unlock.
//   - every other part ("luck", "year", "months", "next") is only for a placed order that includes
//     the Full Bazi Reading for these exact birth details (order_id + the order's email).
//
// Parts are written by Claude (via Netlify's AI Gateway, see netlify/lib/reading-core.mjs) and
// cached by birth details, so a chart is only ever paid for once. After a purchase the whole
// reading is written and emailed by reading-email-background.mjs; while that is still running,
// this returns 202 so the page waits for it instead of writing the same parts twice.
import { getStore } from '@netlify/blobs';
import {
  Anthropic, SECTIONS, LIMIT_PER_IP_PER_DAY, sha, readingYear, validateBirth, chartFacts,
  getCached, getOrWrite, ordersStore, readingItems, sameBirth
} from '../lib/reading-core.mjs';

const json = (status, data) => Response.json(data, { status });

async function underLimit(store, key, limit) {
  const n = Number(await store.get(key)) || 0;
  if (n >= limit) return false;
  await store.set(key, String(n + 1));
  return true;
}

// The order must include the Full Bazi Reading for these birth details.
async function paidOrder(body, v) {
  const id = String(body.order_id || '');
  const email = String(body.email || '').trim().toLowerCase();
  if (!id || !email) return null;
  const order = await ordersStore().get(id, { type: 'json' });
  if (!order || order.status === 'cancelled' || String(order.customer.email).toLowerCase() !== email) return null;
  return readingItems(order).some(r => sameBirth(r.birth, v)) ? order : null;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'Invalid request.' }); }
  if (!SECTIONS[body.section]) return json(400, { error: 'Unknown section.' });
  const v = validateBirth({ ...body, gender: body.gender || 'female' }); // the free peek doesn't depend on gender
  if (v.error) return json(400, { error: v.error });

  const year = readingYear();
  const section = body.section;

  let order = null;
  if (section !== 'profile') {
    order = await paidOrder(body, v);
    if (!order) return json(402, { error: 'locked' });
  }

  const cached = await getCached(section, v, year);
  if (cached) return json(200, { section, year, reading: cached, cached: true });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'not_configured' });

  // After a purchase the email job writes every part; wait for it rather than paying twice.
  if (order && order.reading && order.reading.status === 'writing' && Date.now() - Date.parse(order.reading.started_at) < 180000) {
    return json(202, { pending: true });
  }

  // Fair-use limit on fresh free peeks (each costs a little to write). Paid parts aren't limited.
  if (!order) {
    const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    const limits = getStore({ name: 'reading-limits' });
    if (!(await underLimit(limits, `${new Date().toISOString().slice(0, 10)}:ip:${sha(ip)}`, LIMIT_PER_IP_PER_DAY))) {
      return json(429, { error: 'You’ve reached today’s limit for new readings — please try again tomorrow.' });
    }
  }

  try {
    const { reading } = await getOrWrite(section, v, year, chartFacts(v, year));
    return json(200, { section, year, reading });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' }); // incl. the AI Gateway's per-minute credit limit
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: 'not_configured' });
    if (e instanceof Anthropic.APIError) { console.error('Anthropic', e.status, e.message); return json(502, { error: 'failed' }); }
    console.error(e);
    return json(502, { error: 'failed' });
  }
};
