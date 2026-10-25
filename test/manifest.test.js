import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { SCENE_TRIGGERS, ACCOUNT_PROBLEMS } from '../src/events.js';
import { ACTIONS } from '../src/app.js';
import { SCENE_ACTIONS } from '../src/scene-actions.js';
import { WIDGETS } from '../src/widgets.js';
import { SCENE_COMMANDS } from '../src/commands.js';
import { CHARGE_STATUSES } from '../src/vehicle.js';
import {
  AUTO_LANGUAGE,
  DEFAULT_POLL_INTERVAL,
  HOME_RADIUS,
  LANGUAGES,
  POLL_INTERVALS,
} from '../src/config.js';
import { CLIMATE_TEMPERATURES } from '../src/commands.js';
import { COMMAND_TIMEOUT_MS } from '../src/porsche/api.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a device integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'device');
  assert.equal(manifest.name, 'Porsche Connect');
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/william-de71/gladys-porsche-connect:${pkg.version}`);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-porsche-connect/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-porsche-connect');
});

test('declares the cloud transport only: everything goes through the Porsche servers', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  // Single channel: no local preference to honour.
  assert.doesNotMatch(source('../src/app.js'), /GLADYS_PREFER_LOCAL/);
});

test('requires Gladys 5.3.0: captcha form of the widget (5.2.0), catalog keywords (5.3.0)', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.match(source('../src/widgets.js'), /fields:/, 'the widget button form needs 5.2.0');
  assert.deepEqual(manifest.categories, ['vehicles']);
  assert.equal(manifest.location, true);
  for (const key of ['network_wake', 'containers', 'network_discovery', 'webhooks']) {
    assert.equal(manifest[key], undefined, key);
  }
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(SCENE_TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
    assert.match(app, new RegExp(`onWidgetAction\\(WIDGETS\\.${key}`), key);
  }
  assert.match(app, /onWidgetGetImage\(/);
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    Object.values(ACTIONS),
  );
  for (const key of Object.keys(ACTIONS)) {
    assert.match(app, new RegExp(`onAction\\(ACTIONS\\.${key}`), key);
  }
});

test('mirrors the values of the code', () => {
  const config = byKey(manifest.config_schema);
  assert.equal(config.get('password').type, 'secret');
  assert.equal(config.get('pin').type, 'secret');
  assert.equal(config.get('email').type, 'string');
  assert.deepEqual(values(config.get('poll_interval')), POLL_INTERVALS);
  assert.equal(config.get('poll_interval').default, DEFAULT_POLL_INTERVAL);
  assert.equal(config.get('climate_temperature').default, String(CLIMATE_TEMPERATURES.default));
  for (const value of values(config.get('climate_temperature'))) {
    const celsius = Number(value);
    assert.ok(celsius >= CLIMATE_TEMPERATURES.min && celsius <= CLIMATE_TEMPERATURES.max);
  }
  ['min', 'max', 'default'].forEach((bound) => {
    assert.equal(config.get('home_radius')[bound], HOME_RADIUS[bound]);
  });
  const triggers = byKey(manifest.scene_triggers);
  assert.deepEqual(
    values(byKey(triggers.get('charging_changed').fields).get('status')),
    CHARGE_STATUSES,
  );
  assert.deepEqual(
    values(byKey(triggers.get('account_problem').fields).get('reason')),
    ACCOUNT_PROBLEMS,
  );
  const command = byKey(byKey(manifest.scene_actions).get('send_command').fields).get('command');
  assert.deepEqual(values(command), SCENE_COMMANDS);
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  assert.ok(manifest.actions.length <= 10);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120);
    assert.ok((action.outputs ?? []).length <= 20, action.key);
  }
  // The scene action outlives the wait for the car, plus the reading after it.
  const sendCommand = byKey(manifest.scene_actions).get('send_command');
  assert.ok(sendCommand.timeout_seconds * 1000 >= COMMAND_TIMEOUT_MS + 15000);
  for (const widget of manifest.widgets) {
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('the image ships only what it runs, and /data is the only writable place', () => {
  const docker = source('../Dockerfile');
  assert.match(docker, /USER node/);
  assert.match(docker, /chown node:node \/data/);
  const ignore = source('../.dockerignore');
  for (const entry of ['test', 'docs', '.github']) {
    assert.match(ignore, new RegExp(`^${entry.replace('.', '\\.')}$`, 'm'), entry);
  }
  assert.match(source('../.gitignore'), /^\/data\/$/m);
  assert.match(source('../.gitignore'), /^\.github\/forum-\*\.md$/m);
});

test('catalog search terms of Gladys 5.3.0: keywords within bounds, countries', () => {
  assert.ok(Array.isArray(manifest.keywords));
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10);
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
  assert.equal(new Set(normalized).size, normalized.length, 'keywords must be unique');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'the name is already searched');
  // Usable worldwide: no `countries` restriction.
  assert.equal(manifest.countries, undefined);
});
