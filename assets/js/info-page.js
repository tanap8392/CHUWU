/* CHUWU (初·五) — About / FAQ / Shipping & Returns / Privacy Policy. Each page's HTML file names
   its content file with <body data-info-page="…">; the text comes from content/pages/<slug>.json
   (/admin → Info Pages) and is written in Markdown. A page switched off in the dashboard shows a
   "not available" note instead. */
(function () {
  const slug = document.body.getAttribute('data-info-page');

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  function markdown(text) {
    const div = el('div', { class: 'prose' });
    div.innerHTML = window.marked ? marked.parse(text || '') : '';
    return div;
  }

  ChuwuContent.ready.then(data => {
    const page = data.pages[slug] || {};
    const body = document.getElementById('info-body');
    body.innerHTML = '';

    if (!page.published) {
      document.getElementById('info-title').textContent = 'Not available';
      body.appendChild(el('p', { class: 'center muted' }, ['This page isn\'t available yet.']));
      return;
    }

    document.getElementById('info-title').textContent = page.title || '';
    document.title = (page.title || '') + ' — CHUWU 初·五';
    const meta = document.querySelector('meta[name="description"]');
    if (meta && page.seo && page.seo.description) meta.setAttribute('content', page.seo.description);
    if (page.intro) body.appendChild(el('p', { class: 'center muted', style: 'margin-bottom:36px' }, [page.intro]));

    if (Array.isArray(page.items)) {
      page.items.forEach(item => {
        body.appendChild(el('details', { class: 'faq-item' }, [
          el('summary', {}, [item.question || '']),
          markdown(item.answer)
        ]));
      });
    }
    if (page.body) body.appendChild(markdown(page.body));
  });
})();
