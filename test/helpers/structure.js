// The structure Gladys users depend on, recorded once in
// test/fixtures/discovery.baseline.json (v0.1.0) and compared by
// test/structure.test.js: device and feature external ids, and per feature
// the fields the "Update" button of the Discovery screen compares; the keys
// of the manifest stored in dashboards and scenes.

import { readFileSync } from 'node:fs';
import { buildDevice } from '../../src/device.js';
import { describe, summarize } from '../../src/vehicle.js';
import {
  VEHICLES,
  VIN_BEV,
  VIN_PETROL,
  BEV_MEASUREMENTS,
  BEV_COMMANDS,
  PETROL_MEASUREMENTS,
  PETROL_COMMANDS,
  overviewOf,
  fakeGladys,
} from './fixtures.js';

const ETERNAL_FEATURE_FIELDS = ['external_id', 'category', 'type', 'unit', 'min', 'max', 'step'];

const pick = (object, keys) =>
  Object.fromEntries(
    keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]),
  );

/**
 * @description The discovery structure of the two synthetic cars.
 * @returns {object} The structure, per car.
 */
export function discoveryStructure() {
  const cars = {
    taycan: [VEHICLES[0], VIN_BEV, BEV_MEASUREMENTS, BEV_COMMANDS],
    carrera: [VEHICLES[1], VIN_PETROL, PETROL_MEASUREMENTS, PETROL_COMMANDS],
  };
  return Object.fromEntries(
    Object.entries(cars).map(([name, [entry, vin, measurements, commands]]) => {
      const info = describe(entry, overviewOf(vin, [], commands));
      const snapshot = summarize(overviewOf(vin, measurements), info);
      const device = buildDevice(fakeGladys, info, snapshot, {
        language: 'en',
        distanceHomeKm: 1.5,
      });
      return [
        name,
        {
          ...pick(device, ['external_id', 'should_poll', 'poll_frequency']),
          features: device.features.map((feature) => pick(feature, ETERNAL_FEATURE_FIELDS)),
        },
      ];
    }),
  );
}

const keysOf = (list) => (list ?? []).map((item) => item.key);

/**
 * @description The keys of the manifest that users store.
 * @returns {object} The keys.
 */
export function manifestKeys() {
  const manifest = JSON.parse(
    readFileSync(new URL('../../gladys-assistant-integration.json', import.meta.url), 'utf8'),
  );
  const scene = (item) => ({
    key: item.key,
    fields: (item.fields ?? []).map((field) => ({
      key: field.key,
      options: (field.options ?? []).map((option) => option.value),
    })),
    variables: keysOf(item.variables),
    outputs: keysOf(item.outputs),
  });
  return {
    config_schema: keysOf(manifest.config_schema),
    actions: keysOf(manifest.actions),
    widgets: manifest.widgets.map((widget) => ({
      key: widget.key,
      settings: keysOf(widget.settings),
    })),
    scene_triggers: manifest.scene_triggers.map(scene),
    scene_actions: manifest.scene_actions.map(scene),
  };
}
