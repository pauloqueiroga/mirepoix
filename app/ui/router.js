// Hash routes ("#/recipes/abc"): they work from any folder on any static host
// and never reach the server.

/**
 * @typedef {{ name: string, path: string }} RouteDef  path like "/recipes/:id"
 * @typedef {{ name: string, params: Record<string, string> }} Route
 */

/**
 * Finds the first route matching a location hash.
 * @param {RouteDef[]} routes
 * @param {string} hash e.g. location.hash
 * @returns {Route | null}
 */
export function matchRoute(routes, hash) {
  const parts = segments(hash.replace(/^#/, ''));
  for (const route of routes) {
    const pattern = segments(route.path);
    if (pattern.length !== parts.length) continue;
    /** @type {Record<string, string>} */
    const params = {};
    const matches = pattern.every((segment, i) => {
      const part = /** @type {string} */ (parts[i]);
      if (!segment.startsWith(':')) return segment === part;
      try {
        params[segment.slice(1)] = decodeURIComponent(part);
        return true;
      } catch {
        return false;
      }
    });
    if (matches) return { name: route.name, params };
  }
  return null;
}

/** @param {string} path */
function segments(path) {
  return path.split('/').filter(Boolean);
}
