# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for Porsche cars with **Porsche
Connect**: a Node.js service (Node 22+, ESM, no build step) in its own
sandboxed Docker container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js)
and to the servers of the My Porsche app: the Auth0 sign-in of
identity.porsche.com and the "PPA" API (api.ppa.porsche.com/app), as the
[pyporscheconnectapi](https://github.com/CJNE/pyporscheconnectapi) library
does (MIT, see NOTICE; cross-checked with the Porsche client of evcc).
Dependencies: the SDK and `@resvg/resvg-wasm` (draws the sign-in captcha).
Transport: cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                     SDK wiring only (new GladysIntegration + createApp)
src/app.js                   every handler, registered before connect(): sign-in, the
                             reading timer, publishing, commands, captcha, widget,
                             scene and configuration actions, diagnostic
src/porsche/constants.js     hosts, client ids, user agent, scopes, measurements, commands
src/porsche/auth.js          Auth0 identifier-first sign-in (PKCE, cookies, captcha pause,
                             passkey refusal), tokens in /data/session.json, refresh
src/porsche/api.js           vehicles, stored overview (mf=, cf=), commands and their progress
src/porsche/captcha.js       the captcha SVG -> PNG for the widget (resvg), image keys
src/porsche/http.js          fetch with timeout, cookie jar, no redirect followed
src/porsche/errors.js        error kinds (auth, captcha, locked, blocked…), redactVin
src/vehicle.js               overview -> snapshot (null, never 0, when unknown)
src/device.js                one device per VIN, its features and states
src/commands.js              command catalog, capabilities, payloads, PIN hash
src/events.js                scene triggers on transitions
src/scene-actions.js         send_command, get_status
src/widgets.js               the `vehicle` widget and its captcha card
src/geo.js                   distance from the houses of Gladys
src/transport.js             cloud / unreachable / degraded badge
src/config.js / i18n.js      configuration, runtime texts (en / fr / de / es)
test/helpers/fixtures.js     the fake Porsche cloud (Auth0 pages, token endpoint, PPA API)
```

## Porsche facts (from pyporscheconnectapi and evcc, to re-check when in doubt)

- Sign-in: `GET /authorize` (client `XhygisuebbrqQ80byOuU5VncxLIm8E6H`, redirect
  `my-porsche-app://auth0/callback`, audience `https://api.porsche.com`, PKCE S256)
  answers the callback with a code when an Auth0 session exists, else a login page
  with `state`; `POST /u/login/identifier` (401: unknown, 400: captcha in the page,
  an SVG data URI in the `atob("…")` context); `POST /u/login/password` (400: wrong
  password); then follow the resume redirects (decline `/u/passkey-enrollment`) up to
  the callback; `POST /oauth/token`. The captcha answer goes back with the same
  cookies and state.
- API: headers `X-Client-ID: 41843fb4-691d-4970-85c7-2673e8ecef40` and the app
  User-Agent. The overview `?mf=…` is the stored data (never wakes the car);
  `wakeUpJob` would wake it: never used. Measurements `{ key, status: { isEnabled },
value }`. Commands `POST …/commands { key, payload }` -> `ACCEPTED` + id, then
  `GET …/commands/<id>` until `PERFORMED` or `ERROR`. Unlock: `SPIN_CHALLENGE`,
  then SHA-512 of the bytes of PIN + challenge (hex), upper case.
- Errors: 401 token, 423 account locked, 429 too many requests, 408 car unavailable.
- Never tested with a real account: when a user reports a difference, fix the fake
  cloud in `test/helpers/fixtures.js` first, then the code.

## Rules

- **External ids are forever**: `gladys.externalIds('vehicle', vin)`, feature keys
  (`battery_level`, `lock`…), config, action, widget, widget action, scene trigger
  and action, field, option, variable and output keys too. Per feature, `category`,
  `type`, `unit`, `min`, `max` and `step` are compared by the "Update" button of the
  Discovery screen: `test/structure.test.js` checks them against
  `test/fixtures/discovery.baseline.json` (v0.1.0). Never update the baseline to make
  a test pass without a documented migration.
- **Category / type pairs** have a label in the Gladys front and a unit the core
  accepts (`test/devices.test.js`). `distance-sensor` takes `decimal`.
- **Be gentle with the account**: one sign-in, kept in `/data/session.json` and
  refreshed; a refused password, a captcha or a locked account (423) wait for the
  user (no retry loop); a 429 spaces the readings out (30 min doubled up to 4 h).
  Never read the overview with `wakeUpJob`: it wakes the car and drains its 12 V
  battery.
- **`should_poll` stays false**: the integration reads on its own timer
  (`poll_interval`, 10 to 60 min).
- **States**: `publishChangedStates` with a one-hour heartbeat, only for the created
  features; everything again in `onDeviceCreated`, then a widget refresh.
- **Scene events** on transitions between two readings only; the first reading is
  a baseline. The triggers a command of Gladys causes (lock, direct charge) stay
  quiet for 10 minutes.
- **Secrets and privacy**: never log the password, the PIN, a token, a captcha
  answer or a full VIN (`redactVin`); the Diagnostic hides VIN and position. Gladys
  passes no DEBUG variable to a store container: the Diagnostic action writes the
  anonymized summary to the logs instead.
- **The container rootfs is read-only**: only `/data` is written.
- **Four languages**: manifest, `src/i18n.js`, `docs/*.md`, `README*.md`
  (`test/i18n.test.js`). German says "du", Spanish "usted".
- **Widget images**: after any change to the content of the widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag. The
  version stays below 1.0.0 until the maintainer runs the Release workflow with
  `release-as: 1.0.0`.
- **Changelog**: Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor below
  1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build` release
  nothing.
- **Manifest**: texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB; `transports: ["cloud"]`; `gladys_version` `>=5.2.0` (the captcha form of
  the widget button).
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why, in
  English. Tests never touch the network.
