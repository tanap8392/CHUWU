/* CHUWU (初·五) — perfume note library, organized by Top / Middle / Base and Five Element (五行).
   Source: brand-provided note list. Elements use English keys matched to the Bazi engine:
   Wood 木 · Fire 火 · Earth 土 · Metal 金 · Water 水
   `family` is the scent-preference category (Citrus, Floral, Woody, Fresh, Spicy, Sweet, Musky)
   used by the scent-preference quiz to narrow the Bazi-driven element recommendation. */
(function (root) {
  const NOTES = {
    top: [
      { name: 'Bergamot', zh: '佛手柑', element: 'Metal', family: 'Citrus' },
      { name: 'Lemon', zh: '柠檬', element: 'Metal', family: 'Citrus' },
      { name: 'Grapefruit', zh: '葡萄柚', element: 'Metal', family: 'Citrus' },
      { name: 'Orange', zh: '橙', element: 'Metal', family: 'Citrus' },
      { name: 'Mandarin', zh: '柑橘', element: 'Metal', family: 'Citrus' },
      { name: 'Lime', zh: '青柠', element: 'Metal', family: 'Citrus' },
      { name: 'Yuzu', zh: '柚子', element: 'Metal', family: 'Citrus' },
      { name: 'Aldehydes', zh: '醛香', element: 'Metal', family: 'Fresh' },
      { name: 'Apple', zh: '苹果', element: 'Metal', family: 'Fresh' },
      { name: 'Pear', zh: '梨', element: 'Metal', family: 'Fresh' },
      { name: 'Neroli', zh: '橙花', element: 'Metal', family: 'Floral' },
      { name: 'Peppermint', zh: '薄荷', element: 'Water', family: 'Fresh' },
      { name: 'Spearmint', zh: '绿薄荷', element: 'Water', family: 'Fresh' },
      { name: 'Eucalyptus', zh: '桉树', element: 'Water', family: 'Fresh' },
      { name: 'Pineapple', zh: '菠萝', element: 'Water', family: 'Fresh' },
      { name: 'Blackcurrant', zh: '黑加仑', element: 'Water', family: 'Fresh' },
      { name: 'Basil', zh: '罗勒', element: 'Wood', family: 'Fresh' },
      { name: 'Lavender', zh: '薰衣草', element: 'Wood', family: 'Floral' },
      { name: 'Juniper', zh: '杜松', element: 'Wood', family: 'Woody' },
      { name: 'Pink Pepper', zh: '粉胡椒', element: 'Fire', family: 'Spicy' }
    ],
    middle: [
      { name: 'Rose', zh: '玫瑰', element: 'Wood', family: 'Floral' },
      { name: 'Jasmine', zh: '茉莉', element: 'Wood', family: 'Floral' },
      { name: 'Orange Blossom', zh: '橙花蕾', element: 'Wood', family: 'Floral' },
      { name: 'Ylang-Ylang', zh: '依兰', element: 'Wood', family: 'Floral' },
      { name: 'Magnolia', zh: '木兰', element: 'Wood', family: 'Floral' },
      { name: 'Peony', zh: '牡丹', element: 'Wood', family: 'Floral' },
      { name: 'Lily of the Valley', zh: '铃兰', element: 'Wood', family: 'Floral' },
      { name: 'Geranium', zh: '天竺葵', element: 'Wood', family: 'Floral' },
      { name: 'Violet', zh: '紫罗兰', element: 'Wood', family: 'Floral' },
      { name: 'Iris', zh: '鸢尾', element: 'Wood', family: 'Floral' },
      { name: 'Tea', zh: '茶', element: 'Wood', family: 'Fresh' },
      { name: 'Fig', zh: '无花果', element: 'Wood', family: 'Woody' },
      { name: 'Tuberose', zh: '晚香玉', element: 'Fire', family: 'Floral' },
      { name: 'Carnation', zh: '康乃馨', element: 'Fire', family: 'Spicy' },
      { name: 'Cardamom', zh: '豆蔻', element: 'Fire', family: 'Spicy' },
      { name: 'Cinnamon', zh: '肉桂', element: 'Fire', family: 'Spicy' },
      { name: 'Nutmeg', zh: '肉豆蔻', element: 'Fire', family: 'Spicy' },
      { name: 'Clary Sage', zh: '快乐鼠尾草', element: 'Earth', family: 'Fresh' },
      { name: 'Honey', zh: '蜂蜜', element: 'Earth', family: 'Sweet' },
      { name: 'Heliotrope', zh: '天芥菜', element: 'Earth', family: 'Sweet' }
    ],
    base: [
      { name: 'Sandalwood', zh: '檀香', element: 'Wood', family: 'Woody' },
      { name: 'Cedarwood', zh: '雪松', element: 'Wood', family: 'Woody' },
      { name: 'Patchouli', zh: '广藿香', element: 'Wood', family: 'Woody' },
      { name: 'Vetiver', zh: '岩兰草', element: 'Wood', family: 'Woody' },
      { name: 'Oud', zh: '沉香', element: 'Wood', family: 'Woody' },
      { name: 'Oakmoss', zh: '橡苔', element: 'Wood', family: 'Woody' },
      { name: 'Guaiac Wood', zh: '愈创木', element: 'Wood', family: 'Woody' },
      { name: 'Amber', zh: '琥珀', element: 'Fire', family: 'Sweet' },
      { name: 'Frankincense', zh: '乳香', element: 'Fire', family: 'Spicy' },
      { name: 'Myrrh', zh: '没药', element: 'Fire', family: 'Spicy' },
      { name: 'Tobacco', zh: '烟草', element: 'Fire', family: 'Spicy' },
      { name: 'Vanilla', zh: '香草', element: 'Earth', family: 'Sweet' },
      { name: 'Tonka Bean', zh: '零陵香豆', element: 'Earth', family: 'Sweet' },
      { name: 'Benzoin', zh: '安息香', element: 'Earth', family: 'Sweet' },
      { name: 'Labdanum', zh: '劳丹脂', element: 'Earth', family: 'Sweet' },
      { name: 'Leather', zh: '皮革', element: 'Earth', family: 'Musky' },
      { name: 'Cashmeran', zh: '琥珀木', element: 'Earth', family: 'Woody' },
      { name: 'Musk', zh: '麝香', element: 'Water', family: 'Musky' },
      { name: 'Ambergris', zh: '龙涎香', element: 'Water', family: 'Musky' },
      { name: 'Civet Accord', zh: '灵猫香调', element: 'Water', family: 'Musky' }
    ]
  };

  const FAMILIES = [
    { key: 'Citrus', label: 'Citrus', zh: '柑橘', desc: 'Bright, zesty, uplifting' },
    { key: 'Floral', label: 'Floral', zh: '花香', desc: 'Soft, romantic, blooming' },
    { key: 'Woody', label: 'Woody', zh: '木质', desc: 'Grounded, earthy, warm' },
    { key: 'Fresh', label: 'Fresh & Green', zh: '清新', desc: 'Crisp, herbal, airy' },
    { key: 'Spicy', label: 'Spicy & Warm', zh: '辛香', desc: 'Bold, comforting, rich' },
    { key: 'Sweet', label: 'Sweet & Gourmand', zh: '甜美', desc: 'Cozy, indulgent, soft' },
    { key: 'Musky', label: 'Musky & Sensual', zh: '麝香', desc: 'Skin-close, intimate, quiet' }
  ];

  // Five Element generating cycle (相生): key is nourished BY value.
  const MOTHER_OF = { Wood: 'Water', Fire: 'Wood', Earth: 'Fire', Metal: 'Earth', Water: 'Metal' };

  function notesForElement(layer, element) {
    return NOTES[layer].filter(n => n.element === element);
  }

  // Returns { notes, element, isFallback, via } — walks the generating (Sheng) cycle
  // backwards up to 2 steps if a layer has no note of the requested element.
  function resolveLayerNotes(layer, element) {
    let current = element;
    const chain = [current];
    for (let i = 0; i < 3; i++) {
      const notes = notesForElement(layer, current);
      if (notes.length) {
        return { notes, element: current, isFallback: current !== element, chain };
      }
      current = MOTHER_OF[current];
      chain.push(current);
    }
    return { notes: [], element: current, isFallback: true, chain };
  }

  // Merges CMS-editable stock status (see content/notes-stock.json) onto each note entry.
  // stockList: [{ layer, name, stock }]. Notes not present default to 'in_stock'.
  function applyStock(stockList) {
    const lookup = {};
    (stockList || []).forEach(s => { lookup[s.layer + '::' + s.name] = s.stock; });
    ['top', 'middle', 'base'].forEach(layer => {
      NOTES[layer].forEach(note => {
        note.stock = lookup[layer + '::' + note.name] || 'in_stock';
      });
    });
  }

  root.ChuwuNotes = { NOTES, FAMILIES, MOTHER_OF, notesForElement, resolveLayerNotes, applyStock };
})(typeof window !== 'undefined' ? window : globalThis);
