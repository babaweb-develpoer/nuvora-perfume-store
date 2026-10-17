/*
 * Product catalogue: 12 fictional fragrances across 4 fictional houses.
 * Prices are PKR. `images[0]` matches the media manifest slot product-<id>.
 * Product shape: { id, slug, name, house, gender, family, notes{top,heart,base},
 *   description, sizes[{ml,price}], stock, images[], rating, reviewCount, tags[], createdAt }
 */
(function () {
  function p(id, name, house, gender, family, notes, description, prices, stock, rating, reviewCount, tags, createdAt) {
    return {
      id: id,
      slug: name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      name: name,
      house: house,
      gender: gender,
      family: family,
      notes: notes,
      description: description,
      sizes: [
        { ml: 30, price: prices[0] },
        { ml: 50, price: prices[1] },
        { ml: 100, price: prices[2] },
      ],
      stock: stock,
      images: ['assets/img/product-' + id + '.jpg'],
      rating: rating,
      reviewCount: reviewCount,
      tags: tags,
      createdAt: createdAt,
    };
  }

  var api = [
    // Maison Noor - oud
    p('mn-01', 'Oud Royale', 'Maison Noor', 'unisex', 'oud',
      { top: ['Saffron', 'Cardamom'], heart: ['Aged Cambodian Oud', 'Damask Rose'], base: ['Amber Resin', 'Sandalwood', 'Musk'] },
      'A ceremonial oud aged in cedar casks until it turns dark, smooth and resinous. Saffron opens like a lit lantern, then rose softens the smoke into something regal. It lingers on silk and skin well into the following morning.',
      [7800, 12400, 21500], 24, 4.8, 212, ['bestseller', 'signature', 'gift', 'evening'], '2026-01-22'),
    p('mn-02', 'Amber Nights', 'Maison Noor', 'men', 'oud',
      { top: ['Black Pepper', 'Bergamot'], heart: ['Labdanum', 'Smoked Oud'], base: ['Golden Amber', 'Vanilla Bean', 'Tonka'] },
      'Warm amber poured over smoldering oud, built for cool winter dinners and long conversations. Black pepper adds a dry spark before vanilla and tonka settle in like firelight. Bold, enveloping and unmistakably confident.',
      [7200, 11500, 19800], 3, 4.7, 156, ['bestseller', 'evening', 'winter'], '2026-03-08'),
    p('mn-03', 'Rose Oud', 'Maison Noor', 'women', 'oud',
      { top: ['Pink Pepper', 'Lychee'], heart: ['Taif Rose', 'Oud Heartwood'], base: ['Patchouli', 'White Musk', 'Cedarwood'] },
      'Velvet petals of Taif rose wrapped around a quiet thread of oud wood. The result is opulent without heaviness, a bridal-night perfume with a shadow of smoke. It blooms slowly and stays close to the skin.',
      [6800, 10900, 18900], 17, 4.6, 134, ['signature', 'evening', 'gift'], '2026-04-19'),

    // Velluto Nero - woody
    p('vn-01', 'Black Leather', 'Velluto Nero', 'men', 'woody',
      { top: ['Juniper Berry', 'Cardamom'], heart: ['Suede Accord', 'Smoked Birch'], base: ['Dark Leather', 'Patchouli', 'Amber'] },
      'The scent of a well-worn leather jacket after a late night in the city. Juniper and cardamom add a cool edge to smoked birch and supple suede. Dark, tailored and quietly magnetic.',
      [6400, 10200, 17500], 31, 4.7, 189, ['bestseller', 'gift', 'evening'], '2026-02-05'),
    p('vn-02', 'Cedar & Smoke', 'Velluto Nero', 'men', 'woody',
      { top: ['Grapefruit Peel', 'Pink Pepper'], heart: ['Atlas Cedar', 'Incense'], base: ['Vetiver', 'Guaiac Wood', 'Oakmoss'] },
      'Atlas cedar warmed by drifting incense, like a mountain lodge at dusk. A flicker of grapefruit keeps the smoke crisp and clean. Reliable, rugged and easy to wear every day.',
      [5800, 9400, 15900], 4, 4.4, 97, ['daily', 'winter'], '2026-05-14'),
    p('vn-03', 'Midnight Vetiver', 'Velluto Nero', 'unisex', 'woody',
      { top: ['Black Currant', 'Mandarin'], heart: ['Haitian Vetiver', 'Iris'], base: ['Cypriol', 'Cashmere Wood', 'Ambroxan'] },
      'Cool, green vetiver rooted in dark earth and brushed with powdery iris. Black currant gives the opening a glossy, nocturnal sweetness. A modern woody scent that suits any hour after sunset.',
      [6200, 9900, 16800], 19, 4.5, 68, ['new', 'evening', 'daily'], '2026-09-04'),

    // Aurelle - floral
    p('au-01', 'Rose Eternelle', 'Aurelle', 'women', 'floral',
      { top: ['Pink Grapefruit', 'Raspberry'], heart: ['Bulgarian Rose', 'Peony'], base: ['Soft Musk', 'Blonde Woods', 'Vanilla'] },
      'A full-blooming Bulgarian rose lifted by sparkling fruit and cushioned by soft musk. Romantic and luminous, it feels like a bouquet carried through morning light. A timeless gift for the woman who has everything.',
      [5200, 8400, 13900], 42, 4.9, 240, ['bestseller', 'signature', 'gift', 'daily'], '2026-01-30'),
    p('au-02', 'Jasmine Silk', 'Aurelle', 'women', 'floral',
      { top: ['Neroli', 'Pear'], heart: ['Sambac Jasmine', 'Tuberose'], base: ['Sandalwood', 'Cashmere Musk'] },
      'Creamy jasmine sambac spun into a smooth, sensuous veil. Neroli and pear brighten the first moments before tuberose adds a hush of warmth. Soft as silk against the skin.',
      [4900, 7900, 13200], 28, 4.6, 118, ['daily', 'summer'], '2026-06-11'),
    p('au-03', 'Peony Blush', 'Aurelle', 'women', 'floral',
      { top: ['Lychee', 'Bergamot'], heart: ['Peony', 'Freesia', 'Magnolia'], base: ['White Cedar', 'Musk', 'Ambrette'] },
      'Dewy peony petals and pink lychee in a light, airy bloom. Freesia and magnolia keep it fresh while white musk leaves a gentle, glowing trail. Effortless for warm afternoons and weddings.',
      [4400, 7200, 11800], 0, 4.3, 41, ['new', 'gift', 'summer'], '2026-09-26'),

    // Sahara Royale - fresh
    p('sr-01', 'Citrus Dune', 'Sahara Royale', 'unisex', 'fresh',
      { top: ['Sicilian Lemon', 'Mandarin', 'Ginger'], heart: ['Neroli', 'Green Tea'], base: ['White Musk', 'Driftwood', 'Amber'] },
      'A burst of sun-warmed citrus drifting over pale desert sand. Ginger adds a bright sparkle while white musk and driftwood keep it smooth and clean. The scent of a summer morning that never quite ends.',
      [3900, 6300, 10400], 55, 4.5, 176, ['bestseller', 'gift', 'summer', 'daily'], '2026-02-18'),
    p('sr-02', 'Aqua Oasis', 'Sahara Royale', 'men', 'fresh',
      { top: ['Sea Salt', 'Cucumber', 'Lemon'], heart: ['Water Lily', 'Sage'], base: ['Ambergris', 'Cedar', 'Musk'] },
      'Cool water and sea salt over green sage, like stepping into shade after a long walk in the heat. Crisp, aquatic and refreshing without ever feeling sharp. Made for gym bags, office days and weekend escapes.',
      [3600, 5900, 9600], 5, 4.2, 83, ['daily', 'summer'], '2026-07-02'),
    p('sr-03', 'Bergamot Breeze', 'Sahara Royale', 'unisex', 'fresh',
      { top: ['Calabrian Bergamot', 'Grapefruit'], heart: ['Jasmine Tea', 'Mint'], base: ['Vetiver', 'Light Musk', 'Cedar'] },
      'Sparkling bergamot cooled with mint and jasmine tea, light as a desert breeze at sunrise. The dry vetiver base gives it quiet elegance and impressive staying power. An easy signature for anyone who prefers clean over heavy.',
      [3800, 6100, 10000], 36, 4.4, 59, ['new', 'summer', 'daily'], '2026-09-14'),
  ];

  if (typeof module !== 'undefined') module.exports = api;
  else { window.Shop = window.Shop || {}; window.Shop.products = api; }
})();
