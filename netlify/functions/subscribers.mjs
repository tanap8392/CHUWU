// CHUWU (初·五) — the Subscribers tab on the Orders screen (admin/orders.html): everyone who
// unlocked a free Bazi reading with their email (saved by bazi-reading.mjs).
//   GET              list every subscriber, newest first
//   DELETE ?email=…  remove one (e.g. on request under the Privacy Policy)
//
// Same access rule as the orders function: a logged-in dashboard user with the "admin" role.
import { getStore } from '@netlify/blobs';

async function currentUser(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const res = await fetch(new URL('/.netlify/identity/user', req.url), { headers: { Authorization: auth } });
  return res.ok ? res.json() : null;
}

export default async (req) => {
  const user = await currentUser(req);
  if (!user) return Response.json({ error: 'Please log in.' }, { status: 401 });
  const roles = (user.app_metadata && user.app_metadata.roles) || [];
  if (!roles.includes('admin')) return Response.json({ error: 'not_admin', email: user.email }, { status: 403 });

  const store = getStore({ name: 'subscribers', consistency: 'strong' });

  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const subscribers = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    subscribers.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return Response.json({ subscribers });
  }

  if (req.method === 'DELETE') {
    const email = new URL(req.url).searchParams.get('email');
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
    await store.delete(email.toLowerCase());
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};
