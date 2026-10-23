// -----------------------------------------------------------------------------
// Scene actions.
//
//   - `send_command`  lock, unlock, climate, flash the lights, horn and
//                     lights, direct charge; waits for the car to run it (up
//                     to two minutes: a car asleep is slow to wake up) and
//                     says whether it did;
//   - `get_status`    what a scene may want to say or test: lock, openings,
//                     battery or fuel, range, charge, position, tires, with a
//                     sentence ready for a message. From the last reading
//                     (no request is sent).
// -----------------------------------------------------------------------------

import { t, openingsLabel } from './i18n.js';
import { mapUrl } from './geo.js';

const SCENE_ACTIONS = { SEND_COMMAND: 'send_command', GET_STATUS: 'get_status' };

const round1 = (value) =>
  value === null || value === undefined ? null : Math.round(value * 10) / 10;

/**
 * @description The outputs of `get_status`.
 * @param {object} options - Options.
 * @param {object} options.reading - The reading `{ snapshot, atHome, distanceHomeKm }`.
 * @param {string} options.carName - The car name.
 * @param {string} options.language - The language.
 * @returns {object} The outputs.
 * @example
 * buildStatusOutputs({ reading, carName: 'Porsche Taycan 4S', language: 'fr' });
 */
function buildStatusOutputs({ reading, carName, language }) {
  const { snapshot } = reading;
  const openings = openingsLabel(snapshot.openList, language);
  const known = Object.values(snapshot.openings).some((state) => state !== null);
  let energy = '';
  if (snapshot.battery.level !== null) {
    energy = t('summaryBattery', language, {
      level: Math.round(snapshot.battery.level),
      range: snapshot.battery.rangeKm ?? snapshot.rangeKm ?? '?',
    });
  } else if (snapshot.fuel.level !== null) {
    energy = t('summaryFuel', language, {
      level: Math.round(snapshot.fuel.level),
      range: snapshot.rangeKm ?? '?',
    });
  }
  let openingsText = '?';
  if (known) {
    openingsText =
      snapshot.openList.length === 0
        ? t('allClosed', language).toLowerCase()
        : t('open', language, { list: openings }).toLowerCase();
  }
  const tiresKnown = Object.values(snapshot.tires).some((value) => value !== null);
  return {
    vehicle_name: carName,
    locked: snapshot.lock === null ? null : snapshot.lock === 'locked',
    all_closed: known ? snapshot.openList.length === 0 : null,
    openings,
    battery_level: snapshot.battery.level,
    battery_range_km: snapshot.battery.rangeKm,
    fuel_level: snapshot.fuel.level,
    range_km: snapshot.rangeKm ?? snapshot.battery.rangeKm,
    charging_status: snapshot.charge.status,
    plugged: snapshot.charge.plugged,
    charge_target: snapshot.charge.targetLevel,
    climate_on: snapshot.climate,
    odometer_km: snapshot.odometerKm,
    tires_ok: tiresKnown ? snapshot.lowTires.length === 0 : null,
    at_home: reading.atHome ?? null,
    distance_home_km: round1(reading.distanceHomeKm),
    map_url: snapshot.location ? mapUrl(snapshot.location) : null,
    summary: t('summaryStatus', language, {
      car: carName,
      lock: snapshot.lock ? t(snapshot.lock, language).toLowerCase() : '?',
      openings: openingsText,
      energy,
    }).trim(),
  };
}

export { SCENE_ACTIONS, buildStatusOutputs };
