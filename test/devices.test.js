// The traps of the Gladys core that the fake Gladys does not catch
// (community feedback, thread 11005): every feature needs min / max /
// read_only / has_feedback, a wrong category / type pair shows no icon nor
// label, a unit outside DEVICE_FEATURE_UNITS_BY_CATEGORY is refused. Plus the
// pure logic of the scene events, the widget and the transport badge.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
  validateWidgetContent,
} from '@gladysassistant/integration-sdk';

import { buildDevice, buildStates, parseExternalId, vehicleName } from '../src/device.js';
import {
  detectEvents,
  buildSceneEvent,
  buildAccountProblemEvent,
  ACCOUNT_PROBLEMS,
  SCENE_TRIGGERS,
} from '../src/events.js';
import { buildVehicleWidget, captchaContent } from '../src/widgets.js';
import { transportOf } from '../src/transport.js';
import { describe, summarize } from '../src/vehicle.js';
import { LANGUAGES } from '../src/i18n.js';
import {
  VEHICLES,
  VIN_BEV,
  VIN_PETROL,
  BEV_MEASUREMENTS,
  BEV_COMMANDS,
  PETROL_MEASUREMENTS,
  PETROL_COMMANDS,
  CAPTCHA_IMAGE,
  NOW,
  copy,
  overviewOf,
  fakeGladys,
} from './helpers/fixtures.js';

const BEV = describe(VEHICLES[0], overviewOf(VIN_BEV, [], BEV_COMMANDS));
const PETROL = describe(VEHICLES[1], overviewOf(VIN_PETROL, [], PETROL_COMMANDS));
const snapshotOf = (info, measurements) => summarize(overviewOf(info.vin, measurements), info);
const BEV_SNAPSHOT = snapshotOf(BEV, BEV_MEASUREMENTS);
const PETROL_SNAPSHOT = snapshotOf(PETROL, PETROL_MEASUREMENTS);
const with_ = (measurements, key, value) =>
  copy(measurements).map((item) =>
    item.key === key ? { ...item, value: { ...item.value, ...value } } : item,
  );

// Pairs with a label in the Gladys front (front/src/config/i18n, v5.2.1), and
// the units DEVICE_FEATURE_UNITS_BY_CATEGORY of the core accepts for them.
const PAIRS = {
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_LEVEL}`]: [U.PERCENT],
  [`${C.ELECTRICAL_VEHICLE_BATTERY}/${T.ELECTRICAL_VEHICLE_BATTERY.BATTERY_RANGE_ESTIMATE}`]: [
    U.KM,
  ],
  [`${C.LEVEL_SENSOR}/${T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT}`]: [U.PERCENT],
  [`${C.DISTANCE_SENSOR}/${T.SENSOR.DECIMAL}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.ODOMETER}`]: [U.KM],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.DOOR_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.WINDOW_OPENED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_STATE}/${T.ELECTRICAL_VEHICLE_STATE.TIRE_PRESSURE}`]: [U.BAR],
  [`${C.ELECTRICAL_VEHICLE_COMMAND}/${T.ELECTRICAL_VEHICLE_COMMAND.LOCK}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.PLUGGED}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_ON}`]: [undefined],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.CHARGE_POWER}`]: [U.KILOWATT],
  [`${C.ELECTRICAL_VEHICLE_CHARGE}/${T.ELECTRICAL_VEHICLE_CHARGE.TARGET_CHARGE_LIMIT}`]: [
    U.PERCENT,
  ],
  [`${C.ELECTRICAL_VEHICLE_CLIMATE}/${T.ELECTRICAL_VEHICLE_CLIMATE.CLIMATE_ON}`]: [undefined],
  [`${C.DURATION}/${T.DURATION.INTEGER}`]: [U.DAYS],
  [`${C.TEXT}/${T.TEXT.TEXT}`]: [undefined],
};

test('every feature: a known pair, an accepted unit, the four mandatory fields', () => {
  for (const [info, snapshot] of [
    [BEV, BEV_SNAPSHOT],
    [PETROL, PETROL_SNAPSHOT],
  ]) {
    const device = buildDevice(fakeGladys, info, snapshot, { language: 'en', distanceHomeKm: 1.2 });
    for (const feature of device.features) {
      const units = PAIRS[`${feature.category}/${feature.type}`];
      assert.ok(units, `${feature.external_id}: ${feature.category}/${feature.type}`);
      assert.ok(units.includes(feature.unit), `${feature.external_id}: ${feature.unit}`);
      for (const field of ['min', 'max', 'read_only', 'has_feedback']) {
        assert.notEqual(feature[field], undefined, `${feature.external_id} ${field}`);
      }
      assert.ok(feature.min <= feature.max, feature.external_id);
    }
    assert.equal(device.should_poll, false);
    assert.equal(device.poll_frequency, undefined);
  }
});

test('an electric car gets its battery features, a petrol one its fuel and range', () => {
  const ev = buildDevice(fakeGladys, BEV, BEV_SNAPSHOT, { language: 'en', distanceHomeKm: null });
  const keys = ev.features.map((feature) => parseExternalId(feature.external_id).feature);
  assert.ok(keys.includes('battery_level') && keys.includes('battery_range'));
  assert.ok(!keys.includes('fuel_level') && !keys.includes('range'), 'no fuel on a Taycan');
  assert.ok(!keys.includes('distance_home'), 'no house: no distance');
  assert.ok(!keys.includes('charge_power') || BEV_SNAPSHOT.charge.powerKw !== null);
  const petrol = buildDevice(fakeGladys, PETROL, PETROL_SNAPSHOT, {
    language: 'en',
    distanceHomeKm: 3,
  });
  const petrolKeys = petrol.features.map((feature) => parseExternalId(feature.external_id).feature);
  assert.ok(petrolKeys.includes('fuel_level') && petrolKeys.includes('range'));
  assert.ok(!petrolKeys.includes('battery_level'), 'disabled measurement: no feature');
  assert.ok(!petrolKeys.includes('climate') && !petrolKeys.includes('roof'));
  assert.equal(petrol.name, 'Porsche Weekend car (…0002)');
  assert.equal(vehicleName(BEV, 'fr'), 'Porsche Taycan 4S (…0001)');
});

test('commands are writable only when the car accepts them', () => {
  const device = buildDevice(fakeGladys, BEV, BEV_SNAPSHOT, { language: 'en' });
  const feature = (key) => device.features.find((f) => f.external_id.endsWith(`:${key}`));
  assert.equal(feature('lock').read_only, false);
  assert.equal(feature('climate').read_only, false);
  assert.equal(feature('charge_target').read_only, false);
  assert.equal(feature('charge_target').step, 5);
  assert.equal(feature('doors').read_only, true);
  const petrol = buildDevice(fakeGladys, PETROL, PETROL_SNAPSHOT, { language: 'en' });
  assert.equal(petrol.features.find((f) => f.external_id.endsWith(':lock')).read_only, false);
});

test('states: known values only, text in the language, nothing for unknown', () => {
  const states = buildStates(fakeGladys, BEV, BEV_SNAPSHOT, {
    language: 'fr',
    distanceHomeKm: 0.04,
  });
  const state = (key) =>
    states.find(
      (s) => s.device_feature_external_id === `ext:porsche-connect:vehicle:${VIN_BEV}:${key}`,
    );
  assert.equal(state('battery_level').state, 78);
  assert.equal(state('lock').state, 1);
  assert.equal(state('doors').state, 0);
  assert.equal(state('charging_status').text, 'Pas en charge');
  assert.equal(state('charge_target').state, 80);
  assert.equal(state('tire_front_left').state, 2.7);
  assert.equal(state('distance_home').state, 0);
  assert.equal(state('fuel_level'), undefined);
  const empty = buildStates(fakeGladys, BEV, summarize(null, BEV), { language: 'en' });
  assert.deepEqual(empty, []);
});

test('scene events: transitions only, never on the first reading', () => {
  const reading = (snapshot, atHome = true) => ({ snapshot, atHome, distanceHomeKm: 0 });
  assert.deepEqual(detectEvents(null, reading(BEV_SNAPSHOT)), []);
  assert.deepEqual(detectEvents(reading(BEV_SNAPSHOT), reading(BEV_SNAPSHOT)), []);

  const unlocked = snapshotOf(
    BEV,
    with_(BEV_MEASUREMENTS, 'LOCK_STATE_VEHICLE', { isLocked: false }),
  );
  assert.deepEqual(detectEvents(reading(BEV_SNAPSHOT), reading(unlocked)), [
    { key: SCENE_TRIGGERS.LOCK_CHANGED, values: { state: 'unlocked' } },
  ]);

  const leftOpen = snapshotOf(
    BEV,
    with_(BEV_MEASUREMENTS, 'OPEN_STATE_LID_REAR', { isOpen: true }),
  );
  assert.deepEqual(
    detectEvents(reading(BEV_SNAPSHOT), reading(leftOpen)).map((e) => e.key),
    [SCENE_TRIGGERS.LEFT_OPEN],
  );

  const charging = snapshotOf(
    BEV,
    with_(with_(BEV_MEASUREMENTS, 'CHARGING_SUMMARY', { status: 'CHARGING' }), 'CHARGING_RATE', {
      chargingPower: 10.8,
    }),
  );
  assert.equal(charging.charge.active, true);
  assert.equal(charging.charge.powerKw, 10.8);
  const unplugged = snapshotOf(
    BEV,
    with_(BEV_MEASUREMENTS, 'CHARGING_SUMMARY', { status: 'NOT_PLUGGED' }),
  );
  assert.deepEqual(
    detectEvents(reading(unplugged), reading(charging)).map((e) => [e.key, e.values]),
    [
      [SCENE_TRIGGERS.CHARGING_CHANGED, { status: 'charging' }],
      [SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED, { state: 'plugged' }],
    ],
  );

  assert.deepEqual(detectEvents(reading(BEV_SNAPSHOT, true), reading(BEV_SNAPSHOT, false)), [
    { key: SCENE_TRIGGERS.HOME_CHANGED, values: { state: 'left' } },
  ]);

  const flat = snapshotOf(
    BEV,
    with_(BEV_MEASUREMENTS, 'TIRE_PRESSURE_REAR_LEFT', {
      actualPressureBar: 2.4,
      differenceBar: -0.5,
    }),
  );
  assert.deepEqual(detectEvents(reading(BEV_SNAPSHOT), reading(flat)), [
    { key: SCENE_TRIGGERS.TIRE_PRESSURE_LOW, values: { tires: ['rearLeft'] } },
  ]);
});

test('scene event data: flat scalars, the car, a summary in every language', () => {
  const reading = { snapshot: BEV_SNAPSHOT, atHome: true, distanceHomeKm: 0.05 };
  const events = [
    { key: SCENE_TRIGGERS.LOCK_CHANGED, values: { state: 'locked' } },
    { key: SCENE_TRIGGERS.LEFT_OPEN, values: { openings: ['doors', 'roof'] } },
    { key: SCENE_TRIGGERS.CHARGING_CHANGED, values: { status: 'charging_completed' } },
    { key: SCENE_TRIGGERS.CHARGER_CONNECTION_CHANGED, values: { state: 'unplugged' } },
    { key: SCENE_TRIGGERS.HOME_CHANGED, values: { state: 'arrived' } },
    { key: SCENE_TRIGGERS.TIRE_PRESSURE_LOW, values: { tires: ['frontLeft', 'rearRight'] } },
  ];
  for (const language of LANGUAGES) {
    for (const event of events) {
      const { key, data } = buildSceneEvent(event, {
        vehicle: 'ext:porsche-connect:vehicle:X',
        carName: 'Porsche Taycan 4S',
        reading,
        language,
      });
      assert.equal(key, event.key);
      assert.ok(Object.keys(data).length <= 30);
      for (const value of Object.values(data)) {
        assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value), key);
      }
      assert.match(data.summary, /Porsche Taycan 4S/);
    }
  }
  for (const reason of ACCOUNT_PROBLEMS) {
    const { data } = buildAccountProblemEvent(reason, 'de');
    assert.equal(data.reason, reason);
    assert.ok(data.summary.length > 20);
  }
});

test('the widget passes the validator in every language, with and without data', () => {
  const reading = { snapshot: BEV_SNAPSHOT, atHome: false, distanceHomeKm: 12.4, readAt: NOW };
  for (const language of LANGUAGES) {
    for (const [info, snapshot] of [
      [BEV, BEV_SNAPSHOT],
      [PETROL, PETROL_SNAPSHOT],
    ]) {
      const content = buildVehicleWidget({
        info,
        reading: { ...reading, snapshot },
        canUnlock: true,
        language,
        now: NOW + 60000,
      });
      assert.deepEqual(validateWidgetContent(content), [], `${info.vin} ${language}`);
      assert.ok(content.components.length <= 8);
    }
    const loading = buildVehicleWidget({ info: BEV, reading: null, language, now: NOW });
    assert.deepEqual(validateWidgetContent(loading), []);
    const captcha = captchaContent(CAPTCHA_IMAGE, language);
    assert.deepEqual(validateWidgetContent(captcha), [], `captcha ${language}`);
  }
});

test('the widget offers unlock only with a PIN, and the opposite of the lock state', () => {
  const reading = { snapshot: BEV_SNAPSHOT, atHome: true, distanceHomeKm: 0, readAt: NOW };
  const labels = (canUnlock) =>
    buildVehicleWidget({ info: BEV, reading, canUnlock, language: 'en', now: NOW })
      .components.filter((c) => c.type === 'button')
      .map((c) => c.action?.key ?? 'map');
  assert.deepEqual(labels(true), ['unlock', 'climate_start', 'flash', 'map']);
  assert.deepEqual(labels(false), ['climate_start', 'flash', 'map']);
  const petrol = buildVehicleWidget({
    info: PETROL,
    reading: { ...reading, snapshot: PETROL_SNAPSHOT },
    language: 'en',
    now: NOW,
  });
  const keys = petrol.components.filter((c) => c.type === 'button').map((c) => c.action?.key);
  assert.ok(keys.includes('lock') && !keys.includes('climate_start'));
});

test('transport: cloud, degraded while Porsche limits, unreachable on an account problem', () => {
  assert.equal(transportOf('x', 'connected').transport, 'cloud');
  const blocked = transportOf('x', 'blocked');
  assert.equal(blocked.degraded, true);
  for (const language of LANGUAGES) {
    assert.ok(blocked.message[language].length <= 200);
  }
  for (const state of ['auth', 'captcha', 'locked', 'error']) {
    assert.equal(transportOf('x', state).transport, 'unreachable');
  }
});
