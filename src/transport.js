// -----------------------------------------------------------------------------
// The transport badge of each car (Devices screen of Gladys).
//
// Everything goes through the Porsche cloud: the badge says `cloud` while
// the account is read, `unreachable` when Porsche refuses it (wrong
// password, captcha waiting, locked account, unreachable servers). While
// Porsche limits the requests (429), the last values stay: still `cloud`,
// flagged `degraded` with the reason.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { all } from './i18n.js';

/**
 * @description The transport entry of a car.
 * @param {string} externalId - The device external id.
 * @param {string} state - The account state: connected, blocked, auth,
 * captcha, locked, error, stopped.
 * @returns {object} The `publishTransports` entry.
 * @example
 * transportOf('ext:porsche-connect:vehicle:WP0…', 'connected');
 */
function transportOf(externalId, state) {
  if (state === 'blocked') {
    return {
      external_id: externalId,
      transport: DEVICE_TRANSPORTS.CLOUD,
      degraded: true,
      message: all('transportBlocked'),
    };
  }
  if (['auth', 'captcha', 'locked', 'error'].includes(state)) {
    return { external_id: externalId, transport: DEVICE_TRANSPORTS.UNREACHABLE };
  }
  return { external_id: externalId, transport: DEVICE_TRANSPORTS.CLOUD };
}

export { transportOf };
