// Seeded demo admin data (Task 15): deterministic sample orders whose totals follow
// the real pricing rules, and a 30-day sales series derived from those orders.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const MODULE = path.resolve(__dirname, '../../assets/js/admin-data.js');
const admin = require(MODULE);
const products = require('../../assets/js/products.js');
const pricing = require('../../assets/js/pricing.js');
const config = require('../../assets/js/config.js');

const STATUSES = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];
const byId = Object.fromEntries(products.map((p) => [p.id, p]));
const DAY = 86400000;

// Pakistan Standard Time is UTC+5 all year (no daylight saving).
const pktDay = (iso) => new Date(Date.parse(iso) + 5 * 3600000).toISOString().slice(0, 10);

test('exposes a fixed anchor date and the PKT offset it buckets by', () => {
  assert.match(admin.anchor, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(admin.utcOffsetMinutes, 300);
});

test('seeds at least 20 orders', () => {
  assert.ok(Array.isArray(admin.orders));
  assert.ok(admin.orders.length >= 20, 'got ' + admin.orders.length);
});

test('statuses are valid and all four appear', () => {
  const seen = new Set(admin.orders.map((o) => o.status));
  admin.orders.forEach((o) => assert.ok(STATUSES.includes(o.status), o.status));
  STATUSES.forEach((s) => assert.ok(seen.has(s), 'missing ' + s));
});

test('deterministic: a fresh require and a rebuild give deep-equal data', () => {
  delete require.cache[MODULE];
  const again = require(MODULE);
  assert.deepEqual(again.orders, admin.orders);
  assert.deepEqual(again.sales, admin.sales);
  const rebuilt = admin.build(products, pricing, config);
  assert.deepEqual(rebuilt.orders, admin.orders);
  assert.deepEqual(rebuilt.sales, admin.sales);
});

test('every order has the store order shape', () => {
  admin.orders.forEach((o) => {
    assert.equal(typeof o.number, 'string');
    assert.ok(!Number.isNaN(Date.parse(o.createdAt)), o.createdAt);
    ['name', 'phone', 'email', 'province', 'city', 'address', 'notes'].forEach((k) =>
      assert.equal(typeof o.customer[k], 'string', o.number + ' customer.' + k));
    assert.ok(o.customer.name && o.customer.city && o.customer.province);
    assert.match(o.customer.phone, /^03\d{9}$/);
    assert.match(o.customer.email, /@example\.com$/, 'fictional addresses only');
    assert.ok(Array.isArray(o.lines) && o.lines.length >= 1);
    assert.equal(typeof o.code, 'string');
  });
});

test('every line references a real product and a valid size, with a purchasable qty', () => {
  admin.orders.forEach((o) => o.lines.forEach((l) => {
    const p = byId[l.productId];
    assert.ok(p, 'unknown product ' + l.productId);
    assert.ok([30, 50, 100].includes(l.ml), 'bad ml ' + l.ml);
    assert.ok(p.sizes.some((s) => s.ml === l.ml));
    assert.ok(Number.isInteger(l.qty) && l.qty >= 1 && l.qty <= p.stock, o.number + ' qty');
    assert.equal(typeof l.gift, 'boolean');
  }));
});

test('totals equal the real pricing rules for those lines', () => {
  admin.orders.forEach((o) => {
    const t = pricing.cartTotals(o.lines, products, config, o.code);
    assert.equal(o.totals.subtotal, t.subtotal, o.number + ' subtotal');
    assert.equal(o.totals.giftWrap, t.giftWrap, o.number + ' giftWrap');
    assert.equal(o.totals.discount, t.discount, o.number + ' discount');
    assert.equal(o.totals.delivery, t.delivery, o.number + ' delivery');
    assert.equal(o.totals.total, t.total, o.number + ' total');
    assert.equal(o.totals.delivery, o.totals.subtotal >= config.freeDeliveryThreshold ? 0 : config.deliveryFee);
    assert.equal(o.totals.total, o.totals.subtotal + o.totals.giftWrap + o.totals.delivery - o.totals.discount);
    if (o.code) assert.equal(t.codeStatus, 'applied', o.number + ' code must apply');
  });
  // the sample is varied: both delivery outcomes and a gift-wrapped order exist
  assert.ok(admin.orders.some((o) => o.totals.delivery === 0));
  assert.ok(admin.orders.some((o) => o.totals.delivery > 0));
  assert.ok(admin.orders.some((o) => o.totals.giftWrap > 0));
});

test('order numbers are unique and can never collide with a real ORD-###### number', () => {
  const nums = admin.orders.map((o) => o.number);
  assert.equal(new Set(nums).size, nums.length);
  nums.forEach((n) => {
    assert.match(n, /^ORD-S\d{4}$/);
    assert.doesNotMatch(n, /^ORD-\d{6}$/, 'store.placeOrder only makes ORD- + 6 digits');
  });
});

test('orders are newest first and inside the 30 days ending at the anchor (PKT)', () => {
  const first = new Date(Date.parse(admin.anchor + 'T00:00:00Z') - 29 * DAY).toISOString().slice(0, 10);
  for (let i = 0; i < admin.orders.length; i++) {
    const day = pktDay(admin.orders[i].createdAt);
    assert.ok(day >= first && day <= admin.anchor, day);
    if (i) assert.ok(Date.parse(admin.orders[i - 1].createdAt) >= Date.parse(admin.orders[i].createdAt));
  }
});

test('sales: exactly 30 consecutive days ending at the anchor, each the sum of that day', () => {
  assert.equal(admin.sales.length, 30);
  assert.equal(admin.sales[29].date, admin.anchor);
  for (let i = 1; i < 30; i++) {
    const prev = Date.parse(admin.sales[i - 1].date + 'T00:00:00Z');
    assert.equal(Date.parse(admin.sales[i].date + 'T00:00:00Z') - prev, DAY);
  }
  admin.sales.forEach((d) => {
    const sum = admin.orders.filter((o) => pktDay(o.createdAt) === d.date).reduce((s, o) => s + o.totals.total, 0);
    assert.equal(d.total, sum, d.date);
  });
  const all = admin.orders.reduce((s, o) => s + o.totals.total, 0);
  assert.equal(admin.sales.reduce((s, d) => s + d.total, 0), all);
});

test('dayKey buckets an ISO time by Pakistan date', () => {
  assert.equal(admin.dayKey('2026-10-14T19:30:00.000Z'), '2026-10-15'); // 00:30 PKT
  assert.equal(admin.dayKey('2026-10-14T18:59:00.000Z'), '2026-10-14'); // 23:59 PKT
});

test('rebase shifts the sample so it always ends on the given day, without touching the source', () => {
  const before = JSON.stringify(admin.orders);
  const r = admin.rebase(admin, '2026-11-02');
  assert.equal(JSON.stringify(admin.orders), before);
  assert.equal(r.sales.length, 30);
  assert.equal(r.sales[29].date, '2026-11-02');
  assert.deepEqual(r.sales.map((d) => d.total), admin.sales.map((d) => d.total));
  r.orders.forEach((o, i) => {
    assert.equal(Date.parse(o.createdAt) - Date.parse(admin.orders[i].createdAt), 18 * DAY);
    assert.equal(o.number, admin.orders[i].number);
  });
  const same = admin.rebase(admin, admin.anchor);
  assert.deepEqual(same.orders, admin.orders);
  assert.deepEqual(same.sales, admin.sales);
});

test('salesFor sums any order list into the 30 PKT days ending at a given day', () => {
  assert.deepEqual(admin.salesFor(admin.orders, admin.anchor), admin.sales);
  const extra = { createdAt: admin.anchor + 'T06:00:00.000Z', totals: { total: 4321 } }; // 11:00 PKT
  const s = admin.salesFor(admin.orders.concat([extra]), admin.anchor);
  assert.equal(s[29].total, admin.sales[29].total + 4321);
  const old = { createdAt: '2020-01-01T06:00:00.000Z', totals: { total: 999 } };
  assert.deepEqual(admin.salesFor(admin.orders.concat([old]), admin.anchor), admin.sales);
});
