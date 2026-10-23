// The remote copy: a private GitHub repository, through GitHub's REST API
// (R2.2, D5). It knows files, not recipes: the sync engine decides what goes
// in them, already sealed (D7).
//
// Every file has a version, GitHub's blob SHA. Writes and deletes name the
// version they expect to replace, and GitHub refuses them if the file moved
// on, so a stale device can never overwrite someone else's change (D6).
// Reading the branch head is one small request, so a returning device knows
// cheaply whether anything changed.
import { decodeText, encodeText } from './base64.js';

/**
 * Why the remote couldn't do something; the screens put it into words.
 * - offline: no answer at all
 * - unauthorized: GitHub doesn't accept the token (wrong, expired or revoked)
 * - forbidden: the token can't do this here (e.g. Contents is read-only)
 * - not-found: no such repository, or the token can't see it
 * - conflict: the file isn't at the version given
 * - rate-limited, unavailable: try again later
 * @typedef {'offline' | 'unauthorized' | 'forbidden' | 'not-found' | 'conflict' | 'rate-limited' | 'unavailable'} RemoteProblem
 */
/** @typedef {{ version: string, commit: string, parent: string | null }} Written  parent: the commit the branch was at before */
/**
 * What the sync engine needs from a remote.
 * @typedef {object} Remote
 * @property {() => Promise<string | null>} head the branch's latest commit; null while the repository is empty
 * @property {(head: string) => Promise<Map<string, string>>} list every file at a commit: path → version
 * @property {(path: string) => Promise<{ text: string, version: string } | null>} get the file as it is now; null when there's none
 * @property {(path: string, text: string, version: string | null) => Promise<Written>} put
 *   writes over the given version, or creates the file when version is null; rejects with conflict when that's not how it is
 * @property {(path: string, version: string) => Promise<Written | null>} remove
 *   deletes the given version; null when the file was already gone
 */
/** @typedef {(input: string, init?: RequestInit) => Promise<Response>} Fetch */

const API = 'https://api.github.com';

export class RemoteError extends Error {
  /**
   * @param {RemoteProblem} code
   * @param {string} [detail]
   */
  constructor(code, detail = '') {
    super(`GitHub: ${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'RemoteError';
    /** @type {RemoteProblem} */
    this.code = code;
  }
}

/**
 * "owner/name" from what someone pasted: "owner/name", or the repository's
 * address on github.com.
 * @param {string} text
 * @returns {string | null}
 */
export function parseRepository(text) {
  const match = /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/
    .exec(text.trim());
  if (!match || match[2] === '.' || match[2] === '..') return null;
  return `${match[1]}/${match[2]}`;
}

/**
 * Looks a repository up with a token: whether it's there, whether it's
 * private, and its default branch, which is where recipes go.
 * @param {{ repository: string, token: string, fetch?: Fetch }} options repository: "owner/name"
 * @returns {Promise<{ branch: string, private: boolean }>} rejects with a RemoteError
 */
export async function findRepository({ repository, token, fetch = globalFetch }) {
  const data = await call(fetch, token, 'GET', `/repos/${repository}`);
  if (!isRecord(data) || typeof data.default_branch !== 'string') throw new RemoteError('unavailable', 'unexpected answer');
  return { branch: data.default_branch, private: data.private === true };
}

/**
 * @param {{ repository: string, branch: string, token: string, fetch?: Fetch }} options
 * @returns {Remote}
 */
export function githubRemote({ repository, branch, token, fetch = globalFetch }) {
  const repo = `/repos/${repository}`;
  /** @param {string} path */
  const contents = (path) => `${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

  return {
    async head() {
      try {
        const sha = await call(fetch, token, 'GET', `${repo}/commits/${encodeURIComponent(branch)}`, undefined, 'application/vnd.github.sha');
        if (typeof sha !== 'string' || !/^[0-9a-f]{40,64}$/.test(sha.trim())) throw new RemoteError('unavailable', 'unexpected answer');
        return sha.trim();
      } catch (error) {
        // GitHub answers 409 for a repository with no commits yet, and 422
        // for a branch with none.
        if (error instanceof RemoteError && error.code === 'conflict') return null;
        throw error;
      }
    },

    async list(head) {
      const data = await call(fetch, token, 'GET', `${repo}/git/trees/${encodeURIComponent(head)}?recursive=1`);
      if (!isRecord(data) || !Array.isArray(data.tree)) throw new RemoteError('unavailable', 'unexpected answer');
      /** @type {Map<string, string>} */
      const files = new Map();
      for (const entry of data.tree) {
        if (isRecord(entry) && entry.type === 'blob' && typeof entry.path === 'string' && typeof entry.sha === 'string') {
          files.set(entry.path, entry.sha);
        }
      }
      return files;
    },

    async get(path) {
      let data;
      try {
        data = await call(fetch, token, 'GET', contents(path));
      } catch (error) {
        if (error instanceof RemoteError && error.code === 'not-found') return null;
        throw error;
      }
      if (!isRecord(data) || data.type !== 'file' || typeof data.sha !== 'string') throw new RemoteError('unavailable', 'unexpected answer');
      let content = data.content;
      // Files over 1 MB come without their content; the blob has it.
      if (data.encoding !== 'base64') {
        const blob = await call(fetch, token, 'GET', `${repo}/git/blobs/${data.sha}`);
        content = isRecord(blob) ? blob.content : undefined;
      }
      if (typeof content !== 'string') throw new RemoteError('unavailable', 'unexpected answer');
      return { text: decodeText(content), version: data.sha };
    },

    async put(path, text, version) {
      /** @type {Record<string, string>} */
      const body = { message: `Save ${path}`, content: encodeText(text) };
      if (version) body.sha = version;
      return written(await call(fetch, token, 'PUT', contents(path), body), true);
    },

    async remove(path, version) {
      try {
        return written(await call(fetch, token, 'DELETE', contents(path), { message: `Delete ${path}`, sha: version }), false);
      } catch (error) {
        if (error instanceof RemoteError && error.code === 'not-found') return null;
        throw error;
      }
    },
  };
}

/** @type {Fetch} */
function globalFetch(input, init) {
  return fetch(input, init);
}

/**
 * One request to GitHub's API.
 * @param {Fetch} fetch
 * @param {string} token
 * @param {'GET' | 'PUT' | 'DELETE'} method
 * @param {string} path
 * @param {Record<string, string>} [body]
 * @param {string} [accept]
 * @returns {Promise<unknown>} the answer's JSON, or its text for other types; rejects with a RemoteError
 */
async function call(fetch, token, method, path, body, accept = 'application/vnd.github+json') {
  /** @type {Response} */
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body && JSON.stringify(body),
      // Ask every time whether something changed. An unchanged answer comes
      // back as a tiny 304, which doesn't count against the rate limit.
      cache: 'no-cache',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new RemoteError('offline', error instanceof Error ? error.message : String(error));
  }
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new RemoteError(problemOf(response, method, text), `${response.status}`);
  if (!(response.headers.get('content-type') ?? '').includes('json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new RemoteError('unavailable', 'unreadable answer');
  }
}

/**
 * @param {Response} response
 * @param {string} method
 * @param {string} text the answer's body
 * @returns {RemoteProblem}
 */
function problemOf({ status, headers }, method, text) {
  if (status === 401) return 'unauthorized';
  if (status === 429 || (status === 403 && headers.get('x-ratelimit-remaining') === '0')) return 'rate-limited';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  // A new file where there already is one: GitHub wants the version ("sha").
  if (status === 422 && (method === 'GET' || /\bsha\b/.test(text))) return 'conflict';
  return 'unavailable';
}

/**
 * @param {unknown} data the answer to a write
 * @param {boolean} hasContent
 * @returns {Written}
 */
function written(data, hasContent) {
  const commit = isRecord(data) && isRecord(data.commit) ? data.commit : null;
  const content = isRecord(data) && isRecord(data.content) ? data.content : null;
  const parents = commit && Array.isArray(commit.parents) ? commit.parents : [];
  const parent = isRecord(parents[0]) && typeof parents[0].sha === 'string' ? parents[0].sha : null;
  if (!commit || typeof commit.sha !== 'string' || (hasContent && typeof content?.sha !== 'string')) {
    throw new RemoteError('unavailable', 'unexpected answer');
  }
  return { version: hasContent ? String(content?.sha) : '', commit: commit.sha, parent };
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
