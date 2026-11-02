// CHUWU (初·五) — shared Bazi reading logic for the Netlify Functions: validating birth details,
// calculating the chart (with the site's own assets/js code), writing each part of the reading
// with Claude, and caching it. Used by bazi-reading.mjs (the page) and
// reading-email-background.mjs (writes the whole reading after a purchase and emails it).
//
// Claude is reached through Netlify's AI Gateway, which sets ANTHROPIC_API_KEY and
// ANTHROPIC_BASE_URL for functions automatically and bills usage as Netlify credits.
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { createHash, randomBytes } from 'node:crypto';
import '../../assets/js/bazi-engine.js';
import '../../assets/js/cities-data.js';
import '../../assets/js/bazi-reading.js';

export { Anthropic };
export const READING_PRODUCT_ID = 'full-reading'; // the S$1.99 "Full Bazi Reading" product

// Bump a part's number to regenerate its cached readings after changing its prompt.
export const PROMPT_VERSIONS = { profile: 1, luck: 1, year: 2, months: 1, next: 1 };
export const MODEL = 'claude-opus-5';
export const LIMIT_PER_IP_PER_DAY = 12;   // fresh (uncached) sections — 4 full readings
export const LIMIT_PER_EMAIL_PER_DAY = 9; // 3 full readings
const SHICHEN = ['23:30', '01:30', '03:30', '05:30', '07:30', '09:30', '11:30', '13:30', '15:30', '17:30', '19:30', '21:30'];

const SYSTEM = `You write the Bazi (八字) readings for CHUWU (初·五), a Singapore fragrance brand that pairs Five Element (五行) theory with scent.

You are given a chart that has already been calculated. Never recalculate, add or change any pillar, element, Ten God, date, age or interaction — write only from the facts given, and quote them exactly when you mention them.

Voice: warm, insightful and elegant; plain English with British spelling; second person ("you"). Write for someone curious rather than an expert — when you use a term such as Day Master, Ten Gods, luck pillar or clash, explain it briefly in passing.

Be encouraging and balanced: describe tendencies, strengths and opportunities, never fixed fate. Do not predict death, illness, accidents, pregnancy, lottery wins or specific financial results, and give no medical, legal or investment advice. Present clashes (冲) as periods of change, movement or reassessment, and harmonies (合) as support and connection. The favourable elements come from a simplified strength calculation; describe them as elements to lean on, not as certainties.

This is a general reading. Where more depth would help, you may mention once in the whole section that a personal reading can go further. Do not mention that you are an AI. Follow the requested JSON fields and lengths.`;

// One request per part of the reading: what to write and the JSON shape to write it in.
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const str = { type: 'string' };
const list = (items) => ({ type: 'array', items });

export const SECTIONS = {
  profile: {
    effort: 'medium',
    pick: f => ({ dayMaster: f.dayMaster, zodiac: f.zodiac, pillars: f.pillars, elementPoints: f.elementPoints, lacking: f.lacking, strength: f.strength, tenGods: f.tenGods, missingGods: f.missingGods }),
    task: `Write the "Who you are" part of the reading:
- headline: the Day Master in a few words, e.g. "癸 Water — the gentle rain" (use the given image).
- personality: two short paragraphs (about 140 words in total) on character, drawn from the Day Master, its strength and the Ten Gods.
- strengths: three short phrases.
- growth: two short phrases on what to nurture.
- balance: one paragraph (about 90 words) on the element balance: which elements are strong, which are lacking, the Day Master's strength (say it is a simplified calculation) and the favourable elements to lean on.
- ten_gods: the four or five most present Ten Gods (from tenGods, highest weight first). For each: god (exactly as given), area (one of Self, Expression, Wealth, Career & Status, Support & Learning), and text (two sentences on what it brings). If an important Ten God is missing (missingGods), you may mention its absence in one item instead.`,
    schema: obj({
      headline: str, personality: str, strengths: list(str), growth: list(str), balance: str,
      ten_gods: list(obj({ god: str, area: str, text: str }))
    })
  },
  luck: {
    effort: 'medium',
    pick: f => ({ dayMaster: f.dayMaster, strength: f.strength, luck: f.luck }),
    task: `Write the "Luck pillars (大运)" part of the reading:
- overview: one paragraph (about 80 words) explaining what luck pillars are, that this chart's run ${'${direction}'} and the first begins at about the given start age.
- pillars: one item for each of the eight luck pillars, in order. pillar and ages exactly as given; title: three to five words naming the period's theme; text: two sentences (about 40 words) from its Ten Gods, elements (favourable or not) and any interactions.
- current_focus: one paragraph (about 70 words) on the pillar marked current, or, if none is current, on the next one.`,
    schema: obj({
      overview: str,
      pillars: list(obj({ pillar: str, ages: str, title: str, text: str })),
      current_focus: str
    })
  },
  next: {
    effort: 'low',
    pick: f => ({ dayMaster: f.dayMaster, zodiac: f.zodiac, strength: f.strength, lacking: f.lacking, nextYear: f.nextYear, luckPillars: f.luck.pillars.map(p => ({ pillar: p.pillar, years: p.years })) }),
    task: `Write a brief preview of the coming year (nextYear) — shorter than a full year reading:
- overview: one paragraph (about 90 words) on how next year's pillar meets this chart: its Ten Gods, elements and any clash or harmony with the chart's branches, and which luck pillar covers it (from the years given).
- themes: four items, area exactly one of Career, Wealth, Relationships, Wellbeing; text one sentence each. Wellbeing means rest, energy and balance — never illness.
- key_months: the three most notable of next year's twelve solar months (strong clashes, harmonies or favourable elements), in calendar order. pillar and dates exactly as given; text one or two sentences.`,
    schema: obj({
      overview: str,
      themes: list(obj({ area: str, text: str })),
      key_months: list(obj({ pillar: str, dates: str, text: str }))
    })
  },
  year: {
    effort: 'low',
    pick: f => ({ dayMaster: f.dayMaster, zodiac: f.zodiac, strength: f.strength, lacking: f.lacking, yearAhead: f.yearAhead, currentLuckPillar: f.luck.pillars.find(p => p.current) || null }),
    task: `Write the "Year ahead" part of the reading for the given year (the month-by-month part is written separately):
- overview: one paragraph (about 110 words) on how the year's pillar meets this chart: its Ten Gods, elements and any clash or harmony with the chart's branches, and how it sits within the current luck pillar.
- themes: four items, area exactly one of Career, Wealth, Relationships, Wellbeing; text two sentences each. Wellbeing means rest, energy and balance — never illness.
- scent_tip: two sentences. CHUWU's scent recommendations add the chart's least-present element (lacking); say which, and if the favourable elements differ, describe them as further elements to lean on during the year.`,
    schema: obj({
      overview: str,
      themes: list(obj({ area: str, text: str })),
      scent_tip: str
    })
  },
  months: {
    effort: 'low',
    pick: f => ({ dayMaster: f.dayMaster, strength: f.strength, months: f.yearAhead.months }),
    task: `Write the month-by-month part of the year reading:
- months: one item for each of the twelve solar months, in order. pillar and dates exactly as given; title three to five words; text two sentences (about 30 words) from that month's Ten Gods, elements (favourable or not) and interactions.`,
    schema: obj({
      months: list(obj({ pillar: str, dates: str, title: str, text: str }))
    })
  }
};


export const sha = s => createHash('sha256').update(s).digest('hex');

// The reading year runs from 立春 (about 4 February) in Singapore time.
export function readingYear() {
  const sg = new Date(Date.now() + 8 * 3600000);
  const y = sg.getUTCFullYear();
  return sg.getUTCMonth() > 1 || (sg.getUTCMonth() === 1 && sg.getUTCDate() >= 4) ? y : y - 1;
}

// Birth details as sent by the page or stored on an order: { date, time, place, gender }.
export function validateBirth(b) {
  const m = String(b.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || +m[1] < 1930 || +m[1] > 2025 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return { error: 'Please check the date of birth.' };
  if (!SHICHEN.includes(b.time)) return { error: 'Please choose a time of birth.' };
  if (!['male', 'female'].includes(b.gender)) return { error: 'Please choose male or female (used for the luck pillars).' };
  const place = String(b.place || '');
  if (place && !globalThis.ChuwuCities.CITIES[place]) return { error: 'Unknown place of birth.' };
  return { date: b.date, time: b.time, place, gender: b.gender, birth: { year: +m[1], month: +m[2], day: +m[3], hour: +b.time.slice(0, 2), minute: +b.time.slice(3) } };
}

export function chartFacts(v, year) {
  const adjusted = globalThis.ChuwuCities.adjustForTrueSolarTime(v.birth, v.place);
  const { facts, chart } = globalThis.ChuwuReading.analyse(adjusted, v.gender, year);
  facts.nextYear = globalThis.ChuwuReading.yearAhead(chart, year + 1);
  return facts;
}

export const chartSummary = facts => ({
  pillars: facts.pillars.map(p => p.characters).join(' '),
  dayMaster: `${facts.dayMaster.stem} ${facts.dayMaster.element}`,
  lacking: facts.lacking.join(', ')
});

const readingsStore = () => getStore({ name: 'readings', consistency: 'strong' });
// "Who you are" doesn't depend on gender, so the free sneak peek and a paid reading share one copy.
const cacheKey = (section, v, year) => sha(JSON.stringify({ v: PROMPT_VERSIONS[section], section, year, date: v.date, time: v.time, place: v.place, gender: section === 'profile' ? '' : v.gender }));

// Every text filled in and every list non-empty: the model occasionally leaves a field blank,
// and a blank part must be written again rather than shown or cached.
function complete(value, schema) {
  if (schema.type === 'string') return typeof value === 'string' && value.trim() !== '';
  if (schema.type === 'array') return Array.isArray(value) && value.length > 0 && value.every(x => complete(x, schema.items));
  if (schema.type === 'object') return !!value && Object.keys(schema.properties).every(k => complete(value[k], schema.properties[k]));
  return true;
}

export async function getCached(section, v, year) {
  const hit = await readingsStore().get(cacheKey(section, v, year), { type: 'json' });
  return hit && complete(hit.reading, SECTIONS[section].schema) ? hit.reading : null;
}

// Cached part, or write it now (and cache it). Throws Anthropic errors to the caller.
export async function getOrWrite(section, v, year, facts) {
  const cached = await getCached(section, v, year);
  if (cached) return { reading: cached, cached: true };
  const { reading, usage } = await write(section, facts);
  console.log(`reading ${section} written`, JSON.stringify(usage));
  await readingsStore().setJSON(cacheKey(section, v, year), { reading, created_at: new Date().toISOString(), model: MODEL, usage });
  return { reading, cached: false };
}

// Which parts make up the full reading right now: the next-year preview is included from November
// until the new Bazi year begins (the page uses the same rule, with an editable start month).
export function fullSections(year) {
  const sg = new Date(Date.now() + 8 * 3600000);
  const preview = sg.getUTCFullYear() > year || sg.getUTCMonth() + 1 >= 11;
  return ['profile', 'luck', 'year', 'months'].concat(preview ? ['next'] : []);
}

export const ordersStore = () => getStore({ name: 'orders', consistency: 'strong' });

// The full reading (and its perfume credit) is only released once the order is marked Paid.
export const isPaid = order => ['paid', 'shipped', 'completed'].includes(order.status);
export const CREDIT_AMOUNT = 1.99;
const newCreditCode = () => 'BAZI-' + Array.from(randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

// Called when a paid order's reading should be (re)sent: bought without any perfume, it earns a
// one-use S$1.99 perfume credit code (issued once); then the reading is queued for the email job.
// The caller saves the order and starts the job with startReadingJob.
export async function releaseReading(order) {
  const now = new Date().toISOString();
  const readings = readingItems(order);
  if (!order.credit_issued && !order.items.some(isPhysical)) {
    const code = newCreditCode();
    const amount = Math.round(CREDIT_AMOUNT * readings.reduce((n, r) => n + r.item.quantity, 0) * 100) / 100;
    await getStore({ name: 'credits', consistency: 'strong' }).setJSON(code, { code, amount, order_id: order.id, email: order.customer.email, created_at: now, used_at: null });
    order.credit_issued = { code, amount };
  }
  order.reading = { ...(order.reading || {}), status: 'queued', queued_at: now, error: '' };
}

// Starts reading-email-background.mjs (it returns straight away and runs for up to 15 minutes).
export async function startReadingJob(req, orderId) {
  try { await fetch(new URL('/.netlify/functions/reading-email-background', req.url), { method: 'POST', body: JSON.stringify({ order_id: orderId }) }); }
  catch (e) { console.error('could not start the reading email job', e); }
}

// Products shipped in a parcel (everything except the digital reading).
export const isPhysical = item => item.product_id !== READING_PRODUCT_ID;

// Reading items on an order, with their birth details (stored as attributes by the page).
export function readingItems(order) {
  return (order.items || []).filter(i => i.product_id === READING_PRODUCT_ID).map(i => {
    const a = Object.fromEntries((i.attributes || []).map(x => [x.key, x.value]));
    const place = a['Birth place'] && a['Birth place'] !== 'Not specified' ? a['Birth place'] : '';
    return { item: i, birth: { date: a['Birth date'], time: a['Birth time'], place, gender: String(a['Gender'] || '').toLowerCase() } };
  });
}

export const sameBirth = (a, b) => a.date === b.date && a.time === b.time && (a.place || '') === (b.place || '') && a.gender === b.gender;

async function write(sectionKey, facts) {
  const section = SECTIONS[sectionKey];
  const client = new Anthropic({ timeout: 55000, maxRetries: 0 }); // Netlify allows 60 s per request
  const task = section.task.replace('${direction}', facts.luck.direction);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: section.effort, format: { type: 'json_schema', schema: section.schema } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `${task}\n\nChart facts:\n${JSON.stringify(section.pick(facts), null, 1)}` }]
  });
  if (response.stop_reason === 'refusal') throw new Error('refused');
  if (response.stop_reason === 'max_tokens') throw new Error('too long');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const reading = JSON.parse(text);
  if (!complete(reading, section.schema)) throw new Error('incomplete reading');
  // Token counts, kept with the saved part so the AI cost per reading can be checked.
  const { input_tokens, output_tokens } = response.usage || {};
  return { reading, usage: { input_tokens, output_tokens } };
}

