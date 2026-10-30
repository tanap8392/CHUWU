/* CHUWU (初·五) — live previews for the dashboard (/admin). Each one renders beside its form and
   updates as you type, using the real site stylesheet so it looks like the site itself.

   Decap renders these with React; `h` (= React.createElement) and `createClass` are globals
   provided by decap-cms.js. */
(function () {
  const ELEMENT_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };
  const ELEMENT_ZH = { Wood: '木', Fire: '火', Earth: '土', Metal: '金', Water: '水' };
  const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'];

  CMS.registerPreviewStyle('/assets/css/style.css');
  CMS.registerPreviewStyle('/admin/preview.css');

  // ---------------------------------------------------------------- helpers
  const data = (entry, path) => {
    const v = entry.getIn(['data'].concat(path || []));
    return v && v.toJS ? v.toJS() : v;
  };
  const money = n => 'S$' + (Number(n) || 0).toFixed(2);

  // Images just uploaded aren't on the site yet; getAsset gives a temporary URL for those.
  // Saved paths like "assets/img/…" need a leading slash inside the preview frame.
  function src(getAsset, path) {
    if (!path) return '';
    const asset = getAsset(path);
    const url = asset ? asset.toString() : '';
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    return /^(https?:|\/)/.test(path) ? path : '/' + path;
  }

  function sectionHead(eyebrow, title, lede, key) {
    return h('div', { className: 'section-head', key: key || title }, [
      eyebrow ? h('p', { className: 'eyebrow', key: 'e' }, eyebrow) : null,
      title ? h('h2', { key: 't', style: { whiteSpace: 'pre-line' } }, title) : null,
      lede ? h('p', { key: 'l' }, lede) : null
    ]);
  }

  function banner(text, tone) {
    return h('div', { className: 'pv-banner pv-' + (tone || 'info') }, text);
  }

  // ---------------------------------------------------------------- Products
  const STATUS_LABEL = { active: 'On sale', coming_soon: 'Coming soon', sold_out: 'Sold out', hidden: 'Hidden' };

  function productCard(p, getAsset, i) {
    const photos = [p.image].concat(p.gallery || []).filter(Boolean);
    const elements = p.type === 'element_scent' ? [p.element] : (p.elements || []);
    const title = p.type === 'signature'
      ? `${p.name || 'Untitled'}${p.name_zh ? ' (' + p.name_zh + ')' : ''} — ${p.size || ''}`
      : p.type === 'element_scent'
        ? `${p.code || '???'} · ${p.element || ''} ${ELEMENT_ZH[p.element] || ''}`
        : `${p.name || 'Untitled'} — ${p.size || ''}`;
    // Products with several sizes show each size's price; the first is the starting price.
    const sizes = (p.sizes || []).filter(s => s && s.size);
    const first = sizes[0] || p;
    const onSale = first.compare_at_price && Number(first.compare_at_price) > Number(first.price);

    return h('div', { className: 'product-card pv-status-' + (p.status || 'active'), key: i }, [
      h('div', { className: 'product-media' + (photos.length > 1 ? ' has-alt' : ''), key: 'm' }, [
        photos.length
          ? h('img', { key: 'i', className: 'media-main', src: src(getAsset, photos[0]) })
          : h('div', { key: 'b', className: 'bottle', style: { background: 'linear-gradient(180deg,#C8B38A,#2D2A28)' } }),
        photos.length > 1 ? h('img', { key: 'a', className: 'media-alt', src: src(getAsset, photos[1]) }) : null,
        p.badge ? h('span', { key: 'g', className: 'product-badge' }, p.badge) : null,
        h('span', { key: 's', className: 'pv-status-chip' }, STATUS_LABEL[p.status || 'active'])
      ]),
      h('div', { className: 'product-body', key: 'body' }, [
        h('h3', { key: 'h' }, title),
        p.intention ? h('p', { key: 'in', className: 'muted', style: { fontSize: '0.9rem' } }, 'For ' + p.intention) : null,
        p.type === 'element_scent' ? h('p', { key: 'fa', className: 'muted', style: { fontSize: '0.9rem' } }, [p.profile, p.family].filter(Boolean).join(' · ')) : null,
        elements.length ? h('div', { key: 'tags', className: 'product-tags' }, elements.map(e =>
          h('span', { key: e, className: 'tag', style: { background: `var(${ELEMENT_VAR[e]})`, color: '#fff' } }, e))) : null,
        mixBar(p.element_mix),
        p.inspired_by ? h('p', { key: 'ib', className: 'muted', style: { fontSize: '0.85rem' } }, 'Similar in scent to ' + p.inspired_by) : null,
        p.description ? h('p', { key: 'd', className: 'muted', style: { fontSize: '0.85rem' } }, p.description) : null,
        p.notes ? h('div', { key: 'n', className: 'note-line notes-block' }, p.notes) : null,
        sizes.length ? h('div', { key: 'sz', className: 'size-picker' }, sizes.map((s, j) =>
          h('span', { key: j, className: 'size-opt' + (j === 0 ? ' active' : '') }, `${s.size} · ${money(s.price)}`))) : null,
        ...[['Top', p.top], ['Middle', p.middle], ['Base', p.base]].filter(x => x[1]).map(([l, v]) =>
          h('div', { key: l, className: 'note-line' }, [h('b', { key: 'b' }, l + ':'), ' ' + v])),
        h('div', { key: 'pr', className: 'price-row' }, [
          h('span', { key: 'p', className: 'price' }, [
            onSale ? h('s', { key: 's', className: 'compare-price' }, money(first.compare_at_price)) : null,
            onSale ? ' ' : null,
            money(first.price)
          ]),
          h('span', { key: 'c', className: 'btn ' + (p.status === 'active' || !p.status ? 'btn-primary' : '') },
            p.status === 'sold_out' ? 'Sold Out' : p.status === 'coming_soon' ? 'Coming Soon'
              : p.type === 'personalized' ? 'Personalize' : 'Add to Cart')
        ])
      ])
    ]);
  }

  // Same element-mix bar as the Shop page: share of votes per element, largest first.
  function mixBar(mix) {
    const list = (mix || []).filter(m => m && m.element && Number(m.votes) > 0).sort((a, b) => b.votes - a.votes);
    if (!list.length) return null;
    const total = list.reduce((s, m) => s + Number(m.votes), 0);
    const pct = m => Math.round((Number(m.votes) / total) * 100);
    return h('div', { key: 'mix', className: 'element-mix' }, [
      h('div', { key: 'b', className: 'mix-bar' }, list.map((m, i) => h('span', { key: i, style: { width: pct(m) + '%', background: `var(${ELEMENT_VAR[m.element]})` } }))),
      h('div', { key: 'l', className: 'mix-legend' }, list.map((m, i) => h('span', { key: i }, [h('i', { key: 'd', style: { background: `var(${ELEMENT_VAR[m.element]})` } }), `${m.element} ${pct(m)}%`])))
    ]);
  }

  const ProductsPreview = createClass({
    render() {
      const products = data(this.props.entry, ['products']) || [];
      const getAsset = this.props.getAsset;
      const counts = {};
      products.forEach(p => { const s = p.status || 'active'; counts[s] = (counts[s] || 0) + 1; });
      const group = (type, label) => {
        const list = products.filter(p => p.type === type);
        if (!list.length) return null;
        return h('div', { key: type, style: { marginBottom: '48px' } }, [
          h('p', { key: 'e', className: 'eyebrow center', style: { marginBottom: '20px' } }, `${label} · ${list.length}`),
          h('div', { key: 'g', className: 'grid-3' }, list.map((p, i) => productCard(p, getAsset, i)))
        ]);
      };
      return h('div', { className: 'pv-page' }, [
        h('div', { key: 'stats', className: 'pv-stats' }, Object.keys(STATUS_LABEL).map(s =>
          h('div', { key: s, className: 'pv-stat pv-stat-' + s }, [h('b', { key: 'n' }, counts[s] || 0), h('span', { key: 'l' }, STATUS_LABEL[s])]))),
        banner('This is how products appear on the Shop page. Hover a photo to see its second photo. Hidden products are shown faded here but don\'t appear on the site.', 'info'),
        h('div', { key: 'c', className: 'container', style: { paddingTop: '24px' } }, [
          group('signature', 'Signature blends'),
          group('element_scent', 'Element scents'),
          group('personalized', 'Personalized blend sizes')
        ])
      ]);
    }
  });
  CMS.registerPreviewTemplate('products', ProductsPreview);

  // ---------------------------------------------------------------- Home page
  const HomePreview = createClass({
    render() {
      const d = data(this.props.entry) || {};
      const hero = d.hero || {};
      const ph = d.philosophy || {};
      const how = d.how || {};
      const poster = src(this.props.getAsset, hero.poster);
      return h('div', {}, [
        h('section', { key: 'hero', className: 'hero-full', style: { minHeight: '560px' } }, [
          h('div', { key: 'm', className: 'hero-media', style: poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {} }),
          h('div', { key: 's', className: 'hero-scrim' }),
          h('div', { key: 'o', className: 'hero-overlay' }, [
            h('div', { key: 'cn', className: 'cn-mark' }, hero.cn_mark),
            h('p', { key: 'e', className: 'eyebrow' }, hero.eyebrow),
            h('h1', { key: 't', style: { whiteSpace: 'pre-line' } }, hero.title),
            h('p', { key: 'l', className: 'lede' }, hero.lede),
            h('div', { key: 'a', className: 'hero-actions' }, [
              hero.primary_label ? h('span', { key: 1, className: 'btn btn-primary' }, hero.primary_label) : null,
              hero.secondary_label ? h('span', { key: 2, className: 'btn btn-light' }, hero.secondary_label) : null
            ])
          ])
        ]),
        h('div', { key: 'note', className: 'pv-caption' }, 'The background video plays on the live site; the poster image is shown here.'),
        h('section', { key: 'ph' }, h('div', { className: 'container' }, [
          sectionHead(ph.eyebrow, ph.title, ph.body, 'ph'),
          h('div', { key: 'g', className: 'grid-5' }, (ph.elements || []).map((e, i) =>
            h('div', { key: i, className: 'element-card' }, [
              h('div', { key: 'g', className: 'element-glyph', style: { background: `var(${ELEMENT_VAR[e.element] || '--gold'})` } }, e.glyph),
              h('h4', { key: 'h' }, e.element),
              h('span', { key: 'z', className: 'zh' }, e.theme),
              h('p', { key: 'p' }, e.line)
            ])))
        ])),
        h('section', { key: 'how', className: 'alt' }, h('div', { className: 'container' }, [
          sectionHead(how.eyebrow, how.title, null, 'how'),
          h('div', { key: 'g', className: 'grid-3' }, (how.steps || []).map((s, i) =>
            h('div', { key: i, className: 'step-card' }, [
              h('div', { key: 'n', className: 'step-num' }, String(i + 1).padStart(2, '0')),
              h('h3', { key: 't' }, s.title),
              h('p', { key: 'b', className: 'muted' }, s.body)
            ]))),
          how.cta_label ? h('div', { key: 'c', className: 'center', style: { marginTop: '44px' } }, h('span', { className: 'btn btn-gold' }, how.cta_label)) : null
        ]))
      ]);
    }
  });
  CMS.registerPreviewTemplate('home', HomePreview);

  // ---------------------------------------------------------------- Shop page & Bazi page text
  const placeholderGrid = (n, label) => h('div', { className: 'grid-3', key: 'grid-' + label },
    Array.from({ length: n }, (_, i) => h('div', { key: i, className: 'pv-placeholder' }, label)));

  CMS.registerPreviewTemplate('shop', createClass({
    render() {
      const d = data(this.props.entry) || {};
      const part = (key, n, label) => d[key] ? h('section', { key }, h('div', { className: 'container' }, [
        sectionHead(d[key].eyebrow, d[key].title, d[key].lede, key), placeholderGrid(n, label)
      ])) : null;
      return h('div', {}, [
        part('signature', 3, 'Signature blend'),
        part('element_scents', 3, 'Element scent'),
        part('personalized', 2, 'Personalized size'),
        d.closing ? h('div', { key: 'cl', className: 'center', style: { padding: '0 0 60px' } }, [
          h('p', { key: 't', className: 'muted' }, d.closing.text),
          h('span', { key: 'b', className: 'btn btn-gold' }, d.closing.cta_label)
        ]) : null
      ]);
    }
  }));

  CMS.registerPreviewTemplate('customize', createClass({
    render() {
      const d = data(this.props.entry) || {};
      const hd = d.header || {};
      return h('div', {}, [
        h('section', { key: 'h', className: 'hero' }, h('div', { className: 'container' }, [
          h('p', { key: 'e', className: 'eyebrow' }, hd.eyebrow),
          h('h1', { key: 't' }, hd.title),
          h('p', { key: 'l', className: 'lede' }, hd.lede)
        ])),
        h('div', { key: 'f', className: 'pv-placeholder', style: { maxWidth: '560px', margin: '30px auto', height: '120px' } }, 'Birth details form'),
        d.recommend ? h('section', { key: 'r' }, h('div', { className: 'container' }, [
          sectionHead(d.recommend.eyebrow, d.recommend.title, d.recommend.lede, 'r'),
          h('p', { key: 'x', className: 'muted center', style: { fontSize: '0.85rem', maxWidth: '640px', margin: '0 auto 30px' } }, d.recommend.explainer),
          placeholderGrid(3, 'Recommended scent')
        ])) : null,
        d.build ? h('section', { key: 'b', className: 'alt' }, h('div', { className: 'container', style: { maxWidth: '760px' } }, [
          sectionHead(d.build.eyebrow, d.build.title, d.build.lede, 'b'),
          h('div', { key: 'p', className: 'pv-placeholder', style: { height: '120px' } }, 'Note picker')
        ])) : null,
        h('p', { key: 'd', className: 'note-disclaimer center', style: { padding: '40px 20px' } }, d.disclaimer)
      ]);
    }
  }));

  // ---------------------------------------------------------------- Info pages
  const md = text => ({ __html: window.marked ? window.marked.parse(text || '') : '' });

  const InfoPreview = createClass({
    render() {
      const d = data(this.props.entry) || {};
      return h('div', {}, [
        d.published ? banner('Shown on the site and linked in the footer.', 'ok') : banner('Not on the site yet — switch on "Show on site" and publish to make it live.', 'warn'),
        h('section', { key: 'h', className: 'hero', style: { padding: '60px 0 30px' } }, h('div', { className: 'container' }, h('h1', {}, d.title))),
        h('section', { key: 'b', style: { paddingTop: '30px' } }, h('div', { className: 'container', style: { maxWidth: '720px' } }, [
          d.intro ? h('p', { key: 'i', className: 'center muted', style: { marginBottom: '36px' } }, d.intro) : null,
          ...(d.items || []).map((it, i) => h('details', { key: 'q' + i, className: 'faq-item', open: i === 0 }, [
            h('summary', { key: 's' }, it.question),
            h('div', { key: 'a', className: 'prose', dangerouslySetInnerHTML: md(it.answer) })
          ])),
          d.body ? h('div', { key: 'body', className: 'prose', dangerouslySetInnerHTML: md(d.body) }) : null
        ]))
      ]);
    }
  });
  ['about', 'faq', 'shipping', 'privacy'].forEach(name => CMS.registerPreviewTemplate(name, InfoPreview));

  // ---------------------------------------------------------------- Promotions
  function parseDay(v, end) {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (end) d.setDate(d.getDate() + 1);
    return d;
  }
  function promoStatus(p) {
    if (!p.active) return ['Off', 'off'];
    const now = new Date();
    const s = parseDay(p.starts), e = parseDay(p.ends, true);
    if (s && now < s) return ['Scheduled', 'scheduled'];
    if (e && now >= e) return ['Expired', 'expired'];
    return ['Live now', 'live'];
  }
  const APPLIES = { all: 'Everything', signature: 'Signature blends', personalized: 'Personalized blends', element_scent: 'Element scents' };
  function describe(p) {
    const v = Number(p.value) || 0;
    const what = p.type === 'free_delivery' ? 'Free delivery' : p.type === 'fixed' ? `S$${v.toFixed(2)} off` : `${v}% off`;
    const min = Number(p.min_subtotal) > 0 ? ` · min. spend ${money(p.min_subtotal)}` : '';
    return `${what} · ${APPLIES[p.applies_to || 'all']}${min}`;
  }

  CMS.registerPreviewTemplate('promotions', createClass({
    render() {
      const promos = data(this.props.entry, ['promotions']) || [];
      return h('div', { className: 'pv-page container', style: { paddingTop: '30px', paddingBottom: '40px' } }, [
        h('h2', { key: 'h' }, 'Promotions overview'),
        h('p', { key: 'p', className: 'muted' }, 'Only one offer applies per order — whichever saves the customer most. Codes aren\'t case-sensitive.'),
        promos.length ? null : h('p', { key: 'none', className: 'pv-placeholder' }, 'No promotions yet — click "Add Promotion" on the left.'),
        ...promos.map((p, i) => {
          const [label, tone] = promoStatus(p);
          return h('div', { key: i, className: 'pv-promo' }, [
            h('div', { key: 't', className: 'pv-promo-top' }, [
              h('b', { key: 'n' }, p.name || 'Untitled promotion'),
              h('span', { key: 's', className: 'pv-chip pv-chip-' + tone }, label)
            ]),
            h('div', { key: 'd', className: 'pv-promo-desc' }, describe(p)),
            h('div', { key: 'c', className: 'pv-promo-meta' }, [
              p.auto_apply ? h('span', { key: 'a', className: 'pv-code' }, 'Applies automatically') : null,
              p.code ? h('span', { key: 'c', className: 'pv-code' }, p.code.toUpperCase()) : null,
              !p.auto_apply && !p.code ? h('span', { key: 'w', className: 'pv-chip pv-chip-expired' }, 'Needs a code or "Apply automatically"') : null,
              (p.starts || p.ends) ? h('span', { key: 'dt', className: 'muted' }, `${p.starts || 'now'} → ${p.ends || 'no end date'}`) : null
            ])
          ]);
        })
      ]);
    }
  }));

  // ---------------------------------------------------------------- Note library
  CMS.registerPreviewTemplate('notes', createClass({
    render() {
      const notes = data(this.props.entry, ['notes']) || [];
      const layers = ['top', 'middle', 'base'];
      const count = (l, e) => notes.filter(n => n.layer === l && n.element === e).length;
      return h('div', { className: 'pv-page container', style: { paddingTop: '30px', paddingBottom: '40px' } }, [
        h('h2', { key: 'h' }, 'Note library at a glance'),
        h('p', { key: 'p', className: 'muted' }, 'How many notes each layer has for each element. Empty cells mean customers lacking that element get a substitute note for that layer.'),
        h('table', { key: 't', className: 'pv-matrix' }, [
          h('thead', { key: 'h' }, h('tr', {}, [h('th', { key: 'x' }, '')].concat(ELEMENTS.map(e =>
            h('th', { key: e }, [h('span', { key: 'd', className: 'pv-dot', style: { background: `var(${ELEMENT_VAR[e]})` } }), `${e} ${ELEMENT_ZH[e]}`]))))),
          h('tbody', { key: 'b' }, layers.map(l => h('tr', { key: l }, [h('th', { key: 'l' }, l)].concat(ELEMENTS.map(e => {
            const c = count(l, e);
            return h('td', { key: e, className: c ? '' : 'pv-empty' }, c || '—');
          })))))
        ]),
        ...layers.map(l => h('div', { key: 'list-' + l, style: { marginTop: '26px' } }, [
          h('p', { key: 'e', className: 'eyebrow' }, l + ' notes'),
          h('div', { key: 'c' }, notes.filter(n => n.layer === l).map((n, i) =>
            h('span', { key: i, className: 'pv-note pv-stock-' + (n.stock || 'in_stock'), title: n.stock }, [
              h('span', { key: 'd', className: 'pv-dot', style: { background: `var(${ELEMENT_VAR[n.element]})` } }),
              n.name, n.zh ? h('small', { key: 'z' }, ' ' + n.zh) : null
            ])))
        ])),
        h('p', { key: 'leg', className: 'muted', style: { marginTop: '20px', fontSize: '0.8rem' } }, 'Faded = low stock · Struck through = unavailable (customers can\'t pick it).')
      ]);
    }
  }));

  // ---------------------------------------------------------------- Site settings
  const THEME_LABELS = { ivory: 'Background', charcoal: 'Text & buttons', gold: 'Accent', grey: 'Borders', ink: 'Hover', wood: 'Wood', fire: 'Fire', earth: 'Earth', metal: 'Metal', water: 'Water' };

  CMS.registerPreviewTemplate('settings', createClass({
    render() {
      const s = data(this.props.entry) || {};
      const getAsset = this.props.getAsset;
      const theme = s.theme || {};
      const vars = {};
      Object.entries(theme).forEach(([k, v]) => { if (v) vars['--' + k] = v; });
      const c = s.contact || {};
      const co = s.checkout || {};
      const pn = co.paynow || {};
      const m = s.marketing || {};
      const f = s.features || {};

      let qr = null;
      if (pn.enabled !== false && pn.uen_or_mobile && window.ChuwuPayNow) {
        const payload = ChuwuPayNow.payload({ proxy: pn.uen_or_mobile, amount: 10, reference: 'CW-SAMPLE', name: pn.payee_name });
        if (payload) qr = ChuwuPayNow.toPngDataUrl(payload, 220);
      }
      const on = (v, label) => h('span', { key: label, className: 'pv-chip pv-chip-' + (v ? 'live' : 'off') }, (v ? '✓ ' : '✗ ') + label);

      return h('div', { style: Object.assign({ background: 'var(--ivory)', minHeight: '100%' }, vars) }, [
        s.announcement && s.announcement.enabled && s.announcement.text
          ? h('div', { key: 'ann', className: 'announcement-bar' }, s.announcement.text)
          : h('div', { key: 'ann', className: 'pv-caption' }, 'Announcement bar is off.'),
        h('div', { key: 'nav', className: 'pv-nav' }, [
          h('img', { key: 'l', src: src(getAsset, (s.brand || {}).logo), style: { height: '40px' } }),
          h('span', { key: 'c', className: 'nav-cta' }, 'Find Your Element')
        ]),
        h('div', { key: 'body', className: 'container', style: { padding: '30px 28px' } }, [
          h('h3', { key: 'th' }, 'Colours'),
          h('div', { key: 'sw', className: 'pv-swatches' }, Object.keys(THEME_LABELS).map(k =>
            h('div', { key: k, className: 'pv-swatch' }, [
              h('span', { key: 'c', style: { background: theme[k] } }),
              h('b', { key: 'l' }, THEME_LABELS[k]),
              h('small', { key: 'v' }, theme[k])
            ]))),
          h('div', { key: 'sample', className: 'pv-sample' }, [
            h('span', { key: 1, className: 'btn btn-primary' }, 'Add to Cart'),
            h('span', { key: 2, className: 'btn btn-gold' }, 'Start Your Reading'),
            ...ELEMENTS.map(e => h('span', { key: e, className: 'tag', style: { background: `var(${ELEMENT_VAR[e]})`, color: '#fff' } }, e))
          ]),

          h('h3', { key: 'fh', style: { marginTop: '36px' } }, 'Features & tracking'),
          h('div', { key: 'fe', className: 'pv-chips' }, [
            on(f.custom_blend !== false, 'Build Your Own Blend'),
            on(f.element_scents !== false, 'Element scent recommendations'),
            on(co.gift_option !== false, 'Gift message at checkout'),
            on(!!m.meta_pixel_id, 'Meta Pixel'),
            on(!!m.ga4_id, 'Google Analytics')
          ]),

          h('h3', { key: 'ch', style: { marginTop: '36px' } }, 'Checkout'),
          h('div', { key: 'cg', className: 'pv-checkout' }, [
            h('div', { key: 'del' }, [
              h('p', { key: 'e', className: 'eyebrow' }, 'Delivery options'),
              ...(co.delivery_options || []).map((d, i) => h('div', { key: i, className: 'option-card' }, h('span', {}, [
                d.label || 'Delivery',
                h('span', { key: 'm', className: 'option-meta' },
                  (Number(d.fee) > 0 ? money(d.fee) : 'Free') + (Number(d.free_over) > 0 && Number(d.fee) > 0 ? ` · free over ${money(d.free_over)}` : '') + (d.needs_address === false ? ' · no address needed' : ''))
              ]))),
              (co.delivery_options || []).length ? null : h('p', { key: 'n', className: 'pv-banner pv-warn' }, 'No delivery options yet: checkout asks for an address and charges no delivery.')
            ]),
            h('div', { key: 'pay', className: 'paynow-box', style: { margin: 0 } }, [
              h('h3', { key: 'h' }, pn.enabled === false ? 'PayNow is off' : 'Pay by PayNow'),
              qr ? h('img', { key: 'q', src: qr, className: 'paynow-qr' }) : null,
              qr ? h('p', { key: 'qc', className: 'pv-caption' }, 'Sample QR for S$10.00 — scan it with your banking app to check the name (don\'t pay).') : null,
              h('dl', { key: 'dl' }, [
                h('dt', { key: 1 }, 'Pay to'), h('dd', { key: 2 }, pn.payee_name || '—'),
                h('dt', { key: 3 }, 'PayNow to'), h('dd', { key: 4 }, pn.uen_or_mobile || '—')
              ]),
              pn.instructions ? h('p', { key: 'i', className: 'muted', style: { fontSize: '0.85rem', marginTop: '12px' } }, pn.instructions) : null
            ])
          ]),

          h('h3', { key: 'foh', style: { marginTop: '36px' } }, 'Footer'),
          h('div', { key: 'fo', className: 'pv-footer' }, [
            h('div', { key: 'l' }, [
              h('img', { key: 'i', src: src(getAsset, (s.brand || {}).logo_light), style: { height: '48px' } }),
              h('p', { key: 't' }, (s.brand || {}).tagline)
            ]),
            h('div', { key: 'c' }, [
              h('b', { key: 'h' }, 'CONTACT'),
              h('span', { key: 'e' }, c.email),
              h('span', { key: 'w' }, 'WhatsApp: ' + (c.whatsapp_display || c.whatsapp_number || '')),
              ...[['instagram_url', 'Instagram'], ['facebook_url', 'Facebook'], ['tiktok_url', 'TikTok'], ['xiaohongshu_url', 'Xiaohongshu 小红书']]
                .filter(([k]) => c[k]).map(([k, l]) => h('span', { key: k }, l))
            ])
          ])
        ])
      ]);
    }
  }));
})();
