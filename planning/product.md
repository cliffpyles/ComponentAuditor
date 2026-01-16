# Component Auditor

**Version:** 1.0 (Draft)  
**Type:** Chrome DevTools Extension  
**Primary Goal:** Dataset Generation & UI Analysis  
**Repository Owner:** `cliffpyles`

---

## 1. Executive Summary

**Component Auditor** is a specialized browser extension that integrates directly into Google Chrome Developer Tools. Unlike standard web scrapers that fetch raw HTML in bulk, this tool is a **high-fidelity dataset builder**.

It allows users (Data Scientists, UI Engineers, and Researchers) to manually inspect, verify, and label specific UI components on live web pages. The extension extracts a "Deep Capture" of the element—combining its visual rendering, code structure, styling tokens, and semantic context—into a standardized JSON format. These records are stored locally and exported to train Machine Learning models (e.g., code generation, UI detection) or for quantitative design analysis.

---

## 2. Core User Workflows

### The "Labeling" Workflow

1.  **Activation:** The user opens Chrome DevTools (F12) and navigates to the "Component Auditor" panel.
2.  **Targeting:** The user clicks "Select Component." The extension injects an overlay into the DOM, mimicking the native Chrome Inspector.
3.  **Capture:** The user clicks an element (e.g., a specific "Card" or "Button"). The extension instantly freezes the state of that element.
4.  **Enrichment:**
    - **Auto-Extraction:** The system pulls screenshots, HTML, CSS tokens, and hierarchy data.
    - **Manual Tagging:** The user confirms the "Atomic Level" (Atom/Molecule) and tags patterns (e.g., "Master-Detail view") via the side panel.
5.  **Persistence:** The record is saved to an internal IndexedDB.

### The "Analysis" Workflow

1.  **Review:** The user browses the captured library within the DevTools panel to audit collected items.
2.  **Export:** The user exports the dataset as a generic JSON file.
3.  **Utilization:** The JSON is imported into external tools (Python/Pandas for analytics, TensorFlow/PyTorch for model training).

---

## 3. Detailed Feature Specifications

### A. Integration & UI

- **DevTools Native:** Lives as a panel within DevTools, allowing access to `chrome.debugger` and `inspectedWindow` APIs that standard popups cannot reach.
- **Toggleable Visibility:** The inspection overlay only exists when the tool is active. If DevTools is closed, the extension cleanly disconnects and removes all DOM artifacts.
- **IndexedDB Storage:** Uses browser-native, large-capacity storage to hold base64 images and complex JSON objects without relying on cloud services.

### B. The Extraction Engine (The Data Layer)

The core value of this product is the richness of the data it extracts. Every capture includes four distinct dimensions of data:

#### Dimension 1: Visual & Code (The "Hard" Data)

- **Component Snapshot:** A high-res PNG screenshot, programmatically cropped to the exact `BoundingClientRect` of the element.
- **Rendered Source:** The precise `outerHTML` at the moment of capture.
- **Siblings & Lineage:**
  - _Lineage:_ The HTML structure of the parent containers (up to 3 levels).
  - _Siblings:_ The HTML structure of adjacent elements (to provide layout context for ML models).
- **Computed Tokens:**
  - _Colors:_ Hex/RGB values extracted from computed styles.
  - _Typography:_ Font family, size, weight, and line-height.
  - _Spacing:_ Explicit padding and margin values (px/rem).
  - _Styling:_ Border radius, box shadows, and z-index.

#### Dimension 2: Environment (The Context)

- **Route Parsing:** Splits the `window.location` into the **Application Route** (e.g., `/product/123`) vs. **State Parameters** (e.g., `?variant=blue&size=m`).
- **Library Detection:** Scans the DOM and window object to identify frameworks (React, Vue, Angular) and CSS libraries (Tailwind, Bootstrap, Material UI).
- **Timestamp:** ISO 8601 timestamp for longitudinal analysis of design trends.
- **Domain & Industry:** User-tagged metadata to classify the data source (e.g., "E-commerce," "SaaS").

#### Dimension 3: Behavior (The Interactions)

- **Event Listeners:** Uses the Chrome Debugger API to list attached JavaScript events (Click, Hover, Drag, Scroll).
- **State Detection:** Auto-detects DOM states such as `aria-disabled`, `aria-expanded`, `checked`, or classes like `.is-active`.
- **Interaction Patterns:** Semantic tags for behavior (e.g., "Infinite Scroll," "Drag-and-Drop," "Modal Workflow").

#### Dimension 4: Composition (The Architecture)

- **Atomic Level:** Classifies the selection based on Atomic Design:
  - _Atom:_ Indivisible elements (Button, Input).
  - _Molecule:_ Simple combinations (Search Form).
  - _Organism:_ Complex sections (Header, Grid).
  - _Template/Page:_ Full layouts.
- **Atom Inventory:** A recursive inventory of the foundational elements inside the selection (e.g., "Contains: 2 Icons, 1 Text Block, 1 Button").
- **Component Composition:** A structural breakdown string (e.g., `Card > Header + Body + Footer`).

---

## 4. Data Schema Output (JSON)

The final output of the extension is a JSON file containing an array of component objects. This is the contract for the dataset.

```json
{
  "id": "uuid-v4-string",
  "label": "descriptive-label",
  "meta": {
    "timestamp": "2023-10-27T10:00:00Z",
    "domain": "example.com",
    "industry": "Fintech",
    "route": "/dashboard/settings",
    "queryParams": { "tab": "security" },
    "libraries": ["React", "Material-UI"]
  },
  "visuals": {
    "screenshot_base64": "data:image/png;...",
    "dimensions": { "width": 400, "height": 200 }
  },
  "code": {
    "html": "<div class='card'>...</div>",
    "lineage_html": "<section class='grid'>...</section>",
    "siblings_html": ["<div class='card'>...</div>"],
    "tokens": {
      "colors": ["#FFFFFF", "#3B82F6"],
      "fonts": ["Inter, sans-serif"],
      "spacing": { "padding": "16px", "margin": "0px" },
      "border": { "radius": "8px", "width": "1px" },
      "shadows": ["0 4px 6px rgba(0,0,0,0.1)"]
    }
  },
  "semantics": {
    "atomic_level": "Molecule",
    "inventory": {
      "buttons": 1,
      "images": 1,
      "inputs": 0,
      "text_nodes": 3
    },
    "composition_tree": "Card > (Image + Content > (Title + Description + Button))",
    "interaction_pattern": "Hover Reveal",
    "design_pattern": "Master-Detail Card",
    "state": "Default",
    "event_listeners": ["click", "mouseenter", "mouseleave"]
  }
}
```

---

## 5. Technical Architecture

- **Manifest V3:** Fully compliant with modern Chrome security standards.
- **Service Worker (Background):** Acts as the bridge between the secluded DevTools environment and the Content Script injected into the page.
- **Content Script:** Handles the visual overlay and DOM scraping.
- **DevTools Panel:** Handles the `eval()` execution for deep data extraction and the UI for user tagging.
