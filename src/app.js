// -----------------------------------------------------------------------------
// The Porsche Connect integration, wired to a Gladys client.
//
// `createApp(gladys)` registers every handler on the client it receives:
// `new GladysIntegration()` in production (index.js), the fake Gladys of the
// SDK in the tests. Nothing here connects: the caller does, once the handlers
// are registered.
//
// Flow: sign in (porsche/auth.js) -> list the cars with the commands they
// accept (porsche/api.js) -> read the stored overview of each car on a timer
// (`poll_interval`) -> each overview is read into a snapshot (vehicle.js),
// compared with the previous one for the scene triggers (events.js) and
// published as states (device.js). Porsche pushes nothing to a third party:
// the timer is the only source, and reading the stored overview never wakes
// the car up.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { logger } from '@gladysassistant/integration-sdk';
import {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  hasAccount,
  hasPin,
  normalizeConfig,
  readLanguage,
} from './config.js';
import { createAuth } from './porsche/auth.js';
import { createApi, measurementsOf } from './porsche/api.js';
import { captchaKey, captchaPng } from './porsche/captcha.js';
import { KINDS, PorscheError, redactVin } from './porsche/errors.js';
import { describe, summarize } from './vehicle.js';
import {
  FEATURE_KEYS,
  FEATURES,
  buildDevice,
  buildStates,
  idsOf,
  parseExternalId,
  vehicleName,
} from './device.js';
import { buildCommand, SCENE_COMMANDS } from './commands.js';
import {
  buildAccountProblemEvent,
  buildSceneEvent,
  detectEvents,
  SCENE_TRIGGERS,
} from './events.js';
import { SCENE_ACTIONS, buildStatusOutputs } from './scene-actions.js';
import {
  WIDGETS,
  WIDGET_ACTIONS,
  buildVehicleWidget,
  captchaContent,
  messageContent,
} from './widgets.js';
import { transportOf } from './transport.js';
import { isHome, nearestHouse } from './geo.js';
import { all, each, t } from './i18n.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const ACTIONS = {
  TEST_CONNECTION: 'test_connection',
  REFRESH: 'refresh',
  DIAGNOSTIC: 'diagnostic',
  SIGN_OUT: 'sign_out',
};
// An unchanged state is published again every hour, so the dashboard never
// shows it as outdated while the car sleeps in the garage.
const HEARTBEAT_MS = 60 * 60 * 1000;
const HOUSES_MAX_AGE_MS = 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
// While Porsche limits the requests (429), the readings slow down: 30 min,
// doubled up to 4 h.
const BLOCKED_BASE_MS = 30 * 60 * 1000;
const BLOCKED_MAX_MS = 4 * 60 * 60 * 1000;
// The commands the cars accept are read again once a day.
const CAPABILITIES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// After a command, the car reports its new state with a delay: read it again
// a little later, and keep the triggers of that change quiet for a while.
const AFTER_COMMAND_MS = 5000;
const QUIET_MS = 10 * 60 * 1000;
const QUIET_TRIGGERS = {
  lock: [SCENE_TRIGGERS.LOCK_CHANGED, SCENE_TRIGGERS.LEFT_OPEN],
  unlock: [SCENE_TRIGGERS.LOCK_CHANGED, SCENE_TRIGGERS.LEFT_OPEN],
  direct_charge_start: [SCENE_TRIGGERS.CHARGING_CHANGED],
  direct_charge_stop: [SCENE_TRIGGERS.CHARGING_CHANGED],
};
const DIAGNOSTIC_CHUNK = 3000;
// Never written to the logs by the diagnostic.
const PRIVATE_MEASUREMENTS = ['GPS_LOCATION'];
const PROBLEMS = {
  [KINDS.AUTH]: 'auth',
  [KINDS.CAPTCHA]: 'captcha',
  [KINDS.LOCKED]: 'locked',
  [KINDS.BLOCKED]: 'blocked',
};

/**
 * @description The anonymized diagnostic of a car: model, commands and the
 * measurements it reports, without VIN nor position.
 * @param {object} car - `{ info, data }`.
 * @returns {object} The diagnostic.
 */
function diagnosticOf(car) {
  const measurements = {};
  for (const [key, value] of car.data ?? []) {
    measurements[key] = PRIVATE_MEASUREMENTS.includes(key) ? '(hidden)' : value;
  }
  const commands =
    car.info.commands === null
      ? 'unknown'
      : Object.fromEntries(
          [...car.info.commands].map(([key, command]) => [
            key,
            command.enabled ? 'enabled' : `disabled (${command.cause ?? '?'})`,
          ]),
        );
  return {
    model: car.info.modelName,
    year: car.info.year,
    engine: car.info.engine,
    commands,
    measurements,
  };
}

/**
 * @description Register the handlers of the integration on a Gladys client.
 * @param {object} gladys - The GladysIntegration instance (or the fake one).
 * @param {object} [options] - Options, for the tests.
 * @param {Function} [options.fetchImpl] - fetch.
 * @param {string} [options.dataDir] - Where the session is stored.
 * @param {Function} [options.sleep] - Wait (sign-in, command progress).
 * @returns {object} What the tests look into.
 */
export function createApp(gladys, { fetchImpl = fetch, dataDir = '/data', sleep } = {}) {
  let config = normalizeConfig();
  let lastLanguage = 'en';
  let createdDevices = new Set();
  let createdFeatures = new Set();
  let houses = [];
  let housesReadAt = 0;
  let lastStatus = null;
  let lastProblem = null;
  let timer = null;
  let blockedDelay = BLOCKED_BASE_MS;
  let starting = Promise.resolve();
  let reading = null;
  let client = null;
  let capabilitiesReadAt = 0;
  let accountState = 'stopped';
  // vin -> { info, data, reading, quiet: { keys, until } }
  const cars = new Map();
  // vin -> signature of the published feature list
  const offered = new Map();
  const transports = new Map();

  const textLanguage = () => (config.language === AUTO_LANGUAGE ? lastLanguage : config.language);
  const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  /**
   * @description Remember the language of a widget request.
   * @param {string} next - The language.
   */
  function rememberLanguage(next) {
    if (typeof next !== 'string' || !/^[a-z]{2}$/.test(next) || next === lastLanguage) {
      return;
    }
    lastLanguage = next;
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: next })
      .catch((err) => logger.warn(`Unable to store the language: ${err.message}`));
  }

  /**
   * @description Report the connection status, only when it changed.
   * @param {boolean} connected - Connected or not.
   * @param {object} message - The multi-language message.
   * @returns {Promise<void>}
   */
  async function reportStatus(connected, message) {
    const signature = JSON.stringify([connected, message]);
    if (signature === lastStatus) {
      return;
    }
    lastStatus = signature;
    try {
      await gladys.setConnectionStatus(connected, message);
    } catch (err) {
      lastStatus = null;
      logger.error('Unable to report the connection status', err);
    }
  }

  /**
   * @description Publish the transport badge of every created car, when it changed.
   * @returns {Promise<void>}
   */
  async function publishTransports() {
    const entries = [];
    for (const { info } of cars.values()) {
      const externalId = idsOf(gladys, info.vin).device;
      if (!createdDevices.has(externalId)) {
        continue;
      }
      const entry = transportOf(externalId, accountState);
      const signature = JSON.stringify(entry);
      if (transports.get(externalId) !== signature) {
        transports.set(externalId, signature);
        entries.push(entry);
      }
    }
    if (entries.length > 0) {
      await gladys.publishTransports(entries).catch((err) => {
        entries.forEach((entry) => transports.delete(entry.external_id));
        logger.warn(`Unable to publish the transports: ${err.message}`);
      });
    }
  }

  /**
   * @description Move to an account state; report a problem the user must
   * know about once (status and scene trigger).
   * @param {string} state - connected, blocked, auth, captcha, locked, error.
   * @param {Error} [err] - The error.
   * @returns {Promise<void>}
   */
  async function setState(state, err = null) {
    const before = accountState;
    accountState = state;
    if (state === 'connected') {
      lastProblem = null;
      await reportStatus(true, all('statusConnected', { count: cars.size }));
    } else {
      const reason = PROBLEMS[err?.kind] ?? null;
      await reportStatus(false, reason ? all(`problem_${reason}`) : all('statusUnreachable'));
      if (reason && reason !== lastProblem) {
        lastProblem = reason;
        const { key, data } = buildAccountProblemEvent(reason, textLanguage());
        await gladys
          .publishSceneEvent(key, data)
          .catch((e) => logger.warn(`Unable to publish the scene event ${key}: ${e.message}`));
      }
    }
    if (before !== state) {
      await publishTransports();
      gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    }
  }

  /**
   * @description Refresh the houses of Gladys (the home of the cars).
   * @param {boolean} [force] - Even if read recently.
   * @returns {Promise<void>}
   */
  async function refreshHouses(force = false) {
    if (!force && Date.now() - housesReadAt < HOUSES_MAX_AGE_MS) {
      return;
    }
    try {
      houses = await gladys.getHouses();
      housesReadAt = Date.now();
    } catch (err) {
      logger.warn(`Unable to read the houses: ${err.message}`);
    }
  }

  /**
   * @description Refresh the external ids of the devices the user created.
   * @returns {Promise<void>}
   */
  async function refreshCreatedDevices() {
    try {
      const devices = await gladys.getDevices();
      createdDevices = new Set(devices.map((device) => device.external_id));
      createdFeatures = new Set(
        devices.flatMap((device) => (device.features ?? []).map((feature) => feature.external_id)),
      );
    } catch (err) {
      logger.warn(`Unable to read the devices: ${err.message}`);
    }
  }

  const contextOf = (carReading) => ({
    language: textLanguage(),
    distanceHomeKm: carReading?.distanceHomeKm ?? null,
  });

  /**
   * @description Publish the states of a car that changed (or are an hour old).
   * @param {object} car - `{ info, reading }`.
   * @param {boolean} [force] - Every state, even unchanged.
   * @returns {Promise<boolean>} True when something was published.
   */
  async function publishStates(car, force = false) {
    if (!car.reading) {
      return false;
    }
    const states = buildStates(
      gladys,
      car.info,
      car.reading.snapshot,
      contextOf(car.reading),
      createdFeatures,
    );
    if (force) {
      gladys.forgetPublishedStates(idsOf(gladys, car.info.vin).device);
    }
    const { count } = await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
    return count > 0;
  }

  /**
   * @description The device of a car.
   * @param {object} car - `{ info, reading }`.
   * @returns {object} The discovered device.
   */
  function deviceOf(car) {
    return buildDevice(
      gladys,
      car.info,
      car.reading?.snapshot ?? summarize(null, car.info),
      contextOf(car.reading),
    );
  }

  /**
   * @description Offer a device per car on the Discovery screen.
   * @returns {Promise<number>} How many devices were offered.
   */
  async function publishDiscoveredDevices() {
    const devices = [...cars.values()].map((car) => {
      const device = deviceOf(car);
      offered.set(car.info.vin, device.features.map((feature) => feature.external_id).join(','));
      return device;
    });
    await gladys.publishDiscoveredDevices(devices);
    return devices.length;
  }

  /**
   * @description Read an overview into the car: snapshot, events, states.
   * @param {object} car - The car.
   * @param {object} overview - Its stored overview.
   * @returns {Promise<void>}
   */
  async function onOverview(car, overview) {
    car.data = measurementsOf(overview);
    const snapshot = summarize(car.data, car.info);
    const nearest = nearestHouse(snapshot.location, houses);
    const distanceHomeKm = nearest ? nearest.distanceKm : null;
    const previous = car.reading;
    const next = {
      snapshot,
      distanceHomeKm,
      atHome: isHome(distanceHomeKm, config.homeRadius, previous?.atHome ?? null),
      readAt: Date.now(),
    };
    car.reading = next;

    const carName = vehicleName(car.info, textLanguage());
    const vehicle = idsOf(gladys, car.info.vin).device;
    const quiet = car.quiet && car.quiet.until > Date.now() ? car.quiet.keys : [];
    const events = detectEvents(previous, next).filter((event) => !quiet.includes(event.key));
    for (const event of events) {
      const { key, data } = buildSceneEvent(event, {
        vehicle,
        carName,
        reading: next,
        language: textLanguage(),
      });
      logger.info(`${carName}: ${key} (${data.summary})`);
      await gladys
        .publishSceneEvent(key, data)
        .catch((err) => logger.warn(`Unable to publish the scene event ${key}: ${err.message}`));
    }
    let changed = false;
    try {
      changed = await publishStates(car);
    } catch (err) {
      logger.warn(`Unable to publish the states of ${carName}: ${err.message}`);
    }
    // A new feature (first data of the car, a first charge…): offer it.
    const signature = deviceOf(car)
      .features.map((feature) => feature.external_id)
      .join(',');
    if (offered.get(car.info.vin) !== signature) {
      await publishDiscoveredDevices().catch((err) =>
        logger.warn(`Unable to publish the devices: ${err.message}`),
      );
    }
    if (changed || events.length > 0) {
      gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    }
  }

  /**
   * @description Build the Porsche client for the current account.
   * @returns {object} The client.
   */
  function buildClient() {
    const auth = createAuth({
      fetchImpl,
      getCredentials: () => ({ email: config.email, password: config.password }),
      dataDir,
      logger,
      ...(sleep ? { sleep } : {}),
    });
    const api = createApi({ fetchImpl, auth, ...(sleep ? { sleep } : {}) });
    return { auth, api, signature: config.email.toLowerCase() };
  }

  /**
   * @description List the cars of the account, with the commands they
   * accept, and read them (the capabilities come with an overview).
   * @returns {Promise<void>}
   */
  async function discover() {
    const list = await client.api.vehicles();
    const seen = new Set();
    for (const entry of list) {
      const vin = String(entry?.vin ?? '').toUpperCase();
      if (!vin || seen.has(vin)) {
        continue;
      }
      seen.add(vin);
      let overview = null;
      try {
        overview = await client.api.overview(vin, { commands: true });
      } catch (err) {
        if ([KINDS.AUTH, KINDS.CAPTCHA, KINDS.LOCKED, KINDS.BLOCKED].includes(err.kind)) {
          throw err;
        }
        logger.warn(`Overview of …${vin.slice(-4)} unavailable: ${err.message}`);
      }
      const existing = cars.get(vin);
      const car = {
        info: describe(
          { ...entry, ...(overview?.customName ? { customName: overview.customName } : {}) },
          overview,
        ),
        data: existing?.data ?? null,
        reading: existing?.reading ?? null,
        quiet: existing?.quiet ?? null,
      };
      cars.set(vin, car);
      if (overview) {
        await onOverview(car, overview);
      }
    }
    for (const vin of [...cars.keys()]) {
      if (!seen.has(vin)) {
        cars.delete(vin);
      }
    }
    capabilitiesReadAt = Date.now();
  }

  /**
   * @description Read every car once.
   * @returns {Promise<void>}
   */
  async function readAll() {
    await refreshHouses();
    if (Date.now() - capabilitiesReadAt > CAPABILITIES_MAX_AGE_MS) {
      await discover();
      return;
    }
    for (const car of cars.values()) {
      try {
        await onOverview(car, await client.api.overview(car.info.vin));
      } catch (err) {
        if ([KINDS.AUTH, KINDS.CAPTCHA, KINDS.LOCKED, KINDS.BLOCKED].includes(err.kind)) {
          throw err;
        }
        logger.warn(`Reading of …${car.info.vin.slice(-4)} failed: ${redactVin(err.message)}`);
      }
    }
  }

  /**
   * @description Plan the next round.
   * @param {number} delay - In ms.
   */
  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      round().catch((err) => logger.error(`Round failed: ${redactVin(err.message)}`));
    }, delay);
    timer.unref?.();
  }

  /**
   * @description Handle an error of the account, and plan what comes next:
   * a refused password, a captcha or a locked account wait for the user;
   * Porsche limiting the requests slows the readings down; anything else is
   * tried again in 5 minutes.
   * @param {Error} err - The error.
   * @returns {Promise<void>}
   */
  async function onError(err) {
    const reason = PROBLEMS[err?.kind];
    logger.warn(`Porsche Connect: ${redactVin(err?.message ?? err)}`);
    await setState(reason ?? 'error', err);
    if (err?.kind === KINDS.BLOCKED) {
      schedule(blockedDelay);
      blockedDelay = Math.min(BLOCKED_MAX_MS, blockedDelay * 2);
    } else if (!reason) {
      schedule(RETRY_MS);
    } else {
      clearTimeout(timer);
      timer = null;
    }
  }

  /**
   * @description One round: sign in if needed, list the cars the first
   * time, read them, plan the next round.
   * @returns {Promise<void>}
   */
  async function round() {
    if (reading) {
      return reading;
    }
    reading = (async () => {
      try {
        if (cars.size === 0) {
          await client.auth.accessToken();
          await discover();
          logger.info(
            `${cars.size} car(s): ${[...cars.values()].map(({ info }) => `${info.modelName ?? '?'} ${info.engine ?? ''} (…${info.vin.slice(-4)})`).join(', ') || 'none'}`,
          );
          await publishDiscoveredDevices();
        } else {
          await readAll();
        }
        blockedDelay = BLOCKED_BASE_MS;
        await setState('connected');
        schedule(config.pollMinutes * 60 * 1000);
      } catch (err) {
        await onError(err);
      }
    })().finally(() => {
      reading = null;
    });
    return reading;
  }

  // --- Start ------------------------------------------------------------------------

  /**
   * @description Sign in, list the cars, offer them and start the timer.
   * @returns {Promise<void>}
   */
  async function start() {
    clearTimeout(timer);
    timer = null;
    if (!hasAccount(config)) {
      client = null;
      cars.clear();
      accountState = 'stopped';
      await reportStatus(false, all('statusNoAccount'));
      return;
    }
    if (!client || client.signature !== config.email.toLowerCase()) {
      client = buildClient();
      cars.clear();
    }
    await round();
  }

  /**
   * @description Start, one at a time.
   * @returns {Promise<void>}
   */
  function startIfReady() {
    starting = starting.catch(() => {}).then(start);
    return starting;
  }

  // --- Commands ---------------------------------------------------------------------

  /**
   * @description Send a command and wait for the car to run it, then read
   * the car again.
   * @param {object} car - The car.
   * @param {string} command - A commands.js key.
   * @param {object} [options] - `{ level }` for the charge target.
   * @returns {Promise<{ ok: boolean, status: string }>} The outcome.
   * @throws {Error} With `code` pin_required / unsupported / no_profile, or a PorscheError.
   */
  async function runCommand(car, command, options = {}) {
    if (!client) {
      throw new PorscheError('Not signed in', { kind: KINDS.AUTH });
    }
    const settings = {
      pin: config.pin,
      temperature: config.climateTemperature,
      data: car.data ?? new Map(),
      ...options,
    };
    // Checked before asking a challenge: the PIN and the support.
    buildCommand(car.info, command, { ...settings, challenge: command === 'unlock' ? '00' : null });
    if (command === 'unlock') {
      settings.challenge = await client.api.spinChallenge(car.info.vin);
    }
    const request = buildCommand(car.info, command, settings);
    if (QUIET_TRIGGERS[command]) {
      car.quiet = { keys: QUIET_TRIGGERS[command], until: Date.now() + QUIET_MS };
    }
    const result = await client.api.command(car.info.vin, request);
    const name = vehicleName(car.info, 'en');
    if (result.ok) {
      logger.info(`${name}: ${command} done`);
    } else {
      logger.warn(`${name}: ${command} not carried out (${result.status})`);
    }
    await wait(AFTER_COMMAND_MS);
    try {
      await onOverview(car, await client.api.overview(car.info.vin));
    } catch (err) {
      logger.warn(`Reading after ${command} failed: ${redactVin(err.message)}`);
    }
    return result;
  }

  /**
   * @description Run a command in the background: the car answers far beyond
   * the few seconds a device command or a widget button may take.
   * @param {object} car - The car.
   * @param {string} command - The command.
   * @param {object} [options] - Options.
   */
  function runInBackground(car, command, options) {
    runCommand(car, command, options)
      .then(() => gladys.requestWidgetRefresh(WIDGETS.VEHICLE))
      .catch((err) => logger.error(`${command} failed: ${redactVin(err.message)}`));
  }

  /**
   * @description The car a device external id points at; empty = the first car.
   * @param {unknown} deviceExternalId - The `source: "devices"` value.
   * @returns {object|null} The car.
   */
  function resolveCar(deviceExternalId) {
    const parsed = parseExternalId(deviceExternalId);
    if (parsed) {
      return cars.get(parsed.vin) ?? null;
    }
    return cars.values().next().value ?? null;
  }

  const commandError = (err, command, language) => {
    if (err?.code === 'pin_required') {
      return t('commandPinRequired', language);
    }
    if (err?.code === 'unsupported') {
      return t('commandUnsupported', language, { command: t(`command_${command}`, language) });
    }
    if (err?.code === 'no_profile') {
      return t('commandNoProfile', language);
    }
    return null;
  };

  /**
   * @description Check a command before answering the user: it throws the
   * reason it cannot run.
   * @param {object} car - The car.
   * @param {string} command - The command.
   * @param {object} [options] - Options.
   */
  function precheck(car, command, options = {}) {
    buildCommand(car.info, command, {
      pin: config.pin,
      temperature: config.climateTemperature,
      data: car.data ?? new Map(),
      challenge: '00',
      ...options,
    });
  }

  gladys.onSetValue(async (device, feature, value) => {
    const parsed = parseExternalId(feature.external_id);
    const car = parsed ? cars.get(parsed.vin) : null;
    if (!car) {
      throw new Error('Unknown car: scan again');
    }
    let command;
    const options = {};
    if (parsed.feature === FEATURE_KEYS.LOCK) {
      command = Number(value) === 1 ? 'lock' : 'unlock';
    } else if (parsed.feature === FEATURE_KEYS.CLIMATE) {
      command = Number(value) === 1 ? 'climate_start' : 'climate_stop';
    } else if (parsed.feature === FEATURE_KEYS.CHARGE_TARGET) {
      command = 'charge_target';
      options.level = Number(value);
    } else {
      throw new Error(`${parsed.feature} is read-only`);
    }
    try {
      precheck(car, command, options);
    } catch (err) {
      throw new Error(commandError(err, command, 'en') ?? err.message, { cause: err });
    }
    runInBackground(car, command, options);
  });

  // --- Dashboard widget -------------------------------------------------------------
  gladys.onWidgetGet(WIDGETS.VEHICLE, async ({ settings = {}, language: lang }) => {
    rememberLanguage(lang);
    if (!hasAccount(config)) {
      return messageContent(t('notReady', lang));
    }
    const captcha = client?.auth.captcha();
    if (captcha) {
      return captchaContent(captcha, lang);
    }
    // Problems the user must solve outside the dashboard.
    if (['auth', 'locked'].includes(accountState)) {
      return messageContent(t(`problem_${accountState}`, lang));
    }
    if (cars.size === 0) {
      return messageContent(
        t(client && accountState === 'connected' ? 'noVehicle' : 'loading', lang),
        60,
      );
    }
    const car = resolveCar(settings.vehicle);
    if (!car) {
      return messageContent(t('noVehicle', lang));
    }
    return buildVehicleWidget({
      info: car.info,
      reading: car.reading,
      settings,
      canUnlock: hasPin(config),
      language: lang,
      now: Date.now(),
    });
  });

  gladys.onWidgetGetImage(async (imageKey) => {
    const captcha = client?.auth.captcha();
    if (!captcha || imageKey !== captchaKey(captcha)) {
      throw new Error(`Unknown image ${imageKey}`);
    }
    return captchaPng(captcha);
  });

  gladys.onWidgetAction(WIDGETS.VEHICLE, async (actionKey, params, { values } = {}) => {
    if (actionKey === WIDGET_ACTIONS.CAPTCHA) {
      if (!client) {
        throw new Error('Not configured');
      }
      try {
        await client.auth.solveCaptcha(values?.code);
      } catch (err) {
        if (err.kind === KINDS.CAPTCHA) {
          gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
          return all('captchaWrong');
        }
        await onError(err);
        throw new Error(redactVin(err.message), { cause: err });
      }
      lastProblem = null;
      round().catch(() => {});
      return all('captchaDone');
    }
    const car = typeof params?.vin === 'string' ? cars.get(params.vin) : null;
    if (!SCENE_COMMANDS.includes(actionKey) || !car) {
      throw new Error(`Unknown action ${actionKey}`);
    }
    try {
      precheck(car, actionKey);
    } catch (err) {
      return each((lang) => commandError(err, actionKey, lang) ?? err.message);
    }
    runInBackground(car, actionKey);
    return each((lang) => t('commandSent', lang, { command: t(`command_${actionKey}`, lang) }));
  });

  // --- Scene actions ----------------------------------------------------------------
  gladys.onSceneAction(SCENE_ACTIONS.SEND_COMMAND, async (fields) => {
    const car = resolveCar(fields.vehicle);
    if (!car) {
      throw new Error('No Porsche car: check the integration settings');
    }
    const command = String(fields.command ?? '');
    if (!SCENE_COMMANDS.includes(command)) {
      throw new Error(`Unknown command ${command}`);
    }
    const language = textLanguage();
    const label = t(`command_${command}`, language);
    let result;
    try {
      result = await runCommand(car, command);
    } catch (err) {
      const message = commandError(err, command, language);
      if (!message) {
        throw new Error(redactVin(err.message), { cause: err });
      }
      return { success: false, status: err.code, summary: message };
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
    return {
      success: result.ok,
      status: result.status,
      summary: result.ok
        ? t('commandDone', language, { command: label })
        : t('commandFailed', language, { command: label, status: result.status }),
    };
  });

  gladys.onSceneAction(SCENE_ACTIONS.GET_STATUS, async (fields) => {
    const car = resolveCar(fields.vehicle);
    if (!car?.reading) {
      throw new Error('No data from this car yet');
    }
    return buildStatusOutputs({
      reading: car.reading,
      carName: vehicleName(car.info, textLanguage()),
      language: textLanguage(),
    });
  });

  // --- Configuration screen actions ---------------------------------------------------
  gladys.onAction(ACTIONS.TEST_CONNECTION, async () => {
    if (!hasAccount(config)) {
      return all('statusNoAccount');
    }
    try {
      if (!client) {
        client = buildClient();
      }
      await client.auth.accessToken();
      await discover();
      await setState('connected');
      if (cars.size === 0) {
        return all('noVehicle');
      }
      return each((lang) => {
        const list = [...cars.values()]
          .map(({ info }) => {
            const count =
              info.commands === null
                ? '?'
                : [...info.commands.values()].filter((command) => command.enabled).length;
            return `${vehicleName(info, lang)} (${t('commandCount', lang, { count })})`;
          })
          .join(', ');
        return t('testConnected', lang, { list });
      });
    } catch (err) {
      logger.warn(`Connection test failed: ${redactVin(err.message)}`);
      await onError(err);
      const reason = PROBLEMS[err?.kind];
      return reason
        ? all(`problem_${reason}`)
        : each((lang) => `${t('statusUnreachable', lang)} (${redactVin(err.message)})`);
    }
  });

  gladys.onAction(ACTIONS.REFRESH, async () => {
    if (!client) {
      await startIfReady();
    } else {
      await round();
    }
    return all('readDone', { count: cars.size });
  });

  gladys.onAction(ACTIONS.DIAGNOSTIC, async () => {
    const list = [...cars.values()];
    logger.info(
      `Porsche Connect diagnostic: integration ${version}, state ${accountState}, session ${client?.auth.hasSession() ? 'yes' : 'no'}, captcha ${client?.auth.captcha() ? 'waiting' : 'no'}, poll ${config.pollMinutes} min`,
    );
    list.forEach((car, index) => {
      const json = JSON.stringify(diagnosticOf(car));
      const count = Math.max(1, Math.ceil(json.length / DIAGNOSTIC_CHUNK));
      for (let chunk = 0; chunk < count; chunk += 1) {
        logger.info(
          `Porsche Connect diagnostic ${index + 1}/${list.length}${count > 1 ? ` (${chunk + 1}/${count})` : ''}: ${json.slice(chunk * DIAGNOSTIC_CHUNK, (chunk + 1) * DIAGNOSTIC_CHUNK)}`,
        );
      }
    });
    return all('diagnosticDone', { count: list.length });
  });

  gladys.onAction(ACTIONS.SIGN_OUT, async () => {
    if (client) {
      await client.auth.clear();
    }
    lastProblem = null;
    lastStatus = null;
    await startIfReady();
    return all('signedOut');
  });

  // --- Devices ------------------------------------------------------------------------
  gladys.onScanRequest(async () => {
    if (!hasAccount(config)) {
      await gladys.publishDiscoveredDevices([]);
      return;
    }
    if (!client || cars.size === 0) {
      await startIfReady();
      return;
    }
    await discover();
    const count = await publishDiscoveredDevices();
    logger.info(`Scan: ${count} car(s) offered`);
  });

  // Gladys drops the states of a feature that does not exist yet: publish them
  // all once the car is created, and refresh the widget.
  gladys.onDeviceCreated(async (device) => {
    await refreshCreatedDevices();
    const parsed = parseExternalId(device.external_id);
    const car = parsed ? cars.get(parsed.vin) : null;
    if (car) {
      await publishStates(car, true).catch((err) =>
        logger.warn(`Unable to publish the states: ${err.message}`),
      );
      transports.delete(device.external_id);
      await publishTransports();
    }
    gladys.requestWidgetRefresh(WIDGETS.VEHICLE);
  });

  gladys.onDeviceDeleted(refreshCreatedDevices);

  // --- Configuration ------------------------------------------------------------------

  /**
   * @description Reload the whole config (internal keys included).
   * @param {object} [fallbackRaw] - Raw values to use when the read fails.
   * @returns {Promise<void>}
   */
  async function loadConfig(fallbackRaw) {
    try {
      const raw = await gladys.getConfig();
      config = normalizeConfig(raw);
      lastLanguage = readLanguage(raw, lastLanguage);
    } catch (err) {
      if (fallbackRaw) {
        config = normalizeConfig(fallbackRaw);
      }
      logger.error('Unable to read the configuration', err);
    }
  }

  gladys.onConfigUpdated(async (rawConfig) => {
    const before = JSON.stringify([config.email, config.password, config.pollMinutes]);
    await loadConfig(rawConfig);
    const after = JSON.stringify([config.email, config.password, config.pollMinutes]);
    logger.info(`Configuration updated: reading every ${config.pollMinutes} min`);
    // A new password is a new chance: forget the problem and sign in again.
    if (before !== after || accountState !== 'connected') {
      lastStatus = null;
      lastProblem = null;
      await startIfReady();
    }
  });

  // --- Connection lifecycle -----------------------------------------------------------
  gladys.on('connected', async () => {
    await loadConfig();
    await refreshHouses(true);
    await refreshCreatedDevices();
    lastStatus = null;
    await startIfReady();
  });

  // --- Graceful shutdown --------------------------------------------------------------
  gladys.handleShutdown((signal) => {
    logger.info(`Received ${signal} -> graceful shutdown`);
    clearTimeout(timer);
    timer = null;
  });

  return {
    cars,
    start: startIfReady,
    round,
    status: () => ({ accountState, client, timer }),
  };
}

export { ACTIONS, diagnosticOf, FEATURES, SCENE_TRIGGERS };
