// -----------------------------------------------------------------------------
// The PPA backend of the My Porsche app (api.ppa.porsche.com/app).
//
//   GET  /connect/v1/vehicles                        the cars of the account
//   GET  /connect/v1/vehicles/<VIN>?mf=…             the stored overview: the
//                                                    last values the car sent
//                                                    (never wakes it up)
//   GET  /connect/v1/vehicles/<VIN>?mf=…&cf=…        the same, with the
//                                                    commands the car accepts
//   POST /connect/v1/vehicles/<VIN>/commands         a command -> { status:
//                                                    { id, result } }
//   GET  /connect/v1/vehicles/<VIN>/commands/<id>    its progress, until
//                                                    PERFORMED or ERROR
//
// An overview is `{ vin, modelName, customName, modelType, measurements:
// [{ key, status: { isEnabled }, value }] }`; `measurementsOf` turns it into
// a map of the enabled ones. A refused token (401) is renewed once.
// -----------------------------------------------------------------------------

import { API_BASE_URL, COMMAND_KEYS, MEASUREMENTS, USER_AGENT, X_CLIENT_ID } from './constants.js';
import { KINDS, PorscheError, kindOfStatus } from './errors.js';
import { request } from './http.js';

const GATEWAY_RETRIES = 2;
// A car asleep is slow to run a command: 100 s, under the 120 s a scene action
// may take.
const COMMAND_TIMEOUT_MS = 100 * 1000;
const COMMAND_POLL_MS = 2000;

/**
 * @description The enabled measurements of an overview, by key.
 * @param {object} overview - The overview.
 * @returns {Map<string, object>} key -> value.
 * @example
 * measurementsOf({ measurements: [{ key: 'MILEAGE', status: { isEnabled: true }, value: { kilometers: 12 } }] });
 * // -> Map { 'MILEAGE' => { kilometers: 12 } }
 */
function measurementsOf(overview) {
  const map = new Map();
  for (const item of overview?.measurements ?? []) {
    if (
      item?.key &&
      item.status?.isEnabled === true &&
      item.value &&
      typeof item.value === 'object'
    ) {
      map.set(item.key, item.value);
    }
  }
  return map;
}

/**
 * @description The commands of a capabilities answer, by key.
 * @param {object} overview - The answer with `commands`.
 * @returns {Map<string, { enabled: boolean, cause: string|null, metadata: object }>|null}
 * The commands, or null when the answer has none.
 */
function commandsOf(overview) {
  if (!Array.isArray(overview?.commands)) {
    return null;
  }
  const map = new Map();
  for (const item of overview.commands) {
    if (item?.key) {
      map.set(item.key, {
        enabled: item.status?.isEnabled !== false,
        cause: item.status?.cause ?? null,
        metadata: item.metadata ?? {},
      });
    }
  }
  return map;
}

/**
 * @description The Porsche API client.
 * @param {object} options - Options.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {object} options.auth - createAuth().
 * @param {Function} [options.sleep] - Wait, for the tests.
 * @param {Function} [options.now] - Now, in ms, for the tests.
 * @returns {object} The client.
 */
function createApi({
  fetchImpl = fetch,
  auth,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) {
  /**
   * @description A request to the API, as JSON.
   * @param {string} method - GET or POST.
   * @param {string} url - The path under /app.
   * @param {object} [body] - A JSON body.
   * @returns {Promise<object>} The answer.
   */
  async function call(method, url, body) {
    let renewed = false;
    let force = false;
    for (let attempt = 0; ; attempt += 1) {
      const token = await auth.accessToken({ force });
      force = false;
      const response = await request(fetchImpl, `${API_BASE_URL}${url}`, {
        method,
        headers: {
          'user-agent': USER_AGENT,
          'x-client-id': X_CLIENT_ID,
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        timeoutMs: 60000,
      });
      const text = await response.text();
      if (response.ok) {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          throw new PorscheError(`Unexpected answer of ${url.split('?')[0]}`, {
            kind: KINDS.UNREACHABLE,
          });
        }
      }
      if (response.status === 401 && !renewed) {
        renewed = true;
        force = true;
        continue;
      }
      if ([502, 503, 504].includes(response.status) && attempt < GATEWAY_RETRIES) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      const path = url.split('?')[0].replace(/\/vehicles\/[^/]+/, '/vehicles/<VIN>');
      throw new PorscheError(`${method} ${path}: HTTP ${response.status}`, {
        kind: kindOfStatus(response.status),
        status: response.status,
      });
    }
  }

  const query = (keys, prefix) => keys.map((key) => `${prefix}=${encodeURIComponent(key)}`);

  /**
   * @description The cars of the account.
   * @returns {Promise<Array<object>>} The cars.
   */
  async function vehicles() {
    const list = await call('GET', '/connect/v1/vehicles');
    return Array.isArray(list) ? list : [];
  }

  /**
   * @description The stored overview of a car.
   * @param {string} vin - The VIN.
   * @param {object} [options] - Options.
   * @param {boolean} [options.commands] - Also ask the commands it accepts.
   * @returns {Promise<object>} The overview.
   */
  async function overview(vin, { commands = false } = {}) {
    const params = [
      ...query(MEASUREMENTS, 'mf'),
      ...(commands ? query(COMMAND_KEYS, 'cf') : []),
    ].join('&');
    return call('GET', `/connect/v1/vehicles/${encodeURIComponent(vin)}?${params}`);
  }

  /**
   * @description Send a command and wait for the car to run it.
   * @param {string} vin - The VIN.
   * @param {{ key: string, payload: object }} command - The command.
   * @returns {Promise<{ ok: boolean, status: string, data: object|null }>} The outcome.
   */
  async function command(vin, { key, payload }) {
    const base = `/connect/v1/vehicles/${encodeURIComponent(vin)}/commands`;
    const answer = await call('POST', base, { key, payload });
    const id = answer?.status?.id;
    let result = String(answer?.status?.result ?? 'UNKNOWN').toUpperCase();
    if (result === 'PERFORMED') {
      return { ok: true, status: result, data: answer.data ?? null };
    }
    if (!id || result !== 'ACCEPTED') {
      return { ok: false, status: result, data: answer?.data ?? null };
    }
    const deadline = now() + COMMAND_TIMEOUT_MS;
    while (now() < deadline) {
      await sleep(COMMAND_POLL_MS);
      const progress = await call('GET', `${base}/${encodeURIComponent(id)}`);
      result = String(progress?.status?.result ?? 'UNKNOWN').toUpperCase();
      if (result === 'PERFORMED') {
        return { ok: true, status: result, data: progress.data ?? null };
      }
      if (['ERROR', 'FAILED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(result)) {
        return { ok: false, status: result, data: progress?.data ?? null };
      }
    }
    return { ok: false, status: 'TIMEOUT', data: null };
  }

  /**
   * @description The SPIN challenge the unlock command answers.
   * @param {string} vin - The VIN.
   * @returns {Promise<string>} The challenge, hexadecimal.
   */
  async function spinChallenge(vin) {
    const answer = await call('POST', `/connect/v1/vehicles/${encodeURIComponent(vin)}/commands`, {
      key: 'SPIN_CHALLENGE',
      payload: { spin: null },
    });
    const challenge = answer?.data?.challenge;
    if (typeof challenge !== 'string' || !/^[0-9a-f]+$/i.test(challenge)) {
      throw new PorscheError('No PIN challenge from Porsche', { kind: KINDS.REFUSED });
    }
    return challenge;
  }

  return { vehicles, overview, command, spinChallenge };
}

export { createApi, measurementsOf, commandsOf, COMMAND_TIMEOUT_MS };
