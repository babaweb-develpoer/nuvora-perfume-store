/*
 * Shared helper for the content pages (brands, about, contact, FAQ, shipping &
 * returns, fragrance guide, 404). Load it after ui.js and before any page script.
 *
 * Hooks it fills on DOMContentLoaded (after the shell has mounted):
 *   [data-config="<key>"]   text from Shop.config; money keys go through formatPKR
 *                           keys: freeDeliveryThreshold deliveryFee giftWrapFee
 *                                 gift15.percent gift15.min hours address email phone
 *   [data-shop-name]        Shop.config.shopName, so prose survives a rename
 *   a[data-wa]              WhatsApp deep link when config.whatsapp is set; optional
 *                           data-wa="<message>" ({shop} becomes the shop name) and
 *                           data-wa-label="<text>" (the link text with WhatsApp).
 *                           Without a number the link keeps its markup href and
 *                           text (write those for the no-WhatsApp case, e.g.
 *                           "Message us" -> contact.html); never a wa.me link.
 *   [data-wa-only]          shown only when a WhatsApp number is set (else hidden)
 *   [data-wa-off]           shown only when no WhatsApp number is set
 *   a[data-mailto]          mailto: link to config.email (text too, if empty)
 *   a[data-tel]             tel: link to the WhatsApp number (text too, if empty);
 *                           put it inside a [data-wa-only] block
 *   [data-media="<slot>"]   Shop.ui.media(slot); data-decorative gives alt="";
 *                           data-play="inview" starts a clip only once on screen
 *   [data-bestsellers]      Shop.ui.productCard for the first data-limit (3)
 *                           bestsellers by featured sort
 *   [data-toc]              scrollspy: aria-current="true" on the link whose
 *                           section is in view
 *
 * Page scripts register work with Shop.content.page(fn); it runs after the hooks
 * are filled, then the hooks are filled again for any markup fn injected, reveal
 * runs, and <body data-ready> is set. Every dynamic string is escaped or set as
 * textContent.
 */
(function () {
  'use strict';

  var Shop = window.Shop = window.Shop || {};
  var doc = document;
  var pages = [];

  function config() { return Shop.config || {}; }
  function esc(s) { return Shop.util.escapeHtml(s); }
  function pkr(n) { return Shop.util.formatPKR(n); }

  function digits(s) { return String(s || '').replace(/\D/g, ''); }

  // "+92 300 0000000" from "923000000000"
  function displayPhone(w) {
    var d = digits(w);
    if (d.length === 12 && d.indexOf('92') === 0) return '+92 ' + d.slice(2, 5) + ' ' + d.slice(5);
    return d ? '+' + d : '';
  }

  function whatsappHref(text) {
    var c = config();
    var name = c.shopName || '';
    var msg = text ? String(text).replace(/\{shop\}/g, name) : ('Hello ' + name + ', I have a question.');
    return 'https://wa.me/' + digits(c.whatsapp) + '?text=' + encodeURIComponent(msg);
  }

  function gift15() {
    var codes = config().codes || {};
    return codes.GIFT15 || null;
  }

  function configValue(key) {
    var c = config();
    var g = gift15();
    switch (key) {
      case 'freeDeliveryThreshold':
      case 'deliveryFee':
      case 'giftWrapFee':
        return typeof c[key] === 'number' ? pkr(c[key]) : '';
      case 'gift15.percent': return g && g.type === 'percent' ? g.value + '%' : '';
      case 'gift15.min': return g ? pkr(g.min || 0) : '';
      case 'phone': return displayPhone(c.whatsapp);
      case 'hours':
      case 'address':
      case 'email':
      case 'shopName':
        return c[key] ? String(c[key]) : '';
      default: return '';
    }
  }

  function each(root, sel, fn) {
    Array.prototype.forEach.call((root || doc).querySelectorAll(sel), fn);
  }

  function fill(root) {
    var c = config();
    each(root, '[data-config]', function (el) {
      var v = configValue(el.getAttribute('data-config'));
      if (v) el.textContent = v;
    });
    each(root, '[data-shop-name]', function (el) { el.textContent = c.shopName || ''; });
    var hasWa = !!digits(c.whatsapp);
    // WhatsApp is optional (config.whatsapp ''): the static markup is the no-WhatsApp
    // version, and a number upgrades it. Never a wa.me link without a number.
    each(root, '[data-wa-only]', function (el) { el.hidden = !hasWa; });
    each(root, '[data-wa-off]', function (el) { el.hidden = hasWa; });
    each(root, 'a[data-wa]', function (a) {
      if (!hasWa) {
        if (/^https:\/\/wa\.me\//.test(a.getAttribute('href') || '')) a.setAttribute('href', 'contact.html');
        a.removeAttribute('target');
        return;
      }
      a.setAttribute('href', whatsappHref(a.getAttribute('data-wa')));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
      if (a.getAttribute('data-wa-label')) a.textContent = a.getAttribute('data-wa-label');
    });
    each(root, 'a[data-mailto]', function (a) {
      if (!c.email) return;
      a.setAttribute('href', 'mailto:' + c.email);
      if (!a.textContent.trim()) a.textContent = c.email;
    });
    each(root, 'a[data-tel]', function (a) {
      var d = digits(c.whatsapp);
      if (!d) return;
      a.setAttribute('href', 'tel:+' + d);
      if (!a.textContent.trim()) a.textContent = displayPhone(d);
    });
    each(root, '[data-media]', function (host) {
      if (host.firstElementChild) return;
      var opts = { eager: host.hasAttribute('data-eager') };
      if (host.hasAttribute('data-decorative')) opts.alt = '';
      if (host.getAttribute('data-sizes')) opts.sizes = host.getAttribute('data-sizes');
      if (host.getAttribute('data-play')) opts.play = host.getAttribute('data-play');
      host.innerHTML = Shop.ui.media(host.getAttribute('data-media'), opts);
    });
    if (Shop.ui.watchVideos) Shop.ui.watchVideos(root);
    each(root, '[data-icon]', function (host) {
      if (!host.firstElementChild) host.innerHTML = icon(host.getAttribute('data-icon'));
    });
    each(root, '[data-bestsellers]', function (grid) {
      if (grid.firstElementChild) return;
      var limit = Number(grid.getAttribute('data-limit')) || 3;
      var tagged = (Shop.products || []).filter(function (p) { return p && p.tags && p.tags.indexOf('bestseller') >= 0; });
      var top = Shop.catalogue.sortProducts(tagged, 'featured').slice(0, limit);
      grid.innerHTML = top.map(function (p) { return '<li class="nf-best__item">' + Shop.ui.productCard(p) + '</li>'; }).join('');
    });
  }

  // Line icons the shared set lacks, drawn to match ui.js (24 grid, 1.5 stroke).
  var EXTRA_ICONS = {
    returns: '<path d="M4.8 12.2a7.2 7.2 0 1 0 2.4-5.4"/><path d="M4.6 4.4v3.9h3.9"/>',
    parcel: '<path d="M3.8 7.6 12 3.8l8.2 3.8v8.8L12 20.2l-8.2-3.8z"/><path d="M3.8 7.6 12 11.4l8.2-3.8M12 11.4v8.8"/><path d="m7.9 5.7 8.2 3.8"/>',
    phone: '<path d="M6.6 3.8h2.6l1.4 4-1.9 1.4a11.6 11.6 0 0 0 6.1 6.1l1.4-1.9 4 1.4v2.6a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.6 6a2 2 0 0 1 2-2.2z"/>',
    clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l2.9 1.8"/>',
    box: '<path d="M4 8.5h16v11H4z"/><path d="M3 4.5h18v4H3zM10 12h4"/>',
    alert: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v5.2M12 16.1v.1"/>'
  };

  function icon(name) {
    if (!EXTRA_ICONS[name]) return Shop.ui.icon(name);
    return '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      EXTRA_ICONS[name] + '</svg>';
  }

  // ------------------------------------------------------------ scrollspy

  function scrollspy(nav) {
    var links = Array.prototype.filter.call(nav.querySelectorAll('a[href^="#"]'), function (a) {
      return a.getAttribute('href').length > 1;
    });
    var targets = links.map(function (a) { return doc.getElementById(a.getAttribute('href').slice(1)); });
    if (!links.length || !('IntersectionObserver' in window)) return;
    var visible = {};

    function mark() {
      var current = null;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i] && visible[targets[i].id]) { current = links[i]; break; }
      }
      if (!current) return;
      links.forEach(function (a) {
        if (a === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      mark();
    }, { rootMargin: '-25% 0px -55% 0px', threshold: 0 });
    targets.forEach(function (t) { if (t) io.observe(t); });
    // Until a section reaches the reading band, the first one is "current".
    if (!nav.querySelector('[aria-current]')) links[0].setAttribute('aria-current', 'true');
  }

  // ------------------------------------------------------------------ boot

  function boot() {
    fill(doc);
    pages.forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.error(e); }
    });
    fill(doc);
    each(doc, '[data-toc]', scrollspy);
    if (Shop.ui && Shop.ui.reveal) Shop.ui.reveal();
    doc.body.setAttribute('data-ready', '');
  }

  Shop.content = {
    page: function (fn) { if (typeof fn === 'function') pages.push(fn); },
    fill: fill,
    icon: icon,
    whatsappHref: whatsappHref,
    hasWhatsapp: function () { return !!digits(config().whatsapp); },
    displayPhone: displayPhone,
    configValue: configValue,
    esc: esc
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
