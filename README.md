# Component Auditor

> **⚠️ Warning: This project is not stable or ready for general use. Use at your own risk.**

## Vision

A data extraction tool that lives inside Chrome DevTools. It enables users to rapidly build structured datasets of web components by labeling live UI elements. The resulting data is optimized for ingestion into external analysis tools or for training machine learning models related to UI/UX.

## Core Value Proposition

- **For Data Scientists & ML Engineers:** Create clean, labeled training data for UI detection or code generation models.
- **For Design Systems Teams:** Export structured inventories of component usage for quantitative analysis in tools like Tableau or Python/Pandas.
- **For Developers:** Generate standardized JSON representations of components including code, visual tokens, and hierarchy.

## Key Capabilities (Data Points)

1. **The "Deep Select" Workflow:**

   - Mimics the native Chrome Inspector for precise targeting.
   - Captures transient states (hover, focus) to ensure dataset completeness.

2. **Structured Extraction Engine:**

   - **Visual:** Auto-cropped screenshots normalized to the component's bounding box.
   - **Code:** Rendered HTML, computed CSS, and DOM hierarchy (parent/sibling/child).
   - **Tokens:** Explicit mapping of raw hex values and pixels to design tokens.

3. **Semantic Labeling:**

   - **Classification:** Atomic Design levels (Atom, Molecule, Organism) and component types.
   - **Pattern Tagging:** Explicit labeling of Interaction and Design patterns for classification tasks.
   - **Context:** Route, query parameters, and library detection for environmental grounding.

4. **Data Management:**
   - **Local Storage:** Persists large datasets using IndexedDB.
   - **Portability:** Full JSON export/import capabilities for integration with external pipelines.

## Technical Stack

- **Platform:** Chrome Extension (Manifest V3)
- **Interface:** Chrome DevTools Panel
- **Storage:** IndexedDB (for large-scale dataset management)
- **APIs Used:** `chrome.devtools`, `chrome.debugger`, `chrome.scripting`

## Setup & Installation

### Installing as an Unpacked Extension

Since Component Auditor is currently in development, it must be installed as an unpacked (developer mode) extension:

1. **Clone or download this repository** to your local machine.

2. **Open Chrome Extensions Management:**

   - Navigate to `chrome://extensions/` in your Chrome browser
   - Or go to **Menu** → **Extensions** → **Manage Extensions**

3. **Enable Developer Mode:**

   - Toggle the **Developer mode** switch in the top-right corner of the Extensions page

4. **Load the Extension:**

   - Click the **Load unpacked** button
   - Select the root directory of this repository (the folder containing `manifest.json`)
   - The extension should now appear in your extensions list

5. **Access the Extension:**
   - Open Chrome DevTools (F12 or right-click → Inspect)
   - Look for the **Component Auditor** tab in the DevTools panel
   - If you don't see it, refresh the page and reopen DevTools

### Verifying Installation

- The extension should appear in your extensions list with its icon and name
- No errors should be displayed in the Extensions page
- The "Component Auditor" panel should be available in Chrome DevTools

### Troubleshooting

- **Extension not appearing in DevTools:** Make sure you've refreshed the page after installing the extension
- **Permission errors:** Ensure all required permissions are granted when prompted
- **Manifest errors:** Check the Extensions page for any error messages and verify `manifest.json` is valid
