// CHUWU (初·五) — the free Bazi reading, unlocked with an email address on the Bazi page.
//
// The browser sends the birth details, gender, email and which part of the reading it wants
// ("profile", "luck" or "year"; the page asks for all three at once). This function:
//   1. saves the email to the "subscribers" store (Orders screen → Subscribers);
//   2. recalculates the chart itself with the site's own Bazi code (assets/js/…), so the facts
//      can't be tampered with;
//   3. asks Claude to write that part of the reading from those facts, as JSON;
//   4. caches the result, so the same birth details always get the same reading (and cost once).
//
// Needs the ANTHROPIC_API_KEY environment variable (Netlify → Project configuration →
// Environment variables). Without it, emails are still saved and the page says readings are
// being set up.
import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import '../../assets/js/bazi-engine.js';
import '../../assets/js/cities-data.js';
import '../../assets/js/bazi-reading.js';

const PROMPT_VERSION = 1;          // bump to regenerate every cached reading after changing the prompts
const MODEL = 'claude-opus-5';
const LIMIT_PER_IP_PER_DAY = 12;   // fresh (uncached) sections — 4 full readings
const LIMIT_PER_EMAIL_PER_DAY = 9; // 3 full readings
const SHICHEN = ['23:30', '01:30', '03:30', '05:30', '07:30', '09:30', '11:30', '13:30', '15:30', '17:30', '19:30', '21:30'];

const SYSTEM = `You write the free Bazi (八字) readings for CHUWU (初·五), a Singapore fragrance brand that pairs Five Element (五行) theory with scent.

You are given a chart that has already been calculated. Never recalculate, add or change any pillar, element, Ten God, date, age or interaction — write only from the facts given, and quote them exactly when you mention them.

Voice: warm, insightful and elegant; plain English with British spelling; second person ("you"). Write for someone curious rather than an expert — when you use a term such as Day Master, Ten Gods, luck pillar or clash, explain it briefly in passing.

Be encouraging and balanced: describe tendencies, strengths and opportunities, never fixed fate. Do not predict death, illness, accidents, pregnancy, lottery wins or specific financial results, and give no medical, legal or investment advice. Present clashes (冲) as periods of change, movement or reassessment, and harmonies (合) as support and connection. The favourable elements come from a simplified strength calculation; describe them as elements to lean on, not as certainties.

This is a general reading. Where more depth would help, you may mention once in the whole section that a personal reading can go further. Do not mention that you are an AI. Follow the requested JSON fields and lengths.`;

// One request per part of the reading: what to write and the JSON shape to write it in.
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const str = { type: 'string' };
const list = (items) => ({ type: 'array', items });

const SECTIONS = {
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
  year: {
    effort: 'low',
    pick: f => ({ dayMaster: f.dayMaster, zodiac: f.zodiac, strength: f.strength, lacking: f.lacking, yearAhead: f.yearAhead, currentLuckPillar: f.luck.pillars.find(p => p.current) || null }),
    task: `Write the "Year ahead" part of the reading for the given year:
- overview: one paragraph (about 110 words) on how the year's pillar meets this chart: its Ten Gods, elements and any clash or harmony with the chart's branches, and how it sits within the current luck pillar.
- themes: four items, area exactly one of Career, Wealth, Relationships, Wellbeing; text two sentences each. Wellbeing means rest, energy and balance — never illness.
- months: one item for each of the twelve solar months, in order. pillar and dates exactly as given; title three to five words; text two sentences (about 35 words) from that month's Ten Gods, elements and interactions.
- scent_tip: two sentences. CHUWU's scent recommendations add the chart's least-present element (lacking); say which, and if the favourable elements differ, describe them as further elements to lean on during the year.`,
    schema: obj({
      overview: str,
      themes: list(obj({ area: str, text: str })),
      months: list(obj({ pillar: str, dates: str, title: str, text: str })),
      scent_tip: str
    })
  }
};

const json = (status, data) => Response.json(data, { status });
const sha = s => createHash('sha256').update(s).digest('hex');

// The reading year runs from 立春 (about 4 February) in Singapore time.
function readingYear() {
  const sg = new Date(Date.now() + 8 * 3600000);
  const y = sg.getUTCFullYear();
  return sg.getUTCMonth() > 1 || (sg.getUTCMonth() === 1 && sg.getUTCDate() >= 4) ? y : y - 1;
}

function validate(b) {
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return { error: 'Please enter a valid email address.' };
  const m = String(b.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || +m[1] < 1930 || +m[1] > 2025 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return { error: 'Please check the date of birth.' };
  if (!SHICHEN.includes(b.time)) return { error: 'Please choose a time of birth.' };
  if (!['male', 'female'].includes(b.gender)) return { error: 'Please choose male or female (used for the luck pillars).' };
  if (!SECTIONS[b.section]) return { error: 'Unknown section.' };
  const place = String(b.place || '');
  if (place && !globalThis.ChuwuCities.CITIES[place]) return { error: 'Unknown place of birth.' };
  return {
    email, place, section: b.section, gender: b.gender, date: b.date, time: b.time,
    name: String(b.name || '').trim().slice(0, 60),
    marketing: b.marketing === true,
    birth: { year: +m[1], month: +m[2], day: +m[3], hour: +b.time.slice(0, 2), minute: +b.time.slice(3) }
  };
}

async function underLimit(store, key, limit) {
  const n = Number(await store.get(key)) || 0;
  if (n >= limit) return false;
  await store.set(key, String(n + 1));
  return true;
}

async function write(sectionKey, facts) {
  const section = SECTIONS[sectionKey];
  const client = new Anthropic({ timeout: 55000, maxRetries: 0 }); // Netlify allows 60 s per request
  const task = section.task.replace('${direction}', facts.luck.direction);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default', // if a safety classifier declines, Anthropic re-runs it on a fallback model
    thinking: { type: 'adaptive' },
    output_config: { effort: section.effort, format: { type: 'json_schema', schema: section.schema } },
    system: SYSTEM,
    messages: [{ role: 'user', content: `${task}\n\nChart facts:\n${JSON.stringify(section.pick(facts), null, 1)}` }]
  });
  if (response.stop_reason === 'refusal') throw new Error('refused');
  if (response.stop_reason === 'max_tokens') throw new Error('too long');
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return JSON.parse(text);
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch (e) { return json(400, { error: 'Invalid request.' }); }
  const v = validate(body || {});
  if (v.error) return json(400, { error: v.error });

  const year = readingYear();
  const adjusted = globalThis.ChuwuCities.adjustForTrueSolarTime(v.birth, v.place);
  const { facts } = globalThis.ChuwuReading.analyse(adjusted, v.gender, year);

  // 1. Subscriber (one record per email; birth details kept for a follow-up personal reading).
  const subscribers = getStore({ name: 'subscribers', consistency: 'strong' });
  const now = new Date().toISOString();
  const prev = (await subscribers.get(v.email, { type: 'json' })) || { email: v.email, created_at: now, readings: 0 };
  await subscribers.setJSON(v.email, {
    ...prev,
    name: v.name || prev.name || '',
    marketing: v.marketing || prev.marketing || false,
    updated_at: now,
    readings: prev.readings + (v.section === 'profile' ? 1 : 0),
    birth: { date: v.date, time: v.time, place: v.place || 'Not specified', gender: v.gender },
    chart: { pillars: facts.pillars.map(p => p.characters).join(' '), dayMaster: `${facts.dayMaster.stem} ${facts.dayMaster.element}`, lacking: facts.lacking.join(', ') }
  });

  // 2. Cached reading?
  const readings = getStore({ name: 'readings', consistency: 'strong' });
  const key = sha(JSON.stringify({ v: PROMPT_VERSION, section: v.section, year, date: v.date, time: v.time, place: v.place, gender: v.gender }));
  const cached = await readings.get(key, { type: 'json' });
  if (cached) return json(200, { section: v.section, year, reading: cached.reading, cached: true });

  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: 'not_configured' });

  // 3. Fair-use limits on fresh readings (they cost money to write).
  const limits = getStore({ name: 'reading-limits' });
  const day = now.slice(0, 10);
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  if (!(await underLimit(limits, `${day}:ip:${sha(ip)}`, LIMIT_PER_IP_PER_DAY)) ||
      !(await underLimit(limits, `${day}:email:${sha(v.email)}`, LIMIT_PER_EMAIL_PER_DAY))) {
    return json(429, { error: 'You’ve reached today’s limit for free readings — please try again tomorrow.' });
  }

  // 4. Write, cache, return.
  try {
    const reading = await write(v.section, facts);
    await readings.setJSON(key, { reading, created_at: now, model: MODEL });
    return json(200, { section: v.section, year, reading });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(503, { error: 'busy' });
    if (e instanceof Anthropic.AuthenticationError) return json(503, { error: 'not_configured' });
    if (e instanceof Anthropic.APIError) { console.error('Anthropic', e.status, e.message); return json(502, { error: 'failed' }); }
    console.error(e);
    return json(502, { error: 'failed' });
  }
};
