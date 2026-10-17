const test = require('node:test');
const assert = require('node:assert/strict');
const cat = require('../../assets/js/catalogue.js');
const ALL = require('../../assets/js/products.js');

const ids = (list) => list.map((p) => p.id);
const low = (p) => Math.min(...p.sizes.map((s) => s.price));

test('q "oud" finds Maison Noor products', () => {
  const r = cat.filterProducts(ALL, { q: 'oud' });
  assert.ok(r.length >= 3);
  assert.ok(r.every((p) => p.house === 'Maison Noor'));
  assert.deepEqual(ids(r).sort(), ['mn-01', 'mn-02', 'mn-03']);
});

test('unmatched query returns []', () => {
  assert.deepEqual(cat.filterProducts(ALL, { q: 'zzzxqy' }), []);
});

test('q is case-insensitive and trimmed', () => {
  assert.deepEqual(ids(cat.filterProducts(ALL, { q: '  OUD  ' })), ids(cat.filterProducts(ALL, { q: 'oud' })));
  assert.equal(cat.filterProducts(ALL, { q: 'aurelle' }).length, 3);
});

test('q multi-word requires every word (AND)', () => {
  assert.deepEqual(ids(cat.filterProducts(ALL, { q: 'noor women' })), ['mn-03']);
  assert.deepEqual(cat.filterProducts(ALL, { q: 'noor aurelle' }), []);
  assert.deepEqual(ids(cat.filterProducts(ALL, { q: 'floral summer' })).sort(), ['au-02', 'au-03']);
});

test('q matches notes in every tier and tags', () => {
  assert.ok(ids(cat.filterProducts(ALL, { q: 'saffron' })).includes('mn-01')); // top
  assert.ok(ids(cat.filterProducts(ALL, { q: 'damask' })).includes('mn-01')); // heart
  assert.ok(ids(cat.filterProducts(ALL, { q: 'sandalwood' })).includes('mn-01')); // base
  assert.ok(ids(cat.filterProducts(ALL, { q: 'winter' })).includes('mn-02')); // tag
});

test('q "gift" returns the gift-tagged products', () => {
  const gifts = ALL.filter((p) => p.tags.includes('gift'));
  assert.ok(gifts.length > 0);
  assert.deepEqual(ids(cat.filterProducts(ALL, { q: 'gift' })).sort(), ids(gifts).sort());
});

test('q "men" matches men but not women via gender substring', () => {
  const r = cat.filterProducts(ALL, { q: 'men' });
  assert.ok(ids(r).includes('mn-02'));
  assert.ok(!ids(r).includes('au-01'));
  assert.ok(!ids(r).includes('mn-03'));
});

test('empty and missing filters return everything', () => {
  assert.equal(cat.filterProducts(ALL, {}).length, ALL.length);
  assert.equal(cat.filterProducts(ALL).length, ALL.length);
  assert.equal(
    cat.filterProducts(ALL, { q: '   ', houses: [], genders: [], families: [], sizes: [] }).length,
    ALL.length
  );
});

test('combined house + gender + price range', () => {
  const r = cat.filterProducts(ALL, { houses: ['Velluto Nero'], genders: ['men'], minPrice: 5000, maxPrice: 6000 });
  assert.deepEqual(ids(r), ['vn-02']); // lowest size 5800
  const r2 = cat.filterProducts(ALL, { houses: ['Maison Noor', 'Aurelle'], genders: ['women'] });
  assert.deepEqual(ids(r2).sort(), ['au-01', 'au-02', 'au-03', 'mn-03']);
});

test('gender filter is literal (unisex is its own value)', () => {
  const r = cat.filterProducts(ALL, { genders: ['men'] });
  assert.ok(r.length > 0);
  assert.ok(r.every((p) => p.gender === 'men'));
});

test('family filter', () => {
  const r = cat.filterProducts(ALL, { families: ['fresh', 'oud'] });
  assert.ok(r.every((p) => p.family === 'fresh' || p.family === 'oud'));
  assert.equal(r.length, 6);
});

test('price filter uses the lowest size price, inclusive bounds', () => {
  const p = ALL.find((x) => x.id === 'au-03'); // lowest 4400, highest 11800
  assert.equal(low(p), 4400);
  assert.ok(ids(cat.filterProducts(ALL, { maxPrice: 4400 })).includes('au-03'));
  assert.ok(!ids(cat.filterProducts(ALL, { maxPrice: 4399 })).includes('au-03'));
  assert.ok(ids(cat.filterProducts(ALL, { minPrice: 4400 })).includes('au-03'));
  assert.ok(!ids(cat.filterProducts(ALL, { minPrice: 4401 })).includes('au-03'));
  assert.ok(!ids(cat.filterProducts(ALL, { minPrice: 5000 })).includes('au-03'));
});

test('sizes filter keeps products offering any listed size', () => {
  assert.equal(cat.filterProducts(ALL, { sizes: [100] }).length, ALL.length);
  assert.equal(cat.filterProducts(ALL, { sizes: [75] }).length, 0);
  const fake = [
    { id: 'x', sizes: [{ ml: 50, price: 1 }] },
    { id: 'y', sizes: [{ ml: 100, price: 2 }] },
  ];
  assert.deepEqual(ids(cat.filterProducts(fake, { sizes: [30, 100] })), ['y']);
});

test('filterProducts does not mutate input and returns a new array', () => {
  const copy = ALL.slice();
  const r = cat.filterProducts(ALL, {});
  assert.notEqual(r, ALL);
  assert.deepEqual(ALL, copy);
});

// ---- sort ----
test('sort featured: bestsellers first, then rating desc', () => {
  const r = cat.sortProducts(ALL, 'featured');
  const firstNon = r.findIndex((p) => !p.tags.includes('bestseller'));
  assert.ok(firstNon > 0);
  assert.ok(r.slice(0, firstNon).every((p) => p.tags.includes('bestseller')));
  assert.ok(r.slice(firstNon).every((p) => !p.tags.includes('bestseller')));
  assert.equal(r[0].id, 'au-01'); // 4.9 bestseller
  for (let i = 1; i < firstNon; i++) assert.ok(r[i - 1].rating >= r[i].rating);
  for (let i = firstNon + 1; i < r.length; i++) assert.ok(r[i - 1].rating >= r[i].rating);
});

test('sort featured: reviewCount desc breaks rating ties, then stable', () => {
  const mk = (id, rating, reviewCount) => ({ id, name: id, tags: [], rating, reviewCount, sizes: [{ ml: 50, price: 1 }] });
  const t = [mk('a', 4, 1), mk('b', 4, 5), mk('c', 4, 1)];
  assert.deepEqual(ids(cat.sortProducts(t, 'featured')), ['b', 'a', 'c']);
});

test('sort unknown key behaves like featured', () => {
  assert.deepEqual(ids(cat.sortProducts(ALL, 'bogus')), ids(cat.sortProducts(ALL, 'featured')));
  assert.deepEqual(ids(cat.sortProducts(ALL)), ids(cat.sortProducts(ALL, 'featured')));
});

test('sort price-asc / price-desc by lowest size, ties by name', () => {
  const asc = cat.sortProducts(ALL, 'price-asc');
  for (let i = 1; i < asc.length; i++) assert.ok(low(asc[i - 1]) <= low(asc[i]));
  const desc = cat.sortProducts(ALL, 'price-desc');
  for (let i = 1; i < desc.length; i++) assert.ok(low(desc[i - 1]) >= low(desc[i]));
  const tie = [
    { id: '1', name: 'Zed', sizes: [{ ml: 50, price: 100 }] },
    { id: '2', name: 'Abe', sizes: [{ ml: 30, price: 100 }, { ml: 50, price: 300 }] },
  ];
  assert.deepEqual(ids(cat.sortProducts(tie, 'price-asc')), ['2', '1']);
  assert.deepEqual(ids(cat.sortProducts(tie, 'price-desc')), ['2', '1']);
});

test('sort rating: rating desc then reviewCount desc', () => {
  const r = cat.sortProducts(ALL, 'rating');
  for (let i = 1; i < r.length; i++) {
    assert.ok(
      r[i - 1].rating > r[i].rating ||
        (r[i - 1].rating === r[i].rating && r[i - 1].reviewCount >= r[i].reviewCount)
    );
  }
  assert.equal(r[0].id, 'au-01');
});

test('sort newest: createdAt desc', () => {
  const r = cat.sortProducts(ALL, 'newest');
  assert.equal(r[0].id, 'au-03');
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].createdAt >= r[i].createdAt);
});

test('sortProducts leaves the input array unchanged', () => {
  const before = ids(ALL);
  for (const k of ['featured', 'price-asc', 'price-desc', 'rating', 'newest', 'x']) {
    assert.notEqual(cat.sortProducts(ALL, k), ALL);
  }
  assert.deepEqual(ids(ALL), before);
  const frozen = Object.freeze(ALL.slice());
  assert.doesNotThrow(() => cat.sortProducts(frozen, 'price-asc'));
});

// ---- query ----
test('toQuery emits only non-empty fields in fixed order, no leading ?', () => {
  assert.equal(cat.toQuery({}), '');
  assert.equal(cat.toQuery({ q: '', houses: [], sizes: [] }), '');
  const f = {
    maxPrice: 9000,
    q: 'oud rose',
    sizes: [50, 100],
    houses: ['Maison Noor', 'Velluto Nero'],
    genders: ['men'],
    families: ['oud'],
    minPrice: 1000,
  };
  assert.equal(
    cat.toQuery(f),
    'q=oud%20rose&houses=Maison%20Noor,Velluto%20Nero&genders=men&families=oud&sizes=50,100&minPrice=1000&maxPrice=9000'
  );
});

test('toQuery encodes values containing commas and ampersands', () => {
  const f = { houses: ['A, B', 'C&D'] };
  const s = cat.toQuery(f);
  assert.ok(!s.includes('&D'));
  assert.deepEqual(cat.parseQuery(s), f);
});

test('parseQuery(toQuery(f)) deep-equals normalised f', () => {
  const fs = [
    {},
    { q: 'oud' },
    {
      q: 'rose & oud?',
      houses: ['Maison Noor'],
      genders: ['women', 'unisex'],
      families: ['floral'],
      sizes: [30, 50],
      minPrice: 0,
      maxPrice: 12000,
    },
    { minPrice: 5000 },
    { maxPrice: 7000, sizes: [100] },
  ];
  for (const f of fs) assert.deepEqual(cat.parseQuery(cat.toQuery(f)), f);
});

test('parseQuery accepts leading ?, ignores unknown keys', () => {
  assert.deepEqual(cat.parseQuery('?q=oud&foo=bar&families=oud'), { q: 'oud', families: ['oud'] });
  assert.deepEqual(cat.parseQuery('q=oud'), { q: 'oud' });
  assert.deepEqual(cat.parseQuery(''), {});
  assert.deepEqual(cat.parseQuery('?'), {});
  assert.deepEqual(cat.parseQuery(undefined), {});
  assert.deepEqual(cat.parseQuery(null), {});
});

test('parseQuery is safe for malformed input and drops NaN numbers', () => {
  assert.doesNotThrow(() => cat.parseQuery('q=%E0%A4%A'));
  assert.doesNotThrow(() => cat.parseQuery('houses=%E0%A4%A,Aurelle&%'));
  assert.equal(typeof cat.parseQuery('q=%E0%A4%A'), 'object');
  assert.deepEqual(cat.parseQuery('sizes=abc'), {});
  assert.deepEqual(cat.parseQuery('sizes=abc,50,,x'), { sizes: [50] });
  assert.deepEqual(cat.parseQuery('minPrice=abc&maxPrice=7000'), { maxPrice: 7000 });
  assert.deepEqual(cat.parseQuery('minPrice=&maxPrice='), {});
});

// ---- related ----
test('relatedProducts excludes self, no duplicates, max n', () => {
  for (const p of ALL) {
    const r = cat.relatedProducts(p, ALL, 4);
    assert.ok(r.length <= 4);
    assert.ok(!ids(r).includes(p.id));
    assert.equal(new Set(ids(r)).size, r.length);
  }
});

test('relatedProducts: same family first, then gender, then house', () => {
  const p = ALL.find((x) => x.id === 'au-01'); // floral women Aurelle
  const r = cat.relatedProducts(p, ALL, 5);
  // same family (rating desc), then same gender; house tier adds nothing new
  assert.deepEqual(ids(r), ['au-02', 'au-03', 'mn-03']);
  const unisex = ALL.find((x) => x.id === 'vn-03'); // woody unisex Velluto Nero
  assert.deepEqual(ids(cat.relatedProducts(unisex, ALL, 3)), ['vn-01', 'vn-02', 'mn-01']);
});

test('relatedProducts: same family by rating desc; n edge cases', () => {
  const p = ALL.find((x) => x.id === 'mn-01');
  assert.deepEqual(ids(cat.relatedProducts(p, ALL, 2)), ['mn-02', 'mn-03']);
  assert.deepEqual(cat.relatedProducts(p, ALL, 0), []);
  assert.deepEqual(cat.relatedProducts(p, ALL), cat.relatedProducts(p, ALL, 4));
  assert.deepEqual(cat.relatedProducts(p, [p], 4), []);
});
