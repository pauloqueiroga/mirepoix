// Renders the PNG images: app/icons/icon.svg at the sizes home screens need
// (iOS only takes PNG touch icons; Chrome wants 192 and 512 px to install), and
// the 1200×630 share preview for links (R1.15) from the stacked logo.
// Run `npm run logos` first, then `npm run icons`; keep the PNGs in the repo.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const icons = new URL('../app/icons/', import.meta.url);
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const svg = await readFile(new URL('icon.svg', icons), 'utf8');
const stacked = (await readFile(new URL('logo-stacked.svg', icons))).toString('base64');
const browser = await chromium.launch();
try {
  for (const [file, size] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: fileURLToPath(new URL(file, icons)) });
    await page.close();
    console.log(`${file} (${size}×${size})`);
  }

  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<style>
    * { margin: 0 }
    body { display: grid; place-items: center; height: 100vh; background: #FBF8F3 }
    img { height: 520px }
  </style>
  <img src="data:image/svg+xml;base64,${stacked}" alt="">`);
  await page.locator('img').evaluate((img) => /** @type {HTMLImageElement} */ (img).decode());
  await page.screenshot({ path: fileURLToPath(new URL('social.png', icons)) });
  console.log('social.png (1200×630)');
} finally {
  await browser.close();
}
