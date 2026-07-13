/* CHUWU (初·五) — perfume note library, organized by Top / Middle / Base and Five Element (五行).
   Source: brand-provided note list. Elements use English keys matched to the Bazi engine:
   Wood 木 · Fire 火 · Earth 土 · Metal 金 · Water 水 */
(function (root) {
  const NOTES = {
    top: [
      { name: 'Bergamot', zh: '佛手柑', element: 'Metal' },
      { name: 'Lemon', zh: '柠檬', element: 'Metal' },
      { name: 'Grapefruit', zh: '葡萄柚', element: 'Metal' },
      { name: 'Orange', zh: '橙', element: 'Metal' },
      { name: 'Mandarin', zh: '柑橘', element: 'Metal' },
      { name: 'Lime', zh: '青柠', element: 'Metal' },
      { name: 'Yuzu', zh: '柚子', element: 'Metal' },
      { name: 'Aldehydes', zh: '醛香', element: 'Metal' },
      { name: 'Apple', zh: '苹果', element: 'Metal' },
      { name: 'Pear', zh: '梨', element: 'Metal' },
      { name: 'Neroli', zh: '橙花', element: 'Metal' },
      { name: 'Peppermint', zh: '薄荷', element: 'Water' },
      { name: 'Spearmint', zh: '绿薄荷', element: 'Water' },
      { name: 'Eucalyptus', zh: '桉树', element: 'Water' },
      { name: 'Pineapple', zh: '菠萝', element: 'Water' },
      { name: 'Blackcurrant', zh: '黑加仑', element: 'Water' },
      { name: 'Basil', zh: '罗勒', element: 'Wood' },
      { name: 'Lavender', zh: '薰衣草', element: 'Wood' },
      { name: 'Juniper', zh: '杜松', element: 'Wood' },
      { name: 'Pink Pepper', zh: '粉胡椒', element: 'Fire' }
    ],
    middle: [
      { name: 'Rose', zh: '玫瑰', element: 'Wood' },
      { name: 'Jasmine', zh: '茉莉', element: 'Wood' },
      { name: 'Orange Blossom', zh: '橙花蕾', element: 'Wood' },
      { name: 'Ylang-Ylang', zh: '依兰', element: 'Wood' },
      { name: 'Magnolia', zh: '木兰', element: 'Wood' },
      { name: 'Peony', zh: '牡丹', element: 'Wood' },
      { name: 'Lily of the Valley', zh: '铃兰', element: 'Wood' },
      { name: 'Geranium', zh: '天竺葵', element: 'Wood' },
      { name: 'Violet', zh: '紫罗兰', element: 'Wood' },
      { name: 'Iris', zh: '鸢尾', element: 'Wood' },
      { name: 'Tea', zh: '茶', element: 'Wood' },
      { name: 'Fig', zh: '无花果', element: 'Wood' },
      { name: 'Tuberose', zh: '晚香玉', element: 'Fire' },
      { name: 'Carnation', zh: '康乃馨', element: 'Fire' },
      { name: 'Cardamom', zh: '豆蔻', element: 'Fire' },
      { name: 'Cinnamon', zh: '肉桂', element: 'Fire' },
      { name: 'Nutmeg', zh: '肉豆蔻', element: 'Fire' },
      { name: 'Clary Sage', zh: '快乐鼠尾草', element: 'Earth' },
      { name: 'Honey', zh: '蜂蜜', element: 'Earth' },
      { name: 'Heliotrope', zh: '天芥菜', element: 'Earth' }
    ],
    base: [
      { name: 'Sandalwood', zh: '檀香', element: 'Wood' },
      { name: 'Cedarwood', zh: '雪松', element: 'Wood' },
      { name: 'Patchouli', zh: '广藿香', element: 'Wood' },
      { name: 'Vetiver', zh: '岩兰草', element: 'Wood' },
      { name: 'Oud', zh: '沉香', element: 'Wood' },
      { name: 'Oakmoss', zh: '橡苔', element: 'Wood' },
      { name: 'Guaiac Wood', zh: '愈创木', element: 'Wood' },
      { name: 'Amber', zh: '琥珀', element: 'Fire' },
      { name: 'Frankincense', zh: '乳香', element: 'Fire' },
      { name: 'Myrrh', zh: '没药', element: 'Fire' },
      { name: 'Tobacco', zh: '烟草', element: 'Fire' },
      { name: 'Vanilla', zh: '香草', element: 'Earth' },
      { name: 'Tonka Bean', zh: '零陵香豆', element: 'Earth' },
      { name: 'Benzoin', zh: '安息香', element: 'Earth' },
      { name: 'Labdanum', zh: '劳丹脂', element: 'Earth' },
      { name: 'Leather', zh: '皮革', element: 'Earth' },
      { name: 'Cashmeran', zh: '琥珀木', element: 'Earth' },
      { name: 'Musk', zh: '麝香', element: 'Water' },
      { name: 'Ambergris', zh: '龙涎香', element: 'Water' },
      { name: 'Civet Accord', zh: '灵猫香调', element: 'Water' }
    ]
  };

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

  root.ChuwuNotes = { NOTES, MOTHER_OF, notesForElement, resolveLayerNotes, applyStock };
})(typeof window !== 'undefined' ? window : globalThis);
