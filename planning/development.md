# Development Plan

**Primary Goal:** Build a robust Chrome Extension for creating high-fidelity UI datasets.

---

## Phase 1: Foundation & Connectivity

**Objective:** Establish the secure architecture required for DevTools extensions and create the "Select" experience.

### 1.1 Project Initialization

- [x] **Scaffold Structure:** Set up the directory structure (`src/`, `assets/`, `_locales/`).
- [x] **Manifest V3 Configuration:**
  - Define `manifest.json`.
  - Register `devtools_page`.
  - Declare permissions: `storage`, `activeTab`, `scripting`, `debugger`, `contextMenus`.
  - configure `host_permissions` for `<all_urls>`.

### 1.2 DevTools Integration

- [x] **Panel Entry Point:** Create `devtools.html` and `devtools.js` to initialize the `chrome.devtools.panels.create` API.
- [x] **The "Handshake":** Implement the connection logic in `background.js`.
  - Listen for `chrome.runtime.onConnect`.
  - Store open connections by `tabId`.
  - Handle `onDisconnect` to trigger cleanup (safety switch).

### 1.3 The "Picker" (Visual Selection)

- [x] **Content Script Injection:** Ensure `content.js` loads on all pages.
- [x] **Overlay UI:** Create the DOM element for the "Highlighter Box" (absolute positioned `div`, z-index 999999).
- [x] **Hover Logic:**
  - Add `mouseover` listener to `document`.
  - Calculate `target.getBoundingClientRect()`.
  - Update Overlay position/size to match target.
- [x] **Selection Logic:**
  - Add `click` listener.
  - `e.preventDefault()` and `e.stopPropagation()` to block native site behavior.
  - Save reference: `window.__CA_LAST_ELEMENT__ = e.target`.
  - Send message `ELEMENT_SELECTED` to DevTools panel.

---

## Phase 2: The Extraction Engine

**Objective:** Automate the capture of "Hard" technical data (Visuals, Code, Tokens).

### 2.1 Visual Capture

- [x] **Screenshot Pipeline:**
  - DevTools requests capture -> Background runs `chrome.tabs.captureVisibleTab`.
  - Send Base64 image back to Panel.
- [x] **Cropping Engine:**
  - Create an off-screen HTML5 `<canvas>`.
  - Load the Base64 image.
  - Draw only the slice defined by the element's `rect` (x, y, width, height).
  - Export cropped image as Base64 PNG.

### 2.2 Code & Hierarchy Extraction

- [x] **HTML Scraper:** Extract `element.outerHTML`.
- [x] **Lineage Traversal:**
  - Write a loop to walk up `element.parentElement`.
  - Capture tag names and classes for up to 3 ancestors.
- [x] **Sibling Analysis:**
  - Access `element.previousElementSibling` and `nextElementSibling`.
  - Capture their HTML/Tags to establish layout context.

### 2.3 Token Analysis (Computed Styles)

- [x] **Style Reader:** Use `window.getComputedStyle(element)`.
- [x] **Token Mapping:**
  - **Color:** Extract `color`, `background-color`, `border-color`.
  - **Type:** Extract `font-family`, `font-size`, `font-weight`, `line-height`.
  - **Spacing:** Extract `padding` (top/right/bottom/left) and `margin`.
  - **Effects:** Extract `box-shadow`, `border-radius`, `opacity`.

### 2.4 Context Awareness

- [x] **Framework Detection:**
  - Scan `window` for keys: `React`, `Vue`, `jQuery`, `webpack`.
  - Scan DOM for attributes: `data-reactroot`, `ng-version`.
- [x] **URL Parser:**
  - Parse `window.location`.
  - Separate `pathname` (Route) from `search` (Query Params).

---

## Phase 3: Semantic Analysis & Forensics

**Objective:** Generate the high-level "Intelligence" regarding composition and behavior.

### 3.1 Advanced Forensics

- [ ] **Debugger Integration:**
  - Request `chrome.debugger` attach to the tab.
  - Call `DOMDebugger.getEventListener` for the specific NodeID.
  - Map raw listeners to human terms (e.g., "click", "focus").
- [ ] **State Detection:**
  - Check boolean attributes: `disabled`, `checked`, `selected`.
  - Check ARIA states: `aria-expanded`, `aria-hidden`, `aria-pressed`.

### 3.2 Composition Algorithms

- [ ] **Inventory Script:**
  - Write a recursive DOM walker inside the selected element.
  - Count tags by category (e.g., `<button>`=Input, `<h1>`=Text, `<img>`=Media).
  - Generate "Atom Inventory" object.
- [ ] **Tree Builder:**
  - Generate a string representation of the DOM tree (e.g., `Card > Header + Body`).
- [ ] **Heuristic Guesser:**
  - Logic to auto-suggest "Atomic Level" (e.g., If depth > 2 and children > 5, suggest "Organism").

---

## Phase 4: Data Management & UI

**Objective:** Build the User Interface for verifying, labeling, and saving data.

### 4.1 The Editor Panel

- [x] **UI Layout:** Split view (Left: Screenshot/Code, Right: Form).
- [x] **Form Inputs:**
  - **Read-only:** Technical data (Size, Font, URL).
  - **Editable:** "Atomic Level", "Design Pattern" (Dropdown), "Interaction Pattern" (Dropdown), "Notes".
- [x] **Validation:** Ensure critical fields are not empty before save.

### 4.2 Storage Layer (IndexedDB)

- [ ] **Database Wrapper (`db.js`):**
  - `openDB()`: Version management and schema creation.
  - `save(data)`: Put record with UUID key.
  - `getAll()`: Retrieve generic list for library view.
  - `delete(id)`: Remove record.

### 4.3 Library & Export

- [ ] **Library View:**
  - Grid layout of saved components (Thumbnail + Name).
  - "Delete" button per item.
- [ ] **Export Engine:**
  - Fetch all records from DB.
  - Wrap in metadata (Dataset Version, Date).
  - Trigger JSON file download (`Blob` + `URL.createObjectURL`).

---

## Phase 5: Polish & Deployment

**Objective:** Refine the experience for stability and usability.

### 5.1 Quality Assurance

- [ ] **Iframe Handling:** Add error boundaries for Cross-Origin iframes (block selection or show warning).
- [ ] **Theme Support:** Detect `chrome.devtools.panels.themeName` and apply Dark/Light CSS variables.
- [ ] **Performance:** Ensure heavy screenshots don't freeze the DevTools UI (move logic to workers if needed).

### 5.2 Documentation & Packaging

- [ ] **Onboarding:** Add an "Empty State" to the library with instructions.
- [ ] **Code Cleanup:** Remove all `console.log` and debugging artifacts.
- [ ] **Zip & Ship:** Package the extension for distribution (Github Release or Web Store).
