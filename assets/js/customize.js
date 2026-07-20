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

  function formatPrice(amount, currencyCode) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
    } catch (e) {
      return `${amount} ${currencyCode}`;
    }
  }

  function renderSizePicker() {
    const container = document.getElementById('size-picker');
    container.innerHTML = '';
    blendSizes.forEach(size => {
      const card = el('div', { class: 'family-card', 'data-size': size.label }, [
        el('span', { class: 'label' }, [document.createTextNode(size.label)]),
        el('span', { class: 'zh' }, [document.createTextNode(formatPrice(size.price, size.currency))]),
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

  function loadBlendSizes() {
    ChuwuShopify.fetchProducts()
      .then(products => {
        blendSizes = products
          .filter(p => /personalized chu wu blend/i.test(p.title))
          .map(p => {
            const variant = p.variants.nodes[0];
            const sizeMatch = p.title.match(/(\d+\s*ml)/i);
            return {
              label: sizeMatch ? sizeMatch[1].replace(/\s+/g, '') : p.title,
              variantId: variant.id,
              price: variant.price.amount,
              currency: p.priceRange.minVariantPrice.currencyCode,
              availableForSale: variant.availableForSale
            };
          })
          .sort((a, b) => parseInt(a.label) - parseInt(b.label));
        renderSizePicker();
      })
      .catch(err => console.error('Could not load blend sizes from Shopify:', err));
  }

  populateBirthPlace();
  populateShichen();
  populateFamilyPicker();
  loadBlendSizes();

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

  function renderAspects(result, preferredFamily) {
    const grid = document.getElementById('aspect-grid');
    grid.innerHTML = '';
    const recs = ChuwuRecommend.recommendForBazi(result, preferredFamily);
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
      ? `Add to Cart — ${formatPrice(selectedSize.price, selectedSize.currency)}`
      : (notesReady ? 'Select a Bottle Size to Continue' : 'Select 1–2 Notes Per Layer to Continue');
  }

  document.getElementById('request-blend').addEventListener('click', () => {
    const btn = document.getElementById('request-blend');
    const errorEl = document.getElementById('checkout-error');
    errorEl.classList.add('hidden');

    const layerText = layer => selectedNotes[layer].map(n => n.name).join(', ');
    const attributes = [
      { key: 'Top Note', value: layerText('top') },
      { key: 'Middle Note', value: layerText('middle') },
      { key: 'Base Note', value: layerText('base') }
    ];
    if (selectedFamily) attributes.push({ key: 'Scent Preference', value: selectedFamily });
    if (lastBaziResult) {
      attributes.push({ key: 'Day Master', value: `${lastBaziResult.dayMaster.stem} (${lastBaziResult.dayMaster.element})` });
      attributes.push({ key: 'Lacking Elements', value: lastBaziResult.lackingElements.join(', ') });
    }
    if (lastBirthPlace) attributes.push({ key: 'Place of Birth', value: lastBirthPlace });

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Adding to cart…';

    ChuwuShopify.addToCart(selectedSize.variantId, 1, attributes)
      .then(() => {
        btn.textContent = 'Added ✓';
        if (window.ChuwuCartUI) {
          window.ChuwuCartUI.refresh().then(() => window.ChuwuCartUI.open());
        }
        setTimeout(() => { btn.disabled = false; updateRequestButton(); }, 1800);
      })
      .catch(err => {
        console.error(err);
        btn.disabled = false;
        btn.textContent = originalText;
        errorEl.textContent = 'Something went wrong adding this to your cart. Please try again.';
        errorEl.classList.remove('hidden');
      });
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
    renderAspects(result, selectedFamily);
    renderNotePickers(result, selectedFamily);

    ['results-section', 'recommend-section', 'build-section'].forEach(id => {
      document.getElementById(id).classList.remove('hidden');
    });
    document.getElementById('results-section').scrollIntoView({ behavior: 'smooth' });
  });
})();
