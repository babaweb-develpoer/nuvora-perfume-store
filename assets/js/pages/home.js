/*
 * Home page: fills media slots, the trust strip, bestsellers, the house index
 * and the gift copy from config/products, and runs the newsletter form
 * (validates, then thanks the visitor; nothing is stored or sent).
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var config = Shop.config || {};
  var products = Shop.products || [];

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

  var FAMILY_LABEL = {
    oud: 'Oud and amber',
    woody: 'Woods and leather',
    floral: 'Florals',
    fresh: 'Citrus and sea air'
  };

  var HOUSE_STORY = {
    'Maison Noor': 'Aged oud, saffron and rose, composed in the tradition of the old attar houses.',
    'Velluto Nero': 'Leather, cedar and vetiver cut close and dark, like a tailored coat at midnight.',
    'Aurelle': 'Rose, jasmine and peony handled lightly, so the flowers stay luminous rather than sweet.',
    'Sahara Royale': 'Bergamot, sea salt and vetiver, made for Karachi summers and long drives north.'
  };

  var HOUSE_IMAGE = ['lifestyle-1', 'lifestyle-2', 'lifestyle-3', 'lifestyle-4'];

  // ------------------------------------------------------------------ media

  function fillMedia(root) {
    Array.prototype.forEach.call((root || doc).querySelectorAll('[data-media]'), function (host) {
      if (host.firstElementChild) return;
      host.innerHTML = Shop.ui.media(host.getAttribute('data-media'), {
        eager: host.hasAttribute('data-eager'),
        alt: '' // every home image is decorative: the surrounding text carries the meaning
      });
    });
    Array.prototype.forEach.call((root || doc).querySelectorAll('[data-icon]'), function (host) {
      if (!host.firstElementChild) host.innerHTML = icon(host.getAttribute('data-icon'));
    });
    // the hero clip pauses once scrolled away, and resumes on the way back
    if (Shop.ui.watchVideos) Shop.ui.watchVideos(root || doc);
  }

  // ------------------------------------------------------------------ trust

  function renderTrust() {
    var list = doc.querySelector('[data-trust]');
    if (!list) return;
    var threshold = Number(config.freeDeliveryThreshold) || 0;
    var items = [
      ['seal', '100% authentic', 'Sealed bottles only'],
      ['cash', 'Cash on delivery', 'Pay when it arrives'],
      ['returns', '7-day easy returns', 'Unopened, collected free'],
      ['parcel', 'Fast delivery nationwide', threshold ? 'Free over ' + pkr(threshold) : 'To every city and town']
    ];
    list.innerHTML = items.map(function (it) {
      return '<li class="home-trust__item">' + icon(it[0]) +
        '<p class="home-trust__text"><span class="home-trust__title">' + esc(it[1]) + '</span>' +
        '<span class="home-trust__note">' + esc(it[2]) + '</span></p></li>';
    }).join('');
  }

  // ------------------------------------------------------------ bestsellers

  function renderBestsellers() {
    var grid = doc.querySelector('[data-bestsellers]');
    if (!grid) return;
    var tagged = products.filter(function (p) { return p && p.tags && p.tags.indexOf('bestseller') >= 0; });
    var top = Shop.catalogue.sortProducts(tagged, 'featured').slice(0, 4);
    grid.innerHTML = top.map(function (p, i) {
      return '<div class="home-best__item reveal" style="--reveal-delay: ' + (i * 90) + 'ms">' +
        Shop.ui.productCard(p) + '</div>';
    }).join('');
  }

  // ----------------------------------------------------------------- houses

  function houseSummaries() {
    var order = [];
    var byHouse = {};
    products.forEach(function (p) {
      if (!p || !p.house) return;
      if (!byHouse[p.house]) { byHouse[p.house] = { name: p.house, count: 0, families: {} }; order.push(p.house); }
      var h = byHouse[p.house];
      h.count += 1;
      h.families[p.family] = (h.families[p.family] || 0) + 1;
    });
    return order.map(function (name) {
      var h = byHouse[name];
      var top = Object.keys(h.families).sort(function (a, b) { return h.families[b] - h.families[a]; })[0];
      h.family = FAMILY_LABEL[top] || top || '';
      return h;
    });
  }

  function renderHouses() {
    var list = doc.querySelector('[data-houses]');
    if (!list) return;
    list.innerHTML = houseSummaries().map(function (h, i) {
      var href = 'shop.html?houses=' + encodeURIComponent(h.name);
      var count = h.count + (h.count === 1 ? ' fragrance' : ' fragrances');
      return '<li class="home-house reveal" style="--reveal-delay: ' + (i * 80) + 'ms">' +
        '<div class="home-house__media" data-media="' + esc(HOUSE_IMAGE[i % HOUSE_IMAGE.length]) + '"></div>' +
        '<h3 class="home-house__name"><a class="home-house__link" href="' + esc(href) + '">' + esc(h.name) + '</a></h3>' +
        '<p class="home-house__family">' + esc(h.family) + '</p>' +
        '<p class="home-house__story">' + esc(HOUSE_STORY[h.name] || '') + '</p>' +
        '<p class="home-house__count">' + esc(count) + icon('arrow') + '</p>' +
      '</li>';
    }).join('');
    fillMedia(list);
  }

  // ------------------------------------------------------------------- gift

  function renderGift() {
    var lead = doc.querySelector('[data-gift-copy]');
    var codeEl = doc.querySelector('[data-gift-code]');
    var wrapFee = Number(config.giftWrapFee) || 0;
    var code = config.codes && config.codes.GIFT15;
    if (lead) {
      lead.textContent = 'Any bottle can travel in our black gift box, tied with a gold ribbon' +
        (wrapFee ? ', for ' + pkr(wrapFee) + '.' : '.');
    }
    if (codeEl && code && code.type === 'percent') {
      var min = Number(code.min) || 0;
      codeEl.innerHTML = 'Use <span class="home-gift__chip">GIFT15</span> for ' + esc(code.value) + '% off' +
        (min ? ' gift orders over ' + esc(pkr(min)) : ' your gift order') + '.';
      codeEl.hidden = false;
    }
  }

  // ------------------------------------------------------------- newsletter

  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function setInvalid(input, invalid) {
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'letter-error letter-hint');
    } else {
      input.removeAttribute('aria-invalid');
      input.setAttribute('aria-describedby', 'letter-hint');
    }
  }

  function isValidEmail(v) {
    return EMAIL.test(String(v || '').trim());
  }

  function initNewsletter() {
    var form = doc.querySelector('[data-letter-form]');
    var panel = doc.querySelector('[data-letter]');
    if (!form || !panel) return;
    var input = form.querySelector('input[type="email"]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!isValidEmail(input.value)) {
        setInvalid(input, true);
        input.focus();
        return;
      }
      panel.innerHTML =
        '<div class="home-letter__thanks" role="status" tabindex="-1">' +
          icon('check') +
          '<p class="home-letter__thanks-title">Thank you for signing up.</p>' +
          '<p class="home-letter__thanks-note">Nothing was sent or saved; this is a concept store.</p>' +
        '</div>';
      var thanks = panel.firstElementChild;
      try { thanks.focus({ preventScroll: true }); } catch (err) { thanks.focus(); }
    });

    // Once an error is showing, clear it as soon as the address is fixed.
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true' && isValidEmail(input.value)) setInvalid(input, false);
    });
    // Keep aria-invalid in step with the visual :user-invalid state after a blur.
    input.addEventListener('blur', function () {
      var v = input.value.trim();
      if (v && !isValidEmail(v)) setInvalid(input, true);
    });
  }

  // ------------------------------------------------------------------- boot

  function boot() {
    fillMedia(doc);
    renderTrust();
    renderBestsellers();
    renderHouses();
    renderGift();
    initNewsletter();
    Shop.ui.reveal();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
