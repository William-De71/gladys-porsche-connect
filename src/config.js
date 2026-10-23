// -----------------------------------------------------------------------------
// Configuration of the Porsche Connect integration.
//
// Fields of the config_schema:
//   - `email` / `password`  the My Porsche account (password: `secret`);
//   - `pin`                 the 4-digit PIN of the My Porsche app (unlock only);
//   - `poll_interval`       minutes between two readings of the cars;
//   - `climate_temperature` the temperature asked when the climate starts;
//   - `home_radius`         meters under which a car is home;
//   - `language`            language of the texts written outside a widget
//                           request (device names, text states, scene
//                           texts): `auto` = the language of the last widget
//                           request. Gladys does not send it with a command
//                           or a scene action.
//
// Internal key, outside the config_schema: `last_language`.
// The tokens are kept in /data/session.json (src/porsche/auth.js).
// -----------------------------------------------------------------------------

import { CLIMATE_TEMPERATURES } from './commands.js';

const POLL_INTERVALS = ['10', '15', '30', '60'];
const DEFAULT_POLL_INTERVAL = '15';
const HOME_RADIUS = { min: 50, max: 5000, default: 200 };
const LANGUAGES = ['en', 'fr', 'de', 'es'];
const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };

const readString = (raw) => (typeof raw === 'string' ? raw.trim() : '');

/**
 * @description Read a bounded number field, falling back to its default.
 * @param {unknown} raw - The raw value.
 * @param {{ min: number, max: number, default: number }} bounds - The bounds.
 * @returns {number} The value.
 * @example
 * readNumber('300', HOME_RADIUS); // -> 300
 */
function readNumber(raw, bounds) {
  const value = Number(raw ?? bounds.default);
  if (raw === '' || raw === null || !Number.isFinite(value)) {
    return bounds.default;
  }
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(value)));
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [raw] - The raw values.
 * @returns {object} The config.
 * @example
 * normalizeConfig({ email: 'me@example.com', password: 'x' }).pollMinutes; // -> 15
 */
function normalizeConfig(raw = {}) {
  const config = raw ?? {};
  const interval = POLL_INTERVALS.includes(String(config.poll_interval))
    ? String(config.poll_interval)
    : DEFAULT_POLL_INTERVAL;
  return {
    email: readString(config.email),
    password: typeof config.password === 'string' ? config.password : '',
    pin: readString(config.pin),
    pollMinutes: Number(interval),
    climateTemperature: readNumber(config.climate_temperature, CLIMATE_TEMPERATURES),
    homeRadius: readNumber(config.home_radius, HOME_RADIUS),
    language: LANGUAGES.includes(config.language) ? config.language : AUTO_LANGUAGE,
  };
}

/**
 * @description Whether the account is filled in.
 * @param {object} config - The normalized config.
 * @returns {boolean} True with an e-mail and a password.
 */
function hasAccount(config) {
  return Boolean(config.email && config.password);
}

/**
 * @description Whether the PIN can unlock (4 digits).
 * @param {object} config - The normalized config.
 * @returns {boolean} True when it can.
 */
function hasPin(config) {
  return /^\d{4}$/.test(config.pin);
}

/**
 * @description Read the stored language of the last widget request.
 * @param {object} [raw] - The raw config values.
 * @param {string} fallback - The language to keep otherwise.
 * @returns {string} The language.
 */
function readLanguage(raw, fallback) {
  const language = (raw ?? {})[INTERNAL_KEYS.language];
  return typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : fallback;
}

export {
  POLL_INTERVALS,
  DEFAULT_POLL_INTERVAL,
  HOME_RADIUS,
  LANGUAGES,
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  normalizeConfig,
  hasAccount,
  hasPin,
  readLanguage,
};
