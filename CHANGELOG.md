# Changelog

All notable changes to the Component Auditor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-16

### Added

#### Phase 1.1: Project Initialization

- **Project Structure**

  - Created `src/` directory for source code
  - Created `assets/` directory for static assets
  - Created `_locales/` directory for internationalization files

- **Manifest V3 Configuration**

  - Created `manifest.json` with Manifest V3 specification
  - Configured `devtools_page` to point to `devtools.html`
  - Declared required permissions:
    - `storage` - For IndexedDB and local storage access
    - `activeTab` - For accessing the current tab
    - `scripting` - For content script injection
    - `debugger` - For Chrome Debugger API access
    - `contextMenus` - For context menu integration
  - Configured `host_permissions` for `<all_urls>` to allow extension to work on all websites
  - Set up `background` service worker pointing to `src/background.js`
  - Configured `content_scripts` to inject `src/content.js` on all URLs at document idle

- **DevTools Integration Setup**
  - Created `devtools.html` entry point for DevTools panel initialization
  - Set up basic HTML structure with reference to `src/devtools.js`

#### Phase 1.2: DevTools Integration

- **Panel Entry Point**

  - Created `src/devtools.js` to initialize the DevTools panel using `chrome.devtools.panels.create` API
  - Implemented panel creation with title "Component Lab"
  - Set up panel visibility handlers (`onShown` and `onHidden` events)
  - Created `src/panel.html` as the panel UI entry point
  - Created `src/panel.js` for panel UI script initialization

- **Connection Handshake**
  - Implemented `src/background.js` service worker as communication bridge
  - Added `chrome.runtime.onConnect` listener to handle connections from DevTools panel and content scripts
  - Implemented connection storage by `tabId` using a `Map` data structure
  - Added message routing system to handle different message types:
    - `DEVTOOLS_CONNECTED` - Initial connection from DevTools panel
    - `PANEL_SHOWN` - Panel visibility state changes
    - `PANEL_HIDDEN` - Panel visibility state changes
    - `ELEMENT_SELECTED` - Element selection events (for future use)
    - `CONTENT_SCRIPT_READY` - Content script initialization
  - Implemented `onDisconnect` handler to trigger cleanup when DevTools closes (safety switch)
  - Added message forwarding from content scripts to DevTools panel
  - Implemented cleanup notifications to content scripts when DevTools panel disconnects
