# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

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

[0.1.0]: https://github.com/William-De71/gladys-porsche-connect/releases/tag/v0.1.0
