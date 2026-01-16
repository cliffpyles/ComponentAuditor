# Development Roadmap

## Phase 1: The Skeleton & Connectivity

**Goal:** Establish the DevTools panel, the background connection, and the visual picker.

- [ ] **Project Setup:** Initialize Manifest V3, file structure, and icons.
- [ ] **DevTools Integration:** Create `devtools_page` and the main `panel.html` shell.
- [ ] **Lifecycle Management:** Implement `background.js` port connection to handle DevTools Open/Close states.
- [ ] **The Picker UI:** Implement the `mouseover` highlighter (overlay box) in `content.js`.
- [ ] **Selection Logic:** freeze `elementID` on click and pass reference to the Panel.
- [ ] **Toggle Logic:** Ensure picker deactivates when DevTools is closed or user toggles off.

## Phase 2: The Forensic Extraction Engine

**Goal:** Automate the capture of all "Hard" technical data (Visuals, Code, Tokens).

### A. Visuals & Code

- [ ] **Screenshot Pipeline:** Implement `captureVisibleTab` + Canvas cropping to element coordinates.
- [ ] **HTML Extraction:** Capture `outerHTML` of selected element.
- [ ] **Lineage Extraction:** Traverse `parentNode` up to 3 levels to capture container hierarchy.
- [ ] **Sibling Extraction:** Capture `outerHTML` of adjacent sibling elements (context).
- [ ] **Framework Detection:** Scan `window` and DOM attributes for React, Vue, Angular, Tailwind, etc.

### B. Token Analysis

- [ ] **Computed Styles:** Extract specific values: Color, Font-Family, Size, Weight, Line-Height.
- [ ] **Advanced CSS:** Extract `box-shadow` and `border-radius`.
- [ ] **Spacing:** Extract computed `padding` and `margin` values.

### C. Contextual Data

- [ ] **URL Parser:** Logic to split `window.location.href` into `Route` (path) and `Query Params` (object).
- [ ] **State Detection:** Check element for pseudo-classes or attributes indicating state (e.g., `aria-expanded`, `disabled`, `.active`).

## Phase 3: The Semantic Analyzer

**Goal:** Algorithms to generate the "Composition" and "Inventory" data.

- [ ] **Atom Inventory Script:** Recursive function to count child tags (e.g., "Contains: 2 buttons, 1 img, 3 spans").
- [ ] **Composition Builder:** Logic to generate the readable tree string (e.g., "Card > Header + Body").
- [ ] **Event Listener Extraction:** Integrate `chrome.debugger` API to list attached events (click, hover, scroll).
- [ ] **Heuristic Guesser:** Simple logic to suggest "Atomic Level" based on depth (Deep nesting = Organism; Shallow = Atom).

## Phase 4: The Editor & Library UI

**Goal:** The user interface for manual tagging and data persistence.

### A. The Editor Form

- [ ] **Manual Input Fields:** Build inputs for "Industry," "Brand," "Design Pattern," and "Interaction Pattern."
- [ ] **Smart Dropdowns:** Pre-fill "Atomic Level" and "State" based on the Phase 3 heuristics, but allow user override.
- [ ] **Preview Card:** Show the cropped screenshot and code snippet side-by-side.

### B. Storage & Management

- [ ] **IndexedDB Layer:** Finalize `db.js` for saving the massive JSON payload.
- [ ] **Library Grid:** View saved components with thumbnail and label.
- [ ] **Export/Import:** Implement JSON file generation including the Base64 images.

## Phase 5: Polish & release

- [ ] **Error Handling:** Graceful failure for Cross-Origin iframes or Shadow DOM.
- [ ] **Theme Sync:** Match DevTools Dark/Light theme.
- [ ] **Code Cleanup:** Remove console logs and minify scripts.
