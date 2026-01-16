# Changelog

All notable changes to the Component Auditor project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2026-01-16

### Added

#### Phase 4: UX/UI & Workflow Refinement

- **Visual Design System**

  - Implemented comprehensive CSS Variable system (`src/panel.css`)
  - Added support for Dark/Light mode based on system preferences
  - Standardized typography, colors, spacing, and shadows
  - Modernized UI components (buttons, forms, cards) with consistent styling

- **Enhanced Selection Overlay**

  - High-fidelity blue overlay with semi-transparent fill
  - Animated transitions for smooth visual feedback
  - Intelligent tooltip displaying:
    - Tag name
    - Class/ID
    - Dimensions (e.g., `div.card (400 × 200)`)
  - Improved Z-index management to ensure visibility over all page content
  - Added ESC key support to cancel selection mode

- **Workflow Improvements**

  - **Edit Existing Components:** Click library items to reload them into the editor
  - **Component Updates:** Saving an edited component now updates the existing record instead of creating a duplicate
  - **Cancel/Discard:** Added confirmation dialogs when discarding changes
  - **Toast Notifications:** Replaced static status messages with a floating toast system for success/error feedback

- **Panel UI Optimizations**
  - Refined Split View layout with better proportions
  - Improved form organization with grouped fields
  - Visual polish for "Read-only" technical data section
  - Smooth transitions between Empty State, Editor, and Library views

## [1.7.0] - 2026-01-16

### Added

#### Phase 4.3: Library & Export

- **Library View**

  - Implemented grid layout for displaying saved components in the DevTools panel
  - Each library item displays component thumbnail, name, atomic level, and timestamp
  - Responsive grid layout that adapts to panel size (auto-fill with minimum 200px columns)
  - Empty state message when no components are saved
  - View toggle buttons to switch between "Library" and "Capture" views
  - Library view automatically loads and displays all saved components on initialization
  - Library view refreshes automatically after saving a new component

- **Component Management**

  - Delete button on each library item (red × button in top-right corner)
  - Confirmation dialog before deleting components
  - Automatic library refresh after successful deletion
  - Error handling with user-friendly error messages for delete operations

- **Export Engine**

  - Export button in header (enabled only when components are saved)
  - Exports all saved components as a single JSON dataset file
  - Dataset includes metadata wrapper:
    - `version`: Dataset version (1.0)
    - `exportDate`: ISO 8601 timestamp of export
    - `componentCount`: Number of components in the dataset
    - `components`: Array of all component records
  - Automatic file download with descriptive filename: `component-auditor-dataset-YYYY-MM-DD.json`
  - Uses `Blob` and `URL.createObjectURL` for efficient file download
  - Success message displayed after successful export
  - All component data (screenshots, code, meta, semantics) included in export

- **UI Enhancements**
  - Added view toggle navigation between Library and Capture views
  - Export button styling matches DevTools design patterns
  - Library grid items with hover effects for better UX
  - Component thumbnails displayed at 150px height with proper aspect ratio
  - Clean, modern library interface matching existing panel design

## [1.6.0] - 2026-01-16

### Added

#### Phase 4.2: Storage Layer (IndexedDB)

- **Database Wrapper (`db.js`)**

  - Created IndexedDB database wrapper module for persistent component storage
  - Database name: `ComponentAuditorDB` with version management
  - Object store: `components` with UUID-based primary key
  - Indexes created for `label` and `timestamp` for future search and sorting capabilities

- **Database Functions**

  - **`openDB()`:** Initializes IndexedDB database with version management and schema creation
  - **`save(data)`:** Saves component records to IndexedDB with UUID key
  - **`getAll()`:** Retrieves all component records from the database
  - **`delete(id)`:** Removes a component record from the database by UUID

- **Panel Integration**

  - Integrated database wrapper into panel save functionality
  - Save button now persists component data to IndexedDB
  - Success message displayed after successful save
  - Error handling with user-friendly error messages
  - Automatic editor dismissal after successful save (1.5 second delay)
  - Database wrapper loaded before panel script in `panel.html`

- **Data Persistence**
  - Component data is now permanently stored in browser's IndexedDB
  - All captured data (screenshots, code, meta, semantics) is persisted
  - Data survives browser restarts and extension reloads
  - Base64 screenshot data stored efficiently in IndexedDB
  - Component records include UUID, label, meta, visuals, code, and semantics

## [1.5.0] - 2026-01-16

### Added

#### Phase 4.1: The Editor Panel

- **Split View UI Layout**

  - Implemented split-view editor interface with left and right panels
  - Left panel displays component screenshot and HTML code viewer
  - Right panel contains the component data form
  - Editor automatically appears after element selection and screenshot capture
  - Smooth transition between empty state and editor view

- **Form Inputs**

  - **Read-only Technical Data Section:**
    - Displays component size (width × height in pixels)
    - Shows font information (family and size) extracted from computed styles
    - Displays current page URL (domain + route)
    - Read-only fields are visually distinct with gray background
  - **Editable Semantic Fields:**
    - **Atomic Level:** Required dropdown with options (Atom, Molecule, Organism, Template, Page)
    - **Design Pattern:** Optional dropdown with common patterns (Card, Master-Detail, List, Grid, Form, Modal, Navigation, Header, Footer, Sidebar, Breadcrumb, Pagination, Other)
    - **Interaction Pattern:** Optional dropdown with interaction types (Click, Hover, Hover Reveal, Drag-and-Drop, Infinite Scroll, Modal Workflow, Form Submission, Toggle, Expand/Collapse, Other)
    - **Notes:** Optional textarea for additional component annotations

- **Form Validation**

  - Implemented validation for required fields (Atomic Level)
  - Real-time field validation with visual feedback (red border for invalid fields)
  - Error messages displayed below invalid fields
  - Save button is disabled until all required fields are valid
  - Form validation prevents saving incomplete component data

- **Editor Functionality**

  - Automatic form population with extracted component data
  - Screenshot display in left panel with proper scaling
  - HTML code viewer with truncation for very long HTML (5000+ characters)
  - Cancel button to return to empty state and discard changes
  - Save button prepares component data object (save to IndexedDB will be implemented in Phase 4.2)
  - Component data object includes all captured dimensions, code, meta, and semantic information

- **UI Enhancements**
  - Modern, clean interface matching DevTools design patterns
  - Responsive layout that adapts to panel size
  - Scrollable sections for long content
  - Visual separation between sections with borders
  - Consistent styling with existing panel design

## [1.4.1] - 2026-01-16

### Fixed

- **Framework Detection Improvements**
  - Fixed false positive Angular detection that was incorrectly identifying React apps as Angular
  - Removed generic element selectors (`app-root`, `ng-component`) from Angular detection that were too broad
  - Made Angular detection conditional - only runs if React is not already detected to prevent false positives
  - Improved React detection to be more reliable:
    - Enhanced React DevTools hook detection to catch cases where hook exists but renderers aren't populated
    - Improved DOM pattern detection for React-specific data attributes (`data-reactroot`, `data-react-helmet`, `data-react-class`)
    - Added checks for React-specific patterns like `data-testid` and React class patterns
    - Better root element detection with pattern verification
  - Fixed Angular detection bug where `window.ng.probe` could throw an error if `window.ng` was undefined
  - Added comprehensive debugging logs to help diagnose framework detection issues

### Changed

- **Framework Detection Logic**
  - React detection now takes priority over Angular detection to avoid conflicts
  - Angular detection now only uses reliable indicators: `ng-version` attribute and verified `ng-app` patterns
  - Improved Vue detection to check for `data-v-*` scoped style attributes more thoroughly
  - Enhanced Tailwind detection with better pattern matching and performance optimizations

## [1.4.0] - 2026-01-16

### Added

#### Phase 2.4: Context Awareness

- **Framework Detection**

  - Implemented `detectFrameworks()` function in content script to automatically detect frameworks and libraries used on the page
  - Scans `window` object for framework indicators: `React`, `Vue`, `Angular`, `jQuery`, and `webpack`
  - Scans DOM for framework-specific attributes: `data-reactroot`, `ng-version`, `data-v-`, `v-cloak`
  - Detects CSS frameworks by class patterns: `Bootstrap`, `Tailwind`, and `Material-UI`
  - Framework detection results are included in the `ELEMENT_SELECTED` message payload

- **URL Parser**

  - Implemented `parseURL()` function in content script to parse the current page URL
  - Separates `pathname` (Route) from `search` (Query Params) using `URLSearchParams` API
  - Extracts domain name from `window.location.hostname`
  - Includes ISO 8601 timestamp for each capture
  - URL data is included in the `meta` object of the `ELEMENT_SELECTED` message

- **Data Integration**
  - Context awareness data is included in the `meta` object alongside element, rect, and code data
  - Meta data includes: `frameworks` (array), `route` (string), `queryParams` (object), `domain` (string), and `timestamp` (ISO string)
  - Panel script stores meta data in `window.__CA_EXTRACTED_META__` for Phase 4 editor integration
  - Status messages now display framework count when frameworks are detected
  - All context data is automatically captured when an element is selected

## [1.3.0] - 2026-01-16

### Added

#### Phase 2.3: Token Analysis (Computed Styles)

- **Style Reader**

  - Implemented `extractTokens()` function in content script to extract computed styles using `window.getComputedStyle(element)`
  - Token extraction is performed automatically when an element is selected
  - Extracted tokens are included in the `ELEMENT_SELECTED` message payload

- **Token Mapping**

  - **Color Tokens:** Extracts `color`, `background-color`, and `border-color` from computed styles
    - Filters out transparent and zero-alpha colors
    - Stores color values with their type (color, background-color, border-color)
  - **Typography Tokens:** Extracts `font-family`, `font-size`, `font-weight`, and `line-height`
    - Filters out "normal" line-height values
    - Stores typography values with their type for easy identification
  - **Spacing Tokens:** Extracts padding and margin values for all four sides (top, right, bottom, left)
    - Provides complete spacing context for layout analysis
    - Defaults to "0px" if values are not set
  - **Border Tokens:** Extracts `border-radius`, `border-width`, and `border-style`
    - Only includes border-radius and border-width if they are non-zero
    - Includes border-style when not "none"
  - **Effects Tokens:** Extracts `box-shadow` and `opacity`
    - Stores box-shadow values as an array (supports multiple shadows)
    - Only includes opacity if it differs from 1

- **Data Integration**
  - Token data is included in the `code` object alongside HTML, lineage, and siblings
  - Panel script stores token data in `window.__CA_EXTRACTED_CODE__` for Phase 4 editor integration
  - Status messages now indicate when tokens have been extracted
  - Token extraction handles errors gracefully with try-catch blocks

## [1.2.0] - 2026-01-16

### Added

#### Phase 2.2: Code & Hierarchy Extraction

- **HTML Scraper**

  - Implemented `extractHTML()` function in content script to extract `element.outerHTML`
  - HTML is captured at the moment of element selection and included in `ELEMENT_SELECTED` message
  - Extracted HTML is stored in `window.__CA_EXTRACTED_CODE__` for use in Phase 4 editor interface

- **Lineage Traversal**

  - Implemented `extractLineage()` function to walk up the DOM tree via `element.parentElement`
  - Captures up to 3 levels of parent ancestors
  - Each ancestor includes `tagName`, `className`, and `id` for context
  - Lineage data is included in the code extraction payload

- **Sibling Analysis**

  - Implemented `extractSiblings()` function to capture adjacent elements
  - Extracts `previousElementSibling` and `nextElementSibling` when available
  - Each sibling includes `tagName`, `className`, `id`, and full `outerHTML`
  - Sibling data provides layout context for ML models and design analysis

- **Data Integration**
  - Updated `ELEMENT_SELECTED` message to include `code` object with HTML, lineage, and siblings
  - Panel script now stores extracted code data alongside screenshot
  - Status messages display extraction summary (HTML, ancestor count, sibling presence)
  - All extracted data is stored in global variables for Phase 4 editor integration

## [1.1.1] - 2026-01-16

### Fixed

- **Connection Management Issues**

  - Fixed critical bug where DevTools panel and content script connections were overwriting each other
  - Refactored background script to use separate connection maps: `panelConnections` and `contentConnections`
  - DevTools panel and content script can now maintain simultaneous connections for the same tab
  - Fixed issue where panel connection was lost when content script reconnected

- **Message Routing**

  - Fixed `ELEMENT_SELECTED` messages not being forwarded to DevTools panel
  - Added proper tabId extraction from message payload, port sender, and connection map
  - Improved message routing logic to prioritize tabId from message payload
  - Added fallback message handling via `chrome.runtime.onMessage` for content scripts
  - Content script now includes tabId in `ELEMENT_SELECTED` messages for reliable routing

- **Port Disconnection Handling**

  - Improved content script port reconnection logic when connection is lost
  - Added fallback to `chrome.runtime.sendMessage` when port is null or disconnected
  - Better error logging and handling for message delivery failures
  - Content script now stores tabId from `DEVTOOLS_ACTIVE` message for later use

- **Message Handler Cleanup**
  - Fixed "Unknown message type DEVTOOLS_CONNECTED" warning
  - Initial connection messages (`DEVTOOLS_CONNECTED`, `CONTENT_SCRIPT_READY`) now handled separately
  - Improved message type handling and routing logic

## [1.1.0] - 2026-01-16

### Added

#### Phase 2.1: Visual Capture

- **Screenshot Pipeline**

  - Implemented screenshot capture functionality in background service worker
  - Added `CAPTURE_SCREENSHOT` message type for requesting screenshots from DevTools panel
  - Background script uses `chrome.tabs.captureVisibleTab` API to capture full-page screenshots
  - Screenshots are captured as PNG format and sent back to panel as Base64 data URLs
  - Added error handling for screenshot capture failures with `SCREENSHOT_ERROR` message type

- **Cropping Engine**

  - Implemented HTML5 Canvas-based cropping functionality in panel script
  - Created `cropScreenshot()` function that crops full-page screenshots to element bounds
  - Handles device pixel ratio scaling for high-DPI displays
  - Crops screenshots using element's viewport-relative coordinates (`viewportX`, `viewportY`)
  - Exports cropped images as Base64 PNG data URLs
  - Stores cropped screenshots in `window.__CA_CROPPED_SCREENSHOT__` for future use in editor UI

- **Element Selection Enhancements**

  - Updated content script to include element bounding rectangle in `ELEMENT_SELECTED` messages
  - Element rect includes both page-relative (`x`, `y`) and viewport-relative (`viewportX`, `viewportY`) coordinates
  - Added automatic screenshot capture trigger when element is selected
  - Panel now automatically requests screenshot after element selection
  - Added status message updates during screenshot capture and cropping process

- **Message Flow**
  - Panel requests screenshot via `CAPTURE_SCREENSHOT` message to background script
  - Background script captures screenshot and responds with `SCREENSHOT_CAPTURED` message
  - Panel receives screenshot and automatically crops it to element bounds
  - Cropped screenshot is stored for use in Phase 4 editor interface

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
  - Declared required permissions: `storage`, `activeTab`, `scripting`, `debugger`, `contextMenus`
  - Configured `host_permissions` for `<all_urls>`
  - Set up `background` service worker pointing to `src/background.js`
  - Configured `content_scripts` to inject `src/content.js` on all URLs at document idle

- **DevTools Integration Setup**
  - Created `devtools.html` entry point for DevTools panel initialization
  - Set up basic HTML structure with reference to `src/devtools.js`

#### Phase 1.2: DevTools Integration

- **Panel Entry Point**

  - Created `src/devtools.js` to initialize the DevTools panel using `chrome.devtools.panels.create` API
  - Implemented panel creation with title "Component Auditor"
  - Set up panel visibility handlers (`onShown` and `onHidden` events)
  - Created `src/panel.html` as the panel UI entry point
  - Created `src/panel.js` for panel UI script initialization

- **Connection Handshake**
  - Implemented `src/background.js` service worker as communication bridge
  - Added `chrome.runtime.onConnect` listener to handle connections from DevTools panel and content scripts
  - Implemented connection storage by `tabId` using a `Map` data structure
  - Added message routing system to handle different message types: `DEVTOOLS_CONNECTED`, `PANEL_SHOWN`, `PANEL_HIDDEN`, `ELEMENT_SELECTED`, `CONTENT_SCRIPT_READY`
  - Implemented `onDisconnect` handler to trigger cleanup when DevTools closes
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
