// Fixtures of the tests: two synthetic Porsches (fabricated values, obvious
// fake VINs), and a fake Porsche cloud that answers like the servers
// pyporscheconnectapi and evcc talk to: the Auth0 pages of
// identity.porsche.com (identifier first, captcha, passkey enrollment, token
// endpoint) and the PPA API (vehicles, stored overview, commands). The shapes
// are reconstructed from the code of these two clients, not recorded: when a
// user reports a difference, fix this fake cloud first, then the code. No
// test touches the network.

export const VIN_BEV = 'WP0ZZZY1ZRS000001';
export const VIN_PETROL = 'WP0ZZZ99ZPS000002';
export const NOW = Date.parse('2026-10-20T08:00:00Z');
const STAMP = new Date(NOW - 5 * 60 * 1000).toISOString();

export const copy = (value) => JSON.parse(JSON.stringify(value));

export const VEHICLES = [
  {
    vin: VIN_BEV,
    modelName: 'Taycan 4S',
    modelType: { model: 'Y1ADB1', year: '2024', engine: 'BEV' },
    connect: true,
  },
  {
    vin: VIN_PETROL,
    modelName: '911 Carrera',
    customName: 'Weekend car',
    modelType: { model: '992110', year: '2023', engine: 'COMBUSTION' },
    connect: true,
  },
];

const m = (key, value, isEnabled = true) => ({ key, status: { isEnabled }, value });
const closed = (key) => m(key, { isOpen: false });
const tire = (key, bar, difference) =>
  m(key, { actualPressureBar: bar, differenceBar: difference, lastModified: STAMP });

export const BEV_MEASUREMENTS = [
  m('BATTERY_LEVEL', { percent: 78 }),
  m('E_RANGE', { kilometers: 312 }),
  m('RANGE', { kilometers: 312 }),
  m('MILEAGE', { kilometers: 23456 }),
  m('LOCK_STATE_VEHICLE', { isLocked: true }),
  closed('OPEN_STATE_DOOR_FRONT_LEFT'),
  closed('OPEN_STATE_DOOR_FRONT_RIGHT'),
  closed('OPEN_STATE_DOOR_REAR_LEFT'),
  closed('OPEN_STATE_DOOR_REAR_RIGHT'),
  closed('OPEN_STATE_LID_FRONT'),
  closed('OPEN_STATE_LID_REAR'),
  closed('OPEN_STATE_WINDOW_FRONT_LEFT'),
  closed('OPEN_STATE_WINDOW_FRONT_RIGHT'),
  closed('OPEN_STATE_WINDOW_REAR_LEFT'),
  closed('OPEN_STATE_WINDOW_REAR_RIGHT'),
  closed('OPEN_STATE_SUNROOF'),
  m('OPEN_STATE_TOP', null, false),
  m('CHARGING_SUMMARY', {
    status: 'NOT_CHARGING',
    mode: 'PROFILE',
    chargingProfile: { id: 4, minSoC: 80 },
    targetDateTimeWithOffset: null,
  }),
  m('CHARGING_RATE', { chargingPower: 0, chargingRate: 0 }),
  m('CHARGING_PROFILES', {
    list: [
      { id: 4, name: 'Home', isEnabled: true, minSoc: 80 },
      { id: 5, name: 'Work', isEnabled: false, minSoc: 60 },
    ],
  }),
  m('HVAC_SUMMARY', {
    type: 'CLIMATIZER',
    status: 'OFF',
    targetTemperature: 294.15,
    climateZonesEnabled: { frontLeft: false, frontRight: false, rearLeft: false, rearRight: false },
  }),
  tire('TIRE_PRESSURE_FRONT_LEFT', 2.7, -0.1),
  tire('TIRE_PRESSURE_FRONT_RIGHT', 2.7, -0.1),
  tire('TIRE_PRESSURE_REAR_LEFT', 2.9, 0),
  tire('TIRE_PRESSURE_REAR_RIGHT', 2.9, 0),
  m('MAIN_SERVICE_TIME', { days: 180 }),
  m('MAIN_SERVICE_RANGE', { kilometers: 15000 }),
  m('GPS_LOCATION', { location: '48.858400,2.294500', direction: 90, lastModified: STAMP }),
  m('GLOBAL_PRIVACY_MODE', { isEnabled: false }),
  m('REMOTE_ACCESS_AUTHORIZATION', { isEnabled: true }),
  m('PARKING_BRAKE', { isOn: true }),
];

export const PETROL_MEASUREMENTS = [
  m('FUEL_LEVEL', { percent: 55 }),
  m('RANGE', { kilometers: 410 }),
  m('MILEAGE', { kilometers: 8120 }),
  m('LOCK_STATE_VEHICLE', { isLocked: false }),
  m('OPEN_STATE_DOOR_FRONT_LEFT', { isOpen: true }),
  closed('OPEN_STATE_DOOR_FRONT_RIGHT'),
  closed('OPEN_STATE_LID_FRONT'),
  closed('OPEN_STATE_LID_REAR'),
  closed('OPEN_STATE_WINDOW_FRONT_LEFT'),
  closed('OPEN_STATE_WINDOW_FRONT_RIGHT'),
  m('BATTERY_LEVEL', null, false),
  m('GPS_LOCATION', { location: '48.900000,2.300000', direction: 0, lastModified: STAMP }),
  m('GLOBAL_PRIVACY_MODE', { isEnabled: false }),
];

const command = (key, isEnabled = true, metadata = undefined) => ({
  key,
  status: { isEnabled, ...(isEnabled ? {} : { cause: 'NOT_SUPPORTED' }) },
  ...(metadata ? { metadata } : {}),
});

export const BEV_COMMANDS = [
  command('LOCK'),
  command('UNLOCK'),
  command('HONK_FLASH'),
  command('REMOTE_CLIMATIZER_START', true, { minTemperature: 288.15, maxTemperature: 302.15 }),
  command('REMOTE_CLIMATIZER_STOP'),
  command('DIRECT_CHARGING_START'),
  command('DIRECT_CHARGING_STOP'),
  command('CHARGING_SETTINGS_EDIT', false),
  command('CHARGING_PROFILES_EDIT'),
];
export const PETROL_COMMANDS = [
  command('LOCK'),
  command('UNLOCK'),
  command('HONK_FLASH'),
  command('REMOTE_CLIMATIZER_START', false),
];

/**
 * @description An overview as the API sends it.
 * @param {string} vin - The VIN.
 * @param {Array<object>} measurements - The measurements.
 * @param {Array<object>|null} [commands] - The commands, when asked.
 * @returns {object} The overview.
 */
export function overviewOf(vin, measurements, commands = null) {
  const entry = VEHICLES.find((vehicle) => vehicle.vin === vin) ?? { vin };
  return {
    ...entry,
    timestamp: STAMP,
    measurements: copy(measurements),
    ...(commands ? { commands: copy(commands) } : {}),
  };
}

// A captcha as Auth0 shows it: an SVG with paths, in a data URI.
export const CAPTCHA_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="50" viewBox="0,0,150,50">' +
  '<path d="M10 40 L25 10 L40 40 Z" fill="#333"/><path d="M60 10 L60 40 L80 40" stroke="#333" ' +
  'stroke-width="4" fill="none"/><path d="M5 30 C40 5,90 50,145 20" stroke="#888" fill="none"/></svg>';
export const CAPTCHA_IMAGE = `data:image/svg+xml;base64,${Buffer.from(CAPTCHA_SVG).toString('base64')}`;

/**
 * @description The login page Auth0 answers with a captcha (HTTP 400): its
 * context is inlined as base64 JSON in an `atob("…")`.
 * @param {string} image - The captcha.
 * @returns {string} The HTML.
 */
export function captchaPage(image) {
  const context = { screen: { name: 'login-id', captcha: { provider: 'auth0', image } } };
  const encoded = Buffer.from(JSON.stringify(context)).toString('base64');
  return `<html><head><script>window.universal_login_context = JSON.parse(atob("${encoded}"));</script></head><body></body></html>`;
}

/**
 * @description A fetch Response.
 * @param {number} status - The status.
 * @param {unknown} body - JSON or a string.
 * @param {object} [headers] - Headers.
 * @returns {Response} The response.
 */
export function response(status, body = '', headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  const init = { status, headers: new Headers() };
  for (const [name, value] of Object.entries(headers)) {
    for (const item of [].concat(value)) {
      init.headers.append(name, item);
    }
  }
  return new Response(status === 204 ? null : payload, init);
}

const form = (init) => Object.fromEntries(new URLSearchParams(String(init.body ?? '')));

/**
 * @description A fake Porsche cloud.
 * @param {object} [options] - Options.
 * @param {string} [options.password] - The account password.
 * @param {string|null} [options.captcha] - The captcha answer Auth0 asks for (null: none).
 * @param {boolean} [options.passkey] - Show the passkey enrollment page once.
 * @param {boolean} [options.session] - An Auth0 session exists: /authorize answers a code.
 * @param {Function} [options.api] - `(method, path, url, init) => Response|null` overriding the API.
 * @returns {Function} The fetch, with `calls`, `state` and `cars`.
 */
export function fakePorsche({
  password = 'secret',
  captcha = null,
  passkey = false,
  session = false,
  api = () => null,
} = {}) {
  const calls = [];
  const state = {
    tokens: 0,
    access: null,
    refresh: null,
    captchas: 0,
    passkeyShown: false,
    commands: [],
    challenge: 'A1B2C3D4',
  };
  const cars = {
    [VIN_BEV]: { measurements: copy(BEV_MEASUREMENTS), commands: BEV_COMMANDS },
    [VIN_PETROL]: { measurements: copy(PETROL_MEASUREMENTS), commands: PETROL_COMMANDS },
  };
  const set = (vin, key, value) => {
    const item = cars[vin].measurements.find((entry) => entry.key === key);
    if (item) {
      item.value = { ...item.value, ...value };
      item.status.isEnabled = true;
    }
  };
  const issue = () => {
    state.tokens += 1;
    state.access = `access-${state.tokens}`;
    state.refresh = `refresh-${state.tokens}`;
    return response(200, {
      access_token: state.access,
      refresh_token: state.refresh,
      id_token: 'id',
      expires_in: 3600,
      token_type: 'Bearer',
    });
  };

  const fn = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    calls.push({ method, url: String(input), init });
    const path = url.pathname;
    const headers = init.headers ?? {};

    if (url.host === 'identity.porsche.com') {
      const cookie = String(headers.cookie ?? '');
      if (path === '/authorize' && method === 'GET') {
        if (session) {
          return response(302, '', {
            location: `my-porsche-app://auth0/callback?code=session-code&state=${url.searchParams.get('state')}`,
          });
        }
        return response(302, '', {
          location: '/u/login/identifier?state=S1',
          'set-cookie': ['auth0=tx1; Path=/; Secure; HttpOnly', 'did=d1; Path=/'],
        });
      }
      if (path === '/u/login/identifier' && method === 'POST') {
        if (!cookie.includes('auth0=tx1')) {
          return response(400, 'no transaction');
        }
        const body = form(init);
        if (body.username !== 'me@example.com') {
          return response(401, 'unknown');
        }
        if (captcha && body.captcha !== captcha) {
          state.captchas += 1;
          return response(400, captchaPage(CAPTCHA_IMAGE));
        }
        return response(302, '', { location: '/u/login/password?state=S1' });
      }
      if (path === '/u/login/password' && method === 'POST') {
        if (form(init).password !== password) {
          return response(400, 'wrong password');
        }
        return response(302, '', { location: '/authorize/resume?state=S1' });
      }
      if (path === '/authorize/resume') {
        if (passkey && !state.passkeyShown) {
          return response(302, '', { location: '/u/passkey-enrollment?state=S2' });
        }
        return response(302, '', {
          location: 'my-porsche-app://auth0/callback?code=the-code&state=x',
        });
      }
      if (path === '/u/passkey-enrollment') {
        if (method === 'GET') {
          const context = { transaction: { state: 'S2' }, untrustedData: {} };
          const encoded = Buffer.from(JSON.stringify(context)).toString('base64');
          return response(200, `<script>var c = atob("${encoded}");</script>`);
        }
        const body = form(init);
        if (body.action !== 'abort-passkey-enrollment' || body.state !== 'S2') {
          return response(400, 'bad');
        }
        state.passkeyShown = true;
        return response(302, '', { location: '/authorize/resume?state=S2' });
      }
      if (path === '/oauth/token' && method === 'POST') {
        const body = form(init);
        if (body.grant_type === 'authorization_code') {
          if (!['the-code', 'session-code'].includes(body.code) || !body.code_verifier) {
            return response(403, { error: 'invalid_grant' });
          }
          return issue();
        }
        if (body.grant_type === 'refresh_token') {
          if (body.refresh_token !== state.refresh) {
            return response(403, { error: 'invalid_grant' });
          }
          return issue();
        }
      }
      return response(404, 'not found');
    }

    if (url.host === 'api.ppa.porsche.com') {
      const custom = api(method, path, url, init);
      if (custom) {
        return custom;
      }
      if (headers.authorization !== `Bearer ${state.access}`) {
        return response(401, { message: 'Unauthorized' });
      }
      if (headers['x-client-id'] !== '41843fb4-691d-4970-85c7-2673e8ecef40') {
        return response(403, { message: 'client' });
      }
      if (path === '/app/connect/v1/vehicles') {
        return response(200, VEHICLES);
      }
      const match = /^\/app\/connect\/v1\/vehicles\/([A-Z0-9]+)(\/commands(?:\/(.+))?)?$/.exec(
        path,
      );
      const car = match ? cars[match[1]] : null;
      if (!car) {
        return response(404, {});
      }
      const vin = match[1];
      if (!match[2]) {
        const wanted = url.searchParams.getAll('mf');
        const measurements = car.measurements.filter((item) => wanted.includes(item.key));
        const commands = url.searchParams.getAll('cf').length > 0 ? car.commands : null;
        return response(200, overviewOf(vin, measurements, commands));
      }
      if (match[3]) {
        return response(200, { status: { id: match[3], result: 'PERFORMED' } });
      }
      const body = JSON.parse(init.body);
      state.commands.push({ vin, ...body });
      if (body.key === 'SPIN_CHALLENGE') {
        return response(200, {
          data: { challenge: state.challenge },
          status: { result: 'PERFORMED' },
        });
      }
      if (body.key === 'LOCK') {
        set(vin, 'LOCK_STATE_VEHICLE', { isLocked: true });
      } else if (body.key === 'UNLOCK') {
        set(vin, 'LOCK_STATE_VEHICLE', { isLocked: false });
      } else if (body.key === 'REMOTE_CLIMATIZER_START') {
        set(vin, 'HVAC_SUMMARY', { status: 'ON' });
      } else if (body.key === 'REMOTE_CLIMATIZER_STOP') {
        set(vin, 'HVAC_SUMMARY', { status: 'OFF' });
      }
      return response(200, { status: { id: `cmd-${state.commands.length}`, result: 'ACCEPTED' } });
    }
    return response(404, {});
  };
  fn.calls = calls;
  fn.state = state;
  fn.cars = cars;
  fn.set = set;
  return fn;
}

/**
 * @description Wait until a condition holds (a few event loop turns).
 * @param {Function} condition - The condition.
 * @param {number} [turns] - The maximum number of turns.
 * @returns {Promise<void>}
 */
export async function until(condition, turns = 500) {
  for (let i = 0; i < turns; i += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Condition not reached');
}

export const noSleep = async () => {};

export const fakeGladys = {
  externalIds: (type, id) => ({
    device: `ext:porsche-connect:${type}:${id}`,
    feature: (key) => `ext:porsche-connect:${type}:${id}:${key}`,
  }),
};
