// -----------------------------------------------------------------------------
// Entry point of the Porsche Connect external integration.
//
// Brings the cars of a My Porsche account into Gladys, through the servers of
// the My Porsche app (Auth0 sign-in and the "PPA" API), as the
// pyporscheconnectapi library does:
//   - a device per car (Discovery screen): battery or fuel, range, odometer,
//     lock, openings, charge, climate, tires, service, distance from home
//     (src/device.js);
//   - scene triggers, scene actions and a dashboard widget.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
//
// This file only wires the SDK client: the handlers are in src/app.js, which
// the tests drive with the fake Gladys of the SDK.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
createApp(gladys);

logger.info(`Starting the Porsche Connect integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
