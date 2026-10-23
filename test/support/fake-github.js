// A stand-in for the part of GitHub's REST API that Mirepoix uses (R2.2):
// repositories, branch heads, trees, and reading, writing and deleting files
// guarded by their version. Tests never touch real GitHub (D12). Unit tests
// call it through fetch(); browser tests route api.github.com to it, so
// several test browsers can share one "GitHub", like devices sharing a repo.
//
// It answers the way GitHub does where Mirepoix depends on it:
// - versions are git blob SHAs, so the same bytes always have the same version
// - creating a file that exists, without its sha: 422 '"sha" wasn't supplied'
// - writing or deleting over a version that moved on: 409
// - a repository with no commits: 409 "Git Repository is empty."
// - a bad, expired or revoked token: 401; a repository the token can't see: 404;
//   a write with a read-only token: 403
// - every answer allows any origin, like api.github.com does
import { createHash } from 'node:crypto';

/** @typedef {{ status: number, headers: Record<string, string>, body: string }} Answer */
/** @typedef {{ repos: Set<string>, write: boolean }} Grant */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type, If-Match, If-None-Match, X-GitHub-Api-Version',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
  'access-control-expose-headers': 'ETag, X-RateLimit-Remaining',
};

/** @param {string} text */
const sha1 = (text) => createHash('sha1').update(text).digest('hex');
/** Git's own blob id for some text. @param {string} text */
const blobSha = (text) => sha1(`blob ${Buffer.byteLength(text)}\0${text}`);

export function createFakeGitHub() {
  /** @type {Map<string, { private: boolean, branch: string, head: string | null, commits: Map<string, { files: Map<string, string>, parent: string | null }> }>} */
  const repos = new Map();
  /** @type {Map<string, string>} blob sha → text */
  const blobs = new Map();
  /** @type {Map<string, Grant>} */
  const tokens = new Map();
  /** @type {{ method: string, path: string }[]} */
  const requests = [];
  let commits = 0;
  /** @type {{ match: RegExp, status: number, times: number }[]} */
  const faults = [];

  const fake = {
    /** Every request answered so far, oldest first. */
    requests,
    /** When true, every request fails as if the network were down. */
    offline: false,

    /**
     * @param {string} name "owner/name"
     * @param {{ private?: boolean, branch?: string, files?: Record<string, string> }} [options] files: a first commit
     */
    addRepo(name, { private: isPrivate = true, branch = 'main', files } = {}) {
      repos.set(name, { private: isPrivate, branch, head: null, commits: new Map() });
      if (files) commit(name, new Map(Object.entries(files).map(([path, text]) => [path, store(text)])));
    },

    /**
     * @param {string} token
     * @param {string[]} repoNames the repositories it can see
     * @param {{ write?: boolean }} [options]
     */
    addToken(token, repoNames, { write = true } = {}) {
      tokens.set(token, { repos: new Set(repoNames), write });
    },

    /** Expiry and revocation look the same to the API: 401. @param {string} token */
    revokeToken(token) {
      tokens.delete(token);
    },

    /**
     * Makes matching requests fail with a status, a number of times.
     * @param {RegExp} match against "METHOD /path"
     * @param {number} status
     * @param {number} [times]
     */
    fail(match, status, times = 1) {
      faults.push({ match, status, times });
    },

    /**
     * The files at the head of a repository's branch, as text.
     * @param {string} name
     * @returns {Record<string, string>}
     */
    files(name) {
      const repo = repos.get(name);
      const files = repo?.head ? repo.commits.get(repo.head)?.files : undefined;
      return Object.fromEntries([...(files ?? new Map())].map(([path, sha]) => [path, blobs.get(sha) ?? '']));
    },

    /**
     * Changes a file directly, as another tool or person with access would.
     * @param {string} name
     * @param {string} path
     * @param {string | null} text null deletes it
     */
    writeFile(name, path, text) {
      const repo = repos.get(name);
      if (!repo) throw new Error(`no repo ${name}`);
      const files = new Map(repo.head ? repo.commits.get(repo.head)?.files : []);
      if (text === null) files.delete(path);
      else files.set(path, store(text));
      commit(name, files);
    },

    /**
     * Answers one request the way GitHub would.
     * @param {{ method: string, url: string, headers: Record<string, string>, body?: string | null }} request headers with lowercase names
     * @returns {Answer | 'offline'}
     */
    handle({ method, url, headers, body }) {
      if (fake.offline) return 'offline';
      const { pathname, searchParams } = new URL(url);
      const path = pathname;
      if (method === 'OPTIONS') return { status: 204, headers: { ...CORS }, body: '' };
      requests.push({ method, path });
      const fault = faults.find((f) => f.times > 0 && f.match.test(`${method} ${path}`));
      if (fault) {
        fault.times -= 1;
        return answer(fault.status, { message: 'Injected failure' }, fault.status === 403 ? { 'x-ratelimit-remaining': '0' } : {});
      }

      const grant = tokens.get((headers.authorization ?? '').replace(/^Bearer /, ''));
      if (!grant) return answer(401, { message: 'Bad credentials' });
      const match = /^\/repos\/([^/]+\/[^/]+)(\/.*)?$/.exec(path);
      const name = match?.[1] ?? '';
      const repo = repos.get(name);
      if (!match || !repo || !grant.repos.has(name)) return answer(404, { message: 'Not Found' });
      const rest = match[2] ?? '';
      const files = repo.head ? repo.commits.get(repo.head)?.files ?? new Map() : new Map();

      if (rest === '' && method === 'GET') {
        return answer(200, { full_name: name, private: repo.private, default_branch: repo.branch });
      }

      const commitMatch = /^\/commits\/(.+)$/.exec(rest);
      if (commitMatch && method === 'GET') {
        if ((commitMatch[1] ?? '').split('/').map(decodeURIComponent).join('/') !== repo.branch) return answer(422, { message: 'No commit found for SHA' });
        if (!repo.head) return answer(409, { message: 'Git Repository is empty.' });
        if (headers.accept === 'application/vnd.github.sha') return { status: 200, headers: { ...CORS, 'content-type': 'application/vnd.github.sha; charset=utf-8' }, body: repo.head };
        return answer(200, { sha: repo.head });
      }

      const treeMatch = /^\/git\/trees\/([0-9a-f]+)$/.exec(rest);
      if (treeMatch && method === 'GET') {
        const at = repo.commits.get(treeMatch[1] ?? '');
        if (!at) return answer(404, { message: 'Not Found' });
        const recursive = searchParams.get('recursive') === '1';
        const entries = [...at.files].filter(([p]) => recursive || !p.includes('/'));
        const dirs = new Set([...at.files.keys()].filter((p) => p.includes('/')).map((p) => p.split('/')[0]));
        return answer(200, {
          sha: sha1(`tree ${treeMatch[1]}`),
          tree: [
            ...[...dirs].map((dir) => ({ path: dir, mode: '040000', type: 'tree', sha: sha1(`tree ${dir}`) })),
            ...entries.map(([p, sha]) => ({ path: p, mode: '100644', type: 'blob', sha, size: Buffer.byteLength(blobs.get(sha) ?? '') })),
          ],
          truncated: false,
        });
      }

      const blobMatch = /^\/git\/blobs\/([0-9a-f]+)$/.exec(rest);
      if (blobMatch && method === 'GET') {
        const text = blobs.get(blobMatch[1] ?? '');
        if (text === undefined) return answer(404, { message: 'Not Found' });
        return answer(200, { sha: blobMatch[1], encoding: 'base64', content: Buffer.from(text).toString('base64') });
      }

      const contentsMatch = /^\/contents\/(.+)$/.exec(rest);
      if (contentsMatch) {
        const filePath = contentsMatch[1]?.split('/').map(decodeURIComponent).join('/') ?? '';
        const current = files.get(filePath);
        if (method === 'GET') {
          if (!repo.head) return answer(404, { message: 'This repository is empty.' });
          if (!current) return answer(404, { message: 'Not Found' });
          const content = Buffer.from(blobs.get(current) ?? '').toString('base64').replace(/(.{60})/g, '$1\n');
          return answer(200, { type: 'file', encoding: 'base64', path: filePath, name: filePath.split('/').pop(), sha: current, content });
        }
        if (method === 'PUT' || method === 'DELETE') {
          if (!grant.write) return answer(403, { message: 'Resource not accessible by personal access token' });
          const input = JSON.parse(body ?? '{}');
          if (typeof input.message !== 'string' || !input.message) return answer(422, { message: 'Invalid request.\n\n"message" wasn\'t supplied.' });
          if (method === 'PUT') {
            if (typeof input.content !== 'string') return answer(422, { message: 'Invalid request.\n\n"content" wasn\'t supplied.' });
            if (current && !input.sha) return answer(422, { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' });
            if (input.sha && input.sha !== current) return answer(409, { message: `${filePath} does not match ${input.sha}` });
            const next = new Map(files);
            const sha = store(Buffer.from(input.content, 'base64').toString('utf8'));
            next.set(filePath, sha);
            const parent = repo.head;
            const made = commit(name, next);
            return answer(current ? 200 : 201, {
              content: { name: filePath.split('/').pop(), path: filePath, sha, type: 'file' },
              commit: { sha: made, message: input.message, parents: parent ? [{ sha: parent }] : [] },
            });
          }
          if (!current) return answer(404, { message: 'Not Found' });
          if (input.sha !== current) return answer(409, { message: `${filePath} does not match ${input.sha}` });
          const next = new Map(files);
          next.delete(filePath);
          const parent = repo.head;
          const made = commit(name, next);
          return answer(200, { content: null, commit: { sha: made, message: input.message, parents: parent ? [{ sha: parent }] : [] } });
        }
      }
      return answer(404, { message: 'Not Found' });
    },

    /**
     * A fetch() that talks to this fake, for unit tests.
     * @param {string} input
     * @param {RequestInit} [init]
     */
    async fetch(input, init = {}) {
      const headers = Object.fromEntries(Object.entries(/** @type {Record<string, string>} */ (init.headers ?? {})).map(([k, v]) => [k.toLowerCase(), v]));
      const result = fake.handle({ method: init.method ?? 'GET', url: input, headers, body: /** @type {string | undefined} */ (init.body) });
      if (result === 'offline') throw new TypeError('Failed to fetch');
      return new Response(result.status === 204 || result.status === 304 ? null : result.body, { status: result.status, headers: result.headers });
    },

    /**
     * Answers a Playwright route, for browser tests:
     * context.route('https://api.github.com/**', fake.route)
     * @param {import('@playwright/test').Route} route
     */
    async route(route) {
      const request = route.request();
      const result = fake.handle({ method: request.method(), url: request.url(), headers: await request.allHeaders(), body: request.postData() });
      if (result === 'offline') return route.abort('internetdisconnected');
      return route.fulfill({ status: result.status, headers: result.headers, body: result.body });
    },
  };

  /** @param {string} text */
  function store(text) {
    const sha = blobSha(text);
    blobs.set(sha, text);
    return sha;
  }

  /**
   * @param {string} name
   * @param {Map<string, string>} files
   */
  function commit(name, files) {
    const repo = /** @type {NonNullable<ReturnType<typeof repos.get>>} */ (repos.get(name));
    commits += 1;
    const sha = sha1(`commit ${commits} ${repo.head ?? ''}`);
    repo.commits.set(sha, { files, parent: repo.head });
    repo.head = sha;
    return sha;
  }

  /**
   * @param {number} status
   * @param {unknown} data
   * @param {Record<string, string>} [extra]
   * @returns {Answer}
   */
  function answer(status, data, extra = {}) {
    return { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', ...extra }, body: JSON.stringify(data) };
  }

  return fake;
}
