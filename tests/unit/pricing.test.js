const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../../assets/js/pricing.js');
const config = require('../../assets/js/config.js');

const mk = (id, sizes, stock) => ({ id, name: id, sizes, stock });
const P = [
  mk('a', [{ ml: 50, price: 4000 }, { ml: 100, price: 7000 }], 5),
  mk('b', [{ ml: 50, price: 3999 }], 10),
  mk('c', [{ ml: 50, price: 5000 }], 3),
  mk('oos', [{ ml: 50, price: 4500 }], 0),
  mk('big', [{ ml: 100, price: 10000 }], 10),
  mk('odd', [{ ml: 50, price: 3333 }], 10),
  mk('p8000', [{ ml: 50, price: 8000 }], 5),
  mk('p7999', [{ ml: 50, price: 7999 }], 5),
];
const line = (productId, ml, qty, gift) => ({ productId, ml, qty, gift: !!gift });
const totals = (lines, code) => pricing.cartTotals(lines, P, config, code);

test('normalizeCode trims and upper-cases', () => {
  assert.equal(pricing.normalizeCode(' welcome10 '), 'WELCOME10');
  assert.equal(pricing.normalizeCode('Gift15'), 'GIFT15');
  assert.equal(pricing.normalizeCode(''), '');
  assert.equal(pricing.normalizeCode(undefined), '');
  assert.equal(pricing.normalizeCode(null), '');
});

test('empty cart: all zeros, codeStatus none', () => {
  const t = totals([]);
  assert.deepEqual(
    { s: t.subtotal, g: t.giftWrap, d: t.discount, dl: t.delivery, t: t.total, r: t.freeDeliveryRemaining, c: t.codeStatus },
    { s: 0, g: 0, d: 0, dl: 0, t: 0, r: 0, c: 'none' }
  );
  assert.deepEqual(t.lines, []);
});

test('code on empty cart gives none and no discount', () => {
  for (const code of ['WELCOME10', 'nope', 'GIFT15']) {
    const t = totals([], code);
    assert.equal(t.codeStatus, 'none');
    assert.equal(t.discount, 0);
    assert.equal(t.total, 0);
  }
});

test('basic line math and line detail', () => {
  const t = totals([line('a', 100, 2)]);
  assert.equal(t.subtotal, 14000);
  assert.equal(t.delivery, 0);
  assert.equal(t.total, 14000);
  assert.equal(t.lines.length, 1);
  assert.equal(t.lines[0].unitPrice, 7000);
  assert.equal(t.lines[0].lineTotal, 14000);
  assert.equal(t.lines[0].product.id, 'a');
  assert.equal(t.lines[0].line.productId, 'a');
});

test("' welcome10 ' applies at 10%", () => {
  const t = totals([line('a', 50, 1)], ' welcome10 '); // 4000
  assert.equal(t.codeStatus, 'applied');
  assert.equal(t.discount, 400);
  assert.equal(t.delivery, 250);
  assert.equal(t.total, 4000 + 250 - 400);
});

test('unknown code is invalid with zero discount', () => {
  const t = totals([line('a', 50, 1)], 'nope');
  assert.equal(t.codeStatus, 'invalid');
  assert.equal(t.discount, 0);
  assert.equal(t.total, 4250);
});

test('no code / blank code is none', () => {
  assert.equal(totals([line('a', 50, 1)]).codeStatus, 'none');
  assert.equal(totals([line('a', 50, 1)], '').codeStatus, 'none');
  assert.equal(totals([line('a', 50, 1)], '   ').codeStatus, 'none');
});

test('GIFT15 min boundary: 9,999 not met, 10,000 applied', () => {
  const lo = totals([line('odd', 50, 3)], 'GIFT15'); // 3333 * 3
  assert.equal(lo.subtotal, 9999);
  assert.equal(lo.codeStatus, 'min-not-met');
  assert.equal(lo.discount, 0);
  const hi = totals([line('big', 100, 1)], 'gift15');
  assert.equal(hi.subtotal, 10000);
  assert.equal(hi.codeStatus, 'applied');
  assert.equal(hi.discount, 1500);
  assert.equal(hi.total, 8500);
});

test('discount rounds to nearest whole rupee', () => {
  assert.equal(totals([line('odd', 50, 1)], 'WELCOME10').discount, 333); // 333.3
  const t2 = totals([line('b', 50, 1)], 'WELCOME10'); // 399.9
  assert.equal(t2.discount, 400);
  assert.ok(Number.isInteger(t2.total));
});

test('free delivery threshold: 8,000 free, 7,999 charged', () => {
  const exact = totals([line('p8000', 50, 1)]);
  assert.equal(exact.subtotal, 8000);
  assert.equal(exact.delivery, 0);
  assert.equal(exact.freeDeliveryRemaining, 0);
  const under = totals([line('p7999', 50, 1)]);
  assert.equal(under.delivery, 250);
  assert.equal(under.freeDeliveryRemaining, 1);
  assert.equal(under.total, 7999 + 250);
});

test('freeDeliveryRemaining counts down from the threshold', () => {
  const t = totals([line('a', 50, 1)]);
  assert.equal(t.freeDeliveryRemaining, 4000);
});

test('free-delivery decision uses subtotal before discount', () => {
  const t = totals([line('p8000', 50, 1)], 'WELCOME10');
  assert.equal(t.delivery, 0);
  assert.equal(t.discount, 800);
  assert.equal(t.total, 7200);
});

test('discount applies to subtotal only, not gift wrap or delivery', () => {
  const t = totals([line('a', 50, 1, true)], 'WELCOME10'); // 4000
  assert.equal(t.giftWrap, 300);
  assert.equal(t.discount, 400);
  assert.equal(t.delivery, 250);
  assert.equal(t.total, 4000 + 300 + 250 - 400);
});

test('gift wrap charged once regardless of how many gift lines', () => {
  assert.equal(totals([line('a', 50, 1), line('c', 50, 1)]).giftWrap, 0);
  assert.equal(totals([line('a', 50, 1, true), line('c', 50, 1)]).giftWrap, 300);
  assert.equal(totals([line('a', 50, 1, true), line('c', 50, 2, true)]).giftWrap, 300);
});

test('qty above stock clamps to stock; qty below 1 clamps to 1', () => {
  const t = totals([line('c', 50, 99)]);
  assert.equal(t.lines[0].lineTotal, 5000 * 3);
  assert.equal(t.subtotal, 15000);
  assert.equal(totals([line('c', 50, 0)]).lines[0].lineTotal, 5000);
  assert.equal(totals([line('c', 50, -4)]).subtotal, 5000);
  assert.equal(totals([line('c', 50, 2.7)]).subtotal, 10000);
  assert.equal(totals([line('c', 50, NaN)]).subtotal, 5000);
});

test('out-of-stock line is retained with lineTotal 0 and contributes nothing', () => {
  const t = totals([line('oos', 50, 2, true)]);
  assert.equal(t.lines.length, 1);
  assert.equal(t.lines[0].lineTotal, 0);
  assert.equal(t.subtotal, 0);
  assert.equal(t.giftWrap, 0);
  assert.equal(t.delivery, 0); // nothing purchasable: treated like an empty cart
  assert.equal(t.freeDeliveryRemaining, 0);
  assert.equal(t.total, 0);
  assert.equal(totals([line('oos', 50, 2)], 'WELCOME10').codeStatus, 'none');
});

test('out-of-stock line alongside in-stock line', () => {
  const t = totals([line('oos', 50, 1, true), line('a', 50, 1)]);
  assert.equal(t.lines.length, 2);
  assert.equal(t.lines[0].lineTotal, 0);
  assert.equal(t.lines[1].lineTotal, 4000);
  assert.equal(t.subtotal, 4000);
  assert.equal(t.giftWrap, 0); // gift flag only on the out-of-stock line
  assert.equal(t.delivery, 250);
});

test('unknown product and unknown size lines are dropped', () => {
  const t = totals([line('zzz', 50, 1), line('a', 75, 1), line('a', 50, 1)]);
  assert.equal(t.lines.length, 1);
  assert.equal(t.subtotal, 4000);
  const allBad = totals([line('zzz', 50, 1)], 'WELCOME10');
  assert.equal(allBad.lines.length, 0);
  assert.equal(allBad.codeStatus, 'none');
  assert.equal(allBad.total, 0);
});

test('does not mutate inputs', () => {
  const lines = [line('c', 50, 99)];
  const snap = JSON.stringify(lines);
  totals(lines, 'WELCOME10');
  assert.equal(JSON.stringify(lines), snap);
});

test('works against real config and catalogue', () => {
  const products = require('../../assets/js/products.js');
  const prod = products.find((x) => x.stock > 0);
  const size = prod.sizes[0];
  const t = pricing.cartTotals([line(prod.id, size.ml, 1)], products, config);
  assert.equal(t.subtotal, size.price);
});
