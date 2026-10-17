/*
 * Product page: one fragrance from ?id=<id> (exact, case-sensitive) or ?slug=<slug>.
 *
 * Renders the framed image, the purchase column (size radiogroup, quantity
 * stepper capped at min(stock, 20), gift wrap, add to bag, wishlist), the notes
 * pyramid, the tabs (description, how to wear, reviews with a validated form),
 * related products, Product JSON-LD and a sticky purchase bar below 900px.
 * An unknown or missing id shows a not-found state with bestsellers instead.
 *
 * Every dynamic string goes through escapeHtml or textContent. Tabs, wishlist
 * hearts and quick-add buttons are wired by ui.js delegation, not here.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};
  var products = Shop.products || [];
  var store = Shop.store;

  var DEFAULT_ML = 50;
  var MAX_QTY = 20;
  var BAR_MQ = '(max-width: 899px)';
  var BAR_EXIT_MS = 420;

  // Two line icons the shared set lacks, drawn to match ui.js (24 grid, 1.5 stroke).
  var EXTRA_ICONS = {
    returns: '<path d="M4.8 12.2a7.2 7.2 0 1 0 2.4-5.4"/><path d="M4.6 4.4v3.9h3.9"/>',
    parcel: '<path d="M3.8 7.6 12 3.8l8.2 3.8v8.8L12 20.2l-8.2-3.8z"/><path d="M3.8 7.6 12 11.4l8.2-3.8M12 11.4v8.8"/><path d="m7.9 5.7 8.2 3.8"/>'
  };

  function icon(name) {
    if (!EXTRA_ICONS[name]) return Shop.ui.icon(name);
    return '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      EXTRA_ICONS[name] + '</svg>';
  }

  var FAMILY_NAME = { oud: 'Oud', woody: 'Woody', floral: 'Floral', fresh: 'Fresh' };
  var GENDER_NAME = { men: 'Men', women: 'Women', unisex: 'Unisex' };

  // Written guidance per scent family. Concentration is not in the data, so none is claimed.
  var WEAR = {
    oud: {
      apply: 'Two sprays on pulse points: the inside of the wrists and the base of the throat. Layer over unscented lotion so the resins have something to hold on to. Oud is dense, and a third spray is rarely needed.',
      when: 'evenings, weddings and the cooler months'
    },
    woody: {
      apply: 'Two or three sprays on the chest and the side of the neck, where body warmth lifts the woods. A light mist on a scarf or collar keeps it close all day; try a hidden spot of fabric first.',
      when: 'cool evenings and tailored days'
    },
    floral: {
      apply: 'One spray on each wrist and one at the nape of the neck. Let it dry on its own rather than rubbing the wrists together, which dulls the opening. For a softer trail, mist the air and walk through it.',
      when: 'daytime, celebrations and warm afternoons'
    },
    fresh: {
      apply: 'Be generous: three or four sprays across the neck, chest and wrists. Fresh compositions are light by nature, so keep the bottle with you and refresh after lunch or before the evening.',
      when: 'hot days, the gym bag and long drives'
    }
  };

  var TAG_WHEN = {
    evening: 'evenings and occasions after dark',
    winter: 'cool weather and winter nights',
    summer: 'warm days and summer heat',
    daily: 'everyday wear, from the office to dinner'
  };

  var RATE_WORDS = ['', 'Not for me', 'It was fine', 'Good', 'Very good', 'Exceptional'];

  // ---------------------------------------------------------------- helpers

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function joinList(items) {
    var list = (items || []).map(String);
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function firstSentence(s) {
    var text = String(s || '').trim();
    var m = /^.*?[.!?](?=\s|$)/.exec(text);
    return m ? m[0] : text;
  }

  function stockOf(p) {
    var n = Math.floor(Number(p.stock));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function hasTag(p, tag) { return !!(p.tags && p.tags.indexOf(tag) >= 0); }

  function setMeta(selector, value) {
    var m = doc.querySelector(selector);
    if (m) m.setAttribute('content', value);
  }

  function plural(n, one, many) { return n === 1 ? one : many; }

  function fillIcons(root) {
    $$('[data-icon]', root).forEach(function (host) {
      if (!host.firstElementChild) host.innerHTML = icon(host.getAttribute('data-icon'));
    });
  }

  function byRating(list) {
    return Shop.catalogue && Shop.catalogue.sortProducts ? Shop.catalogue.sortProducts(list, 'rating') : list.slice();
  }

  function renderCards(host, list) {
    if (!host) return;
    host.innerHTML = list.map(function (p) { return Shop.ui.productCard(p); }).join('');
    $$('.product-card', host).forEach(function (card, i) {
      card.classList.add('reveal');
      card.style.setProperty('--reveal-delay', Math.min(i, 3) * 90 + 'ms');
    });
    Shop.ui.reveal();
  }

  // ----------------------------------------------------------- find product

  function findProduct() {
    var params;
    try { params = new URLSearchParams(window.location.search); } catch (e) { return null; }
    var id = params.get('id');
    var slug = params.get('slug');
    var hit = null;
    if (id !== null) hit = products.filter(function (p) { return p && p.id === id; })[0];
    else if (slug !== null) hit = products.filter(function (p) { return p && p.slug === slug; })[0];
    return hit || null;
  }

  // ============================================================== not found

  function renderNotFound() {
    var pdp = $('[data-pdp]');
    if (pdp) pdp.parentNode.removeChild(pdp);
    var section = $('[data-notfound]');
    if (!section) return;
    var name = config.shopName || '';
    doc.title = 'Fragrance not found | ' + name;
    var desc = 'We couldn’t find that fragrance. Browse the full collection of oud, leather, florals and citrus, delivered across Pakistan with cash on delivery.';
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', doc.title);
    setMeta('meta[property="og:description"]', desc);

    var best = byRating(products.filter(function (p) { return hasTag(p, 'bestseller'); }));
    byRating(products).forEach(function (p) { if (best.indexOf(p) < 0) best.push(p); });
    renderCards($('[data-notfound-grid]', section), best.slice(0, 4));
    section.hidden = false;
  }

  // ================================================================ product

  function renderProduct(p) {
    var root = $('[data-pdp]');
    var missing = $('[data-notfound]');
    if (missing) missing.parentNode.removeChild(missing);

    var stock = stockOf(p);
    var soldOut = stock === 0;
    var maxQty = Math.max(1, Math.min(stock, MAX_QTY));
    var sizes = (p.sizes || []).filter(function (s) { return s && isFinite(Number(s.ml)) && isFinite(Number(s.price)); });
    var initial = sizes.filter(function (s) { return Number(s.ml) === DEFAULT_ML; })[0] || sizes[0] || { ml: DEFAULT_ML, price: 0 };
    var state = { ml: Number(initial.ml), qty: 1 };
    var houseHref = 'shop.html?houses=' + encodeURIComponent(p.house);

    function sizeByMl(ml) {
      return sizes.filter(function (s) { return Number(s.ml) === ml; })[0] || initial;
    }

    // ---- document head

    var shopName = config.shopName || '';
    doc.title = p.name + ' by ' + p.house + ' | ' + shopName;
    var lead = firstSentence(p.description);
    setMeta('meta[name="description"]', lead);
    setMeta('meta[property="og:title"]', doc.title);
    setMeta('meta[property="og:description"]', lead);
    if (p.images && p.images[0]) setMeta('meta[property="og:image"]', absolute(p.images[0]));

    // ---- breadcrumb and title block

    var crumbHouse = $('[data-crumb-house]', root);
    crumbHouse.textContent = p.house;
    crumbHouse.setAttribute('href', houseHref);
    $('[data-crumb-name]', root).textContent = p.name;

    var house = $('[data-pdp-house]', root);
    house.textContent = p.house;
    house.setAttribute('href', houseHref);
    $('[data-pdp-name]', root).textContent = p.name;
    $('[data-pdp-lead]', root).textContent = lead;

    // ---- gallery: one framed image, badges like the cards

    var slot = 'product-' + p.id;
    var known = Shop.media && Object.prototype.hasOwnProperty.call(Shop.media, slot);
    $('[data-pdp-media]', root).innerHTML = Shop.ui.media(slot, {
      eager: true,
      className: 'pdp-figure__media',
      sizes: '(min-width: 900px) 56vw, 100vw',
      alt: known ? undefined : p.name
    });
    var badges = [];
    if (soldOut) badges.push('<span class="badge badge--sold">Sold out</span>');
    else if (stock <= 5) badges.push('<span class="badge badge--low">Low stock</span>');
    if (hasTag(p, 'new')) badges.push('<span class="badge badge--new">New</span>');
    if (hasTag(p, 'bestseller')) badges.push('<span class="badge badge--gold">Bestseller</span>');
    $('[data-pdp-badges]', root).innerHTML = badges.join('');

    // ---- sizes: native radios (arrow keys for free), each with its own bottle

    var count = sizes.length;
    $('[data-pdp-sizes]', root).innerHTML = sizes.map(function (s, i) {
      var ml = Number(s.ml);
      var h = count > 1 ? Math.round(18 + 16 * (i / (count - 1))) : 26;
      return '<label class="pdp-size">' +
        '<input class="pdp-size__input" type="radio" name="size" value="' + esc(ml) + '"' + (ml === state.ml ? ' checked' : '') + '>' +
        '<svg class="pdp-size__bottle" viewBox="0 0 24 40" width="' + Math.round(h * 0.6) + '" height="' + h + '" fill="none" ' +
          'stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
          '<rect x="8.5" y="1.5" width="7" height="5" rx=".6"/><path d="M10 6.5v2.5h4V6.5"/>' +
          '<rect x="3.5" y="9" width="17" height="29.5" rx="3"/><path d="M3.5 21h17" stroke-opacity=".5"/></svg>' +
        '<span class="pdp-size__ml">' + esc(ml) + ' ml</span>' +
        '<span class="pdp-size__price">' + esc(pkr(s.price)) + '</span>' +
      '</label>';
    }).join('');

    var priceEl = $('[data-pdp-price]', root);
    var priceSizeEl = $('[data-pdp-price-size]', root);
    var bar = $('[data-buybar]', root);
    var barPrice = $('[data-bar-price]', bar);
    var barSize = $('[data-bar-size]', bar);
    $('[data-bar-name]', bar).textContent = p.name;

    function showPrice() {
      var s = sizeByMl(state.ml);
      priceEl.textContent = pkr(s.price);
      priceSizeEl.textContent = 'for ' + state.ml + ' ml';
      barPrice.textContent = pkr(s.price);
      barSize.textContent = state.ml + ' ml';
    }

    $('[data-pdp-sizes]', root).addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'size') return;
      state.ml = Number(e.target.value);
      showPrice();
    });
    showPrice();

    // ---- quantity stepper: min 1, max min(stock, 20); typing clamps

    var qtyInput = $('#pdp-qty', root);
    var dec = $('[data-qty-step="-1"]', root);
    var inc = $('[data-qty-step="1"]', root);

    function clampQty(v) {
      var n = parseInt(String(v).replace(/\D/g, ''), 10);
      if (!isFinite(n) || n < 1) n = 1;
      return Math.min(n, maxQty);
    }

    function setQty(n) {
      state.qty = clampQty(n);
      qtyInput.value = String(state.qty);
      syncSteppers();
    }

    function syncSteppers() {
      var cur = clampQty(qtyInput.value);
      dec.disabled = soldOut || cur <= 1;
      inc.disabled = soldOut || cur >= maxQty;
    }

    qtyInput.addEventListener('input', function () {
      var digits = qtyInput.value.replace(/\D/g, '').slice(0, 3);
      if (digits !== '' && Number(digits) > maxQty) digits = String(maxQty);
      if (digits !== qtyInput.value) qtyInput.value = digits;
      if (digits !== '') state.qty = clampQty(digits);
      syncSteppers();
    });
    qtyInput.addEventListener('change', function () { setQty(qtyInput.value); });
    qtyInput.addEventListener('blur', function () { setQty(qtyInput.value); });
    dec.addEventListener('click', function () { setQty(clampQty(qtyInput.value) - 1); });
    inc.addEventListener('click', function () { setQty(clampQty(qtyInput.value) + 1); });

    // ---- stock message

    var stockEl = $('[data-pdp-stock]', root);
    stockEl.textContent = soldOut ? 'Sold out' : stock <= 5 ? 'Only ' + stock + ' left' : 'In stock';
    stockEl.setAttribute('data-level', soldOut ? 'out' : stock <= 5 ? 'low' : 'in');

    // ---- gift wrap (fee from config)

    var giftInput = $('[data-pdp-gift-input]', root);
    var fee = Number(config.giftWrapFee) || 0;
    // A flat fee for the whole order, however many bottles are wrapped (pricing.js).
    $('[data-pdp-gift-fee]', root).textContent = fee ? '+ ' + pkr(fee) + ' per order' : '';

    // ---- add to bag and wishlist

    var addBtn = $('[data-pdp-add]', root);
    var barBtn = $('[data-bar-add]', bar);
    var wish = $('[data-pdp-wish]', root);
    wish.setAttribute('data-wish', p.id);
    wish.setAttribute('aria-label', 'Save ' + p.name + ' to wishlist');
    wish.setAttribute('aria-pressed', String(store.getWishlist().indexOf(p.id) >= 0));

    if (soldOut) {
      addBtn.disabled = true;
      addBtn.textContent = 'Sold out';
      barBtn.disabled = true;
      barBtn.textContent = 'Sold out';
      qtyInput.disabled = true;
      giftInput.disabled = true;
      $('[data-pdp-gift]', root).classList.add('is-disabled');
      var similar = $('[data-pdp-similar]', root);
      $('[data-pdp-similar-link]', similar).setAttribute('href', 'shop.html?families=' + encodeURIComponent(p.family));
      similar.hidden = false;
    }
    syncSteppers();

    // ---- inline notice (role=status) for stock limits

    var noticeEl = $('[data-pdp-notice]', root);
    function notify(text) {
      noticeEl.textContent = text || '';
      noticeEl.hidden = !text;
    }

    // What the bag already holds of this bottle at this size.
    function inBag(ml) {
      var held = 0;
      store.getCart().forEach(function (l) { if (l.productId === p.id && Number(l.ml) === ml) held += Number(l.qty) || 0; });
      return held;
    }

    function addToBag() {
      if (soldOut) return;
      setQty(qtyInput.value);
      var limit = Math.min(stock, MAX_QTY);
      var room = limit - inBag(state.ml);
      if (room <= 0) {
        notify('You already have all ' + limit + ' in your bag');
        return;
      }
      var add = Math.min(state.qty, room);
      store.addToCart(p.id, state.ml, add, giftInput.checked ? true : undefined);
      notify(add < state.qty ? 'Added ' + add + '. You now have all ' + limit + ' in your bag.' : '');
      Shop.ui.openCart();
    }

    $('[data-pdp-sizes]', root).addEventListener('change', function () { notify(''); });
    qtyInput.addEventListener('input', function () { notify(''); });
    dec.addEventListener('click', function () { notify(''); });
    inc.addEventListener('click', function () { notify(''); });

    $('[data-pdp-form]', root).addEventListener('submit', function (e) {
      e.preventDefault();
      addToBag();
    });
    barBtn.addEventListener('click', addToBag);

    // ---- trust block

    var threshold = Number(config.freeDeliveryThreshold) || 0;
    var feeNote = Number(config.deliveryFee) ? pkr(config.deliveryFee) + ' on smaller orders' : 'To every city in Pakistan';
    var trust = [
      ['cash', 'Cash on delivery', 'Pay when it reaches your door'],
      ['parcel', threshold ? 'Free delivery over ' + pkr(threshold) : 'Delivery across Pakistan', threshold ? feeNote : 'To every city in Pakistan'],
      ['returns', '7-day returns', 'On unopened, sealed bottles'],
      ['seal', 'Authentic, always', 'Sourced directly from the house']
    ];
    $('[data-pdp-trust]', root).innerHTML = trust.map(function (t) {
      return '<li class="pdp-trust__item">' + icon(t[0]) +
        '<p class="pdp-trust__text"><span class="pdp-trust__title">' + esc(t[1]) + '</span>' +
        '<span class="pdp-trust__note">' + esc(t[2]) + '</span></p></li>';
    }).join('');

    // ---- notes pyramid

    $('[data-pdp-notes-title]', root).textContent = 'How ' + p.name + ' unfolds';
    ['top', 'heart', 'base'].forEach(function (tier) {
      var list = $('[data-tier="' + tier + '"] [data-notes-list]', root);
      var notes = p.notes && Array.isArray(p.notes[tier]) ? p.notes[tier] : [];
      list.innerHTML = notes.map(function (n) { return '<li class="pdp-pyramid__note">' + esc(n) + '</li>'; }).join('');
    });

    // ---- description tab

    $('[data-pdp-description]', root).textContent = p.description;
    var sizeList = joinList(sizes.map(function (s) { return String(s.ml); }));
    var facts = [
      ['House', p.house],
      ['Scent family', FAMILY_NAME[p.family] || p.family],
      ['For', GENDER_NAME[p.gender] || p.gender],
      ['Sizes', sizeList ? sizeList + ' ml' : '']
    ];
    $('[data-pdp-facts]', root).innerHTML = facts.filter(function (f) { return f[1]; }).map(function (f) {
      return '<div class="pdp-facts__row"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
    }).join('');

    // ---- how to wear tab (derived from family, tags and notes)

    var guide = WEAR[p.family] || WEAR.fresh;
    var whens = (p.tags || []).filter(function (t) { return TAG_WHEN[t]; }).map(function (t) { return TAG_WHEN[t]; });
    var when = whens.length ? whens : [guide.when];
    var tiers = p.notes || {};
    var develops = tiers.top && tiers.heart && tiers.base
      ? 'It opens with ' + joinList(tiers.top) + ', settles into ' + joinList(tiers.heart) +
        ', and dries down to ' + joinList(tiers.base) + '. Give it ten minutes on skin before you judge it.'
      : 'Give it ten minutes on skin before you judge it; the character shows as it settles.';
    var wear = [
      ['Where to apply', guide.apply],
      ['When it shines', 'Best for ' + joinList(when) + '.'],
      ['How it develops', develops],
      ['Keeping it well', 'Store the bottle upright, capped and away from sunlight and heat. A drawer is kinder than a bathroom shelf or a parked car in summer.']
    ];
    $('[data-pdp-wear]', root).innerHTML = wear.map(function (w) {
      return '<div class="pdp-wear__row"><dt class="pdp-wear__term">' + esc(w[0]) + '</dt><dd class="pdp-wear__text">' + esc(w[1]) + '</dd></div>';
    }).join('');

    // ---- reviews

    var ratingLink = $('[data-pdp-rating]', root);
    var form = $('[data-review-form]', root);
    var rateField = $('[data-rate-field]', form);
    var rateHost = $('[data-rate]', form);
    var textArea = $('#rv-text', form);
    var countEl = $('[data-review-count]', form);
    var failEl = $('[data-review-fail]', form);
    var statusEl = $('[data-review-status]', root);
    var listEl = $('[data-review-list]', root);
    var emptyEl = $('[data-review-empty]', root);
    $('[data-review-empty-name]', root).textContent = p.name;

    var star = '<svg class="pdp-rate__icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">' +
      '<path d="M12 3.4 14.6 9l6 .6-4.5 4.1 1.3 6L12 16.6l-5.4 3.1 1.3-6L3.4 9.6l6-.6z"/></svg>';
    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<label class="pdp-rate__star"><input class="pdp-rate__input" type="radio" name="rating" value="' + i + '">' +
        star + '<span class="sr-only">' + i + ' ' + plural(i, 'star', 'stars') + ', ' + esc(RATE_WORDS[i].toLowerCase()) + '</span></label>';
    }
    rateHost.innerHTML = stars + '<span class="pdp-rate__word" data-rate-word aria-hidden="true"></span>';
    var rateWord = $('[data-rate-word]', rateHost);

    function summary() {
      var written = store.getReviews(p.id);
      var seeded = Math.max(0, Number(p.reviewCount) || 0);
      var total = seeded + written.length;
      var sum = (Number(p.rating) || 0) * seeded;
      written.forEach(function (r) { sum += Number(r.rating) || 0; });
      var avg = total ? Math.round(sum / total * 10) / 10 : 0;
      return { written: written, total: total, avg: avg };
    }

    function dateText(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return { iso: '', label: '' };
      var label;
      try { label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
      catch (e) { label = d.toDateString(); }
      return { iso: d.toISOString().slice(0, 10), label: label };
    }

    function reviewHtml(r, fresh) {
      var d = dateText(r.createdAt);
      return '<li class="pdp-review' + (fresh ? ' is-new' : '') + '">' +
        '<div class="pdp-review__head">' +
          '<p class="pdp-review__name">' + esc(r.name) + '</p>' +
          '<span class="star-rating pdp-review__stars">' + Shop.ui.stars(r.rating) + '</span>' +
          (d.iso ? '<time class="pdp-review__date" datetime="' + esc(d.iso) + '">' + esc(d.label) + '</time>' : '') +
        '</div>' +
        '<p class="pdp-review__text">' + esc(r.text) + '</p>' +
      '</li>';
    }

    function renderReviews(freshId) {
      var s = summary();
      listEl.innerHTML = s.written.map(function (r) { return reviewHtml(r, freshId && r.id === freshId); }).join('');
      emptyEl.hidden = s.written.length > 0;
      listEl.hidden = s.written.length === 0;

      var countText = s.total + ' ' + plural(s.total, 'review', 'reviews');
      ratingLink.innerHTML = Shop.ui.stars(s.avg) +
        '<span class="pdp-buy__rating-avg" aria-hidden="true">' + esc(s.avg.toFixed(1)) + '</span>' +
        '<span class="pdp-buy__rating-count">' + esc(countText) + '</span>';
      $('[data-review-tab-count]', root).textContent = '(' + s.total + ')';
      $('[data-review-avg]', root).textContent = s.avg.toFixed(1);
      $('[data-review-stars]', root).innerHTML = Shop.ui.stars(s.avg);
      $('[data-review-total]', root).textContent = 'Average of ' + s.total + ' ' + plural(s.total, 'rating', 'ratings') +
        (s.written.length ? ', ' + s.written.length + ' written here' : '');
      return s;
    }

    // The error text is only referenced while it is showing, so it is never read out early.
    function setRateError(on) {
      rateField.classList.toggle('is-invalid', on);
      if (on) {
        rateField.setAttribute('aria-invalid', 'true');
        rateField.setAttribute('aria-describedby', 'rv-rating-error');
      } else {
        rateField.removeAttribute('aria-invalid');
        rateField.removeAttribute('aria-describedby');
      }
    }

    function setTextError(on) {
      if (on) {
        textArea.setAttribute('aria-invalid', 'true');
        textArea.setAttribute('aria-describedby', 'rv-text-count rv-text-error');
      } else {
        textArea.removeAttribute('aria-invalid');
        textArea.setAttribute('aria-describedby', 'rv-text-count');
      }
    }

    function updateCount() {
      var n = textArea.value.length;
      countEl.textContent = n + ' of 600 characters';
    }

    rateHost.addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'rating') return;
      setRateError(false);
      rateWord.textContent = RATE_WORDS[Number(e.target.value)] || '';
    });
    textArea.addEventListener('input', function () {
      updateCount();
      if (textArea.getAttribute('aria-invalid') === 'true' && textArea.value.trim()) setTextError(false);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      failEl.textContent = '';
      var picked = $('input[name="rating"]:checked', form);
      var text = textArea.value.trim();
      setRateError(!picked);
      setTextError(!text);
      if (!picked || !text) {
        if (!picked) $('input[name="rating"]', form).focus();
        else textArea.focus();
        return;
      }
      var saved = store.addReview({ productId: p.id, name: $('#rv-name', form).value, rating: Number(picked.value), text: text });
      if (!saved) {
        failEl.textContent = 'Your review could not be saved. Check the rating and the text, then post it again.';
        return;
      }
      form.reset();
      rateWord.textContent = '';
      updateCount();
      renderReviews(saved.id);
      statusEl.textContent = 'Thank you. Your review is now at the top of the list.';
      statusEl.focus();
    });

    ratingLink.addEventListener('click', function (e) {
      e.preventDefault();
      var tab = doc.getElementById('pdp-tab-reviews');
      if (!tab) return;
      tab.click(); // ui.js delegation selects the tab and shows its panel
      var list = tab.closest('[role="tablist"]');
      var headerH = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 64;
      var top = list.getBoundingClientRect().top + window.pageYOffset - headerH - 16;
      window.scrollTo({ top: top, behavior: reducedMotion() ? 'auto' : 'smooth' });
      try { tab.focus({ preventScroll: true }); } catch (err) { tab.focus(); }
    });

    renderReviews();
    updateCount();
    if (store.onChange) store.onChange(function () { renderReviews(); });

    // ---- related products, topped up to four with the best rated

    var related = Shop.catalogue.relatedProducts(p, products, 4);
    byRating(products).forEach(function (q) {
      if (related.length < 4 && q.id !== p.id && related.indexOf(q) < 0) related.push(q);
    });
    renderCards($('[data-related]', root), related.slice(0, 4));

    // ---- JSON-LD (JSON.stringify escapes; "<" is escaped so no string can close the tag)

    function absolute(rel) {
      if (!rel) return '';
      try { return new URL(rel, config.siteUrl || 'https://example.com/').href; } catch (e) { return rel; }
    }

    var s0 = summary();
    var ld = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      description: p.description,
      image: absolute((p.images && p.images[0]) || (known ? Shop.media[slot].file : '')),
      sku: p.id,
      brand: { '@type': 'Organization', name: p.house },
      offers: {
        '@type': 'Offer',
        priceCurrency: config.currency || 'PKR',
        price: Number(initial.price),
        availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: absolute('product.html?id=' + encodeURIComponent(p.id))
      }
    };
    if (s0.total) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: s0.avg, reviewCount: s0.total, bestRating: 5, worstRating: 1 };
    var script = doc.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(ld).replace(/</g, '\\u003c');
    doc.head.appendChild(script);

    // ---- sticky purchase bar (below 900px, never for a sold-out bottle)

    var mq = window.matchMedia ? window.matchMedia(BAR_MQ) : null;
    var past = false;
    var barOn = false;
    var barTimer = null;

    function setBar(on) {
      if (on === barOn) return;
      barOn = on;
      clearTimeout(barTimer);
      doc.body.classList.toggle('has-bottom-bar', on);
      if (on) {
        bar.hidden = false;
        void bar.offsetWidth;
        bar.classList.add('is-in');
      } else {
        bar.classList.remove('is-in');
        if (bar.contains(doc.activeElement)) addBtn.focus({ preventScroll: true });
        barTimer = setTimeout(function () { if (!barOn) bar.hidden = true; }, reducedMotion() ? 0 : BAR_EXIT_MS);
      }
    }

    function updateBar() { setBar(!soldOut && past && !!(mq && mq.matches)); }

    // An IntersectionObserver alone misses a jump from "below the fold" straight
    // to "above it" (anchor links, restored scroll), because isIntersecting never
    // changes. One rect read per animation frame while scrolling is cheap and exact.
    var frame = 0;
    function measure() {
      frame = 0;
      if (!mq || !mq.matches) { past = false; updateBar(); return; }
      var headerH = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 64;
      past = addBtn.getBoundingClientRect().bottom < headerH;
      updateBar();
    }
    function schedule() { if (!frame) frame = window.requestAnimationFrame(measure); }

    if (!soldOut) {
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
      if (mq) {
        if (mq.addEventListener) mq.addEventListener('change', schedule);
        else if (mq.addListener) mq.addListener(schedule);
      }
      schedule();
    }

    fillIcons(root);
    root.hidden = false;
  }

  // ------------------------------------------------------------------ boot

  var found = findProduct();
  if (found) renderProduct(found);
  else renderNotFound();
})();
