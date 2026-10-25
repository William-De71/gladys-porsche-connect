# Porsche Connect

## Presentación

Esta integración trae a Gladys los Porsche de su cuenta **My Porsche**, a través de los servidores de la app My Porsche, como la biblioteca pyporscheconnectapi y su integración de Home Assistant:

- un dispositivo por coche: batería y autonomía eléctrica, combustible y autonomía total, kilometraje, cierre, puertas, maletero, capó delantero, ventanillas, techo solar o capota, carga, objetivo de carga, preclimatización, presión de los neumáticos, mantenimiento y distancia de casa;
- órdenes cuando el coche las acepta: cerrar, abrir, preclimatización, objetivo de carga, carga inmediata, destellar las luces, claxon y luces;
- activadores y acciones de escena, y un widget de panel por coche.

La integración lee lo último que el coche envió a Porsche, cada 15 minutos por defecto: nunca lo despierta. Todo pasa por la nube de Porsche (transporte en la nube): nunca se accede al coche en su red. Es una integración comunitaria, sin relación con Porsche; los servidores de la app My Porsche no tienen documentación pública y pueden cambiar.

## Requisitos previos

- Gladys Assistant 5.3.0 o posterior (el formulario del captcha en el widget lo necesita).
- Un coche con un contrato **Porsche Connect** activo (Taycan, Macan eléctrico, 911 desde el 992, 718, Panamera desde 2021, Cayenne desde 2017), y el correo y la contraseña de la cuenta My Porsche.
- El PIN de 4 cifras de la app My Porsche, solo para abrir el coche desde Gladys.
- El widget **Porsche** en un panel: Porsche pide a veces un captcha al iniciar sesión, y es en el widget donde usted lo escribe.

## Configuración

| Campo                           | Qué indicar                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Correo electrónico / Contraseña | La cuenta My Porsche                                                         |
| PIN (4 cifras)                  | Opcional: solo hace falta para abrir                                         |
| Intervalo de lectura            | 15 minutos por defecto (de 10 a 60)                                          |
| Temperatura de preclimatización | 21 °C por defecto                                                            |
| Radio de la vivienda            | 200 m por defecto, para la distancia de casa y las escenas de llegada/salida |
| Idioma de los textos            | Automático: el idioma de su panel                                            |

Añada el widget **Porsche** a un panel, luego haga clic en **Guardar** y **Probar la conexión**: aparecen sus coches con el número de órdenes que acepta cada uno. Si Porsche pide un captcha, el widget muestra su imagen: haga clic en **Escribir el código**, teclee los caracteres y la integración inicia sesión. La sesión se guarda y se renueva después: el captcha es poco frecuente. Las viviendas de Gladys necesitan una posición en el mapa para la distancia de casa.

## Uso

### Dispositivos

Abra **Descubrir** y añada sus coches. Una funcionalidad aparece en cuanto el coche ha enviado su valor: la integración vuelve a ofrecer el dispositivo cuando llega una nueva (una primera carga…). El cierre, la preclimatización y el objetivo de carga se controlan desde el panel cuando el coche acepta estas órdenes. Una orden tarda de unos segundos a un minuto y medio: el coche se despierta, la ejecuta y la integración lo vuelve a leer.

### Widget del panel

![El widget Porsche para dos coches y el captcha de inicio de sesión (ilustración generada, no una captura de pantalla)](https://raw.githubusercontent.com/William-De71/gladys-porsche-connect/main/docs/assets/widgets.es.png)

El widget **Porsche** muestra la batería o el combustible, la autonomía, el kilometraje, una lista de estados (cierre, aperturas, carga, climatización, neumáticos, posición) y botones: cerrar o abrir (abrir pide confirmación y el PIN), preclimatizar, destellar las luces y la posición en un mapa. Elija el coche en sus ajustes, o déjelo vacío para el primer coche. Mientras Porsche pide un captcha, cada widget Porsche lo muestra en su lugar.

### Escenas

Activadores: cerrado o abierto, cerrado pero abierto, estado de carga cambiado, cable enchufado o desenchufado, llegada o salida de casa, presión de neumáticos baja, problema de cuenta. Se detectan en la siguiente lectura del coche. Acciones: enviar una orden (y esperar su ejecución), leer el estado de un coche (con una frase lista para un mensaje).

Ejemplos:

- Cuando el coche está cerrado pero abierto → enviarme un mensaje con el resumen.
- Cuando la carga pasa a «Carga completada» → avisar y apagar el enchufe de carga.
- Cada día laborable a las 7:30 en invierno → enviar la orden «Iniciar la preclimatización».

### Transporte

La insignia de un coche indica **nube**. Pasa a **inaccesible** cuando Porsche rechaza la cuenta o espera un captcha, y muestra un punto naranja mientras Porsche limita las solicitudes: las lecturas se espacian entonces.

## Solución de problemas

- **Correo o contraseña incorrectos**: compruébelos primero en la app My Porsche y vuelva a guardar los ajustes.
- **Captcha**: abra el panel con el widget Porsche y escriba el código. Un código erróneo muestra una nueva imagen; un captcha de más de 10 minutos se sustituye.
- **Cuenta bloqueada**: Porsche bloquea una cuenta tras demasiados inicios de sesión. Desbloquéela en la app My Porsche o en el sitio Porsche ID y guarde los ajustes.
- **Valores de hace unos minutos**: el coche envía sus datos al aparcar, durante la carga y tras una orden. Un intervalo más corto no le hace enviar más.
- **Falta un valor o una orden**: no todos los coches envían todo, y el modo privado del coche oculta la mayoría de los valores. Haga clic en **Diagnóstico** y copie las líneas de la pestaña Registros en una issue de GitHub: contienen lo que el coche envía, sin VIN ni posición.
- **Apertura rechazada**: indique el PIN de 4 cifras de la app My Porsche.
