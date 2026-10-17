/*
 * Find Your Scent: a guided consultation, one question at a time.
 *
 * - Questions come from Shop.quiz.QUESTIONS (never hard-coded; N = QUESTIONS.length).
 * - Each step is a real radio group in a fieldset whose legend holds the question
 *   heading. Choosing (click, Space, arrow keys) only selects; Next or Enter moves on.
 *   This is deliberate: arrow keys fire `change`, so auto-advancing on change would
 *   throw keyboard and screen-reader users forward while they are still browsing.
 * - Every question is required, so the results view is reachable only with a full
 *   set of answers. Answers live in memory only (no storage, nothing in the URL).
 * - Step changes and the results are announced in one polite live region, and focus
 *   moves to the new question heading or the results heading.
 * - Results: Shop.quiz.scoreProducts ranks the catalogue; sold-out products are
 *   skipped for the top 3 and the "Also consider" row unless too few are in stock.
 * - Wishlist hearts use [data-wish] (ui.js delegation); product cards come from
 *   Shop.ui.productCard. Product text is always escaped.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var ADD_ML = 50;
  var TOP = 3;
  var ALSO = 3;

  var NUMERALS = ['I', 'II', 'III'];
  var RANK_TEXT = ['Closest match', 'Second match', 'Third match'];
  var WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

  // Short names for the step markers and answer chips. Unknown ids/values fall back
  // to the question id and the option label from QUESTIONS.
  var TOPICS = { occasion: 'Occasion', season: 'Season', intensity: 'Strength', family: 'Family', budget: 'Budget' };
  var SHORT = {
    occasion: { daily: 'Everyday', evening: 'Evening', wedding: 'Celebration', gift: 'Gift' },
    season: { summer: 'Summer', winter: 'Winter', all: 'All year' },
    intensity: { light: 'Light', moderate: 'Balanced', strong: 'Strong' },
    family: { oud: 'Oud', woody: 'Woody', floral: 'Floral', fresh: 'Fresh' }
    // budget: the option labels are already short ("Over PKR 12,000")
  };
  // One quiet line under an option, the way a consultant would put it.
  var HINTS = {
    occasion: { daily: 'Office, errands, the school run', evening: 'Dinners and late nights', wedding: 'Mehndi, baraat, walima, Eid', gift: 'Chosen for someone else' },
    season: { summer: 'Light and cooling in the heat', winter: 'Warm and enveloping', all: 'Comfortable in any weather' },
    intensity: { light: 'Close to the skin', moderate: 'Noticed, never loud', strong: 'Fills the room, lasts all night' },
    family: { oud: 'Resinous, smoky, regal', woody: 'Cedar, vetiver, leather', floral: 'Rose, jasmine, peony', fresh: 'Citrus, sea air, green tea' }
  };

  var questions = (Shop.quiz && Shop.quiz.QUESTIONS) || [];
  var N = questions.length;
  var state = { step: 0, answers: {} };
  var quietFocus = false; // true while advance() moves focus and scrolls by itself

  var main = doc.querySelector('.qz');
  var live = doc.querySelector('[data-qz-live]');
  var mastTitle = doc.getElementById('qz-title');
  var views = {
    intro: doc.querySelector('[data-qz-view="intro"]'),
    step: doc.querySelector('[data-qz-view="step"]'),
    results: doc.querySelector('[data-qz-view="results"]')
  };
  var form = doc.querySelector('.qz-form');
  var fieldset = doc.querySelector('[data-qz-fieldset]');
  var heading = doc.querySelector('[data-qz-question]');
  var optionsEl = doc.querySelector('[data-qz-options]');
  var errorEl = doc.querySelector('[data-qz-error]');
  var progressLabel = doc.querySelector('[data-qz-progress-label]');
  var progress = doc.querySelector('[data-qz-progress]');
  var markersEl = doc.querySelector('[data-qz-markers]');
  var backBtn = doc.querySelector('[data-qz-back]');
  var nextLabel = doc.querySelector('[data-qz-next-label]');
  var resultsTitle = doc.querySelector('[data-qz-results-title]');
  var resultsLead = doc.querySelector('[data-qz-results-lead]');
  var chipsEl = doc.querySelector('[data-qz-chips]');
  var matchesEl = doc.querySelector('[data-qz-matches]');
  var alsoEl = doc.querySelector('[data-qz-also]');

  function reducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function topicOf(q) {
    if (TOPICS[q.id]) return TOPICS[q.id];
    var s = String(q.id || '');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function optionOf(q, value) {
    for (var i = 0; i < q.options.length; i++) if (q.options[i].value === value) return q.options[i];
    return null;
  }

  function shortAnswer(q, value) {
    if (SHORT[q.id] && SHORT[q.id][value]) return SHORT[q.id][value];
    var o = optionOf(q, value);
    return o ? o.label : '';
  }

  function announce(text) {
    if (!live) return;
    live.textContent = text;
  }

  function stepText(i) { return 'Question ' + (i + 1) + ' of ' + N; }

  // ------------------------------------------------------------------ views

  function setView(name) {
    Object.keys(views).forEach(function (k) { if (views[k]) views[k].hidden = k !== name; });
    if (main) main.setAttribute('data-qz-state', name);
    // Phones: the step view's Back/Next bar sits at the bottom of the screen.
    doc.body.classList.toggle('has-bottom-bar', name === 'step');
    try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
  }

  function focusNoScroll(node) {
    if (!node) return;
    try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  // ------------------------------------------------------------------ steps

  function buildPreview() {
    var list = doc.querySelector('[data-qz-preview]');
    if (list) {
      list.innerHTML = questions.map(function (q, i) {
        return '<li class="qz-preview__item">' +
          '<span class="qz-preview__num" aria-hidden="true">' + (i + 1) + '</span>' +
          '<span class="qz-preview__topic">' + esc(topicOf(q)) + '</span>' +
          '<span class="qz-preview__q">' + esc(q.text) + '</span></li>';
      }).join('');
      list.style.setProperty('--qz-n', String(N));
    }
    var word = doc.querySelector('[data-qz-count-word]');
    if (word) word.textContent = WORDS[N] || String(N);
  }

  function buildMarkers() {
    markersEl.style.setProperty('--qz-n', String(N));
    markersEl.innerHTML = questions.map(function (q) {
      return '<li class="qz-markers__item" data-state="upcoming">' +
        '<span class="qz-markers__topic">' + esc(topicOf(q)) + '</span>' +
        '<span class="qz-markers__answer" data-qz-marker-answer></span>' +
        '<span class="sr-only" data-qz-marker-state></span></li>';
    }).join('');
  }

  function updateMarkers() {
    Array.prototype.forEach.call(markersEl.children, function (li, i) {
      var q = questions[i];
      var value = state.answers[q.id];
      var st = i === state.step ? 'current' : (value ? 'done' : 'upcoming');
      li.setAttribute('data-state', st);
      if (i === state.step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      var ans = value ? shortAnswer(q, value) : '';
      li.querySelector('[data-qz-marker-answer]').textContent = ans;
      li.querySelector('[data-qz-marker-state]').textContent =
        i === state.step ? ', current question' : (value ? '' : ', not answered yet');
    });
  }

  function optionsHtml(q) {
    var chosen = state.answers[q.id];
    return q.options.map(function (o, i) {
      var id = 'qz-' + state.step + '-' + i;
      var hint = HINTS[q.id] && HINTS[q.id][o.value];
      return '<label class="qz-option" for="' + id + '">' +
        '<input class="qz-option__input" type="radio" id="' + id + '" name="' + esc(q.id) + '" value="' + esc(o.value) + '"' +
          ' required aria-labelledby="' + id + '-label"' + (hint ? ' aria-describedby="' + id + '-hint"' : '') +
          (chosen === o.value ? ' checked' : '') + '>' +
        '<span class="qz-option__text">' +
          '<span class="qz-option__label" id="' + id + '-label">' + esc(o.label) + '</span>' +
          (hint ? '<span class="qz-option__hint" id="' + id + '-hint">' + esc(hint) + '</span>' : '') +
        '</span>' +
      '</label>';
    }).join('');
  }

  function setError(on) {
    errorEl.hidden = !on;
    if (on) fieldset.setAttribute('aria-describedby', 'qz-error');
    else fieldset.removeAttribute('aria-describedby');
  }

  function renderStep(i, opts) {
    opts = opts || {};
    state.step = Math.max(0, Math.min(N - 1, i));
    var q = questions[state.step];
    var text = stepText(state.step);

    heading.textContent = q.text;
    optionsEl.setAttribute('data-count', String(q.options.length));
    optionsEl.innerHTML = optionsHtml(q);
    setError(false);

    progressLabel.textContent = text;
    progress.setAttribute('aria-valuemax', String(N));
    progress.setAttribute('aria-valuenow', String(state.step + 1));
    progress.setAttribute('aria-valuetext', text);
    progress.style.setProperty('--progress-ratio', String((state.step + 1) / N));
    updateMarkers();

    backBtn.disabled = state.step === 0;
    // Static strings only; " question" is dropped visually on phones.
    nextLabel.innerHTML = state.step === N - 1 ? 'See my matches' : 'Next<span class="qz-nav__more"> question</span>';

    if (!reducedMotion()) {
      fieldset.classList.remove('is-entering');
      void fieldset.offsetWidth; // restart the entrance
      fieldset.classList.add('is-entering');
    }

    setView('step');
    announce(text); // the question itself is read once, when focus lands on its heading
    if (opts.focus !== false) focusNoScroll(heading);
  }

  function checkedValue() {
    var q = questions[state.step];
    var el = form.querySelector('input[name="' + q.id + '"]:checked');
    return el ? el.value : null;
  }

  function px(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // Scroll the required-answer error into clear view: below the sticky header and,
  // on phones and tablets, above the Back/Next bar (limits come from the
  // scroll-margin values on .qz-error / .qz-option in pages.css). If the error and
  // the focused first option fit together, keep both in view; otherwise the error
  // wins. No scroll when it is already clear; instant under reduced motion.
  function revealError(card) {
    var es = getComputedStyle(errorEl);
    var er = errorEl.getBoundingClientRect();
    var top = er.top - px(es.scrollMarginTop);
    var bottom = er.bottom + px(es.scrollMarginBottom);
    var vh = window.innerHeight || doc.documentElement.clientHeight;
    if (card) {
      var cardBottom = card.getBoundingClientRect().bottom + px(getComputedStyle(card).scrollMarginBottom);
      if (cardBottom - top <= vh) bottom = Math.max(bottom, cardBottom);
    }
    var delta = 0;
    if (top < 0) delta = top;
    else if (bottom > vh) delta = Math.min(bottom - vh, top);
    if (!delta) return;
    try { window.scrollBy({ top: delta, behavior: reducedMotion() ? 'instant' : 'smooth' }); }
    catch (e) { window.scrollBy(0, delta); }
  }

  function advance(focusEl) {
    var q = questions[state.step];
    var value = checkedValue();
    if (!value) {
      setError(true);
      var first = focusEl || optionsEl.querySelector('input[type="radio"]');
      if (first) {
        // Focus without the browser's own scroll (it would put the first option at
        // the top edge and push the error, which sits above it, out of view).
        quietFocus = true;
        try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
        quietFocus = false;
      }
      revealError(first && first.closest('.qz-option'));
      return;
    }
    state.answers[q.id] = value;
    if (state.step >= N - 1) showResults();
    else renderStep(state.step + 1);
  }

  // ---------------------------------------------------------------- results

  function lowestPrice(p) {
    var min = Infinity;
    (p.sizes || []).forEach(function (s) { if (typeof s.price === 'number' && s.price < min) min = s.price; });
    return isFinite(min) ? min : 0;
  }

  function firstSentence(text) {
    var s = String(text || '').trim();
    var m = /^(.+?[.!?])(\s|$)/.exec(s);
    return m ? m[1] : s;
  }

  function inStock(p) { return Number(p.stock) > 0; }

  // Top 3 and the next 3, skipping sold-out products unless too few are in stock.
  function pick(answers) {
    var ranked = Shop.quiz.scoreProducts(answers, Shop.products || []);
    var available = [];
    var soldOut = [];
    ranked.forEach(function (r) { (inStock(r.product) ? available : soldOut).push(r.product); });
    var top = available.slice(0, TOP);
    var also = available.slice(TOP, TOP + ALSO);
    while (top.length < TOP && soldOut.length) top.push(soldOut.shift());
    while (also.length < ALSO && soldOut.length) also.push(soldOut.shift());
    return { top: top, also: also };
  }

  function wished(id) {
    try { return Shop.store.getWishlist().indexOf(id) >= 0; } catch (e) { return false; }
  }

  function matchHtml(p, i) {
    var id = String(p.id || '');
    var name = p.name || '';
    var slot = 'product-' + id;
    var known = Shop.media && Object.prototype.hasOwnProperty.call(Shop.media, slot);
    var mediaOpts = { className: 'qz-match__image', sizes: '(min-width: 900px) 40vw, 100vw' };
    if (!known) mediaOpts.alt = name;
    var reasons = Shop.quiz.explain(state.answers, p);
    var why = reasons.length
      ? reasons.map(function (r) { return '<li>' + Shop.ui.icon('check') + '<span>' + esc(r) + '</span></li>'; }).join('')
      : '<li>' + Shop.ui.icon('check') + '<span>A well-rounded choice from our collection</span></li>';
    var ok = inStock(p);
    var add = ok
      ? '<button type="button" class="btn btn--ghost qz-match__add" data-qz-add="' + esc(id) + '"' +
          ' aria-label="Add 50 ml to bag: ' + esc(name) + '">' + Shop.ui.icon('bag') + '<span>Add 50 ml to bag</span></button>'
      : '<button type="button" class="btn btn--ghost qz-match__add" data-qz-add="' + esc(id) + '" disabled' +
          ' aria-label="Sold out: ' + esc(name) + '"><span>Sold out</span></button>';
    var reviews = Number(p.reviewCount) || 0;
    var titleId = 'qz-match-' + (i + 1);

    return '<li class="qz-match' + (i === 0 ? ' qz-match--lead' : '') + ' reveal" style="--reveal-delay: ' + (i * 90) + 'ms"' +
        ' data-qz-match data-id="' + esc(id) + '" data-rank="' + (i + 1) + '">' +
      '<article class="qz-match__card" aria-labelledby="' + titleId + '">' +
        '<div class="qz-match__media">' +
          Shop.ui.media(slot, mediaOpts) +
          (ok ? '' : '<span class="badge badge--sold qz-match__badge">Sold out</span>') +
          '<button type="button" class="product-card__wish qz-match__wish" data-wish="' + esc(id) + '"' +
            ' aria-pressed="' + wished(id) + '" aria-label="Add ' + esc(name) + ' to wishlist">' + Shop.ui.icon('heart') + '</button>' +
        '</div>' +
        '<div class="qz-match__body">' +
          '<p class="qz-match__rank"><span class="qz-match__numeral" aria-hidden="true">' + NUMERALS[i] + '</span>' +
            '<span class="qz-match__rank-text"><span class="sr-only">Match ' + (i + 1) + ' of ' + TOP + ': </span>' + RANK_TEXT[i] + '</span></p>' +
          '<p class="qz-match__house">' + esc(p.house) + '</p>' +
          '<h3 class="qz-match__name" id="' + titleId + '">' + esc(name) + '</h3>' +
          '<p class="qz-match__desc">' + esc(firstSentence(p.description)) + '</p>' +
          '<div class="qz-match__meta">' +
            '<span class="price qz-match__price"><span class="price__from">From</span> ' + esc(Shop.util.formatPKR(lowestPrice(p))) + '</span>' +
            '<span class="star-rating">' + Shop.ui.stars(p.rating) +
              '<span class="star-rating__count">' + reviews + '<span class="sr-only"> reviews</span></span></span>' +
          '</div>' +
          '<div class="qz-match__why">' +
            '<h4 class="qz-match__why-title">Why it matches</h4>' +
            '<ul class="qz-match__reasons" data-qz-why>' + why + '</ul>' +
          '</div>' +
          '<div class="qz-match__actions">' +
            '<a class="btn btn--primary qz-match__view" href="product.html?id=' + esc(encodeURIComponent(id)) + '">View fragrance</a>' +
            add +
          '</div>' +
        '</div>' +
      '</article>' +
    '</li>';
  }

  function chipsHtml() {
    return questions.map(function (q) {
      var value = state.answers[q.id] || '';
      return '<li class="chip qz-brief__chip" data-q="' + esc(q.id) + '" data-value="' + esc(value) + '">' +
        '<span class="sr-only">' + esc(topicOf(q)) + ': </span>' + esc(shortAnswer(q, value)) + '</li>';
    }).join('');
  }

  function showResults() {
    var picked = pick(state.answers);
    var total = (Shop.products || []).length;
    resultsLead.textContent = 'Ranked from all ' + total + ' fragrances in our collection against your ' +
      (WORDS[N] ? WORDS[N].toLowerCase() : N) + ' answers.';
    chipsEl.innerHTML = chipsHtml();
    matchesEl.innerHTML = picked.top.map(matchHtml).join('');
    alsoEl.innerHTML = picked.also.map(function (p) { return Shop.ui.productCard(p); }).join('');
    alsoEl.parentNode.hidden = picked.also.length === 0;

    progress.style.setProperty('--progress-ratio', '1');
    setView('results');
    if (Shop.ui.reveal) Shop.ui.reveal();
    announce('Your top matches are ready.');
    focusNoScroll(resultsTitle);
  }

  // ----------------------------------------------------------------- events

  function restart() {
    state.answers = {};
    renderStep(0);
  }

  function retake() {
    state.answers = {};
    state.step = 0;
    matchesEl.innerHTML = '';
    alsoEl.innerHTML = '';
    chipsEl.innerHTML = '';
    setView('intro');
    announce('Your answers are cleared. Begin when you are ready.');
    focusNoScroll(mastTitle);
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-qz-begin]')) { state.answers = {}; renderStep(0); return; }
    if (t.closest('[data-qz-back]')) { if (state.step > 0) renderStep(state.step - 1); return; }
    if (t.closest('[data-qz-restart]')) { restart(); return; }
    if (t.closest('[data-qz-edit]')) { renderStep(0); return; }
    if (t.closest('[data-qz-retake]')) { retake(); return; }
    var add = t.closest('[data-qz-add]');
    if (add && matchesEl.contains(add)) {
      e.preventDefault();
      if (add.disabled) return;
      Shop.store.addToCart(add.getAttribute('data-qz-add'), ADD_ML, 1, false);
      Shop.ui.openCart();
    }
  }

  function onChange(e) {
    var t = e.target;
    if (!t || t.type !== 'radio' || !optionsEl.contains(t)) return;
    state.answers[t.name] = t.value;
    setError(false);
    updateMarkers();
  }

  // Enter on a checked radio moves on. On an unchecked one it selects nothing and shows the
  // required-answer error: Space (native) is the way to choose, so a stray Enter never answers.
  function onKeydown(e) {
    var t = e.target;
    if (e.key !== 'Enter' || !t || t.type !== 'radio' || !optionsEl.contains(t)) return;
    e.preventDefault();
    if (!t.checked) {
      setError(true);
      revealError(t.closest('.qz-option'));
      return;
    }
    advance();
  }

  // Arrow keys move focus between radios without scrolling the whole card into view;
  // bring the focused card into view, clear of the phone bar (see .qz-option
  // scroll-margin in pages.css). Smooth unless reduced motion (html scroll-behavior).
  function onFocusIn(e) {
    if (quietFocus) return;
    var t = e.target;
    if (!t || t.type !== 'radio' || !optionsEl.contains(t)) return;
    var card = t.closest('.qz-option');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
  }

  function onSubmit(e) {
    e.preventDefault();
    advance();
  }

  // ------------------------------------------------------------------- init

  // The intro's atmosphere: the scent clip behind the opening. It starts only
  // while on screen (and the backdrop is hidden, so paused, in every other view).
  function fillBackdrop() {
    var host = doc.querySelector('[data-qz-backdrop]');
    if (!host || host.firstElementChild || !Shop.ui || !Shop.ui.media) return;
    host.innerHTML = Shop.ui.media(host.getAttribute('data-media'), { play: 'inview' });
    if (Shop.ui.watchVideos) Shop.ui.watchVideos(host);
  }

  function init() {
    fillBackdrop();
    if (!main || !form || !N) return;
    buildPreview();
    buildMarkers();
    doc.addEventListener('click', onClick);
    form.addEventListener('submit', onSubmit);
    form.addEventListener('change', onChange);
    form.addEventListener('keydown', onKeydown);
    form.addEventListener('focusin', onFocusIn);
    fieldset.addEventListener('animationend', function () { fieldset.classList.remove('is-entering'); });
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
