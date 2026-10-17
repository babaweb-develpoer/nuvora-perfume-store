/* Style guide page: renders live components from the shared UI API. */
(function () {
  'use strict';
  var Shop = window.Shop;
  var ui = Shop.ui;

  // The shop name in the heading follows config.js, like the rest of the site.
  Array.prototype.forEach.call(document.querySelectorAll('[data-shop-name]'), function (el) {
    el.textContent = (Shop.config && Shop.config.shopName) || '';
  });

  var picks = ['mn-01', 'vn-03', 'au-03', 'sr-02'];
  var cards = picks.map(function (id) {
    var p = Shop.products.filter(function (x) { return x.id === id; })[0];
    return p ? ui.productCard(p) : '';
  });
  document.getElementById('sg-products').innerHTML = cards.join('');

  document.getElementById('sg-stars').innerHTML = ui.stars(4.7) +
    '<span class="star-rating__count">4.7 from 212 reviews</span>';

  document.getElementById('sg-media-grid').innerHTML =
    ui.media('hero-video') + ui.media('cat-women') + ui.media('lifestyle-2');

  document.getElementById('sg-toast').addEventListener('click', function () {
    ui.toast('Added to your bag');
  });

  // Example chips toggle their pressed state.
  Array.prototype.forEach.call(document.querySelectorAll('.chip[aria-pressed]'), function (chip) {
    chip.addEventListener('click', function () {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
    });
  });

  ui.reveal();
})();
