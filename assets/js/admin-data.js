/*
 * Generated sales history for the back-office dashboard (admin.html).
 *
 * Everything here is FICTIONAL and clearly sample data: made-up customers,
 * phone numbers of the form 0300 0000xxx, @example.com addresses. It is generated
 * by a seeded PRNG (mulberry32), never Math.random, so tests and screenshots are
 * stable.
 *
 * Dates: the 30-day window ends at the fixed ANCHOR day (2026-10-15) and days are
 * Pakistan Standard Time (UTC+5, no daylight saving): an order placed at 00:30
 * PKT belongs to that PKT day whatever the viewer's own time zone. The admin page
 * calls rebase(data, today) to slide the whole sample so the window always ends
 * on the viewer's current PKT day; the shape of the data never changes.
 *
 * Order numbers: store.placeOrder only ever makes 'ORD-' + 6 digits, so sample
 * orders use 'ORD-S' + 4 digits. The letter makes a collision with a real order
 * impossible, and it reads as "sample" in the table.
 *
 * Totals are computed with the real Shop.pricing.cartTotals over the real
 * catalogue and config (delivery threshold, gift wrap, discount codes), so they
 * agree with what checkout would have charged.
 *
 * Exports: { anchor, utcOffsetMinutes, orders (newest first), sales (30 days,
 * oldest first, derived from orders), build, rebase, salesFor, dayKey }.
 * Node: module.exports. Browser: window.Shop.adminData (needs config.js,
 * products.js and pricing.js loaded first; nothing here calls require there).
 */
(function () {
  'use strict';

  var ANCHOR = '2026-10-15';
  var OFFSET_MIN = 300; // PKT = UTC+5
  var DAY = 86400000;
  var DAYS = 30;
  var SEED = 0x5eed2610;

  // Orders per day, by age in days before the anchor (index 0 = the anchor day).
  var COUNTS = [1, 2, 1, 1, 2, 0, 1, 1, 2, 1, 0, 1, 2, 1, 1, 0, 1, 1, 1, 0, 2, 1, 1, 0, 1, 1, 0, 1, 1, 1];

  // Fictional customers. Phone numbers are deliberately fake (0300 0000xxx).
  var CUSTOMERS = [
    ['Ayesha Khan', 'Lahore', 'Punjab', 'House 14, Street 7, DHA Phase 5'],
    ['Bilal Ahmed', 'Karachi', 'Sindh', 'Flat 3B, Block 13-D, Gulshan-e-Iqbal'],
    ['Fatima Raza', 'Islamabad', 'Islamabad Capital Territory', 'House 22, Street 41, F-7/2'],
    ['Hamza Siddiqui', 'Rawalpindi', 'Punjab', 'House 9, Lane 4, Bahria Town Phase 7'],
    ['Zainab Malik', 'Faisalabad', 'Punjab', 'House 118, Block B, Madina Town'],
    ['Usman Tariq', 'Multan', 'Punjab', 'House 6, Gulgasht Colony'],
    ['Mahnoor Iqbal', 'Peshawar', 'Khyber Pakhtunkhwa', 'House 31, Street 2, Hayatabad Phase 3'],
    ['Ali Haider', 'Karachi', 'Sindh', 'Bungalow 47, Khayaban-e-Shamsheer, DHA Phase 6'],
    ['Sana Javed', 'Lahore', 'Punjab', 'House 72, Block J, Johar Town'],
    ['Omar Farooq', 'Quetta', 'Balochistan', 'House 5, Jinnah Town'],
    ['Hira Shahid', 'Hyderabad', 'Sindh', 'House 19, Qasimabad Phase 1'],
    ['Daniyal Qureshi', 'Sialkot', 'Punjab', 'House 40, Cantt Road'],
    ['Areeba Nadeem', 'Islamabad', 'Islamabad Capital Territory', 'House 8, Street 12, E-11/3'],
    ['Saad Mirza', 'Lahore', 'Punjab', 'House 3, Main Boulevard, Gulberg II'],
    ['Maryam Aslam', 'Karachi', 'Sindh', 'Flat 12, Clifton Block 2'],
    ['Taimur Butt', 'Gujranwala', 'Punjab', 'House 27, Satellite Town'],
    ['Noor Fatima', 'Abbottabad', 'Khyber Pakhtunkhwa', 'House 11, Jinnahabad'],
    ['Rehan Sheikh', 'Muzaffarabad', 'Azad Jammu & Kashmir', 'House 4, Upper Chattar']
  ];
  var NOTES = ['', '', '', '', 'Please call before delivery.', '', 'Leave with the guard if not home.', ''];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function dayMs(key) { return Date.parse(key + 'T00:00:00Z'); }
  function keyOf(ms) { return new Date(ms).toISOString().slice(0, 10); }

  // ISO time -> 'YYYY-MM-DD' of that moment in Pakistan.
  function dayKey(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return '';
    return keyOf(t + OFFSET_MIN * 60000);
  }

  // The DAYS consecutive PKT days ending at endKey, each with the sum of the
  // totals of the orders created that day. Orders outside the window are ignored.
  function salesFor(orders, endKey) {
    var end = dayMs(endKey);
    var out = [];
    var idx = {};
    for (var i = DAYS - 1; i >= 0; i--) {
      var k = keyOf(end - i * DAY);
      idx[k] = out.length;
      out.push({ date: k, total: 0 });
    }
    (orders || []).forEach(function (o) {
      var k = dayKey(o && o.createdAt);
      var t = Number(o && o.totals && o.totals.total);
      if (Object.prototype.hasOwnProperty.call(idx, k) && isFinite(t)) out[idx[k]].total += t;
    });
    return out;
  }

  function build(products, pricing, config) {
    if (!products || !pricing || !config) return { anchor: ANCHOR, orders: [], sales: salesFor([], ANCHOR) };
    var rnd = mulberry32(SEED);
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var inStock = products.filter(function (p) { return p.stock > 0; });
    var anchorMs = dayMs(ANCHOR);
    var made = [];

    for (var age = DAYS - 1; age >= 0; age--) {
      var hours = [];
      for (var c = 0; c < COUNTS[age]; c++) hours.push(10 + Math.floor(rnd() * 12) + c * 0.01);
      hours.sort(function (a, b) { return a - b; });
      for (var j = 0; j < hours.length; j++) {
        // lines: 1 (60%), 2 (30%) or 3 (10%), no repeated product+size
        var r = rnd();
        var count = r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
        var lines = [];
        var guard = 0;
        while (lines.length < count && guard++ < 20) {
          var p = pick(inStock);
          var s = rnd();
          var ml = s < 0.25 ? 30 : s < 0.7 ? 50 : 100;
          if (lines.some(function (l) { return l.productId === p.id && l.ml === ml; })) continue;
          var qty = rnd() < 0.15 && p.stock >= 2 ? 2 : 1;
          lines.push({ productId: p.id, ml: ml, qty: qty, gift: false });
        }
        if (rnd() < 0.18) lines[0].gift = true;

        var plain = pricing.cartTotals(lines, products, config, '');
        var cr = rnd();
        var code = '';
        if (cr < 0.12 && plain.subtotal >= ((config.codes.GIFT15 || {}).min || Infinity)) code = 'GIFT15';
        else if (cr < 0.24 && config.codes.WELCOME10) code = 'WELCOME10';
        var t = pricing.cartTotals(lines, products, config, code);

        var hour = Math.floor(hours[j]);
        var minute = Math.floor(rnd() * 60);
        var cust = pick(CUSTOMERS);
        var ci = CUSTOMERS.indexOf(cust);
        var created = anchorMs - age * DAY + (hour * 60 + minute - OFFSET_MIN) * 60000;
        var first = cust[0].split(' ');

        var status;
        if (age === 0) status = 'Placed';
        else if (age === 1) status = j === 0 ? 'Confirmed' : 'Placed';
        else if (age === 2) status = 'Confirmed';
        else if (age <= 4) status = 'Dispatched';
        else status = 'Delivered';

        made.push({
          createdMs: created,
          order: {
            number: '',
            createdAt: new Date(created).toISOString(),
            status: status,
            customer: {
              name: cust[0],
              phone: '03000000' + pad(101 + ci * 37, 3),
              email: (first[0] + '.' + first[1].charAt(0)).toLowerCase() + '@example.com',
              province: cust[2],
              city: cust[1],
              address: cust[3],
              notes: pick(NOTES)
            },
            lines: lines,
            totals: { subtotal: t.subtotal, giftWrap: t.giftWrap, discount: t.discount, delivery: t.delivery, total: t.total },
            code: code
          }
        });
      }
    }

    // chronological numbering, then newest first
    made.sort(function (a, b) { return a.createdMs - b.createdMs; });
    var n = 2041;
    made.forEach(function (m) { m.order.number = 'ORD-S' + pad(n, 4); n += 3 + Math.floor(rnd() * 9); });
    var orders = made.reverse().map(function (m) { return m.order; });
    return { anchor: ANCHOR, orders: orders, sales: salesFor(orders, ANCHOR) };
  }

  // Slide the sample so its window ends on todayKey ('YYYY-MM-DD', PKT). Returns
  // new arrays; the input is not touched.
  function rebase(data, todayKey) {
    var shift = Math.round((dayMs(todayKey) - dayMs(data.anchor)) / DAY) * DAY;
    if (isNaN(shift)) shift = 0;
    return {
      anchor: todayKey,
      orders: data.orders.map(function (o) {
        var c = JSON.parse(JSON.stringify(o));
        c.createdAt = new Date(Date.parse(o.createdAt) + shift).toISOString();
        return c;
      }),
      sales: data.sales.map(function (d) { return { date: keyOf(dayMs(d.date) + shift), total: d.total }; })
    };
  }

  function deps() {
    if (typeof module !== 'undefined' && typeof require === 'function') {
      return [require('./products.js'), require('./pricing.js'), require('./config.js')];
    }
    var S = (typeof window !== 'undefined' && window.Shop) || {};
    return [S.products, S.pricing, S.config];
  }

  var d = deps();
  var built = build(d[0], d[1], d[2]);

  var api = {
    anchor: ANCHOR,
    utcOffsetMinutes: OFFSET_MIN,
    orders: built.orders,
    sales: built.sales,
    build: build,
    rebase: rebase,
    salesFor: salesFor,
    dayKey: dayKey
  };

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.adminData = api; }
})();
