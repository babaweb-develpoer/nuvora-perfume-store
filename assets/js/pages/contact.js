/*
 * Contact page form (concept store). It validates inline, then thanks the visitor and
 * clears itself. It sends nothing (no fetch, no navigation: the submit is always
 * prevented) and stores nothing (no localStorage, no cookies).
 *
 * Accessibility: an error's id joins the field's aria-describedby only while the
 * error is showing, aria-invalid mirrors it, and a failed submit focuses the first
 * invalid field. The remaining-characters counter is not a live region; a separate
 * polite region speaks only when 100, 50 and 0 characters remain.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;

  var MIN_MESSAGE = 10;
  var MAX_MESSAGE = 1000;
  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  var ORDER = ['name', 'phone', 'email', 'message'];
  var ANNOUNCE_AT = [100, 50, 0];

  function str(v) { return String(v == null ? '' : v).trim(); }

  var RULES = {
    name: function (v) {
      if (!str(v)) return 'Enter your name so we know who to reply to.';
      return '';
    },
    phone: function (v) {
      if (!str(v)) return '';
      if (!Shop.util.isValidPKPhone(str(v))) return 'Enter a Pakistani mobile number such as 0300 1234567, or leave this blank.';
      return '';
    },
    email: function (v) {
      if (!str(v)) return 'Enter your email address so we can reply.';
      if (!EMAIL.test(str(v))) return 'Enter a full email address, with an @ and a domain, for example .com or .pk.';
      return '';
    },
    message: function (v) {
      var n = str(v).length;
      if (!n) return 'Write a short message, at least ' + MIN_MESSAGE + ' characters.';
      if (n < MIN_MESSAGE) return 'Add a little more: at least ' + MIN_MESSAGE + ' characters (' + n + ' so far).';
      if (n > MAX_MESSAGE) return 'Keep it under ' + MAX_MESSAGE + ' characters.';
      return '';
    }
  };

  var form, success, again, counter, live;
  var fields = {};
  var lastSpoken = null;

  function setError(name, message) {
    var el = fields[name];
    var err = doc.getElementById(el.id + '-err');
    var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== err.id; });
    if (message) {
      err.textContent = message;
      el.setAttribute('aria-invalid', 'true');
      ids.push(err.id);
    } else {
      err.textContent = '';
      el.removeAttribute('aria-invalid');
    }
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  }

  function validateAll() {
    var first = null;
    ORDER.forEach(function (name) {
      var msg = RULES[name](fields[name].value);
      setError(name, msg);
      if (msg && !first) first = fields[name];
    });
    return first;
  }

  function updateCounter() {
    var left = MAX_MESSAGE - fields.message.value.length;
    counter.textContent = String(Math.max(0, left));
    counter.parentNode.classList.toggle('is-low', left <= 50);
    var mark = null;
    for (var i = 0; i < ANNOUNCE_AT.length; i++) if (left <= ANNOUNCE_AT[i]) mark = ANNOUNCE_AT[i];
    if (mark !== lastSpoken) {
      if (mark !== null && (lastSpoken === null || mark < lastSpoken)) live.textContent = left + ' characters left.';
      lastSpoken = mark;
    }
  }

  function showSuccess() {
    form.reset();
    ORDER.forEach(function (name) { setError(name, ''); });
    lastSpoken = null;
    live.textContent = '';
    updateCounter();
    form.hidden = true;
    success.hidden = false;
    try { success.focus({ preventScroll: false }); } catch (e) { success.focus(); }
  }

  function onSubmit(e) {
    e.preventDefault();
    var firstBad = validateAll();
    if (firstBad) { firstBad.focus(); return; }
    showSuccess();
  }

  function onInput(e) {
    var name = e.target && e.target.name;
    if (name === 'message') updateCounter();
    if (!RULES[name]) return;
    // Clear an error as soon as the value is fixed; never add one while typing.
    if (e.target.getAttribute('aria-invalid') === 'true' && !RULES[name](e.target.value)) setError(name, '');
  }

  // After leaving a field that has something in it, say what is wrong (this keeps
  // aria-invalid in step with the browser's own :user-invalid styling).
  // Not when focus is leaving for the submit button, though: an error appearing
  // above the button would push it away from the pointer between press and
  // release, and the click would be lost. The submit handler validates instead.
  var submitting = false;

  function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest('button[type="submit"]')) {
      submitting = true;
      setTimeout(function () { submitting = false; }, 600);
    }
  }

  function onBlur(e) {
    var name = e.target && e.target.name;
    if (!RULES[name] || !str(e.target.value)) return;
    var next = e.relatedTarget;
    if (submitting || (next && next.type === 'submit' && form.contains(next))) return;
    var msg = RULES[name](e.target.value);
    if (msg) setError(name, msg);
  }

  function writeAgain() {
    success.hidden = true;
    form.hidden = false;
    fields.name.focus();
  }

  function init() {
    form = doc.querySelector('[data-contact-form]');
    success = doc.querySelector('[data-contact-success]');
    if (!form || !success) return;
    again = success.querySelector('[data-contact-again]');
    counter = form.querySelector('[data-ct-count]');
    live = form.querySelector('[data-ct-live]');
    fields.name = doc.getElementById('ct-name');
    fields.phone = doc.getElementById('ct-phone');
    fields.email = doc.getElementById('ct-email');
    fields.message = doc.getElementById('ct-message');

    form.addEventListener('submit', onSubmit);
    form.addEventListener('input', onInput);
    form.addEventListener('blur', onBlur, true);
    form.addEventListener('pointerdown', onPointerDown);
    if (again) again.addEventListener('click', writeAgain);
    updateCounter();
  }

  Shop.content.page(init);
})();
