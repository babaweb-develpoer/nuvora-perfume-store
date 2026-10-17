const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, safeLocalStorage } = require('../../assets/js/store.js');

const KEY = 'maison_demo_v1';

function memStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _m: m,
  };
}
const customer = { name: 'Ayesha Khan', phone: '0300-1234567', province: 'Punjab', city: 'Lahore', address: 'House 1, Street 2' };
const totalsStub = { subtotal: 4000, total: 4000 };

test('addToCart merges same product+size and sums qty', () => {
  const s = createStore(memStorage());
  s.addToCart('oud', 50, 1);
  s.addToCart('oud', 50, 2);
  s.addToCart('oud', 100, 1);
  assert.deepEqual(s.getCart(), [
    { productId: 'oud', ml: 50, qty: 3, gift: false },
    { productId: 'oud', ml: 100, qty: 1, gift: false },
  ]);
});

test('string ml/qty from data-* attributes are coerced to integers', () => {
  const s = createStore(memStorage());
  s.addToCart('oud', '50', '2');
  s.addToCart('oud', 50, 1);
  assert.deepEqual(s.getCart(), [{ productId: 'oud', ml: 50, qty: 3, gift: false }]);
  s.updateQty('oud', '50', '5');
  assert.equal(s.getCart()[0].qty, 5);
  s.setGift('oud', '50', true);
  assert.equal(s.getCart()[0].gift, true);
  s.removeLine('oud', '50');
  assert.deepEqual(s.getCart(), []);
});

test('addToCart ignores NaN and qty < 1, and caps a line at 20', () => {
  const s = createStore(memStorage());
  s.addToCart('oud', 'abc', 1);
  s.addToCart('oud', 50, 'x');
  s.addToCart('oud', 50, 0);
  s.addToCart('oud', 50, -2);
  s.addToCart('', 50, 1);
  assert.deepEqual(s.getCart(), []);
  s.addToCart('oud', 50, 15);
  s.addToCart('oud', 50, 15);
  assert.equal(s.getCart()[0].qty, 20);
  s.updateQty('oud', 50, 99);
  assert.equal(s.getCart()[0].qty, 20);
});

test('addToCart gift flag: set on add, kept when omitted on a merge', () => {
  const s = createStore(memStorage());
  s.addToCart('oud', 50, 1, true);
  assert.equal(s.getCart()[0].gift, true);
  s.addToCart('oud', 50, 1);
  assert.equal(s.getCart()[0].gift, true);
  assert.equal(s.getCart()[0].qty, 2);
});

test('updateQty(…, 0) removes; negative removes; unknown line is a no-op', () => {
  const s = createStore(memStorage());
  s.addToCart('a', 50, 2);
  s.addToCart('b', 50, 1);
  s.updateQty('a', 50, 4);
  assert.equal(s.getCart()[0].qty, 4);
  s.updateQty('a', 50, 0);
  assert.deepEqual(s.getCart().map((l) => l.productId), ['b']);
  s.updateQty('b', 50, -1);
  assert.deepEqual(s.getCart(), []);
  s.updateQty('zzz', 50, 3);
  assert.deepEqual(s.getCart(), []);
});

test('removeLine, setGift and clearCart', () => {
  const s = createStore(memStorage());
  s.addToCart('a', 50, 1);
  s.addToCart('b', 100, 1);
  s.setGift('b', 100, true);
  assert.equal(s.getCart()[1].gift, true);
  s.setGift('b', 100, false);
  assert.equal(s.getCart()[1].gift, false);
  s.removeLine('a', 50);
  assert.deepEqual(s.getCart().map((l) => l.productId), ['b']);
  s.clearCart();
  assert.deepEqual(s.getCart(), []);
});

test('wishlist toggles and returns the new state', () => {
  const s = createStore(memStorage());
  assert.equal(s.toggleWishlist('oud'), true);
  assert.deepEqual(s.getWishlist(), ['oud']);
  assert.equal(s.toggleWishlist('oud'), false);
  assert.deepEqual(s.getWishlist(), []);
});

test('wishlist persists across two store instances sharing one storage', () => {
  const st = memStorage();
  const a = createStore(st);
  a.toggleWishlist('oud');
  a.addToCart('oud', 50, 2);
  const b = createStore(st);
  assert.deepEqual(b.getWishlist(), ['oud']);
  assert.equal(b.getCart()[0].qty, 2);
  b.toggleWishlist('rose');
  // the older instance sees the other instance's write too
  assert.deepEqual(a.getWishlist().sort(), ['oud', 'rose']);
  assert.equal(a.toggleWishlist('rose'), false);
});

test('reviews are newest first, per product, with rating clamped to 1-5', () => {
  const s = createStore(memStorage());
  const r1 = s.addReview({ productId: 'oud', name: 'A', rating: 9, text: 'first' });
  s.addReview({ productId: 'oud', name: 'B', rating: 0, text: 'second' });
  s.addReview({ productId: 'oud', name: 'C', rating: 3.6, text: 'third' });
  s.addReview({ productId: 'rose', name: 'D', rating: 4, text: 'other product' });
  const list = s.getReviews('oud');
  assert.deepEqual(list.map((r) => r.text), ['third', 'second', 'first']);
  assert.deepEqual(list.map((r) => r.rating), [4, 1, 5]);
  assert.equal(r1.rating, 5);
  assert.ok(r1.id);
  assert.equal(r1.productId, 'oud');
  assert.ok(!isNaN(Date.parse(r1.createdAt)));
  assert.equal(s.getReviews('nothing').length, 0);
});

test('addReview validation: empty text -> null, trims, defaults name, caps lengths', () => {
  const s = createStore(memStorage());
  assert.equal(s.addReview({ productId: 'oud', name: 'A', rating: 5, text: '   ' }), null);
  assert.equal(s.addReview({ productId: 'oud', name: 'A', rating: 5 }), null);
  assert.equal(s.addReview(null), null);
  assert.equal(s.getReviews('oud').length, 0);
  const g = s.addReview({ productId: 'oud', name: '   ', rating: 5, text: '  nice  ' });
  assert.equal(g.name, 'Guest');
  assert.equal(g.text, 'nice');
  const long = s.addReview({ productId: 'oud', name: 'n'.repeat(100), rating: 5, text: 't'.repeat(900) });
  assert.equal(long.name.length, 40);
  assert.equal(long.text.length, 600);
});

test('setCode/getCode store the trimmed raw string; empty clears', () => {
  const st = memStorage();
  const s = createStore(st);
  assert.equal(s.getCode(), '');
  s.setCode('  welcome10 ');
  assert.equal(s.getCode(), 'welcome10');
  assert.equal(createStore(st).getCode(), 'welcome10');
  s.setCode('');
  assert.equal(s.getCode(), '');
});

test('placeOrder: ORD-6 digits, clears cart and code, retrievable by any valid phone format', () => {
  const s = createStore(memStorage());
  s.addToCart('oud', 50, 1);
  s.setCode('WELCOME10');
  const order = s.placeOrder(customer, s.getCart(), totalsStub);
  assert.match(order.number, /^ORD-\d{6}$/);
  assert.equal(order.status, 'Placed');
  assert.equal(order.code, 'WELCOME10');
  assert.equal(order.customer.name, 'Ayesha Khan');
  assert.equal(order.lines.length, 1);
  assert.deepEqual(order.totals, totalsStub);
  assert.ok(!isNaN(Date.parse(order.createdAt)));
  assert.deepEqual(s.getCart(), []);
  assert.equal(s.getCode(), '');
  for (const p of ['03001234567', '+92 300 1234567', '0300-1234567', '923001234567']) {
    assert.equal(s.findOrder(order.number, p).number, order.number, p);
  }
  assert.equal(s.findOrder(' ' + order.number.toLowerCase() + ' ', '03001234567').number, order.number);
});

test('findOrder returns null for wrong/missing/invalid phone or number', () => {
  const s = createStore(memStorage());
  const order = s.placeOrder(customer, [], totalsStub);
  assert.equal(s.findOrder(order.number, '03111111111'), null);
  assert.equal(s.findOrder(order.number, ''), null);
  assert.equal(s.findOrder(order.number, null), null);
  assert.equal(s.findOrder(order.number, 'garbage'), null);
  assert.equal(s.findOrder('', '03001234567'), null);
  assert.equal(s.findOrder(undefined, '03001234567'), null);
  assert.equal(s.findOrder('ORD-000000', '03001234567'), null);
});

test('getOrders newest first; orders persist across instances', () => {
  const st = memStorage();
  const s = createStore(st);
  const o1 = s.placeOrder(customer, [], totalsStub);
  const o2 = s.placeOrder(customer, [], totalsStub);
  assert.deepEqual(s.getOrders().map((o) => o.number), [o2.number, o1.number]);
  assert.deepEqual(createStore(st).getOrders().map((o) => o.number), [o2.number, o1.number]);
});

test('order numbers never collide with existing ones (colliding random is retried)', () => {
  const s = createStore(memStorage());
  const real = Math.random;
  try {
    Math.random = () => 0.123456;
    const a = s.placeOrder(customer, [], totalsStub);
    assert.equal(a.number, 'ORD-123456');
    const seq = [0.123456, 0.123456, 0.654321];
    let i = 0;
    Math.random = () => seq[Math.min(i++, seq.length - 1)];
    const b = s.placeOrder(customer, [], totalsStub);
    assert.equal(b.number, 'ORD-654321');
    assert.notEqual(a.number, b.number);
  } finally {
    Math.random = real;
  }
});

test('updateOrderStatus accepts valid statuses and rejects bad ones', () => {
  const s = createStore(memStorage());
  const o = s.placeOrder(customer, [], totalsStub);
  assert.equal(s.updateOrderStatus(o.number, 'Dispatched'), true);
  assert.equal(s.getOrders()[0].status, 'Dispatched');
  assert.equal(s.findOrder(o.number, '03001234567').status, 'Dispatched');
  assert.equal(s.updateOrderStatus(o.number, 'Shipped'), false);
  assert.equal(s.updateOrderStatus(o.number, ''), false);
  assert.equal(s.updateOrderStatus('ORD-000000', 'Delivered'), false);
  assert.equal(s.getOrders()[0].status, 'Dispatched');
});

test('onChange fires once per mutation, synchronously, and unsubscribes', () => {
  const s = createStore(memStorage());
  let n = 0;
  const off = s.onChange(() => { n++; });
  s.addToCart('a', 50, 1);
  assert.equal(n, 1);
  s.toggleWishlist('a');
  assert.equal(n, 2);
  s.setCode('X');
  assert.equal(n, 3);
  s.getCart(); s.getWishlist(); s.getOrders();
  assert.equal(n, 3);
  s.addToCart('a', 50, 0); // rejected: no change, no event
  assert.equal(n, 3);
  off();
  off();
  s.addToCart('a', 50, 1);
  assert.equal(n, 3);
});

test('a throwing listener does not break other listeners or the mutation', () => {
  const s = createStore(memStorage());
  let ok = 0;
  s.onChange(() => { throw new Error('boom'); });
  s.onChange(() => { ok++; });
  assert.doesNotThrow(() => s.addToCart('a', 50, 1));
  assert.equal(ok, 1);
  assert.equal(s.getCart().length, 1);
});

test('Review Focus 1: null storage works in memory', () => {
  const s = createStore(null);
  s.addToCart('oud', 50, 2);
  assert.equal(s.toggleWishlist('oud'), true);
  s.setCode('A');
  const o = s.placeOrder(customer, s.getCart(), totalsStub);
  assert.equal(s.findOrder(o.number, '03001234567').number, o.number);
  assert.deepEqual(s.getCart(), []);
  assert.deepEqual(s.getWishlist(), ['oud']);
});

test('Review Focus 1: corrupt JSON loads as empty state', () => {
  for (const bad of ['{not json', '5', 'null', '[]', '"str"', '']) {
    const s = createStore(memStorage({ [KEY]: bad }));
    assert.deepEqual(s.getCart(), [], bad);
    assert.deepEqual(s.getWishlist(), [], bad);
    assert.deepEqual(s.getOrders(), [], bad);
    assert.equal(s.getCode(), '', bad);
    s.addToCart('a', 50, 1);
    assert.equal(s.getCart().length, 1);
  }
});

test('corrupt wrong-shaped fields fall back per field, keeping the good parts', () => {
  const blob = JSON.stringify({
    cart: 'oops',
    wishlist: ['a', 5, null, 'a', 'b'],
    reviews: { not: 'array' },
    orders: [{ nonsense: true }, 7, null],
    code: 42,
  });
  const s = createStore(memStorage({ [KEY]: blob }));
  assert.deepEqual(s.getCart(), []);
  assert.deepEqual(s.getWishlist(), ['a', 'b']);
  assert.deepEqual(s.getReviews('a'), []);
  assert.deepEqual(s.getOrders(), []);
  assert.equal(s.getCode(), '');
  const blob2 = JSON.stringify({ cart: [{ productId: 'a', ml: '50', qty: 2 }, { productId: 'b' }, 'x', { productId: 'c', ml: 50, qty: 0 }] });
  const s2 = createStore(memStorage({ [KEY]: blob2 }));
  assert.deepEqual(s2.getCart(), [{ productId: 'a', ml: 50, qty: 2, gift: false }]);
});

test('Review Focus 1: setItem that throws does not throw and state stays in memory', () => {
  const st = memStorage();
  st.setItem = () => { throw new Error('quota'); };
  const s = createStore(st);
  assert.doesNotThrow(() => s.addToCart('oud', 50, 1));
  assert.doesNotThrow(() => s.toggleWishlist('oud'));
  assert.equal(s.getCart().length, 1);
  assert.deepEqual(s.getWishlist(), ['oud']);
  s.addToCart('oud', 50, 1);
  assert.equal(s.getCart()[0].qty, 2);
});

test('Review Focus 1: getItem that throws does not throw', () => {
  const st = memStorage();
  st.getItem = () => { throw new Error('denied'); };
  const s = createStore(st);
  assert.doesNotThrow(() => s.addToCart('oud', 50, 1));
  assert.equal(s.getCart().length, 1);
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); }, removeItem() { throw new Error('z'); } };
  const s2 = createStore(bad);
  assert.doesNotThrow(() => s2.placeOrder(customer, [], totalsStub));
  assert.equal(s2.getOrders().length, 1);
});

test('returned values are defensive copies', () => {
  const s = createStore(memStorage());
  s.addToCart('a', 50, 1);
  s.toggleWishlist('w');
  s.addReview({ productId: 'a', name: 'N', rating: 5, text: 'T' });
  const o = s.placeOrder(customer, [{ productId: 'a', ml: 50, qty: 1, gift: false }], totalsStub);

  assert.deepEqual(s.getCart(), []); // placeOrder cleared the cart; re-add to test copies
  s.addToCart('a', 50, 1);
  const c2 = s.getCart(); c2[0].qty = 99; c2.length = 0;
  assert.deepEqual(s.getCart(), [{ productId: 'a', ml: 50, qty: 1, gift: false }]);

  const wl = s.getWishlist(); wl.push('hack');
  assert.deepEqual(s.getWishlist(), ['w']);

  const rv = s.getReviews('a'); rv[0].text = 'hacked'; rv.length = 0;
  assert.equal(s.getReviews('a')[0].text, 'T');

  o.customer.name = 'hacked'; o.lines.length = 0;
  const fresh = s.getOrders(); fresh[0].status = 'Delivered'; fresh[0].customer.city = 'x';
  const again = s.getOrders()[0];
  assert.equal(again.status, 'Placed');
  assert.equal(again.customer.name, 'Ayesha Khan');
  assert.equal(again.customer.city, 'Lahore');
  assert.equal(again.lines.length, 1);
  const found = s.findOrder(o.number, '03001234567'); found.status = 'Delivered';
  assert.equal(s.getOrders()[0].status, 'Placed');
});

test('stored under a single JSON blob at maison_demo_v1', () => {
  const st = memStorage();
  const s = createStore(st);
  s.addToCart('a', 50, 1);
  assert.deepEqual([...st._m.keys()], [KEY]);
  const blob = JSON.parse(st._m.get(KEY));
  assert.deepEqual(Object.keys(blob).sort(), ['cart', 'code', 'orders', 'reviews', 'wishlist']);
});

test('safeLocalStorage returns null outside a browser', () => {
  assert.equal(safeLocalStorage(), null);
});

test('safeLocalStorage returns window.localStorage when usable, null when it throws', () => {
  const prev = global.window;
  try {
    const ls = memStorage();
    global.window = { localStorage: ls };
    assert.equal(safeLocalStorage(), ls);
    global.window = { get localStorage() { throw new Error('SecurityError'); } };
    assert.equal(safeLocalStorage(), null);
    const broken = memStorage();
    broken.setItem = () => { throw new Error('quota'); };
    global.window = { localStorage: broken };
    assert.equal(safeLocalStorage(), null);
  } finally {
    if (prev === undefined) delete global.window; else global.window = prev;
  }
});

test('window storage event reloads state and notifies listeners', () => {
  const prev = global.window;
  const handlers = {};
  global.window = { addEventListener: (type, fn) => { handlers[type] = fn; } };
  try {
    const st = memStorage();
    const s = createStore(st);
    let n = 0;
    s.onChange(() => { n++; });
    assert.equal(typeof handlers.storage, 'function');
    st.setItem(KEY, JSON.stringify({ wishlist: ['from-other-tab'] }));
    handlers.storage({ key: KEY });
    assert.equal(n, 1);
    assert.deepEqual(s.getWishlist(), ['from-other-tab']);
    handlers.storage({ key: 'unrelated' });
    assert.equal(n, 1);
  } finally {
    if (prev === undefined) delete global.window; else global.window = prev;
  }
});

const EPOCH = '1970-01-01T00:00:00.000Z';
const isIso = (s) => typeof s === 'string' && !isNaN(Date.parse(s));

test('corrupt stored reviews are coerced into renderable data', () => {
  const blob = JSON.stringify({
    reviews: [
      { productId: 'p', name: 5, rating: 'abc', text: 'ok one' },
      { productId: 'p', name: '   ', rating: 99, text: 't'.repeat(900), createdAt: 'not a date' },
      { productId: 'p', name: 'n'.repeat(100), rating: -3.4, text: 'fine', createdAt: '2024-05-06T07:08:09.000Z' },
      { productId: 'p', name: 'x', rating: 4, text: 42 },
      { productId: 'p', name: 'x', rating: 4, text: '   ' },
      { productId: 7, name: 'x', rating: 4, text: 'no product' },
      null, 5, 'str',
    ],
  });
  const s = createStore(memStorage({ [KEY]: blob }));
  let list;
  assert.doesNotThrow(() => { list = s.getReviews('p'); });
  assert.equal(list.length, 3);
  for (const r of list) {
    assert.equal(typeof r.name, 'string');
    assert.ok(r.name.length >= 1 && r.name.length <= 40);
    assert.ok(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
    assert.equal(typeof r.text, 'string');
    assert.ok(r.text.length >= 1 && r.text.length <= 600);
    assert.ok(isIso(r.createdAt));
    assert.doesNotThrow(() => { r.name.slice(0, 1); '★'.repeat(r.rating); });
  }
  assert.equal(list[0].name, 'Guest');
  assert.equal(list[0].rating, 1);
  assert.equal(list[0].createdAt, EPOCH);
  assert.equal(list[1].name, 'Guest');
  assert.equal(list[1].rating, 5);
  assert.equal(list[1].text.length, 600);
  assert.equal(list[1].createdAt, EPOCH);
  assert.equal(list[2].name.length, 40);
  assert.equal(list[2].rating, 1);
  assert.equal(list[2].createdAt, '2024-05-06T07:08:09.000Z');
});

test('corrupt stored orders are coerced into renderable data', () => {
  const blob = JSON.stringify({
    orders: [
      {
        number: 'ORD-111111', status: 'Shipped', customer: null,
        lines: [null, 5, {}, { productId: 'a', ml: '50', qty: 2 }, { productId: 'b', ml: 100, qty: 0 }, 'x'],
        totals: 'oops', code: 12,
      },
      {
        number: 'ORD-222222', status: 'Delivered', createdAt: '2024-01-02T03:04:05.000Z',
        customer: { name: 'Ayesha', phone: '0300-1234567', email: 5, province: null, city: 'Lahore', address: {}, notes: [] },
        lines: [{ productId: 'a', ml: 50, qty: 1, gift: true }],
        totals: { subtotal: 4000, giftWrap: '300', discount: NaN, delivery: null, total: 4000, freeDeliveryRemaining: 500 },
        code: 'WELCOME10',
      },
      { number: '', status: 'Placed' },
      { number: 123 },
      { nonsense: true },
      null, 7,
    ],
  });
  const s = createStore(memStorage({ [KEY]: blob }));
  let orders;
  assert.doesNotThrow(() => { orders = s.getOrders(); });
  assert.equal(orders.length, 2);

  const a = orders[0];
  assert.equal(a.number, 'ORD-111111');
  assert.equal(a.status, 'Placed');
  assert.equal(a.createdAt, EPOCH);
  assert.equal(typeof a.customer, 'object');
  for (const k of ['name', 'phone', 'email', 'province', 'city', 'address', 'notes']) {
    assert.equal(a.customer[k], '', k);
  }
  assert.deepEqual(a.lines, [{ productId: 'a', ml: 50, qty: 2, gift: false }]);
  for (const k of ['subtotal', 'giftWrap', 'discount', 'delivery', 'total']) assert.equal(a.totals[k], 0, k);
  assert.equal(a.code, '');

  const b = orders[1];
  assert.equal(b.status, 'Delivered');
  assert.equal(b.createdAt, '2024-01-02T03:04:05.000Z');
  assert.equal(b.customer.name, 'Ayesha');
  assert.equal(b.customer.email, '');
  assert.equal(b.customer.province, '');
  assert.equal(b.customer.city, 'Lahore');
  assert.equal(b.customer.address, '');
  assert.equal(b.customer.notes, '');
  assert.deepEqual(b.lines, [{ productId: 'a', ml: 50, qty: 1, gift: true }]);
  assert.equal(b.totals.subtotal, 4000);
  assert.equal(b.totals.giftWrap, 0);
  assert.equal(b.totals.discount, 0);
  assert.equal(b.totals.delivery, 0);
  assert.equal(b.totals.total, 4000);
  assert.equal(b.code, 'WELCOME10');

  // lookups and status updates still work on sanitised data and never throw
  assert.equal(s.findOrder('ORD-222222', '+92 300 1234567').number, 'ORD-222222');
  assert.equal(s.findOrder('ORD-111111', '03001234567'), null); // blank phone never matches
  assert.doesNotThrow(() => s.findOrder('ORD-111111', '03001234567'));
  assert.equal(s.updateOrderStatus('ORD-111111', 'Confirmed'), true);
  assert.equal(s.getOrders()[0].status, 'Confirmed');
});

test('stored order with non-array lines and non-object totals is sanitised', () => {
  const blob = JSON.stringify({ orders: [{ number: 'ORD-333333', lines: 'nope', totals: [1, 2], customer: 'x' }] });
  const s = createStore(memStorage({ [KEY]: blob }));
  const o = s.getOrders()[0];
  assert.deepEqual(o.lines, []);
  assert.equal(o.totals.total, 0);
  assert.equal(o.customer.phone, '');
  assert.equal(o.status, 'Placed');
});
