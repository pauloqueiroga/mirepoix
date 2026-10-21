// Renders app/icons/icon.svg to the PNG sizes home screens need. iOS only
// takes PNG touch icons, and Chrome wants 192 and 512 px PNGs to install.
// Run `npm run icons` after changing the SVG, and keep the PNGs in the repo.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const icons = new URL('../app/icons/', import.meta.url);
const sizes = { 'icon-192.png': 192, 'icon-512.png': 512, 'apple-touch-icon.png': 180 };

const svg = await readFile(new URL('icon.svg', icons), 'utf8');
const browser = await chromium.launch();
try {
  for (const [file, size] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>*{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: fileURLToPath(new URL(file, icons)) });
    await page.close();
    console.log(`${file} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
