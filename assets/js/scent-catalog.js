/* CHUWU (初·五) — pre-mix scent catalog: three scents per Five Element, sourced from the 基列
   (Jilie) fragrance-oil supplier list, so "Find Your Element" always has real options no matter
   which element a customer is lacking.

   The scents themselves now live in content/products.json (type "element_scent", edited at
   /admin → Products). Code prefixes follow the element's pinyin initial: J=金 Metal, M=木 Wood,
   S=水 Water, H=火 Fire, T=土 Earth. `family` matches the scent-preference quiz categories in
   notes-data.js, so one preference answer narrows both the custom-blend flow and this catalog. */
(function (root) {
  const SCENTS = [];

  // Called once content has loaded. Hidden products are left out entirely.
  function setFromProducts(products) {
    SCENTS.length = 0;
    products.filter(p => p.type === 'element_scent' && p.status !== 'hidden').forEach(p => SCENTS.push(p));
  }

  function scentsForElement(element) {
    return SCENTS.filter(s => s.element === element);
  }

  function scentByCode(code) {
    return SCENTS.find(s => s.code === code) || null;
  }

  root.ChuwuScents = { SCENTS, setFromProducts, scentsForElement, scentByCode };
})(typeof window !== 'undefined' ? window : globalThis);
