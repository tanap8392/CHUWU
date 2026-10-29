// CHUWU (初·五) — the dashboard's Orders screen (admin/orders.html) talks to this:
//   GET              list every order, newest first
//   PATCH  {id, status?, admin_note?}   update an order's status and/or private note
//   DELETE ?id=…     remove an order (for test orders)
//
// Only logged-in dashboard users with the "admin" role may use it. The login token is checked by
// asking the site's own Netlify Identity service who it belongs to; the role is set under
// Netlify → Identity → (user) → Edit settings → Roles.
import { getStore } from '@netlify/blobs';

const STATUSES = ['awaiting_payment', 'paid', 'shipped', 'completed', 'cancelled'];

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

  const store = getStore({ name: 'orders', consistency: 'strong' });

  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const orders = (await Promise.all(blobs.map(b => store.get(b.key, { type: 'json' })))).filter(Boolean);
    orders.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return Response.json({ orders });
  }

  if (req.method === 'PATCH') {
    let body;
    try { body = await req.json(); } catch (e) { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }
    const order = body.id && (await store.get(String(body.id), { type: 'json' }));
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status)) return Response.json({ error: 'Unknown status' }, { status: 400 });
      if (body.status !== order.status) {
        order.status = body.status;
        order.status_history = (order.status_history || []).concat({ status: body.status, at: new Date().toISOString(), by: user.email });
      }
    }
    if (body.admin_note !== undefined) order.admin_note = String(body.admin_note).slice(0, 2000);
    await store.setJSON(order.id, order);
    return Response.json({ order });
  }

  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
    await store.delete(id);
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};
