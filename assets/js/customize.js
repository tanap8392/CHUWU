(function () {
  const ELEMENT_COLOR = { Wood: '#4E6B4F', Fire: '#B4523E', Earth: '#A9835A', Metal: '#9AA3AA', Water: '#33627A' };
  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };

  let lastBaziResult = null;
  let lastBirthPlace = '';
  let selectedFamily = null;
  let selectedSize = null;
  let blendSizes = [];
  const selectedNotes = { top: [], middle: [], base: [] };
  const MAX_NOTES_PER_LAYER = 2;

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

  function populateFamilyPicker() {
    const container = document.getElementById('family-picker');
    container.innerHTML = '';
    ChuwuNotes.FAMILIES.forEach(f => {
      const card = el('div', { class: 'family-card', 'data-family': f.key }, [
        el('span', { class: 'label' }, [document.createTextNode(f.label)]),
        el('span', { class: 'zh' }, [document.createTextNode(f.zh)]),
        el('span', { class: 'desc' }, [document.createTextNode(f.desc)])
      ]);
      card.addEventListener('click', () => {
        const wasSelected = card.classList.contains('selected');
        document.querySelectorAll('.family-card').forEach(c => c.classList.remove('selected'));
        if (wasSelected) {
          selectedFamily = null;
        } else {
          card.classList.add('selected');
          selectedFamily = f.key;
        }
      });
      container.appendChild(card);
    });
  }

  function formatPrice(amount) {
    return ChuwuContent.formatPrice(amount);
  }

  function renderSizePicker() {
    const container = document.getElementById('size-picker');
    container.innerHTML = '';
    blendSizes.forEach(size => {
      const card = el('div', { class: 'family-card', 'data-size': size.label }, [
        el('span', { class: 'label' }, [document.createTextNode(size.label)]),
        el('span', { class: 'zh' }, [document.createTextNode(formatPrice(size.price))]),
        size.availableForSale ? text('') : el('span', { class: 'desc' }, [document.createTextNode('Sold out')])
      ]);
      if (size.availableForSale) {
        card.addEventListener('click', () => {
          document.querySelectorAll('#size-picker .family-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedSize = size;
          updateRequestButton();
        });
      } else {
        card.style.opacity = '0.45';
        card.style.cursor = 'not-allowed';
      }
      container.appendChild(card);
    });
  }

  function text(t) { return document.createTextNode(t); }

  // Bottle sizes are the "personalized" products in content/products.json.
  function loadBlendSizes(products) {
    blendSizes = products
      .filter(p => p.type === 'personalized' && p.status !== 'hidden')
      .map(p => ({
        label: p.size || p.name,
        productId: p.id,
        price: p.price,
        availableForSale: p.status === 'active'
      }))
      .sort((a, b) => a.price - b.price);
    renderSizePicker();
  }

  populateBirthPlace();
  populateShichen();
  populateFamilyPicker();

  // The reading needs the dashboard's note library, scent catalogue and bottle sizes, so the
  // Calculate button stays disabled until they've loaded.
  let customBlendEnabled = true;
  let elementScentsEnabled = true;
  const calcBtn = document.querySelector('#bazi-form button[type="submit"]');
  calcBtn.disabled = true;
  ChuwuContent.ready.then(data => {
    ChuwuNotes.setNotes(data.notes);
    ChuwuScents.setFromProducts(data.products);
    loadBlendSizes(data.products);
    const features = (data.settings && data.settings.features) || {};
    customBlendEnabled = features.custom_blend !== false;
    elementScentsEnabled = features.element_scents !== false;
    calcBtn.disabled = false;
  });

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

  // Reading details saved with any item added from this page, so the order shows why it was picked.
  function readingAttributes() {
    const attributes = [];
    if (selectedFamily) attributes.push({ key: 'Scent Preference', value: selectedFamily });
    if (lastBaziResult) {
      attributes.push({ key: 'Day Master', value: `${lastBaziResult.dayMaster.stem} (${lastBaziResult.dayMaster.element})` });
      attributes.push({ key: 'Lacking Elements', value: lastBaziResult.lackingElements.join(', ') });
    }
    if (lastBirthPlace) attributes.push({ key: 'Place of Birth', value: lastBirthPlace });
    return attributes;
  }

  function addedFeedback(btn, restore) {
    btn.disabled = true;
    btn.textContent = 'Added ✓';
    if (window.ChuwuCartUI) window.ChuwuCartUI.open();
    setTimeout(() => { btn.disabled = false; restore(); }, 1800);
  }

  // `picker` is the card's size picker; Add to Cart uses whichever size is selected.
  function scentCta(scent, picker) {
    if (scent.status === 'active') {
      const btn = el('button', { class: 'scent-cta active' }, [document.createTextNode('Add to Cart')]);
      btn.addEventListener('click', () => {
        ChuwuCart.add(scent.id, 1, readingAttributes(), scent.sizes && scent.sizes.length ? picker.selected().size : null);
        addedFeedback(btn, () => { btn.textContent = 'Add to Cart'; });
      });
      return btn;
    }
    return el('span', { class: 'scent-cta' }, [document.createTextNode(scent.status === 'sold_out' ? 'Sold Out' : 'Coming Soon')]);
  }

  function scentCard(scent, { supporting, preferredFamily } = {}) {
    const isFamilyMatch = preferredFamily && scent.family === preferredFamily;
    const familyTag = el('span', { class: 'family-tag' + (isFamilyMatch ? ' family-match' : '') }, [
      document.createTextNode([...new Set([scent.profile, scent.family].filter(Boolean))].join(' · ') + (isFamilyMatch ? ' · your preference' : ''))
    ]);
    const price = el('span', { class: 'scent-price' }, []);
    const picker = ChuwuProductUI.sizePicker(scent, entry => ChuwuProductUI.renderPrice(price, entry));
    ChuwuProductUI.renderPrice(price, picker.selected());

    return el('div', { class: 'scent-card' + (supporting ? ' supporting-card' : '') + (isFamilyMatch ? ' family-highlight' : '') }, [
      ChuwuProductUI.media(scent, 'scent-media'),
      el('div', { class: 'scent-body' }, [
        ...(supporting ? [el('div', { class: 'supporting-tag' }, [document.createTextNode('Supporting — nourishes your ' + supporting)])] : []),
        el('h3', {}, [
          el('span', { class: 'el-swatch', style: `background:${ELEMENT_COLOR[scent.element]}` }, []),
          el('span', { class: 'scent-code' }, [document.createTextNode(scent.code)])
        ]),
        familyTag,
        ...(ChuwuProductUI.elementMix(scent) ? [ChuwuProductUI.elementMix(scent)] : []),
        ...(scent.inspired_by ? [el('p', { class: 'scent-inspired' }, [document.createTextNode('Similar in scent to ' + scent.inspired_by)])] : []),
        ...(scent.description ? [el('p', { class: 'scent-desc' }, [document.createTextNode(scent.description)])] : []),
        el('p', { class: 'scent-notes' }, [document.createTextNode(scent.notes || '')]),
        ...(picker.node ? [picker.node] : []),
        el('div', { class: 'scent-price-row' }, [price, scentCta(scent, picker)])
      ])
    ]);
  }

  function renderElementScents(result, preferredFamily) {
    const grid = document.getElementById('scent-grid');
    const supportingWrap = document.getElementById('supporting-wrap');
    const supportingGrid = document.getElementById('supporting-grid');
    grid.innerHTML = '';
    supportingGrid.innerHTML = '';
    const recs = ChuwuScentRecommend.recommendScents(result, preferredFamily);

    recs.forEach(rec => {
      rec.scents.forEach(scent => {
        grid.appendChild(scentCard(scent, { preferredFamily }));
      });
      if (rec.supporting) {
        rec.supporting.scents.forEach(scent => {
          supportingGrid.appendChild(scentCard(scent, { supporting: rec.element, preferredFamily }));
        });
      }
    });

    supportingWrap.classList.toggle('hidden', supportingGrid.children.length === 0);
  }

  function renderNotePickers(result, preferredFamily) {
    const lacking = result.lackingElements;
    ['top', 'middle', 'base'].forEach(layer => {
      const container = document.getElementById('picker-' + layer);
      container.innerHTML = '';
      selectedNotes[layer] = [];

      const notes = ChuwuNotes.NOTES[layer].slice().sort((a, b) => {
        const score = n => (lacking.includes(n.element) ? 2 : 0) + (preferredFamily && n.family === preferredFamily ? 1 : 0);
        return score(b) - score(a);
      });

      notes.forEach(note => {
        const isRecommended = lacking.includes(note.element);
        const isFamilyMatch = preferredFamily && note.family === preferredFamily;
        const isSoldOut = note.stock === 'sold_out';
        const classes = ['note-pick'];
        if (isRecommended) classes.push('recommended');
        if (isFamilyMatch) classes.push('family-match');
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
        if (!isSoldOut) chip.addEventListener('click', () => toggleNote(layer, note, chip));
        container.appendChild(chip);
      });
      updatePreview(layer);
    });
    updateRequestButton();
  }

  function toggleNote(layer, note, chipEl) {
    const list = selectedNotes[layer];
    const idx = list.findIndex(n => n.name === note.name);
    if (idx >= 0) {
      list.splice(idx, 1);
      chipEl.classList.remove('selected');
    } else {
      if (list.length >= MAX_NOTES_PER_LAYER) return; // already at the 2-note cap for this layer
      list.push(note);
      chipEl.classList.add('selected');
    }
    updatePreview(layer);
    updateRequestButton();
  }

  function updatePreview(layer) {
    const previewEl = document.getElementById('preview-' + layer);
    const list = selectedNotes[layer];
    previewEl.textContent = list.length
      ? list.map(n => `${n.name} (${n.zh} · ${n.element})`).join(' + ')
      : '—';
  }

  function updateRequestButton() {
    const btn = document.getElementById('request-blend');
    const notesReady = selectedNotes.top.length && selectedNotes.middle.length && selectedNotes.base.length;
    const ready = notesReady && selectedSize;
    btn.disabled = !ready;
    btn.textContent = ready
      ? `Add to Cart — ${formatPrice(selectedSize.price)}`
      : (notesReady ? 'Select a Bottle Size to Continue' : 'Select 1–2 Notes Per Layer to Continue');
  }

  document.getElementById('request-blend').addEventListener('click', () => {
    const btn = document.getElementById('request-blend');
    const layerText = layer => selectedNotes[layer].map(n => n.name).join(', ');
    const attributes = [
      { key: 'Top Note', value: layerText('top') },
      { key: 'Middle Note', value: layerText('middle') },
      { key: 'Base Note', value: layerText('base') },
      ...readingAttributes()
    ];
    ChuwuCart.add(selectedSize.productId, 1, attributes);
    addedFeedback(btn, updateRequestButton);
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
    const sections = ['results-section'];
    if (elementScentsEnabled) {
      renderElementScents(result, selectedFamily);
      sections.push('recommend-section');
    }
    if (customBlendEnabled) {
      renderNotePickers(result, selectedFamily);
      sections.push('build-section');
    }

    sections.forEach(id => {
      document.getElementById(id).classList.remove('hidden');
    });
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  });
})();
