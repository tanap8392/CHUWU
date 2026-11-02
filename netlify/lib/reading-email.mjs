// CHUWU (初·五) — the "Your full Bazi reading" email: builds it from the written parts and sends
// it through Gmail (GMAIL_USER + GMAIL_APP_PASSWORD environment variables in Netlify).
// Email clients ignore stylesheets, so everything is inline and table-free but simple.
import nodemailer from 'nodemailer';

const C = { ivory: '#F5F2EB', charcoal: '#2D2A28', gold: '#B8955A', muted: '#7a746d', card: '#FBF8F2' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const paras = t => String(t || '').split(/\n+/).filter(Boolean).map(p => `<p style="margin:0 0 12px;line-height:1.65">${esc(p)}</p>`).join('');
const h2 = (eyebrow, title) => `<p style="margin:34px 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">${esc(eyebrow)}</p><h2 style="margin:0 0 14px;font-family:Georgia,serif;font-weight:normal;font-size:24px;color:${C.charcoal}">${esc(title)}</h2>`;
const h3 = t => `<p style="margin:20px 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">${esc(t)}</p>`;
const card = inner => `<div style="background:${C.card};border-radius:6px;padding:12px 14px;margin:0 0 8px">${inner}</div>`;
const list = items => `<ul style="margin:0 0 8px;padding-left:18px">${(items || []).map(i => `<li style="margin:0 0 4px">${esc(i)}</li>`).join('')}</ul>`;

function readingHtml(r) {
  const { facts, year, parts } = r;
  const p = parts.profile, l = parts.luck, y = parts.year, m = parts.months, n = parts.next;
  let html = `<div style="background:${C.card};border-radius:8px;padding:14px 16px;margin:8px 0 0;font-size:14px">
    <b>Your chart:</b> ${esc(facts.pillars.map(x => x.characters).join(' '))} &nbsp;·&nbsp; Day Master ${esc(facts.dayMaster.stem + ' ' + facts.dayMaster.element)} &nbsp;·&nbsp; ${esc(facts.zodiac.animal)}<br>
    <span style="color:${C.muted}">Lacking ${esc(facts.lacking.join(', '))} · Elements to lean on: ${esc(facts.strength.favourable.join(', '))}</span></div>`;
  if (p) {
    html += h2('Day Master & Ten Gods', 'Who You Are') + `<p style="font-family:Georgia,serif;font-size:18px;margin:0 0 10px">${esc(p.headline)}</p>` + paras(p.personality)
      + h3('Strengths') + list(p.strengths) + h3('To nurture') + list(p.growth)
      + h3('Your element balance') + paras(p.balance)
      + h3('Your Ten Gods 十神') + (p.ten_gods || []).map(g => card(`<b style="font-family:Georgia,serif;font-weight:normal;font-size:16px">${esc(g.god)}</b> <span style="color:${C.muted};font-size:12px">· ${esc(g.area)}</span><br><span style="font-size:14px">${esc(g.text)}</span>`)).join('');
  }
  if (l) {
    html += h2('Ten-year chapters', 'Your Luck Pillars 大运') + paras(l.overview)
      + (l.pillars || []).map((x, i) => card(`<b style="font-family:Georgia,serif;font-weight:normal;font-size:18px">${esc(x.pillar)}</b> <span style="color:${C.muted};font-size:12px">· Ages ${esc(x.ages)}${facts.luck.pillars[i] && facts.luck.pillars[i].current ? ' · <b style="color:' + C.gold + '">NOW</b>' : ''}</span><br><b style="font-size:14px">${esc(x.title)}</b><br><span style="font-size:14px">${esc(x.text)}</span>`)).join('')
      + h3('Your current chapter') + paras(l.current_focus);
  }
  if (y) {
    html += h2('The year 流年', `Your ${year} Year Ahead`) + paras(y.overview)
      + (y.themes || []).map(t => card(`<b style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.gold}">${esc(t.area)}</b><br><span style="font-size:14px">${esc(t.text)}</span>`)).join('')
      + h3('Your scent for the year') + paras(y.scent_tip);
  }
  if (m) {
    html += h2('Solar months 流月', `${year} Month by Month`)
      + (m.months || []).map(x => card(`<b style="font-family:Georgia,serif;font-weight:normal;font-size:17px">${esc(x.pillar)}</b> <span style="color:${C.muted};font-size:12px">· ${esc(x.dates)}</span><br><b style="font-size:14px">${esc(x.title)}</b><br><span style="font-size:14px">${esc(x.text)}</span>`)).join('');
  }
  if (n) {
    html += h2('Preview', `Looking Ahead to ${year + 1}`) + paras(n.overview)
      + (n.themes || []).map(t => card(`<b style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.gold}">${esc(t.area)}</b><br><span style="font-size:14px">${esc(t.text)}</span>`)).join('')
      + h3('Months to watch') + (n.key_months || []).map(x => card(`<b style="font-family:Georgia,serif;font-weight:normal;font-size:17px">${esc(x.pillar)}</b> <span style="color:${C.muted};font-size:12px">· ${esc(x.dates)}</span><br><span style="font-size:14px">${esc(x.text)}</span>`)).join('');
  }
  return html;
}

// readings: [{ facts, year, parts: { profile, luck, year, months, next } }]
export function buildReadingEmail({ order, readings, creditCode, siteUrl }) {
  const name = (order.customer.name || '').split(' ')[0];
  const subject = `Your full Bazi reading from CHUWU 初·五 (order ${order.id})`;
  const credit = creditCode
    ? `<div style="border:1px dashed ${C.gold};border-radius:8px;padding:16px;margin:30px 0 0;text-align:center">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">Your S$1.99 back</p>
        <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;letter-spacing:2px">${esc(creditCode)}</p>
        <p style="margin:0;font-size:13px;color:${C.muted}">Enter this code at checkout for S$1.99 off any CHUWU perfume. One use.</p></div>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:${C.ivory}">
  <div style="max-width:620px;margin:0 auto;padding:28px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:${C.charcoal}">
    <p style="text-align:center;font-family:Georgia,serif;font-size:22px;letter-spacing:4px;margin:0 0 4px">CHUWU</p>
    <p style="text-align:center;font-size:12px;color:${C.gold};letter-spacing:3px;margin:0 0 26px">初 · 五</p>
    <p style="margin:0 0 12px">Hi${name ? ' ' + esc(name) : ''},</p>
    <p style="margin:0 0 12px;line-height:1.6">Thank you for your order. Here is your full Bazi reading — your Day Master and Ten Gods, your ten-year luck pillars and your year ahead, month by month.</p>
    ${readings.map(readingHtml).join('<hr style="border:0;border-top:1px solid #e6e0d4;margin:36px 0">')}
    ${credit}
    <div style="text-align:center;margin:34px 0 10px">
      <a href="${esc(siteUrl)}/shop" style="display:inline-block;background:${C.charcoal};color:${C.ivory};text-decoration:none;padding:12px 26px;border-radius:999px;font-size:13px;letter-spacing:1px">SHOP YOUR ELEMENT SCENTS</a>
    </div>
    <p style="font-size:12px;color:${C.muted};line-height:1.6;margin:26px 0 0">This reading is a lifestyle and inspirational guide drawing on traditional Five Element (Wu Xing) theory, and is not a substitute for a professional Bazi consultation. Questions? Simply reply to this email.</p>
  </div></body></html>`;
  const text = `Your full Bazi reading from CHUWU (order ${order.id}). Please view this email in an HTML-capable email app.${creditCode ? `\n\nYour S$1.99 perfume credit code: ${creditCode}` : ''}\n\n${siteUrl}`;
  return { subject, html, text };
}

export const emailConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export async function sendEmail({ to, subject, html, text }) {
  const user = process.env.GMAIL_USER;
  const transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') } });
  await transport.sendMail({ from: `"CHUWU 初·五" <${user}>`, replyTo: user, to, subject, html, text });
}
