/*
 * Wishlist: the products saved in this browser (store.getWishlist()), shown as
 * product cards with a "Move to bag" button under each.
 *
 * - Hearts and quick add are wired by ui.js delegation; this page only reacts to
 *   store changes. Un-hearting a card removes just that card, and focus moves to
 *   the neighbouring card (or the empty-state heading) instead of being lost.
 * - Move to bag adds the product at 50 ml x1, takes it off the wishlist and opens
 *   the bag. A sold-out product gets a disabled "Sold out" button and is never added.
 * - "Move all available" (shown with two or more purchasable items) does the same
 *   for every in-stock item at once, with a single toast.
 * - Ids that no longer exist in the catalogue are ignored and never counted.
 */
(function () {
  'use strict';

  var Shop = window.Shop || {};
  var doc = document;
  var esc = Shop.util.escapeHtml;
  var MOVE_ML = 50;

  var grid = doc.querySelector('[data-wl-grid]');
  var gridTitle = doc.getElementById('wl-grid-title');
  var empty = doc.querySelector('[data-wl-empty]');
  var emptyTitle = doc.querySelector('.wl-empty__title');
  var countEl = doc.querySelector('[data-wl-count]');
  var moveAll = doc.querySelector('[data-move-all]');
  var statusEl = doc.querySelector('[data-wl-status]');
  var rendered = []; // ids currently in the grid, in order

  function store() { return Shop.store; }

  function findProduct(id) {
    var list = Shop.products || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function isPurchasable(p) { return !!p && Number(p.stock) > 0; }

  // Saved ids that still exist in the catalogue, in the order they were saved.
  function currentIds() {
    var ids = [];
    try { ids = store().getWishlist(); } catch (e) { ids = []; }
    return ids.filter(function (id) { return !!findProduct(id); });
  }

  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // ---------------------------------------------------------------- markup

  function itemHtml(id) {
    var p = findProduct(id);
    var name = p.name || '';
    var ok = isPurchasable(p);
    var button = ok
      ? '<button type="button" class="btn btn--ghost btn--sm btn--block wl-item__move" data-move-to-bag="' + esc(id) + '"' +
          ' aria-label="Move ' + esc(name) + ' to bag">' + Shop.ui.icon('bag') + '<span>Move to bag</span></button>'
      : '<button type="button" class="btn btn--ghost btn--sm btn--block wl-item__move" data-move-to-bag="' + esc(id) + '" disabled' +
          ' aria-label="' + esc(name) + ' is sold out">' + '<span>Sold out</span></button>';
    return '<li class="wl-item" data-id="' + esc(id) + '">' +
      Shop.ui.productCard(p) +
      '<div class="wl-item__foot">' + button + '</div>' +
    '</li>';
  }

  function renderAll(ids) {
    grid.innerHTML = ids.map(itemHtml).join('');
    rendered = ids.slice();
  }

  // Count, empty state, bulk button and the screen-reader status line.
  function updateChrome(note) {
    var n = rendered.length;
    var buyable = rendered.filter(function (id) { return isPurchasable(findProduct(id)); }).length;
    if (countEl) countEl.textContent = String(n);
    grid.hidden = n === 0;
    if (gridTitle) gridTitle.hidden = n === 0;
    empty.hidden = n !== 0;
    if (moveAll) {
      moveAll.hidden = buyable < 2;
      moveAll.textContent = 'Move all available to bag';
    }
    if (statusEl) {
      statusEl.textContent = (note ? note + ' ' : '') + (n === 0 ? 'Your wishlist is empty.' : n + (n === 1 ? ' fragrance' : ' fragrances') + ' in your wishlist.');
    }
  }

  // ----------------------------------------------------------------- focus

  function itemNodes() { return Array.prototype.slice.call(grid.querySelectorAll('.wl-item')); }

  // After removing item(s), send focus to the same kind of control on the card now
  // at `index` (or the last card), else to the empty-state heading.
  function focusNear(index, kind) {
    var nodes = itemNodes();
    if (!nodes.length) {
      if (emptyTitle) emptyTitle.focus();
      return;
    }
    var node = nodes[Math.min(index, nodes.length - 1)];
    var target = null;
    if (kind === 'move') target = node.querySelector('[data-move-to-bag]:not(:disabled)');
    if (!target) target = node.querySelector('[data-wish]');
    if (target) target.focus();
  }

  // ---------------------------------------------------------- store changes

  function onChange() {
    var ids = currentIds();
    if (sameList(ids, rendered)) { updateChrome(); return; }

    var removedOnly = rendered.length > ids.length && ids.every(function (id) { return rendered.indexOf(id) >= 0; });
    if (!removedOnly) {
      renderAll(ids);
      updateChrome();
      return;
    }

    var active = doc.activeElement;
    var focusIndex = -1;
    var kind = '';
    var nodes = itemNodes();
    rendered.forEach(function (id, i) {
      if (ids.indexOf(id) >= 0) return;
      var node = nodes[i];
      if (!node) return;
      if (active && node.contains(active) && focusIndex < 0) {
        focusIndex = i;
        kind = active.hasAttribute('data-move-to-bag') ? 'move' : 'wish';
      }
      node.parentNode.removeChild(node);
    });
    rendered = ids.slice();
    updateChrome();
    if (focusIndex >= 0) {
      // the removed node took cards at lower indices with it; recompute the slot
      var removedBefore = 0;
      nodes.forEach(function (n, i) { if (i < focusIndex && !n.parentNode) removedBefore++; });
      focusNear(focusIndex - removedBefore, kind);
    }
  }

  // --------------------------------------------------------------- actions

  function moveOne(id) {
    var p = findProduct(id);
    if (!isPurchasable(p)) return;
    store().addToCart(id, MOVE_ML, 1, false);
    var saved = false;
    try { saved = store().getWishlist().indexOf(id) >= 0; } catch (e) { saved = false; }
    if (saved) store().toggleWishlist(id);
    Shop.ui.openCart();
  }

  function moveEverything() {
    var ids = currentIds().filter(function (id) { return isPurchasable(findProduct(id)); });
    if (ids.length < 2) return;
    ids.forEach(function (id) { store().addToCart(id, MOVE_ML, 1, false); });
    var saved = store().getWishlist();
    ids.forEach(function (id) { if (saved.indexOf(id) >= 0) store().toggleWishlist(id); });
    var msg = ids.length + ' fragrances moved to your bag';
    Shop.ui.toast(msg, { action: { label: 'View bag', onClick: function () { Shop.ui.openCart(); } } });
    if (statusEl) statusEl.textContent = msg + '.';
    focusNear(0, 'wish');
  }

  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var one = t.closest('[data-move-to-bag]');
    if (one && grid.contains(one)) {
      e.preventDefault();
      if (one.disabled) return;
      moveOne(one.getAttribute('data-move-to-bag'));
      return;
    }
    var all = t.closest('[data-move-all]');
    if (all) {
      e.preventDefault();
      moveEverything();
    }
  }

  // ------------------------------------------------------------------ init

  function init() {
    if (!grid || !empty) return;
    var mark = doc.querySelector('[data-wl-empty-mark]');
    if (mark) mark.innerHTML = Shop.ui.icon('heart');

    // The header heart is this page's own link.
    var navHeart = doc.querySelector('.site-header__wishlist');
    if (navHeart) navHeart.setAttribute('aria-current', 'page');

    renderAll(currentIds());
    updateChrome();

    doc.addEventListener('click', onClick);
    store().onChange(onChange);
    doc.body.setAttribute('data-ready', '');
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
