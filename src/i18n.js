// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback), the four languages of the Gladys interface. German says "du"
// and Spanish "usted", as the Gladys interface does.
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, text states, widget contents, scene
// summaries, messages of the Configuration screen.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: {
    en: 'Porsche {model}',
    fr: 'Porsche {model}',
    de: 'Porsche {model}',
    es: 'Porsche {model}',
  },
  defaultModel: { en: 'car', fr: 'voiture', de: 'Fahrzeug', es: 'coche' },
  featureBatteryLevel: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  featureBatteryRange: {
    en: 'Electric range',
    fr: 'Autonomie électrique',
    de: 'Elektrische Reichweite',
    es: 'Autonomía eléctrica',
  },
  featureFuelLevel: {
    en: 'Fuel level',
    fr: 'Niveau de carburant',
    de: 'Tankfüllstand',
    es: 'Nivel de combustible',
  },
  featureRange: {
    en: 'Total range',
    fr: 'Autonomie totale',
    de: 'Gesamtreichweite',
    es: 'Autonomía total',
  },
  featureOdometer: {
    en: 'Odometer',
    fr: 'Kilométrage',
    de: 'Kilometerstand',
    es: 'Cuentakilómetros',
  },
  featureLock: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  featureDoors: { en: 'Doors', fr: 'Portes', de: 'Türen', es: 'Puertas' },
  featureTrunk: { en: 'Trunk', fr: 'Coffre', de: 'Kofferraum', es: 'Maletero' },
  featureHood: {
    en: 'Front lid',
    fr: 'Capot avant',
    de: 'Fronthaube',
    es: 'Capó delantero',
  },
  featureWindows: { en: 'Windows', fr: 'Fenêtres', de: 'Fenster', es: 'Ventanillas' },
  featureRoof: {
    en: 'Sunroof or top',
    fr: 'Toit ouvrant ou capote',
    de: 'Schiebedach oder Verdeck',
    es: 'Techo solar o capota',
  },
  featurePlugged: {
    en: 'Charging cable plugged in',
    fr: 'Câble de charge branché',
    de: 'Ladekabel angeschlossen',
    es: 'Cable de carga enchufado',
  },
  featureCharging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  featureChargingStatus: {
    en: 'Charging status',
    fr: 'État de la charge',
    de: 'Ladestatus',
    es: 'Estado de la carga',
  },
  featureChargePower: {
    en: 'Charging power',
    fr: 'Puissance de charge',
    de: 'Ladeleistung',
    es: 'Potencia de carga',
  },
  featureChargeTarget: {
    en: 'Charge target',
    fr: 'Objectif de charge',
    de: 'Ladeziel',
    es: 'Objetivo de carga',
  },
  featureClimate: {
    en: 'Pre-climatisation',
    fr: 'Préclimatisation',
    de: 'Vorklimatisierung',
    es: 'Preclimatización',
  },
  featureTireFrontLeft: {
    en: 'Tire front left',
    fr: 'Pneu avant gauche',
    de: 'Reifen vorne links',
    es: 'Neumático delantero izquierdo',
  },
  featureTireFrontRight: {
    en: 'Tire front right',
    fr: 'Pneu avant droit',
    de: 'Reifen vorne rechts',
    es: 'Neumático delantero derecho',
  },
  featureTireRearLeft: {
    en: 'Tire rear left',
    fr: 'Pneu arrière gauche',
    de: 'Reifen hinten links',
    es: 'Neumático trasero izquierdo',
  },
  featureTireRearRight: {
    en: 'Tire rear right',
    fr: 'Pneu arrière droit',
    de: 'Reifen hinten rechts',
    es: 'Neumático trasero derecho',
  },
  featureServiceDays: {
    en: 'Days to service',
    fr: 'Jours avant l’entretien',
    de: 'Tage bis zur Wartung',
    es: 'Días hasta el mantenimiento',
  },
  featureServiceDistance: {
    en: 'Distance to service',
    fr: 'Distance avant l’entretien',
    de: 'Strecke bis zur Wartung',
    es: 'Distancia hasta el mantenimiento',
  },
  featureDistanceHome: {
    en: 'Distance from home',
    fr: 'Distance du domicile',
    de: 'Entfernung von zu Hause',
    es: 'Distancia de casa',
  },

  // charge status (CHARGING_SUMMARY.status)
  charge_charging: { en: 'Charging', fr: 'En charge', de: 'Lädt', es: 'Cargando' },
  charge_charging_completed: {
    en: 'Charging completed',
    fr: 'Charge terminée',
    de: 'Laden abgeschlossen',
    es: 'Carga completada',
  },
  charge_charging_error: {
    en: 'Charging error',
    fr: 'Erreur de charge',
    de: 'Ladefehler',
    es: 'Error de carga',
  },
  charge_charging_stopped: {
    en: 'Charging stopped',
    fr: 'Charge arrêtée',
    de: 'Laden gestoppt',
    es: 'Carga detenida',
  },
  charge_initialising: {
    en: 'Starting to charge',
    fr: 'Démarrage de la charge',
    de: 'Laden startet',
    es: 'Iniciando la carga',
  },
  charge_instant_charging: {
    en: 'Direct charging',
    fr: 'Charge immédiate',
    de: 'Direktladen',
    es: 'Carga inmediata',
  },
  charge_not_charging: {
    en: 'Not charging',
    fr: 'Pas en charge',
    de: 'Lädt nicht',
    es: 'Sin cargar',
  },
  charge_not_plugged: {
    en: 'Not plugged in',
    fr: 'Non branchée',
    de: 'Nicht angeschlossen',
    es: 'Sin enchufar',
  },
  charge_off: { en: 'Charging off', fr: 'Charge coupée', de: 'Laden aus', es: 'Carga apagada' },
  charge_other: {
    en: 'Unknown status',
    fr: 'État inconnu',
    de: 'Unbekannter Status',
    es: 'Estado desconocido',
  },

  // openings and tires
  opening_doors: { en: 'doors', fr: 'portes', de: 'Türen', es: 'puertas' },
  opening_trunk: { en: 'trunk', fr: 'coffre', de: 'Kofferraum', es: 'maletero' },
  opening_hood: { en: 'front lid', fr: 'capot avant', de: 'Fronthaube', es: 'capó delantero' },
  opening_windows: { en: 'windows', fr: 'fenêtres', de: 'Fenster', es: 'ventanillas' },
  opening_roof: {
    en: 'sunroof or top',
    fr: 'toit ou capote',
    de: 'Dach oder Verdeck',
    es: 'techo o capota',
  },
  tire_frontLeft: {
    en: 'front left',
    fr: 'avant gauche',
    de: 'vorne links',
    es: 'delantero izquierdo',
  },
  tire_frontRight: {
    en: 'front right',
    fr: 'avant droit',
    de: 'vorne rechts',
    es: 'delantero derecho',
  },
  tire_rearLeft: {
    en: 'rear left',
    fr: 'arrière gauche',
    de: 'hinten links',
    es: 'trasero izquierdo',
  },
  tire_rearRight: {
    en: 'rear right',
    fr: 'arrière droit',
    de: 'hinten rechts',
    es: 'trasero derecho',
  },
  locked: { en: 'Locked', fr: 'Verrouillée', de: 'Verriegelt', es: 'Cerrado' },
  unlocked: { en: 'Unlocked', fr: 'Déverrouillée', de: 'Entriegelt', es: 'Abierto' },
  allClosed: {
    en: 'All closed',
    fr: 'Tout est fermé',
    de: 'Alles geschlossen',
    es: 'Todo cerrado',
  },
  open: { en: 'Open: {list}', fr: 'Ouvert : {list}', de: 'Offen: {list}', es: 'Abierto: {list}' },

  // scene summaries
  summaryLocked: {
    en: '{car} is locked.',
    fr: '{car} est verrouillée.',
    de: '{car} ist verriegelt.',
    es: '{car} está cerrado.',
  },
  summaryUnlocked: {
    en: '{car} is unlocked.',
    fr: '{car} est déverrouillée.',
    de: '{car} ist entriegelt.',
    es: '{car} está abierto.',
  },
  summaryLeftOpen: {
    en: '{car} is locked but still open: {list}.',
    fr: '{car} est verrouillée mais encore ouverte : {list}.',
    de: '{car} ist verriegelt, aber noch offen: {list}.',
    es: '{car} está cerrado pero sigue abierto: {list}.',
  },
  summaryCharging: {
    en: '{car}: {status} ({level} %).',
    fr: '{car} : {status} ({level} %).',
    de: '{car}: {status} ({level} %).',
    es: '{car}: {status} ({level} %).',
  },
  summaryPlugged: {
    en: '{car}: charging cable plugged in.',
    fr: '{car} : câble de charge branché.',
    de: '{car}: Ladekabel angeschlossen.',
    es: '{car}: cable de carga enchufado.',
  },
  summaryUnplugged: {
    en: '{car}: charging cable unplugged.',
    fr: '{car} : câble de charge débranché.',
    de: '{car}: Ladekabel abgezogen.',
    es: '{car}: cable de carga desenchufado.',
  },
  summaryArrived: {
    en: '{car} has arrived home.',
    fr: '{car} est arrivée à la maison.',
    de: '{car} ist zu Hause angekommen.',
    es: '{car} ha llegado a casa.',
  },
  summaryLeft: {
    en: '{car} has left home.',
    fr: '{car} a quitté la maison.',
    de: '{car} hat das Zuhause verlassen.',
    es: '{car} ha salido de casa.',
  },
  summaryTires: {
    en: '{car}: tire pressure low ({list}).',
    fr: '{car} : pression des pneus basse ({list}).',
    de: '{car}: Reifendruck zu niedrig ({list}).',
    es: '{car}: presión de neumáticos baja ({list}).',
  },
  summaryBattery: {
    en: 'Battery {level} %, {range} km.',
    fr: 'Batterie {level} %, {range} km.',
    de: 'Batterie {level} %, {range} km.',
    es: 'Batería {level} %, {range} km.',
  },
  summaryFuel: {
    en: 'Fuel {level} %, {range} km.',
    fr: 'Carburant {level} %, {range} km.',
    de: 'Tank {level} %, {range} km.',
    es: 'Combustible {level} %, {range} km.',
  },
  summaryStatus: {
    en: '{car}: {lock}, {openings}. {energy}',
    fr: '{car} : {lock}, {openings}. {energy}',
    de: '{car}: {lock}, {openings}. {energy}',
    es: '{car}: {lock}, {openings}. {energy}',
  },
  problem_auth: {
    en: 'Porsche refused the e-mail or the password: check them in the integration settings.',
    fr: 'Porsche a refusé l’e-mail ou le mot de passe : vérifiez-les dans les réglages de l’intégration.',
    de: 'Porsche hat E-Mail oder Passwort abgelehnt: Prüfe sie in den Einstellungen der Integration.',
    es: 'Porsche ha rechazado el correo o la contraseña: compruébelos en los ajustes de la integración.',
  },
  problem_captcha: {
    en: 'Porsche asks for a captcha: type it in the Porsche Connect widget of the dashboard.',
    fr: 'Porsche demande un captcha : saisissez-le dans le widget Porsche Connect du tableau de bord.',
    de: 'Porsche verlangt ein Captcha: Gib es im Porsche-Connect-Widget des Dashboards ein.',
    es: 'Porsche pide un captcha: escríbalo en el widget Porsche Connect del panel.',
  },
  problem_locked: {
    en: 'Porsche locked the account (too many sign-ins): unlock it in the My Porsche app, then save the settings.',
    fr: 'Porsche a bloqué le compte (trop de connexions) : débloquez-le dans l’app My Porsche, puis enregistrez les réglages.',
    de: 'Porsche hat das Konto gesperrt (zu viele Anmeldungen): Entsperre es in der My-Porsche-App, dann speichere.',
    es: 'Porsche ha bloqueado la cuenta (demasiados inicios): desbloquéela en la app My Porsche y guarde los ajustes.',
  },
  problem_blocked: {
    en: 'Porsche limits the requests of the account for now: the next readings are delayed.',
    fr: 'Porsche limite les requêtes du compte pour l’instant : les prochaines lectures sont retardées.',
    de: 'Porsche begrenzt vorerst die Anfragen des Kontos: Die nächsten Abfragen werden verschoben.',
    es: 'Porsche limita por ahora las solicitudes de la cuenta: las próximas lecturas se retrasan.',
  },

  // widget
  battery: { en: 'Battery', fr: 'Batterie', de: 'Batterie', es: 'Batería' },
  fuel: { en: 'Fuel', fr: 'Carburant', de: 'Tank', es: 'Combustible' },
  range: { en: 'Range', fr: 'Autonomie', de: 'Reichweite', es: 'Autonomía' },
  odometer: { en: 'Odometer', fr: 'Compteur', de: 'Kilometer', es: 'Kilometraje' },
  lockState: { en: 'Lock', fr: 'Verrouillage', de: 'Verriegelung', es: 'Cierre' },
  openings: { en: 'Openings', fr: 'Ouvrants', de: 'Öffnungen', es: 'Aperturas' },
  charging: { en: 'Charge', fr: 'Charge', de: 'Laden', es: 'Carga' },
  chargeUntil: {
    en: '{status} until {time}',
    fr: '{status} jusqu’à {time}',
    de: '{status} bis {time}',
    es: '{status} hasta las {time}',
  },
  chargeTarget: {
    en: '{status}, target {level} %',
    fr: '{status}, objectif {level} %',
    de: '{status}, Ziel {level} %',
    es: '{status}, objetivo {level} %',
  },
  climate: { en: 'Climate', fr: 'Climatisation', de: 'Klima', es: 'Climatización' },
  on: { en: 'On', fr: 'En marche', de: 'An', es: 'Encendida' },
  off: { en: 'Off', fr: 'Arrêtée', de: 'Aus', es: 'Apagada' },
  tires: { en: 'Tires', fr: 'Pneus', de: 'Reifen', es: 'Neumáticos' },
  tiresOk: { en: 'Pressure OK', fr: 'Pression correcte', de: 'Druck OK', es: 'Presión correcta' },
  tiresLow: { en: 'Low: {list}', fr: 'Basse : {list}', de: 'Niedrig: {list}', es: 'Baja: {list}' },
  position: { en: 'Position', fr: 'Position', de: 'Position', es: 'Posición' },
  atHome: { en: 'At home', fr: 'À la maison', de: 'Zu Hause', es: 'En casa' },
  awayFrom: {
    en: '{km} km from home',
    fr: 'À {km} km de la maison',
    de: '{km} km von zu Hause',
    es: 'A {km} km de casa',
  },
  privacy: { en: 'Privacy mode', fr: 'Mode privé', de: 'Privatmodus', es: 'Modo privado' },
  privacyOn: {
    en: 'On: few values',
    fr: 'Actif : peu de valeurs',
    de: 'An: wenige Werte',
    es: 'Activo: pocos valores',
  },
  updated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  ago_now: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  ago_minutes: { en: '{n} min ago', fr: 'il y a {n} min', de: 'vor {n} Min.', es: 'hace {n} min' },
  ago_hours: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  ago_days: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  buttonUnlock: { en: 'Unlock', fr: 'Déverrouiller', de: 'Entriegeln', es: 'Abrir' },
  buttonLock: { en: 'Lock', fr: 'Verrouiller', de: 'Verriegeln', es: 'Cerrar' },
  buttonClimateStart: {
    en: 'Pre-climatise',
    fr: 'Préclimatiser',
    de: 'Vorklimatisieren',
    es: 'Preclimatizar',
  },
  buttonClimateStop: {
    en: 'Stop climate',
    fr: 'Arrêter la clim',
    de: 'Klima stoppen',
    es: 'Parar climatización',
  },
  buttonFlash: {
    en: 'Flash lights',
    fr: 'Faire clignoter',
    de: 'Blinken lassen',
    es: 'Destellar luces',
  },
  buttonMap: { en: 'Map', fr: 'Carte', de: 'Karte', es: 'Mapa' },
  captchaTitle: {
    en: 'Porsche asks for a captcha to sign in. Type the characters of the picture.',
    fr: 'Porsche demande un captcha pour se connecter. Saisissez les caractères de l’image.',
    de: 'Porsche verlangt ein Captcha zur Anmeldung. Gib die Zeichen des Bildes ein.',
    es: 'Porsche pide un captcha para iniciar sesión. Escriba los caracteres de la imagen.',
  },
  captchaAlt: {
    en: 'Captcha of the Porsche sign-in',
    fr: 'Captcha de la connexion Porsche',
    de: 'Captcha der Porsche-Anmeldung',
    es: 'Captcha del inicio de sesión de Porsche',
  },
  buttonCaptcha: {
    en: 'Enter the code',
    fr: 'Saisir le code',
    de: 'Code eingeben',
    es: 'Escribir el código',
  },
  captchaField: {
    en: 'Characters of the picture',
    fr: 'Caractères de l’image',
    de: 'Zeichen des Bildes',
    es: 'Caracteres de la imagen',
  },
  captchaSent: {
    en: 'Code sent to Porsche: signing in…',
    fr: 'Code envoyé à Porsche : connexion en cours…',
    de: 'Code an Porsche gesendet: Anmeldung läuft…',
    es: 'Código enviado a Porsche: iniciando sesión…',
  },
  captchaWrong: {
    en: 'Wrong code: Porsche shows a new picture.',
    fr: 'Code incorrect : Porsche affiche une nouvelle image.',
    de: 'Falscher Code: Porsche zeigt ein neues Bild.',
    es: 'Código incorrecto: Porsche muestra una nueva imagen.',
  },
  captchaDone: {
    en: 'Signed in to Porsche.',
    fr: 'Connecté à Porsche.',
    de: 'Bei Porsche angemeldet.',
    es: 'Sesión iniciada en Porsche.',
  },
  loading: {
    en: 'Waiting for the first data from Porsche…',
    fr: 'En attente des premières données de Porsche…',
    de: 'Warten auf die ersten Daten von Porsche…',
    es: 'Esperando los primeros datos de Porsche…',
  },
  notReady: {
    en: 'Enter your My Porsche account in the integration settings.',
    fr: 'Renseignez votre compte My Porsche dans les réglages de l’intégration.',
    de: 'Gib dein My-Porsche-Konto in den Einstellungen der Integration ein.',
    es: 'Indique su cuenta My Porsche en los ajustes de la integración.',
  },
  noVehicle: {
    en: 'No car with Porsche Connect in this My Porsche account.',
    fr: 'Aucune voiture avec Porsche Connect dans ce compte My Porsche.',
    de: 'Kein Fahrzeug mit Porsche Connect in diesem My-Porsche-Konto.',
    es: 'Ningún coche con Porsche Connect en esta cuenta My Porsche.',
  },
  transportBlocked: {
    en: 'Porsche limits the requests for now: the values shown may be old.',
    fr: 'Porsche limite les requêtes pour l’instant : les valeurs affichées peuvent être anciennes.',
    de: 'Porsche begrenzt vorerst die Anfragen: Die Werte können veraltet sein.',
    es: 'Porsche limita las solicitudes por ahora: los valores pueden ser antiguos.',
  },

  // connection status
  statusNoAccount: {
    en: 'Enter the e-mail and the password of your My Porsche account.',
    fr: 'Renseignez l’e-mail et le mot de passe de votre compte My Porsche.',
    de: 'Gib E-Mail und Passwort deines My-Porsche-Kontos ein.',
    es: 'Indique el correo y la contraseña de su cuenta My Porsche.',
  },
  statusConnected: {
    en: 'Connected to Porsche Connect: {count} car(s).',
    fr: 'Connecté à Porsche Connect : {count} voiture(s).',
    de: 'Mit Porsche Connect verbunden: {count} Fahrzeug(e).',
    es: 'Conectado a Porsche Connect: {count} coche(s).',
  },
  statusUnreachable: {
    en: 'The Porsche servers cannot be reached: retrying.',
    fr: 'Les serveurs Porsche sont injoignables : nouvel essai en cours.',
    de: 'Die Porsche-Server sind nicht erreichbar: neuer Versuch läuft.',
    es: 'No se puede acceder a los servidores de Porsche: reintentando.',
  },

  // commands
  command_lock: { en: 'lock', fr: 'verrouillage', de: 'Verriegeln', es: 'cierre' },
  command_unlock: { en: 'unlock', fr: 'déverrouillage', de: 'Entriegeln', es: 'apertura' },
  command_climate_start: {
    en: 'pre-climatisation',
    fr: 'préclimatisation',
    de: 'Vorklimatisierung',
    es: 'preclimatización',
  },
  command_climate_stop: {
    en: 'climate stop',
    fr: 'arrêt de la climatisation',
    de: 'Klima-Stopp',
    es: 'parada de la climatización',
  },
  command_flash: {
    en: 'flash lights',
    fr: 'clignotement',
    de: 'Blinken',
    es: 'destello de luces',
  },
  command_honk_flash: {
    en: 'horn and lights',
    fr: 'klaxon et clignotement',
    de: 'Hupe und Blinken',
    es: 'claxon y luces',
  },
  command_direct_charge_start: {
    en: 'direct charge',
    fr: 'charge immédiate',
    de: 'Direktladen',
    es: 'carga inmediata',
  },
  command_direct_charge_stop: {
    en: 'direct charge stop',
    fr: 'arrêt de la charge immédiate',
    de: 'Direktladen beenden',
    es: 'fin de la carga inmediata',
  },
  command_charge_target: {
    en: 'charge target',
    fr: 'objectif de charge',
    de: 'Ladeziel',
    es: 'objetivo de carga',
  },
  commandSent: {
    en: 'Sent to the car: {command}.',
    fr: 'Envoyé à la voiture : {command}.',
    de: 'An das Fahrzeug gesendet: {command}.',
    es: 'Enviado al coche: {command}.',
  },
  commandDone: {
    en: 'Done: {command}.',
    fr: 'Effectué : {command}.',
    de: 'Erledigt: {command}.',
    es: 'Hecho: {command}.',
  },
  commandFailed: {
    en: 'Not carried out: {command} ({status}).',
    fr: 'Non exécuté : {command} ({status}).',
    de: 'Nicht ausgeführt: {command} ({status}).',
    es: 'No ejecutado: {command} ({status}).',
  },
  commandUnsupported: {
    en: 'This car does not accept the command: {command}.',
    fr: 'Cette voiture n’accepte pas la commande : {command}.',
    de: 'Dieses Fahrzeug akzeptiert den Befehl nicht: {command}.',
    es: 'Este coche no acepta la orden: {command}.',
  },
  commandPinRequired: {
    en: 'Unlocking needs the 4-digit PIN of the My Porsche app (integration settings).',
    fr: 'Le déverrouillage demande le code PIN à 4 chiffres de l’app My Porsche (réglages de l’intégration).',
    de: 'Zum Entriegeln ist die 4-stellige PIN der My-Porsche-App nötig (Einstellungen der Integration).',
    es: 'Para abrir hace falta el PIN de 4 cifras de la app My Porsche (ajustes de la integración).',
  },
  commandNoProfile: {
    en: 'No active charging profile in the car: set the target in the My Porsche app.',
    fr: 'Aucun profil de charge actif dans la voiture : réglez l’objectif dans l’app My Porsche.',
    de: 'Kein aktives Ladeprofil im Fahrzeug: Stelle das Ziel in der My-Porsche-App ein.',
    es: 'Ningún perfil de carga activo en el coche: ajuste el objetivo en la app My Porsche.',
  },

  // configuration actions
  testConnected: {
    en: 'Signed in. Cars: {list}',
    fr: 'Connexion réussie. Voitures : {list}',
    de: 'Angemeldet. Fahrzeuge: {list}',
    es: 'Sesión iniciada. Coches: {list}',
  },
  commandCount: {
    en: '{count} commands',
    fr: '{count} commandes',
    de: '{count} Befehle',
    es: '{count} órdenes',
  },
  readDone: {
    en: '{count} car(s) read.',
    fr: '{count} voiture(s) lue(s).',
    de: '{count} Fahrzeug(e) gelesen.',
    es: '{count} coche(s) leído(s).',
  },
  diagnosticDone: {
    en: 'Diagnostic of {count} car(s) written to the Logs tab, without VIN nor position.',
    fr: 'Diagnostic de {count} voiture(s) écrit dans l’onglet Journaux, sans VIN ni position.',
    de: 'Diagnose von {count} Fahrzeug(en) im Tab Protokolle, ohne FIN und Position.',
    es: 'Diagnóstico de {count} coche(s) escrito en la pestaña Registros, sin VIN ni posición.',
  },
  signedOut: {
    en: 'Session forgotten: the integration signs in again now.',
    fr: 'Session oubliée : l’intégration se reconnecte maintenant.',
    de: 'Sitzung verworfen: Die Integration meldet sich jetzt neu an.',
    es: 'Sesión olvidada: la integración inicia sesión de nuevo ahora.',
  },
};

/**
 * @description Pick a text in a language (English fallback), with `{name}`
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('summaryArrived', 'fr', { car: 'Porsche Taycan 4S' });
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description A multi-language message built language by language.
 * @param {Function} build - `(language) => string`.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function each(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/**
 * @description The text in every language.
 * @param {string} key - The TEXTS key.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 */
function all(key, values = {}) {
  return each((language) => t(key, language, values));
}

/**
 * @description A list of openings, "doors, trunk".
 * @param {string[]} openings - The opening names.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function openingsLabel(openings, language) {
  return openings.map((name) => t(`opening_${name}`, language)).join(', ');
}

/**
 * @description A list of tires, "front left, rear right".
 * @param {string[]} tires - The tire positions.
 * @param {string} language - The language.
 * @returns {string} The list.
 */
function tiresLabel(tires, language) {
  return tires.map((name) => t(`tire_${name}`, language)).join(', ');
}

/**
 * @description "12 min ago" for an instant.
 * @param {number} instant - The instant, in ms.
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The relative time.
 */
function ago(instant, now, language) {
  const minutes = Math.max(0, Math.floor((now - instant) / 60000));
  if (minutes < 1) {
    return t('ago_now', language);
  }
  if (minutes < 60) {
    return t('ago_minutes', language, { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('ago_hours', language, { n: hours });
  }
  return t('ago_days', language, { n: Math.floor(hours / 24) });
}

export { LANGUAGES, TEXTS, t, all, each, openingsLabel, tiresLabel, ago };
