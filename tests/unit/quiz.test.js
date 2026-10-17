const test = require('node:test');
const assert = require('node:assert/strict');
const quiz = require('../../assets/js/quiz.js');
const ALL = require('../../assets/js/products.js');

const score = (answers, id) => quiz.scoreProducts(answers, ALL).find((x) => x.product.id === id).score;

test('QUESTIONS: 5 questions with expected ids and 3-4 options each', () => {
  assert.deepEqual(quiz.QUESTIONS.map((q) => q.id), ['occasion', 'season', 'intensity', 'family', 'budget']);
  for (const q of quiz.QUESTIONS) {
    assert.ok(typeof q.text === 'string' && q.text.length > 0);
    assert.ok(q.options.length >= 3 && q.options.length <= 4, q.id);
    for (const o of q.options) assert.ok(o.label && o.value);
    assert.equal(new Set(q.options.map((o) => o.value)).size, q.options.length);
  }
});

test('QUESTIONS option values are the agreed ones', () => {
  const v = (id) => quiz.QUESTIONS.find((q) => q.id === id).options.map((o) => o.value);
  assert.deepEqual(v('occasion'), ['daily', 'evening', 'wedding', 'gift']);
  assert.deepEqual(v('season'), ['summer', 'winter', 'all']);
  assert.deepEqual(v('intensity'), ['light', 'moderate', 'strong']);
  assert.deepEqual(v('family'), ['oud', 'woody', 'floral', 'fresh']);
  assert.deepEqual(v('budget'), ['under-6000', '6000-12000', 'over-12000']);
});

test('scoreProducts always returns all products as {product, score}', () => {
  const r = quiz.scoreProducts({ family: 'floral' }, ALL);
  assert.equal(r.length, ALL.length);
  assert.equal(new Set(r.map((x) => x.product.id)).size, ALL.length);
  for (const x of r) assert.equal(typeof x.score, 'number');
});

test('family floral ranks an Aurelle product first', () => {
  const r = quiz.scoreProducts({ family: 'floral' }, ALL);
  assert.equal(r[0].product.house, 'Aurelle');
  assert.equal(r[0].product.id, 'au-01'); // tie broken by rating
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].score >= r[i].score);
});

test('family match dominates a full set of other matching answers', () => {
  const answers = { occasion: 'daily', season: 'summer', intensity: 'light', family: 'oud', budget: 'under-6000' };
  const r = quiz.scoreProducts(answers, ALL);
  assert.ok(r.slice(0, 3).every((x) => x.product.family === 'oud'));
  const bestNonFamily = r.find((x) => x.product.family !== 'oud');
  assert.ok(r[2].score > bestNonFamily.score);
});

test('missing, empty, unknown and bad answers do not throw and add nothing', () => {
  for (const a of [undefined, null, {}, { family: 'nope' }, { budget: 'x', season: 3 }, { occasion: null }, 'str']) {
    let r;
    assert.doesNotThrow(() => {
      r = quiz.scoreProducts(a, ALL);
    });
    assert.equal(r.length, ALL.length);
    assert.ok(r.every((x) => x.score === 0));
  }
  assert.deepEqual(quiz.scoreProducts({}, []), []);
  assert.deepEqual(quiz.scoreProducts({}, undefined), []);
});

test('ties are broken by rating desc then name', () => {
  const r = quiz.scoreProducts({}, ALL);
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1].product;
    const b = r[i].product;
    assert.ok(a.rating > b.rating || (a.rating === b.rating && a.name <= b.name));
  }
  const t = [
    { id: '1', name: 'Zed', rating: 4, family: 'oud', tags: [], sizes: [{ ml: 50, price: 1 }] },
    { id: '2', name: 'Abe', rating: 4, family: 'oud', tags: [], sizes: [{ ml: 50, price: 1 }] },
  ];
  assert.deepEqual(quiz.scoreProducts({}, t).map((x) => x.product.id), ['2', '1']);
});

test('scoreProducts does not mutate the products array', () => {
  const before = ALL.map((p) => p.id);
  quiz.scoreProducts({ family: 'oud' }, ALL);
  assert.deepEqual(ALL.map((p) => p.id), before);
});

test('budget compares against the 50 ml price', () => {
  assert.ok(score({ budget: 'under-6000' }, 'sr-02') > 0); // 5900
  assert.equal(score({ budget: 'under-6000' }, 'sr-01'), 0); // 6300
  assert.ok(score({ budget: '6000-12000' }, 'sr-01') > 0);
  assert.equal(score({ budget: '6000-12000' }, 'mn-01'), 0); // 12400
  assert.ok(score({ budget: 'over-12000' }, 'mn-01') > 0);
  assert.equal(score({ budget: 'over-12000' }, 'au-01'), 0);
});

test('occasion / season answers use product tags', () => {
  assert.ok(score({ occasion: 'gift' }, 'au-03') > 0);
  assert.equal(score({ occasion: 'gift' }, 'vn-02'), 0);
  assert.ok(score({ occasion: 'wedding' }, 'mn-01') > 0);
  assert.ok(score({ occasion: 'daily' }, 'vn-02') > 0);
  assert.ok(score({ season: 'summer' }, 'sr-02') > 0);
  assert.ok(score({ season: 'winter' }, 'mn-02') > 0);
  assert.equal(score({ season: 'winter' }, 'sr-02'), 0);
});

test('explain returns only applied reasons, max 3', () => {
  const au = ALL.find((p) => p.id === 'au-02'); // floral, daily+summer, 50ml 7900
  assert.deepEqual(quiz.explain({}, au), []);
  assert.deepEqual(quiz.explain(undefined, au), []);
  assert.deepEqual(quiz.explain({ family: 'oud' }, au), []);
  assert.deepEqual(quiz.explain({ family: 'floral' }, au), ['Matches your love of floral']);
  const many = quiz.explain(
    { occasion: 'daily', season: 'summer', intensity: 'light', family: 'floral', budget: '6000-12000' },
    au
  );
  assert.equal(many.length, 3);
  assert.equal(many[0], 'Matches your love of floral');
  assert.ok(many.every((m) => typeof m === 'string' && m.length > 0));
  assert.deepEqual(quiz.explain({ budget: '6000-12000' }, au), ['Within your budget']);
  assert.deepEqual(quiz.explain({ budget: 'over-12000' }, au), []);
});

test('explain agrees with score: score 0 iff no reasons', () => {
  const answers = { occasion: 'evening', season: 'winter', intensity: 'strong', family: 'oud', budget: 'over-12000' };
  for (const { product, score: s } of quiz.scoreProducts(answers, ALL)) {
    assert.equal(s === 0, quiz.explain(answers, product).length === 0, product.id);
  }
});
