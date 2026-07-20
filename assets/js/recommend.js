/* CHUWU (初·五) — Five Element → life-aspect affinity map, and the scent recommendation engine.
   Built on top of window.ChuwuNotes (notes-data.js). Framed as a lifestyle/inspirational guide,
   not a professional Bazi consultation — see the "About This Guide" copy on customize.html. */
(function (root) {
  const ASPECTS = [
    {
      key: 'love',
      label: 'Love Luck',
      zh: '桃花运',
      blurb: 'Warmth, magnetism, and open-hearted connection.',
      elements: ['Fire', 'Earth']
    },
    {
      key: 'wealth',
      label: 'Wealth Luck',
      zh: '财运',
      blurb: 'Clarity, momentum, and the flow of abundance.',
      elements: ['Metal', 'Water']
    },
    {
      key: 'career',
      label: 'Career Luck',
      zh: '事业运',
      blurb: 'Direction, ambition, and steady forward motion.',
      elements: ['Water', 'Wood']
    },
    {
      key: 'health',
      label: 'Health Luck',
      zh: '健康运',
      blurb: 'Vitality, growth, and a body at ease.',
      elements: ['Wood', 'Earth']
    },
    {
      key: 'overall',
      label: 'Overall Balance',
      zh: '整体平衡',
      blurb: 'Bringing your most lacking element back into harmony.',
      elements: null // resolved dynamically from lackingElements
    }
  ];

  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  const ELEMENT_MEANING = {
    Wood: 'growth, vitality, and new beginnings',
    Fire: 'passion, visibility, and warmth',
    Earth: 'stability, trust, and grounded relationships',
    Metal: 'clarity, precision, and the ability to hold value',
    Water: 'wisdom, adaptability, and the flow of opportunity'
  };

  // For a given aspect + the person's lacking elements, pick which element(s) to actually recommend.
  function aspectTargetElements(aspect, lackingElements) {
    if (aspect.key === 'overall') return lackingElements.slice(0, 2);
    const match = aspect.elements.filter(e => lackingElements.includes(e));
    return match.length ? match : aspect.elements.slice(0, 1); // still show the aspect's governing element
  }

  // Reorders a layer's candidate notes so the preferred scent family (from the quiz) comes
  // first, without dropping the rest — keeps the Five Element match as the hard filter and the
  // family preference as a soft ranking on top of it.
  function rankByFamily(notes, family) {
    if (!family) return notes.slice();
    const matched = notes.filter(n => n.family === family);
    const rest = notes.filter(n => n.family !== family);
    return matched.length ? matched.concat(rest) : notes.slice();
  }

  function buildScentFor(element, preferredFamily) {
    const top = root.ChuwuNotes.resolveLayerNotes('top', element);
    const middle = root.ChuwuNotes.resolveLayerNotes('middle', element);
    const base = root.ChuwuNotes.resolveLayerNotes('base', element);
    top.notes = rankByFamily(top.notes, preferredFamily);
    middle.notes = rankByFamily(middle.notes, preferredFamily);
    base.notes = rankByFamily(base.notes, preferredFamily);
    return { element, top, middle, base };
  }

  // Full recommendation set for every aspect, given a computeBazi() result and an optional
  // preferred scent family (one of ChuwuNotes.FAMILIES[].key) from the scent-preference quiz.
  function recommendForBazi(baziResult, preferredFamily) {
    const lacking = baziResult.lackingElements;
    return ASPECTS.map(aspect => {
      const targets = aspectTargetElements(aspect, lacking);
      return {
        ...aspect,
        targetElements: targets,
        isLackingMatch: aspect.key !== 'overall' && aspect.elements.some(e => lacking.includes(e)),
        scents: targets.map(el => buildScentFor(el, preferredFamily))
      };
    });
  }

  root.ChuwuRecommend = {
    ASPECTS,
    ELEMENT_ZH,
    ELEMENT_MEANING,
    aspectTargetElements,
    buildScentFor,
    recommendForBazi
  };
})(typeof window !== 'undefined' ? window : globalThis);
