/* CHUWU (初·五) — merges a Bazi reading (window.ChuwuBazi.computeBazi()) with the fixed 15-scent
   pre-mix catalog (window.ChuwuScents). Pure element-based: no Love/Wealth/Career/Health framing,
   per the "just categorise them by element" direction — a customer is shown which element(s) they
   are lacking and the matching scent code(s), narrowed by their scent-preference-quiz answer. */
(function (root) {
  // Reorders a set of candidate scents so the preferred family comes first, without dropping the
  // rest — same soft-ranking behaviour as recommend.js's rankByFamily, applied to the fixed catalog.
  function rankByFamily(scents, preferredFamily) {
    if (!preferredFamily) return scents.slice();
    const matched = scents.filter(s => s.family === preferredFamily);
    const rest = scents.filter(s => s.family !== preferredFamily);
    return matched.length ? matched.concat(rest) : scents.slice();
  }

  // Sheng (生, generating) cycle: a "supporting" element is only worth suggesting alongside the
  // lacking element if it isn't already the chart's most abundant element — piling more of an
  // already-excessive element onto the person's chart isn't a real remedy, it just overcorrects.
  function supportingElement(element, tally, lacking) {
    const mother = root.ChuwuNotes.MOTHER_OF[element];
    if (!mother || mother === element) return null;
    if (lacking.includes(mother)) return null; // already shown as its own primary entry
    const maxTally = Math.max.apply(null, Object.keys(tally).map(k => tally[k]));
    if (tally[mother] === maxTally) return null; // mother is already excessive — don't reinforce it
    return mother;
  }

  // baziResult: output of ChuwuBazi.computeBazi() — uses .lackingElements (array, may hold more
  // than one element if several are tied for most-lacking) and .elementTally (all five elements).
  // preferredFamily: one of ChuwuNotes.FAMILIES[].key from the scent-preference quiz, or null.
  // Returns: [{ element, scents, topPick, supporting }] — one entry per lacking element.
  // `supporting` (nullable) is { element, scents, topPick } for the Sheng-cycle "mother" element,
  // a secondary suggestion that nourishes the lacking element rather than a second equal pick.
  function recommendScents(baziResult, preferredFamily) {
    const lacking = baziResult.lackingElements || [];
    const tally = baziResult.elementTally || {};
    return lacking.map(element => {
      const scents = rankByFamily(root.ChuwuScents.scentsForElement(element), preferredFamily);
      const motherEl = supportingElement(element, tally, lacking);
      let supporting = null;
      if (motherEl) {
        const motherScents = rankByFamily(root.ChuwuScents.scentsForElement(motherEl), preferredFamily);
        supporting = { element: motherEl, scents: motherScents, topPick: motherScents[0] || null };
      }
      return { element, scents, topPick: scents[0] || null, supporting };
    });
  }

  root.ChuwuScentRecommend = { rankByFamily, recommendScents };
})(typeof window !== 'undefined' ? window : globalThis);
