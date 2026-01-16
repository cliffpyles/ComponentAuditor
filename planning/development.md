# Development Plan

**Primary Goal:** Build a robust Chrome Extension for creating high-fidelity UI datasets with a world-class user experience, prioritizing stability and usability before advanced features.

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

## Phase 3: Data Management & UI

**Objective:** Build the User Interface for verifying, labeling, and saving data.

### 3.1 The Editor Panel

- [x] **UI Layout:** Split view (Left: Screenshot/Code, Right: Form).
- [x] **Form Inputs:**
  - **Read-only:** Technical data (Size, Font, URL).
  - **Editable:** "Atomic Level", "Design Pattern" (Dropdown), "Interaction Pattern" (Dropdown), "Notes".
- [x] **Validation:** Ensure critical fields are not empty before save.

### 3.2 Storage Layer (IndexedDB)

- [x] **Database Wrapper (`db.js`):**
  - `openDB()`: Version management and schema creation.
  - `save(data)`: Put record with UUID key.
  - `getAll()`: Retrieve generic list for library view.
  - `delete(id)`: Remove record.

### 3.3 Library & Export

- [x] **Library View:**
  - Grid layout of saved components (Thumbnail + Name).
  - "Delete" button per item.
- [x] **Export Engine:**
  - Fetch all records from DB.
  - Wrap in metadata (Dataset Version, Date).
  - Trigger JSON file download (`Blob` + `URL.createObjectURL`).

---

## Phase 4: UX/UI & Workflow Refinement

**Objective:** Elevate the "Labeling" and "Analysis" workflows to a higher standard through polished visual design, intuitive interactions, and seamless user flows.

### 4.1 Visual Design System

- [ ] **Design Tokens:**
  - Establish consistent typography scale (font families, sizes, weights, line-heights).
  - Define color palette with semantic naming (primary, secondary, success, error, neutral).
  - Create spacing scale (consistent padding, margins, gaps).
  - Define border radius and shadow tokens for depth.
- [ ] **Theme Integration:**
  - Detect `chrome.devtools.panels.themeName` to support Dark/Light modes.
  - Apply CSS variables that adapt to DevTools theme.
  - Ensure sufficient contrast ratios for accessibility.
- [ ] **Component Styling:**
  - Style all form inputs (text fields, dropdowns, buttons) with consistent visual language.
  - Create reusable UI components (cards, badges, tooltips).
  - Ensure responsive behavior at various DevTools panel sizes.

### 4.2 Overlay Experience Enhancement

- [ ] **Visual Feedback:**
  - Add smooth animations when overlay appears/disappears.
  - Implement hover state with clear visual indication (border, glow, or highlight).
  - Add cursor change to indicate selection mode is active.
  - Display element tag name and class names in overlay tooltip.
- [ ] **Z-Index Management:**
  - Ensure overlay appears above all page content (including modals, dropdowns).
  - Handle edge cases with fixed/sticky positioned elements.
  - Add visual indicator when element is partially obscured.
- [ ] **Selection Clarity:**
  - Add visual confirmation when element is clicked (brief animation or checkmark).
  - Display element dimensions and position information.
  - Show breadcrumb path of element hierarchy.

### 4.3 Interaction Design & Feedback

- [ ] **Loading States:**
  - Add loading spinner during screenshot capture and processing.
  - Show progress indicator for data extraction steps.
  - Display skeleton screens while data loads in Library view.
- [ ] **Success States:**
  - Implement toast notifications for successful captures and saves.
  - Add visual confirmation when component is saved to library.
  - Show success animation on export completion.
- [ ] **Error States:**
  - Display user-friendly error messages for failed operations.
  - Add retry mechanisms for transient failures.
  - Show clear guidance when capture fails (e.g., cross-origin restrictions).
- [ ] **Transitions:**
  - Smooth transitions between "Select Component" mode and "Edit" view.
  - Animate panel state changes (expanding/collapsing sections).
  - Add fade-in animations for Library grid items.

### 4.4 Panel Layout Optimization

- [ ] **Split View Refinement:**
  - Optimize left/right panel ratios for different screen sizes.
  - Add resizable splitter for user customization.
  - Ensure screenshot and code preview are clearly visible.
  - Add zoom controls for screenshot inspection.
- [ ] **Form Layout:**
  - Organize form fields into logical groups with clear labels.
  - Add field descriptions/help text for complex inputs.
  - Implement proper form spacing and visual hierarchy.
  - Ensure form is scannable and easy to complete.
- [ ] **Information Architecture:**
  - Organize technical data (read-only) in collapsible sections.
  - Group related metadata fields together.
  - Add visual separation between different data categories.
  - Ensure critical editable fields are prominently displayed.

### 4.5 Workflow Improvements

- [ ] **Capture Workflow:**
  - Add "Cancel" button to exit selection mode at any time.
  - Implement keyboard shortcuts (Esc to cancel, Enter to confirm).
  - Add quick actions after capture (Save, Edit, Discard).
  - Show preview of captured data before saving.
- [ ] **Edit Workflow:**
  - Add "Back" navigation to return to Library without saving.
  - Implement auto-save draft functionality.
  - Add "Save & Capture Another" action for batch workflows.
  - Show unsaved changes indicator.
- [ ] **Library Workflow:**
  - Add "View Details" action to see full component data.
  - Implement "Edit" action to modify saved components.
  - Add bulk actions (select multiple, delete selected).
  - Show component metadata in Library cards (domain, date, route).

---

## Phase 5: Stability & Feature Completeness

**Objective:** Ensure existing features are robust, handle edge cases gracefully, and provide comprehensive functionality for the "Analysis" workflow.

### 5.1 Library Management Enhancement

- [ ] **Search Functionality:**
  - Add search bar to filter components by label, domain, or route.
  - Implement real-time search with debouncing.
  - Highlight matching text in search results.
  - Add search history or recent searches.
- [ ] **Filtering System:**
  - Filter by domain (dropdown or multi-select).
  - Filter by date range (date picker).
  - Filter by Atomic Level (Atom, Molecule, Organism, Template/Page).
  - Filter by Design Pattern or Interaction Pattern.
  - Combine multiple filters with AND/OR logic.
- [ ] **Sorting Options:**
  - Sort by date (newest/oldest first).
  - Sort by label (alphabetical).
  - Sort by domain.
  - Sort by Atomic Level.
  - Persist sort preference in storage.
- [ ] **Library View Improvements:**
  - Add view toggle (grid/list view).
  - Implement pagination or virtual scrolling for large datasets.
  - Show component count and active filters.
  - Add "Clear Filters" action.

### 5.2 Robust Capture Handling

- [ ] **Cross-Origin Scenarios:**
  - Detect and handle cross-origin iframes (show warning, block selection).
  - Handle CORS restrictions for images in screenshots.
  - Gracefully handle cross-origin content in HTML extraction.
  - Add user notification when capture is limited by security policies.
- [ ] **Dynamic Content:**
  - Handle elements that change during capture (show warning if detected).
  - Capture element state at exact moment of click.
  - Handle elements that are removed from DOM after selection.
  - Add retry mechanism for transient failures.
- [ ] **Edge Cases:**
  - Handle elements with zero dimensions (hidden, collapsed).
  - Handle elements outside viewport (scroll to element first).
  - Handle sticky/fixed positioned elements correctly.
  - Handle elements with transforms or complex positioning.
  - Handle SVG elements and canvas elements.
- [ ] **Performance Optimization:**
  - Optimize screenshot capture for large elements.
  - Implement image compression for storage efficiency.
  - Add progress feedback for long-running operations.
  - Prevent UI freezing during heavy processing.

### 5.3 Data Validation & Schema Compliance

- [ ] **Schema Validation:**
  - Validate all captured data against the JSON schema from product spec.
  - Ensure required fields are always present (id, label, meta, visuals, code, semantics).
  - Validate data types (strings, numbers, objects, arrays).
  - Validate timestamp format (ISO 8601).
- [ ] **Data Completeness:**
  - Ensure all four dimensions of data are captured (Visual & Code, Environment, Behavior, Composition).
  - Validate token extraction completeness (colors, fonts, spacing, effects).
  - Ensure lineage and siblings data is properly structured.
  - Validate framework/library detection results.
- [ ] **Data Quality:**
  - Sanitize HTML to prevent XSS in exported JSON.
  - Validate and normalize color values (hex, rgb, rgba).
  - Ensure dimensions are positive numbers.
  - Validate URL parsing (route vs queryParams).

### 5.4 Error Handling & Resilience

- [ ] **Storage Limits:**
  - Detect IndexedDB quota exceeded errors.
  - Show user-friendly message with storage usage information.
  - Implement cleanup suggestions (delete old components).
  - Add export before cleanup option.
- [ ] **Capture Failures:**
  - Handle screenshot capture failures gracefully.
  - Handle DOM access failures (e.g., element removed).
  - Handle style computation failures.
  - Provide actionable error messages with recovery steps.
- [ ] **Connection Failures:**
  - Handle DevTools panel disconnection gracefully.
  - Reconnect automatically when possible.
  - Save draft state to prevent data loss.
  - Show connection status indicator.
- [ ] **Data Integrity:**
  - Add data migration for schema changes.
  - Validate data on load from IndexedDB.
  - Handle corrupted records gracefully.
  - Add data recovery mechanisms.

### 5.5 User Experience Polish

- [ ] **Empty States:**
  - Add informative empty state to Library with onboarding instructions.
  - Show helpful message when no search results found.
  - Add empty state for export (no components to export).
- [ ] **Accessibility:**
  - Ensure keyboard navigation works throughout the UI.
  - Add ARIA labels to all interactive elements.
  - Ensure screen reader compatibility.
  - Test with keyboard-only navigation.
- [ ] **Performance:**
  - Optimize Library rendering for large datasets.
  - Implement lazy loading for screenshots in Library view.
  - Add performance monitoring for slow operations.
  - Optimize bundle size and load times.

---

## Phase 6: Semantic Analysis & Forensics

**Objective:** Generate the high-level "Intelligence" regarding composition and behavior. _[Postponed until core features are stable]_

### 6.1 Advanced Forensics

- [ ] **Debugger Integration:**
  - Request `chrome.debugger` attach to the tab.
  - Call `DOMDebugger.getEventListener` for the specific NodeID.
  - Map raw listeners to human terms (e.g., "click", "focus").
- [ ] **State Detection:**
  - Check boolean attributes: `disabled`, `checked`, `selected`.
  - Check ARIA states: `aria-expanded`, `aria-hidden`, `aria-pressed`.
  - Detect CSS classes indicating state (e.g., `.is-active`, `.is-disabled`).

### 6.2 Composition Algorithms

- [ ] **Inventory Script:**
  - Write a recursive DOM walker inside the selected element.
  - Count tags by category (e.g., `<button>`=Input, `<h1>`=Text, `<img>`=Media).
  - Generate "Atom Inventory" object matching product spec schema.
- [ ] **Tree Builder:**
  - Generate a string representation of the DOM tree (e.g., `Card > Header + Body`).
  - Create hierarchical composition structure.
- [ ] **Heuristic Guesser:**
  - Logic to auto-suggest "Atomic Level" (e.g., If depth > 2 and children > 5, suggest "Organism").
  - Auto-detect common design patterns based on structure.
  - Suggest interaction patterns based on event listeners.

---

## Phase 7: Final Polish & Deployment

**Objective:** Refine the experience for stability and usability, prepare for distribution. _[Postponed until core features are stable]_

### 7.1 Quality Assurance

- [ ] **Iframe Handling:** Add error boundaries for Cross-Origin iframes (block selection or show warning).
- [ ] **Theme Support:** Ensure full Dark/Light mode compatibility (if not completed in Phase 4).
- [ ] **Performance:** Ensure heavy screenshots don't freeze the DevTools UI (move logic to workers if needed).
- [ ] **Cross-Browser Testing:** Test on different Chrome versions and Chromium-based browsers.
- [ ] **Edge Case Testing:** Comprehensive testing of all error scenarios and edge cases.

### 7.2 Documentation & Packaging

- [ ] **Onboarding:** Add comprehensive "Empty State" to the library with step-by-step instructions.
- [ ] **User Documentation:**
  - Create user guide for the "Labeling" workflow.
  - Document the "Analysis" workflow and export process.
  - Add tooltips and help text throughout the UI.
- [ ] **Code Cleanup:**
  - Remove all `console.log` and debugging artifacts.
  - Add code comments for complex logic.
  - Ensure consistent code style.
- [ ] **Packaging:**
  - Create production build process.
  - Generate extension package (zip file).
  - Prepare for distribution (Github Release or Chrome Web Store).
  - Create release notes and changelog.
