/*
 * Cart pricing. Pure: takes lines, the catalogue and the config, returns totals.
 *
 * Rules:
 *  - qty is clamped to [1, stock] when stock >= 1. When stock is 0 the line is
 *    kept with qty 0 and lineTotal 0 (so the UI can say "out of stock") and adds
 *    nothing to subtotal or gift wrap.
 *  - Lines for unknown products, or for a size the product does not have, are dropped.
 *  - Discount applies to the subtotal only (never gift wrap or delivery), rounded
 *    to the nearest whole rupee.
 *  - Gift wrap is config.giftWrapFee once if any in-stock line has gift = true.
 *  - Delivery is free at subtotal >= config.freeDeliveryThreshold. A cart with
 *    nothing purchasable (empty, or only out-of-stock lines) pays no delivery,
 *    has freeDeliveryRemaining 0 and codeStatus 'none'.
 */
(function () {
  'use strict';

  function normalizeCode(s) {
    if (s === null || s === undefined) return '';
    return String(s).trim().toUpperCase();
  }

  function clampQty(qty, stock) {
    var q = Math.floor(Number(qty));
    if (!isFinite(q) || q < 1) q = 1;
    var max = Math.floor(Number(stock));
    if (!isFinite(max) || max < 1) return 0;
    return q > max ? max : q;
  }

  function cartTotals(lines, products, config, code) {
    var byId = {};
    (products || []).forEach(function (p) { byId[p.id] = p; });

    var out = [];
    var subtotal = 0;
    var anyGift = false;

    (lines || []).forEach(function (line) {
      var product = line && byId[line.productId];
      if (!product) return;
      var size = null;
      (product.sizes || []).forEach(function (s) { if (s.ml === line.ml) size = s; });
      if (!size) return;
      var qty = clampQty(line.qty, product.stock);
      var lineTotal = size.price * qty;
      subtotal += lineTotal;
      if (qty > 0 && line.gift) anyGift = true;
      out.push({ line: line, product: product, unitPrice: size.price, lineTotal: lineTotal });
    });

    var purchasable = subtotal > 0;
    var giftWrap = anyGift ? config.giftWrapFee : 0;

    var codeStatus = 'none';
    var discount = 0;
    var key = normalizeCode(code);
    if (key && purchasable) {
      var def = Object.prototype.hasOwnProperty.call(config.codes || {}, key) ? config.codes[key] : null;
      if (!def) {
        codeStatus = 'invalid';
      } else if (subtotal < (def.min || 0)) {
        codeStatus = 'min-not-met';
      } else {
        codeStatus = 'applied';
        discount = def.type === 'percent' ? Math.round(subtotal * def.value / 100) : 0;
      }
    }

    var threshold = config.freeDeliveryThreshold;
    var delivery = !purchasable || subtotal >= threshold ? 0 : config.deliveryFee;
    var freeDeliveryRemaining = purchasable ? Math.max(0, threshold - subtotal) : 0;

    return {
      subtotal: subtotal,
      giftWrap: giftWrap,
      discount: discount,
      delivery: delivery,
      total: subtotal + giftWrap + delivery - discount,
      freeDeliveryRemaining: freeDeliveryRemaining,
      codeStatus: codeStatus,
      lines: out
    };
  }

  var api = { normalizeCode: normalizeCode, cartTotals: cartTotals };

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.pricing = api; }
})();
