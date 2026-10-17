/*
 * State store: cart, wishlist, reviews, orders and the applied discount code,
 * persisted as ONE JSON blob in localStorage under "maison_demo_v1".
 *
 * Every storage access is wrapped in try/catch. With no storage (null), a
 * blocked/full/throwing storage, or a corrupt blob, the store keeps working
 * from in-memory state and never throws. Getters return deep copies.
 */
(function () {
  'use strict';

  var KEY = 'maison_demo_v1';
  var MAX_LINE_QTY = 20;
  var NAME_MAX = 40;
  var TEXT_MAX = 600;
  var STATUSES = ['Placed', 'Confirmed', 'Dispatched', 'Delivered'];

  function clone(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(v));
  }

  // Number() then truncate; NaN for anything that is not a finite number.
  function toInt(v) {
    var n = Number(v);
    return isFinite(n) ? Math.trunc(n) : NaN;
  }

  function isObj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  function str(v) {
    return typeof v === 'string' ? v : '';
  }

  // util.js is resolved lazily so script load order only matters at call time.
  function normalizePhone(s) {
    var util = null;
    try {
      if (typeof module !== 'undefined' && typeof require === 'function') util = require('./util.js');
      else if (typeof window !== 'undefined' && window.Shop) util = window.Shop.util;
    } catch (e) { util = null; }
    return util && typeof util.normalizePKPhone === 'function' ? util.normalizePKPhone(s) : null;
  }

  function sameNumber(a, b) {
    return typeof a === 'string' && typeof b === 'string' &&
      a.trim().toUpperCase() === b.trim().toUpperCase();
  }

  // --- sanitising whatever came out of storage -------------------------------

  function cleanLine(l) {
    if (!isObj(l) || typeof l.productId !== 'string' || !l.productId) return null;
    var ml = toInt(l.ml);
    var qty = toInt(l.qty);
    if (!(ml > 0) || !(qty >= 1)) return null;
    return { productId: l.productId, ml: ml, qty: Math.min(qty, MAX_LINE_QTY), gift: !!l.gift };
  }

  var EPOCH_ISO = '1970-01-01T00:00:00.000Z';

  function cleanIso(v) {
    return typeof v === 'string' && !isNaN(Date.parse(v)) ? v : EPOCH_ISO;
  }

  function cleanNum(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  function cleanReview(r) {
    if (!isObj(r) || typeof r.productId !== 'string' || !r.productId || typeof r.text !== 'string') return null;
    var text = r.text.trim().slice(0, TEXT_MAX).trim();
    if (!text) return null;
    var name = (typeof r.name === 'string' ? r.name.trim().slice(0, NAME_MAX).trim() : '') || 'Guest';
    var rating = Number(r.rating);
    rating = isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 1;
    return {
      id: typeof r.id === 'string' ? r.id : '',
      productId: r.productId,
      name: name,
      rating: rating,
      text: text,
      createdAt: cleanIso(r.createdAt)
    };
  }

  var CUSTOMER_FIELDS = ['name', 'phone', 'email', 'province', 'city', 'address', 'notes'];
  var TOTAL_FIELDS = ['subtotal', 'giftWrap', 'discount', 'delivery', 'total'];

  function cleanOrder(o) {
    if (!isObj(o) || typeof o.number !== 'string' || !o.number.trim()) return null;
    var out = {
      number: o.number,
      createdAt: cleanIso(o.createdAt),
      status: STATUSES.indexOf(o.status) >= 0 ? o.status : 'Placed',
      customer: {},
      lines: mapClean(o.lines, cleanLine),
      totals: isObj(o.totals) ? clone(o.totals) : {},
      code: str(o.code)
    };
    var cust = isObj(o.customer) ? o.customer : {};
    for (var i = 0; i < CUSTOMER_FIELDS.length; i++) out.customer[CUSTOMER_FIELDS[i]] = str(cust[CUSTOMER_FIELDS[i]]);
    for (var j = 0; j < TOTAL_FIELDS.length; j++) out.totals[TOTAL_FIELDS[j]] = cleanNum(out.totals[TOTAL_FIELDS[j]]);
    return out;
  }

  function mapClean(arr, fn) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    for (var i = 0; i < arr.length; i++) {
      var c = fn(arr[i]);
      if (c) out.push(c);
    }
    return out;
  }

  function emptyState() {
    return { cart: [], wishlist: [], reviews: [], orders: [], code: '' };
  }

  function parseState(raw) {
    var st = emptyState();
    if (typeof raw !== 'string') return st;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return st; }
    if (!isObj(data)) return st;
    st.cart = mapClean(data.cart, cleanLine);
    if (Array.isArray(data.wishlist)) {
      for (var i = 0; i < data.wishlist.length; i++) {
        var id = data.wishlist[i];
        if (typeof id === 'string' && id && st.wishlist.indexOf(id) < 0) st.wishlist.push(id);
      }
    }
    st.reviews = mapClean(data.reviews, cleanReview);
    st.orders = mapClean(data.orders, cleanOrder);
    st.code = typeof data.code === 'string' ? data.code.trim() : '';
    return st;
  }

  // --- the store -------------------------------------------------------------

  function createStore(storage) {
    var state = emptyState();
    var lastRaw;        // last blob string seen in / written to storage
    var dirty = false;  // true while a write failed: memory is newer than storage
    var listeners = [];

    function readRaw() {
      try {
        var raw = storage.getItem(KEY);
        return { ok: true, raw: raw === undefined ? null : raw };
      } catch (e) {
        return { ok: false };
      }
    }

    // Pull in changes made by another store instance / tab, if any.
    function sync(force) {
      if (!storage || dirty) return;
      var r = readRaw();
      if (!r.ok) return;
      if (!force && r.raw === lastRaw) return;
      lastRaw = r.raw;
      state = parseState(r.raw);
    }

    function save() {
      if (!storage) return;
      var raw = JSON.stringify(state);
      try {
        storage.setItem(KEY, raw);
        lastRaw = raw;
        dirty = false;
      } catch (e) {
        dirty = true; // keep serving from memory; retry on the next mutation
      }
    }

    function notify() {
      var snapshot = listeners.slice();
      for (var i = 0; i < snapshot.length; i++) {
        try { snapshot[i](); } catch (e) { /* a bad listener must not break others */ }
      }
    }

    // Run a mutation against freshly-synced state. fn returns true if it
    // changed anything; only then do we persist and notify.
    function mutate(fn) {
      sync(false);
      var changed = fn();
      if (changed) {
        save();
        notify();
      }
      return changed;
    }

    function findLine(productId, ml) {
      for (var i = 0; i < state.cart.length; i++) {
        var l = state.cart[i];
        if (l.productId === productId && l.ml === ml) return i;
      }
      return -1;
    }

    function findOrderIdx(number) {
      for (var i = 0; i < state.orders.length; i++) {
        if (sameNumber(state.orders[i].number, number)) return i;
      }
      return -1;
    }

    function newOrderNumber() {
      for (var tries = 0; tries < 1000; tries++) {
        var digits = String(Math.floor(Math.random() * 1000000));
        while (digits.length < 6) digits = '0' + digits;
        var candidate = 'ORD-' + digits;
        if (findOrderIdx(candidate) < 0) return candidate;
      }
      for (var n = 0; n < 1000000; n++) { // practically unreachable fallback
        var seq = String(n);
        while (seq.length < 6) seq = '0' + seq;
        if (findOrderIdx('ORD-' + seq) < 0) return 'ORD-' + seq;
      }
      return 'ORD-' + String(Date.now()).slice(-6);
    }

    // ---- cart ----

    function getCart() {
      sync(false);
      return clone(state.cart);
    }

    function addToCart(productId, ml, qty, gift) {
      var m = toInt(ml);
      var q = toInt(qty);
      if (typeof productId !== 'string' || !productId || !(m > 0) || !(q >= 1)) return;
      mutate(function () {
        var i = findLine(productId, m);
        if (i >= 0) {
          var line = state.cart[i];
          line.qty = Math.min(line.qty + q, MAX_LINE_QTY);
          if (gift !== undefined) line.gift = !!gift;
        } else {
          state.cart.push({ productId: productId, ml: m, qty: Math.min(q, MAX_LINE_QTY), gift: !!gift });
        }
        return true;
      });
    }

    function updateQty(productId, ml, qty) {
      var m = toInt(ml);
      var q = toInt(qty);
      if (isNaN(m) || isNaN(q)) return;
      mutate(function () {
        var i = findLine(productId, m);
        if (i < 0) return false;
        if (q <= 0) state.cart.splice(i, 1);
        else state.cart[i].qty = Math.min(q, MAX_LINE_QTY);
        return true;
      });
    }

    function removeLine(productId, ml) {
      var m = toInt(ml);
      if (isNaN(m)) return;
      mutate(function () {
        var i = findLine(productId, m);
        if (i < 0) return false;
        state.cart.splice(i, 1);
        return true;
      });
    }

    function setGift(productId, ml, gift) {
      var m = toInt(ml);
      if (isNaN(m)) return;
      mutate(function () {
        var i = findLine(productId, m);
        if (i < 0) return false;
        state.cart[i].gift = !!gift;
        return true;
      });
    }

    function clearCart() {
      mutate(function () {
        if (!state.cart.length) return false;
        state.cart = [];
        return true;
      });
    }

    // ---- wishlist ----

    function toggleWishlist(id) {
      if (typeof id !== 'string' || !id) return false;
      var now = false;
      mutate(function () {
        var i = state.wishlist.indexOf(id);
        if (i >= 0) { state.wishlist.splice(i, 1); now = false; }
        else { state.wishlist.push(id); now = true; }
        return true;
      });
      return now;
    }

    function getWishlist() {
      sync(false);
      return state.wishlist.slice();
    }

    // ---- reviews ----

    function addReview(input) {
      if (!isObj(input) || typeof input.productId !== 'string' || !input.productId) return null;
      var text = str(input.text).trim().slice(0, TEXT_MAX).trim();
      if (!text) return null;
      var rating = Number(input.rating);
      if (!isFinite(rating)) return null;
      rating = Math.min(5, Math.max(1, Math.round(rating)));
      var name = str(input.name).trim().slice(0, NAME_MAX).trim() || 'Guest';
      var review = {
        id: 'rv-' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36),
        productId: input.productId,
        name: name,
        rating: rating,
        text: text,
        createdAt: new Date().toISOString()
      };
      mutate(function () {
        state.reviews.unshift(review);
        return true;
      });
      return clone(review);
    }

    function getReviews(productId) {
      sync(false);
      return clone(state.reviews.filter(function (r) { return r.productId === productId; }));
    }

    // ---- discount code ----

    function setCode(code) {
      var c = typeof code === 'string' ? code.trim() : '';
      mutate(function () {
        if (state.code === c) return false;
        state.code = c;
        return true;
      });
    }

    function getCode() {
      sync(false);
      return state.code;
    }

    // ---- orders ----

    function placeOrder(customer, cartLines, totals) {
      var order;
      mutate(function () {
        var lines = Array.isArray(cartLines) ? cartLines : state.cart;
        order = {
          number: newOrderNumber(),
          createdAt: new Date().toISOString(),
          status: 'Placed',
          customer: isObj(customer) ? clone(customer) : {},
          lines: clone(lines),
          totals: isObj(totals) ? clone(totals) : {},
          code: state.code
        };
        state.orders.unshift(order);
        state.cart = [];
        state.code = '';
        return true;
      });
      return clone(order);
    }

    function findOrder(number, phone) {
      if (typeof number !== 'string' || !number.trim()) return null;
      var want = normalizePhone(phone);
      if (!want) return null;
      sync(false);
      var i = findOrderIdx(number);
      if (i < 0) return null;
      var have = normalizePhone(state.orders[i].customer && state.orders[i].customer.phone);
      return have === want ? clone(state.orders[i]) : null;
    }

    function getOrders() {
      sync(false);
      return clone(state.orders);
    }

    function updateOrderStatus(number, status) {
      if (STATUSES.indexOf(status) < 0) return false;
      var ok = false;
      mutate(function () {
        var i = findOrderIdx(number);
        if (i < 0) return false;
        state.orders[i].status = status;
        ok = true;
        return true;
      });
      return ok;
    }

    // ---- change notification ----

    function onChange(cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function unsubscribe() {
        var i = listeners.indexOf(cb);
        if (i >= 0) listeners.splice(i, 1);
      };
    }

    // Cross-tab: another tab wrote to localStorage.
    if (storage && typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
      try {
        window.addEventListener('storage', function (e) {
          if (e && e.key && e.key !== KEY) return;
          dirty = false;
          sync(true);
          notify();
        });
      } catch (e) { /* ignore */ }
    }

    sync(true);

    return {
      getCart: getCart,
      addToCart: addToCart,
      updateQty: updateQty,
      removeLine: removeLine,
      setGift: setGift,
      clearCart: clearCart,
      toggleWishlist: toggleWishlist,
      getWishlist: getWishlist,
      addReview: addReview,
      getReviews: getReviews,
      setCode: setCode,
      getCode: getCode,
      placeOrder: placeOrder,
      findOrder: findOrder,
      getOrders: getOrders,
      updateOrderStatus: updateOrderStatus,
      onChange: onChange
    };
  }

  // window.localStorage if it is really usable (Safari private mode, blocked
  // cookies and file:// quirks can make it throw), else null.
  function safeLocalStorage() {
    try {
      if (typeof window === 'undefined' || !window) return null;
      var ls = window.localStorage;
      if (!ls) return null;
      var probe = '__maison_probe__';
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      return ls;
    } catch (e) {
      return null;
    }
  }

  var api = { createStore: createStore, safeLocalStorage: safeLocalStorage };

  if (typeof module !== 'undefined') module.exports = api;
  else {
    window.Shop = window.Shop || {};
    window.Shop.store = createStore(safeLocalStorage());
    window.Shop.createStore = createStore;
  }
})();
