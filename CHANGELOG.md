# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.3.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords ([b357bca](https://github.com/William-De71/gladys-porsche-connect/commit/b357bca4f174357dcdecc82b1b9d51f80f9ca497))

## [0.2.0] - 2026-10-25

### Added

- list the integration under the new Vehicles shelf of the catalog ([c8c5660](https://github.com/William-De71/gladys-porsche-connect/commit/c8c5660538b56e94c2c8d120b89c08fb7293aae8))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([a7ea61f](https://github.com/William-De71/gladys-porsche-connect/commit/a7ea61fbafd728f9db6bdd2092b944f6cf91de74))

## [0.1.0] - 2026-10-23

### Added

- One device per car of the My Porsche account with Porsche Connect: battery level and electric range, fuel level and total range, odometer, lock, doors, trunk, front lid, windows, sunroof or top, charging cable, charging, charging status and power, charge target, pre-climatisation, tire pressures, service and distance from home. A feature appears when the car reports it.
- Remote commands where the car accepts them: lock and unlock (with the PIN of the My Porsche app), pre-climatisation at the chosen temperature, charge target, direct charge, flash the lights, horn and lights.
- Scene triggers: locked or unlocked, locked but left open, charging status changed, cable plugged or unplugged, arrived home or left, tire pressure low, account problem.
- Scene actions: send a command and wait for the car to run it, read the status of a car.
- A dashboard widget per car: battery or fuel, range, odometer, status list and buttons; it also shows the captcha Porsche sometimes asks for at the sign-in, with a form to answer it.
- Cloud transport through the servers of the My Porsche app: e-mail and password sign-in (captcha and passkey offer handled), session kept in /data and refreshed, readings of the stored data every 10 to 60 minutes that never wake the car, slower readings while Porsche limits the requests.
- A Diagnostic button that writes what each car reports to the logs, without VIN nor position.
- English, French, German and Spanish everywhere: settings, devices, widgets, scenes and documentation.

[0.3.0]: https://github.com/William-De71/gladys-porsche-connect/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/William-De71/gladys-porsche-connect/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-porsche-connect/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-porsche-connect/releases/tag/v0.1.0
