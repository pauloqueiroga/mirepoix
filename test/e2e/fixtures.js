// Shared setup for the browser tests. The shipped app/config.js holds the real
// Google Analytics ID, so every test browser gets a config with none, and no
// consent banner gets in the way. Tests about analytics turn it back on with
// a page-level route, which takes precedence over this one.
import { test as base, expect } from '@playwright/test';

/**
 * Serves a config.js with analytics switched off.
 * @param {import('@playwright/test').Page | import('@playwright/test').BrowserContext} target
 */
export async function withoutAnalytics(target) {
  await target.route('**/config.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: "export const ANALYTICS_ID = '';" }));
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await withoutAnalytics(context);
    await use(context);
  },
});

export { expect };
