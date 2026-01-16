# Product Name: Component Auditor (DevTools Extension)

## Vision

A forensic tool for UI engineers and designers that lives inside Chrome DevTools. It allows users to "reverse-engineer" the DNA of any interface component on the live web, cataloging its visual properties, code structure, and semantic context into a structured library.

## Core Value Proposition

- **For Developers:** Instantly extract the "Source of Truth" for a component (HTML, computed CSS tokens, hierarchy) without manually digging through the Elements tab.
- **For Designers:** Audit existing implementations against design systems (Atomic Design levels, spacing tokens, color usage).
- **For Teams:** Create a shared vocabulary by labeling live production components.

## Technical Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Interface:** Chrome DevTools Panel (HTML/CSS/JS)
- **Storage:** IndexedDB (via IDB wrapper)
- **APIs Used:** - `chrome.devtools.inspectedWindow` (Code execution)
  - `chrome.debugger` (Event listener extraction)
  - `chrome.tabs.captureVisibleTab` (Screenshotting)
  - `chrome.runtime` (Messaging bridge)

## Featues

#### 1. Visual & Code Forensics (The "What")

- **Component Snapshot:** High-fidelity screenshot cropped exactly to the component's bounding box.
- **Rendered Source:** The actual HTML and computed CSS of the selected element.
- **Lineage Hierarchy:** The full path of parent elements (containers) leading up to the root.
- **Sibling Context:** HTML/Structure of adjacent elements at the same level (to understand layout context).
- **Design Tokens:** Extracted values for colors (hex/rgb), spacing (padding/margin), typography (family/size/weight), border-radius, and shadows.
- **Event Listeners:** All attached JavaScript events (click, hover, scroll, etc.), detected via the Debugger API.

#### 2. Environmental Context (The "Where" & "When")

- **URL & Route:** The full URL plus the specific application route (path).
- **Query Parameters:** Active URL parameters (e.g., `?sort=desc`) that might affect the component's state.
- **Timestamp:** Exact date/time of capture (vital for tracking design evolution).
- **Domain & Brand:** The website domain, serving as a key for clustering similar designs.
- **Industry/Category:** Tag for the market vertical (e.g., SaaS, E-commerce, EdTech).
- **Library Detection:** Auto-detection of underlying tech (React, Vue, Tailwind, Material UI, etc.).

#### 3. Semantic & Architectural Analysis (The "Why")

- **Atomic Design Level:** Classification of the element:
- _Atom_ (Button, Icon)
- _Molecule_ (Search bar, Card header)
- _Organism_ (Navigation bar, Product Grid)
- _Template/Page_ (Full layout)

- **Composition Inventory:**
- _Atom Inventory:_ List of foundational elements inside (e.g., "Contains 1 icon, 1 label").
- _Molecule Composition:_ How atoms combine to form the current selection.
- _Organism Structure:_ Which molecules/atoms constitute the organism.

- **Component Composition:** A structural breakdown (e.g., `Card > Header + Avatar + Text`).
- **Interaction Patterns:** Functional behaviors (Hover states, Drag-and-Drop, Infinite Scroll, Expand/Collapse).
- **Design Patterns:** UX archetypes (Master-Detail, Wizard/Stepper, Modal Workflow, Progressive Disclosure).
- **Component State:** The specific condition during capture (Open/Closed, Loading, Error, Selected).
