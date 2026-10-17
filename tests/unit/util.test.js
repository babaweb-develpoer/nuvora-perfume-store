const test = require('node:test');
const assert = require('node:assert/strict');
const util = require('../../assets/js/util.js');

test('escapeHtml neutralises markup', () => {
  const out = util.escapeHtml('<img src=x onerror=1>');
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
  assert.equal(out, '&lt;img src=x onerror=1&gt;');
});

test('escapeHtml escapes & < > " \' and coerces non-strings', () => {
  assert.equal(util.escapeHtml('& < > " \''), '&amp; &lt; &gt; &quot; &#39;');
  assert.equal(util.escapeHtml('&amp;'), '&amp;amp;');
  assert.equal(util.escapeHtml(null), '');
  assert.equal(util.escapeHtml(undefined), '');
  assert.equal(util.escapeHtml(42), '42');
  assert.equal(util.escapeHtml(0), '0');
  assert.equal(util.escapeHtml(false), 'false');
  assert.equal(util.escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
});

test('formatPKR formats whole rupees with comma separators', () => {
  assert.equal(util.formatPKR(0), 'PKR 0');
  assert.equal(util.formatPKR(999), 'PKR 999');
  assert.equal(util.formatPKR(1000), 'PKR 1,000');
  assert.equal(util.formatPKR(12500), 'PKR 12,500');
  assert.equal(util.formatPKR(1234567), 'PKR 1,234,567');
  assert.equal(util.formatPKR(1234.6), 'PKR 1,235');
});

test('normalizePKPhone accepts the supported formats', () => {
  const forms = [
    '03001234567',
    '0300-1234567',
    '+92 300 1234567',
    '923001234567',
    '+923001234567',
    '0300 1234567',
    '  0300 123 4567  ',
    '0092 300 1234567',
    '+92-300-1234567',
  ];
  for (const f of forms) {
    assert.equal(util.normalizePKPhone(f), '03001234567', f);
    assert.equal(util.isValidPKPhone(f), true, f);
  }
  assert.equal(util.normalizePKPhone('0345-9876543'), '03459876543');
});

test('normalizePKPhone rejects letters, short, long, foreign numbers', () => {
  const bad = [
    'abc',
    '0300123',
    '+1 202 555 0100',
    '03001234ab',
    '0300-123-4567x',
    '',
    '   ',
    '0300123456', // 10 digits
    '030012345678', // 12 digits
    '02001234567', // not a 03xx mobile prefix
    '+92 200 1234567', // not a mobile prefix
    '9230012345', // short
    '+44 7700 900123',
    '03+001234567', // plus in the middle
  ];
  for (const b of bad) {
    assert.equal(util.normalizePKPhone(b), null, JSON.stringify(b));
    assert.equal(util.isValidPKPhone(b), false, JSON.stringify(b));
  }
  assert.equal(util.normalizePKPhone(null), null);
  assert.equal(util.normalizePKPhone(undefined), null);
  assert.equal(util.normalizePKPhone(3001234567), null);
  assert.equal(util.isValidPKPhone(undefined), false);
});

// ------------------------------------------------------------ order dates

const local = (y, mo, d, h = 12, mi = 0) => new Date(y, mo, d, h, mi).toISOString();

// Copy everywhere: dispatched in 1 to 2 working days, then 2 to 5 working days
// after dispatch, so delivery is 1+2 = 3 to 2+5 = 7 working days after the order.
// Working days are Monday to Saturday; Sundays are skipped.

test('deliveryRange: placed + 3 to + 7 working days within one month', () => {
  // Thu 15 Oct 2026: Fri 16 (1), Sat 17 (2), Mon 19 (3) ... Fri 23 (7); Sun 18 skipped
  assert.equal(util.deliveryRange(local(2026, 9, 15)), 'Mon 19 – Fri 23 Oct');
});

test('deliveryRange: names both months across a month end', () => {
  // Wed 28 Oct 2026: Thu 29 (1), Fri 30 (2), Sat 31 (3) ... Thu 5 Nov (7); Sun 1 Nov skipped
  assert.equal(util.deliveryRange(local(2026, 9, 28)), 'Sat 31 Oct – Thu 5 Nov');
});

test('deliveryRange: a Friday order skips Sunday and never lands on one', () => {
  // Fri 16 Oct 2026: Sat 17 (1), Mon 19 (2), Tue 20 (3) ... Sat 24 (7)
  assert.equal(util.deliveryRange(local(2026, 9, 16)), 'Tue 20 – Sat 24 Oct');
  // Saturday and Sunday orders both count from Monday
  assert.equal(util.deliveryRange(local(2026, 9, 17)), 'Wed 21 – Mon 26 Oct');
  assert.equal(util.deliveryRange(local(2026, 9, 18)), 'Wed 21 – Mon 26 Oct');
});

test('deliveryRange: no day of the week ever gives a Sunday at either end', () => {
  for (let d = 1; d <= 28; d++) {
    const out = util.deliveryRange(local(2026, 10, d));
    assert.ok(out, 'range for Nov ' + d);
    assert.ok(!/Sun/.test(out), 'Nov ' + d + ' -> ' + out);
  }
});

test('deliveryRange: empty for unusable or pre-2000 dates', () => {
  assert.equal(util.deliveryRange(''), '');
  assert.equal(util.deliveryRange(null), '');
  assert.equal(util.deliveryRange(undefined), '');
  assert.equal(util.deliveryRange('not a date'), '');
  assert.equal(util.deliveryRange(new Date(0).toISOString()), '');
  assert.equal(util.deliveryRange(local(1999, 11, 31)), '');
});

test('placedAt: weekday, date, year and 12-hour time', () => {
  assert.equal(util.placedAt(local(2026, 9, 15, 15, 7)), 'Thu 15 Oct 2026 at 3:07 pm');
  assert.equal(util.placedAt(local(2026, 9, 15, 0, 30)), 'Thu 15 Oct 2026 at 12:30 am');
  assert.equal(util.placedAt(new Date(0).toISOString()), '');
  assert.equal(util.placedAt('nope'), '');
});
