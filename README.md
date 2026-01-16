# Component Auditor

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
