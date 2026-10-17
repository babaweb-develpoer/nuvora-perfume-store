/*
 * Checkout page: contact and delivery form, cash on delivery only, and the
 * order summary (collapsible <details> on mobile, sticky column on desktop).
 *
 * Validation runs on submit and on blur (a field is only checked on blur once
 * it has a value or has already shown an error), never while typing the first
 * time; once a field shows an error it re-checks as you type so the error
 * clears the moment it is fixed. Errors: .field__error text, aria-invalid, and
 * the error id in aria-describedby only while it is shown. A summary with links
 * appears above the form and focus moves to the first invalid field.
 *
 * Placing the order: the first valid submit disables the button at once and
 * sets a guard, so further clicks, Enter or requestSubmit create nothing.
 * Only purchasable lines (lineTotal > 0, clamped quantities) are ordered, with
 * totals computed from exactly those lines. An empty or all-sold-out bag shows
 * an empty state instead of the form, and the submit handler re-checks it.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var util = Shop.util;
  var store = Shop.store;
  var bag = Shop.bag;
  var DESKTOP_MQ = '(min-width: 960px)';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var NOTES_MAX = 300;

  var form, placeBtn, summaryBox, summaryList, live, codeForm, details, mq;
  var submitting = false;
  var emptied = false;
  var shown = {};   // field name -> true once an error has been shown (live re-check)

  function $(sel, r) { return (r || doc).querySelector(sel); }
  function $$(sel, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(sel)); }

  function focusSafely(node, noScroll) {
    if (!node) return;
    try { node.focus({ preventScroll: !!noScroll }); } catch (e) { node.focus(); }
  }

  function announce(text) {
    if (!live) return;
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  // A tidy, still-valid display form of a Pakistani mobile: 0300 1234567.
  function displayPhone(v) {
    var n = util.normalizePKPhone(v);
    return n ? n.slice(0, 4) + ' ' + n.slice(4) : v;
  }

  // ------------------------------------------------------------- validation

  var RULES = {
    name: function (v) {
      if (!v) return 'Enter your full name.';
      return v.length < 2 ? 'Enter your full name as it should appear on the parcel.' : '';
    },
    phone: function (v) {
      if (!v) return 'Enter your mobile number so the courier can reach you.';
      return util.isValidPKPhone(v) ? '' : 'Enter a Pakistani mobile number, for example 0300 1234567.';
    },
    email: function (v) {
      if (!v) return '';
      return EMAIL.test(v) ? '' : 'Enter a full email address, with an @ and a domain, for example .com or .pk, or leave it empty.';
    },
    province: function (v) { return v ? '' : 'Choose your province or territory.'; },
    city: function (v) {
      if (!v) return 'Enter your city or town.';
      return v.length < 2 ? 'Enter the full name of your city or town.' : '';
    },
    address: function (v) {
      if (!v) return 'Enter your delivery address.';
      return v.length < 10 ? 'Add a little more detail: house number, street and area (at least 10 characters).' : '';
    },
    notes: function (v) { return v.length > NOTES_MAX ? 'Keep delivery notes to ' + NOTES_MAX + ' characters.' : ''; }
  };
  var ORDER = ['name', 'phone', 'email', 'province', 'city', 'address', 'notes'];
  var LABELS = { name: 'Full name', phone: 'Mobile number', email: 'Email', province: 'Province', city: 'City', address: 'Address', notes: 'Delivery notes' };

  function control(name) { return form.elements[name]; }
  function valueOf(name) { var c = control(name); return c ? String(c.value || '').trim() : ''; }

  function setDescribedBy(el, errId, on) {
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== errId; });
    if (on) ids.push(errId);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  }

  function showError(name, message) {
    var el = control(name);
    var err = $('[data-error-for="' + name + '"]', form);
    if (!el || !err) return;
    if (message) {
      err.textContent = message;
      el.setAttribute('aria-invalid', 'true');
      setDescribedBy(el, err.id, true);
      shown[name] = true;
    } else {
      err.textContent = '';
      el.removeAttribute('aria-invalid');
      setDescribedBy(el, err.id, false);
    }
  }

  function check(name) {
    var msg = RULES[name](valueOf(name));
    showError(name, msg);
    if (!msg && name === 'phone' && valueOf('phone')) control('phone').value = displayPhone(valueOf('phone'));
    return msg;
  }

  function invalidNow() {
    return ORDER.filter(function (n) { return control(n) && control(n).getAttribute('aria-invalid') === 'true'; });
  }

  function renderErrorSummary(names) {
    var box = $('[data-error-summary]', form);
    if (!names.length) { box.hidden = true; return; }
    $('[data-error-title]', box).textContent = names.length === 1
      ? 'One detail needs your attention before we can place the order.'
      : names.length + ' details need your attention before we can place the order.';
    $('[data-error-list]', box).innerHTML = names.map(function (n) {
      var err = $('[data-error-for="' + n + '"]', form);
      return '<li><a href="#' + esc(control(n).id) + '" data-goto="' + esc(n) + '">' +
        '<span class="co-errors__field">' + esc(LABELS[n]) + '</span> ' + esc(err ? err.textContent : '') + '</a></li>';
    }).join('');
    box.hidden = false;
  }

  function refreshSummaryIfShown() {
    var box = $('[data-error-summary]', form);
    if (!box.hidden) renderErrorSummary(invalidNow());
  }

  function onFocusOut(e) {
    var name = e.target && e.target.name;
    if (!RULES[name]) return;
    if (valueOf(name) || shown[name]) { check(name); refreshSummaryIfShown(); }
  }

  function onInput(e) {
    var name = e.target && e.target.name;
    if (name === 'notes') updateNotesCount();
    if (!RULES[name]) return;
    if (shown[name] && e.target.getAttribute('aria-invalid') === 'true') {
      // re-check silently while fixing: clear as soon as it is valid
      var msg = RULES[name](valueOf(name));
      if (!msg) { showError(name, ''); refreshSummaryIfShown(); }
      else $('[data-error-for="' + name + '"]', form).textContent = msg;
    }
  }

  function onChange(e) {
    var name = e.target && e.target.name;
    if (e.target.tagName === 'SELECT' && RULES[name]) { check(name); refreshSummaryIfShown(); }
  }

  function updateNotesCount() {
    var n = control('notes').value.length;
    $('[data-notes-count]').textContent = 'A landmark or the best time to call. ' + n + ' of ' + NOTES_MAX + ' characters';
  }

  // --------------------------------------------------------------- summary

  function itemHtml(row) {
    var p = row.product;
    var q = bag.chargedQty(row);
    var meta = esc(p.house) + ', ' + row.line.ml + ' ml' + (row.line.gift ? ', gift wrapped' : '');
    return '<li class="co-item">' +
      '<span class="co-item__media">' +
        Shop.ui.media('product-' + p.id, { className: 'co-item__image', sizes: '64px' }) +
        '<span class="co-item__qty" aria-hidden="true">' + q + '</span>' +
      '</span>' +
      '<span class="co-item__info">' +
        '<span class="co-item__name">' + esc(p.name) + '</span>' +
        '<span class="co-item__meta">' + meta + '<span class="sr-only">, quantity ' + q + '</span></span>' +
      '</span>' +
      '<span class="price co-item__total">' + esc(pkr(row.lineTotal)) + '</span>' +
    '</li>';
  }

  function renderSummary() {
    if (emptied || submitting) return;
    var snap = bag.read();
    if (!snap.canCheckout) { showEmpty(snap); return; }
    var t = snap.purchasableTotals;
    var rows = snap.rows.filter(function (r) { return r.lineTotal > 0; });
    summaryList.innerHTML = rows.map(itemHtml).join('');

    var notes = [];
    if (snap.hasSoldOut) notes.push('A sold-out bottle in your bag is left out of this order.');
    if (snap.rows.some(function (r) { return r.lineTotal > 0 && r.line.qty > bag.chargedQty(r); })) {
      notes.push('Quantities are limited to the stock we have.');
    }
    var note = $('[data-co-note]');
    note.textContent = notes.join(' ');
    note.hidden = !notes.length;

    $('[data-ledger]', summaryBox).innerHTML = bag.ledgerHtml(t, { count: snap.count });
    codeForm.update(snap);
    $('[data-toggle-total]').textContent = pkr(t.total);
    $('[data-pay-total]').textContent = pkr(t.total);
    placeBtn.textContent = 'Place order · ' + pkr(t.total);
  }

  function emptyHtml(snap) {
    var soldOnly = snap.rows.length > 0;
    return '<div class="co-empty" data-checkout-empty>' +
      '<svg class="co-empty__mark" viewBox="0 0 48 76" width="48" height="76" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
        '<rect x="17.5" y="2.5" width="13" height="11" rx="1"/><path d="M20.5 13.5v5h7v-5"/>' +
        '<path d="M14 18.5h20c3.6 0 6.5 2.9 6.5 6.5v42.5c0 2.8-2.2 5-5 5h-23c-2.8 0-5-2.2-5-5V25c0-3.6 2.9-6.5 6.5-6.5z"/>' +
        '<path d="M7.5 40.5h33" stroke-opacity=".45"/></svg>' +
      (soldOnly
        ? '<h2 class="co-empty__title">Nothing in your bag can be ordered</h2>' +
          '<p class="co-empty__text">The bottle in your bag sold out after you added it. Remove it from your bag, then choose another from the collection.</p>'
        : '<h2 class="co-empty__title">Your bag is empty</h2>' +
          '<p class="co-empty__text">Add a fragrance to your bag to check out. Delivery is free over ' + esc(pkr(Shop.config.freeDeliveryThreshold)) +
          ', and you pay in cash when it arrives.</p>') +
      '<div class="co-empty__actions">' +
        '<a class="btn btn--primary" href="shop.html">Shop the collection</a>' +
        (soldOnly ? '<a class="btn btn--ghost" href="cart.html">Review your bag</a>' : '<a class="btn btn--ghost" href="scent-quiz.html">Find your scent</a>') +
      '</div>' +
    '</div>';
  }

  function showEmpty(snap) {
    emptied = true;
    var layout = $('[data-co-layout]');
    if (layout && layout.parentNode) layout.parentNode.removeChild(layout);
    $('.co-head__lead').hidden = true;
    $('[data-co-empty-host]').innerHTML = emptyHtml(snap);
  }

  // ------------------------------------------------------- details toggle

  function syncDetails() {
    var desktop = mq ? mq.matches : false;
    if (desktop) details.open = true;
    details.classList.toggle('is-static', desktop);
  }

  function onToggle() {
    $('[data-toggle-text]').textContent = details.open ? 'Hide order summary' : 'Show order summary';
  }

  // ----------------------------------------------------------------- submit

  function customer() {
    return {
      name: valueOf('name'),
      phone: util.normalizePKPhone(valueOf('phone')) || valueOf('phone'),
      email: valueOf('email'),
      province: valueOf('province'),
      city: valueOf('city'),
      address: valueOf('address'),
      notes: valueOf('notes')
    };
  }

  function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    var snap = bag.read();
    if (!snap.canCheckout) { showEmpty(snap); return; }

    var bad = ORDER.filter(function (n) { return !!check(n); });
    if (bad.length) {
      renderErrorSummary(bad);
      // Bring the summary into view below the sticky header, then focus the
      // first invalid field without a second jump.
      var box = $('[data-error-summary]', form);
      try { box.scrollIntoView({ block: 'start', behavior: 'instant' }); } catch (err) { box.scrollIntoView(); }
      focusSafely(control(bad[0]), true);
      return;
    }
    $('[data-error-summary]', form).hidden = true;

    // Guard first, then work: a second click, Enter or requestSubmit does nothing.
    submitting = true;
    placeBtn.disabled = true;
    placeBtn.setAttribute('aria-busy', 'true');
    placeBtn.textContent = 'Placing your order…';

    // A code that does not apply right now is not recorded on the order.
    if (snap.code && snap.totals.codeStatus !== 'applied') store.setCode('');
    snap = bag.read();
    var t = snap.purchasableTotals;
    var order = store.placeOrder(customer(), snap.purchasable, {
      subtotal: t.subtotal, giftWrap: t.giftWrap, discount: t.discount, delivery: t.delivery, total: t.total
    });
    if (!order || !order.number) {
      submitting = false;
      placeBtn.disabled = false;
      placeBtn.removeAttribute('aria-busy');
      renderSummary();
      announce('Something went wrong placing your order. Please try again.');
      return;
    }
    window.location.assign('order-confirmation.html?order=' + encodeURIComponent(order.number));
  }

  // Back from the confirmation page out of the back/forward cache: the page is
  // restored mid-submit (button disabled, "Placing your order…"). If the order
  // went through the bag is empty, so reload into the empty state; otherwise
  // hand the form back.
  function onPageShow(e) {
    if (!e || !e.persisted || !submitting) return;
    var snap = bag.read();
    if (!snap.canCheckout) { window.location.reload(); return; }
    submitting = false;
    placeBtn.disabled = false;
    placeBtn.removeAttribute('aria-busy');
    renderSummary(); // restores "Place order · PKR total" for the bag as it is now
  }

  // ------------------------------------------------------------------- init

  function init() {
    form = $('[data-checkout-form]');
    live = $('[data-live]');
    if (!form) return;
    placeBtn = $('[data-place]', form);
    summaryBox = $('[data-bag-summary]');
    summaryList = $('[data-co-items]');
    details = $('[data-summary-toggle]');

    var snap = bag.read();
    if (!snap.canCheckout) {
      showEmpty(snap);
    } else {
      codeForm = bag.codeForm($('[data-code-form]'), { announce: announce });
      try { mq = window.matchMedia(DESKTOP_MQ); } catch (err) { mq = null; }
      syncDetails();
      onToggle();
      if (mq) {
        var onMq = function () { syncDetails(); onToggle(); };
        if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
      }
      details.addEventListener('toggle', onToggle);
      // On desktop the summary is always open: the toggle is hidden, but guard anyway.
      $('summary', details).addEventListener('click', function (e) { if (mq && mq.matches) e.preventDefault(); });

      form.addEventListener('submit', onSubmit);
      window.addEventListener('pageshow', onPageShow);
      form.addEventListener('focusout', onFocusOut);
      form.addEventListener('input', onInput);
      form.addEventListener('change', onChange);
      form.addEventListener('click', function (e) {
        var link = e.target.closest('[data-goto]');
        if (!link) return;
        e.preventDefault();
        var target = control(link.getAttribute('data-goto'));
        try { target.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (err) { target.scrollIntoView(); }
        focusSafely(target, true);
      });
      updateNotesCount();
      renderSummary();
      store.onChange(renderSummary);
    }
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
