/* Scent quiz: questions and product scoring. Pure functions, no dependencies. */
(function () {
  'use strict';

  var QUESTIONS = [
    {
      id: 'occasion',
      text: 'What is the occasion?',
      options: [
        { label: 'Everyday wear', value: 'daily' },
        { label: 'An evening out', value: 'evening' },
        { label: 'A wedding or celebration', value: 'wedding' },
        { label: 'A gift for someone', value: 'gift' }
      ]
    },
    {
      id: 'season',
      text: 'Which season will you wear it in?',
      options: [
        { label: 'Summer heat', value: 'summer' },
        { label: 'Winter chill', value: 'winter' },
        { label: 'All year round', value: 'all' }
      ]
    },
    {
      id: 'intensity',
      text: 'How strong should it be?',
      options: [
        { label: 'Light and airy', value: 'light' },
        { label: 'Balanced', value: 'moderate' },
        { label: 'Bold and lasting', value: 'strong' }
      ]
    },
    {
      id: 'family',
      text: 'Which scent family draws you in?',
      options: [
        { label: 'Rich oud', value: 'oud' },
        { label: 'Warm woods', value: 'woody' },
        { label: 'Soft florals', value: 'floral' },
        { label: 'Fresh and clean', value: 'fresh' }
      ]
    },
    {
      id: 'budget',
      text: 'What is your budget for a 50 ml bottle?',
      options: [
        { label: 'Under PKR 6,000', value: 'under-6000' },
        { label: 'PKR 6,000 to 12,000', value: '6000-12000' },
        { label: 'Over PKR 12,000', value: 'over-12000' }
      ]
    }
  ];

  // Family dominates: the other four criteria add at most 4 x 2 = 8 < 10.
  var W_FAMILY = 10;
  var W_OTHER = 2;

  var INTENSITY_FAMILIES = {
    light: ['fresh', 'floral'],
    moderate: ['floral', 'woody'],
    strong: ['oud', 'woody']
  };

  var INTENSITY_REASON = {
    light: 'A light, airy character',
    moderate: 'A balanced, easy-to-wear strength',
    strong: 'Bold with long-lasting presence'
  };

  function hasTag(p, tag) {
    return (p.tags || []).indexOf(tag) !== -1;
  }

  function hasAnyTag(p, tags) {
    return tags.some(function (t) { return hasTag(p, t); });
  }

  function price50(p) {
    var sizes = (p && p.sizes) || [];
    for (var i = 0; i < sizes.length; i++) {
      if (sizes[i].ml === 50) return sizes[i].price;
    }
    return null;
  }

  function budgetMatches(value, price) {
    if (typeof price !== 'number') return false;
    if (value === 'under-6000') return price < 6000;
    if (value === '6000-12000') return price >= 6000 && price <= 12000;
    if (value === 'over-12000') return price > 12000;
    return false;
  }

  function occasionReason(value, p) {
    if (value === 'daily' && hasTag(p, 'daily')) return 'Easy to wear every day';
    if (value === 'evening' && hasTag(p, 'evening')) return 'Made for evenings';
    if (value === 'wedding' && hasAnyTag(p, ['evening', 'signature'])) return 'Fit for a wedding or celebration';
    if (value === 'gift' && hasTag(p, 'gift')) return 'A gift-worthy choice';
    return null;
  }

  function seasonReason(value, p) {
    if (value === 'summer' && hasTag(p, 'summer')) return 'Great for summer';
    if (value === 'winter' && hasTag(p, 'winter')) return 'Perfect for winter';
    if (value === 'all' && !hasTag(p, 'summer') && !hasTag(p, 'winter')) return 'Wears well in every season';
    return null;
  }

  function intensityReason(value, p) {
    var fams = INTENSITY_FAMILIES[value];
    if (fams && fams.indexOf(p.family) !== -1) return INTENSITY_REASON[value];
    return null;
  }

  // Applied criteria in display priority order: [{points, reason}].
  function evaluate(answers, p) {
    var out = [];
    if (!answers || typeof answers !== 'object' || !p) return out;
    var fam = answers.family;
    if (typeof fam === 'string' && p.family === fam) {
      out.push({ points: W_FAMILY, reason: 'Matches your love of ' + fam });
    }
    if (typeof answers.budget === 'string' && budgetMatches(answers.budget, price50(p))) {
      out.push({ points: W_OTHER, reason: 'Within your budget' });
    }
    var checks = [
      occasionReason(answers.occasion, p),
      seasonReason(answers.season, p),
      intensityReason(answers.intensity, p)
    ];
    checks.forEach(function (reason) {
      if (reason) out.push({ points: W_OTHER, reason: reason });
    });
    return out;
  }

  function scoreProducts(answers, products) {
    var list = Array.isArray(products) ? products : [];
    var scored = list.map(function (p, i) {
      var score = evaluate(answers, p).reduce(function (sum, c) { return sum + c.points; }, 0);
      return { product: p, score: score, i: i };
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var ra = a.product.rating || 0;
      var rb = b.product.rating || 0;
      if (rb !== ra) return rb - ra;
      var na = String(a.product.name || '');
      var nb = String(b.product.name || '');
      if (na !== nb) return na < nb ? -1 : 1;
      return a.i - b.i;
    });
    return scored.map(function (x) { return { product: x.product, score: x.score }; });
  }

  function explain(answers, product) {
    return evaluate(answers, product)
      .slice(0, 3)
      .map(function (c) { return c.reason; });
  }

  var api = { QUESTIONS: QUESTIONS, scoreProducts: scoreProducts, explain: explain };

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.quiz = api; }
})();
