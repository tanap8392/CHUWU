/* CHUWU (初·五) — Home page: element cards and "How It Works" steps from content/home.json. The
   cards already in index.html stay as the fallback if the content file can't be loaded. */
(function () {
  const ELEMENT_COLOR_VAR = { Wood: '--wood', Fire: '--fire', Earth: '--earth', Metal: '--metal', Water: '--water' };

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k === 'class' ? 'class' : k, v));
    (children || []).forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  ChuwuContent.ready.then(data => {
    const elements = data.home.philosophy && data.home.philosophy.elements;
    if (elements && elements.length) {
      const grid = document.getElementById('element-cards');
      grid.innerHTML = '';
      elements.forEach(e => {
        grid.appendChild(el('div', { class: 'element-card' }, [
          el('div', { class: 'element-glyph', style: `background:var(${ELEMENT_COLOR_VAR[e.element] || '--gold'})` }, [e.glyph || '']),
          el('h4', {}, [e.element || '']),
          el('span', { class: 'zh' }, [e.theme || '']),
          el('p', {}, [e.line || ''])
        ]));
      });
    }

    const steps = data.home.how && data.home.how.steps;
    if (steps && steps.length) {
      const grid = document.getElementById('how-steps');
      grid.innerHTML = '';
      steps.forEach((s, i) => {
        grid.appendChild(el('div', { class: 'step-card' }, [
          el('div', { class: 'step-num' }, [String(i + 1).padStart(2, '0')]),
          el('h3', {}, [s.title || '']),
          el('p', { class: 'muted' }, [s.body || ''])
        ]));
      });
    }
  });
})();
