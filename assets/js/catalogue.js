/* Catalogue: filter, sort, URL query round-trip and related products.
   Pure functions, no DOM, no dependencies on other project modules. */
(function () {
  'use strict';

  var QUERY_ORDER = ['q', 'houses', 'genders', 'families', 'sizes', 'minPrice', 'maxPrice'];
  var ARRAY_KEYS = { houses: 1, genders: 1, families: 1 };

  function lowestPrice(p) {
    var sizes = (p && p.sizes) || [];
    var min = Infinity;
    for (var i = 0; i < sizes.length; i++) {
      if (typeof sizes[i].price === 'number' && sizes[i].price < min) min = sizes[i].price;
    }
    return min;
  }

  function isFiniteNumber(n) {
    return typeof n === 'number' && isFinite(n);
  }

  function nonEmptyArray(a) {
    return Array.isArray(a) && a.length > 0;
  }

  function flattenNotes(notes) {
    if (!notes) return [];
    if (typeof notes === 'string') return [notes];
    if (Array.isArray(notes)) return notes.map(String);
    var out = [];
    ['top', 'heart', 'base'].forEach(function (tier) {
      var v = notes[tier];
      if (Array.isArray(v)) out = out.concat(v.map(String));
      else if (v) out.push(String(v));
    });
    return out;
  }

  // Free-text haystack for substring matching (gender is matched exactly, see matchesWord).
  function haystack(p) {
    return [p.name, p.house, p.family, p.description]
      .concat(flattenNotes(p.notes))
      .concat(p.tags || [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function matchesQuery(p, words) {
    var text = haystack(p);
    var gender = String(p.gender || '').toLowerCase();
    for (var i = 0; i < words.length; i++) {
      // gender is compared whole so "men" does not match "women"
      if (text.indexOf(words[i]) === -1 && gender !== words[i]) return false;
    }
    return true;
  }

  function filterProducts(products, f) {
    var list = Array.isArray(products) ? products : [];
    f = f || {};
    var q = typeof f.q === 'string' ? f.q.trim().toLowerCase() : '';
    var words = q ? q.split(/\s+/) : [];
    var hasHouses = nonEmptyArray(f.houses);
    var hasGenders = nonEmptyArray(f.genders);
    var hasFamilies = nonEmptyArray(f.families);
    var hasSizes = nonEmptyArray(f.sizes);
    var hasMin = isFiniteNumber(f.minPrice);
    var hasMax = isFiniteNumber(f.maxPrice);

    return list.filter(function (p) {
      if (words.length && !matchesQuery(p, words)) return false;
      if (hasHouses && f.houses.indexOf(p.house) === -1) return false;
      if (hasGenders && f.genders.indexOf(p.gender) === -1) return false;
      if (hasFamilies && f.families.indexOf(p.family) === -1) return false;
      if (hasSizes) {
        var offered = (p.sizes || []).some(function (s) {
          return f.sizes.indexOf(s.ml) !== -1;
        });
        if (!offered) return false;
      }
      if (hasMin || hasMax) {
        var price = lowestPrice(p);
        if (hasMin && price < f.minPrice) return false;
        if (hasMax && price > f.maxPrice) return false;
      }
      return true;
    });
  }

  function cmpName(a, b) {
    var x = String(a.name || '');
    var y = String(b.name || '');
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function byRating(a, b) {
    return (b.rating || 0) - (a.rating || 0) || (b.reviewCount || 0) - (a.reviewCount || 0);
  }

  function isBestseller(p) {
    return (p.tags || []).indexOf('bestseller') !== -1;
  }

  var COMPARATORS = {
    featured: function (a, b) {
      return (isBestseller(b) ? 1 : 0) - (isBestseller(a) ? 1 : 0) || byRating(a, b);
    },
    'price-asc': function (a, b) {
      return lowestPrice(a) - lowestPrice(b) || cmpName(a, b);
    },
    'price-desc': function (a, b) {
      return lowestPrice(b) - lowestPrice(a) || cmpName(a, b);
    },
    rating: byRating,
    newest: function (a, b) {
      var x = String(a.createdAt || '');
      var y = String(b.createdAt || '');
      return x < y ? 1 : x > y ? -1 : 0;
    }
  };

  // Non-mutating, stable (ties keep input order).
  function sortProducts(list, key) {
    var cmp = Object.prototype.hasOwnProperty.call(COMPARATORS, key) ? COMPARATORS[key] : COMPARATORS.featured;
    return (Array.isArray(list) ? list : [])
      .map(function (p, i) {
        return { p: p, i: i };
      })
      .sort(function (a, b) {
        return cmp(a.p, b.p) || a.i - b.i;
      })
      .map(function (x) {
        return x.p;
      });
  }

  function toQuery(f) {
    f = f || {};
    var parts = [];
    QUERY_ORDER.forEach(function (key) {
      var v = f[key];
      if (key === 'q') {
        if (typeof v === 'string' && v.trim()) parts.push('q=' + encodeURIComponent(v.trim()));
      } else if (key === 'minPrice' || key === 'maxPrice') {
        if (isFiniteNumber(v)) parts.push(key + '=' + encodeURIComponent(String(v)));
      } else if (nonEmptyArray(v)) {
        parts.push(key + '=' + v.map(function (x) { return encodeURIComponent(String(x)); }).join(','));
      }
    });
    return parts.join('&');
  }

  function safeDecode(s) {
    var spaced = String(s).replace(/\+/g, ' ');
    try {
      return decodeURIComponent(spaced);
    } catch (e) {
      return spaced;
    }
  }

  function toNumber(s) {
    s = String(s).trim();
    if (s === '') return NaN;
    return Number(s);
  }

  function parseQuery(search) {
    var out = {};
    if (typeof search !== 'string') return out;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    if (!s) return out;
    s.split('&').forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf('=');
      var key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
      var raw = eq === -1 ? '' : pair.slice(eq + 1);
      if (QUERY_ORDER.indexOf(key) === -1) return;
      if (key === 'q') {
        var q = safeDecode(raw).trim();
        if (q) out.q = q;
      } else if (key === 'minPrice' || key === 'maxPrice') {
        var n = toNumber(safeDecode(raw));
        if (isFiniteNumber(n)) out[key] = n;
      } else if (key === 'sizes') {
        var nums = raw.split(',').map(function (x) { return toNumber(safeDecode(x)); }).filter(isFiniteNumber);
        if (nums.length) out.sizes = nums;
      } else if (ARRAY_KEYS[key]) {
        var vals = raw.split(',').map(safeDecode).filter(function (x) { return x !== ''; });
        if (vals.length) out[key] = vals;
      }
    });
    return out;
  }

  function relatedProducts(product, all, n) {
    if (!product || !Array.isArray(all)) return [];
    var max = n === undefined ? 4 : n;
    if (!(max > 0)) return [];
    var seen = {};
    seen[product.id] = true;
    var result = [];
    var pool = all.filter(function (p) { return p && p.id !== product.id; });
    var tiers = [
      function (p) { return p.family === product.family; },
      function (p) { return p.gender === product.gender; },
      function (p) { return p.house === product.house; }
    ];
    tiers.forEach(function (test) {
      var tier = sortProducts(pool.filter(function (p) { return !seen[p.id] && test(p); }), 'rating');
      tier.forEach(function (p) {
        if (result.length < max && !seen[p.id]) {
          seen[p.id] = true;
          result.push(p);
        }
      });
    });
    return result;
  }

  var api = {
    filterProducts: filterProducts,
    sortProducts: sortProducts,
    toQuery: toQuery,
    parseQuery: parseQuery,
    relatedProducts: relatedProducts
  };

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.catalogue = api; }
})();
