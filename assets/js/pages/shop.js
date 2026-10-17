/*
 * Shop page: the catalogue with search, filters and sorting.
 *
 * State lives in the URL (catalogue.toQuery plus a separate `sort` param, only
 * when it is not 'featured') and is written with history.replaceState, so
 * filtering never adds history entries. Unknown or malformed params are
 * dropped and the URL is rewritten to the state actually applied.
 *
 * The filter form is built once. Updates only touch the grid (one innerHTML
 * per change, and only when the result set changes), the counts, the chips,
 * the status line and the badge. Below 1024px the same form is moved into a
 * native <dialog> bottom sheet while it is open; results update live behind it.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;
  var catalogue = Shop.catalogue;
  var products = Shop.products || [];

  var DESKTOP_MQ = '(min-width: 1024px)';
  var SEARCH_DELAY = 150;
  var PRICE_DELAY = 450;
  var SHEET_EXIT_MS = 460;
  var SORTS = ['featured', 'newest', 'rating', 'price-asc', 'price-desc'];
  var GROUPS = ['houses', 'genders', 'families', 'sizes'];

  var LABELS = {
    genders: { men: 'Men', women: 'Women', unisex: 'Unisex' },
    families: { oud: 'Oud', woody: 'Woody', floral: 'Floral', fresh: 'Fresh' }
  };

  var EXTRA_ICONS = {
    sliders: '<path d="M4 7.5h9.2M17.8 7.5H20M4 16.5h2.2M10.8 16.5H20"/><circle cx="15.5" cy="7.5" r="2.3"/><circle cx="8.5" cy="16.5" r="2.3"/>'
  };

  function icon(name) {
    if (!EXTRA_ICONS[name]) return Shop.ui.icon(name);
    return '<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      EXTRA_ICONS[name] + '</svg>';
  }

  // ------------------------------------------------------------- catalogue facts

  function unique(list) {
    var out = [];
    list.forEach(function (v) { if (out.indexOf(v) === -1) out.push(v); });
    return out;
  }

  function lowestPrice(p) {
    var min = Infinity;
    (p && p.sizes || []).forEach(function (s) { if (typeof s.price === 'number' && s.price < min) min = s.price; });
    return min;
  }

  var OPTIONS = {
    houses: unique(products.map(function (p) { return p.house; }).filter(Boolean)),
    genders: ['men', 'women', 'unisex'].filter(function (g) { return products.some(function (p) { return p.gender === g; }); }),
    families: ['oud', 'woody', 'floral', 'fresh'].filter(function (f) { return products.some(function (p) { return p.family === f; }); }),
    sizes: unique([].concat.apply([], products.map(function (p) {
      return (p.sizes || []).map(function (s) { return s.ml; });
    }))).filter(function (n) { return typeof n === 'number' && isFinite(n); }).sort(function (a, b) { return a - b; })
  };

  var starts = products.map(lowestPrice).filter(isFinite);
  var PRICE_FLOOR = starts.length ? Math.floor(Math.min.apply(null, starts) / 100) * 100 : 0;
  var PRICE_CEIL = starts.length ? Math.ceil(Math.max.apply(null, starts) / 100) * 100 : 0;

  function optionLabel(group, value) {
    if (group === 'sizes') return value + ' ml';
    return (LABELS[group] && LABELS[group][value]) || String(value);
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  }

  function plural(n, one, many) { return n === 1 ? one : many; }

  // ------------------------------------------------------------------- state

  var MAX_Q = 120; // search length cap: the field, the state and the URL
  var state = { q: '', houses: [], genders: [], families: [], sizes: [], minPrice: null, maxPrice: null, sort: 'featured' };

  function priceValue(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(String(v).trim());
    return isFinite(n) && n >= 0 ? Math.round(n) : null;
  }

  function keepKnown(group, values) {
    if (!Array.isArray(values)) return [];
    return OPTIONS[group].filter(function (opt) { return values.indexOf(opt) !== -1; });
  }

  function readSort(search) {
    var m = /(?:^|[?&])sort=([^&]*)/.exec(search || '');
    if (!m) return 'featured';
    var v;
    try { v = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { v = m[1]; }
    return SORTS.indexOf(v) !== -1 ? v : 'featured';
  }

  // Parse, then keep only values this catalogue knows; swap an inverted range.
  function stateFromUrl(search) {
    var f = catalogue.parseQuery(search || '');
    var s = {
      q: typeof f.q === 'string' ? f.q.slice(0, MAX_Q) : '',
      houses: keepKnown('houses', f.houses),
      genders: keepKnown('genders', f.genders),
      families: keepKnown('families', f.families),
      sizes: keepKnown('sizes', f.sizes),
      minPrice: priceValue(f.minPrice),
      maxPrice: priceValue(f.maxPrice),
      sort: readSort(search)
    };
    if (s.minPrice !== null && s.maxPrice !== null && s.minPrice > s.maxPrice) {
      var t = s.minPrice; s.minPrice = s.maxPrice; s.maxPrice = t;
    }
    return s;
  }

  // The filter object catalogue.filterProducts expects; an inverted range typed
  // into the inputs is read as the range between the two numbers.
  function filterOf(s) {
    var lo = s.minPrice;
    var hi = s.maxPrice;
    if (lo !== null && hi !== null && lo > hi) { var t = lo; lo = hi; hi = t; }
    var f = { q: s.q.trim(), houses: s.houses, genders: s.genders, families: s.families, sizes: s.sizes };
    if (lo !== null) f.minPrice = lo;
    if (hi !== null) f.maxPrice = hi;
    return f;
  }

  function panelCount(s) {
    return s.houses.length + s.genders.length + s.families.length + s.sizes.length +
      (s.minPrice !== null || s.maxPrice !== null ? 1 : 0);
  }

  function writeUrl() {
    var qs = catalogue.toQuery(filterOf(state));
    if (state.sort !== 'featured') qs += (qs ? '&' : '') + 'sort=' + encodeURIComponent(state.sort);
    var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    try { history.replaceState(history.state, '', url); } catch (e) { /* file:// or sandboxed: state still works */ }
  }

  // --------------------------------------------------------------------- refs

  var el = {};

  function $(sel, root) { return (root || doc).querySelector(sel); }

  // ---------------------------------------------------------- one-time build

  function countMarkup(group, value) {
    return '<span class="shop-count"><span class="sr-only">, </span><span data-count-for="' + esc(group + '|' + value) + '">0</span>' +
      '<span class="sr-only"> fragrances</span></span>';
  }

  function buildOptions() {
    GROUPS.forEach(function (group) {
      var host = $('[data-options="' + group + '"]', el.form);
      if (!host) return;
      host.innerHTML = OPTIONS[group].map(function (value) {
        var id = 'f-' + group + '-' + slug(value);
        var input = '<input type="checkbox" id="' + esc(id) + '" name="' + group + '" value="' + esc(value) + '"';
        if (group === 'houses') {
          return '<li><label class="check shop-check" for="' + esc(id) + '">' + input + '>' +
            '<span class="shop-check__name">' + esc(value) + '</span>' + countMarkup(group, value) + '</label></li>';
        }
        return '<label class="shop-chip" for="' + esc(id) + '">' + input + ' class="shop-chip__input">' +
          '<span class="shop-chip__name">' + esc(optionLabel(group, value)) + '</span>' +
          (group === 'sizes' ? '' : countMarkup(group, value)) + '</label>';
      }).join('');
    });

    var thousands = function (n) { return pkr(n).replace(/^PKR\s*/, ''); };
    if (PRICE_FLOOR) el.min.setAttribute('placeholder', thousands(PRICE_FLOOR));
    if (PRICE_CEIL) el.max.setAttribute('placeholder', thousands(PRICE_CEIL));

    Array.prototype.forEach.call(doc.querySelectorAll('[data-icon]'), function (host) {
      if (!host.firstElementChild) host.innerHTML = icon(host.getAttribute('data-icon'));
    });
    el.emptyMark.innerHTML = bottleMark();
  }

  // Fine-line bottle for the empty state, drawn to match the placeholder.
  function bottleMark() {
    return '<svg viewBox="0 0 48 76" width="40" height="64" fill="none" stroke="currentColor" stroke-width="1" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="17.5" y="2.5" width="13" height="11" rx="1"/><path d="M20.5 13.5v5h7v-5"/>' +
      '<path d="M14 18.5h20c3.6 0 6.5 2.9 6.5 6.5v42.5c0 2.8-2.2 5-5 5h-23c-2.8 0-5-2.2-5-5V25c0-3.6 2.9-6.5 6.5-6.5z"/>' +
      '<path d="M7.5 40.5h33" stroke-opacity=".45"/><path d="M12 25v38" stroke-opacity=".3"/></svg>';
  }

  // Write state into the controls (load, chip removal, clear). Never while typing.
  function syncControls(opts) {
    opts = opts || {};
    GROUPS.forEach(function (group) {
      Array.prototype.forEach.call(el.form.querySelectorAll('input[name="' + group + '"]'), function (input) {
        var v = group === 'sizes' ? Number(input.value) : input.value;
        input.checked = state[group].indexOf(v) !== -1;
      });
    });
    if (!opts.keepPrice) {
      el.min.value = state.minPrice === null ? '' : String(state.minPrice);
      el.max.value = state.maxPrice === null ? '' : String(state.maxPrice);
    }
    if (el.q.value !== state.q) el.q.value = state.q;
    el.clearSearch.hidden = !el.q.value;
    el.sort.value = state.sort;
  }

  function readGroups() {
    GROUPS.forEach(function (group) {
      var picked = Array.prototype.filter.call(el.form.querySelectorAll('input[name="' + group + '"]'), function (i) {
        return i.checked;
      }).map(function (i) { return group === 'sizes' ? Number(i.value) : i.value; });
      state[group] = keepKnown(group, picked);
    });
  }

  function readPrices() {
    state.minPrice = priceValue(el.min.value);
    state.maxPrice = priceValue(el.max.value);
  }

  // ------------------------------------------------------------------ render

  var lastKey = null;
  var firstPaint = true;

  function renderGrid(list) {
    var key = list.map(function (p) { return p.id; }).join(',');
    if (key === lastKey) return;
    lastKey = key;
    var cls = firstPaint ? 'shop-grid__item reveal' : 'shop-grid__item shop-grid__item--refresh';
    el.grid.innerHTML = list.map(function (p, i) {
      var delay = firstPaint ? ' style="--reveal-delay: ' + (Math.min(i, 7) * 70) + 'ms"' : '';
      return '<div class="' + cls + '"' + delay + '>' + Shop.ui.productCard(p) + '</div>';
    }).join('');
    el.grid.hidden = !list.length;
    el.empty.hidden = !!list.length;
    if (firstPaint) Shop.ui.reveal();
    firstPaint = false;
  }

  function chipsData() {
    var out = [];
    var q = state.q.trim();
    if (q) out.push({ key: 'q', label: '\u201C' + q + '\u201D', aria: 'Remove search ' + q });
    GROUPS.forEach(function (group) {
      state[group].forEach(function (v) {
        var label = optionLabel(group, v);
        out.push({ key: group + '|' + v, label: label, aria: 'Remove ' + label });
      });
    });
    var f = filterOf(state);
    if (f.minPrice !== undefined || f.maxPrice !== undefined) {
      var label = f.minPrice !== undefined && f.maxPrice !== undefined
        ? pkr(f.minPrice) + ' to ' + pkr(f.maxPrice).replace(/^PKR\s*/, '')
        : f.minPrice !== undefined ? 'From ' + pkr(f.minPrice) : 'Up to ' + pkr(f.maxPrice);
      out.push({ key: 'price', label: label, aria: 'Remove price ' + label });
    }
    return out;
  }

  function renderChips() {
    var chips = chipsData();
    el.chips.innerHTML = chips.map(function (c) {
      return '<li><button type="button" class="chip shop-active__chip" data-remove="' + esc(c.key) + '" aria-label="' + esc(c.aria) + '">' +
        '<span class="shop-active__text">' + esc(c.label) + '</span>' + icon('close') + '</button></li>';
    }).join('');
    el.active.hidden = !chips.length;
  }

  function renderCounts(f) {
    GROUPS.forEach(function (group) {
      OPTIONS[group].forEach(function (value) {
        var probe = {};
        Object.keys(f).forEach(function (k) { probe[k] = f[k]; });
        probe[group] = [value];
        var n = catalogue.filterProducts(products, probe).length;
        var out = el.form.querySelector('[data-count-for="' + cssEscape(group + '|' + value) + '"]');
        if (out && out.textContent !== String(n)) out.textContent = String(n);
        var input = el.form.querySelector('#f-' + group + '-' + slug(value));
        var label = input && input.closest('label');
        if (label) label.classList.toggle('is-empty', n === 0 && !input.checked);
      });
    });
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
  }

  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

  function update() {
    var f = filterOf(state);
    var list = catalogue.sortProducts(catalogue.filterProducts(products, f), state.sort);
    var total = products.length;
    var q = f.q;

    renderGrid(list);
    renderChips();
    renderCounts(f);

    setText(el.status, 'Showing ' + list.length + ' of ' + total + ' ' + plural(total, 'fragrance', 'fragrances') +
      (q ? ' for \u201C' + q + '\u201D' : ''));
    setText(el.total, String(list.length));
    setText(el.emptyTitle, q ? 'Nothing matches \u201C' + q + '\u201D' : 'Nothing matches these filters');

    var active = panelCount(state);
    el.badge.hidden = !active;
    setText(el.badge, String(active));
    el.openFilters.setAttribute('aria-label', active ? 'Filters, ' + active + ' active' : 'Filters');
    setText(el.apply, list.length ? 'Show ' + list.length + ' ' + plural(list.length, 'result', 'results') : 'No results, adjust filters');
    el.sheetClear.disabled = !active;

    writeUrl();
  }

  // ----------------------------------------------------------------- actions

  var searchTimer = 0;
  var priceTimer = 0;

  function flushSearch() {
    clearTimeout(searchTimer);
    var q = el.q.value.slice(0, MAX_Q);
    if (state.q !== q) { state.q = q; update(); }
  }

  function clearAll(opts) {
    opts = opts || {};
    clearTimeout(searchTimer);
    clearTimeout(priceTimer);
    if (!opts.keepSearch) state.q = '';
    GROUPS.forEach(function (g) { state[g] = []; });
    state.minPrice = null;
    state.maxPrice = null;
    syncControls();
    update();
  }

  function removeChip(key) {
    if (key === 'q') state.q = '';
    else if (key === 'price') { state.minPrice = null; state.maxPrice = null; }
    else {
      var bar = key.indexOf('|');
      var group = key.slice(0, bar);
      var value = key.slice(bar + 1);
      if (GROUPS.indexOf(group) === -1) return;
      if (group === 'sizes') value = Number(value);
      state[group] = state[group].filter(function (v) { return v !== value; });
    }
    syncControls();
    update();
  }

  function focusNoScroll(node) {
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  // ------------------------------------------------------------------- sheet

  var homeTimer = 0;

  function moveFormHome() {
    clearTimeout(homeTimer);
    if (el.form.parentNode !== el.home) el.home.appendChild(el.form);
  }

  function isDesktop() {
    try { return window.matchMedia(DESKTOP_MQ).matches; } catch (e) { return false; }
  }

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function openSheet() {
    if (!el.sheet || el.sheet.open || typeof el.sheet.showModal !== 'function') return;
    clearTimeout(homeTimer);
    if (el.form.parentNode !== el.sheetBody) el.sheetBody.appendChild(el.form);
    el.sheetBody.scrollTop = 0;
    el.sheet.showModal();
    el.openFilters.setAttribute('aria-expanded', 'true');
    focusNoScroll($('[data-close-sheet]', el.sheet));
  }

  function onSheetClose() {
    el.openFilters.setAttribute('aria-expanded', 'false');
    if (isDesktop() || reducedMotion()) moveFormHome();
    else homeTimer = setTimeout(moveFormHome, SHEET_EXIT_MS);
    if (!isDesktop() && el.openFilters.getClientRects().length) focusNoScroll(el.openFilters);
  }

  function wireSheet() {
    el.openFilters.setAttribute('aria-expanded', 'false');
    el.openFilters.addEventListener('click', openSheet);
    el.sheet.addEventListener('close', onSheetClose);
    $('[data-close-sheet]', el.sheet).addEventListener('click', function () { el.sheet.close(); });
    el.apply.addEventListener('click', function () { el.sheet.close(); });
    el.sheetClear.addEventListener('click', function () { clearAll({ keepSearch: true }); });

    // Light dismiss where <dialog closedby> is not supported yet.
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      el.sheet.addEventListener('click', function (e) {
        if (e.target !== el.sheet) return;
        var r = el.sheet.querySelector('.shop-sheet__panel').getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) el.sheet.close();
      });
    }

    // Growing into the sidebar layout with the sheet open: close it, keep the state.
    try {
      var mq = window.matchMedia(DESKTOP_MQ);
      var onChange = function (m) { if (m.matches && el.sheet.open) el.sheet.close(); if (m.matches) moveFormHome(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* ignore */ }
  }

  // ----------------------------------------------------------------- sidebar

  // Sticky under the header when it fits; when it is taller than the viewport,
  // a negative offset lets it scroll with the page until its end is in view.
  function fitSidebar() {
    if (!isDesktop()) { el.side.style.removeProperty('--side-top'); return; }
    var header = doc.getElementById('site-header');
    var headerH = header ? header.offsetHeight : 76;
    var top = Math.min(headerH + 28, window.innerHeight - el.side.offsetHeight - 32);
    el.side.style.setProperty('--side-top', Math.round(top) + 'px');
  }

  function wireSidebar() {
    var frame = 0;
    var schedule = function () {
      if (frame) return;
      frame = requestAnimationFrame(function () { frame = 0; fitSidebar(); });
    };
    window.addEventListener('resize', schedule, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(el.side);
    fitSidebar();
  }

  // ------------------------------------------------------------------ wiring

  function wire() {
    el.q.addEventListener('input', function () {
      el.clearSearch.hidden = !el.q.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(flushSearch, SEARCH_DELAY);
    });
    // Escape in a search field clears it natively.
    el.q.addEventListener('search', function () { el.clearSearch.hidden = !el.q.value; flushSearch(); });
    el.searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      flushSearch();
      if (!isDesktop()) el.q.blur(); // let the phone keyboard go so the results show
    });
    el.clearSearch.addEventListener('click', function () {
      el.q.value = '';
      el.clearSearch.hidden = true;
      flushSearch();
      focusNoScroll(el.q);
    });

    el.sort.addEventListener('change', function () {
      state.sort = SORTS.indexOf(el.sort.value) !== -1 ? el.sort.value : 'featured';
      update();
    });

    el.form.addEventListener('submit', function (e) { e.preventDefault(); });
    el.form.addEventListener('change', function (e) {
      var t = e.target;
      if (t === el.min || t === el.max) {
        clearTimeout(priceTimer);
        readPrices();
        // Settled on an inverted range: put the numbers the right way round.
        if (state.minPrice !== null && state.maxPrice !== null && state.minPrice > state.maxPrice) {
          var lo = state.maxPrice; state.maxPrice = state.minPrice; state.minPrice = lo;
          el.min.value = String(state.minPrice);
          el.max.value = String(state.maxPrice);
        }
        update();
        return;
      }
      if (t && t.type === 'checkbox') { readGroups(); update(); }
    });
    el.form.addEventListener('input', function (e) {
      if (e.target !== el.min && e.target !== el.max) return;
      clearTimeout(priceTimer);
      priceTimer = setTimeout(function () { readPrices(); update(); }, PRICE_DELAY);
    });
    el.form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.target === el.min || e.target === el.max)) {
        e.preventDefault();
        clearTimeout(priceTimer);
        readPrices();
        update();
      }
    });

    el.chips.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove]');
      if (!btn) return;
      var all = Array.prototype.slice.call(el.chips.querySelectorAll('[data-remove]'));
      var index = all.indexOf(btn);
      removeChip(btn.getAttribute('data-remove'));
      var left = el.chips.querySelectorAll('[data-remove]');
      var next = left[Math.min(index, left.length - 1)];
      focusNoScroll(next || el.status);
    });

    Array.prototype.forEach.call(doc.querySelectorAll('[data-clear-all]'), function (btn) {
      btn.addEventListener('click', function () {
        var fromEmpty = !!btn.closest('[data-shop-empty]');
        clearAll();
        focusNoScroll(fromEmpty ? el.status : el.q);
      });
    });

    wireSheet();
    wireSidebar();
  }

  // -------------------------------------------------------------------- boot

  function boot() {
    el.root = $('[data-shop]');
    if (!el.root || !catalogue) return;
    el.searchForm = $('[data-shop-search]');
    el.q = $('#shop-q');
    el.clearSearch = $('[data-clear-search]');
    el.sort = $('#shop-sort');
    el.form = $('[data-shop-filters]');
    el.home = $('[data-filters-home]');
    el.side = $('[data-shop-sidebar]');
    el.min = $('#shop-min');
    el.max = $('#shop-max');
    el.grid = $('[data-shop-grid]');
    el.empty = $('[data-shop-empty]');
    el.emptyTitle = $('[data-empty-title]');
    el.emptyMark = $('.shop-empty__mark');
    el.status = $('[data-shop-status]');
    el.total = $('[data-shop-total]');
    el.active = $('[data-shop-active]');
    el.chips = $('[data-shop-chips]');
    el.openFilters = $('[data-open-filters]');
    el.badge = $('[data-filter-count]');
    el.sheet = $('#shop-filter-sheet');
    el.sheetBody = $('[data-filters-sheet]');
    el.apply = $('[data-sheet-apply]');
    el.sheetClear = $('[data-sheet-clear]');

    buildOptions();
    state = stateFromUrl(window.location.search);
    syncControls();
    wire();
    update();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
