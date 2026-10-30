/* CHUWU (初·五) — turns a Bazi reading (window.ChuwuBazi.computeBazi()) into scent recommendations
   from the element-scent catalogue (window.ChuwuScents), using each scent's whole element mix.

   How much each element is "needed" comes from the reading: the strongest element in the chart is
   not needed at all (0), and the others are needed in proportion to how far they fall short of it
   (an element at zero would be fully needed, 1). A scent's score is its share of each element ×
   how much that element is needed, added up — so a scent rich in the elements you lack scores
   high, and any share of an element you already have plenty of earns nothing.

   Results come in two groups:
   - primary: scents whose main element is the one most lacking (as before), best match first;
   - also:    the best of the other scents, each with a balance-match % and the needed elements it
              adds. Scents built mainly on the chart's strongest element are left out. */
(function (root) {
  const ALSO_LIMIT = 6;      // how many "also balancing" scents to show at most
  const ALSO_MIN_MATCH = 40; // and only those at least this good a match (%)
  const FAMILY_BONUS = 0.04; // small nudge for the customer's preferred scent family

  // Need per element, 0 (the chart's strongest) … 1 (absent).
  function elementNeeds(tally) {
    const elements = Object.keys(tally);
    const max = Math.max.apply(null, elements.map(e => tally[e]));
    const needs = {};
    elements.forEach(e => { needs[e] = max > 0 ? (max - tally[e]) / max : 0; });
    return needs;
  }

  // A scent's element shares (adding up to 1), from its element mix; a scent without a mix counts
  // as 100% its main element.
  function shares(scent) {
    const mix = (scent.element_mix || []).filter(m => m.votes > 0);
    if (!mix.length) return { [scent.element]: 1 };
    const total = mix.reduce((s, m) => s + m.votes, 0);
    const out = {};
    mix.forEach(m => { out[m.element] = (out[m.element] || 0) + m.votes / total; });
    return out;
  }

  function evaluate(scent, needs, bestNeed, preferredFamily) {
    const sh = shares(scent);
    const score = Object.keys(sh).reduce((s, e) => s + sh[e] * (needs[e] || 0), 0);
    // Needed elements this scent brings, biggest contribution first (ignoring traces under 10%).
    const adds = Object.keys(sh)
      .filter(e => (needs[e] || 0) > 0 && sh[e] >= 0.1)
      .sort((a, b) => sh[b] * needs[b] - sh[a] * needs[a]);
    const familyMatch = !!preferredFamily && (scent.families || [scent.family]).includes(preferredFamily);
    return {
      scent,
      score,
      match: bestNeed > 0 ? Math.min(100, Math.round((score / bestNeed) * 100)) : 0,
      adds,
      rank: score + (familyMatch ? FAMILY_BONUS : 0)
    };
  }

  // baziResult: output of ChuwuBazi.computeBazi() (.lackingElements, .elementTally).
  // preferredFamily: a ChuwuNotes.FAMILIES[].key from the scent-preference question, or null.
  // Returns { needs, primary: [rec], also: [rec] } where rec = { scent, score, match, adds }.
  function recommendScents(baziResult, preferredFamily) {
    const lacking = baziResult.lackingElements || [];
    const needs = elementNeeds(baziResult.elementTally || {});
    const bestNeed = Math.max.apply(null, Object.values(needs).concat(0));
    const strongest = Object.keys(needs).filter(e => needs[e] === 0);

    const recs = root.ChuwuScents.SCENTS.map(s => evaluate(s, needs, bestNeed, preferredFamily))
      .sort((a, b) => b.rank - a.rank);

    const primary = recs.filter(r => lacking.includes(r.scent.element));
    const also = recs
      .filter(r => !lacking.includes(r.scent.element) && !strongest.includes(r.scent.element) && r.match >= ALSO_MIN_MATCH)
      .slice(0, ALSO_LIMIT);
    return { needs, primary, also };
  }

  root.ChuwuScentRecommend = { recommendScents, elementNeeds };
})(typeof window !== 'undefined' ? window : globalThis);
