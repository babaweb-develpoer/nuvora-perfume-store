/*
 * Cart page: the full version of the drawer.
 *
 * Renders every bag line (image, house, name, size, unit price, quantity
 * stepper capped at min(stock, 20), line total, gift wrap, remove), the
 * free-delivery progress, the order summary ledger, the discount-code form and
 * the checkout actions. Re-renders on store changes and puts focus back on the
 * control that was in use (data-focus-key). Changes are announced in [data-live].
 *
 * Stock rulings: pricing charges a line at most its stock. When the stored
 * quantity is higher, the line shows the charged quantity with a gentle notice
 * and the store is synced once to that quantity. A sold-out line is shown with
 * a notice and a Remove button; it adds nothing and is left out of checkout.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var store = Shop.store;
  var bag = Shop.bag;
  var MAX_QTY = 20;

  var root;
  var live;
  var shell = null;      // { lines, free, ledger, code, codeForm, actions } while the bag has lines
  var adjusted = {};     // "id:ml" -> quantity we clamped to (keeps the notice after the sync)
  var syncing = false;

  function $(sel, r) { return (r || doc).querySelector(sel); }

  function keyOf(id, ml) { return id + ':' + ml; }

  function announce(text) {
    if (!live) return;
    live.textContent = '';
    // a fresh text node so repeated messages are announced again
    setTimeout(function () { live.textContent = text; }, 30);
  }

  function focusSafely(node) {
    if (!node) return;
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  // ------------------------------------------------------------------ markup

  function lineHtml(row) {
    var p = row.product;
    var line = row.line;
    var k = esc(keyOf(p.id, line.ml));
    var href = esc('product.html?id=' + encodeURIComponent(p.id));
    var soldOut = bag.isSoldOut(row);
    var qty = bag.chargedQty(row);
    var max = Math.min(MAX_QTY, Number(p.stock) || 0);
    var label = esc(p.name) + ', ' + line.ml + ' ml';
    var notice = '';
    if (soldOut) {
      notice = '<p class="bag-line__notice bag-line__notice--sold" data-line-notice>' + bag.icon('alert') +
        '<span>Sold out since you added it, so it will not be ordered. Remove it from your bag.</span></p>';
    } else if (adjusted[keyOf(p.id, line.ml)] != null) {
      notice = '<p class="bag-line__notice" data-line-notice>Only ' + qty + " available — we've adjusted the quantity</p>";
    }

    return '<li class="cart-line bag-line' + (soldOut ? ' is-sold' : '') + '" data-id="' + esc(p.id) + '" data-ml="' + line.ml + '">' +
      '<a class="cart-line__media" href="' + href + '" tabindex="-1" aria-hidden="true">' +
        Shop.ui.media('product-' + p.id, { className: 'cart-line__image', sizes: '(min-width: 900px) 132px, 96px' }) + '</a>' +
      '<div class="cart-line__body">' +
        '<div class="cart-line__top">' +
          '<div class="bag-line__info">' +
            '<p class="cart-line__house">' + esc(p.house) + '</p>' +
            '<h3 class="cart-line__name"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
            '<p class="bag-line__meta"><span>' + line.ml + ' ml</span><span class="bag-line__each">' + esc(pkr(row.unitPrice)) + ' each</span></p>' +
          '</div>' +
          (soldOut
            ? '<span class="badge badge--sold bag-line__sold">Sold out</span>'
            : '<p class="price bag-line__total" data-line-total>' + esc(pkr(row.lineTotal)) + '</p>') +
        '</div>' +
        notice +
        '<div class="cart-line__controls bag-line__controls">' +
          (soldOut ? '' :
          '<div class="qty-stepper" role="group" aria-label="Quantity for ' + label + '">' +
            '<button type="button" class="qty-stepper__btn" data-act="dec" data-focus-key="dec:' + k + '" aria-label="Decrease quantity of ' + label + '"' + (qty <= 1 ? ' disabled' : '') + '>' + Shop.ui.icon('minus') + '</button>' +
            '<span class="qty-stepper__value">' + qty + '</span>' +
            '<button type="button" class="qty-stepper__btn" data-act="inc" data-focus-key="inc:' + k + '" aria-label="Increase quantity of ' + label + '"' + (qty >= max ? ' disabled' : '') + '>' + Shop.ui.icon('plus') + '</button>' +
          '</div>' +
          '<label class="check cart-line__gift bag-line__gift"><input type="checkbox" data-act="gift" data-focus-key="gift:' + k + '"' +
            (line.gift ? ' checked' : '') + '><span>Gift wrap this bottle</span></label>') +
          '<button type="button" class="cart-line__remove bag-line__remove" data-act="remove" data-focus-key="remove:' + k + '" aria-label="Remove ' + label + '">Remove</button>' +
        '</div>' +
      '</div>' +
    '</li>';
  }

  function emptyHtml() {
    return '<div class="bag-empty" data-bag-empty>' +
      '<svg class="bag-empty__mark" viewBox="0 0 48 76" width="48" height="76" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<rect x="17.5" y="2.5" width="13" height="11" rx="1"/><path d="M20.5 13.5v5h7v-5"/>' +
        '<path d="M14 18.5h20c3.6 0 6.5 2.9 6.5 6.5v42.5c0 2.8-2.2 5-5 5h-23c-2.8 0-5-2.2-5-5V25c0-3.6 2.9-6.5 6.5-6.5z"/>' +
        '<path d="M7.5 40.5h33" stroke-opacity=".45"/></svg>' +
      '<h2 class="bag-empty__title">Nothing here yet</h2>' +
      '<p class="bag-empty__text">Your bag is empty. Browse oud, leather, florals and fresh citrus from four independent houses, ' +
        'or answer five quick questions and we will suggest a scent for you.</p>' +
      '<div class="bag-empty__actions">' +
        '<a class="btn btn--primary" href="shop.html">Shop the collection</a>' +
        '<a class="btn btn--ghost" href="scent-quiz.html">Find your scent</a>' +
      '</div>' +
    '</div>';
  }

  function shellHtml() {
    return '<div class="bag-layout">' +
      '<section class="bag-main" aria-labelledby="bag-items-title">' +
        '<h2 class="sr-only" id="bag-items-title">Items in your bag</h2>' +
        '<div class="bag-main__free" data-free></div>' +
        '<ul class="bag-lines" data-bag-lines></ul>' +
      '</section>' +
      '<aside class="bag-summary" data-bag-summary aria-labelledby="bag-summary-title">' +
        '<h2 class="bag-summary__title" id="bag-summary-title">Order summary</h2>' +
        '<div class="bag-summary__ledger" data-ledger></div>' +
        '<div class="code-form bag-summary__code" data-code-form></div>' +
        '<div class="bag-summary__actions" data-actions></div>' +
        '<p class="bag-summary__cod">' + Shop.ui.icon('cash') +
          '<span><strong>Pay cash on delivery.</strong> No card needed and nothing to pay online. Delivered across Pakistan 2 to 5 working days after dispatch.</span></p>' +
      '</aside>' +
    '</div>';
  }

  function actionsHtml(snap) {
    if (!snap.canCheckout) {
      return '<p class="bag-summary__blocked">Nothing in your bag can be ordered right now. Remove the sold-out bottle and choose another from the collection.</p>' +
        '<a class="btn btn--ghost btn--block" href="shop.html">Continue shopping</a>';
    }
    return '<a class="btn btn--primary btn--lg btn--block" href="checkout.html">Proceed to checkout' + Shop.ui.icon('arrow', 'btn__icon') + '</a>' +
      (snap.hasSoldOut ? '<p class="bag-summary__aside">Sold-out bottles are left out of your order.</p>' : '') +
      '<a class="btn btn--text bag-summary__continue" href="shop.html">Continue shopping</a>';
  }

  // ------------------------------------------------------------------ render

  function render() {
    var snap = bag.read();
    var active = doc.activeElement;
    var activeKey = active && root.contains(active) ? active.getAttribute('data-focus-key') : null;
    var countEl = $('[data-bag-count]');
    var lead = $('[data-bag-lead]');

    countEl.textContent = snap.count ? ' (' + snap.count + ')' : '';
    countEl.setAttribute('aria-label', snap.count ? snap.count + (snap.count === 1 ? ' bottle' : ' bottles') : '');

    if (!snap.rows.length) {
      shell = null;
      adjusted = {};
      root.innerHTML = emptyHtml();
      lead.hidden = true;
      if (activeKey) focusSafely($('h1'));
      return;
    }
    lead.hidden = false;

    if (!shell) {
      root.innerHTML = shellHtml();
      shell = {
        lines: $('[data-bag-lines]', root),
        free: $('[data-free]', root),
        ledger: $('[data-ledger]', root),
        code: $('[data-code-form]', root),
        actions: $('[data-actions]', root)
      };
      shell.codeForm = bag.codeForm(shell.code, { announce: announce });
      shell.lines.addEventListener('click', onLineClick);
      shell.lines.addEventListener('change', onLineChange);
    }

    // Lines that charge less than the stored quantity: remember, then sync once.
    var toSync = [];
    snap.rows.forEach(function (row) {
      var q = bag.chargedQty(row);
      var k = keyOf(row.line.productId, row.line.ml);
      if (q >= 1 && row.line.qty > q) { adjusted[k] = q; toSync.push(row); }
    });

    shell.lines.innerHTML = snap.rows.map(lineHtml).join('');
    var t = snap.purchasableTotals;
    var showTotals = snap.canCheckout;
    shell.free.innerHTML = showTotals ? bag.freeDelivery(t).html : '';
    shell.free.hidden = !showTotals;
    shell.ledger.innerHTML = showTotals ? bag.ledgerHtml(t, { count: snap.count }) : '';
    shell.ledger.hidden = !showTotals;
    shell.code.hidden = !showTotals;
    shell.actions.innerHTML = actionsHtml(snap);
    if (showTotals) shell.codeForm.update(snap);

    if (activeKey) {
      var again = root.querySelector('[data-focus-key="' + activeKey + '"]');
      if (again && !again.disabled) focusSafely(again);
      else if (again) {
        // the button just became disabled (min/max): move to its partner
        var partner = again.parentNode.querySelector('.qty-stepper__btn:not([disabled])');
        focusSafely(partner || again.closest('.cart-line').querySelector('[data-act="remove"]'));
      } else {
        var next = root.querySelector('.cart-line [data-act="remove"]');
        focusSafely(next || $('h1'));
      }
    }

    if (toSync.length && !syncing) {
      syncing = true;
      toSync.forEach(function (row) { store.updateQty(row.line.productId, row.line.ml, bag.chargedQty(row)); });
      syncing = false;
      var names = toSync.map(function (row) { return row.product.name; }).join(', ');
      announce('We adjusted the quantity of ' + names + ' to the stock available.');
    }
  }

  // ----------------------------------------------------------------- events

  function lineFor(el) {
    var li = el.closest('.cart-line');
    if (!li) return null;
    var id = li.getAttribute('data-id');
    var ml = Number(li.getAttribute('data-ml'));
    var row = bag.read().rows.filter(function (r) { return r.line.productId === id && r.line.ml === ml; })[0];
    return row ? { id: id, ml: ml, row: row } : null;
  }

  function onLineClick(e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || btn.type === 'checkbox' || btn.disabled) return;
    var hit = lineFor(btn);
    if (!hit) return;
    var act = btn.getAttribute('data-act');
    var name = hit.row.product.name + ', ' + hit.ml + ' ml';
    var k = keyOf(hit.id, hit.ml);
    if (act === 'remove') {
      delete adjusted[k];
      store.removeLine(hit.id, hit.ml);
      Shop.ui.toast(hit.row.product.name + ' removed from your bag');
      var after = bag.read();
      announce(name + ' removed. ' + (after.canCheckout ? 'Total ' + pkr(after.purchasableTotals.total) + '.' : 'Your bag is empty.'));
      return;
    }
    var q = bag.chargedQty(hit.row);
    var max = Math.min(MAX_QTY, Number(hit.row.product.stock) || 0);
    var next = act === 'inc' ? Math.min(max, q + 1) : Math.max(1, q - 1);
    if (next === q) return;
    delete adjusted[k];
    store.updateQty(hit.id, hit.ml, next);
    announce(name + ': quantity ' + next + '. Total ' + pkr(bag.read().purchasableTotals.total) + '.');
  }

  function onLineChange(e) {
    var box = e.target;
    if (!box || box.getAttribute('data-act') !== 'gift') return;
    var hit = lineFor(box);
    if (!hit) return;
    store.setGift(hit.id, hit.ml, box.checked);
    var t = bag.read().purchasableTotals;
    announce((box.checked ? 'Gift wrap added to ' : 'Gift wrap removed from ') + hit.row.product.name + '. Total ' + pkr(t.total) + '.');
  }

  // ------------------------------------------------------------------- init

  function init() {
    root = $('[data-bag-root]');
    live = $('[data-live]');
    if (!root) return;
    render();
    store.onChange(render);
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
