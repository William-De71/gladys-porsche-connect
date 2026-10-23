// The Porsche client against the fake cloud: the Auth0 sign-in (identifier
// first, captcha, passkey enrollment, refresh, stored session), the PPA API
// (overview, commands and their progress) and the command payloads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createAuth, createPkce, extractCaptcha } from '../src/porsche/auth.js';
import { createApi, measurementsOf } from '../src/porsche/api.js';
import { captchaKey, captchaPng, svgOf } from '../src/porsche/captcha.js';
import { KINDS, redactVin } from '../src/porsche/errors.js';
import { buildCommand, pinHash, supports, climateRange } from '../src/commands.js';
import { describe } from '../src/vehicle.js';
import {
  VEHICLES,
  VIN_BEV,
  VIN_PETROL,
  BEV_COMMANDS,
  PETROL_COMMANDS,
  BEV_MEASUREMENTS,
  CAPTCHA_IMAGE,
  CAPTCHA_SVG,
  captchaPage,
  fakePorsche,
  overviewOf,
  noSleep,
} from './helpers/fixtures.js';

const credentials = { email: 'me@example.com', password: 'secret' };

/**
 * @description An auth and an API on a fake cloud, with a temporary /data.
 * @param {object} t - The test context.
 * @param {object} [cloud] - Options of the fake cloud.
 * @param {object} [login] - The credentials.
 * @returns {Promise<object>} `{ auth, api, fetchImpl, dataDir }`.
 */
async function setup(t, cloud = {}, login = credentials) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'porsche-client-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const fetchImpl = fakePorsche(cloud);
  const auth = createAuth({ fetchImpl, getCredentials: () => login, dataDir, sleep: noSleep });
  const api = createApi({ fetchImpl, auth, sleep: noSleep });
  return { auth, api, fetchImpl, dataDir };
}

test('PKCE: a verifier and its S256 challenge', () => {
  const { verifier, challenge } = createPkce();
  assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
});

test('signs in through the identifier-first pages and keeps the tokens in /data', async (t) => {
  const { auth, fetchImpl, dataDir } = await setup(t);
  assert.equal(await auth.accessToken(), 'access-1');
  const authorize = new URL(fetchImpl.calls[0].url);
  assert.equal(authorize.pathname, '/authorize');
  assert.equal(authorize.searchParams.get('client_id'), 'XhygisuebbrqQ80byOuU5VncxLIm8E6H');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'my-porsche-app://auth0/callback');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  const steps = fetchImpl.calls.map((call) => `${call.method} ${new URL(call.url).pathname}`);
  assert.deepEqual(steps, [
    'GET /authorize',
    'POST /u/login/identifier',
    'POST /u/login/password',
    'GET /authorize/resume',
    'POST /oauth/token',
  ]);
  // The login transaction cookie travels with every page.
  assert.match(fetchImpl.calls[1].init.headers.cookie, /auth0=tx1/);
  const file = path.join(dataDir, 'session.json');
  const stored = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(stored.refreshToken, 'refresh-1');
  assert.equal(stored.account, 'me@example.com');
  assert.equal(JSON.stringify(stored).includes('secret'), false, 'never the password');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  // Still valid: no new request.
  assert.equal(await auth.accessToken(), 'access-1');
  assert.equal(fetchImpl.calls.length, 5);
});

test('an existing Auth0 session gives the code at once', async (t) => {
  const { auth, fetchImpl } = await setup(t, { session: true });
  assert.equal(await auth.accessToken(), 'access-1');
  assert.equal(fetchImpl.calls.length, 2);
});

test('a restart refreshes the stored session instead of signing in', async (t) => {
  const { auth, fetchImpl, dataDir } = await setup(t);
  await auth.accessToken();
  let clock = Date.now() + 2 * 60 * 60 * 1000;
  const again = createAuth({
    fetchImpl,
    getCredentials: () => credentials,
    dataDir,
    sleep: noSleep,
    now: () => clock,
  });
  assert.equal(await again.accessToken(), 'access-2');
  const last = fetchImpl.calls.at(-1);
  assert.equal(new URLSearchParams(last.init.body).get('grant_type'), 'refresh_token');
  // A refused refresh token: a new sign-in.
  fetchImpl.state.refresh = 'revoked';
  clock += 2 * 60 * 60 * 1000;
  assert.equal(await again.accessToken(), 'access-3');
});

test('another e-mail forgets the stored session', async (t) => {
  const login = { ...credentials };
  const { auth, fetchImpl } = await setup(t, {}, login);
  await auth.accessToken();
  login.email = 'other@example.com';
  await assert.rejects(auth.accessToken(), (err) => err.kind === KINDS.AUTH);
  assert.equal(fetchImpl.calls.filter((c) => c.url.includes('/authorize?')).length, 2);
});

test('a wrong password is an auth error, never retried by the client', async (t) => {
  const { auth, fetchImpl } = await setup(t, {}, { ...credentials, password: 'wrong' });
  await assert.rejects(
    auth.accessToken(),
    (err) => err.kind === KINDS.AUTH && !/wrong/.test(err.message),
  );
  assert.equal(fetchImpl.calls.filter((c) => c.url.includes('/u/login/password')).length, 1);
});

test('a captcha pauses the sign-in until its answer, with the same transaction', async (t) => {
  const { auth, fetchImpl } = await setup(t, { captcha: 'X7KQ' });
  await assert.rejects(auth.accessToken(), (err) => {
    assert.equal(err.kind, KINDS.CAPTCHA);
    assert.equal(err.image, CAPTCHA_IMAGE);
    return true;
  });
  assert.equal(auth.captcha(), CAPTCHA_IMAGE);
  // While it waits, no new sign-in (each one would bring a new captcha).
  const before = fetchImpl.calls.length;
  await assert.rejects(auth.accessToken(), (err) => err.kind === KINDS.CAPTCHA);
  assert.equal(fetchImpl.calls.length, before);
  // A wrong answer: a new picture.
  await assert.rejects(auth.solveCaptcha('nope'), (err) => err.kind === KINDS.CAPTCHA);
  assert.equal(fetchImpl.state.captchas, 2);
  await auth.solveCaptcha(' X7KQ ');
  assert.equal(auth.captcha(), null);
  assert.equal(await auth.accessToken(), 'access-1');
  const answer = fetchImpl.calls.filter((c) => c.url.includes('/u/login/identifier')).at(-1);
  assert.equal(new URLSearchParams(answer.init.body).get('captcha'), 'X7KQ');
  assert.match(answer.init.headers.cookie, /auth0=tx1/);
});

test('an old captcha is replaced by a new sign-in', async (t) => {
  let clock = Date.now();
  const dataDir = await mkdtemp(path.join(tmpdir(), 'porsche-client-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const fetchImpl = fakePorsche({ captcha: 'X7KQ' });
  const auth = createAuth({
    fetchImpl,
    getCredentials: () => credentials,
    dataDir,
    sleep: noSleep,
    now: () => clock,
  });
  await assert.rejects(auth.accessToken());
  clock += 11 * 60 * 1000;
  assert.equal(auth.captcha(), null);
  await assert.rejects(auth.solveCaptcha('X7KQ'), (err) => err.kind === KINDS.CAPTCHA);
  assert.equal(fetchImpl.calls.filter((c) => c.url.includes('/authorize?')).length, 2);
});

test('declines the passkey enrollment page on the way back', async (t) => {
  const { auth, fetchImpl } = await setup(t, { passkey: true });
  assert.equal(await auth.accessToken(), 'access-1');
  assert.equal(fetchImpl.state.passkeyShown, true);
});

test('reads the captcha from the Auth0 context, an img tag or an inline SVG', () => {
  assert.equal(extractCaptcha(captchaPage(CAPTCHA_IMAGE)), CAPTCHA_IMAGE);
  assert.equal(
    extractCaptcha('<img class="x" alt="captcha" src="data:image/png;base64,iVBOR">'),
    'data:image/png;base64,iVBOR',
  );
  assert.equal(
    extractCaptcha('<div>data:image/svg+xml;utf8,%3Csvg%3E</div>'),
    'data:image/svg+xml;utf8,%3Csvg%3E',
  );
  assert.equal(extractCaptcha('<html></html>'), null);
});

test('draws the captcha as a PNG the dashboard accepts', async () => {
  assert.equal(svgOf(CAPTCHA_IMAGE), CAPTCHA_SVG);
  const png = Buffer.from(await captchaPng(CAPTCHA_IMAGE), 'base64');
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(png.readUInt32BE(16), 300, 'twice as wide');
  assert.ok(png.length < 300 * 1024);
  assert.match(captchaKey(CAPTCHA_IMAGE), /^captcha-[0-9a-f]{16}$/);
  assert.notEqual(captchaKey(CAPTCHA_IMAGE), captchaKey(`${CAPTCHA_IMAGE}A`));
  await assert.rejects(captchaPng('data:text/html,hi'));
});

test('API: vehicles, overview with the measurements and the commands', async (t) => {
  const { api, fetchImpl } = await setup(t);
  const vehicles = await api.vehicles();
  assert.deepEqual(
    vehicles.map((v) => v.vin),
    [VIN_BEV, VIN_PETROL],
  );
  const overview = await api.overview(VIN_BEV, { commands: true });
  const url = new URL(fetchImpl.calls.at(-1).url);
  assert.ok(url.searchParams.getAll('mf').includes('BATTERY_LEVEL'));
  assert.ok(url.searchParams.getAll('cf').includes('LOCK'));
  assert.equal(
    fetchImpl.calls.at(-1).init.headers['x-client-id'],
    '41843fb4-691d-4970-85c7-2673e8ecef40',
  );
  const data = measurementsOf(overview);
  assert.equal(data.get('BATTERY_LEVEL').percent, 78);
  assert.equal(data.has('OPEN_STATE_TOP'), false, 'disabled measurement left out');
  const info = describe(VEHICLES[0], overview);
  assert.equal(info.commands.get('LOCK').enabled, true);
  assert.equal(info.commands.get('CHARGING_SETTINGS_EDIT').enabled, false);
  assert.equal(info.engine, 'BEV');
});

test('API: a refused token is renewed once; 429 and 423 are their own kinds', async (t) => {
  let status = 0;
  const { api, auth, fetchImpl } = await setup(t, {
    api: () => (status ? new Response('{}', { status }) : null),
  });
  await auth.accessToken();
  // The server forgot the token: renewed with the refresh token, then it works.
  fetchImpl.state.access = 'rotated';
  assert.equal((await api.vehicles()).length, 2);
  assert.equal(fetchImpl.state.tokens, 2);
  // Refused again and again: an auth error after one renewal.
  status = 401;
  await assert.rejects(api.vehicles(), (err) => err.kind === KINDS.AUTH);
  status = 429;
  await assert.rejects(api.vehicles(), (err) => err.kind === KINDS.BLOCKED);
  status = 423;
  await assert.rejects(api.vehicles(), (err) => err.kind === KINDS.LOCKED);
  status = 408;
  await assert.rejects(api.overview(VIN_BEV), (err) => {
    assert.equal(err.kind, KINDS.UNAVAILABLE);
    assert.doesNotMatch(err.message, new RegExp(VIN_BEV), 'no VIN in the message');
    return true;
  });
});

test('API: a command is followed until the car runs it', async (t) => {
  const { api, fetchImpl } = await setup(t);
  const result = await api.command(VIN_BEV, { key: 'LOCK', payload: { spin: null } });
  assert.deepEqual(result, { ok: true, status: 'PERFORMED', data: null });
  const urls = fetchImpl.calls.slice(-2).map((c) => `${c.method} ${new URL(c.url).pathname}`);
  assert.deepEqual(urls, [
    `POST /app/connect/v1/vehicles/${VIN_BEV}/commands`,
    `GET /app/connect/v1/vehicles/${VIN_BEV}/commands/cmd-1`,
  ]);
  assert.equal(await api.spinChallenge(VIN_BEV), 'A1B2C3D4');
});

test('API: a command that fails or never ends says so', async (t) => {
  let answer = 'ERROR';
  let clock = 0;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'porsche-client-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const fetchImpl = fakePorsche({
    api: (method, p) =>
      method === 'GET' && p.includes('/commands/')
        ? new Response(JSON.stringify({ status: { result: answer } }), { status: 200 })
        : null,
  });
  const auth = createAuth({
    fetchImpl,
    getCredentials: () => credentials,
    dataDir,
    sleep: noSleep,
  });
  const api = createApi({
    fetchImpl,
    auth,
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  });
  assert.equal((await api.command(VIN_BEV, { key: 'LOCK', payload: {} })).status, 'ERROR');
  answer = 'IN_PROGRESS';
  assert.deepEqual(await api.command(VIN_BEV, { key: 'LOCK', payload: {} }), {
    ok: false,
    status: 'TIMEOUT',
    data: null,
  });
});

test('commands: payloads, support, PIN and charge target', () => {
  const bev = describe(VEHICLES[0], overviewOf(VIN_BEV, [], BEV_COMMANDS));
  const petrol = describe(VEHICLES[1], overviewOf(VIN_PETROL, [], PETROL_COMMANDS));
  assert.deepEqual(buildCommand(bev, 'lock'), { key: 'LOCK', payload: { spin: null } });
  assert.deepEqual(buildCommand(bev, 'flash').payload, { mode: 'FLASH', spin: null });
  assert.equal(buildCommand(bev, 'honk_flash').payload.mode, 'HONK_AND_FLASH');
  assert.deepEqual(climateRange(bev), { min: 15, max: 29 });
  const climate = buildCommand(bev, 'climate_start', { temperature: 21 });
  assert.equal(climate.payload.targetTemperature, 294.15);
  assert.equal(
    buildCommand(bev, 'climate_start', { temperature: 35 }).payload.targetTemperature,
    302.15,
  );
  assert.equal(supports(petrol, 'climate_start'), false);
  assert.equal(supports(petrol, 'direct_charge_start'), false);
  assert.throws(() => buildCommand(petrol, 'climate_start'), { code: 'unsupported' });
  assert.throws(() => buildCommand(bev, 'unlock', { pin: '12' }), { code: 'pin_required' });
  const unlock = buildCommand(bev, 'unlock', { pin: '1234', challenge: 'A1B2C3D4' });
  assert.equal(unlock.payload.spin.challenge, 'A1B2C3D4');
  // SHA-512 of the bytes 12 34 A1 B2 C3 D4, as pyporscheconnectapi computes it.
  assert.equal(
    unlock.payload.spin.hash,
    createHash('sha512').update(Buffer.from('1234A1B2C3D4', 'hex')).digest('hex').toUpperCase(),
  );
  assert.equal(pinHash('1234', 'A1B2C3D4'), unlock.payload.spin.hash);
  // Charge target: the active profile of a car without departure timers.
  const data = measurementsOf(overviewOf(VIN_BEV, BEV_MEASUREMENTS));
  const target = buildCommand(bev, 'charge_target', { level: 73, data });
  assert.equal(target.key, 'CHARGING_PROFILES_EDIT');
  assert.deepEqual(
    target.payload.list.map((p) => [p.id, p.minSoc]),
    [
      [4, 75],
      [5, 60],
    ],
  );
  assert.equal(data.get('CHARGING_PROFILES').list[0].minSoc, 80, 'the reading is not changed');
  data.set('DEPARTURES', {});
  assert.deepEqual(buildCommand(bev, 'charge_target', { level: 10, data }), {
    key: 'CHARGING_SETTINGS_EDIT',
    payload: { targetSoc: 25, spin: null },
  });
  // Unknown capabilities: tried.
  assert.equal(supports(describe(VEHICLES[0]), 'unlock'), true);
});

test('VINs are hidden in messages', () => {
  assert.equal(redactVin(`car ${VIN_BEV} failed`), 'car WP0…0001 failed');
});
