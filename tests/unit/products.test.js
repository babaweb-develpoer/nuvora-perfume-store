const test = require('node:test');
const assert = require('node:assert/strict');
const products = require('../../assets/js/products.js');
const media = require('../../assets/js/media-manifest.js');

const HOUSES = ['Maison Noor', 'Velluto Nero', 'Aurelle', 'Sahara Royale'];
const BANNED = ['dior', 'chanel', 'creed', 'tom ford', 'gucci', 'versace'];

test('catalogue has 12 products, 3 per house', () => {
  assert.equal(products.length, 12);
  for (const house of HOUSES) {
    assert.equal(products.filter((p) => p.house === house).length, 3, house);
  }
});

test('ids and slugs are unique, slugs are kebab-case', () => {
  assert.equal(new Set(products.map((p) => p.id)).size, 12);
  assert.equal(new Set(products.map((p) => p.slug)).size, 12);
  for (const p of products) {
    assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, p.id);
    assert.match(p.id, /^(mn|vn|au|sr)-0[1-3]$/);
  }
});

test('each product has 30/50/100 ml sizes with ascending prices >= 3000', () => {
  for (const p of products) {
    assert.deepEqual(p.sizes.map((s) => s.ml), [30, 50, 100], p.id);
    for (const s of p.sizes) {
      assert.ok(Number.isInteger(s.price) && s.price >= 3000, `${p.id} ${s.ml}ml`);
    }
    assert.ok(p.sizes[0].price < p.sizes[1].price && p.sizes[1].price < p.sizes[2].price, p.id);
  }
});

test('notes arrays are non-empty', () => {
  for (const p of products) {
    for (const tier of ['top', 'heart', 'base']) {
      assert.ok(Array.isArray(p.notes[tier]) && p.notes[tier].length > 0, `${p.id} ${tier}`);
    }
  }
});

test('ids match media manifest product slots and images use the manifest file', () => {
  for (const p of products) {
    const slot = media['product-' + p.id];
    assert.ok(slot, `missing manifest slot product-${p.id}`);
    assert.deepEqual(p.images, [slot.file], p.id);
  }
});

test('field types and ranges are valid', () => {
  for (const p of products) {
    assert.ok(['men', 'women', 'unisex'].includes(p.gender), p.id);
    assert.ok(['oud', 'woody', 'floral', 'fresh'].includes(p.family), p.id);
    assert.ok(Number.isInteger(p.stock) && p.stock >= 0, p.id);
    assert.ok(p.rating >= 3.9 && p.rating <= 4.9, p.id);
    assert.ok(Number.isInteger(p.reviewCount) && p.reviewCount >= 12 && p.reviewCount <= 240, p.id);
    assert.ok(Array.isArray(p.tags) && p.tags.length > 0, p.id);
    assert.ok(!Number.isNaN(Date.parse(p.createdAt)), p.id);
    const sentences = p.description.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.ok(sentences.length >= 2 && sentences.length <= 3, `${p.id} description sentences`);
  }
});

test('stock: exactly one out of stock, at least two low stock', () => {
  assert.equal(products.filter((p) => p.stock === 0).length, 1);
  assert.ok(products.filter((p) => p.stock > 0 && p.stock <= 5).length >= 2);
});

test('tags: at least 4 gift and 4 bestseller', () => {
  assert.ok(products.filter((p) => p.tags.includes('gift')).length >= 4);
  assert.ok(products.filter((p) => p.tags.includes('bestseller')).length >= 4);
});

test('no real brand names in name or description', () => {
  for (const p of products) {
    const text = `${p.name} ${p.description}`.toLowerCase();
    for (const word of BANNED) {
      assert.ok(!text.includes(word), `${p.id} contains "${word}"`);
    }
  }
});
