(function () {
  const ELEMENT_COLOR = { Wood: '#4E6B4F', Fire: '#B4523E', Earth: '#A9835A', Metal: '#9AA3AA', Water: '#33627A' };
  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  let lastBaziResult = null;
  let lastBirthPlace = '';
  const selectedNotes = { top: null, middle: null, base: null };

  const SHICHEN = [
    { value: '23:30', label: '子时 Zi · 23:00–00:59' },
    { value: '01:30', label: '丑时 Chou · 01:00–02:59' },
    { value: '03:30', label: '寅时 Yin · 03:00–04:59' },
    { value: '05:30', label: '卯时 Mao · 05:00–06:59' },
    { value: '07:30', label: '辰时 Chen · 07:00–08:59' },
    { value: '09:30', label: '巳时 Si · 09:00–10:59' },
    { value: '11:30', label: '午时 Wu · 11:00–12:59 (midday estimate)' },
    { value: '13:30', label: '未时 Wei · 13:00–14:59' },
    { value: '15:30', label: '申时 Shen · 15:00–16:59' },
    { value: '17:30', label: '酉时 You · 17:00–18:59' },
    { value: '19:30', label: '戌时 Xu · 19:00–20:59' },
    { value: '21:30', label: '亥时 Hai · 21:00–22:59' }
  ];
  const DEFAULT_SHICHEN = '11:30';

  function populateBirthPlace() {
    const select = document.getElementById('birth-place');
    select.innerHTML = '';
    select.appendChild(el('option', { value: '' }, [document.createTextNode('Not sure / prefer not to say')]));
    const groups = {};
    Object.entries(ChuwuCities.CITIES).forEach(([name, info]) => {
      (groups[info.group] = groups[info.group] || []).push(name);
    });
    Object.entries(groups).forEach(([groupName, cities]) => {
      const optgroup = el('optgroup', { label: groupName }, []);
      cities.sort().forEach(name => {
        optgroup.appendChild(el('option', { value: name }, [document.createTextNode(name)]));
      });
      select.appendChild(optgroup);
    });
  }

  function populateShichen() {
    const select = document.getElementById('birth-shichen');
    select.innerHTML = '';
    SHICHEN.forEach(s => {
      const opt = el('option', { value: s.value }, [document.createTextNode(s.label)]);
      if (s.value === DEFAULT_SHICHEN) opt.setAttribute('selected', 'selected');
      select.appendChild(opt);
    });
  }

  populateBirthPlace();
  populateShichen();

  fetch('content/notes-stock.json')
    .then(r => r.json())
    .then(data => ChuwuNotes.applyStock(data.notes))
    .catch(err => console.error('Could not load ingredient stock data, defaulting to in-stock:', err));

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach(c => node.appendChild(c));
    return node;
  }

  function renderPillars(result) {
    const grid = document.getElementById('pillars-grid');
    grid.innerHTML = '';
    ['year', 'month', 'day', 'hour'].forEach(key => {
      const p = result.pillars[key];
      const card = el('div', { class: 'pillar-card' }, [
        el('div', { class: 'label' }, [document.createTextNode(key + ' Pillar')]),
        el('div', { class: 'cn' }, [document.createTextNode(p.label)]),
        el('div', { class: 'en' }, [document.createTextNode(p.stemElement + ' / ' + p.branchElement)])
      ]);
      grid.appendChild(card);
    });
    document.getElementById('results-heading').textContent =
      'Day Master: ' + result.dayMaster.stem + ' (' + result.dayMaster.element + ')';
  }

  function renderTally(result) {
    const chart = document.getElementById('tally-chart');
    chart.innerHTML = '';
    const order = result.elementOrder;
    const max = Math.max(...order.map(k => result.elementTally[k]), 0.0001);
    order.forEach(key => {
      const val = result.elementTally[key];
      const pct = Math.max((val / max) * 100, val > 0 ? 4 : 0);
      const row = el('div', { class: 'tally-row' }, [
        el('div', { class: 'el-label' }, [document.createTextNode(key + ' ' + ELEMENT_ZH[key])]),
        el('div', { class: 'tally-track' }, [
          el('div', { class: 'tally-fill', style: `width:${pct}%;background:${ELEMENT_COLOR[key]}` }, [])
        ]),
        el('div', { class: 'el-val' }, [document.createTextNode(val.toFixed(1))])
      ]);
      chart.appendChild(row);
    });

    const lackingEl = document.getElementById('lacking-tags');
    lackingEl.innerHTML = '';
    result.lackingElements.forEach(k => {
      const tag = el('span', { class: 'tag', style: `background:${ELEMENT_COLOR[k]};color:#fff` }, [
        document.createTextNode('Lacking: ' + k + ' ' + ELEMENT_ZH[k])
      ]);
      lackingEl.appendChild(tag);
    });

    const analysis = document.getElementById('analysis-text');
    const lackList = result.lackingElements.join(' and ');
    analysis.textContent =
      `Your chart is anchored by a ${result.dayMaster.element} Day Master, but shows the least ` +
      `${lackList} energy among the Five Elements. Bringing in ${lackList} through scent can help ` +
      `restore balance to the areas of life that element governs.`;
  }

  const STOCK_ORDER = { in_stock: 0, low_stock: 1, sold_out: 2 };
  const STOCK_SUFFIX = { low_stock: ' (low stock)', sold_out: ' (sold out)' };

  function renderAspects(result) {
    const grid = document.getElementById('aspect-grid');
    grid.innerHTML = '';
    const recs = ChuwuRecommend.recommendForBazi(result);
    recs.forEach(aspect => {
      const layerBlocks = ['top', 'middle', 'base'].map(layer => {
        const scentGroups = aspect.scents.map(s => s[layer]).filter(g => g.notes.length);
        if (!scentGroups.length) return null;
        const chips = [];
        const fallbacks = [];
        scentGroups.forEach(g => {
          const ordered = g.notes.slice().sort((a, b) => (STOCK_ORDER[a.stock] || 0) - (STOCK_ORDER[b.stock] || 0));
          ordered.slice(0, 3).forEach(n => {
            const suffix = STOCK_SUFFIX[n.stock] || '';
            chips.push(el('span', { class: 'note-chip' }, [document.createTextNode(n.name + suffix)]));
          });
          if (g.isFallback) {
            fallbacks.push(`${g.element} (supports ${aspect.targetElements[0]})`);
          }
        });
        const blockChildren = [
          el('div', { class: 'layer-name' }, [document.createTextNode(layer)]),
          el('div', {}, chips)
        ];
        if (fallbacks.length) {
          blockChildren.push(el('div', { class: 'fallback-note' }, [
            document.createTextNode('No direct note for this layer — drawing from ' + fallbacks.join(', ') + '.')
          ]));
        }
        return el('div', { class: 'layer-block' }, blockChildren);
      }).filter(Boolean);

      const badge = aspect.isLackingMatch
        ? el('span', { class: 'tag', style: 'background:var(--gold);color:var(--charcoal)' }, [document.createTextNode('Matches your reading')])
        : null;

      const card = el('div', { class: 'aspect-card' }, [
        el('h3', {}, [document.createTextNode(aspect.label + ' '), ...(badge ? [badge] : [])]),
        el('p', { class: 'muted' }, [document.createTextNode(aspect.blurb)]),
        ...layerBlocks
      ]);
      grid.appendChild(card);
    });
  }

  function renderNotePickers(result) {
    const lacking = result.lackingElements;
    ['top', 'middle', 'base'].forEach(layer => {
      const container = document.getElementById('picker-' + layer);
      container.innerHTML = '';
      ChuwuNotes.NOTES[layer].forEach(note => {
        const isRecommended = lacking.includes(note.element);
        const isSoldOut = note.stock === 'sold_out';
        const classes = ['note-pick'];
        if (isRecommended) classes.push('recommended');
        if (isSoldOut) classes.push('sold-out');
        const suffix = STOCK_SUFFIX[note.stock] || '';
        const chip = el('span', {
          class: classes.join(' '),
          'data-layer': layer,
          'data-name': note.name
        }, [
          document.createTextNode(note.name + suffix),
          el('span', { class: 'zh-small' }, [document.createTextNode(note.zh + ' · ' + note.element)])
        ]);
        if (!isSoldOut) chip.addEventListener('click', () => selectNote(layer, note, chip));
        container.appendChild(chip);
      });
    });
  }

  function selectNote(layer, note, chipEl) {
    document.querySelectorAll(`#picker-${layer} .note-pick`).forEach(c => c.classList.remove('selected'));
    chipEl.classList.add('selected');
    selectedNotes[layer] = note;
    document.getElementById('preview-' + layer).textContent = `${note.name} (${note.zh} · ${note.element})`;
    updateRequestButton();
  }

  function updateRequestButton() {
    const btn = document.getElementById('request-blend');
    const ready = selectedNotes.top && selectedNotes.middle && selectedNotes.base;
    btn.disabled = !ready;
    btn.textContent = ready ? 'Request This Blend' : 'Select All 3 Notes to Request This Blend';
  }

  document.getElementById('request-blend').addEventListener('click', () => {
    const name = document.getElementById('req-name').value || '(not provided)';
    const email = document.getElementById('req-email').value || '(not provided)';
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      '',
      'Custom Blend Request:',
      `Top: ${selectedNotes.top.name} (${selectedNotes.top.element})`,
      `Middle: ${selectedNotes.middle.name} (${selectedNotes.middle.element})`,
      `Base: ${selectedNotes.base.name} (${selectedNotes.base.element})`,
      '',
      lastBaziResult ? `Day Master: ${lastBaziResult.dayMaster.stem} (${lastBaziResult.dayMaster.element})` : '',
      lastBaziResult ? `Lacking Elements: ${lastBaziResult.lackingElements.join(', ')}` : '',
      lastBirthPlace ? `Place of Birth: ${lastBirthPlace}` : ''
    ].join('\n');
    const mailto = `mailto:hello@chuwu.com?subject=${encodeURIComponent('Custom Blend Request')}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });

  document.getElementById('bazi-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.classList.add('hidden');

    const dateVal = document.getElementById('birth-date').value;
    const shichenVal = document.getElementById('birth-shichen').value || DEFAULT_SHICHEN;
    const placeVal = document.getElementById('birth-place').value;
    if (!dateVal) {
      errorEl.textContent = 'Please enter your date of birth.';
      errorEl.classList.remove('hidden');
      return;
    }
    const [year, month, day] = dateVal.split('-').map(Number);
    const [hour, minute] = shichenVal.split(':').map(Number);
    const adjusted = ChuwuCities.adjustForTrueSolarTime({ year, month, day, hour, minute }, placeVal);

    let result;
    try {
      result = ChuwuBazi.computeBazi(adjusted);
    } catch (err) {
      errorEl.textContent = 'Something went wrong calculating your Bazi. Please check your date and try again.';
      errorEl.classList.remove('hidden');
      console.error(err);
      return;
    }

    lastBaziResult = result;
    lastBirthPlace = placeVal || 'Not specified';
    renderPillars(result);
    renderTally(result);
    renderAspects(result);
    renderNotePickers(result);

    ['results-section', 'recommend-section', 'build-section'].forEach(id => {
      document.getElementById(id).classList.remove('hidden');
    });
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  });
})();
