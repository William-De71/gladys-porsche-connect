// -----------------------------------------------------------------------------
// Errors of the Porsche client, by kind: what the user must do differs.
//
//   - `auth`        wrong e-mail or password;
//   - `captcha`     the sign-in asks for a captcha: the user types it in the
//                   widget (`image` holds the picture, an SVG data URI);
//   - `locked`      HTTP 423: Porsche locked the account (too many sign-ins);
//   - `blocked`     HTTP 429: too many requests, wait;
//   - `unavailable` HTTP 408: the car did not answer (asleep, no network);
//   - `refused`     another 4xx: a command the car or the contract refuses;
//   - `unreachable` network error, timeout, 5xx.
// -----------------------------------------------------------------------------

const KINDS = {
  AUTH: 'auth',
  CAPTCHA: 'captcha',
  LOCKED: 'locked',
  BLOCKED: 'blocked',
  UNAVAILABLE: 'unavailable',
  REFUSED: 'refused',
  UNREACHABLE: 'unreachable',
};

class PorscheError extends Error {
  /**
   * @param {string} message - The message (never a secret).
   * @param {object} [options] - Options.
   * @param {string} [options.kind] - One of KINDS.
   * @param {number} [options.status] - The HTTP status.
   * @param {string} [options.image] - The captcha picture (kind `captcha`).
   */
  constructor(message, { kind = KINDS.UNREACHABLE, status = null, image = null } = {}) {
    super(message);
    this.name = 'PorscheError';
    this.kind = kind;
    this.status = status;
    this.image = image;
  }
}

/**
 * @description The kind of error an HTTP status of the API stands for.
 * @param {number} status - The status.
 * @returns {string} The kind.
 * @example
 * kindOfStatus(429); // -> 'blocked'
 */
function kindOfStatus(status) {
  if (status === 401 || status === 403) {
    return KINDS.AUTH;
  }
  if (status === 423) {
    return KINDS.LOCKED;
  }
  if (status === 429) {
    return KINDS.BLOCKED;
  }
  if (status === 408) {
    return KINDS.UNAVAILABLE;
  }
  if (status >= 400 && status < 500) {
    return KINDS.REFUSED;
  }
  return KINDS.UNREACHABLE;
}

/**
 * @description Hide a VIN in a text: "WP0…1234".
 * @param {string} text - The text.
 * @returns {string} The text.
 * @example
 * redactVin('car WP0ZZZY1ZNSA00123'); // -> 'car WP0…0123'
 */
function redactVin(text) {
  return String(text ?? '').replace(
    /\b([A-HJ-NPR-Z0-9]{3})[A-HJ-NPR-Z0-9]{10}([A-HJ-NPR-Z0-9]{4})\b/g,
    '$1…$2',
  );
}

export { KINDS, PorscheError, kindOfStatus, redactVin };
