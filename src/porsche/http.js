// -----------------------------------------------------------------------------
// A small HTTP layer over fetch: timeouts, and a cookie jar for the sign-in
// pages (fetch keeps no cookies, and Auth0 ties the login transaction to
// them: the captcha answer must come back with the same cookies).
// -----------------------------------------------------------------------------

import { KINDS, PorscheError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * @description A cookie jar: name -> value, for one sign-in.
 * @returns {{ header: Function, store: Function }} The jar.
 */
function createCookieJar() {
  const cookies = new Map();
  return {
    /**
     * @param {Response} response - A response whose Set-Cookie to keep.
     */
    store(response) {
      const lines =
        typeof response.headers.getSetCookie === 'function'
          ? response.headers.getSetCookie()
          : [response.headers.get('set-cookie')].filter(Boolean);
      for (const line of lines) {
        const [pair] = line.split(';');
        const index = pair.indexOf('=');
        if (index > 0) {
          cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
        }
      }
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    },
  };
}

/**
 * @description fetch with a timeout; a network failure becomes an
 * `unreachable` PorscheError (the URL, which may hold a code, is left out).
 * @param {Function} fetchImpl - fetch.
 * @param {string} url - The URL.
 * @param {object} [init] - fetch options, plus `timeoutMs`.
 * @returns {Promise<Response>} The response.
 */
async function request(fetchImpl, url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = {}) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return 'Porsche';
      }
    })();
    throw new PorscheError(`${host} unreachable: ${err.cause?.code ?? err.message}`, {
      kind: KINDS.UNREACHABLE,
    });
  }
}

/**
 * @description One request through a cookie jar, never following a redirect.
 * @param {Function} fetchImpl - fetch.
 * @param {object} jar - The cookie jar.
 * @param {string} url - The URL.
 * @param {object} [init] - fetch options.
 * @returns {Promise<{ response: Response, location: string|null }>} The
 * answer, and its redirect resolved against the URL (a non-HTTP scheme, the
 * app callback, is kept as is).
 */
async function requestWithCookies(fetchImpl, jar, url, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  const cookie = jar.header();
  if (cookie) {
    headers.cookie = cookie;
  }
  const response = await request(fetchImpl, url, { ...init, headers, redirect: 'manual' });
  jar.store(response);
  const raw = response.headers.get('location');
  let location = null;
  if (raw) {
    location = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : new URL(raw, url).toString();
  }
  return { response, location };
}

export { DEFAULT_TIMEOUT_MS, createCookieJar, request, requestWithCookies };
