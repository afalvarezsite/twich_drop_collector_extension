# Twitch Drops Collector (TDC)

[![License](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge&logo=gnu&logoColor=white)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-purple?style=for-the-badge&logo=googlechrome&logoColor=white)](#)
[![Twitch](https://img.shields.io/badge/Twitch-Drops-9146FF?style=for-the-badge&logo=twitch&logoColor=white)](https://www.twitch.tv)
[![Platform](https://img.shields.io/badge/Platform-Chromium-informational?style=for-the-badge&logo=google-chrome&logoColor=white)](#)
[![Version](https://img.shields.io/badge/Version-1.0.0-blueviolet?style=for-the-badge)](#)

Extension de navegador disenada para automatizar de manera inteligente la recoleccion de Twitch Drops y puntos de canal en segundo plano, optimizando el consumo de recursos de red y CPU.

---

## Descripcion General

Twitch Drops Collector (TDC) es una extension desarrollada bajo el estandar Manifest V3 para navegadores basados en Chromium (Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi, entre otros). 

La extension interactua con los servicios internos de Twitch para detectar campanas de drops activas asociadas a las cuentas de los usuarios, localizar transmisiones en directo validas que otorguen progreso, gestionar la reproduccion con optimizaciones de ancho de banda y reclamar recompensas de forma automatica en cuanto se completan.

---

## Caracteristicas Principales

- Recoleccion automatica de Drops: Monitoriza las campanas activas y reclama las recompensas tan pronto como alcanzan el 100% de progreso.
- Reclamacion de Puntos de Canal: Reclama automaticamente las bonificaciones periodicas de puntos de canal en las transmisiones activas.
- Seleccion y Priorizacion de Campanas: Permite ordenar las campanas por prioridad del 1 al N, asegurando que se recolecten primero los articulos de mayor interes.
- Deteccion de transmisiones estancadas: Identifica si un streamer cambia de categoria, finaliza su emision o no avanza en el progreso del drop, reasignando la reproduccion a otro canal elegible de forma automatica.
- Modo de bajo consumo de red: Ajusta automaticamente la calidad del stream a 160p para minimizar el consumo de ancho de banda y uso de memoria.
- Silenciado automatico de pestanas: Mantiene silenciadas las transmisiones abiertas por la extension para no interferir con las tareas del usuario.
- Indicador visual en pestanas: Modifica temporalmente el favicon de Twitch al logotipo amarillo de TDC en la pestana de reproduccion para una identificacion inmediata.
- Filtro de juegos vinculados: Opcion para mostrar unicamente los juegos asociados formalmente a la cuenta de Twitch del usuario.
- Panel de control completo: Interfaz oscura adaptada a la linea grafica de Twitch, con barra de progreso en tiempo real, contador de drops y puntos acumulados, y configuracion detallada.

---

## Estructura del Proyecto

```text
twich_drops_collector_extension/
|-- manifest.json                 # Configuracion y permisos de la extension (Manifest V3)
|-- background.js                 # Service Worker principal de segundo plano
|-- inject.js                     # Script de inyeccion en paginas de Twitch
|-- onPage.js                     # Logica ejecutada en el contexto de la pagina
|-- index.html                    # Interfaz de usuario del popup
|-- waiting.html                  # Ventana auxiliar de autenticacion y espera
|-- assets/
|   |-- css/
|   |   `-- main.css              # Estilos visuales de la interfaz de usuario
|   |-- img/
|   |   |-- atd-16.png            # Icono de la extension (16x16)
|   |   |-- atd-32.png            # Icono de la extension (32x32)
|   |   |-- atd-48.png            # Icono de la extension (48x48)
|   |   |-- atd-128.png           # Icono de la extension (128x128)
|   |   |-- atd-128-gray.png      # Icono inactivo para la interfaz
|   |   |-- twitch-logo-yellow-16.png
|   |   `-- twitch-logo-yellow-32.png
|   `-- js/
|       |-- i18n.js               # Internacionalizacion y cadenas de texto
|       |-- jquery.js             # Biblioteca auxiliar jQuery
|       `-- main.js               # Controlador de eventos del popup
|-- background/
|   |-- buffer.js                 # Manejo y serializacion de buferes de datos
|   `-- twitchApi.js              # Cliente de comunicacion con las APIs de Twitch
|-- .gitignore                    # Reglas de exclusion para el control de versiones
|-- LICENSE                       # Licencia publica GNU GPLv3
`-- README.md                     # Documentacion del repositorio
```

---

## Instalacion

Al tratarse de una extension de desarrollo, la instalacion se realiza en modo descomprimido:

1. Clona el repositorio en tu equipo local:
   ```bash
   git clone https://github.com/tu-usuario/twich_drops_collector_extension.git
   ```
2. Abre un navegador compatible con Chromium (Chrome, Brave, Edge).
3. Dirigete a la seccion de extensiones en la barra de direcciones:
   - Google Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
4. Activa la casilla **Modo de desarrollador** (Developer Mode) situada en la esquina superior derecha.
5. Haz clic en el boton **Cargar descomprimida** (Load unpacked).
6. Selecciona la carpeta raiz de este proyecto donde se encuentra el archivo `manifest.json`.
7. Fija la extension en la barra de herramientas para acceder rapidamente a su panel.

---

## Configuracion y Uso

1. Inicia sesion en [Twitch](https://www.twitch.tv) con tu cuenta en el navegador.
2. Abre la ventana emergente de la extension haciendo clic en su icono en la barra de herramientas.
3. Activa la extension mediante el interruptor general situado en la barra lateral.
4. Opciones disponibles en la pestana de Ajustes:
   - **Connected Games**: Limita la lista de seleccion a titulos que ya cuenten con conexion directa con tu perfil de Twitch.
   - **API Token**: Renueva automaticamente el token de autenticacion de Twitch en caso de expiracion.
   - **Mute Tabs**: Garantiza que las pestanas abiertas por la extension permanezcan silenciadas en todo momento.
   - **Lowest Quality**: Fuerza la reproduccion a 160p para reducir drasticamente la transferencia de datos y el impacto en el rendimiento del sistema.
   - **Notify Badge Drops**: Muestra avisos especificos cuando hay campanas de insignias disponibles con requisitos de suscripcion.
5. En la seccion **Auto Drops**, visualiza las campanas activas y personaliza su orden de prioridad segun tus preferencias.

---

## Permisos Requeridos

La extension solicita los siguientes permisos en el archivo `manifest.json`:

- `storage`: Necesario para almacenar localmente las preferencias de configuracion, la lista de prioridades de juegos y el estado de recoleccion.
- `tabs`: Requerido para abrir, silenciar, monitorear y cerrar las pestanas donde se reproducen las transmisiones con drops activos.
- `host_permissions (*://*.twitch.tv/*)`: Permite la comunicacion con los puntos de enlace de la API de Twitch y la interaccion con las paginas oficiales de transmision.

---

## Arquitectura Tecnica

- **Service Worker (`background.js`)**: Gestiona la logica central de decision, temporizadores de control, llamadas GraphQL a Twitch mediante `twitchApi.js` y persistencia en `chrome.storage`.
- **Content Scripts (`inject.js` y `onPage.js`)**: Interactuan con el DOM de la pagina de Twitch para silenciar el reproductor, aplicar la calidad minima y cambiar el favicon indicativo de la pestana.
- **Popup UI (`index.html`, `assets/css/main.css`, `assets/js/main.js`)**: Proporciona una interfaz visual reactiva con soporte multi-idioma (espanol e ingles) mediante `i18n.js`.

---

## Contribuciones

Las contribuciones que sigan las pautas de codigo limpio y estabilidad son bienvenidas. Para proponer cambios:

1. Crea una rama para tu funcion o correccion:
   ```bash
   git checkout -b feature/nombre-de-la-mejora
   ```
2. Realiza tus modificaciones asegurando la compatibilidad con Manifest V3.
3. Realiza un commit con un mensaje claro:
   ```bash
   git commit -m "Descripcion clara del cambio"
   ```
4. Sube la rama a tu fork y abre una solicitud de extraccion (Pull Request).

---

## Licencia

Este proyecto se distribuye bajo los terminos de la Licencia Publica General de GNU version 3 (GPLv3). Para mas detalles, consulta el archivo [LICENSE](LICENSE).
