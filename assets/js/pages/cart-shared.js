/*
 * Shared by cart.html and checkout.html: reads the bag through pricing, builds
 * the order-summary ledger rows, and runs the discount-code form.
 *
 *   Shop.bag.read()            -> snapshot of the bag (see below)
 *   Shop.bag.ledgerHtml(t)     -> <dl> rows: subtotal, gift wrap, discount, delivery, total
 *   Shop.bag.freeDelivery(t)   -> { unlocked, remaining, ratio, html }
 *   Shop.bag.codeForm(el, o)   -> mounts the code form in el; returns { update(snapshot) }
 *
 * Rulings implemented here: pricing clamps a line to its stock and gives a
 * sold-out line lineTotal 0; only lines with lineTotal > 0 are purchasable and
 * they carry the clamped quantity. A code that does not apply is never left
 * in the store when it is entered; an applied code that later stops meeting its
 * minimum stays visible with a Remove button.
 *
 * Every dynamic string goes through escapeHtml or textContent.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};
  var MINUS = '−';

  function store() { return Shop.store; }

  // Line icons the shared set lacks, drawn to match ui.js (24 grid, 1.5 stroke).
  var EXTRA_ICONS = {
    parcel: '<path d="M3.8 7.6 12 3.8l8.2 3.8v8.8L12 20.2l-8.2-3.8z"/><path d="M3.8 7.6 12 11.4l8.2-3.8M12 11.4v8.8"/><path d="m7.9 5.7 8.2 3.8"/>',
    truck: '<path d="M2.8 6.8h10.6v9.4H2.8z"/><path d="M13.4 9.6h4.1l3.2 3.3v3.3h-7.3"/><circle cx="7" cy="17.4" r="1.7"/><circle cx="17" cy="17.4" r="1.7"/>',
    phone: '<path d="M8.2 3.8h7.6a1 1 0 0 1 1 1v14.4a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1z"/><path d="M10.8 17.4h2.4"/>',
    alert: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v5.2M12 16.1v.1"/>'
  };

  function icon(name) {
    if (!EXTRA_ICONS[name]) return Shop.ui.icon(name);
    return '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      EXTRA_ICONS[name] + '</svg>';
  }

  function chargedQty(row) {
    return row.unitPrice > 0 ? Math.round(row.lineTotal / row.unitPrice) : 0;
  }

  function isSoldOut(row) {
    return row.lineTotal === 0 && !(Number(row.product.stock) >= 1);
  }

  function totalsFor(lines, code) {
    return Shop.pricing.cartTotals(lines, Shop.products || [], config, code);
  }

  /*
   * { cart, code, totals, rows, purchasable: [{productId, ml, qty, gift}],
   *   purchasableTotals, count (bottles charged), canCheckout, hasSoldOut }
   */
  function read() {
    var s = store();
    var cart = s.getCart();
    var code = s.getCode();
    var totals = totalsFor(cart, code);
    var purchasable = [];
    var count = 0;
    var hasSoldOut = false;
    totals.lines.forEach(function (row) {
      var q = chargedQty(row);
      if (row.lineTotal > 0) {
        purchasable.push({ productId: row.line.productId, ml: row.line.ml, qty: q, gift: !!row.line.gift });
        count += q;
      } else if (isSoldOut(row)) {
        hasSoldOut = true;
      }
    });
    return {
      cart: cart,
      code: code,
      totals: totals,
      rows: totals.lines,
      purchasable: purchasable,
      purchasableTotals: totalsFor(purchasable, code),
      count: count,
      canCheckout: purchasable.length > 0,
      hasSoldOut: hasSoldOut
    };
  }

  function codeKey(code) { return Shop.pricing.normalizeCode(code); }

  function minFor(key) {
    var def = config.codes && Object.prototype.hasOwnProperty.call(config.codes, key) ? config.codes[key] : null;
    return def ? Number(def.min) || 0 : 0;
  }

  function minMessage(key) {
    return key + ' needs a subtotal of at least ' + pkr(minFor(key));
  }

  // ------------------------------------------------------------------ ledger

  function row(key, label, value, extra) {
    return '<div class="ledger__row ledger__row--' + key + '" data-sum="' + key + '">' +
      '<dt class="ledger__label">' + label + '</dt>' +
      '<dd class="ledger__value" data-sum-value="' + key + '">' + esc(value) + '</dd>' +
      (extra || '') + '</div>';
  }

  function ledgerHtml(t, opts) {
    opts = opts || {};
    var code = codeKey(opts.code != null ? opts.code : store().getCode());
    var count = opts.count;
    var html = '<dl class="ledger bag-ledger" data-fab-avoid>' + // the WhatsApp button never sits on the totals
      row('subtotal', 'Subtotal' + (count ? ' <span class="ledger__note">' + count + (count === 1 ? ' bottle' : ' bottles') + '</span>' : ''), pkr(t.subtotal));
    if (t.giftWrap > 0) html += row('giftWrap', 'Gift wrap (one fee per order)', pkr(t.giftWrap));
    if (t.discount > 0) {
      html += row('discount', 'Discount <span class="ledger__code">' + esc(code) + '</span>', MINUS + pkr(t.discount));
    }
    html += row('delivery', 'Delivery', t.delivery > 0 ? pkr(t.delivery) : 'Free');
    html += row('total', 'Total', pkr(t.total));
    return html + '</dl>';
  }

  // ---------------------------------------------------------- free delivery

  function freeDelivery(t) {
    var threshold = Number(config.freeDeliveryThreshold) || 0;
    var unlocked = t.subtotal > 0 && t.freeDeliveryRemaining === 0;
    var ratio = threshold > 0 ? Math.min(1, t.subtotal / threshold) : 1;
    var text = unlocked ? "You've unlocked free delivery"
      : 'Add ' + pkr(t.freeDeliveryRemaining) + ' more for free delivery';
    var html = '<div class="free-ship' + (unlocked ? ' is-unlocked' : '') + '">' +
      '<p class="free-ship__text">' + (unlocked ? icon('check') : icon('truck')) +
        '<span data-free-text>' + esc(text) + '</span></p>' +
      '<div class="progress-bar free-ship__bar" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(ratio * 100) + '">' +
        '<span class="progress-bar__fill" style="--progress-ratio: ' + ratio.toFixed(4) + '"></span></div>' +
      '</div>';
    return { unlocked: unlocked, remaining: t.freeDeliveryRemaining, ratio: ratio, text: text, html: html };
  }

  // -------------------------------------------------------------- code form

  var formSeq = 0;

  function codeForm(host, opts) {
    opts = opts || {};
    var announce = opts.announce || function () {};
    var n = ++formSeq;
    var inputId = 'code-input-' + n;
    var msgId = 'code-msg-' + n;

    host.innerHTML =
      '<form class="code-form__entry" method="post" action="#" data-code-entry novalidate>' +
        '<label class="field__label" for="' + inputId + '">Discount code</label>' +
        '<div class="code-form__row">' +
          '<input class="field__input code-form__input" id="' + inputId + '" name="discount" type="text" ' +
            'autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" maxlength="32">' +
          '<button type="submit" class="btn btn--ghost code-form__apply">Apply</button>' +
        '</div>' +
      '</form>' +
      '<div class="code-form__applied" data-code-applied hidden>' +
        '<span class="code-form__tag">' + Shop.ui.icon('check') + '<span data-code-name></span></span>' +
        '<button type="button" class="code-form__remove" data-code-remove>Remove</button>' +
      '</div>' +
      '<p class="code-form__msg" id="' + msgId + '" data-code-msg aria-live="polite"></p>';

    var entry = host.querySelector('[data-code-entry]');
    var input = host.querySelector('input');
    var applied = host.querySelector('[data-code-applied]');
    var nameEl = host.querySelector('[data-code-name]');
    var removeBtn = host.querySelector('[data-code-remove]');
    var msg = host.querySelector('[data-code-msg]');

    function setMsg(text, tone) {
      msg.textContent = text || '';
      msg.className = 'code-form__msg' + (tone ? ' is-' + tone : '');
    }

    function setError(text) {
      setMsg(text, 'error');
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', msgId);
    }

    function clearError() {
      if (input.getAttribute('aria-invalid') !== 'true') return;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      setMsg('');
    }

    function savingText(key, t) {
      return key + ' applied. You save ' + pkr(t.discount) + '.';
    }

    // Reflect the stored code. Called on mount and on every store change.
    function update(snap) {
      var key = codeKey(snap.code);
      var t = snap.totals;
      if (key && t.codeStatus === 'invalid') {
        // A stored code that no longer exists: drop it quietly.
        store().setCode('');
        return;
      }
      var showApplied = !!key && (t.codeStatus === 'applied' || t.codeStatus === 'min-not-met');
      applied.hidden = !showApplied;
      entry.hidden = showApplied;
      if (showApplied) {
        nameEl.textContent = key;
        removeBtn.setAttribute('aria-label', 'Remove code ' + key);
        applied.classList.toggle('is-pending', t.codeStatus !== 'applied');
        if (t.codeStatus === 'applied') setMsg(savingText(key, t), 'success');
        else {
          var gap = Math.max(0, minFor(key) - t.subtotal);
          setMsg(minMessage(key) + '. Add ' + pkr(gap) + ' more to use it.', 'note');
        }
      } else if (msg.classList.contains('is-success') || msg.classList.contains('is-note')) {
        setMsg('');
      }
    }

    entry.addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = input.value.trim();
      if (!raw) { setError('Enter a code first.'); input.focus(); return; }
      var key = codeKey(raw);
      var cart = store().getCart();
      var t = totalsFor(cart, raw);
      if (t.codeStatus === 'applied') {
        clearError();
        input.value = '';
        store().setCode(key); // stored normalised (WELCOME10); re-render shows the saving
        setMsg(savingText(key, t), 'success');
        announce(savingText(key, t) + ' New total ' + pkr(t.total) + '.');
        try { removeBtn.focus({ preventScroll: true }); } catch (err) { removeBtn.focus(); }
        return;
      }
      if (store().getCode()) store().setCode('');
      if (t.codeStatus === 'min-not-met') setError(minMessage(key) + '. Add ' + pkr(Math.max(0, minFor(key) - t.subtotal)) + ' more to use it.');
      else if (t.codeStatus === 'invalid') setError("That code isn't valid. Check the spelling and try again.");
      else setError('Add a bottle to your bag before applying a code.');
      input.focus();
    });

    input.addEventListener('input', clearError);

    removeBtn.addEventListener('click', function () {
      var key = codeKey(store().getCode());
      store().setCode('');
      setMsg(key ? key + ' removed.' : '', '');
      announce((key ? key + ' removed. ' : '') + 'New total ' + pkr(read().purchasableTotals.total) + '.');
      try { input.focus({ preventScroll: true }); } catch (err) { input.focus(); }
    });

    return { update: update };
  }

  Shop.bag = {
    read: read,
    chargedQty: chargedQty,
    isSoldOut: isSoldOut,
    ledgerHtml: ledgerHtml,
    freeDelivery: freeDelivery,
    codeForm: codeForm,
    icon: icon,
    minus: MINUS
  };
})();
