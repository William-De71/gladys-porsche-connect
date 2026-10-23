// -----------------------------------------------------------------------------
// The identity of the My Porsche app, and what the integration reads.
//
// From pyporscheconnectapi (const.py, MIT), cross-checked with the Porsche
// client of evcc: the sign-in runs on the Auth0 tenant of Porsche
// (identity.porsche.com) with the client of the Android app, and the data
// come from the "PPA" backend of the app (api.ppa.porsche.com). When Porsche
// changes them, follow pyporscheconnectapi.
// -----------------------------------------------------------------------------

const AUTH_BASE_URL = 'https://identity.porsche.com';
const API_BASE_URL = 'https://api.ppa.porsche.com/app';
const CLIENT_ID = 'XhygisuebbrqQ80byOuU5VncxLIm8E6H';
const X_CLIENT_ID = '41843fb4-691d-4970-85c7-2673e8ecef40';
const REDIRECT_URI = 'my-porsche-app://auth0/callback';
const AUDIENCE = 'https://api.porsche.com';
const USER_AGENT = 'de.porsche.one/20.26.36-row+186611 (android)';

// The scopes of the app, without the profile details it never needs here
// (name, birth date, addresses…): the same list as evcc.
const SCOPE = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'mbb',
  'ssodb',
  'badge',
  'vin',
  'dealers',
  'cars',
  'charging',
  'manageCharging',
  'plugAndCharge',
  'climatisation',
  'manageClimatisation',
].join(' ');

// The measurements of the stored overview (what the car last sent: reading
// them never wakes the car up).
const MEASUREMENTS = [
  'BATTERY_LEVEL',
  'CHARGING_RATE',
  'CHARGING_SETTINGS',
  'CHARGING_SUMMARY',
  'CHARGING_PROFILES',
  'CLIMATIZER_STATE',
  'DEPARTURES',
  'E_RANGE',
  'FUEL_LEVEL',
  'GLOBAL_PRIVACY_MODE',
  'GPS_LOCATION',
  'HVAC_SUMMARY',
  'LOCK_STATE_VEHICLE',
  'MAIN_SERVICE_RANGE',
  'MAIN_SERVICE_TIME',
  'MILEAGE',
  'OPEN_STATE_DOOR_FRONT_LEFT',
  'OPEN_STATE_DOOR_FRONT_RIGHT',
  'OPEN_STATE_DOOR_REAR_LEFT',
  'OPEN_STATE_DOOR_REAR_RIGHT',
  'OPEN_STATE_LID_FRONT',
  'OPEN_STATE_LID_REAR',
  'OPEN_STATE_SUNROOF',
  'OPEN_STATE_SUNROOF_REAR',
  'OPEN_STATE_TOP',
  'OPEN_STATE_WINDOW_FRONT_LEFT',
  'OPEN_STATE_WINDOW_FRONT_RIGHT',
  'OPEN_STATE_WINDOW_REAR_LEFT',
  'OPEN_STATE_WINDOW_REAR_RIGHT',
  'PARKING_BRAKE',
  'RANGE',
  'REMOTE_ACCESS_AUTHORIZATION',
  'THEFT_STATE',
  'TIRE_PRESSURE_FRONT_LEFT',
  'TIRE_PRESSURE_FRONT_RIGHT',
  'TIRE_PRESSURE_REAR_LEFT',
  'TIRE_PRESSURE_REAR_RIGHT',
];

// The commands the integration may send; asked as capabilities (`cf=`).
const COMMAND_KEYS = [
  'LOCK',
  'UNLOCK',
  'HONK_FLASH',
  'REMOTE_CLIMATIZER_START',
  'REMOTE_CLIMATIZER_STOP',
  'DIRECT_CHARGING_START',
  'DIRECT_CHARGING_STOP',
  'CHARGING_SETTINGS_EDIT',
  'CHARGING_PROFILES_EDIT',
];

export {
  AUTH_BASE_URL,
  API_BASE_URL,
  CLIENT_ID,
  X_CLIENT_ID,
  REDIRECT_URI,
  AUDIENCE,
  USER_AGENT,
  SCOPE,
  MEASUREMENTS,
  COMMAND_KEYS,
};
