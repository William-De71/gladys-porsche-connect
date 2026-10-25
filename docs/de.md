# Porsche Connect

## Überblick

Diese Integration bringt die Porsche deines **My-Porsche**-Kontos in Gladys, über die Server der My-Porsche-App, wie die Bibliothek pyporscheconnectapi und ihre Home-Assistant-Integration:

- ein Gerät pro Fahrzeug: Batterie und elektrische Reichweite, Tank und Gesamtreichweite, Kilometerstand, Verriegelung, Türen, Kofferraum, Fronthaube, Fenster, Schiebedach oder Verdeck, Laden, Ladeziel, Vorklimatisierung, Reifendruck, Wartung und Entfernung von zu Hause;
- Befehle, wenn das Fahrzeug sie annimmt: verriegeln, entriegeln, Vorklimatisierung, Ladeziel, Direktladen, Blinken, Hupe und Blinker;
- Szenen-Auslöser und -Aktionen sowie ein Dashboard-Widget pro Fahrzeug.

Die Integration liest, was das Fahrzeug zuletzt an Porsche gesendet hat, standardmäßig alle 15 Minuten: Sie weckt es nie auf. Alles läuft über die Porsche-Cloud (Cloud-Transport): Das Fahrzeug wird nie in deinem Netzwerk angesprochen. Dies ist eine Community-Integration ohne Verbindung zu Porsche; die Server der My-Porsche-App haben keine öffentliche Dokumentation und können sich ändern.

## Voraussetzungen

- Gladys Assistant 5.3.0 oder neuer (das Captcha-Formular des Widgets braucht es).
- Ein Fahrzeug mit aktivem **Porsche-Connect**-Vertrag (Taycan, Macan Electric, 911 ab dem 992, 718, Panamera ab 2021, Cayenne ab 2017) sowie E-Mail und Passwort des My-Porsche-Kontos.
- Die 4-stellige PIN der My-Porsche-App, nur zum Entriegeln aus Gladys.
- Das Widget **Porsche** auf einem Dashboard: Porsche verlangt bei der Anmeldung manchmal ein Captcha, und im Widget gibst du es ein.

## Konfiguration

| Feld                             | Was einzugeben ist                                                     |
| -------------------------------- | ---------------------------------------------------------------------- |
| E-Mail / Passwort                | Das My-Porsche-Konto                                                   |
| PIN (4 Ziffern)                  | Optional: nur zum Entriegeln nötig                                     |
| Abfrageintervall                 | Standardmäßig 15 Minuten (10 bis 60)                                   |
| Temperatur der Vorklimatisierung | Standardmäßig 21 °C                                                    |
| Radius um das Zuhause            | Standardmäßig 200 m, für die Entfernung und die Szenen Ankunft/Abfahrt |
| Sprache der Texte                | Automatisch: die Sprache deines Dashboards                             |

Füge das Widget **Porsche** einem Dashboard hinzu, klicke dann auf **Speichern** und **Verbindung testen**: Deine Fahrzeuge werden mit der Zahl ihrer Befehle aufgelistet. Verlangt Porsche ein Captcha, zeigt das Widget dessen Bild: Klicke auf **Code eingeben**, tippe die Zeichen ein, und die Integration meldet sich an. Die Sitzung wird danach gespeichert und erneuert: Das Captcha ist selten. Die Zuhause von Gladys brauchen eine Position auf der Karte für die Entfernung.

## Verwendung

### Geräte

Öffne **Entdecken** und füge deine Fahrzeuge hinzu. Eine Funktion erscheint, sobald das Fahrzeug ihren Wert gemeldet hat: Die Integration bietet das Gerät erneut an, wenn eine neue hinzukommt (ein erstes Laden…). Verriegelung, Vorklimatisierung und Ladeziel lassen sich im Dashboard steuern, wenn das Fahrzeug diese Befehle annimmt. Ein Befehl dauert einige Sekunden bis anderthalb Minuten: Das Fahrzeug wacht auf, führt ihn aus, dann liest die Integration es erneut.

### Dashboard-Widget

![Das Porsche-Widget für zwei Fahrzeuge und das Anmelde-Captcha (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-porsche-connect/main/docs/assets/widgets.de.png)

Das Widget **Porsche** zeigt Batterie oder Tank, Reichweite, Kilometerstand, eine Statusliste (Verriegelung, Öffnungen, Laden, Klima, Reifen, Position) und Tasten: verriegeln oder entriegeln (Entriegeln fragt nach und braucht die PIN), vorklimatisieren, blinken lassen und die Position auf einer Karte. Wähle das Fahrzeug in den Einstellungen, oder lass es leer für das erste Fahrzeug. Solange Porsche ein Captcha verlangt, zeigt jedes Porsche-Widget stattdessen dieses an.

### Szenen

Auslöser: ver- oder entriegelt, verriegelt, aber offen, Ladestatus geändert, Kabel an- oder abgesteckt, angekommen oder losgefahren, Reifendruck niedrig, Kontoproblem. Sie werden bei der nächsten Abfrage des Fahrzeugs erkannt. Aktionen: Befehl senden (und auf die Ausführung warten), Status eines Fahrzeugs abfragen (mit einem Satz für eine Nachricht).

Beispiele:

- Wenn das Fahrzeug verriegelt, aber offen ist → mir eine Nachricht mit der Zusammenfassung senden.
- Wenn der Ladestatus „Laden abgeschlossen“ wird → benachrichtigen und die Ladesteckdose ausschalten.
- An jedem Werktag um 7:30 im Winter → den Befehl „Vorklimatisierung starten“ senden.

### Transport

Das Badge eines Fahrzeugs zeigt **Cloud**. Es wechselt zu **nicht erreichbar**, wenn Porsche das Konto ablehnt oder auf ein Captcha wartet, und zeigt einen orangen Punkt, solange Porsche die Anfragen begrenzt: Die Abfragen werden dann seltener.

## Fehlerbehebung

- **Falsche E-Mail oder falsches Passwort**: Prüfe sie zuerst in der My-Porsche-App und speichere die Einstellungen erneut.
- **Captcha**: Öffne das Dashboard mit dem Porsche-Widget und gib den Code ein. Ein falscher Code zeigt ein neues Bild; ein Captcha, das älter als 10 Minuten ist, wird ersetzt.
- **Konto gesperrt**: Porsche sperrt ein Konto nach zu vielen Anmeldungen. Entsperre es in der My-Porsche-App oder auf der Porsche-ID-Website und speichere dann die Einstellungen.
- **Werte einige Minuten alt**: Das Fahrzeug sendet seine Daten beim Parken, beim Laden und nach einem Befehl. Ein kürzeres Intervall lässt es nicht öfter senden.
- **Ein Wert oder Befehl fehlt**: Nicht jedes Fahrzeug meldet alles, und der Privatmodus des Fahrzeugs verbirgt die meisten Werte. Klicke auf **Diagnose** und kopiere die Zeilen des Tabs Protokolle in ein Issue auf GitHub: Sie enthalten, was das Fahrzeug meldet, ohne FIN und Position.
- **Entriegeln abgelehnt**: Gib die 4-stellige PIN der My-Porsche-App ein.
