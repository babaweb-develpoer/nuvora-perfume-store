const { defineConfig, devices } = require('@playwright/test');

// No spec depends on the network (Task 17c): every page links Google Fonts, and a
// stalled fonts.googleapis.com / fonts.gstatic.com request could hold up the load
// event and time a test out. The browser resolves those two hosts to "not found",
// so the requests fail at once in every context (including ones a spec creates
// with browser.newContext) and pages render with the fallback fonts.
// collectErrors (tests/e2e/helpers.js) ignores these font failures;
// tests/e2e/offline.spec.js checks they fail fast.
const NO_FONT_HOSTS = '--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND';

module.exports = defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], launchOptions: { args: [NO_FONT_HOSTS] } },
  }],
});
