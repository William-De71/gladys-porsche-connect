// -----------------------------------------------------------------------------
// A Porsche, read: its description and the snapshot of its last overview.
//
// The meanings come from pyporscheconnectapi (vehicle.py) and evcc. Every
// unknown value is null, never 0: a measurement the car does not send (a
// petrol 911 has no battery, a Taycan no fuel) or disabled by the privacy
// mode of the car stays unknown, and is never published.
//
//   - battery    BATTERY_LEVEL.percent, E_RANGE.kilometers (BEV, PHEV);
//   - fuel       FUEL_LEVEL.percent (COMBUSTION, PHEV);
//   - range      RANGE.kilometers, the total range;
//   - lock       LOCK_STATE_VEHICLE.isLocked;
//   - openings   OPEN_STATE_*.isOpen, grouped: doors, trunk (rear lid),
//                hood (front lid), windows, roof (sunroofs, convertible top);
//   - charge     CHARGING_SUMMARY (status, mode, target, end), CHARGING_RATE
//                (power in kW);
//   - climate    HVAC_SUMMARY.status (not OFF), else CLIMATIZER_STATE.isOn;
//   - tires      TIRE_PRESSURE_*.actualPressureBar and differenceBar;
//   - service    MAIN_SERVICE_TIME.days, MAIN_SERVICE_RANGE.kilometers;
//   - location   GPS_LOCATION.location, "lat,lon".
// -----------------------------------------------------------------------------

import { measurementsOf, commandsOf } from './porsche/api.js';

// A tire this far below its nominal pressure is low (as pyporscheconnectapi).
const TIRE_TOLERANCE_BAR = 0.3;
const OPENINGS = {
  doors: [
    'OPEN_STATE_DOOR_FRONT_LEFT',
    'OPEN_STATE_DOOR_FRONT_RIGHT',
    'OPEN_STATE_DOOR_REAR_LEFT',
    'OPEN_STATE_DOOR_REAR_RIGHT',
  ],
  trunk: ['OPEN_STATE_LID_REAR'],
  hood: ['OPEN_STATE_LID_FRONT'],
  windows: [
    'OPEN_STATE_WINDOW_FRONT_LEFT',
    'OPEN_STATE_WINDOW_FRONT_RIGHT',
    'OPEN_STATE_WINDOW_REAR_LEFT',
    'OPEN_STATE_WINDOW_REAR_RIGHT',
  ],
  roof: ['OPEN_STATE_SUNROOF', 'OPEN_STATE_SUNROOF_REAR', 'OPEN_STATE_TOP'],
};
const OPENING_NAMES = Object.keys(OPENINGS);
const TIRES = {
  frontLeft: 'TIRE_PRESSURE_FRONT_LEFT',
  frontRight: 'TIRE_PRESSURE_FRONT_RIGHT',
  rearLeft: 'TIRE_PRESSURE_REAR_LEFT',
  rearRight: 'TIRE_PRESSURE_REAR_RIGHT',
};
// The charging statuses Gladys names (the Home Assistant list); any other
// one is `other`.
const CHARGE_STATUSES = [
  'charging',
  'charging_completed',
  'charging_error',
  'charging_stopped',
  'initialising',
  'instant_charging',
  'not_charging',
  'not_plugged',
  'off',
];
const ACTIVE_STATUSES = ['charging', 'instant_charging', 'initialising'];
const ENGINES = ['BEV', 'PHEV', 'COMBUSTION'];

const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const bool = (value) => (typeof value === 'boolean' ? value : null);
const round = (value, digits = 0) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * @description The description of a car, from the list of the account and
 * its capabilities.
 * @param {object} entry - An entry of /connect/v1/vehicles.
 * @param {object|null} [capabilities] - An overview with `commands`.
 * @returns {object} `{ vin, model, modelName, year, engine, commands }`;
 * `commands` is null when unknown.
 * @example
 * describe({ vin: 'WP0ZZZY1ZNSA00123', modelName: 'Taycan 4S', modelType: { engine: 'BEV', year: '2022' } });
 */
function describe(entry, capabilities = null) {
  const engine = String(entry?.modelType?.engine ?? '').toUpperCase();
  const custom = typeof entry?.customName === 'string' ? entry.customName.trim() : '';
  const modelName = typeof entry?.modelName === 'string' ? entry.modelName.trim() : '';
  return {
    vin: String(entry?.vin ?? '').toUpperCase(),
    model: custom || modelName || null,
    modelName: modelName || null,
    year: entry?.modelType?.year ? String(entry.modelType.year) : null,
    engine: ENGINES.includes(engine) ? engine : null,
    commands: commandsOf(capabilities),
  };
}

/**
 * @description An opening group: open when one of its parts is, closed when
 * every known part is, unknown when none is known.
 * @param {Map} data - The measurements.
 * @param {string[]} keys - The measurement keys.
 * @returns {boolean|null} The state.
 */
function openingState(data, keys) {
  const states = keys.map((key) => bool(data.get(key)?.isOpen)).filter((state) => state !== null);
  if (states.length === 0) {
    return null;
  }
  return states.some(Boolean);
}

/**
 * @description The charge target of the car, wherever this car keeps it.
 * @param {Map} data - The measurements.
 * @returns {number|null} The target, in %.
 */
function chargeTarget(data) {
  const summary = data.get('CHARGING_SUMMARY') ?? {};
  const direct = String(summary.mode ?? '').toUpperCase() === 'DIRECT';
  const candidates = [
    summary.targetSoC,
    summary.minSoC,
    summary.chargingProfile?.minSoC,
    data.has('DEPARTURES') ? data.get('CHARGING_SETTINGS')?.targetSoc : null,
  ];
  const found = candidates.map(number).find((value) => value !== null);
  if (found !== undefined) {
    return found;
  }
  return direct ? 100 : null;
}

/**
 * @description The position of a car.
 * @param {object|undefined} gps - GPS_LOCATION.
 * @returns {{ latitude: number, longitude: number, heading: number|null }|null} The position.
 */
function locationOf(gps) {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(
    String(gps?.location ?? ''),
  );
  if (!match) {
    return null;
  }
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
    return null;
  }
  return { latitude, longitude, heading: number(gps.direction) };
}

/**
 * @description The ISO date of a Porsche time stamp, in ms.
 * @param {unknown} value - The time stamp.
 * @returns {number|null} The time.
 */
function timeOf(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/**
 * @description The snapshot of an overview (or of nothing: everything unknown).
 * @param {object|Map} [overview] - The overview, or its measurements.
 * @param {object} [info] - The car description (its engine).
 * @returns {object} The snapshot.
 * @example
 * summarize(overview, info).battery.level; // -> 80
 */
function summarize(overview = null, info = {}) {
  const data = overview instanceof Map ? overview : measurementsOf(overview);
  const engine = info?.engine ?? null;
  const summary = data.get('CHARGING_SUMMARY') ?? null;
  const rate = data.get('CHARGING_RATE') ?? null;

  const rawStatus = summary?.status ? String(summary.status).toLowerCase() : null;
  const status = rawStatus ? (CHARGE_STATUSES.includes(rawStatus) ? rawStatus : 'other') : null;
  const powerKw = number(rate?.chargingPower);
  let active = status ? ACTIVE_STATUSES.includes(status) : null;
  if (powerKw !== null && powerKw > 0) {
    active = true;
  }
  // No plug flag in the API: as evcc, any status but "not plugged" is plugged.
  let plugged = status && status !== 'other' ? status !== 'not_plugged' : null;
  if (active) {
    plugged = true;
  }

  const hvac = data.get('HVAC_SUMMARY');
  let climate = null;
  if (typeof hvac?.status === 'string') {
    climate = hvac.status.toUpperCase() !== 'OFF';
  } else if (data.has('CLIMATIZER_STATE')) {
    climate = bool(data.get('CLIMATIZER_STATE').isOn);
  }

  const openings = Object.fromEntries(
    OPENING_NAMES.map((name) => [name, openingState(data, OPENINGS[name])]),
  );
  const tires = {};
  const lowTires = [];
  for (const [position, key] of Object.entries(TIRES)) {
    const tire = data.get(key);
    tires[position] = round(number(tire?.actualPressureBar), 2);
    const difference = number(tire?.differenceBar);
    if (difference !== null && difference < -TIRE_TOLERANCE_BAR) {
      lowTires.push(position);
    }
  }
  const lock = bool(data.get('LOCK_STATE_VEHICLE')?.isLocked);
  const eRange = number(data.get('E_RANGE')?.kilometers);
  const range = number(data.get('RANGE')?.kilometers);
  const target = chargeTarget(data);

  return {
    engine,
    battery: {
      level: number(data.get('BATTERY_LEVEL')?.percent),
      rangeKm: eRange ?? (engine === 'BEV' ? range : null),
    },
    fuel: { level: number(data.get('FUEL_LEVEL')?.percent) },
    rangeKm: range,
    odometerKm: number(data.get('MILEAGE')?.kilometers),
    lock: lock === null ? null : lock ? 'locked' : 'unlocked',
    openings,
    openList: OPENING_NAMES.filter((name) => openings[name] === true),
    charge: {
      status,
      plugged,
      active,
      powerKw: powerKw === null ? null : round(powerKw, 1),
      targetLevel: target,
      mode: summary?.mode ? String(summary.mode).toUpperCase() : null,
      endTime: timeOf(summary?.targetDateTimeWithOffset ?? summary?.targetDateTime),
    },
    climate,
    tires,
    lowTires,
    service: {
      days: number(data.get('MAIN_SERVICE_TIME')?.days),
      distanceKm: number(data.get('MAIN_SERVICE_RANGE')?.kilometers),
    },
    parkingBrake: bool(data.get('PARKING_BRAKE')?.isOn),
    privacy: bool(data.get('GLOBAL_PRIVACY_MODE')?.isEnabled),
    remoteAccess: bool(data.get('REMOTE_ACCESS_AUTHORIZATION')?.isEnabled),
    location: locationOf(data.get('GPS_LOCATION')),
    locationAt: timeOf(data.get('GPS_LOCATION')?.lastModified),
  };
}

export {
  OPENINGS,
  OPENING_NAMES,
  CHARGE_STATUSES,
  TIRE_TOLERANCE_BAR,
  describe,
  summarize,
  locationOf,
};
