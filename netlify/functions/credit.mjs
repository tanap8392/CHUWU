// CHUWU (初·五) — checks a reading credit code at checkout (GET ?code=BAZI-XXXXXX).
// Codes are issued by place-order.mjs when the Full Bazi Reading is bought on its own: S$1.99 off
// a perfume, one use. Checking doesn't use the code up; placing the order does.
import { getStore } from '@netlify/blobs';

export default async (req) => {
  const code = String(new URL(req.url).searchParams.get('code') || '').trim().toUpperCase();
  if (!/^BAZI-[A-Z0-9]{6}$/.test(code)) return Response.json({ valid: false, error: 'This code isn’t valid.' });
  const credit = await getStore({ name: 'credits', consistency: 'strong' }).get(code, { type: 'json' });
  if (!credit) return Response.json({ valid: false, error: 'This code isn’t valid.' });
  if (credit.used_at) return Response.json({ valid: false, error: 'This code has already been used.' });
  return Response.json({ valid: true, code, amount: credit.amount });
};
