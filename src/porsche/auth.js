// -----------------------------------------------------------------------------
// Sign-in to the My Porsche account (Auth0 tenant identity.porsche.com).
//
// The app signs in through the "identifier first" pages of Auth0, with OAuth2
// + PKCE and a custom redirect scheme. The steps, as pyporscheconnectapi
// (oauth2.py) and evcc run them:
//   1. GET  /authorize                 -> the app callback with a code when an
//                                         Auth0 session exists, else a login
//                                         page whose URL holds `state`;
//   2. POST /u/login/identifier        the e-mail (and the captcha answer).
//      401: unknown account; 400: Auth0 asks for a captcha, whose picture
//      is in the page (an SVG data URI);
//   3. POST /u/login/password          the password. 400: wrong password;
//                                      else a redirect to resume /authorize;
//   4. GET  the resume URL, following the redirects up to the app callback
//      `my-porsche-app://auth0/callback?code=…`, declining on the way the
//      passkey enrollment page Auth0 sometimes shows;
//   5. POST /oauth/token               code + verifier -> tokens.
//
// A captcha pauses the sign-in: the login transaction (its cookies, state
// and PKCE verifier) is kept in memory until the user types the answer in
// the widget (`solveCaptcha`), for 10 minutes at most. The tokens are kept
// in /data/session.json: a restart does not sign in again, only a refresh
// with the refresh token, so the captcha is rare.
// -----------------------------------------------------------------------------

import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AUDIENCE,
  AUTH_BASE_URL,
  CLIENT_ID,
  REDIRECT_URI,
  SCOPE,
  USER_AGENT,
  X_CLIENT_ID,
} from './constants.js';
import { KINDS, PorscheError, kindOfStatus } from './errors.js';
import { createCookieJar, request, requestWithCookies } from './http.js';

// Refresh when less than this is left on the access token.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
// Auth0 forgets a login transaction after a while: a captcha older than this
// is replaced by a new one.
const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const MAX_REDIRECTS = 10;
// pyporscheconnectapi waits before resuming: Auth0 refused an immediate one.
const RESUME_DELAY_MS = 2500;
const PASSKEY_ENROLLMENT_PATH = '/u/passkey-enrollment';

const HEADERS = { 'user-agent': USER_AGENT, 'x-client-id': X_CLIENT_ID };
const FORM = { ...HEADERS, 'content-type': 'application/x-www-form-urlencoded' };

/**
 * @description A PKCE verifier and its challenge (RFC 7636, S256).
 * @returns {{ verifier: string, challenge: string }} The pair.
 */
function createPkce() {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * @description The JSON context Auth0 inlines in its pages as `atob("…")`.
 * @param {string} html - The page.
 * @returns {object|null} The context.
 */
function loginContext(html) {
  const match = /atob\("([A-Za-z0-9+/=]+)"/.exec(String(html ?? ''));
  if (!match) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * @description The captcha picture of a login page: the Auth0 context, else
 * an `<img alt="captcha">`, else any inline SVG data URI.
 * @param {string} html - The page.
 * @returns {string|null} The picture, a data URI.
 * @example
 * extractCaptcha('<img alt="captcha" src="data:image/svg+xml;base64,PHN2Zy8+">');
 * // -> 'data:image/svg+xml;base64,PHN2Zy8+'
 */
function extractCaptcha(html) {
  const fromContext = loginContext(html)?.screen?.captcha?.image;
  if (typeof fromContext === 'string' && fromContext) {
    return fromContext;
  }
  const text = String(html ?? '');
  const img = /<img[^>]*alt="captcha"[^>]*>/i.exec(text)?.[0];
  const src = img ? /src="([^"]+)"/i.exec(img)?.[1] : null;
  if (src) {
    return src.replace(/&amp;/g, '&');
  }
  return /(data:image\/svg[^\s"'<)]+)/.exec(text)?.[1] ?? null;
}

/**
 * @description The sign-in and the tokens of a My Porsche account.
 * @param {object} options - Options.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {Function} options.getCredentials - `() => ({ email, password })`.
 * @param {string} [options.dataDir] - Where session.json lives.
 * @param {object} [options.logger] - A logger.
 * @param {Function} [options.sleep] - Wait, for the tests.
 * @param {Function} [options.now] - Now, in ms, for the tests.
 * @returns {object} The session manager.
 */
function createAuth({
  fetchImpl = fetch,
  getCredentials,
  dataDir = '/data',
  logger = null,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) {
  const file = path.join(dataDir, 'session.json');
  let session = null;
  let loaded = false;
  let pending = null;
  // The login waiting for a captcha answer: { jar, state, verifier, image, at }.
  let paused = null;

  /**
   * @description Load the stored session once.
   * @returns {Promise<void>}
   */
  async function load() {
    if (loaded) {
      return;
    }
    loaded = true;
    try {
      session = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      session = null;
    }
  }

  /**
   * @description Store the session (atomic write, readable by us only).
   * @returns {Promise<void>}
   */
  async function save() {
    try {
      await mkdir(dataDir, { recursive: true });
      await writeFile(`${file}.tmp`, JSON.stringify(session), { mode: 0o600 });
      await rename(`${file}.tmp`, file);
    } catch (err) {
      logger?.warn(`Unable to store the session: ${err.message}`);
    }
  }

  const accountKey = () =>
    String(getCredentials().email ?? '')
      .trim()
      .toLowerCase();

  /**
   * @description Read a token endpoint answer.
   * @param {Response} response - The answer.
   * @param {string} step - The step, for the message.
   * @returns {Promise<object>} The tokens.
   */
  async function readTokens(response, step) {
    const text = await response.text();
    if (!response.ok) {
      // 400 invalid_grant / 401 / 403: the code or the refresh token is refused.
      const kind = [400, 401, 403].includes(response.status)
        ? KINDS.AUTH
        : kindOfStatus(response.status);
      throw new PorscheError(`${step} refused (HTTP ${response.status})`, {
        kind,
        status: response.status,
      });
    }
    let tokens;
    try {
      tokens = JSON.parse(text);
    } catch {
      throw new PorscheError(`${step}: unexpected answer`, { kind: KINDS.UNREACHABLE });
    }
    if (!tokens?.access_token) {
      throw new PorscheError(`${step}: no access token`, { kind: KINDS.AUTH });
    }
    return tokens;
  }

  /**
   * @description Keep the tokens of a token endpoint answer.
   * @param {object} tokens - The answer.
   * @param {boolean} signIn - A new sign-in (not a refresh).
   * @returns {Promise<void>}
   */
  async function keep(tokens, signIn) {
    session = {
      account: accountKey(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? session?.refreshToken ?? null,
      expiresAt: now() + Number(tokens.expires_in ?? 3600) * 1000,
      signedInAt: signIn ? now() : (session?.signedInAt ?? now()),
    };
    await save();
  }

  /**
   * @description Exchange the authorization code for the tokens.
   * @param {string} code - The code.
   * @param {string} verifier - The PKCE verifier.
   * @returns {Promise<void>}
   */
  async function exchange(code, verifier) {
    const response = await request(fetchImpl, `${AUTH_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: FORM,
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }).toString(),
    });
    await keep(await readTokens(response, 'Token'), true);
    paused = null;
    logger?.info('Signed in to the My Porsche account');
  }

  const codeOf = (location) => {
    if (!location || !location.startsWith(REDIRECT_URI)) {
      return null;
    }
    return new URL(location).searchParams.get('code');
  };

  /**
   * @description Decline the passkey enrollment page Auth0 may show.
   * @param {object} jar - The cookie jar.
   * @param {string} url - The page.
   * @param {string} html - Its content.
   * @returns {Promise<string>} Where to go on.
   */
  async function skipPasskey(jar, url, html) {
    const context = loginContext(html);
    const state = context?.transaction?.state;
    if (!state) {
      throw new PorscheError('The passkey page of the sign-in changed', {
        kind: KINDS.UNREACHABLE,
      });
    }
    logger?.info('Declining the passkey offer of the Porsche sign-in');
    const form = {
      ...(context.untrustedData?.submittedFormData ?? {}),
      state,
      action: 'abort-passkey-enrollment',
      'acul-sdk': '@auth0/auth0-acul-js@1.2.0',
    };
    const { response, location } = await requestWithCookies(fetchImpl, jar, url, {
      method: 'POST',
      headers: FORM,
      body: new URLSearchParams(form).toString(),
    });
    await response.arrayBuffer().catch(() => {});
    if (!location) {
      throw new PorscheError(`Passkey offer not declined (HTTP ${response.status})`, {
        kind: KINDS.UNREACHABLE,
      });
    }
    return location;
  }

  /**
   * @description Follow the redirects of the resumed authorization up to
   * the app callback.
   * @param {object} jar - The cookie jar.
   * @param {string} url - The resume URL.
   * @returns {Promise<string>} The authorization code.
   */
  async function resume(jar, url) {
    let current = url;
    for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
      const code = codeOf(current);
      if (code) {
        return code;
      }
      const { response, location } = await requestWithCookies(fetchImpl, jar, current, {
        headers: HEADERS,
      });
      if (location) {
        await response.arrayBuffer().catch(() => {});
        current = location;
        continue;
      }
      if (response.status === 200 && new URL(current).pathname === PASSKEY_ENROLLMENT_PATH) {
        current = await skipPasskey(jar, current, await response.text());
        continue;
      }
      await response.arrayBuffer().catch(() => {});
      throw new PorscheError(`No authorization code after the sign-in (HTTP ${response.status})`, {
        kind: response.status >= 500 ? KINDS.UNREACHABLE : KINDS.AUTH,
        status: response.status,
      });
    }
    throw new PorscheError('Too many redirects during the sign-in', { kind: KINDS.UNREACHABLE });
  }

  /**
   * @description The e-mail step, then the password step.
   * @param {object} login - `{ jar, state, verifier }`.
   * @param {string|null} captcha - The captcha answer.
   * @returns {Promise<void>}
   * @throws {PorscheError} `captcha` (with the picture), `auth`…
   */
  async function identify(login, captcha) {
    const { email, password } = getCredentials();
    const username = String(email).trim();
    const query = new URLSearchParams({ state: login.state });
    const form = {
      state: login.state,
      username,
      'js-available': 'true',
      'webauthn-available': 'false',
      'is-brave': 'false',
      'webauthn-platform-available': 'false',
      action: 'default',
      ...(captcha ? { captcha } : {}),
    };
    const identifier = await requestWithCookies(
      fetchImpl,
      login.jar,
      `${AUTH_BASE_URL}/u/login/identifier?${query}`,
      { method: 'POST', headers: FORM, body: new URLSearchParams(form).toString() },
    );
    if (identifier.response.status === 401) {
      await identifier.response.arrayBuffer().catch(() => {});
      throw new PorscheError('E-mail refused by Porsche', { kind: KINDS.AUTH, status: 401 });
    }
    if (identifier.response.status === 400) {
      const image = extractCaptcha(await identifier.response.text());
      if (!image) {
        throw new PorscheError('Porsche asks for a captcha the integration cannot read', {
          kind: KINDS.UNREACHABLE,
          status: 400,
        });
      }
      paused = { ...login, image, at: now() };
      throw new PorscheError(
        captcha ? 'Wrong captcha: a new one is shown' : 'Porsche asks for a captcha',
        { kind: KINDS.CAPTCHA, image },
      );
    }
    await identifier.response.arrayBuffer().catch(() => {});
    if (identifier.response.status >= 500 || identifier.response.status === 429) {
      throw new PorscheError(`E-mail step failed (HTTP ${identifier.response.status})`, {
        kind: kindOfStatus(identifier.response.status),
        status: identifier.response.status,
      });
    }

    const passwordStep = await requestWithCookies(
      fetchImpl,
      login.jar,
      `${AUTH_BASE_URL}/u/login/password?${query}`,
      {
        method: 'POST',
        headers: FORM,
        body: new URLSearchParams({
          state: login.state,
          username,
          password,
          action: 'default',
        }).toString(),
      },
    );
    await passwordStep.response.arrayBuffer().catch(() => {});
    const { status } = passwordStep.response;
    if (status === 400 || status === 401) {
      paused = null;
      throw new PorscheError('Password refused by Porsche', { kind: KINDS.AUTH, status });
    }
    if (!passwordStep.location) {
      throw new PorscheError(`Password step failed (HTTP ${status})`, {
        kind: kindOfStatus(status),
        status,
      });
    }
    await sleep(RESUME_DELAY_MS);
    const code = await resume(login.jar, passwordStep.location);
    await exchange(code, login.verifier);
  }

  /**
   * @description Sign in with the e-mail and the password.
   * @returns {Promise<void>}
   * @throws {PorscheError} `auth`, `captcha`, `locked`…
   */
  async function login() {
    const { email, password } = getCredentials();
    if (!email || !password) {
      throw new PorscheError('E-mail and password are required', { kind: KINDS.AUTH });
    }
    const jar = createCookieJar();
    const { verifier, challenge } = createPkce();
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      audience: AUDIENCE,
      scope: SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: randomBytes(12).toString('hex'),
    });
    const { response, location } = await requestWithCookies(
      fetchImpl,
      jar,
      `${AUTH_BASE_URL}/authorize?${query}`,
      { headers: HEADERS },
    );
    await response.arrayBuffer().catch(() => {});
    if (!location) {
      throw new PorscheError(`Authorization refused (HTTP ${response.status})`, {
        kind: kindOfStatus(response.status),
        status: response.status,
      });
    }
    const code = codeOf(location);
    if (code) {
      await exchange(code, verifier);
      return;
    }
    const state = new URL(location).searchParams.get('state');
    if (!state) {
      throw new PorscheError('The login page changed (no state parameter)', {
        kind: KINDS.UNREACHABLE,
      });
    }
    await identify({ jar, state, verifier }, null);
  }

  /**
   * @description Refresh the access token.
   * @returns {Promise<void>}
   */
  async function refresh() {
    const response = await request(fetchImpl, `${AUTH_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: FORM,
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: session.refreshToken,
      }).toString(),
    });
    await keep(await readTokens(response, 'Token refresh'), false);
  }

  /**
   * @description A valid access token: the stored one, refreshed, or a new
   * sign-in. One at a time. While a captcha waits for its answer, fails at
   * once with it (no new sign-in: each one could bring a new captcha).
   * @param {object} [options] - Options.
   * @param {boolean} [options.force] - Renew even if still valid.
   * @returns {Promise<string>} The access token.
   */
  async function accessToken({ force = false } = {}) {
    if (pending) {
      return pending;
    }
    pending = (async () => {
      await load();
      if (session && session.account !== accountKey()) {
        session = null;
        paused = null;
      }
      const fresh = session?.accessToken && session.expiresAt - now() > REFRESH_MARGIN_MS;
      if (fresh && !force) {
        return session.accessToken;
      }
      if (session?.refreshToken) {
        try {
          await refresh();
          return session.accessToken;
        } catch (err) {
          if (err.kind !== KINDS.AUTH) {
            throw err;
          }
          logger?.info('Refresh token refused: signing in again');
          session = null;
        }
      }
      const waiting = captcha();
      if (waiting) {
        throw new PorscheError('Porsche asks for a captcha', {
          kind: KINDS.CAPTCHA,
          image: waiting,
        });
      }
      await login();
      return session.accessToken;
    })().finally(() => {
      pending = null;
    });
    return pending;
  }

  /**
   * @description The captcha waiting for an answer, if still valid.
   * @returns {string|null} Its picture.
   */
  function captcha() {
    if (paused && now() - paused.at > CAPTCHA_TTL_MS) {
      paused = null;
    }
    return paused?.image ?? null;
  }

  /**
   * @description Go on with the sign-in with the captcha answer; a fresh
   * sign-in (and a fresh captcha) when the waiting one is too old.
   * @param {string} answer - The characters of the picture.
   * @returns {Promise<void>}
   * @throws {PorscheError} `captcha` again with a new picture when wrong.
   */
  async function solveCaptcha(answer) {
    const text = String(answer ?? '').trim();
    if (!captcha()) {
      await login();
      return;
    }
    if (!text) {
      throw new PorscheError('Type the characters of the picture', {
        kind: KINDS.CAPTCHA,
        image: paused.image,
      });
    }
    const { jar, state, verifier } = paused;
    await identify({ jar, state, verifier }, text);
  }

  /**
   * @description Forget the tokens and any waiting captcha.
   * @returns {Promise<void>}
   */
  async function clear() {
    await load();
    session = null;
    paused = null;
    await save();
  }

  return {
    accessToken,
    login,
    solveCaptcha,
    captcha,
    clear,
    hasSession: () => Boolean(session?.accessToken),
    sessionAge: () => (session?.signedInAt ? now() - session.signedInAt : null),
  };
}

export { createAuth, createPkce, extractCaptcha, loginContext };
