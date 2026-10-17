/*
 * Shared UI shell: header, mobile menu, search overlay, cart drawer, toast,
 * floating chat link (WhatsApp when config.whatsapp is set, otherwise "Message us"
 * to contact.html), footer, media markup with placeholder fallback, scroll reveal,
 * product cards and star ratings. Classic script: window.Shop.ui.
 *
 * [data-concept-note] anywhere in a page gets config.conceptNotice as its text
 * (hidden when that is empty); Shop.ui.conceptNoteHtml() makes one for pages
 * that render their own markup.
 *
 * Auto-boot: on DOMContentLoaded, mountShell(document.body.dataset.nav) runs
 * (unless <body data-shell="off">), then reveal(). Pages only need data-nav.
 *
 * Document-level delegation (pages never wire these):
 *   [data-wish="<id>"]       toggles the wishlist, syncs aria-pressed + header count
 *   [data-quick-add="<id>"]  adds 50 ml x1 to the cart (up to min(stock, 20) in the
 *                            bag) and opens the drawer
 *   [data-open-cart]         opens the drawer
 *   .tabs [role=tab]         click / arrow-key tab switching (aria-controls panels)
 *   img[data-slot] / video   capture-phase error listener swaps in the .ph placeholder
 *
 * watchVideos(root): clips under root play only while on screen, one at a time
 * (never with reduced motion); call it after inserting media() clips.
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var Shop = window.Shop = window.Shop || {};
  var doc = document;

  var NAV = [
    { key: 'shop', label: 'Shop', href: 'shop.html' },
    { key: 'brands', label: 'Brands', href: 'brands.html' },
    { key: 'quiz', label: 'Find Your Scent', href: 'scent-quiz.html' },
    { key: 'about', label: 'About', href: 'about.html' },
    { key: 'contact', label: 'Contact', href: 'contact.html' }
  ];
  var NAV_ALIASES = { 'scent-quiz': 'quiz', 'find-your-scent': 'quiz' };
  var QUICK_ADD_ML = 50;
  var TOAST_MS = 3200;
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // ------------------------------------------------------------------ helpers

  function config() { return Shop.config || {}; }
  function store() { return Shop.store || null; }
  function products() { return Shop.products || []; }

  function esc(s) {
    if (Shop.util && Shop.util.escapeHtml) return Shop.util.escapeHtml(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pkr(n) {
    return Shop.util && Shop.util.formatPKR ? Shop.util.formatPKR(n) : 'PKR ' + n;
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function findProduct(id) {
    var list = products();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function lowestPrice(p) {
    var min = Infinity;
    (p && p.sizes || []).forEach(function (s) { if (typeof s.price === 'number' && s.price < min) min = s.price; });
    return isFinite(min) ? min : 0;
  }

  function hasTag(p, tag) { return !!(p && p.tags && p.tags.indexOf(tag) >= 0); }

  function wishlist() {
    var s = store();
    try { return s ? s.getWishlist() : []; } catch (e) { return []; }
  }

  function cartLines() {
    var s = store();
    try { return s ? s.getCart() : []; } catch (e) { return []; }
  }

  // Bottles the bag actually charges for: the clamped quantity of every line
  // with a price (unknown products and sold-out lines count for nothing), so
  // the header badge always agrees with the drawer and the cart page.
  function cartCount() {
    var lines = cartLines();
    if (!(Shop.pricing && Shop.pricing.cartTotals)) {
      return lines.reduce(function (n, l) { return n + (l.qty || 0); }, 0);
    }
    var t = Shop.pricing.cartTotals(lines, products(), config(), '');
    return t.lines.reduce(function (n, r) {
      return n + (r.lineTotal > 0 && r.unitPrice > 0 ? Math.round(r.lineTotal / r.unitPrice) : 0);
    }, 0);
  }

  // Most bottles of one product and size a bag line can hold: the stock, and never
  // more than the store's per-line cap (20). Same rule as the product page.
  var MAX_LINE_QTY = 20;
  function maxQty(p) { return Math.min(MAX_LINE_QTY, Math.max(0, Number(p && p.stock) || 0)); }

  function inBag(id, ml) {
    return cartLines().reduce(function (n, l) {
      return n + (l.productId === id && Number(l.ml) === ml ? (Number(l.qty) || 0) : 0);
    }, 0);
  }

  // Saved ids that still name a product in the catalogue.
  function wishCount() {
    return wishlist().filter(function (id) { return !!findProduct(id); }).length;
  }

  function formatPhone(w) {
    var d = String(w || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('92') === 0) return '+92 ' + d.slice(2, 5) + ' ' + d.slice(5);
    return d ? '+' + d : '';
  }

  function whatsappDigits() { return String(config().whatsapp || '').replace(/\D/g, ''); }

  // Only called when a WhatsApp number is configured (callers check whatsappDigits()).
  function whatsappHref(text) {
    var c = config();
    var msg = text || ('Hello ' + (c.shopName || '') + ', I would like some help choosing a fragrance.');
    return 'https://wa.me/' + whatsappDigits() + '?text=' + encodeURIComponent(msg);
  }

  // Where "Message us" goes when no WhatsApp number is configured.
  var CONTACT_HREF = 'contact.html';

  // The concept-store notice (config.conceptNotice): '' hides it everywhere.
  function conceptNotice() { return String(config().conceptNotice || '').trim(); }

  // A [data-concept-note] paragraph for pages that render their own markup.
  function conceptNoteHtml(cls) {
    var n = conceptNotice();
    return '<p class="concept-note' + (cls ? ' ' + esc(cls) : '') + '" data-concept-note' + (n ? '' : ' hidden') + '>' + esc(n) + '</p>';
  }

  // Fills every [data-concept-note] under root from config.conceptNotice, or hides it.
  function fillConceptNotes(root) {
    var n = conceptNotice();
    Array.prototype.forEach.call((root || doc).querySelectorAll('[data-concept-note]'), function (node) {
      if (n) { if (node.textContent !== n) node.textContent = n; node.hidden = false; }
      else node.hidden = true;
    });
  }

  // Dashboard and style guide, linked from the footer only while config.showcasePages
  // is true. tools/package.js keeps both pages in dist/ whenever that flag is true
  // (and it recognises this declaration, so a build without them does not fail on it).
  var SHOWCASE_PAGES = [['Dashboard', 'admin.html'], ['Style guide', 'styleguide.html']];

  function el(html) {
    var t = doc.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  // -------------------------------------------------------------------- icons

  var ICONS = {
    search: '<circle cx="10.5" cy="10.5" r="6.25"/><path d="m15.2 15.2 4.8 4.8"/>',
    heart: '<path d="M12 19.6s-7.4-4.5-7.4-10a4.1 4.1 0 0 1 7.4-2.5 4.1 4.1 0 0 1 7.4 2.5c0 5.5-7.4 10-7.4 10z"/>',
    bag: '<path d="M5.2 8.2h13.6l-1 11.6H6.2z"/><path d="M9 8.2V6.8a3 3 0 0 1 6 0v1.4"/>',
    menu: '<path d="M3.5 8.5h17M3.5 15.5h11"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    seal: '<circle cx="12" cy="9.5" r="5.75"/><path d="m9.6 9.6 1.7 1.7 3.2-3.3"/><path d="m8.6 14.3-1.4 6.2 4.8-2.4 4.8 2.4-1.4-6.2"/>',
    cash: '<rect x="3" y="6.5" width="18" height="11" rx="1"/><circle cx="12" cy="12" r="2.4"/><path d="M6.5 9.8v4.4M17.5 9.8v4.4"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1"/><path d="m4 6.5 8 6.4 8-6.4"/>',
    pin: '<path d="M12 20.8s-6.3-6-6.3-10.6a6.3 6.3 0 0 1 12.6 0c0 4.6-6.3 10.6-6.3 10.6z"/><circle cx="12" cy="10.1" r="2.2"/>',
    chat: '<path d="M4.4 19.6 5.6 16A7.9 7.9 0 1 1 8.5 18.7z"/><path d="M9.4 8.4c.3-.3.6-.3.9-.3h.3c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.5.6c.4.9 1.3 1.8 2.3 2.3l.6-.5c.2-.2.4-.2.6-.1l1.4.6c.2.1.4.3.4.5v.3c0 .3 0 .6-.3.9-.6.5-1.6.7-2.7.2-1.8-.8-3.2-2.2-4-4-.5-1.1-.3-2.1.2-2.7z"/>',
    gift: '<rect x="4" y="9.5" width="16" height="10.5" rx=".5"/><path d="M3 9.5h18M12 9.5V20M12 9.5C10.6 6.6 7 6 7 8c0 1.5 2.5 1.5 5 1.5zm0 0c1.4-2.9 5-3.5 5-1.5 0 1.5-2.5 1.5-5 1.5z"/>',
    star: '<path d="M12 3.4 14.6 9l6 .6-4.5 4.1 1.3 6L12 16.6l-5.4 3.1 1.3-6L3.4 9.6l6-.6z"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      ICONS[name] + '</svg>';
  }

  // Fine perfume-bottle outline used by placeholders and empty states.
  function bottleSvg(cls) {
    return '<svg class="' + cls + '" viewBox="0 0 48 76" width="48" height="76" fill="none" stroke="currentColor" ' +
      'stroke-width="1" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="17.5" y="2.5" width="13" height="11" rx="1"/>' +
      '<path d="M20.5 13.5v5h7v-5"/>' +
      '<path d="M14 18.5h20c3.6 0 6.5 2.9 6.5 6.5v42.5c0 2.8-2.2 5-5 5h-23c-2.8 0-5-2.2-5-5V25c0-3.6 2.9-6.5 6.5-6.5z"/>' +
      '<path d="M7.5 40.5h33" stroke-opacity=".45"/>' +
      '<rect x="16" y="49" width="16" height="12" stroke-opacity=".55"/>' +
      '<path d="M12 25v38" stroke-opacity=".3"/>' +
      '</svg>';
  }

  // -------------------------------------------------------------------- media

  function parseAspect(a) {
    var m = /^\s*([\d.]+)\s*[:/]\s*([\d.]+)\s*$/.exec(String(a || ''));
    var w = m ? parseFloat(m[1]) : 1;
    var h = m ? parseFloat(m[2]) : 1;
    if (!(w > 0) || !(h > 0)) { w = 1; h = 1; }
    return { w: w, h: h, css: w + ' / ' + h };
  }

  function placeholder(alt, announce) {
    var a11y = announce && alt ? ' role="img" aria-label="' + esc(alt) + '"' : ' aria-hidden="true"';
    return '<span class="ph"' + a11y + '>' + bottleSvg('ph__icon') +
      (alt ? '<span class="ph__label" aria-hidden="true">' + esc(alt) + '</span>' : '') + '</span>';
  }

  function media(slotId, opts) {
    opts = opts || {};
    var entry = Shop.media && Object.prototype.hasOwnProperty.call(Shop.media, slotId) ? Shop.media[slotId] : null;
    var alt = opts.alt != null ? String(opts.alt) : (entry ? entry.alt : '');
    var ratio = parseAspect(entry ? entry.aspect : (opts.aspect || '1:1'));
    var cls = 'media' + (opts.className ? ' ' + esc(opts.className) : '');
    var open = '<span class="' + cls + '" style="aspect-ratio: ' + ratio.css + '">';

    if (!entry) return open + placeholder(alt, true) + '</span>';

    var width = 1200;
    var height = Math.round(width * ratio.h / ratio.w);

    if (entry.kind === 'video') {
      var posterEntry = Shop.media['poster-' + slotId];
      var poster = posterEntry ? posterEntry.file : '';
      // play: 'inview' never autoplays: watchVideos() starts it once it is on screen
      // (and it only fetches its metadata until then). Default: autoplay (the hero).
      var inview = opts.play === 'inview';
      return open + placeholder(alt, false) +
        '<video data-slot="' + esc(slotId) + '" muted playsinline loop preload="metadata"' +
        (inview ? ' data-play="inview"' : (reducedMotion() ? '' : ' autoplay')) +
        (poster ? ' poster="' + esc(poster) + '"' : '') +
        ' width="' + width + '" height="' + height + '" aria-label="' + esc(alt) + '">' +
        '<source src="' + esc(entry.file) + '" type="video/mp4"></video></span>';
    }

    return open + placeholder(alt, false) +
      '<img data-slot="' + esc(slotId) + '" src="' + esc(entry.file) + '" alt="' + esc(alt) + '"' +
      ' width="' + width + '" height="' + height + '"' +
      ' loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async"' +
      (opts.eager ? ' fetchpriority="high"' : '') +
      (opts.sizes ? ' sizes="' + esc(opts.sizes) + '"' : '') + '></span>';
  }

  // Swap a failed <img data-slot> for its placeholder (no layout shift).
  function failImg(img) {
    if (!img || !img.parentNode) return;
    var alt = img.getAttribute('alt') || '';
    var wrap = img.parentNode.classList && img.parentNode.classList.contains('media') ? img.parentNode : null;
    if (!wrap) {
      // A bare <img data-slot> written in page HTML: wrap a placeholder of the same shape.
      var slot = img.getAttribute('data-slot');
      var entry = Shop.media && Shop.media[slot];
      var ratio = entry ? parseAspect(entry.aspect).css
        : (img.getAttribute('width') && img.getAttribute('height')
          ? img.getAttribute('width') + ' / ' + img.getAttribute('height') : '1 / 1');
      wrap = el('<span class="media' + (img.className ? ' ' + esc(img.className) : '') + '" style="aspect-ratio: ' +
        esc(ratio) + '">' + placeholder(alt, false) + '</span>');
      img.parentNode.replaceChild(wrap, img);
    } else {
      img.parentNode.removeChild(img);
    }
    var ph = wrap.querySelector('.ph');
    if (ph && alt) {
      ph.removeAttribute('aria-hidden');
      ph.setAttribute('role', 'img');
      ph.setAttribute('aria-label', alt);
    }
  }

  // Video failed: fall back to its poster image, which in turn falls back to .ph.
  function failVideo(video) {
    if (!video || video.getAttribute('data-failed') || !video.parentNode) return;
    video.setAttribute('data-failed', '1');
    var poster = video.getAttribute('poster');
    var slot = video.getAttribute('data-slot') || '';
    var alt = video.getAttribute('aria-label') || '';
    if (poster) {
      var img = doc.createElement('img');
      img.setAttribute('data-slot', 'poster-' + slot);
      img.setAttribute('alt', alt);
      // Keep the box (no layout shift) and stay lazy: posters never carry the LCP.
      if (video.getAttribute('width')) img.setAttribute('width', video.getAttribute('width'));
      if (video.getAttribute('height')) img.setAttribute('height', video.getAttribute('height'));
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.src = poster;
      video.parentNode.replaceChild(img, video);
    } else {
      var fake = doc.createElement('img');
      fake.setAttribute('alt', alt);
      video.parentNode.replaceChild(fake, video);
      failImg(fake);
    }
  }

  function onMediaError(e) {
    var t = e.target;
    if (!t || t.nodeType !== 1) return;
    var tag = t.tagName;
    if (tag === 'IMG' && t.hasAttribute('data-slot')) failImg(t);
    else if (tag === 'SOURCE' && t.parentNode && t.parentNode.tagName === 'VIDEO') {
      // Only give up when the last <source> has failed.
      var sources = t.parentNode.querySelectorAll('source');
      if (sources[sources.length - 1] === t) failVideo(t.parentNode);
    } else if (tag === 'VIDEO' && t.hasAttribute('data-slot')) failVideo(t);
  }

  // Media that failed before this script ran (static HTML above the scripts).
  function sweepFailedMedia(root) {
    var scope = root || doc;
    Array.prototype.forEach.call(scope.querySelectorAll('img[data-slot]'), function (img) {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) failImg(img);
    });
    Array.prototype.forEach.call(scope.querySelectorAll('video[data-slot]'), function (v) {
      if (v.networkState === 3 /* NETWORK_NO_SOURCE */) failVideo(v);
    });
  }

  // -------------------------------------------------------------- stars, card

  function stars(rating) {
    var r = Number(rating);
    if (!isFinite(r)) r = 0;
    r = Math.min(5, Math.max(0, Math.round(r * 10) / 10));
    var row = '';
    for (var i = 0; i < 5; i++) row += '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3.4 14.6 9l6 .6-4.5 4.1 1.3 6L12 16.6l-5.4 3.1 1.3-6L3.4 9.6l6-.6z"/></svg>';
    return '<span class="star-rating__stars" role="img" aria-label="' + r + ' out of 5" style="--fill: ' + (r / 5 * 100) + '%">' +
      '<span class="star-rating__row" aria-hidden="true">' + row + '</span>' +
      '<span class="star-rating__row star-rating__row--fill" aria-hidden="true">' + row + '</span></span>';
  }

  function productCard(p) {
    p = p || {};
    var id = String(p.id || '');
    var name = p.name || '';
    var stock = Number(p.stock);
    var soldOut = stock === 0;
    var badges = [];
    if (soldOut) badges.push('<span class="badge badge--sold">Sold out</span>');
    else if (stock >= 1 && stock <= 5) badges.push('<span class="badge badge--low">Low stock</span>');
    if (hasTag(p, 'new')) badges.push('<span class="badge badge--new">New</span>');
    if (hasTag(p, 'bestseller')) badges.push('<span class="badge badge--gold">Bestseller</span>');
    var wished = wishlist().indexOf(id) >= 0;
    var slot = 'product-' + id;
    var known = Shop.media && Object.prototype.hasOwnProperty.call(Shop.media, slot);
    var href = 'product.html?id=' + encodeURIComponent(id);
    var reviews = Number(p.reviewCount) || 0;

    return '<article class="product-card">' +
      '<div class="product-card__media">' +
        media(slot, known ? { className: 'product-card__image' } : { className: 'product-card__image', alt: name }) +
        (badges.length ? '<div class="product-card__badges">' + badges.join('') + '</div>' : '') +
        '<button type="button" class="product-card__wish" data-wish="' + esc(id) + '" aria-pressed="' + wished + '"' +
          ' aria-label="Add ' + esc(name) + ' to wishlist">' + icon('heart') + '</button>' +
        (soldOut
          ? '<button type="button" class="product-card__quick" data-quick-add="' + esc(id) + '" disabled>' +
              '<span class="product-card__quick-label">Sold out</span></button>'
          : '<button type="button" class="product-card__quick" data-quick-add="' + esc(id) + '"' +
              ' aria-label="Quick add ' + esc(name) + ', ' + QUICK_ADD_ML + ' ml">' + icon('plus') +
              '<span class="product-card__quick-label">Quick add</span></button>') +
      '</div>' +
      '<div class="product-card__body">' +
        '<p class="product-card__house">' + esc(p.house) + '</p>' +
        '<h3 class="product-card__name"><a class="product-card__link" href="' + esc(href) + '">' + esc(name) + '</a></h3>' +
        '<div class="product-card__meta">' +
          '<span class="price"><span class="price__from">From</span> ' + esc(pkr(lowestPrice(p))) + '</span>' +
          '<span class="star-rating">' + stars(p.rating) +
            '<span class="star-rating__count">' + reviews + '<span class="sr-only"> reviews</span></span></span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  // -------------------------------------------------------------------- toast

  var toastHost = null;

  function ensureToastHost() {
    toastHost = doc.querySelector('.toast-host');
    if (!toastHost) {
      toastHost = el('<div class="toast-host" role="status" aria-live="polite" aria-atomic="false"></div>');
      doc.body.appendChild(toastHost);
    }
    return toastHost;
  }

  // toast(message, { action: { label, onClick } }): the optional action is a real button
  // inside the live region. It never takes focus by itself, and the auto-dismiss timer
  // pauses while the pointer or keyboard focus is on the toast.
  function toast(message, opts) {
    if (!doc.body) return;
    var host = ensureToastHost();
    var action = opts && opts.action && opts.action.label ? opts.action : null;
    var t = el('<div class="toast' + (action ? ' toast--action' : '') + '">' + icon('check') + '<span class="toast__text"></span>' +
      (action ? '<button type="button" class="toast__action"></button>' : '') + '</div>');
    t.querySelector('.toast__text').textContent = String(message == null ? '' : message);
    var timer = null;
    // The element that had focus when the toast appeared (the control that caused it).
    var trigger = doc.activeElement;
    if (!trigger || trigger === doc.body || trigger === doc.documentElement || t.contains(trigger) || host.contains(trigger)) trigger = null;
    // If focus is still inside the toast when it goes away, hand it back to the trigger
    // (when still in the page), else to <main>. Focus that has already moved on is left alone.
    function restoreFocus() {
      if (!doc.activeElement || !t.contains(doc.activeElement)) return;
      var target = trigger && trigger.isConnected && doc.contains(trigger) ? trigger : (doc.getElementById('main') || doc.querySelector('main'));
      if (!target) { doc.activeElement.blur(); return; }
      if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
    function dismiss() {
      clearTimeout(timer);
      restoreFocus();
      t.classList.remove('is-in');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, reducedMotion() ? 0 : 450);
    }
    function arm() { clearTimeout(timer); timer = setTimeout(dismiss, TOAST_MS); }
    if (action) {
      var btn = t.querySelector('.toast__action');
      btn.textContent = String(action.label);
      btn.addEventListener('click', function () {
        // Run the action first: one that moves focus on purpose (View bag opens the
        // drawer) keeps it; otherwise dismiss() puts focus back where it came from.
        try { if (typeof action.onClick === 'function') action.onClick(); }
        finally { dismiss(); }
      });
      t.addEventListener('mouseenter', function () { clearTimeout(timer); });
      // Leaving with the pointer must not restart the countdown while the keyboard is still on the toast.
      t.addEventListener('mouseleave', function () { if (!t.contains(doc.activeElement)) arm(); });
      t.addEventListener('focusin', function () { clearTimeout(timer); });
      t.addEventListener('focusout', arm);
    }
    host.appendChild(t);
    while (host.children.length > 3) host.removeChild(host.firstElementChild);
    void t.offsetWidth;
    t.classList.add('is-in');
    arm();
  }

  // ----------------------------------------------------- modal layer manager

  var layer = null;       // { el, opener, onClose, inerted: [] }
  var closeTimers = new WeakMap();

  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (n) {
      return n.getClientRects().length > 0 && !n.closest('[inert]') && getComputedStyle(n).visibility !== 'hidden';
    });
  }

  function openLayer(node, opener, opts) {
    opts = opts || {};
    if (layer && layer.el === node) return;
    if (layer) closeLayer(true);
    var timer = closeTimers.get(node);
    if (timer) { clearTimeout(timer); closeTimers.delete(node); }

    var inerted = [];
    Array.prototype.forEach.call(doc.body.children, function (child) {
      if (child === node || child === toastHost || child.tagName === 'SCRIPT' || child.hasAttribute('inert')) return;
      child.setAttribute('inert', '');
      inerted.push(child);
    });

    layer = { el: node, opener: opener || doc.activeElement, onClose: opts.onClose, inerted: inerted };
    node.hidden = false;
    doc.documentElement.classList.add('is-locked');
    void node.offsetWidth;
    node.classList.add('is-open');
    var target = opts.focus || focusables(node)[0] || node;
    if (target === node && !node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
  }

  function closeLayer(silent) {
    if (!layer) return;
    var current = layer;
    layer = null;
    current.inerted.forEach(function (n) { n.removeAttribute('inert'); });
    doc.documentElement.classList.remove('is-locked');
    current.el.classList.remove('is-open');
    if (current.onClose) current.onClose();
    var node = current.el;
    var hide = function () { if (!node.classList.contains('is-open')) node.hidden = true; closeTimers.delete(node); };
    if (reducedMotion()) hide();
    else closeTimers.set(node, setTimeout(hide, 720));
    if (!silent && current.opener && doc.contains(current.opener) && typeof current.opener.focus === 'function') {
      try { current.opener.focus({ preventScroll: true }); } catch (e) { current.opener.focus(); }
    }
  }

  function onLayerKeydown(e) {
    if (!layer) return;
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      closeLayer(false);
      return;
    }
    if (e.key !== 'Tab') return;
    var items = focusables(layer.el);
    if (!items.length) { e.preventDefault(); return; }
    var first = items[0];
    var last = items[items.length - 1];
    var active = doc.activeElement;
    var inside = layer.el.contains(active);
    if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
  }

  // ------------------------------------------------------------- shell markup

  function navLinks(cls, withIcon) {
    return NAV.map(function (n, i) {
      return '<li><a class="' + cls + '" href="' + n.href + '" data-nav-key="' + n.key + '" style="--i: ' + i + '">' +
        esc(n.label) + (withIcon ? icon('arrow') : '') + '</a></li>';
    }).join('');
  }

  function headerHtml() {
    var c = config();
    return '<header class="site-header" id="site-header">' +
      '<div class="site-header__inner container">' +
        '<button type="button" class="icon-btn site-header__menu-btn" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu">' +
          icon('menu') + '</button>' +
        '<a class="wordmark site-header__brand" href="index.html">' + esc(c.shopName || '') + '</a>' +
        '<nav class="site-nav" aria-label="Primary"><ul class="site-nav__list">' + navLinks('site-nav__link', false) + '</ul></nav>' +
        '<div class="site-header__actions">' +
          '<button type="button" class="icon-btn site-header__search" aria-expanded="false" aria-controls="search-overlay" aria-label="Search">' +
            icon('search') + '</button>' +
          '<a class="icon-btn site-header__wishlist" href="wishlist.html" aria-label="Wishlist">' + icon('heart') +
            '<span class="count-badge" data-wish-count data-count="0" aria-hidden="true">0</span></a>' +
          '<button type="button" class="icon-btn site-header__cart" aria-expanded="false" aria-controls="cart-drawer" aria-label="Bag, 0 items">' +
            icon('bag') + '<span class="count-badge" data-cart-count data-count="0" aria-hidden="true">0</span></button>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  // The optional notice strip (config.demoBanner): the concept notice on one line.
  // "Concept store: orders and ..." shows as a gold lead plus the rest; phones keep
  // only the rest ("Orders and messages are not delivered."), which fits at 320px.
  function bannerHtml() {
    var n = conceptNotice();
    var cut = n.indexOf(':');
    var lead = cut > 0 ? n.slice(0, cut) : '';
    var rest = cut > 0 ? n.slice(cut + 1).trim() : n;
    rest = rest.charAt(0).toUpperCase() + rest.slice(1);
    return '<div class="demo-banner" id="demo-banner">' +
      (lead ? '<strong class="demo-banner__more">' + esc(lead) + '.</strong> ' : '') +
      '<span>' + esc(rest) + '</span></div>';
  }

  // The concierge entry in the menu and footer: WhatsApp when a number is set,
  // otherwise a plain "Message us" link to the contact page.
  function chatLinkHtml(withNumber) {
    var c = config();
    if (whatsappDigits()) {
      return '<a href="' + esc(whatsappHref()) + '" target="_blank" rel="noopener">' +
        (withNumber ? 'WhatsApp ' : '') + esc(formatPhone(c.whatsapp)) + '</a>';
    }
    return '<a href="' + CONTACT_HREF + '">Message us</a>';
  }

  function menuHtml() {
    var c = config();
    return '<div class="menu-panel" id="site-menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>' +
      '<div class="menu-panel__top container">' +
        '<a class="wordmark" href="index.html">' + esc(c.shopName || '') + '</a>' +
        '<button type="button" class="icon-btn" data-close-layer aria-label="Close menu">' + icon('close') + '</button>' +
      '</div>' +
      '<nav class="menu-panel__nav container" aria-label="Mobile"><ul>' + navLinks('menu-panel__link', true) + '</ul></nav>' +
      '<div class="menu-panel__extra container">' +
        '<div class="menu-panel__links">' +
          '<a href="wishlist.html">Wishlist</a><a href="cart.html">Bag</a><a href="track-order.html">Track order</a>' +
          '<a href="faq.html">FAQ</a><a href="shipping-returns.html">Shipping &amp; returns</a>' +
        '</div>' +
        '<div class="menu-panel__contact">' +
          '<span class="label">Concierge</span>' +
          chatLinkHtml(true) +
          (c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '') +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var SUGGESTIONS = ['Oud', 'Rose', 'Leather', 'Vetiver', 'Citrus', 'Amber'];

  function searchHtml() {
    return '<div class="search-overlay" id="search-overlay" role="dialog" aria-modal="true" aria-labelledby="search-title" hidden>' +
      '<div class="search-overlay__scrim" data-close-layer></div>' +
      '<div class="search-overlay__panel"><div class="container">' +
        '<div class="search-overlay__head">' +
          '<p class="eyebrow" id="search-title">Search the collection</p>' +
          '<button type="button" class="icon-btn" data-close-layer aria-label="Close search">' + icon('close') + '</button>' +
        '</div>' +
        '<form class="search-form" role="search" action="shop.html" method="get">' +
          '<label class="sr-only" for="search-q">Search fragrances, houses and notes</label>' +
          '<input class="search-form__input" id="search-q" type="search" name="q" maxlength="120" placeholder="Oud, rose, a house..." autocomplete="off" enterkeyhint="search">' +
          '<button type="submit" class="icon-btn" aria-label="Search">' + icon('arrow') + '</button>' +
        '</form>' +
        '<div class="search-overlay__suggest"><span class="label">Popular</span>' +
          SUGGESTIONS.map(function (s) {
            return '<a class="chip" href="shop.html?q=' + encodeURIComponent(s.toLowerCase()) + '">' + esc(s) + '</a>';
          }).join('') +
        '</div>' +
      '</div></div>' +
    '</div>';
  }

  function drawerHtml() {
    return '<div class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" hidden>' +
      '<div class="drawer__scrim" data-close-layer></div>' +
      '<div class="drawer__panel">' +
        '<div class="drawer__head">' +
          '<h2 class="drawer__title" id="cart-drawer-title">Your bag<span class="drawer__title-count" data-drawer-count></span></h2>' +
          '<button type="button" class="icon-btn" data-close-layer aria-label="Close bag">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="drawer__content" data-drawer-content></div>' +
        // One stable polite region (renderCart replaces the content above).
        '<p class="sr-only" data-drawer-live aria-live="polite" aria-atomic="true"></p>' +
      '</div>' +
    '</div>';
  }

  function footerHtml() {
    var c = config();
    var year = new Date().getFullYear();
    function links(list) {
      return '<ul class="site-footer__links">' + list.map(function (l) {
        return '<li><a href="' + l[1] + '">' + esc(l[0]) + '</a></li>';
      }).join('') + '</ul>';
    }
    return '<footer class="site-footer" id="site-footer">' +
      '<div class="container">' +
        '<div class="site-footer__top">' +
          '<div class="site-footer__brand">' +
            '<a class="wordmark" href="index.html">' + esc(c.shopName || '') + '</a>' +
            '<p class="site-footer__blurb">' + esc(c.tagline || '') + ' Original fragrances from independent houses, sealed and delivered across Pakistan.</p>' +
            '<div class="site-footer__promise">' + icon('seal') +
              '<p class="site-footer__promise-title">Authenticity promise</p>' +
              '<p>Every bottle is sealed and sourced directly from the house. If it is not genuine, we refund you in full.</p>' +
            '</div>' +
          '</div>' +
          '<div class="site-footer__col"><h2 class="site-footer__heading">Shop</h2>' + links([
            ['All fragrances', 'shop.html'], ['For him', 'shop.html?genders=men'], ['For her', 'shop.html?genders=women'],
            ['Unisex', 'shop.html?genders=unisex'], ['Brands', 'brands.html'], ['Find your scent', 'scent-quiz.html']
          ]) + '</div>' +
          '<div class="site-footer__col"><h2 class="site-footer__heading">Help</h2>' + links([
            ['FAQ', 'faq.html'], ['Shipping & returns', 'shipping-returns.html'], ['Contact', 'contact.html'], ['Track order', 'track-order.html']
          ]) + '</div>' +
          '<div class="site-footer__col"><h2 class="site-footer__heading">Company</h2>' + links([
            ['About', 'about.html'], ['Fragrance guide', 'fragrance-guide.html']
          ]) + '</div>' +
          '<div class="site-footer__col site-footer__contact"><h2 class="site-footer__heading">Visit and contact</h2>' +
            '<ul class="site-footer__links">' +
              (c.address ? '<li>' + icon('pin') + '<span>' + esc(c.address) + '</span></li>' : '') +
              '<li>' + icon('chat') + chatLinkHtml(false) + '</li>' +
              (c.email ? '<li>' + icon('mail') + '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></li>' : '') +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="site-footer__bottom">' +
          '<span class="site-footer__cod">' + icon('cash') + 'Cash on delivery across Pakistan</span>' +
          (c.showcasePages
            ? '<p class="site-footer__showcase"><span class="site-footer__showcase-label">Behind the build</span>' +
                SHOWCASE_PAGES.map(function (s) { return '<a href="' + s[1] + '">' + esc(s[0]) + '</a>'; }).join('') + '</p>'
            : '') +
          '<p class="site-footer__copy">&copy; ' + year + ' ' + esc(c.shopName || '') + '.' +
            (conceptNotice() ? ' <span class="site-footer__notice">' + esc(conceptNotice()) + '</span>' : '') +
            creditHtml() + '</p>' +
        '</div>' +
      '</div>' +
    '</footer>';
  }

  // "Designed and built by <name>." from config.credit; '' while no name is set.
  function creditHtml() {
    var cr = config().credit || {};
    var name = String(cr.name || '').trim();
    if (!name) return '';
    var url = String(cr.url || '').trim();
    var safe = /^https?:\/\//i.test(url) ? url : '';
    return ' <span class="site-footer__credit">Designed and built by ' +
      (safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>' : esc(name)) + '.</span>';
  }

  // The floating button: WhatsApp when a number is set, otherwise "Message us" to the
  // contact page (same look, same tuck-away behaviour).
  function whatsappFloatHtml() {
    if (whatsappDigits()) {
      return '<a class="whatsapp-float" href="' + esc(whatsappHref()) + '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">' +
        icon('chat') + '</a>';
    }
    return '<a class="whatsapp-float" href="' + CONTACT_HREF + '" aria-label="Message us">' + icon('chat') + '</a>';
  }

  // ------------------------------------------------------ whatsapp: tuck away
  // The floating button keeps its corner but steps aside (fades out, stops
  // taking taps) whenever any control would sit under it: a buy button, a
  // form field, a quiz answer, a sticky bar. It comes back once they scroll
  // away. One geometry pass per animation frame, only after scroll, resize,
  // DOM changes or finished transitions.

  var FAB_AVOID = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, label, ' +
    '[role="button"], [tabindex]:not([tabindex="-1"]), [data-fab-avoid]';
  var FAB_GAP = 8;
  var fabQueued = false;
  var fabWired = false;

  function fabCovers(fab) {
    var f = fab.getBoundingClientRect();
    if (!f.width || !f.height) return false;
    var nodes = doc.querySelectorAll(FAB_AVOID);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n === fab || fab.contains(n)) continue;
      var r = n.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue; // visually hidden
      if (r.right <= f.left - FAB_GAP || r.left >= f.right + FAB_GAP ||
          r.bottom <= f.top - FAB_GAP || r.top >= f.bottom + FAB_GAP) continue;
      if (n.closest('[hidden], [inert]')) continue;
      var cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
      return true;
    }
    return false;
  }

  function updateFab() {
    fabQueued = false;
    var fab = doc.querySelector('.whatsapp-float');
    if (!fab) return;
    var tuck = fabCovers(fab);
    // visibility: hidden (CSS) also takes the tucked button out of the tab order.
    if (fab.classList.contains('is-tucked') !== tuck) fab.classList.toggle('is-tucked', tuck);
  }

  function queueFab() {
    if (fabQueued) return;
    fabQueued = true;
    (window.requestAnimationFrame || setTimeout)(updateFab);
  }

  function watchFab() {
    if (fabWired) { queueFab(); return; }
    fabWired = true;
    window.addEventListener('scroll', queueFab, { passive: true });
    window.addEventListener('resize', queueFab);
    doc.addEventListener('transitionend', queueFab, true);
    doc.addEventListener('toggle', queueFab, true); // <details> opening
    window.addEventListener('load', queueFab);
    if ('MutationObserver' in window) {
      new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var t = records[i].target;
          if (!(t.classList && t.classList.contains('whatsapp-float'))) { queueFab(); return; }
        }
      }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'open'] });
    }
    queueFab();
  }

  // --------------------------------------------------------------- cart drawer

  function focusKeyOf(node) { return node && node.getAttribute ? node.getAttribute('data-focus-key') : null; }

  function cartLineHtml(row) {
    var p = row.product;
    var line = row.line;
    var key = esc(p.id) + ':' + line.ml;
    var href = esc('product.html?id=' + encodeURIComponent(p.id));
    var soldOut = row.lineTotal === 0 && Number(p.stock) < 1;
    var qty = soldOut ? line.qty : Math.min(line.qty, Number(p.stock) || line.qty);
    var max = Math.min(20, Number(p.stock) || 0);
    var label = esc(p.name) + ', ' + line.ml + ' ml';
    return '<li class="cart-line" data-id="' + esc(p.id) + '" data-ml="' + line.ml + '">' +
      '<a class="cart-line__media" href="' + href + '" tabindex="-1" aria-hidden="true">' +
        media('product-' + p.id, { className: 'cart-line__image' }) + '</a>' +
      '<div class="cart-line__body">' +
        '<div class="cart-line__top">' +
          '<div>' +
            '<p class="cart-line__house">' + esc(p.house) + '</p>' +
            '<h3 class="cart-line__name"><a href="' + href + '">' + esc(p.name) + '</a></h3>' +
            '<p class="cart-line__size">' + line.ml + ' ml</p>' +
          '</div>' +
          '<p class="price cart-line__price">' + esc(pkr(soldOut ? row.unitPrice : row.lineTotal)) +
            (qty > 1 && !soldOut ? '<span class="cart-line__each">' + esc(pkr(row.unitPrice)) + ' each</span>' : '') + '</p>' +
        '</div>' +
        (soldOut ? '<p class="cart-line__soldout">Sold out. Remove it to continue.</p>' : '') +
        '<div class="cart-line__controls">' +
          (soldOut ? '' :
          '<div class="qty-stepper" role="group" aria-label="Quantity for ' + label + '">' +
            '<button type="button" class="qty-stepper__btn" data-line-action="dec" data-focus-key="dec:' + key + '" aria-label="Decrease quantity"' + (qty <= 1 ? ' disabled' : '') + '>' + icon('minus') + '</button>' +
            '<span class="qty-stepper__value">' + qty + '</span>' +
            '<button type="button" class="qty-stepper__btn" data-line-action="inc" data-focus-key="inc:' + key + '" aria-label="Increase quantity"' + (qty >= max ? ' disabled' : '') + '>' + icon('plus') + '</button>' +
          '</div>') +
          '<button type="button" class="cart-line__remove" data-line-action="remove" data-focus-key="remove:' + key + '" aria-label="Remove ' + label + '">Remove</button>' +
        '</div>' +
        (soldOut ? '' :
        '<label class="check cart-line__gift"><input type="checkbox" data-line-action="gift" data-focus-key="gift:' + key + '"' +
          (line.gift ? ' checked' : '') + '><span>Gift wrap this bottle</span></label>') +
      '</div>' +
    '</li>';
  }

  function renderCart() {
    var drawer = doc.getElementById('cart-drawer');
    if (!drawer) return;
    var content = drawer.querySelector('[data-drawer-content]');
    var countEl = drawer.querySelector('[data-drawer-count]');
    var c = config();
    var s = store();
    var lines = cartLines();
    var totals = Shop.pricing && Shop.pricing.cartTotals
      ? Shop.pricing.cartTotals(lines, products(), c, s ? s.getCode() : '')
      : { lines: [], subtotal: 0 };

    var activeKey = drawer.contains(doc.activeElement) ? focusKeyOf(doc.activeElement) : null;
    var count = cartCount();
    countEl.textContent = count ? '(' + count + ')' : '';

    if (!totals.lines.length) {
      content.innerHTML = '<div class="drawer__empty">' + bottleSvg('ph-bottle') +
        '<p class="drawer__empty-title">Your bag is empty</p>' +
        '<p>Explore oud, leather, florals and fresh citrus from four independent houses.</p>' +
        '<a class="btn btn--primary" href="shop.html">Shop the collection</a></div>';
    } else {
      var threshold = Number(c.freeDeliveryThreshold) || 0;
      var sub = totals.subtotal;
      var pct = threshold ? Math.min(100, Math.round(sub / threshold * 100)) : 100;
      var notice = sub >= threshold
        ? icon('check') + '<span>You&#39;ve unlocked free delivery</span>'
        : '<span>Add <strong>' + esc(pkr(threshold - sub)) + '</strong> more for free delivery</span>';
      content.innerHTML =
        '<div class="drawer__notice">' +
          '<p class="drawer__notice-text">' + notice + '</p>' +
          '<div class="progress-bar" role="progressbar" aria-label="Progress to free delivery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
            '<span class="progress-bar__fill" style="--progress-ratio: ' + (pct / 100) + '"></span></div>' +
        '</div>' +
        '<ul class="drawer__body" aria-label="Items in your bag">' + totals.lines.map(cartLineHtml).join('') + '</ul>' +
        '<div class="drawer__foot">' +
          '<div class="drawer__row"><span class="label">Subtotal</span><span class="drawer__subtotal">' + esc(pkr(sub)) + '</span></div>' +
          '<p class="drawer__note">Delivery, gift wrap and discount codes are calculated at checkout. Pay cash on delivery.</p>' +
          '<div class="drawer__actions">' +
            '<a class="btn btn--ghost" href="cart.html">View cart</a>' +
            '<a class="btn btn--primary" href="checkout.html">Checkout</a>' +
          '</div>' +
        '</div>';
    }

    if (activeKey) {
      var again = content.querySelector('[data-focus-key="' + activeKey + '"]');
      if (again && !again.disabled) again.focus({ preventScroll: true });
      else {
        var fallback = focusables(drawer)[0];
        if (fallback) fallback.focus({ preventScroll: true });
      }
    }
  }

  function onDrawerClick(e) {
    var btn = e.target.closest('[data-line-action]');
    if (!btn || btn.type === 'checkbox') return;
    var li = btn.closest('.cart-line');
    var s = store();
    if (!li || !s) return;
    var id = li.getAttribute('data-id');
    var ml = Number(li.getAttribute('data-ml'));
    var line = cartLines().filter(function (l) { return l.productId === id && l.ml === ml; })[0];
    if (!line) return;
    var action = btn.getAttribute('data-line-action');
    if (action === 'inc' || action === 'dec') {
      var prod = findProduct(id);
      // Step from the quantity the drawer shows (clamped to stock and the line cap),
      // not from a stored quantity above stock, so one press always changes the number.
      var limit = maxQty(prod);
      var shown = limit > 0 ? Math.min(line.qty, limit) : line.qty;
      var next = action === 'inc' ? Math.min(shown + 1, limit || shown + 1) : Math.max(1, shown - 1);
      if (next !== line.qty) s.updateQty(id, ml, next);
      var after = cartLines().filter(function (l) { return l.productId === id && l.ml === ml; })[0];
      if (after && prod && Math.min(after.qty, limit || after.qty) !== shown) announceDrawer('Quantity of ' + prod.name + ' is now ' + after.qty);
    } else if (action === 'remove') {
      s.removeLine(id, ml);
      var p = findProduct(id);
      toast((p ? p.name : 'Item') + ' removed from your bag');
    }
  }

  function announceDrawer(text) {
    var live = doc.querySelector('#cart-drawer [data-drawer-live]');
    if (live) live.textContent = text;
  }

  function onDrawerChange(e) {
    var box = e.target;
    if (!box || box.getAttribute('data-line-action') !== 'gift') return;
    var li = box.closest('.cart-line');
    var s = store();
    if (li && s) s.setGift(li.getAttribute('data-id'), Number(li.getAttribute('data-ml')), box.checked);
  }

  function setExpanded(selector, value) {
    var b = doc.querySelector(selector);
    if (b) b.setAttribute('aria-expanded', String(value));
  }

  function openCartFrom(opener) {
    var drawer = doc.getElementById('cart-drawer');
    if (!drawer) { mountShell(currentNav); drawer = doc.getElementById('cart-drawer'); }
    renderCart();
    setExpanded('.site-header__cart', true);
    openLayer(drawer, opener, {
      focus: drawer.querySelector('.drawer__head [data-close-layer]'),
      onClose: function () { setExpanded('.site-header__cart', false); }
    });
  }

  function openCart() { openCartFrom(doc.activeElement); }

  function closeCart() {
    if (layer && layer.el.id === 'cart-drawer') closeLayer(false);
  }

  function openMenu(opener) {
    var panel = doc.getElementById('site-menu');
    if (!panel) return;
    var btn = doc.querySelector('.site-header__menu-btn');
    if (btn) { btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'Close menu'); }
    openLayer(panel, opener || btn, {
      focus: panel.querySelector('.menu-panel__link'),
      onClose: function () {
        if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); }
      }
    });
  }

  function openSearch(opener) {
    var overlay = doc.getElementById('search-overlay');
    if (!overlay) return;
    setExpanded('.site-header__search', true);
    openLayer(overlay, opener, {
      focus: overlay.querySelector('input[type="search"]'),
      onClose: function () { setExpanded('.site-header__search', false); }
    });
  }

  // --------------------------------------------------------- counts and state

  function updateCounts() {
    var n = cartCount();
    var w = wishCount();
    var cartBadge = doc.querySelector('[data-cart-count]');
    var wishBadge = doc.querySelector('[data-wish-count]');
    if (cartBadge) {
      cartBadge.textContent = String(n);
      cartBadge.setAttribute('data-count', String(n));
      var cartBtn = cartBadge.closest('button, a');
      if (cartBtn) cartBtn.setAttribute('aria-label', 'Bag, ' + n + (n === 1 ? ' item' : ' items'));
    }
    if (wishBadge) {
      wishBadge.textContent = String(w);
      wishBadge.setAttribute('data-count', String(w));
      var wishLink = wishBadge.closest('a, button');
      if (wishLink) wishLink.setAttribute('aria-label', 'Wishlist, ' + w + (w === 1 ? ' item' : ' items'));
    }
  }

  function syncWishButtons() {
    var list = wishlist();
    Array.prototype.forEach.call(doc.querySelectorAll('[data-wish]'), function (b) {
      b.setAttribute('aria-pressed', String(list.indexOf(b.getAttribute('data-wish')) >= 0));
    });
  }

  function onStoreChange() {
    updateCounts();
    syncWishButtons();
    renderCart();
  }

  function setActiveNav(key) {
    var k = NAV_ALIASES[key] || key || '';
    Array.prototype.forEach.call(doc.querySelectorAll('[data-nav-key]'), function (a) {
      if (k && a.getAttribute('data-nav-key') === k) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // -------------------------------------------------------------- delegation

  function onDocClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;

    var wish = t.closest('[data-wish]');
    if (wish) {
      e.preventDefault();
      var s = store();
      if (!s) return;
      var now = s.toggleWishlist(wish.getAttribute('data-wish'));
      syncWishButtons();
      updateCounts();
      toast(now ? 'Added to wishlist' : 'Removed from wishlist');
      return;
    }

    var quick = t.closest('[data-quick-add]');
    if (quick) {
      e.preventDefault();
      if (quick.disabled || !store()) return;
      var qid = quick.getAttribute('data-quick-add');
      var qp = findProduct(qid);
      // Never more than min(stock, 20) of this bottle in the bag, counting what is there.
      var qlimit = qp ? maxQty(qp) : MAX_LINE_QTY;
      if (inBag(qid, QUICK_ADD_ML) < qlimit) store().addToCart(qid, QUICK_ADD_ML, 1, false);
      else toast('You already have all ' + qlimit + ' in your bag');
      openCartFrom(quick);
      return;
    }

    if (t.closest('[data-open-cart], .site-header__cart')) {
      e.preventDefault();
      openCartFrom(t.closest('[data-open-cart], .site-header__cart'));
      return;
    }
    if (t.closest('.site-header__menu-btn')) { openMenu(t.closest('.site-header__menu-btn')); return; }
    if (t.closest('.site-header__search')) { openSearch(t.closest('.site-header__search')); return; }

    if (layer && t.closest('[data-close-layer]') && layer.el.contains(t)) { closeLayer(false); return; }

    // Following a link inside the mobile menu: close it (same-page anchors stay usable).
    if (layer && layer.el.id === 'site-menu' && t.closest('a[href]')) closeLayer(true);

    var tab = t.closest('.tabs [role="tab"]');
    if (tab) selectTab(tab, false);
  }

  function onSearchSubmit(e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains('search-form')) return;
    e.preventDefault();
    var input = form.querySelector('input[type="search"]');
    var q = input ? input.value.trim().slice(0, 120) : '';
    if (!q) { if (input) input.focus(); return; }
    window.location.href = 'shop.html?q=' + encodeURIComponent(q);
  }

  // Tabs: roving tabindex, aria-selected, panels via aria-controls.
  function selectTab(tab, focus) {
    var list = tab.closest('[role="tablist"]');
    if (!list) return;
    Array.prototype.forEach.call(list.querySelectorAll('[role="tab"]'), function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('tabindex', on ? '0' : '-1');
      var panel = doc.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (focus) tab.focus();
  }

  function onTabKeydown(e) {
    var tab = e.target && e.target.closest && e.target.closest('.tabs [role="tab"]');
    if (!tab) return;
    var tabs = Array.prototype.slice.call(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab);
    var next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); selectTab(next, true); }
  }

  // ------------------------------------------------------------- header state

  var scrollObserver = null;

  function watchScroll(header) {
    var sentinel = doc.querySelector('.scroll-sentinel');
    if (!sentinel) {
      sentinel = el('<div class="scroll-sentinel" aria-hidden="true" style="position:absolute;top:0;left:0;width:1px;height:24px;pointer-events:none"></div>');
      doc.body.insertBefore(sentinel, doc.body.firstChild);
    }
    if ('IntersectionObserver' in window) {
      if (scrollObserver) scrollObserver.disconnect();
      scrollObserver = new IntersectionObserver(function (entries) {
        header.classList.toggle('is-scrolled', !entries[0].isIntersecting);
      });
      scrollObserver.observe(sentinel);
    } else {
      var update = function () { header.classList.toggle('is-scrolled', window.pageYOffset > 24); };
      window.addEventListener('scroll', update, { passive: true });
      update();
    }
  }

  // --------------------------------------------------------------- mountShell

  var currentNav = '';
  var wired = false;

  function mountShell(activeNav) {
    var body = doc.body;
    if (!body) return;
    currentNav = activeNav || '';
    var c = config();

    var skip = body.querySelector('.skip-link');
    if (!skip) {
      skip = el('<a class="skip-link" href="#main">Skip to content</a>');
      body.insertBefore(skip, body.firstChild);
    }

    var header = doc.getElementById('site-header');
    if (!header) {
      header = el(headerHtml());
      body.insertBefore(header, skip.nextSibling);
      if (c.demoBanner && !doc.getElementById('demo-banner')) body.insertBefore(el(bannerHtml()), header);
      // Swaps the CSS reservation (body:not(.shell-ready)::before) for the real header and
      // banner right away, so a later throw in this function cannot leave a double gap.
      body.classList.add('shell-ready');
      watchScroll(header);
    }

    var main = doc.getElementById('main') || doc.querySelector('main');
    if (!doc.getElementById('site-footer')) {
      var footer = el(footerHtml());
      if (main && main.parentNode === body) body.insertBefore(footer, main.nextSibling);
      else body.appendChild(footer);
    }

    if (!doc.getElementById('site-menu')) body.appendChild(el(menuHtml()));
    if (!doc.getElementById('search-overlay')) body.appendChild(el(searchHtml()));
    if (!doc.getElementById('cart-drawer')) {
      var drawer = el(drawerHtml());
      body.appendChild(drawer);
      drawer.addEventListener('click', onDrawerClick);
      drawer.addEventListener('change', onDrawerChange);
    }
    if (!doc.querySelector('.whatsapp-float')) body.appendChild(el(whatsappFloatHtml()));
    watchFab();
    ensureToastHost();

    if (!wired) {
      wired = true;
      doc.addEventListener('click', onDocClick);
      doc.addEventListener('keydown', onLayerKeydown);
      doc.addEventListener('keydown', onTabKeydown);
      doc.addEventListener('submit', onSearchSubmit);
      var s = store();
      if (s && typeof s.onChange === 'function') s.onChange(onStoreChange);
      // Leaving the mobile breakpoint with the menu open: close it.
      try {
        var mq = window.matchMedia('(min-width: 900px)');
        var onMq = function (m) { if (m.matches && layer && layer.el.id === 'site-menu') closeLayer(true); };
        if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
      } catch (e) { /* ignore */ }
    }

    setActiveNav(currentNav);
    fillConceptNotes(doc);
    updateCounts();
    syncWishButtons();
    renderCart();
    // Also when the header was already in the markup (see above): the reservation is not needed.
    body.classList.add('shell-ready');
  }

  // ------------------------------------------------------------------ reveal

  var revealObserver = null;

  function reveal() {
    var items = doc.querySelectorAll('.reveal:not(.is-visible)');
    if (reducedMotion() || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(items, function (n) { n.classList.add('is-visible'); });
      return;
    }
    doc.documentElement.classList.add('js-reveal');
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            revealObserver.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    }
    Array.prototype.forEach.call(items, function (n) { revealObserver.observe(n); });
    watchLateReveals();
  }

  // Safety net: .reveal nodes injected after boot (by a page script that forgets
  // to call reveal() again) would stay hidden under .js-reveal. Watch for them.
  var revealWatcher = null;

  function watchLateReveals() {
    if (revealWatcher || !('MutationObserver' in window) || !doc.body) return;
    revealWatcher = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.matches && n.matches('.reveal:not(.is-visible)')) || (n.querySelector && n.querySelector('.reveal:not(.is-visible)'))) {
            reveal();
            return;
          }
        }
      }
    });
    revealWatcher.observe(doc.body, { childList: true, subtree: true });
  }

  // ------------------------------------------------------------ clips in view

  // Clips play only while they are on screen, and one at a time: of the clips at
  // least 30% visible, the most visible plays and every other one pauses. A clip
  // made with media(id, { play: 'inview' }) has no autoplay, so it fetches only
  // its metadata until it first scrolls into view. With reduced motion nothing
  // ever plays (the poster shows). Pages call watchVideos(root) after inserting
  // media; boot() covers clips already in the document.
  var videoObserver = null;
  var watchedVideos = [];

  function syncVideos() {
    watchedVideos = watchedVideos.filter(function (v) { return v.isConnected && v.tagName === 'VIDEO'; });
    var best = null;
    var bestRatio = 0;
    if (!reducedMotion()) {
      watchedVideos.forEach(function (v) {
        var r = v.__inView || 0;
        if (r >= 0.3 && r > bestRatio) { best = v; bestRatio = r; }
      });
    }
    watchedVideos.forEach(function (v) {
      if (v === best) {
        if (v.paused) {
          var p = v.play();
          if (p && typeof p.catch === 'function') p.catch(function () { /* blocked or replaced: poster stays */ });
        }
      } else if (!v.paused) {
        v.pause();
      }
    });
  }

  function watchVideos(root) {
    if (!('IntersectionObserver' in window)) return;
    if (!videoObserver) {
      videoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.__inView = e.isIntersecting ? e.intersectionRatio : 0; });
        syncVideos();
      }, { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] });
    }
    Array.prototype.forEach.call((root || doc).querySelectorAll('video[data-slot]'), function (v) {
      if (v.__watched) return;
      v.__watched = true;
      watchedVideos.push(v);
      videoObserver.observe(v);
    });
  }

  // -------------------------------------------------------------------- boot

  doc.addEventListener('error', onMediaError, true);

  function boot() {
    var body = doc.body;
    if (!body) return;
    if (body.getAttribute('data-shell') !== 'off') mountShell(body.getAttribute('data-nav') || '');
    sweepFailedMedia();
    watchVideos(doc);
    reveal();
  }

  Shop.ui = {
    mountShell: mountShell,
    openCart: openCart,
    closeCart: closeCart,
    toast: toast,
    media: media,
    watchVideos: watchVideos,
    reveal: reveal,
    productCard: productCard,
    stars: stars,
    icon: icon,
    conceptNoteHtml: conceptNoteHtml,
    fillConceptNotes: fillConceptNotes
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
