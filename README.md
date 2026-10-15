# Twitch Drops Collector (TDC)

[![License](https://img.shields.io/badge/License-GPLv3-blue?style=for-the-badge&logo=gnu&logoColor=white)](LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-V3-purple?style=for-the-badge&logo=googlechrome&logoColor=white)](#)
[![Twitch](https://img.shields.io/badge/Twitch-Drops-9146FF?style=for-the-badge&logo=twitch&logoColor=white)](https://www.twitch.tv)
[![Platform](https://img.shields.io/badge/Platform-Chromium-informational?style=for-the-badge&logo=google-chrome&logoColor=white)](#)
[![Version](https://img.shields.io/badge/Version-1.0.0-blueviolet?style=for-the-badge)](#)

**English** | [Espanol](README.es.md)

---

Browser extension engineered to intelligently automate Twitch Drops and channel points collection in the background, minimizing network bandwidth and CPU usage.

---

## Overview

Twitch Drops Collector (TDC) is a browser extension developed under the Manifest V3 standard for Chromium-based browsers (Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi, and others).

The extension interacts directly with Twitch GraphQL endpoints to detect active drop campaigns associated with the user's account, locate eligible live streams that award progress, manage stream playback with resource-saving optimizations, and automatically claim earned rewards as soon as progress finishes.

---

## Key Features

- Automated Drop Collection: Monitors active campaigns continuously and claims rewards the moment they reach 100% progress.
- Channel Points Claiming: Automatically detects and collects periodic channel point bonuses across watched streams.
- Campaign Prioritization: Allows users to rank campaigns from priority 1 to N, guaranteeing that preferred drops are targeted first.
- Stagnant Stream Detection: Detects when a streamer ends their broadcast, changes categories, or halts drop progression, and immediately switches to another eligible streamer.
- Low Bandwidth Mode: Automatically forces streams to 160p to minimize network transfer, CPU overhead, and memory consumption.
- Automatic Tab Muting: Keeps tabs opened by the extension muted so background farming does not interrupt user audio.
- Tab Visual Indicator: Temporarily overrides the Twitch page favicon with the yellow TDC logo on active farming tabs for quick identification.
- Connected Games Filter: Optional setting to restrict game discovery strictly to titles officially linked to the user's Twitch profile.
- Comprehensive Dashboard: Dark-mode popup aligned with Twitch design guidelines, providing live progress feedback, total claimed drops and points counters, and granular settings.

---

## Project Structure

```text
twich_drops_collector_extension/
|-- manifest.json                 # Extension configuration and permissions (Manifest V3)
|-- background.js                 # Primary background Service Worker
|-- inject.js                     # Content script injected into Twitch pages
|-- onPage.js                     # In-page context DOM script
|-- index.html                    # Popup user interface
|-- waiting.html                  # Auxiliary authentication window
|-- assets/
|   |-- css/
|   |   `-- main.css              # User interface stylesheets
|   |-- img/
|   |   |-- atd-16.png            # Extension icon (16x16)
|   |   |-- atd-32.png            # Extension icon (32x32)
|   |   |-- atd-48.png            # Extension icon (48x48)
|   |   |-- atd-128.png           # Extension icon (128x128)
|   |   |-- atd-128-gray.png      # Idle drop placeholder icon
|   |   |-- twitch-logo-yellow-16.png
|   |   `-- twitch-logo-yellow-32.png
|   `-- js/
|       |-- i18n.js               # Localization strings (EN/ES)
|       |-- jquery.js             # jQuery library
|       `-- main.js               # Popup event handler and controller
|-- background/
|   |-- buffer.js                 # Data buffer serialization helpers
|   `-- twitchApi.js              # Twitch GraphQL API client
|-- .gitignore                    # Version control ignore definitions
|-- LICENSE                       # GNU General Public License v3.0
|-- README.md                     # Primary English documentation
`-- README.es.md                  # Spanish documentation
```

---

## Installation

As this is a development extension, it is installed in unpacked mode:

1. Clone the repository to your local system:
   ```bash
   git clone https://github.com/your-username/twich_drops_collector_extension.git
   ```
2. Open a Chromium-compatible web browser (Google Chrome, Brave, Microsoft Edge).
3. Navigate to the extensions manager in the address bar:
   - Google Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
4. Toggle on **Developer mode** in the upper right corner.
5. Click the **Load unpacked** button.
6. Select the root folder of this project containing the `manifest.json` file.
7. Pin the extension to your toolbar for quick access.

---

## Configuration and Usage

1. Log in to your account on [Twitch](https://www.twitch.tv) in the browser.
2. Click the extension icon in your browser toolbar to open the control panel.
3. Turn on the extension using the master switch located in the sidebar.
4. Available Settings:
   - **Connected Games**: Restricts the game dropdown exclusively to games linked to your Twitch account.
   - **API Token**: Automatically regenerates the Twitch authorization token when the current token expires.
   - **Mute Tabs**: Ensures that tabs opened by the extension remain completely muted.
   - **Lowest Quality**: Automatically locks playback to 160p to drastically reduce network load and system resources.
   - **Notify Badge Drops**: Displays alerts when subscriber-badge drop campaigns are detected.
5. In the **Auto Drops** tab, inspect all available drop campaigns and reorder their priority numbers as needed.

---

## Required Permissions

The extension requests the following permissions declared in `manifest.json`:

- `storage`: Required to store configuration parameters, game priority queues, and collection statistics locally.
- `tabs`: Required to open, mute, monitor, and close the stream tabs used for drop progression.
- `host_permissions (*://*.twitch.tv/*)`: Permits network requests to Twitch GraphQL APIs and script injection into Twitch domains.

---

## Technical Architecture

- **Service Worker (`background.js`)**: Executes core scheduling, manages Twitch GraphQL requests via `twitchApi.js`, detects streamer state changes, and persists status to `chrome.storage`.
- **Content Scripts (`inject.js` and `onPage.js`)**: Modifies the DOM of active Twitch streams to enforce mute states, trigger lowest resolution settings, and update tab favicons.
- **Popup UI (`index.html`, `assets/css/main.css`, `assets/js/main.js`)**: Delivers an interactive interface featuring localization via `i18n.js`.

---

## Contributing

Contributions that adhere to clean code practices and Manifest V3 compatibility are welcome:

1. Create a branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-improvement
   ```
2. Implement your changes maintaining clean separation of concerns.
3. Commit your changes with a clear descriptive message:
   ```bash
   git commit -m "Describe your changes clearly"
   ```
4. Push to your fork and submit a Pull Request.

---

## License

This project is licensed under the GNU General Public License v3.0. Refer to the [LICENSE](LICENSE) file for complete terms.
