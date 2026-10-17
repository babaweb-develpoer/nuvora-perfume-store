const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../../assets/js/config.js');

test('config basics', () => {
  assert.equal(config.currency, 'PKR');
  assert.equal(config.freeDeliveryThreshold, 8000);
  assert.equal(config.deliveryFee, 250);
  assert.equal(config.giftWrapFee, 300);
});

test('portfolio framing: Nuvora, fictional non-functional contact details, notice, credit, showcase, noindex', () => {
  assert.equal(config.shopName, 'Nuvora');
  assert.equal(config.whatsapp, '', 'no WhatsApp number: no wa.me links anywhere');
  assert.equal(config.email, 'hello@nuvora.example');
  assert.match(config.email, /\.example$/, 'reserved .example domain: never delivered');
  assert.equal(config.address, 'Gulberg, Lahore');
  assert.ok(!/\d/.test(config.address), 'no street number');
  assert.equal(config.conceptNotice, 'Concept store: orders and messages are not delivered.');
  assert.deepEqual(config.credit, { name: '', url: '' });
  assert.equal(config.showcasePages, true);
  assert.equal(config.indexable, false);
  assert.equal(config.demoBanner, false);
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') assert.ok(!/\bdemo\b/i.test(v), k + ' says demo: ' + v);
  }
});

test('discount codes', () => {
  assert.deepEqual(config.codes.WELCOME10, { type: 'percent', value: 10, min: 0 });
  assert.deepEqual(config.codes.GIFT15, { type: 'percent', value: 15, min: 10000 });
});
