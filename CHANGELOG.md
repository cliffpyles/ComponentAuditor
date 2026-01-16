# Changelog

All notable changes to the Component Auditor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-01-16

### Fixed

- **Panel Connection Issues**
  - Fixed "No port or tabId available" error when clicking "Select Component" button
  - Resolved issue where `panel.js` tried to access `window.devToolsPort` and `window.devToolsTabId` from parent window context
  - Updated `panel.js` to create its own connection to background script instead of relying on parent window variables
  - Panel now gets `tabId` directly from `chrome.devtools.inspectedWindow.tabId` API

- **Message Routing**
  - Fixed message routing from panel to content script by routing through background script instead of direct `chrome.tabs.sendMessage` calls
  - Updated `panel.js` to use port connection for sending `START_SELECTION` and `STOP_SELECTION` messages
  - Improved `background.js` to handle connection storage and replacement when multiple connections exist for same tabId
  - Added `findTabIdFromConnection()` helper function to reliably look up tabId from stored connections

- **Visual Selection Features**
  - Fixed cursor not changing to crosshair during selection mode
  - Implemented cursor style using injected `<style>` element with `!important` flag to override page styles
  - Added proper cleanup of cursor style element when selection mode is disabled
  - Improved overlay creation with better error handling and body existence checks
  - Enhanced overlay update logic to handle cases where overlay cannot be created

- **Message Handling**
  - Removed unnecessary `CONTENT_SCRIPT_ACK` message that was causing "Unknown message type" errors
  - Added better error handling and logging throughout message flow
  - Improved content script message handling with validation and debug logging
  - Enhanced background script message routing with better error messages

- **Connection Management**
  - Updated `storeConnection()` to replace existing connections instead of ignoring new ones
  - Fixed issue where new DevTools panel connections would be ignored if connection already existed for tabId
  - Improved connection cleanup and disconnection handling

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

#### Phase 1.3: The "Picker" (Visual Selection)

- **Content Script Implementation**

  - Created `src/content.js` to handle visual element selection on web pages
  - Implemented content script injection on all pages via manifest configuration
  - Added connection to background service worker for message routing
  - Implemented message handling for selection mode control (`START_SELECTION`, `STOP_SELECTION`)
  - Added cleanup handlers for page unload and DevTools disconnection

- **Visual Overlay System**

  - Created highlighter overlay element (absolute positioned `div` with z-index 999999)
  - Implemented overlay styling with blue border and semi-transparent background
  - Added overlay positioning logic using `getBoundingClientRect()` and scroll offsets
  - Implemented overlay show/hide functionality based on selection mode state

- **Hover Highlighting**

  - Added `mouseover` event listener to `document` with capture phase
  - Implemented real-time overlay position/size updates to match hovered elements
  - Added logic to prevent overlay from highlighting itself
  - Implemented cursor change to crosshair during selection mode

- **Element Selection Logic**

  - Added `click` event listener with capture phase for element selection
  - Implemented `preventDefault()` and `stopPropagation()` to block native site behavior
  - Added global reference storage: `window.__CA_LAST_ELEMENT__ = e.target`
  - Implemented element selection message (`ELEMENT_SELECTED`) sent to DevTools panel via background script
  - Added automatic selection mode disable after element selection

- **Panel UI Enhancements**

  - Updated `src/panel.html` with "Select Component" button and status message display
  - Added button styling with active state (red when selection mode is active)
  - Implemented `src/panel.js` to handle button click events
  - Added selection mode toggle functionality (start/stop)
  - Implemented status message updates to guide user during selection
  - Added element selection message handling to display selected element information

- **Background Script Updates**
  - Added message forwarding functions for content script communication
  - Implemented `forwardToContentScript()` function to route messages to content scripts
  - Added `getTabIdFromPort()` helper function to extract tab IDs from port connections
  - Enhanced message routing to handle `START_SELECTION` and `STOP_SELECTION` messages
  - Improved `ELEMENT_SELECTED` message forwarding to DevTools panel

### Fixed

- **Localization Configuration**
  - Added `default_locale: "en"` to `manifest.json` to resolve Chrome extension loading error
  - Created `_locales/en/messages.json` with basic English localization strings
  - Fixed "Localization used, but default_locale wasn't specified" error when loading the extension
