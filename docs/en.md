# Porsche Connect

## Overview

This integration brings the Porsche cars of your **My Porsche** account into Gladys, through the servers of the My Porsche app, like the pyporscheconnectapi library and its Home Assistant integration:

- one device per car: battery and electric range, fuel and total range, odometer, lock, doors, trunk, front lid, windows, sunroof or top, charge, charge target, pre-climatisation, tire pressures, service and distance from home;
- commands when the car accepts them: lock, unlock, pre-climatisation, charge target, direct charge, flash the lights, horn and lights;
- scene triggers and actions, and a dashboard widget per car.

The integration reads what the car last sent to Porsche, every 15 minutes by default: it never wakes the car up. Everything goes through the Porsche cloud (cloud transport): the car is never reached on your network. This is a community integration, not affiliated with Porsche; the servers of the My Porsche app have no public documentation and may change.

## Prerequisites

- Gladys Assistant 5.2.0 or later (the captcha form of the widget needs it).
- A car with an active **Porsche Connect** contract (Taycan, Macan Electric, 911 from the 992, 718, Panamera from 2021, Cayenne from 2017), and the e-mail and password of the My Porsche account.
- The 4-digit PIN of the My Porsche app, only to unlock the car from Gladys.
- The **Porsche** widget on a dashboard: Porsche sometimes asks for a captcha at the sign-in, and the widget is where you type it.

## Configuration

| Field                         | What to enter                                                            |
| ----------------------------- | ------------------------------------------------------------------------ |
| E-mail / Password             | The My Porsche account                                                   |
| PIN (4 digits)                | Optional: needed only to unlock                                          |
| Reading interval              | 15 minutes by default (10 to 60)                                         |
| Pre-climatisation temperature | 21 °C by default                                                         |
| Home radius                   | 200 m by default, for the distance from home and the arrived/left scenes |
| Language of the texts         | Automatic: the language of your dashboard                                |

Add the **Porsche** widget to a dashboard, then click **Save** and **Test the connection**: it lists your cars and the number of commands each accepts. If Porsche asks for a captcha, the widget shows its picture: click **Enter the code**, type the characters, and the integration signs in. The session is then kept and refreshed: the captcha is rare. The houses of Gladys need a position on the map for the distance from home.

## Usage

### Devices

Open **Discover**, then add your cars. A feature appears once the car has reported its value: the integration offers the device again when a new one shows up (a first charge…). Lock, pre-climatisation and charge target can be changed from the dashboard when the car accepts these commands. A command takes a few seconds to a minute and a half: the car wakes up, runs it, then the integration reads it again.

### Dashboard widget

![The Porsche widget for two cars and the sign-in captcha (generated illustration, not a screenshot)](https://raw.githubusercontent.com/William-De71/gladys-porsche-connect/main/docs/assets/widgets.en.png)

The **Porsche** widget shows the battery or the fuel, the range, the odometer, a status list (lock, openings, charge, climate, tires, position) and buttons: lock or unlock (unlock asks first, and needs the PIN), pre-climatise, flash the lights, and the position on a map. Choose the car in its settings, or leave it empty for the first car. While Porsche asks for a captcha, every Porsche widget shows it instead.

### Scenes

Triggers: locked or unlocked, locked but left open, charging status changed, cable plugged or unplugged, arrived home or left, tire pressure low, account problem. They are seen at the next reading of the car. Actions: send a command (and wait for the car to run it), read the status of a car (with a sentence ready for a message).

Examples:

- When the car is locked but left open → send me a message with the summary.
- When charging becomes "Charging completed" → notify and switch the charging socket off.
- Every working day at 7:30 in winter → send the command "Start the pre-climatisation".

### Transport

The badge of a car says **cloud**. It turns **unreachable** when Porsche refuses the account or waits for a captcha, and shows an orange dot while Porsche limits the requests: the readings are then spaced out.

## Troubleshooting

- **Wrong e-mail or password**: check them in the My Porsche app first, then save the settings again.
- **Captcha**: open the dashboard with the Porsche widget and type the code. A wrong code shows a new picture; a captcha older than 10 minutes is replaced.
- **Account locked**: Porsche locks an account after too many sign-ins. Unlock it in the My Porsche app or on the Porsche ID website, then save the settings.
- **Values a few minutes old**: the car sends its data when it parks, while it charges and after a command. A shorter interval does not make it send more.
- **A value or a command is missing**: not every car reports everything, and the privacy mode of the car hides most values. Click **Diagnostic**, then copy the lines of the Logs tab into an issue on GitHub: they contain what the car reports, without VIN nor position.
- **Unlock refused**: enter the 4-digit PIN of the My Porsche app.
