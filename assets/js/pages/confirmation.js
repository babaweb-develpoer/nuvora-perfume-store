/*
 * Order confirmation: reads ?order=ORD-123456 (trimmed, case-insensitive) and
 * finds the order among the orders saved in this browser (store.getOrders()).
 *
 * Shows a calm success state: the order number, a thank-you by first name,
 * what happens next with an expected delivery range (placed + 3 to + 7 working
 * days, Mon-Sat, e.g. "Mon 19 – Fri 23 Oct"), the bottles and totals (with any code used),
 * the delivery details and the cash-on-delivery total, the concept-store notice
 * under the order ticket, plus links to track the order, keep shopping and (only
 * when config.whatsapp is set) confirm on WhatsApp. An unknown or missing
 * number shows a friendly not-found state.
 *
 * Orders hold customer-entered text, and older orders may lack optional
 * fields: every value is read defensively and escaped before it is rendered.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};
  var bag = Shop.bag;


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

  // ------------------------------------------------------------------ data

  function readNumber() {
    var raw = '';
    try { raw = new URLSearchParams(window.location.search).get('order') || ''; } catch (e) { raw = ''; }
    return raw.trim().toUpperCase();
  }

  function findOrder(number) {
    if (!number) return null;
    var orders = [];
    try { orders = Shop.store.getOrders(); } catch (e) { orders = []; }
    for (var i = 0; i < orders.length; i++) {
      if (str(orders[i].number).toUpperCase() === number) return orders[i];
    }
    return null;
  }

  function displayPhone(v) {
    var n = Shop.util.normalizePKPhone(str(v));
    return n ? n.slice(0, 4) + ' ' + n.slice(4) : str(v);
  }

  function firstName(name) {
    return str(name).split(/\s+/)[0] || '';
  }

  function whatsappDigits() { return String(config.whatsapp || '').replace(/\D/g, ''); }

  // Only with a WhatsApp number configured: without one there is no WhatsApp button.
  function whatsappHref(order, total, first) {
    var text = 'Hello ' + (config.shopName || '') + ', ' + (first ? 'this is ' + first + '. ' : '') +
      "I've just placed order " + order.number + ' for ' + pkr(total) + ', cash on delivery. Please confirm it.';
    return 'https://wa.me/' + whatsappDigits() + '?text=' + encodeURIComponent(text);
  }

  // ---------------------------------------------------------------- markup

  function itemHtml(line) {
    var p = findProduct(line.productId);
    var qty = Math.max(1, Math.trunc(num(line.qty)) || 1);
    var ml = num(line.ml);
    var unit = priceOf(p, ml);
    var name = p ? p.name : 'Fragrance ' + str(line.productId);
    var meta = (p ? esc(p.house) + ', ' : '') + ml + ' ml' + (line.gift ? ', gift wrapped' : '');
    return '<li class="oc-item">' +
      '<span class="oc-item__media">' +
        Shop.ui.media('product-' + (p ? p.id : str(line.productId)), p ? { className: 'oc-item__image', sizes: '72px' } : { className: 'oc-item__image', alt: name }) +
      '</span>' +
      '<span class="oc-item__info">' +
        '<span class="oc-item__name">' + esc(name) + '</span>' +
        '<span class="oc-item__meta">' + meta + '</span>' +
        '<span class="oc-item__qty">Quantity ' + qty + (unit ? ', ' + esc(pkr(unit)) + ' each' : '') + '</span>' +
      '</span>' +
      (unit ? '<span class="price oc-item__total">' + esc(pkr(unit * qty)) + '</span>' : '') +
    '</li>';
  }

  function fact(label, valueHtml, cls) {
    return '<div class="oc-facts__row' + (cls ? ' ' + cls : '') + '"><dt class="oc-facts__label">' + label + '</dt>' +
      '<dd class="oc-facts__value">' + valueHtml + '</dd></div>';
  }

  function confirmHtml(order) {
    var c = order.customer || {};
    var t = order.totals || {};
    var total = num(t.total);
    var first = firstName(c.name);
    var lines = Array.isArray(order.lines) ? order.lines : [];
    var count = lines.reduce(function (n, l) { return n + (Math.trunc(num(l.qty)) || 0); }, 0);
    var place = [str(c.city), str(c.province)].filter(Boolean).join(', ');
    var phone = displayPhone(c.phone);
    // A just-placed order always has a date; fall back to today if it is unusable.
    var range = Shop.util.deliveryRange(order.createdAt) || Shop.util.deliveryRange(new Date().toISOString());
    var placed = Shop.util.placedAt(order.createdAt);
    var trackHref = 'track-order.html?order=' + encodeURIComponent(order.number);

    var deliverTo = '<span class="oc-facts__line oc-facts__strong">' + esc(str(c.name)) + '</span>' +
      (str(c.address) ? '<span class="oc-facts__line oc-facts__pre">' + esc(str(c.address)) + '</span>' : '') +
      (place ? '<span class="oc-facts__line">' + esc(place) + '</span>' : '');

    return '<article class="oc" data-confirm>' +
      '<header class="oc-hero">' +
        '<div class="container oc-hero__inner">' +
          '<span class="oc-hero__seal">' + Shop.ui.icon('check') + '</span>' +
          '<h1 class="oc-hero__title">' + (first ? 'Thank you, ' + esc(first) : 'Thank you') + '</h1>' +
          '<p class="oc-hero__lead">Your order is placed. Your order summary is below.</p>' +
          '<div class="oc-ticket">' +
            '<p class="oc-ticket__label">Order number</p>' +
            '<p class="oc-ticket__number" data-order-number>' + esc(order.number) + '</p>' +
            '<p class="oc-ticket__meta">' + (placed ? 'Placed ' + esc(placed) + '. ' : '') + 'Keep this number to track your order.</p>' +
          '</div>' +
          Shop.ui.conceptNoteHtml('oc-hero__note') +
          '<div class="oc-hero__actions">' +
            '<a class="btn btn--primary" href="' + esc(trackHref) + '">Track this order</a>' +
            (whatsappDigits()
              ? '<a class="btn btn--ghost" data-wa href="' + esc(whatsappHref(order, total, first)) + '" target="_blank" rel="noopener">' +
                  Shop.ui.icon('chat') + 'Confirm on WhatsApp</a>'
              : '') +
          '</div>' +
          '<a class="oc-hero__continue" href="shop.html">Continue shopping</a>' +
        '</div>' +
      '</header>' +

      '<div class="container oc-body">' +
        '<div class="oc-main">' +
          '<section class="oc-next" aria-labelledby="oc-next-title">' +
            '<h2 class="oc-h2" id="oc-next-title">What happens next</h2>' +
            '<ol class="oc-steps">' +
              '<li class="oc-step is-current">' +
                '<h3 class="oc-step__title">Your order is confirmed</h3>' +
                '<p class="oc-step__text">The bottles, the address and the total are checked against stock before packing starts.</p>' +
              '</li>' +
              '<li class="oc-step">' +
                '<h3 class="oc-step__title">Dispatched in 1 to 2 working days</h3>' +
                '<p class="oc-step__text">Sealed and checked' + (num(t.giftWrap) > 0 ? ', gift wrapped as you asked,' : '') + ' and handed to our courier.</p>' +
              '</li>' +
              '<li class="oc-step">' +
                '<h3 class="oc-step__title">Delivered <span class="oc-step__date" data-delivery-range>' + esc(range) + '</span></h3>' +
                '<p class="oc-step__text">Expected 2 to 5 working days after dispatch, so 3 to 7 working days (Monday to Saturday) from your order.</p>' +
              '</li>' +
            '</ol>' +
          '</section>' +

          '<section class="oc-details" aria-labelledby="oc-details-title">' +
            '<h2 class="oc-h2" id="oc-details-title">Delivery details</h2>' +
            '<dl class="oc-facts">' +
              fact('Deliver to', deliverTo) +
              (phone ? fact('Phone', '<span class="oc-nowrap">' + esc(phone) + '</span>') : '') +
              (str(c.email) ? fact('Email', esc(str(c.email))) : '') +
              (str(c.notes) ? fact('Notes', '<span class="oc-facts__line oc-facts__pre">' + esc(str(c.notes)) + '</span>') : '') +
              fact('Payment', '<span class="oc-facts__strong">Cash on delivery</span> — <span class="oc-nowrap">' + esc(pkr(total)) + '</span>', 'oc-facts__row--pay') +
            '</dl>' +
          '</section>' +
        '</div>' +

        '<aside class="oc-summary" aria-labelledby="oc-summary-title">' +
          '<h2 class="oc-summary__title" id="oc-summary-title">Your order</h2>' +
          '<ul class="oc-items">' + lines.map(itemHtml).join('') + '</ul>' +
          bag.ledgerHtml({
            subtotal: num(t.subtotal), giftWrap: num(t.giftWrap), discount: num(t.discount),
            delivery: num(t.delivery), total: total
          }, { code: str(order.code), count: count }) +
        '</aside>' +
      '</div>' +
    '</article>';
  }

  function notFoundHtml(number) {
    return '<section class="container oc-missing" data-notfound aria-labelledby="oc-missing-title">' +
      '<svg class="oc-missing__mark" viewBox="0 0 48 76" width="48" height="76" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<rect x="17.5" y="2.5" width="13" height="11" rx="1"/><path d="M20.5 13.5v5h7v-5"/>' +
        '<path d="M14 18.5h20c3.6 0 6.5 2.9 6.5 6.5v42.5c0 2.8-2.2 5-5 5h-23c-2.8 0-5-2.2-5-5V25c0-3.6 2.9-6.5 6.5-6.5z"/>' +
        '<path d="M7.5 40.5h33" stroke-opacity=".45"/></svg>' +
      '<h1 class="oc-missing__title" id="oc-missing-title">We couldn’t find that order</h1>' +
      '<p class="oc-missing__text">' +
        (number ? 'There is no order <span class="oc-nowrap">' + esc(number) + '</span> saved in this browser. ' : 'This link does not include an order number. ') +
        'Order numbers look like ORD-123456, and orders are saved on the device they were placed on. ' +
        'You can look an order up with its number and your mobile number.</p>' +
      '<div class="oc-missing__actions">' +
        '<a class="btn btn--primary" href="track-order.html">Track an order</a>' +
        '<a class="btn btn--ghost" href="shop.html">Continue shopping</a>' +
      '</div>' +
    '</section>';
  }

  // ------------------------------------------------------------------ init

  function init() {
    var root = doc.querySelector('[data-confirm-root]');
    if (!root) return;
    var number = readNumber();
    var order = findOrder(number);
    var shop = config.shopName || '';
    if (order) {
      root.innerHTML = confirmHtml(order);
      doc.title = 'Order ' + order.number + ' | ' + shop;
    } else {
      root.innerHTML = notFoundHtml(number);
      doc.title = 'Order not found | ' + shop;
    }
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
