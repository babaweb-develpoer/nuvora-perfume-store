/*
 * Order tracking: look an order up by order number + the mobile number used at
 * checkout (store.findOrder). Any valid Pakistani phone format matches, and the
 * order number is case-insensitive and tolerant of spaces.
 *
 * Privacy and safety rules this page follows:
 * - ?order=ORD-123456 only prefills the number field; an order is never shown
 *   without the phone number.
 * - A wrong number and a wrong phone give the SAME generic message, so the page
 *   never reveals which field was wrong (or that an order exists).
 * - The result shows only city and province and the last four digits of the
 *   phone, never the street address, the full number or the customer name. The
 *   typed phone is never written into a text node.
 * - Every dynamic string is escaped before it reaches innerHTML.
 *
 * While a result is open it follows status changes made elsewhere (another tab,
 * or the store itself) through store.onChange.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};
  var bag = Shop.bag;

  var STATUSES = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];
  var MESSAGES = {
    Placed: 'We have your order. It is confirmed with you before it leaves us.',
    Confirmed: 'Your order is confirmed. We are packing it now and will hand it to our courier within 1 to 2 working days.',
    Dispatched: 'Your order is with our courier and on its way, 2 to 5 working days after dispatch. Please keep the cash amount ready for delivery.',
    Delivered: 'Your order has been delivered. Thank you for shopping with us. If anything is not right, let us know through the contact page.'
  };
  var NOT_FOUND = 'We couldn’t find an order matching those details. Check your order number and the mobile number you used at checkout.';

  var form = doc.querySelector('[data-track-form]');
  var stage = doc.querySelector('[data-track-stage]');
  var legend = doc.querySelector('[data-track-legend]');
  var legendList = doc.querySelector('[data-track-legend-list]');
  var alertBox = doc.querySelector('[data-track-alert]');
  var live = doc.querySelector('[data-track-live]');
  var formTitle = doc.getElementById('tk-form-title');
  var fields = {};

  var shown = null; // order number of the open result (kept in memory, not the DOM)

  function str(v) { return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim()); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function findProduct(id) {
    var list = Shop.products || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function priceOf(p, ml) {
    var s = (p && p.sizes || []).filter(function (x) { return x.ml === ml; })[0];
    return s ? s.price : 0;
  }

  // ---------------------------------------------------------------- dates
  // Shop.util.deliveryRange / placedAt (shared with the other order page).

  // -------------------------------------------------------------- the input

  // "ord 123456", " ORD - 123456 " or "123456" -> "ORD-123456"; '' when it cannot be one.
  function canonicalNumber(raw) {
    var t = str(raw).replace(/\s+/g, '').toUpperCase();
    var m = /^(?:ORD-?)?(\d{6})$/.exec(t);
    return m ? 'ORD-' + m[1] : '';
  }

  function readQueryNumber() {
    var raw = '';
    try { raw = new URLSearchParams(window.location.search).get('order') || ''; } catch (e) { raw = ''; }
    raw = raw.trim().slice(0, 24);
    return canonicalNumber(raw) || raw.toUpperCase();
  }

  // ------------------------------------------------------------ validation

  var RULES = {
    order: function (v) {
      if (!str(v)) return 'Enter your order number.';
      if (!canonicalNumber(v)) return 'Order numbers look like ORD-123456.';
      return '';
    },
    phone: function (v) {
      if (!str(v)) return 'Enter the mobile number you used at checkout.';
      if (!Shop.util.isValidPKPhone(v)) return 'Enter a valid mobile number, for example 0300 1234567.';
      return '';
    }
  };

  function errorEl(name) { return doc.getElementById(fields[name].getAttribute('data-err-id')); }

  function setError(name, message) {
    var el = fields[name];
    var err = errorEl(name);
    var errId = err.id;
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== errId; });
    if (message) {
      err.textContent = message;
      el.setAttribute('aria-invalid', 'true');
      ids.push(errId);
    } else {
      err.textContent = '';
      el.removeAttribute('aria-invalid');
    }
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  }

  function validateAll() {
    var first = null;
    ['order', 'phone'].forEach(function (name) {
      var msg = RULES[name](fields[name].value);
      setError(name, msg);
      if (msg && !first) first = fields[name];
    });
    return first;
  }

  // ------------------------------------------------------------- the result

  function whatsappDigits() { return String(config.whatsapp || '').replace(/\D/g, ''); }

  // Only with a WhatsApp number configured (see helpLinkHtml).
  function whatsappHref(order) {
    var text = 'Hello ' + (config.shopName || '') + ', I need help with order ' + order.number + '.';
    return 'https://wa.me/' + whatsappDigits() + '?text=' + encodeURIComponent(text);
  }

  // WhatsApp when a number is set, otherwise the contact page.
  function helpLinkHtml(order) {
    if (whatsappDigits()) {
      return '<a class="btn btn--ghost" data-wa href="' + esc(whatsappHref(order)) + '" target="_blank" rel="noopener">' +
        Shop.ui.icon('chat') + 'Need help? WhatsApp us</a>';
    }
    return '<a class="btn btn--ghost" data-help href="contact.html">' + Shop.ui.icon('chat') + 'Need help? Message us</a>';
  }

  function lastFour(phone) {
    var n = Shop.util.normalizePKPhone(str(phone));
    return n ? n.slice(-4) : '';
  }

  function stepHtml(name, state, i) {
    var mark = state === 'complete' ? Shop.ui.icon('check') : '';
    var visible = state === 'complete' ? 'Done' : state === 'current' ? 'Now' : 'Next';
    var hidden = state === 'complete' ? ', completed' : state === 'current' ? ', current step' : ', upcoming';
    return '<li class="tk-step" data-state="' + state + '" style="--i: ' + i + '"' + (state === 'current' ? ' aria-current="step"' : '') + '>' +
      '<span class="tk-step__mark" aria-hidden="true">' + mark + '</span>' +
      '<span class="tk-step__name">' + esc(name) + '</span>' +
      '<span class="tk-step__state" aria-hidden="true">' + visible + '</span>' +
      '<span class="sr-only">' + hidden + '</span>' +
    '</li>';
  }

  function itemHtml(line) {
    var p = findProduct(line.productId);
    if (!p) return '';
    var qty = Math.max(1, Math.trunc(num(line.qty)) || 1);
    var ml = num(line.ml);
    var unit = priceOf(p, ml);
    return '<li class="tk-item">' +
      '<span class="tk-item__media">' + Shop.ui.media('product-' + p.id, { className: 'tk-item__image', sizes: '64px' }) + '</span>' +
      '<span class="tk-item__info">' +
        '<span class="tk-item__name">' + esc(p.name) + '</span>' +
        '<span class="tk-item__meta">' + esc(p.house) + ', ' + ml + ' ml' + (line.gift ? ', gift wrapped' : '') + '</span>' +
        '<span class="tk-item__meta">Quantity ' + qty + '</span>' +
      '</span>' +
      (unit ? '<span class="price tk-item__total">' + esc(pkr(unit * qty)) + '</span>' : '') +
    '</li>';
  }

  function factRow(label, valueHtml) {
    return '<div class="tk-facts__row"><dt class="tk-facts__label">' + label + '</dt><dd class="tk-facts__value">' + valueHtml + '</dd></div>';
  }

  function resultHtml(order) {
    var c = order.customer || {};
    var t = order.totals || {};
    var status = STATUSES.indexOf(order.status) >= 0 ? order.status : 'Placed';
    var at = STATUSES.indexOf(status);
    var total = num(t.total);
    var lines = (Array.isArray(order.lines) ? order.lines : []).filter(function (l) { return !!findProduct(l.productId); });
    var count = lines.reduce(function (n, l) { return n + (Math.trunc(num(l.qty)) || 0); }, 0);
    var place = [str(c.city), str(c.province)].filter(Boolean).join(', ');
    var four = lastFour(c.phone);
    var placed = Shop.util.placedAt(order.createdAt);
    var range = Shop.util.deliveryRange(order.createdAt);
    var delivered = status === 'Delivered';

    var steps = STATUSES.map(function (name, i) {
      return stepHtml(name, i < at ? 'complete' : i === at ? 'current' : 'upcoming', i);
    }).join('');

    // No usable order date (e.g. an epoch from tampered data): no expected range.
    var facts = (delivered ? factRow('Delivery', 'Completed')
        : range ? factRow('Expected delivery', '<span class="tk-nowrap" data-delivery-range>' + esc(range) + '</span>') : '') +
      (place ? factRow('Delivering to', esc(place)) : '') +
      (four ? factRow('Contact number', 'ending <span class="tk-nowrap">' + esc(four) + '</span>') : '') +
      factRow('Payment', '<span class="tk-facts__strong">Cash on delivery</span> — ' + esc(pkr(total)));

    return '<article class="tk-result" data-track-result tabindex="-1" aria-label="Order status">' +
      '<header class="tk-result__head">' +
        '<p class="tk-result__label">Order number</p>' +
        '<p class="tk-result__number" data-track-number>' + esc(order.number) + '</p>' +
        (placed ? '<p class="tk-result__meta">Placed ' + esc(placed) + '</p>' : '') +
      '</header>' +

      '<section class="tk-progress" aria-labelledby="tk-status-title">' +
        '<p class="tk-result__label">Current status</p>' +
        '<h2 class="tk-status" id="tk-status-title"><span class="sr-only">Status: </span><span data-track-status>' + esc(status) + '</span></h2>' +
        '<p class="tk-message" data-track-message>' + esc(MESSAGES[status]) + '</p>' +
        '<ol class="tk-steps" aria-label="Order progress">' + steps + '</ol>' +
      '</section>' +

      '<dl class="tk-facts">' + facts + '</dl>' +

      '<section class="tk-bottles" aria-labelledby="tk-bottles-title">' +
        '<h3 class="tk-bottles__title" id="tk-bottles-title">Your order</h3>' +
        '<ul class="tk-items">' + lines.map(itemHtml).join('') + '</ul>' +
        bag.ledgerHtml({
          subtotal: num(t.subtotal), giftWrap: num(t.giftWrap), discount: num(t.discount),
          delivery: num(t.delivery), total: total
        }, { code: str(order.code), count: count }) +
      '</section>' +

      '<div class="tk-actions">' +
        '<a class="btn btn--primary" href="shop.html">Continue shopping</a>' +
        helpLinkHtml(order) +
      '</div>' +
    '</article>';
  }

  function currentResult() { return stage.querySelector('[data-track-result]'); }

  function clearResult() {
    var r = currentResult();
    if (r && r.parentNode) r.parentNode.removeChild(r);
    legend.hidden = false;
    shown = null;
  }

  function showResult(order, opts) {
    opts = opts || {};
    var old = currentResult();
    var hadFocus = !!(old && old.contains(doc.activeElement));
    if (old && old.parentNode) old.parentNode.removeChild(old);
    stage.insertAdjacentHTML('beforeend', resultHtml(order));
    legend.hidden = true;
    shown = str(order.number).toUpperCase();
    var node = currentResult();
    if (opts.focus || hadFocus) {
      try { node.focus({ preventScroll: false }); } catch (e) { node.focus(); }
    }
    if (opts.announce && live) live.textContent = 'Order status updated: ' + order.status + '.';
  }

  var ALERT_ICON = '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v5.2M12 16.1v.1"/></svg>';

  function showNotFound() {
    alertBox.innerHTML = ALERT_ICON + '<p class="tk-notice__text"></p>';
    alertBox.querySelector('.tk-notice__text').textContent = NOT_FOUND;
  }

  function clearNotice() { alertBox.innerHTML = ''; }

  // ----------------------------------------------------------------- events

  function onSubmit(e) {
    e.preventDefault();
    clearNotice();
    clearResult();
    var firstBad = validateAll();
    if (firstBad) { firstBad.focus(); return; }

    var order = null;
    try { order = Shop.store.findOrder(canonicalNumber(fields.order.value), fields.phone.value); } catch (err) { order = null; }
    if (order) {
      showResult(order, { focus: true });
    } else {
      showNotFound();
      fields.order.focus();
    }
  }

  function onInput(e) {
    var name = e.target && e.target.name;
    if (!RULES[name]) return;
    clearNotice();
    if (e.target.getAttribute('aria-invalid') === 'true' && !RULES[name](e.target.value)) setError(name, '');
  }

  // The open result follows status changes made elsewhere.
  function onStoreChange() {
    if (!shown) return;
    var orders = [];
    try { orders = Shop.store.getOrders(); } catch (e) { orders = []; }
    var order = null;
    for (var i = 0; i < orders.length; i++) {
      if (str(orders[i].number).toUpperCase() === shown) { order = orders[i]; break; }
    }
    if (!order) { clearResult(); return; }
    var prev = currentResult();
    var prevStatus = prev ? prev.querySelector('[data-track-status]').textContent : '';
    if (prevStatus === order.status) return;
    showResult(order, { announce: true });
  }

  // ------------------------------------------------------------------- init

  function init() {
    if (!form || !stage || !Shop.store || !bag) return;
    fields.order = doc.getElementById('tk-number');
    fields.phone = doc.getElementById('tk-phone');
    fields.order.setAttribute('data-err-id', 'tk-number-err');
    fields.phone.setAttribute('data-err-id', 'tk-phone-err');

    legendList.innerHTML = STATUSES.map(function (name, i) {
      return '<li class="tk-legend__item">' +
        '<h3 class="tk-legend__name">' + esc(name) + '</h3>' +
        '<p class="tk-legend__text">' + esc(MESSAGES[name]) + '</p>' +
      '</li>';
    }).join('');

    var q = readQueryNumber();
    if (q) fields.order.value = q;

    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', onInput);
    Shop.store.onChange(onStoreChange);
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
