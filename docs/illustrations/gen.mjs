// Builds the widget contents of the illustrations with the integration's own
// code: node gen.mjs <repo> <out.json> (run by render.sh)
//
// Two cars of a made-up account, read from the synthetic overviews of the
// test fixtures: a Taycan charging at home, its PIN set, and a 911 parked in
// town, unlocked with a door open. A third card shows the captcha the
// Porsche sign-in sometimes asks for (the SVG of the fixtures, drawn by the
// integration's own captcha module).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [repo, out] = process.argv.slice(2);
const load = (path) => import(pathToFileURL(`${repo}/${path}`).href);
const { buildVehicleWidget, captchaContent } = await load('src/widgets.js');
const { describe, summarize } = await load('src/vehicle.js');
const { captchaKey, captchaPng } = await load('src/porsche/captcha.js');
const { LANGUAGES } = await load('src/i18n.js');
const fx = await load('test/helpers/fixtures.js');
const manifest = JSON.parse(readFileSync(`${repo}/gladys-assistant-integration.json`, 'utf8'));

// Tuesday 20 October 2026, 08:05 UTC (the timezone of the render).
const NOW = fx.NOW + 5 * 60 * 1000;
const change = (measurements, changes) =>
  fx
    .copy(measurements)
    .map((item) =>
      changes[item.key] ? { ...item, value: { ...item.value, ...changes[item.key] } } : item,
    );

const taycanInfo = describe(fx.VEHICLES[0], fx.overviewOf(fx.VIN_BEV, [], fx.BEV_COMMANDS));
const taycan = {
  info: taycanInfo,
  reading: {
    snapshot: summarize(
      fx.overviewOf(
        fx.VIN_BEV,
        change(fx.BEV_MEASUREMENTS, {
          BATTERY_LEVEL: { percent: 64 },
          E_RANGE: { kilometers: 268 },
          CHARGING_SUMMARY: {
            status: 'CHARGING',
            targetDateTimeWithOffset: new Date(fx.NOW + 2.5 * 60 * 60 * 1000).toISOString(),
          },
          CHARGING_RATE: { chargingPower: 10.8 },
        }),
      ),
      taycanInfo,
    ),
    atHome: true,
    distanceHomeKm: 0.01,
    readAt: fx.NOW + 2 * 60 * 1000,
  },
};
const carreraInfo = describe(fx.VEHICLES[1], fx.overviewOf(fx.VIN_PETROL, [], fx.PETROL_COMMANDS));
const carrera = {
  info: carreraInfo,
  reading: {
    snapshot: summarize(fx.overviewOf(fx.VIN_PETROL, fx.PETROL_MEASUREMENTS), carreraInfo),
    atHome: false,
    distanceHomeKm: 12.6,
    readAt: fx.NOW - 9 * 60 * 1000,
  },
};

const contents = {};
for (const language of LANGUAGES) {
  contents[language] = {
    taycan: buildVehicleWidget({ ...taycan, canUnlock: true, language, now: NOW }),
    carrera: buildVehicleWidget({ ...carrera, canUnlock: true, language, now: NOW }),
    captcha: captchaContent(fx.CAPTCHA_IMAGE, language),
  };
}
const images = {
  [captchaKey(fx.CAPTCHA_IMAGE)]: `data:image/png;base64,${await captchaPng(fx.CAPTCHA_IMAGE)}`,
};
const vehicle = manifest.widgets.find((w) => w.key === 'vehicle');
const widgets = Object.fromEntries(
  ['taycan', 'carrera', 'captcha'].map((card) => [
    card,
    { icon: vehicle.icon, label: vehicle.label },
  ]),
);
writeFileSync(out, JSON.stringify({ now: NOW, widgets, contents, images }));
