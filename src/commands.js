// -----------------------------------------------------------------------------
// Remote commands: what Gladys can ask the car, and the command the PPA
// backend carries (pyporscheconnectapi, remote_services.py).
//
// A command is offered when the car lists it as enabled in its
// capabilities; when they could not be read, it is tried and Porsche
// answers. Unlock needs the 4-digit PIN of the My Porsche app (setting
// `pin`): the backend sends a challenge, answered with
// SHA-512(PIN + challenge, as bytes). Opening the windows and the trunk,
// which the app also offers, are left out on purpose: from a home
// automation box, the risk outweighs the use.
// -----------------------------------------------------------------------------

import { createHash } from 'node:crypto';

const COMMANDS = {
  lock: { keys: ['LOCK'] },
  unlock: { keys: ['UNLOCK'], pin: true },
  climate_start: { keys: ['REMOTE_CLIMATIZER_START'] },
  climate_stop: { keys: ['REMOTE_CLIMATIZER_STOP'] },
  flash: { keys: ['HONK_FLASH'] },
  honk_flash: { keys: ['HONK_FLASH'] },
  direct_charge_start: { keys: ['DIRECT_CHARGING_START'] },
  direct_charge_stop: { keys: ['DIRECT_CHARGING_STOP'] },
  charge_target: { keys: ['CHARGING_SETTINGS_EDIT', 'CHARGING_PROFILES_EDIT'] },
};
const COMMAND_NAMES = Object.keys(COMMANDS);
// Scene action and widget commands (the charge target is a device feature).
const SCENE_COMMANDS = COMMAND_NAMES.filter((name) => name !== 'charge_target');
const CHARGE_TARGET = { min: 25, max: 100, step: 5 };
const CLIMATE_TEMPERATURES = { min: 16, max: 28, default: 21 };
const KELVIN = 273.15;

/**
 * @description Whether a car accepts one of the backend command keys.
 * @param {object} info - The car description (vehicle.js describe).
 * @param {string[]} keys - The keys.
 * @returns {boolean} True when enabled, or when the capabilities are unknown.
 */
function hasCommand(info, keys) {
  if (!info?.commands) {
    return true;
  }
  return keys.some((key) => info.commands.get(key)?.enabled === true);
}

/**
 * @description Whether a car accepts a command.
 * @param {object} info - The car description.
 * @param {string} command - A COMMANDS key.
 * @returns {boolean} True when it does.
 * @example
 * supports(info, 'lock');
 */
function supports(info, command) {
  const definition = COMMANDS[command];
  if (!definition) {
    return false;
  }
  if (['climate_start', 'climate_stop'].includes(command) && info?.commands) {
    return hasCommand(info, ['REMOTE_CLIMATIZER_START']);
  }
  if (command.startsWith('direct_charge') && info?.engine === 'COMBUSTION') {
    return false;
  }
  return hasCommand(info, definition.keys);
}

/**
 * @description The temperature range the car accepts for the climate, in °C.
 * @param {object} info - The car description.
 * @returns {{ min: number, max: number }} The range.
 */
function climateRange(info) {
  const metadata = info?.commands?.get('REMOTE_CLIMATIZER_START')?.metadata ?? {};
  const min = Number(metadata.minTemperature);
  const max = Number(metadata.maxTemperature);
  if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
    return { min: min - KELVIN, max: max - KELVIN };
  }
  return { min: CLIMATE_TEMPERATURES.min, max: CLIMATE_TEMPERATURES.max };
}

/**
 * @description The SPIN answer to an unlock challenge.
 * @param {string} pin - The 4-digit PIN.
 * @param {string} challenge - The challenge, hexadecimal.
 * @returns {string} The hash, upper-case hexadecimal.
 * @example
 * pinHash('1234', 'ABCD'); // -> SHA-512 of the bytes 12 34 AB CD
 */
function pinHash(pin, challenge) {
  return createHash('sha512')
    .update(Buffer.from(`${pin}${challenge}`, 'hex'))
    .digest('hex')
    .toUpperCase();
}

/**
 * @description The backend command of a Gladys command.
 * @param {object} info - The car description.
 * @param {string} command - A COMMANDS key.
 * @param {object} [options] - Options.
 * @param {string} [options.pin] - The PIN (unlock).
 * @param {string} [options.challenge] - The SPIN challenge (unlock).
 * @param {number} [options.level] - The charge target, in % (charge_target).
 * @param {number} [options.temperature] - The climate temperature, in °C.
 * @param {object} [options.data] - The measurements of the car (charge target).
 * @returns {{ key: string, payload: object }} The command.
 * @throws {Error} With `code` pin_required, unsupported or no_profile.
 * @example
 * buildCommand(info, 'lock'); // -> { key: 'LOCK', payload: { spin: null } }
 */
function buildCommand(info, command, options = {}) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!supports(info, command)) {
    throw fail('unsupported');
  }
  switch (command) {
    case 'lock':
      return { key: 'LOCK', payload: { spin: null } };
    case 'unlock': {
      const pin = String(options.pin ?? '').trim();
      if (!/^\d{4}$/.test(pin)) {
        throw fail('pin_required');
      }
      if (!options.challenge) {
        throw fail('challenge_required');
      }
      return {
        key: 'UNLOCK',
        payload: { spin: { challenge: options.challenge, hash: pinHash(pin, options.challenge) } },
      };
    }
    case 'climate_start': {
      const range = climateRange(info);
      const wanted = Number(options.temperature ?? CLIMATE_TEMPERATURES.default);
      const celsius = Math.min(range.max, Math.max(range.min, wanted));
      return {
        key: 'REMOTE_CLIMATIZER_START',
        payload: {
          spin: null,
          climateZonesEnabled: {
            frontLeft: false,
            frontRight: false,
            rearLeft: false,
            rearRight: false,
          },
          targetTemperature: Math.round((celsius + KELVIN) * 100) / 100,
        },
      };
    }
    case 'climate_stop':
      return { key: 'REMOTE_CLIMATIZER_STOP', payload: {} };
    case 'flash':
      return { key: 'HONK_FLASH', payload: { mode: 'FLASH', spin: null } };
    case 'honk_flash':
      return { key: 'HONK_FLASH', payload: { mode: 'HONK_AND_FLASH', spin: null } };
    case 'direct_charge_start':
      return { key: 'DIRECT_CHARGING_START', payload: { spin: null } };
    case 'direct_charge_stop':
      return { key: 'DIRECT_CHARGING_STOP', payload: { spin: null } };
    case 'charge_target': {
      const level = Math.min(
        CHARGE_TARGET.max,
        Math.max(
          CHARGE_TARGET.min,
          Math.round(Number(options.level) / CHARGE_TARGET.step) * CHARGE_TARGET.step,
        ),
      );
      const data = options.data ?? new Map();
      // Cars with departure timers keep the target in their charging
      // settings, the others in their active charging profile.
      if (data.has('DEPARTURES') || !data.has('CHARGING_PROFILES')) {
        return { key: 'CHARGING_SETTINGS_EDIT', payload: { targetSoc: level, spin: null } };
      }
      const list = structuredClone(data.get('CHARGING_PROFILES')?.list ?? []);
      const active = list.find((profile) => profile?.isEnabled === true);
      if (!active) {
        throw fail('no_profile');
      }
      active.minSoc = level;
      return { key: 'CHARGING_PROFILES_EDIT', payload: { list } };
    }
    default:
      throw fail('unsupported');
  }
}

export {
  COMMANDS,
  COMMAND_NAMES,
  SCENE_COMMANDS,
  CHARGE_TARGET,
  CLIMATE_TEMPERATURES,
  supports,
  climateRange,
  pinHash,
  buildCommand,
};
