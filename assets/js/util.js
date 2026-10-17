/*
 * Small pure helpers shared by every page: HTML escaping, PKR formatting,
 * Pakistani mobile-number validation and order dates. No DOM, no dependencies.
 */
(function () {
  'use strict';

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (ch) { return ESCAPES[ch]; });
  }

  // 12500 -> "PKR 12,500". Whole rupees, plain commas regardless of locale.
  function formatPKR(n) {
    var v = Math.round(Number(n));
    if (!isFinite(v)) v = 0;
    var sign = v < 0 ? '-' : '';
    var digits = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return 'PKR ' + sign + digits;
  }

  // Accepts 03001234567, 0300-1234567, +92 300 1234567, 923001234567, 0092...
  // Returns 03XXXXXXXXX or null. Only spaces, dashes, dots and brackets are
  // tolerated as separators; a "+" is only allowed as the first character.
  function normalizePKPhone(s) {
    if (typeof s !== 'string') return null;
    var t = s.trim();
    if (!/^\+?[\d\s\-().]+$/.test(t)) return null;
    var plus = t.charAt(0) === '+';
    var d = t.replace(/\D/g, '');
    var national; // 10 digits starting with 3
    if (plus) {
      if (d.indexOf('92') !== 0) return null;
      national = d.slice(2);
    } else if (d.indexOf('0092') === 0) {
      national = d.slice(4);
    } else if (d.length === 12 && d.indexOf('92') === 0) {
      national = d.slice(2);
    } else if (d.length === 11 && d.charAt(0) === '0') {
      national = d.slice(1);
    } else {
      return null;
    }
    if (!/^3\d{9}$/.test(national)) return null;
    return '0' + national;
  }

  function isValidPKPhone(s) {
    return normalizePKPhone(s) !== null;
  }

  // ---------------------------------------------------------------- dates
  // Shared by order confirmation and order tracking. Local time throughout.

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // A usable order date, or null: unparseable values and anything before 2000
  // (an epoch timestamp from tampered or broken data) are not shown to shoppers.
  function orderDate(iso) {
    if (iso === null || iso === undefined || iso === '') return null;
    var d = new Date(iso);
    if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
    return d;
  }

  function plusDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  // n working days after date. Working days are Monday to Saturday: Sundays are skipped.
  function plusWorkingDays(date, n) {
    var d = new Date(date.getTime());
    while (n > 0) {
      d = plusDays(d, 1);
      if (d.getDay() !== 0) n--;
    }
    return d;
  }

  // Dispatch takes 1 to 2 working days, delivery 2 to 5 working days after that,
  // so the parcel arrives 3 to 7 working days after the order (Mon-Sat):
  // "Mon 19 – Fri 23 Oct", or "Sat 31 Oct – Thu 5 Nov" across a month end.
  // Neither end is ever a Sunday. '' when the date is unusable.
  var DELIVERY_MIN = 3;
  var DELIVERY_MAX = 7;

  function deliveryRange(createdAtIso) {
    var start = orderDate(createdAtIso);
    if (!start) return '';
    var a = plusWorkingDays(start, DELIVERY_MIN);
    var b = plusWorkingDays(start, DELIVERY_MAX);
    var same = a.getMonth() === b.getMonth();
    return DAYS[a.getDay()] + ' ' + a.getDate() + (same ? '' : ' ' + MONTHS[a.getMonth()]) +
      ' – ' + DAYS[b.getDay()] + ' ' + b.getDate() + ' ' + MONTHS[b.getMonth()];
  }

  // "Wed 15 Oct 2026 at 3:07 pm"; '' when the date is unusable.
  function placedAt(createdAtIso) {
    var d = orderDate(createdAtIso);
    if (!d) return '';
    var h = d.getHours();
    var m = d.getMinutes();
    var time = ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' am' : ' pm');
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ' at ' + time;
  }

  var api = {
    deliveryRange: deliveryRange,
    placedAt: placedAt,
    escapeHtml: escapeHtml,
    formatPKR: formatPKR,
    normalizePKPhone: normalizePKPhone,
    isValidPKPhone: isValidPKPhone
  };

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.util = api; }
})();
