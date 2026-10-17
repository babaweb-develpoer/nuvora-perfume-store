/*
 * Brands page: every figure a house section shows (how many fragrances it has,
 * its lowest and highest size price, and the names in its range) is computed
 * from Shop.products, so a catalogue change never leaves stale copy behind.
 * Each house section carries data-house="<exact house name>".
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var esc = Shop.util.escapeHtml;
  var pkr = Shop.util.formatPKR;

  function houseFacts(name) {
    var list = (Shop.products || []).filter(function (p) { return p && p.house === name; });
    var prices = [];
    list.forEach(function (p) {
      (p.sizes || []).forEach(function (s) { if (typeof s.price === 'number') prices.push(s.price); });
    });
    return {
      products: list,
      min: prices.length ? Math.min.apply(null, prices) : 0,
      max: prices.length ? Math.max.apply(null, prices) : 0
    };
  }

  function render() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-house]'), function (sec) {
      var name = sec.getAttribute('data-house');
      var f = houseFacts(name);
      var n = f.products.length;

      var count = sec.querySelector('[data-house-count]');
      if (count) count.textContent = n + (n === 1 ? ' fragrance' : ' fragrances');

      var range = sec.querySelector('[data-house-range]');
      if (range) {
        range.innerHTML = n
          ? '<span class="br-nowrap">' + esc(pkr(f.min)) + '</span> to <span class="br-nowrap">' + esc(pkr(f.max)) + '</span>'
          : 'Coming soon';
      }

      var scents = sec.querySelector('[data-house-scents]');
      if (scents) {
        scents.innerHTML = n
          ? '<span class="br-house__scents-label">In the collection</span> ' + f.products.map(function (p) {
              return '<a class="br-link" href="product.html?id=' + esc(encodeURIComponent(p.id)) + '">' + esc(p.name) + '</a>';
            }).join(', ')
          : '';
      }

      var cta = sec.querySelector('[data-house-cta]');
      if (cta) cta.setAttribute('href', 'shop.html?houses=' + encodeURIComponent(name));
    });
  }

  Shop.content.page(render);
})();
