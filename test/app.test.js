// The whole integration against the fake Gladys of the SDK, which checks the
// discovered devices, the states, the transports and the scene events like
// the host API does, and the fake Porsche cloud.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { WIDGETS, WIDGET_ACTIONS } from '../src/widgets.js';
import { SCENE_TRIGGERS } from '../src/events.js';
import { captchaKey } from '../src/porsche/captcha.js';
import {
  VIN_BEV,
  VIN_PETROL,
  CAPTCHA_IMAGE,
  fakePorsche,
  noSleep,
  until,
} from './helpers/fixtures.js';

const CONFIG = { email: 'me@example.com', password: 'secret', pin: '1234' };
const HOME = { selector: 'home', name: 'Home', latitude: 48.8584, longitude: 2.2945 };
const BEV_ID = `ext:test-integration:vehicle:${VIN_BEV}`;
const PETROL_ID = `ext:test-integration:vehicle:${VIN_PETROL}`;

/**
 * @description The integration, connected to a fake Gladys and a fake cloud.
 * @param {object} t - The test context.
 * @param {object} [options] - `{ config, cloud }`.
 * @returns {Promise<object>} `{ gladys, app, fetchImpl }`.
 */
async function startApp(t, { config = CONFIG, cloud = {} } = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'porsche-app-'));
  const gladys = createFakeGladys({ config: { ...config }, houses: [HOME] });
  const fetchImpl = fakePorsche(cloud);
  const app = createApp(gladys, { fetchImpl, dataDir, sleep: noSleep });
  t.after(async () => {
    await gladys.fake.shutdown();
    await rm(dataDir, { recursive: true, force: true });
  });
  await gladys.connect();
  if (config.email) {
    await until(() => app.status().accountState !== 'stopped');
  }
  return { gladys, app, fetchImpl };
}

const deviceOf = (gladys, id) => gladys.fake.discoveredDevices.find((d) => d.external_id === id);

/**
 * @description Create the discovered devices in the fake Gladys.
 * @param {object} gladys - The fake Gladys.
 * @returns {Promise<void>}
 */
async function createAll(gladys) {
  for (const device of [...gladys.fake.discoveredDevices]) {
    gladys.fake.devices.push(device);
    await gladys.fake.deviceCreated(device);
  }
}

test('signs in, offers one device per car with the values of its first reading', async (t) => {
  const { gladys, app } = await startApp(t);
  assert.equal(app.status().accountState, 'connected');
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.external_id).sort(),
    [BEV_ID, PETROL_ID].sort(),
  );
  const bev = deviceOf(gladys, BEV_ID);
  assert.equal(bev.name, 'Porsche Taycan 4S (…0001)');
  assert.ok(bev.features.length > 15);
  assert.ok(app.status().timer, 'the next reading is planned');
  // No state before the user creates the device.
  assert.equal(gladys.fake.states.length, 0);
});

test('a created car gets all its states, its transport, then only the changes', async (t) => {
  const { gladys, app, fetchImpl } = await startApp(t);
  await createAll(gladys);
  assert.equal(gladys.fake.lastState(`${BEV_ID}:battery_level`), 78);
  assert.equal(gladys.fake.lastState(`${BEV_ID}:lock`), 1);
  assert.equal(gladys.fake.lastState(`${BEV_ID}:distance_home`), 0);
  assert.equal(gladys.fake.lastState(`${PETROL_ID}:doors`), 1);
  assert.ok(gladys.fake.transports.some((entry) => entry.transport === 'cloud'));
  const before = gladys.fake.states.length;
  await app.round();
  assert.equal(gladys.fake.states.length, before, 'nothing changed: nothing published');
  fetchImpl.set(VIN_BEV, 'BATTERY_LEVEL', { percent: 80 });
  await app.round();
  assert.equal(gladys.fake.lastState(`${BEV_ID}:battery_level`), 80);
  assert.equal(gladys.fake.states.length, before + 1);
});

test('scene triggers on changes between readings, never at the start', async (t) => {
  const { gladys, app, fetchImpl } = await startApp(t);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  fetchImpl.set(VIN_BEV, 'LOCK_STATE_VEHICLE', { isLocked: false });
  fetchImpl.set(VIN_BEV, 'CHARGING_SUMMARY', { status: 'NOT_PLUGGED' });
  await app.round();
  fetchImpl.set(VIN_BEV, 'CHARGING_SUMMARY', { status: 'CHARGING' });
  fetchImpl.set(VIN_PETROL, 'LOCK_STATE_VEHICLE', { isLocked: true });
  fetchImpl.set(VIN_PETROL, 'GPS_LOCATION', { location: '48.858500,2.294600' });
  await app.round();
  const keys = gladys.fake.sceneEvents.map((event) => `${event.key}:${event.data.vehicle}`);
  assert.deepEqual(keys, [
    `${SCENE_TRIGGERS.LOCK_CHANGED}:${BEV_ID}`,
    `${SCENE_TRIGGERS.CHARGING_CHANGED}:${BEV_ID}`,
    `${SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED}:${BEV_ID}`,
    `${SCENE_TRIGGERS.CHARGING_CHANGED}:${BEV_ID}`,
    `${SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED}:${BEV_ID}`,
    `${SCENE_TRIGGERS.LOCK_CHANGED}:${PETROL_ID}`,
    `${SCENE_TRIGGERS.LEFT_OPEN}:${PETROL_ID}`,
    `${SCENE_TRIGGERS.HOME_CHANGED}:${PETROL_ID}`,
  ]);
  const left = gladys.fake.sceneEvents.find((event) => event.key === SCENE_TRIGGERS.LEFT_OPEN);
  assert.equal(left.data.openings, 'doors');
});

test('commands: the lock feature, the PIN for unlocking, quiet triggers', async (t) => {
  const { gladys, app, fetchImpl } = await startApp(t);
  await createAll(gladys);
  const bev = deviceOf(gladys, BEV_ID);
  const lock = bev.features.find((feature) => feature.external_id === `${BEV_ID}:lock`);
  const ack = await gladys.fake.setValue(bev, lock, 0);
  assert.equal(ack.success, true);
  await until(() => gladys.fake.lastState(`${BEV_ID}:lock`) === 0);
  const unlock = fetchImpl.state.commands.filter((c) => c.vin === VIN_BEV).map((c) => c.key);
  assert.deepEqual(unlock, ['SPIN_CHALLENGE', 'UNLOCK']);
  // The change Gladys made fires no trigger.
  assert.equal(gladys.fake.sceneEvents.length, 0);
  // Climate with the configured temperature.
  const climate = bev.features.find((feature) => feature.external_id === `${BEV_ID}:climate`);
  await gladys.fake.setValue(bev, climate, 1);
  await until(() => gladys.fake.lastState(`${BEV_ID}:climate`) === 1);
  const start = fetchImpl.state.commands.find((c) => c.key === 'REMOTE_CLIMATIZER_START');
  assert.equal(start.payload.targetTemperature, 294.15);
  // A read-only feature is refused.
  const doors = bev.features.find((feature) => feature.external_id === `${BEV_ID}:doors`);
  assert.equal((await gladys.fake.setValue(bev, doors, 1)).success, false);
  assert.ok(app.cars.size === 2);
});

test('unlock without a PIN is refused before anything is sent', async (t) => {
  const { gladys, fetchImpl } = await startApp(t, { config: { ...CONFIG, pin: '' } });
  const bev = deviceOf(gladys, BEV_ID);
  const lock = bev.features.find((feature) => feature.external_id === `${BEV_ID}:lock`);
  const ack = await gladys.fake.setValue(bev, lock, 0);
  assert.equal(ack.success, false);
  assert.match(ack.error, /PIN/);
  assert.equal(fetchImpl.state.commands.length, 0);
});

test('scene actions: send a command and wait, read the status', async (t) => {
  const { gladys } = await startApp(t);
  const sent = await gladys.fake.sceneAction('send_command', {
    vehicle: PETROL_ID,
    command: 'lock',
  });
  assert.equal(sent.success, true);
  assert.equal(sent.data.outputs.success, true);
  assert.equal(sent.data.outputs.status, 'PERFORMED');
  const refused = await gladys.fake.sceneAction('send_command', {
    vehicle: PETROL_ID,
    command: 'climate_start',
  });
  assert.equal(refused.data.outputs.success, false);
  assert.equal(refused.data.outputs.status, 'unsupported');
  const status = await gladys.fake.sceneAction('get_status', { vehicle: PETROL_ID });
  assert.equal(status.data.outputs.locked, true);
  assert.equal(status.data.outputs.fuel_level, 55);
  assert.equal(status.data.outputs.openings, 'doors');
  assert.match(status.data.outputs.summary, /Porsche Weekend car/);
  assert.match(status.data.outputs.map_url, /openstreetmap/);
  // The default car is the first one.
  const first = await gladys.fake.sceneAction('get_status', {});
  assert.equal(first.data.outputs.battery_level, 78);
});

test('the widget: a card per car, the buttons send commands', async (t) => {
  const { gladys, fetchImpl } = await startApp(t);
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await gladys.fake.widgetGet(WIDGETS.VEHICLE, {
      settings: { vehicle: PETROL_ID },
      language,
    });
    assert.equal(ack.success, true);
    assert.deepEqual(validateWidgetContent(ack.data.content), []);
  }
  const ack = await gladys.fake.widgetAction(WIDGETS.VEHICLE, WIDGET_ACTIONS.LOCK, {
    vin: VIN_PETROL,
  });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.en, /lock/);
  await until(() => fetchImpl.state.commands.some((c) => c.key === 'LOCK'));
  const unknown = await gladys.fake.widgetAction(WIDGETS.VEHICLE, 'reboot', { vin: VIN_PETROL });
  assert.equal(unknown.success, false);
});

test('a captcha: shown in the widget, answered there, then the cars are read', async (t) => {
  const { gladys, app } = await startApp(t, { cloud: { captcha: 'X7KQ' } });
  assert.equal(app.status().accountState, 'captcha');
  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.en, /captcha/);
  const problem = gladys.fake.sceneEvents.find((e) => e.key === SCENE_TRIGGERS.ACCOUNT_PROBLEM);
  assert.equal(problem.data.reason, 'captcha');
  assert.equal(app.status().timer, null, 'no retry loop while it waits');

  const content = (await gladys.fake.widgetGet(WIDGETS.VEHICLE, { language: 'fr' })).data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  const image = content.components.find((c) => c.type === 'image');
  assert.equal(image.key, captchaKey(CAPTCHA_IMAGE));
  const picture = await gladys.fake.widgetGetImage(image.key);
  assert.equal(picture.success, true);
  assert.deepEqual(validateWidgetImage(picture.data.image ?? picture.data), []);
  assert.equal((await gladys.fake.widgetGetImage('captcha-0000000000000000')).success, false);

  const button = content.components.find((c) => c.type === 'button');
  assert.equal(button.action.fields[0].key, 'code');
  const wrong = await gladys.fake.widgetAction(
    WIDGETS.VEHICLE,
    WIDGET_ACTIONS.CAPTCHA,
    {},
    {
      values: { code: 'nope' },
    },
  );
  assert.match(wrong.data.message.en, /Wrong code/);
  const right = await gladys.fake.widgetAction(
    WIDGETS.VEHICLE,
    WIDGET_ACTIONS.CAPTCHA,
    {},
    {
      values: { code: 'X7KQ' },
    },
  );
  assert.equal(right.success, true);
  await until(() => app.status().accountState === 'connected');
  assert.equal(gladys.fake.discoveredDevices.length, 2);
  const card = (await gladys.fake.widgetGet(WIDGETS.VEHICLE, { language: 'en' })).data.content;
  assert.ok(card.components.some((c) => c.type === 'status'));
});

test('a refused password: reported once, no retry until the settings change', async (t) => {
  const { gladys, app, fetchImpl } = await startApp(t, {
    config: { ...CONFIG, password: 'wrong' },
  });
  assert.equal(app.status().accountState, 'auth');
  assert.equal(app.status().timer, null);
  assert.equal(
    gladys.fake.sceneEvents.filter((e) => e.key === SCENE_TRIGGERS.ACCOUNT_PROBLEM).length,
    1,
  );
  const signIns = () => fetchImpl.calls.filter((c) => c.url.includes('/u/login/password')).length;
  assert.equal(signIns(), 1);
  const widget = (await gladys.fake.widgetGet(WIDGETS.VEHICLE, { language: 'en' })).data.content;
  assert.match(widget.components[0].text, /refused/);
  gladys.fake.config.password = 'secret';
  await gladys.fake.configUpdated({ ...CONFIG });
  await until(() => app.status().accountState === 'connected');
  assert.equal(signIns(), 2);
});

test('Porsche limiting the requests slows the readings, flagged on the transport', async (t) => {
  let limited = false;
  const { gladys, app } = await startApp(t, {
    cloud: {
      api: (method, p) =>
        limited && p.includes('/vehicles/') ? new Response('{}', { status: 429 }) : null,
    },
  });
  await createAll(gladys);
  limited = true;
  await app.round();
  assert.equal(app.status().accountState, 'blocked');
  assert.ok(app.status().timer, 'tried again later');
  assert.ok(gladys.fake.transports.some((entry) => entry.degraded === true));
  limited = false;
  await app.round();
  assert.equal(app.status().accountState, 'connected');
});

test('configuration actions: test, read now, diagnostic without VIN nor position', async (t) => {
  const logs = [];
  const { gladys } = await startApp(t);
  const test1 = await gladys.fake.action('test_connection');
  assert.match(test1.data.message.en, /Signed in.*Taycan 4S.*8 commands/);
  const read = await gladys.fake.action('refresh');
  assert.match(read.data.message.fr, /2 voiture/);
  const { logger } = await import('@gladysassistant/integration-sdk');
  const original = logger.info;
  logger.info = (line) => logs.push(String(line));
  t.after(() => {
    logger.info = original;
  });
  const diagnostic = await gladys.fake.action('diagnostic');
  assert.equal(diagnostic.success, true);
  const text = logs.join('\n');
  assert.match(text, /BATTERY_LEVEL/);
  assert.doesNotMatch(text, new RegExp(VIN_BEV));
  assert.doesNotMatch(text, /48\.858/);
  const signOut = await gladys.fake.action('sign_out');
  assert.equal(signOut.success, true);
});

test('no account: a message, nothing offered', async (t) => {
  const { gladys } = await startApp(t, { config: {} });
  assert.equal(gladys.fake.connectionStatus.connected, false);
  const widget = (await gladys.fake.widgetGet(WIDGETS.VEHICLE, { language: 'en' })).data.content;
  assert.match(widget.components[0].text, /My Porsche account/);
});
