/*
 * Back-office dashboard (admin.html), part of the portfolio showcase.
 *
 * Data: the seeded sample (Shop.adminData, slid so its 30-day window ends today in
 * Pakistan time) merged with the real orders placed in this browser
 * (Shop.store.getOrders()). Live orders always sit above sample ones.
 *
 * Status changes:
 * - Live order: Shop.store.updateOrderStatus, so it persists through the store and
 *   shows on track-order.html.
 * - Sample order: never written anywhere. The new status lives in an in-memory
 *   override map for this page view only; a reload resets the sample to its seeded
 *   statuses, which keeps repeated demos clean. (Pages touch storage only through
 *   store.js.)
 *
 * Announcements: two polite live nodes take turns, so a message is in the DOM at
 * once (no timer, no empty gap) and a repeated message is still spoken.
 *
 * Live updates: store.onChange (also fired for other tabs) refreshes stats, chart,
 * low stock and the orders table. While a status <select> has focus the table is
 * not rebuilt (that would close it or steal focus); it catches up on focusout.
 *
 * Order details: the first cell of every order row is a chevron button that opens a
 * second row with everything known about the order (customer, delivery, items,
 * totals). The numbers of the open orders live in `expanded`, so they stay open
 * through every rebuild of the table (store.onChange, status changes, Show all).
 * The details come only from the order data in this page; nothing leaves it.
 *
 * Every dynamic string goes through Shop.util.escapeHtml or textContent.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var store = Shop.store;
  var data = Shop.adminData;
  var products = Shop.products || [];
  var icon = Shop.ui && Shop.ui.icon ? Shop.ui.icon : function () { return ''; };

  var STATUSES = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];
  var LIMIT = 10;
  var LOW = 5;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var OFFSET = (data.utcOffsetMinutes || 300) * 60000;

  var $ = function (sel) { return doc.querySelector(sel); };
  var els = {
    range: $('[data-range]'),
    summary: $('[data-sales-summary]'),
    plot: $('[data-chart-plot]'),
    tip: $('[data-chart-tip]'),
    tipValue: $('[data-tip-value]'),
    tipLabel: $('[data-tip-label]'),
    salesToggle: $('[data-sales-toggle]'),
    salesWrap: doc.getElementById('ad-sales-table'),
    salesBody: $('[data-sales-body]'),
    salesFoot: $('[data-sales-foot]'),
    lowList: $('[data-low-list]'),
    liveEmpty: $('[data-live-empty]'),
    liveNote: $('[data-live-note]'),
    ordersTable: $('[data-orders-table]'),
    ordersBody: $('[data-orders-body]'),
    ordersCount: $('[data-orders-count]'),
    ordersToggle: $('[data-orders-toggle]'),
    ordersExpand: $('[data-orders-expand]'),
    productsBody: $('[data-products-body]'),
    live: doc.querySelectorAll('[data-admin-live] [aria-live]')
  };

  var today = data.dayKey(new Date().toISOString());
  var sample = data.rebase(data, today);
  var overrides = {};       // sample order number -> status, this page view only
  var liveTurn = 0;         // which of the two live nodes speaks next
  var showAll = false;
  var expanded = new Set(); // numbers of the orders whose details are open
  var pending = false;      // orders table rebuild waiting for a status select to lose focus
  var activeBar = 29;       // roving tab stop in the chart
  var chartWidth = 0;
  var series = [];          // [{date, total, count, live}]

  // ------------------------------------------------------------- helpers

  function isStatus(s) { return STATUSES.indexOf(s) >= 0; }

  function pkt(iso) {
    var t = Date.parse(iso);
    return isNaN(t) ? null : new Date(t + OFFSET);
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtDateTime(iso) {
    var d = pkt(iso);
    if (!d) return '';
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ', ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes());
  }
  function keyDate(key) { return new Date(Date.parse(key + 'T00:00:00Z')); }
  function fmtDay(key, withWeekday) {
    var d = keyDate(key);
    return (withWeekday ? WEEKDAYS[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function total(o) { var t = Number(o && o.totals && o.totals.total); return isFinite(t) ? t : 0; }
  function items(o) {
    return (o.lines || []).reduce(function (s, l) { var q = Number(l && l.qty); return s + (isFinite(q) && q > 0 ? q : 0); }, 0);
  }
  function str(v) { return typeof v === 'string' ? v : ''; }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function fmtFull(iso) {
    var d = pkt(iso);
    if (!d) return '';
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + ', ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ' PKT';
  }

  function announce(msg) {
    var nodes = els.live;
    if (!nodes.length) return;
    var next = nodes[liveTurn % nodes.length];
    for (var i = 0; i < nodes.length; i++) if (nodes[i] !== next) nodes[i].textContent = '';
    next.textContent = msg;
    liveTurn++;
  }

  // Live first (store keeps them newest first), then the sample with any overrides.
  function merged() {
    var live = [];
    try { live = store ? store.getOrders() : []; } catch (e) { live = []; }
    var out = live.map(function (o) { return { order: o, live: true, status: isStatus(o.status) ? o.status : 'Placed' }; });
    sample.orders.forEach(function (o) {
      out.push({ order: o, live: false, status: overrides[o.number] || o.status });
    });
    return out;
  }

  // ------------------------------------------------------------- stats

  function setText(sel, text) { var el = $(sel); if (el) el.textContent = text; }

  function renderStats(all) {
    var revenue = all.reduce(function (s, e) { return s + total(e.order); }, 0);
    var liveCount = all.filter(function (e) { return e.live; }).length;
    var waiting = all.filter(function (e) { return e.status === 'Placed' || e.status === 'Confirmed'; }).length;
    var low = products.filter(function (p) { return p.stock <= LOW; });
    var sold = low.filter(function (p) { return p.stock <= 0; }).length;

    setText('[data-stat="orders"]', String(all.length));
    setText('[data-stat-sub="orders"]', waiting + ' awaiting dispatch');
    setText('[data-stat="revenue"]', pkr(revenue));
    setText('[data-stat-sub="revenue"]', liveCount ? 'Includes ' + plural(liveCount, 'order', 'orders') + ' from this browser' : 'Cash on delivery');
    setText('[data-stat="aov"]', pkr(all.length ? Math.round(revenue / all.length) : 0));
    setText('[data-stat-sub="aov"]', 'Per order, delivery included');
    setText('[data-stat="low"]', String(low.length));
    setText('[data-stat-sub="low"]', sold + ' sold out, ' + (low.length - sold) + ' running low');
  }

  // ------------------------------------------------------------- chart

  function buildSeries(all) {
    var sums = data.salesFor(all.map(function (e) { return e.order; }), today);
    var idx = {};
    var out = sums.map(function (d, i) { idx[d.date] = i; return { date: d.date, total: d.total, count: 0, live: 0 }; });
    all.forEach(function (e) {
      var k = data.dayKey(e.order.createdAt);
      if (Object.prototype.hasOwnProperty.call(idx, k)) {
        out[idx[k]].count++;
        if (e.live) out[idx[k]].live++;
      }
    });
    return out;
  }

  function niceStep(raw) {
    if (!(raw > 0)) return 1000;
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / pow;
    var m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return m * pow;
  }
  function fmtK(v) {
    if (v === 0) return '0';
    if (v >= 1000000) return (Math.round(v / 100000) / 10) + 'm';
    if (v >= 1000) return (Math.round(v / 100) / 10) + 'k';
    return String(v);
  }

  function summaryText() {
    var sum = 0, count = 0, peak = null, empty = 0;
    series.forEach(function (d) {
      sum += d.total; count += d.count;
      if (!d.count) empty++;
      if (!peak || d.total > peak.total) peak = d;
    });
    var s = '30-day revenue ' + pkr(sum) + ' across ' + plural(count, 'order', 'orders') + '.';
    if (peak && peak.total > 0) s += ' Peak day ' + fmtDay(peak.date, true) + ' at ' + pkr(peak.total) + '.';
    var t = series[series.length - 1];
    if (t) s += ' Today ' + pkr(t.total) + ' from ' + plural(t.count, 'order', 'orders') + '.';
    if (empty) s += ' ' + plural(empty, 'day', 'days') + ' without orders.';
    return s;
  }

  function barLabel(d, i) {
    var when = i === series.length - 1 ? 'Today, ' + fmtDay(d.date, true) : fmtDay(d.date, true);
    var s = when + ': ' + pkr(d.total) + ' from ' + plural(d.count, 'order', 'orders');
    if (d.live) s += ', ' + d.live + ' from this browser';
    return s;
  }

  function renderChart() {
    var plot = els.plot;
    var W = Math.max(260, Math.floor(plot.clientWidth || 0));
    var H = W < 560 ? 220 : 280;
    var m = { top: 26, right: 18, bottom: 30, left: 44 };
    var pw = W - m.left - m.right;
    var ph = H - m.top - m.bottom;
    var n = series.length;
    var band = pw / n;
    var bw = Math.max(3, Math.min(24, band - 2));
    var max = series.reduce(function (s, d) { return Math.max(s, d.total); }, 0);
    var step = niceStep(max / 4);
    var yMax = Math.max(step, Math.ceil(max / step) * step);
    var y = function (v) { return m.top + ph - (v / yMax) * ph; };
    var hadFocus = doc.activeElement && doc.activeElement.hasAttribute && doc.activeElement.hasAttribute('data-bar');

    var svg = '';
    // grid + y labels
    for (var v = 0; v <= yMax + 0.5; v += step) {
      var gy = Math.round(y(v)) + 0.5;
      svg += '<line class="ad-chart__grid' + (v === 0 ? ' ad-chart__grid--base' : '') + '" x1="' + m.left + '" x2="' + (W - m.right) + '" y1="' + gy + '" y2="' + gy + '"/>';
      svg += '<text class="ad-chart__ytick" x="' + (m.left - 10) + '" y="' + gy + '" dy="0.32em" text-anchor="end">' + esc(fmtK(v)) + '</text>';
    }
    svg += '<text class="ad-chart__unit" x="' + (m.left - 10) + '" y="' + (m.top - 14) + '" text-anchor="end">PKR</text>';

    // bars: 4px rounded data end, square at the baseline
    series.forEach(function (d, i) {
      if (!(d.total > 0)) return;
      var x = m.left + i * band + (band - bw) / 2;
      var top = y(d.total);
      var h = m.top + ph - top;
      var r = Math.min(4, bw / 2, h);
      var base = m.top + ph;
      var path = 'M' + x.toFixed(2) + ',' + base +
        'V' + (top + r).toFixed(2) +
        'Q' + x.toFixed(2) + ',' + top.toFixed(2) + ' ' + (x + r).toFixed(2) + ',' + top.toFixed(2) +
        'H' + (x + bw - r).toFixed(2) +
        'Q' + (x + bw).toFixed(2) + ',' + top.toFixed(2) + ' ' + (x + bw).toFixed(2) + ',' + (top + r).toFixed(2) +
        'V' + base + 'Z';
      svg += '<path class="ad-chart__bar' + (i === n - 1 ? ' ad-chart__bar--today' : '') + '" data-mark="' + i + '" d="' + path + '"/>';
    });

    // x labels every 5 days counted back from today (every 10 when bars are narrow)
    var every = band * 5 >= 48 ? 5 : 10;
    series.forEach(function (d, i) {
      if ((n - 1 - i) % every !== 0) return;
      var cx = m.left + i * band + band / 2;
      var label = i === n - 1 ? 'Today' : fmtDay(d.date);
      var anchor = i === n - 1 ? 'end' : 'middle';
      var tx = i === n - 1 ? Math.min(W - 2, cx + band / 2 + 4) : cx;
      svg += '<line class="ad-chart__xtick" x1="' + cx.toFixed(1) + '" x2="' + cx.toFixed(1) + '" y1="' + (m.top + ph) + '" y2="' + (m.top + ph + 4) + '"/>';
      svg += '<text class="ad-chart__xlabel" x="' + tx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + esc(label) + '</text>';
    });

    var summary = summaryText();
    var hits = '';
    series.forEach(function (d, i) {
      hits += '<button type="button" class="ad-chart__hit" data-bar="' + i + '" tabindex="' + (i === activeBar ? '0' : '-1') + '"' +
        ' aria-label="' + esc(barLabel(d, i)) + '"' +
        ' style="left:' + (m.left + i * band).toFixed(2) + 'px;width:' + band.toFixed(2) + 'px;top:' + m.top + 'px;height:' + ph + 'px"></button>';
    });

    plot.innerHTML =
      '<svg class="ad-chart__svg" role="img" aria-label="' + esc(summary) + '" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" focusable="false">' + svg + '</svg>' +
      '<div class="ad-chart__hits" role="group" aria-label="Revenue by day. Use the arrow keys to move between days.">' + hits + '</div>';
    els.summary.textContent = summary;
    chartWidth = W;
    plot.setAttribute('data-ymax', String(yMax));
    plot._geom = { m: m, band: band, ph: ph, y: y, W: W };

    hideTip();
    if (hadFocus) {
      var b = plot.querySelector('[data-bar="' + activeBar + '"]');
      if (b) b.focus();
    }
  }

  function showTip(i) {
    var d = series[i];
    var g = els.plot._geom;
    if (!d || !g) return;
    els.tipValue.textContent = pkr(d.total);
    var when = i === series.length - 1 ? 'Today, ' + fmtDay(d.date, true) : fmtDay(d.date, true);
    els.tipLabel.textContent = when + ', ' + plural(d.count, 'order', 'orders') + (d.live ? ' (' + d.live + ' from this browser)' : '');
    els.tip.hidden = false;
    var cx = g.m.left + i * g.band + g.band / 2;
    var top = d.total > 0 ? g.y(d.total) : g.m.top + g.ph;
    var tw = els.tip.offsetWidth;
    var left = Math.max(tw / 2, Math.min(g.W - tw / 2, cx));
    els.tip.style.left = left + 'px';
    els.tip.style.top = Math.max(els.tip.offsetHeight + 2, top - 10) + 'px'; // never above the plot
    var marks = els.plot.querySelectorAll('.ad-chart__bar.is-active');
    for (var k = 0; k < marks.length; k++) marks[k].classList.remove('is-active');
    var mark = els.plot.querySelector('[data-mark="' + i + '"]');
    if (mark) mark.classList.add('is-active');
  }

  function hideTip() {
    els.tip.hidden = true;
    var marks = els.plot.querySelectorAll('.ad-chart__bar.is-active');
    for (var k = 0; k < marks.length; k++) marks[k].classList.remove('is-active');
  }

  function focusBar(i) {
    i = Math.max(0, Math.min(series.length - 1, i));
    var bars = els.plot.querySelectorAll('[data-bar]');
    for (var k = 0; k < bars.length; k++) bars[k].setAttribute('tabindex', k === i ? '0' : '-1');
    activeBar = i;
    if (bars[i]) bars[i].focus();
  }

  function bindChart() {
    var plot = els.plot;
    plot.addEventListener('pointerover', function (e) {
      var b = e.target.closest && e.target.closest('[data-bar]');
      if (b) showTip(Number(b.getAttribute('data-bar')));
    });
    plot.addEventListener('pointerleave', function () {
      var a = doc.activeElement;
      if (a && a.hasAttribute && a.hasAttribute('data-bar') && plot.contains(a)) showTip(Number(a.getAttribute('data-bar')));
      else hideTip();
    });
    plot.addEventListener('focusin', function (e) {
      var b = e.target.closest && e.target.closest('[data-bar]');
      if (!b) return;
      var i = Number(b.getAttribute('data-bar'));
      activeBar = i;
      showTip(i);
    });
    plot.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !plot.contains(e.relatedTarget)) hideTip();
    });
    plot.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('[data-bar]');
      if (!b) return;
      var i = Number(b.getAttribute('data-bar'));
      var next = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = i - 1;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = i + 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = series.length - 1;
      else if (e.key === 'Escape') { hideTip(); return; }
      if (next === null) return;
      e.preventDefault();
      focusBar(next);
    });

    if (typeof window.ResizeObserver === 'function') {
      var ro = new window.ResizeObserver(function () {
        var w = Math.max(260, Math.floor(plot.clientWidth || 0));
        if (w !== chartWidth) renderChart();
      });
      ro.observe(plot);
    } else {
      window.addEventListener('resize', function () { renderChart(); });
    }

    els.salesToggle.addEventListener('click', function () {
      var open = els.salesToggle.getAttribute('aria-expanded') !== 'true';
      els.salesToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      els.salesToggle.textContent = open ? 'Hide table' : 'View as table';
      els.salesWrap.hidden = !open;
    });
  }

  function renderSalesTable() {
    var html = '';
    var sum = 0, count = 0;
    for (var i = 0; i < series.length; i++) { // oldest first, like the chart
      var d = series[i];
      sum += d.total; count += d.count;
      html += '<tr><th scope="row">' + esc((i === series.length - 1 ? 'Today, ' : '') + fmtDay(d.date, true)) + '</th>' +
        '<td class="ad-num">' + d.count + '</td><td class="ad-num">' + esc(pkr(d.total)) + '</td></tr>';
    }
    els.salesBody.innerHTML = html;
    els.salesFoot.innerHTML = '<tr><th scope="row">30 days</th><td class="ad-num">' + count + '</td><td class="ad-num">' + esc(pkr(sum)) + '</td></tr>';
  }

  // ------------------------------------------------------------- orders

  function statusOptions(current) {
    return STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === current ? ' selected' : '') + '>' + s + '</option>';
    }).join('');
  }

  function chevron() {
    return '<svg class="ad-toggle__chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
      'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6"/></svg>';
  }

  function detailId(n) { return 'ad-od-' + n.replace(/[^A-Za-z0-9_-]/g, '-'); }

  function productOf(id) {
    for (var i = 0; i < products.length; i++) if (products[i].id === id) return products[i];
    return null;
  }

  // One purchased line: thumbnail, name, house, size, quantity, gift wrap and the
  // line total (catalogue price x quantity; pricing's stock clamp does not apply to history).
  function lineHtml(l) {
    l = l || {};
    var p = productOf(l.productId);
    var qty = Math.max(1, num(l.qty));
    var size = null;
    if (p) (p.sizes || []).forEach(function (s) { if (s.ml === num(l.ml)) size = s; });
    var meta = [];
    if (p) meta.push(esc(p.house));
    meta.push(esc(num(l.ml) + ' ml'));
    meta.push('Qty ' + qty);
    if (l.gift) meta.push('Gift wrap');
    var thumb = Shop.ui && Shop.ui.media ? Shop.ui.media('product-' + str(l.productId), { alt: '', className: 'ad-od__img' }) : '';
    return '<li class="ad-od__item">' +
      '<span class="ad-od__thumb">' + thumb + '</span>' +
      '<span class="ad-od__info"><span class="ad-od__pname">' + esc(p ? p.name : str(l.productId)) + '</span>' +
        '<span class="ad-od__pmeta">' + meta.join(' &middot; ') + '</span></span>' +
      '<span class="ad-od__ltotal">' + (size ? esc(pkr(size.price * qty)) : '') + '</span>' +
    '</li>';
  }

  function ledgerRow(key, label, value) {
    return '<div class="ledger__row ledger__row--' + key + '">' +
      '<dt class="ledger__label">' + label + '</dt><dd class="ledger__value">' + esc(value) + '</dd></div>';
  }

  // Same markup as Shop.bag.ledgerHtml (cart-shared.js is not loaded here), fed with
  // the totals stored on the order. Gift wrap and discount always show, "None" when 0.
  function ledgerHtml(o) {
    var t = o.totals || {};
    var code = str(o.code);
    return '<dl class="ledger bag-ledger">' +
      ledgerRow('subtotal', 'Subtotal', pkr(num(t.subtotal))) +
      ledgerRow('giftWrap', 'Gift wrap', num(t.giftWrap) > 0 ? pkr(num(t.giftWrap)) : 'None') +
      ledgerRow('discount', 'Discount' + (code ? ' <span class="ledger__code">' + esc(code) + '</span>' : ''), num(t.discount) > 0 ? '−' + pkr(num(t.discount)) : 'None') +
      ledgerRow('delivery', 'Delivery', num(t.delivery) > 0 ? pkr(num(t.delivery)) : 'Free') +
      ledgerRow('total', 'Total', pkr(total(o))) +
    '</dl>';
  }

  function fact(key, label, valueHtml, wide) {
    return '<div class="ad-od__fact' + (wide ? ' ad-od__fact--wide' : '') + '"><dt>' + label + '</dt><dd data-fact="' + key + '">' + valueHtml + '</dd></div>';
  }

  // Everything known about one order, as markup for the details region.
  function detailsHtml(e) {
    var o = e.order;
    var c = o.customer || {};
    var lines = (o.lines || []).map(lineHtml).join('');
    return '<div class="ad-od__main">' +
        '<p class="ad-od__title">Customer and delivery</p>' +
        '<dl class="ad-od__facts">' +
          fact('name', 'Full name', esc(str(c.name) || 'No name given')) +
          fact('phone', 'Phone', esc(str(c.phone) || 'Not provided')) +
          fact('email', 'Email', esc(str(c.email) || 'Not provided')) +
          fact('province', 'Province', esc(str(c.province) || 'Not provided')) +
          fact('city', 'City', esc(str(c.city) || 'Not provided')) +
          fact('address', 'Full address', esc(str(c.address) || 'Not provided'), true) +
          fact('notes', 'Delivery notes', esc(str(c.notes) || 'None'), true) +
          fact('payment', 'Payment', 'Cash on delivery') +
          fact('placed', 'Placed', '<time datetime="' + esc(str(o.createdAt)) + '">' + esc(fmtFull(o.createdAt)) + '</time>') +
          fact('status', 'Status', esc(e.status)) +
          fact('code', 'Discount code', esc(str(o.code) || 'None')) +
        '</dl>' +
      '</div>' +
      '<div class="ad-od__side">' +
        '<p class="ad-od__title">Items</p>' +
        '<ul class="ad-od__list">' + lines + '</ul>' +
        ledgerHtml(o) +
      '</div>';
  }

  function orderRow(e) {
    var o = e.order;
    var c = o.customer || {};
    var n = str(o.number);
    var count = items(o);
    var open = expanded.has(n);
    var id = detailId(n);
    return '<tr role="row" class="ad-orow' + (e.live ? ' ad-orow--live' : '') + (open ? ' is-open' : '') + '" data-order-row="' + esc(n) + '" data-live="' + (e.live ? '1' : '0') + '">' +
      '<td role="cell" class="ad-orow__toggle"><button type="button" class="ad-toggle" data-order-toggle="' + esc(n) + '" aria-expanded="' + (open ? 'true' : 'false') + '" ' +
        'aria-controls="' + esc(id) + '" aria-label="Show details for ' + esc(n) + '">' + chevron() + '</button></td>' +
      '<th role="rowheader" scope="row" class="ad-orow__order"><span class="ad-orow__number">' + esc(n) + '</span>' +
        '<span class="ad-origin ad-origin--' + (e.live ? 'live' : 'sample') + '" data-origin>' + (e.live ? 'This browser' : 'Generated') + '</span></th>' +
      '<td role="cell" class="ad-orow__date"><time datetime="' + esc(str(o.createdAt)) + '">' + esc(fmtDateTime(o.createdAt)) + '</time></td>' +
      '<td role="cell" class="ad-orow__cust"><span class="ad-orow__name">' + esc(str(c.name) || 'No name given') + '</span>' +
        '<span class="ad-orow__city">' + esc(str(c.city)) + '</span></td>' +
      '<td role="cell" class="ad-num ad-orow__items"><span class="ad-orow__k">Items</span>' + count + '</td>' +
      '<td role="cell" class="ad-num ad-orow__total">' + esc(pkr(total(o))) + '</td>' +
      '<td role="cell" class="ad-orow__pay"><span class="ad-orow__k">Payment</span><abbr title="Cash on delivery">COD</abbr></td>' +
      '<td role="cell" class="ad-orow__status"><span class="ad-status" data-status-pill data-status="' + esc(e.status) + '">' +
        '<select class="ad-status__select" data-status-for="' + esc(n) + '" aria-label="Status for ' + esc(n) + '">' + statusOptions(e.status) + '</select>' +
      '</span></td>' +
    '</tr>' +
    '<tr role="row" class="ad-odetail" data-order-details="' + esc(n) + '" data-live="' + (e.live ? '1' : '0') + '"' + (open ? '' : ' hidden') + '>' +
      '<td role="cell" class="ad-odetail__cell" colspan="8"><div class="ad-od" id="' + esc(id) + '" role="region" aria-label="Details for ' + esc(n) + '">' +
        (open ? detailsHtml(e) : '') + '</div></td>' +
    '</tr>';
  }

  // The element of the orders table carrying attr="number" (compared as a string,
  // never spliced into a selector).
  function byOrder(attr, number) {
    var list = els.ordersBody.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < list.length; i++) if (list[i].getAttribute(attr) === number) return list[i];
    return null;
  }

  function syncExpandAll() {
    var btns = els.ordersBody.querySelectorAll('[data-order-toggle]');
    var allOpen = btns.length > 0;
    for (var i = 0; i < btns.length; i++) if (btns[i].getAttribute('aria-expanded') !== 'true') allOpen = false;
    els.ordersExpand.textContent = allOpen ? 'Collapse all' : 'Expand all';
    els.ordersExpand.setAttribute('data-all-open', allOpen ? '1' : '0');
  }

  // Open or close one order's details in place, so the button keeps focus.
  function setOpen(number, open, byNum) {
    var btn = byOrder('data-order-toggle', number);
    var det = byOrder('data-order-details', number);
    if (!btn || !det) return;
    var region = det.querySelector('[role="region"]');
    var tr = btn.closest('tr');
    if (open) {
      var e = (byNum || entries())[number];
      if (!e) return;
      expanded.add(number);
      region.innerHTML = detailsHtml(e);
    } else {
      expanded.delete(number);
      region.innerHTML = '';
    }
    det.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (tr) tr.classList.toggle('is-open', open);
  }

  // order number -> merged entry
  function entries() {
    var map = {};
    merged().forEach(function (e) { map[str(e.order.number)] = e; });
    return map;
  }

  function onToggleClick(ev) {
    var btn = ev.target.closest && ev.target.closest('[data-order-toggle]');
    if (!btn || !els.ordersBody.contains(btn)) return;
    setOpen(btn.getAttribute('data-order-toggle'), btn.getAttribute('aria-expanded') !== 'true');
    syncExpandAll();
  }

  function onExpandAll() {
    var open = els.ordersExpand.getAttribute('data-all-open') !== '1';
    var map = entries();
    var btns = els.ordersBody.querySelectorAll('[data-order-toggle]');
    for (var i = 0; i < btns.length; i++) setOpen(btns[i].getAttribute('data-order-toggle'), open, map);
    syncExpandAll();
  }

  function focusedStatus() {
    var a = doc.activeElement;
    return a && a.tagName === 'SELECT' && a.hasAttribute('data-status-for') && els.ordersBody.contains(a) ? a : null;
  }

  function renderOrders(all) {
    var keep = focusedStatus();
    var keepNum = keep ? keep.getAttribute('data-status-for') : null;
    var ka = doc.activeElement;
    var keepToggle = ka && ka.hasAttribute && ka.hasAttribute('data-order-toggle') && els.ordersBody.contains(ka) ? ka.getAttribute('data-order-toggle') : null;
    var list = showAll ? all : all.slice(0, LIMIT);
    els.ordersBody.innerHTML = list.map(orderRow).join('');
    els.ordersCount.textContent = list.length < all.length
      ? 'Showing ' + list.length + ' of ' + all.length + ' orders'
      : 'Showing all ' + plural(all.length, 'order', 'orders');
    els.ordersToggle.hidden = all.length <= LIMIT;
    els.ordersToggle.textContent = showAll ? 'Show 10 most recent' : 'Show all ' + all.length;
    els.ordersToggle.setAttribute('aria-expanded', showAll ? 'true' : 'false');
    if (keepNum) {
      var again = els.ordersBody.querySelectorAll('select[data-status-for]');
      for (var i = 0; i < again.length; i++) if (again[i].getAttribute('data-status-for') === keepNum) again[i].focus();
    }
    if (keepToggle) {
      var tg = byOrder('data-order-toggle', keepToggle);
      if (tg) tg.focus();
    }
    syncExpandAll();
    pending = false;
  }

  function renderLiveHint(all) {
    var live = all.filter(function (e) { return e.live; }).length;
    els.liveEmpty.hidden = live > 0;
    els.liveNote.hidden = live === 0;
    if (live) {
      els.liveNote.innerHTML = '<span class="ad-hint__title">' + esc(plural(live, 'order', 'orders')) + ' placed in this browser.</span>' +
        '<span>Status changes on these orders show on <a href="track-order.html">Track order</a>.</span>';
    }
  }

  function onStatusChange(e) {
    var sel = e.target;
    if (!sel || !sel.hasAttribute || !sel.hasAttribute('data-status-for')) return;
    var number = sel.getAttribute('data-status-for');
    var value = sel.value;
    var tr = sel.closest('tr');
    var pill = sel.closest('[data-status-pill]');
    if (!isStatus(value)) return;
    var isLive = tr && tr.getAttribute('data-live') === '1';
    if (isLive) {
      var ok = false;
      try { ok = store.updateOrderStatus(number, value); } catch (err) { ok = false; }
      if (!ok) {
        sel.value = pill.getAttribute('data-status');
        announce('Could not update ' + number + '. It may have been removed in another tab.');
        return;
      }
    } else {
      overrides[number] = value;
    }
    pill.setAttribute('data-status', value);
    var shown = byOrder('data-order-details', number);
    var statusFact = shown ? shown.querySelector('[data-fact="status"]') : null;
    if (statusFact) statusFact.textContent = value;
    announce(number + ' set to ' + value);
    var all = merged();
    renderStats(all);
  }

  // ------------------------------------------------------------- products

  function stockState(p) {
    if (p.stock <= 0) return { text: 'Sold out', cls: 'badge badge--sold' };
    if (p.stock <= LOW) return { text: 'Low', cls: 'badge badge--low' };
    return { text: 'In stock', cls: 'badge ad-badge--in' };
  }

  function fromPrice(p) {
    return (p.sizes || []).reduce(function (min, s) { return min === null || s.price < min ? s.price : min; }, null) || 0;
  }

  // 'product-mn-01.jpg': the picture's file name in assets/img, read from the media manifest.
  function photoFile(p) {
    var m = Shop.media && Object.prototype.hasOwnProperty.call(Shop.media, 'product-' + p.id) ? Shop.media['product-' + p.id] : null;
    var file = m && m.file ? m.file : (p.images && p.images[0]) || '';
    return String(file).split('/').pop();
  }

  function renderProducts() {
    els.productsBody.innerHTML = products.map(function (p) {
      var st = stockState(p);
      var href = 'product.html?id=' + encodeURIComponent(p.id);
      return '<tr role="row" class="ad-prow" data-product-row="' + esc(p.id) + '">' +
        '<th role="rowheader" scope="row" class="ad-prow__name"><a href="' + esc(href) + '">' + esc(p.name) + '</a></th>' +
        '<td role="cell" class="ad-prow__house">' + esc(p.house) + '</td>' +
        '<td role="cell" class="ad-num ad-prow__stock"><span class="ad-orow__k">Stock</span>' + esc(String(p.stock)) + '</td>' +
        '<td role="cell" class="ad-num ad-prow__from"><span class="ad-orow__k">From</span>' + esc(pkr(fromPrice(p))) + '</td>' +
        '<td role="cell" class="ad-num ad-prow__rating"><span class="ad-orow__k">Rating</span><span class="ad-rating">' + icon('star', 'ad-prow__star') +
          '<span>' + esc(Number(p.rating).toFixed(1)) + '<span class="sr-only"> out of 5</span></span></span></td>' +
        '<td role="cell" class="ad-prow__pill"><span class="' + st.cls + '" data-stock-pill>' + st.text + '</span></td>' +
        '<td role="cell" class="ad-prow__file"><span class="ad-orow__k">Photo file</span><code class="ad-prow__code">' + esc(photoFile(p)) + '</code></td>' +
      '</tr>';
    }).join('');
  }

  function renderLow() {
    var low = products.filter(function (p) { return p.stock <= LOW; })
      .sort(function (a, b) { return a.stock - b.stock || a.name.localeCompare(b.name); });
    if (!low.length) {
      els.lowList.innerHTML = '<li class="ad-low__empty">Every product has more than ' + LOW + ' bottles in stock.</li>';
      return;
    }
    els.lowList.innerHTML = low.map(function (p) {
      var segs = '';
      for (var i = 0; i < LOW; i++) segs += '<span class="ad-meter__seg' + (i < p.stock ? ' is-on' : '') + '"></span>';
      var label = p.stock <= 0 ? 'Sold out' : p.stock + ' left';
      return '<li class="ad-low__item" data-low-item="' + esc(p.id) + '">' +
        '<a class="ad-low__link" href="product.html?id=' + esc(encodeURIComponent(p.id)) + '">' +
          '<span class="ad-low__name">' + esc(p.name) + '</span>' +
          '<span class="ad-low__house">' + esc(p.house) + '</span>' +
        '</a>' +
        '<span class="ad-low__level">' +
          '<span class="ad-meter" aria-hidden="true">' + segs + '</span>' +
          '<span class="ad-low__count' + (p.stock <= 0 ? ' is-out' : '') + '">' + esc(label) + '</span>' +
        '</span>' +
      '</li>';
    }).join('');
  }

  // ------------------------------------------------------------- wiring

  function refresh() {
    var all = merged();
    renderStats(all);
    series = buildSeries(all);
    renderChart();
    renderSalesTable();
    renderLiveHint(all);
    if (focusedStatus()) pending = true;
    else renderOrders(all);
  }

  function init() {
    var first = sample.sales.length ? sample.sales[0].date : today;
    var last = keyDate(today);
    els.range.textContent = 'Last 30 days, ' + fmtDay(first) + ' to ' + fmtDay(today) + ' ' + last.getUTCFullYear();

    renderProducts();
    renderLow();
    bindChart();
    refresh();

    els.ordersBody.addEventListener('change', onStatusChange);
    els.ordersBody.addEventListener('click', onToggleClick);
    els.ordersExpand.addEventListener('click', onExpandAll);
    els.ordersBody.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (pending && !focusedStatus()) renderOrders(merged());
      }, 0);
    });
    els.ordersToggle.addEventListener('click', function () {
      showAll = !showAll;
      renderOrders(merged());
    });
    if (store && typeof store.onChange === 'function') store.onChange(refresh);

    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
