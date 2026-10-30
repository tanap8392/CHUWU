/* CHUWU (初·五) — chart analysis for the Bazi reading, built on window.ChuwuBazi (bazi-engine.js).
   Runs in the browser (free preview: Day Master, zodiac, strength) and on the server
   (netlify/functions/bazi-reading.mjs), where these facts are handed to Claude to write the reading.
   Everything here is calculated; the AI only writes words around it.

   What it works out:
   - Ten Gods (十神) of every stem and hidden stem, relative to the Day Master
   - Day Master strength (simplified): support (own element + resource element points, from the
     same 8-point count as the element bars) plus one extra point for the season (month branch)
   - favourable / unfavourable elements from that strength (a simplified 用神, not a master's call)
   - 10-year luck pillars (大运): direction from year-stem polarity and gender; start age from the
     days between birth and the nearest 节 solar term (3 days = 1 year)
   - the reading year (流年) and its 12 solar months (流月), with clashes (冲) and harmonies (合)
     against the natal branches */
(function (root) {
  const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];
  const GENERATES = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };
  const CONTROLS = { Wood: 'Earth', Earth: 'Water', Water: 'Fire', Fire: 'Metal', Metal: 'Wood' };
  const ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  const TEN_GODS = {
    same: ['比肩 Friend', '劫财 Rob Wealth'],
    output: ['食神 Eating God', '伤官 Hurting Officer'],
    wealth: ['偏财 Indirect Wealth', '正财 Direct Wealth'],
    officer: ['七杀 Seven Killings', '正官 Direct Officer'],
    resource: ['偏印 Indirect Resource', '正印 Direct Resource']
  };

  const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const CLASH = { 0: 6, 1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5 };          // 六冲
  const HARMONY = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };          // 六合
  const PILLAR_AREAS = {
    year: 'roots, family background and early years',
    month: 'career, parents and social life',
    day: 'yourself and your closest partner',
    hour: 'children, ideas and later life'
  };
  const DAY_MASTER_IMAGES = [
    'Yang Wood — the tall tree', 'Yin Wood — flowers and vines', 'Yang Fire — the sun', 'Yin Fire — candlelight',
    'Yang Earth — the mountain', 'Yin Earth — fertile soil', 'Yang Metal — the sword', 'Yin Metal — jewellery',
    'Yang Water — the ocean', 'Yin Water — rain and dew'
  ];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const B = () => root.ChuwuBazi._internal;

  function relation(dm, el) {
    if (el === dm) return 'same';
    if (GENERATES[dm] === el) return 'output';
    if (CONTROLS[dm] === el) return 'wealth';
    if (CONTROLS[el] === dm) return 'officer';
    return 'resource';
  }
  const resourceOf = el => ELEMENTS.find(e => GENERATES[e] === el);
  const outputOf = el => GENERATES[el];
  const wealthOf = el => CONTROLS[el];
  const officerOf = el => ELEMENTS.find(e => CONTROLS[e] === el);

  // Same polarity → the first (偏/比/食/七杀) of the pair, different → the second.
  function tenGod(dmStemIndex, stemIndex) {
    const { STEM_ELEMENT } = B();
    const pair = TEN_GODS[relation(STEM_ELEMENT[dmStemIndex], STEM_ELEMENT[stemIndex])];
    return (dmStemIndex % 2) === (stemIndex % 2) ? pair[0] : pair[1];
  }

  const sexIndex = (s, b) => { for (let i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i; return 0; };
  const pillarAt = i => { const { HEAVENLY_STEMS, EARTHLY_BRANCHES } = B(); const k = ((i % 60) + 60) % 60; return { stemIndex: k % 10, branchIndex: k % 12, label: HEAVENLY_STEMS[k % 10] + EARTHLY_BRANCHES[k % 12] }; };

  // JD (UT) when the sun reaches `target` degrees, searching from `jd` (Newton steps).
  function solarTermJD(target, jd) {
    const lon = B().solarApparentLongitude;
    for (let i = 0; i < 40; i++) {
      let d = lon(jd) - target;
      d = ((d + 180) % 360 + 360) % 360 - 180;
      if (Math.abs(d) < 1e-7) break;
      jd -= d / 0.9856002;
    }
    return jd;
  }

  // UT Julian Day → calendar date in China/Singapore time (UTC+8).
  function jdToDate(jd) {
    const ms = (jd - 2440587.5) * 86400000 + 8 * 3600000;
    const d = new Date(ms);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  }
  const fmtDay = d => `${d.day} ${MONTH_NAMES[d.month - 1]}`;

  // Clashes and harmonies between one branch (of a luck pillar, year or month) and the natal chart.
  function interactions(branchIndex, chart) {
    const { EARTHLY_BRANCHES } = B();
    const out = [];
    ['year', 'month', 'day', 'hour'].forEach(key => {
      const nb = chart.pillars[key].branchIndex;
      const name = key.charAt(0).toUpperCase() + key.slice(1);
      if (CLASH[branchIndex] === nb) out.push(`${EARTHLY_BRANCHES[branchIndex]} clashes (冲) your ${name} branch ${EARTHLY_BRANCHES[nb]} — ${PILLAR_AREAS[key]}`);
      if (HARMONY[branchIndex] === nb) out.push(`${EARTHLY_BRANCHES[branchIndex]} harmonises (合) with your ${name} branch ${EARTHLY_BRANCHES[nb]} — ${PILLAR_AREAS[key]}`);
    });
    return out;
  }

  function strengthOf(chart) {
    const dm = chart.dayMaster.element;
    const res = resourceOf(dm);
    const t = chart.elementTally;
    const support = t[dm] + t[res];
    const seasonEl = chart.pillars.month.hiddenStems[0].element; // the month branch's main qi
    const inSeason = seasonEl === dm || seasonEl === res;
    const score = (support + (inSeason ? 1 : 0)) / 9;
    const label = score >= 0.55 ? 'strong' : score < 0.42 ? 'weak' : 'balanced';

    let favourable, unfavourable;
    if (label === 'weak') {
      favourable = [res, dm];
      unfavourable = [officerOf(dm), wealthOf(dm)];
    } else if (label === 'strong') {
      favourable = [outputOf(dm), wealthOf(dm), officerOf(dm)].sort((a, b) => t[a] - t[b]).slice(0, 2);
      unfavourable = [dm, res];
    } else {
      favourable = ELEMENTS.slice().sort((a, b) => t[a] - t[b]).slice(0, 2);
      unfavourable = [ELEMENTS.slice().sort((a, b) => t[b] - t[a])[0]];
    }
    return { label, supportPoints: Math.round(support * 10) / 10, supportPct: Math.round(score * 100), inSeason, seasonElement: seasonEl, favourable, unfavourable };
  }

  // Direction: Yang year + male, or Yin year + female → forward; otherwise backward.
  // Start age: days from birth to the next (forward) or previous (backward) 节 term ÷ 3.
  function luckPillars(chart, gender, birthYear, readingYear) {
    const yearYang = chart.pillars.year.stemIndex % 2 === 0;
    const forward = (yearYang && gender === 'male') || (!yearYang && gender === 'female');
    const L = chart.solarLongitude;
    const sector = Math.floor((((L - 315) % 360) + 360) % 360 / 30);
    const target = (315 + 30 * (forward ? sector + 1 : sector)) % 360;
    let delta = (((target - L) % 360) + 360) % 360;
    if (!forward) delta -= 360;
    const termJD = solarTermJD(target, chart.birthJD_UT + delta / 0.9856);
    const startAge = Math.abs(termJD - chart.birthJD_UT) / 3;

    const monthIdx = sexIndex(chart.pillars.month.stemIndex, chart.pillars.month.branchIndex);
    const { STEM_ELEMENT, HIDDEN_STEMS, EARTHLY_BRANCHES } = B();
    const dmIdx = chart.pillars.day.stemIndex;
    const ageInReadingYear = readingYear - birthYear;
    const pillars = [];
    for (let k = 1; k <= 8; k++) {
      const p = pillarAt(monthIdx + (forward ? k : -k));
      const from = startAge + 10 * (k - 1);
      const branchMain = HIDDEN_STEMS[p.branchIndex][0][0];
      pillars.push({
        pillar: p.label,
        stemElement: STEM_ELEMENT[p.stemIndex],
        branch: EARTHLY_BRANCHES[p.branchIndex],
        branchElement: STEM_ELEMENT[branchMain],
        stemGod: tenGod(dmIdx, p.stemIndex),
        branchGod: tenGod(dmIdx, branchMain),
        ages: `${Math.floor(from)}–${Math.floor(from + 10)}`,
        years: `${birthYear + Math.floor(from)}–${birthYear + Math.floor(from + 10)}`,
        current: ageInReadingYear >= Math.floor(from) && ageInReadingYear < Math.floor(from + 10),
        interactions: interactions(p.branchIndex, chart)
      });
    }
    const yrs = Math.floor(startAge);
    const mos = Math.round((startAge - yrs) * 12);
    return { direction: forward ? 'forward' : 'backward', startAge: Math.round(startAge * 10) / 10, startAgeText: `${yrs} years ${mos} months`, pillars };
  }

  // The reading year's pillar and its 12 solar months (寅 month from 立春 to the 丑 month).
  function yearAhead(chart, readingYear) {
    const { STEM_ELEMENT, HIDDEN_STEMS, EARTHLY_BRANCHES, HEAVENLY_STEMS, gregorianToJD, yinMonthStemIndex } = B();
    const dmIdx = chart.pillars.day.stemIndex;
    const ys = ((readingYear - 4) % 10 + 10) % 10;
    const yb = ((readingYear - 4) % 12 + 12) % 12;
    const describe = (s, b) => {
      const main = HIDDEN_STEMS[b][0][0];
      return {
        pillar: HEAVENLY_STEMS[s] + EARTHLY_BRANCHES[b],
        stemElement: STEM_ELEMENT[s], branchElement: STEM_ELEMENT[main],
        stemGod: tenGod(dmIdx, s), branchGod: tenGod(dmIdx, main),
        interactions: interactions(b, chart)
      };
    };
    const months = [];
    const firstStem = yinMonthStemIndex(ys);
    let start = solarTermJD(315, gregorianToJD(readingYear, 2, 4, 4, 0, 0));
    for (let k = 0; k < 12; k++) {
      const next = solarTermJD((315 + 30 * (k + 1)) % 360, start + 30.4);
      const a = jdToDate(start), z = jdToDate(next - 1);
      months.push({ ...describe((firstStem + k) % 10, (2 + k) % 12), dates: `${fmtDay(a)} – ${fmtDay(z)}${z.year !== a.year ? ' ' + z.year : ''}` });
      start = next;
    }
    return { year: readingYear, animal: ANIMALS[yb], ...describe(ys, yb), months };
  }

  // input: { year, month, day, hour, minute } already adjusted for true solar time (as passed to
  // computeBazi), plus gender ('male' | 'female') and readingYear.
  function analyse(input, gender, readingYear) {
    const chart = root.ChuwuBazi.computeBazi(input);
    const { STEM_ELEMENT } = B();
    const dmIdx = chart.pillars.day.stemIndex;
    const pillars = ['year', 'month', 'day', 'hour'].map(key => {
      const p = chart.pillars[key];
      return {
        pillar: key, characters: p.label, area: PILLAR_AREAS[key],
        stem: p.stem, stemElement: p.stemElement, stemGod: key === 'day' ? 'Day Master 日主' : tenGod(dmIdx, p.stemIndex),
        branch: p.branch,
        hiddenStems: p.hiddenStems.map((h, i) => ({ stem: h.stem, element: h.element, weight: h.weight, god: tenGod(dmIdx, root.ChuwuBazi._internal.HEAVENLY_STEMS.indexOf(h.stem)) }))
      };
    });
    // Ten Gods weighted like the element count (stems 1, hidden stems by weight), Day Master excluded.
    const gods = {};
    pillars.forEach(p => {
      if (p.pillar !== 'day') gods[p.stemGod] = (gods[p.stemGod] || 0) + 1;
      p.hiddenStems.forEach(h => { gods[h.god] = (gods[h.god] || 0) + h.weight; });
    });
    const tenGods = Object.entries(gods).map(([god, w]) => ({ god, weight: Math.round(w * 10) / 10 })).sort((a, b) => b.weight - a.weight);
    const missingGods = Object.values(TEN_GODS).flat().filter(g => !gods[g]);

    return {
      chart,
      facts: {
        dayMaster: { stem: chart.dayMaster.stem, element: chart.dayMaster.element, polarity: chart.dayMaster.yinYang, image: DAY_MASTER_IMAGES[dmIdx] },
        zodiac: { animal: ANIMALS[chart.pillars.year.branchIndex], branch: chart.pillars.year.branch },
        pillars,
        elementPoints: chart.elementTally,
        lacking: chart.lackingElements,
        strength: strengthOf(chart),
        tenGods, missingGods,
        luck: luckPillars(chart, gender, input.year, readingYear),
        yearAhead: yearAhead(chart, readingYear)
      }
    };
  }

  root.ChuwuReading = { analyse, tenGod, relation, ZH, ANIMALS };
})(typeof window !== 'undefined' ? window : globalThis);
