// Development server for app/ (D3): static files only, no packages.
// It sends the security headers production will send (D7), so a policy
// violation shows up while developing instead of after a deploy.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const APP_ROOT = fileURLToPath(new URL('../app/', import.meta.url));

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self' https://api.github.com",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/**
 * Maps a request path to a file under root, or returns null when the path is
 * malformed or would escape root.
 * @param {string} root
 * @param {string} urlPath the request's pathname, still URL-encoded
 * @returns {string | null}
 */
export function resolveFile(root, urlPath) {
  let path;
  try {
    path = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (path.includes('\0') || path.includes('\\')) return null;
  if (path.endsWith('/')) path += 'index.html';
  const base = resolve(root);
  const file = resolve(base, '.' + path);
  return file.startsWith(base + sep) ? file : null;
}

/**
 * @param {string} file
 * @returns {string}
 */
export function contentType(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * @param {{ root?: string }} [options]
 */
export function createDevServer({ root = APP_ROOT } = {}) {
  return createServer(async (req, res) => {
    const headers = { ...SECURITY_HEADERS, 'Cache-Control': 'no-store' };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = resolveFile(root, new URL(req.url ?? '/', 'http://localhost').pathname);
    const body = file && (await readFile(file).catch(() => null));
    if (!file || !body) {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Type': contentType(file) });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 5173);
  createDevServer().listen(port, 'localhost', () => {
    console.log(`Mirepoix dev server: http://localhost:${port}/`);
  });
}
