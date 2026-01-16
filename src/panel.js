/**
 * Component Auditor - Panel UI Script
 *
 * This script handles the UI interactions within the DevTools panel.
 * Includes improved UX/UI features from Phase 4.
 */

(function () {
  "use strict";

  let isSelectionMode = false;
  let port = null;
  let tabId = null;

  /**
   * Initialize the panel UI
   */
  function init() {
    // Get the inspected window's tab ID (available in DevTools panel context)
    tabId = chrome.devtools.inspectedWindow.tabId;

    // Establish connection to background script
    connectToBackground();

    // Get UI elements
    const selectBtn = document.getElementById("select-component-btn");

    if (!selectBtn) {
      console.error("Select component button not found");
      return;
    }

    // Handle select button click
    selectBtn.addEventListener("click", function () {
      toggleSelectionMode();
    });

    // Setup view toggle buttons
    setupViewToggle();

    // Setup export button
    setupExportButton();

    // Setup settings button
    setupSettingsButton();

    // Update component types list with custom types
    updateComponentTypesList();

    // Show library view as default on initialization
    showLibraryView();

    // Listen for messages from devtools.js (if needed for future features)
    window.addEventListener("message", function (event) {
      // Only accept messages from our extension
      if (event.data && event.data.type) {
        handleMessage(event.data);
      }
    });

    console.log("Component Auditor panel UI initialized", { tabId, port: !!port });
  }

  /**
   * Connect to background script with automatic reconnection
   */
  function connectToBackground() {
    port = chrome.runtime.connect({
      name: "devtools-panel",
    });

    // Send tabId in first message to background
    port.postMessage({
      type: "DEVTOOLS_CONNECTED",
      tabId: tabId,
    });

    // Handle messages from background script
    port.onMessage.addListener(function (message) {
      handleMessage(message);
    });

    // Handle disconnection
    port.onDisconnect.addListener(function () {
      console.log("Panel: Disconnected from background");
      port = null;
    });
  }

  /**
   * Handle incoming messages
   */
  function handleMessage(message) {
    console.log("Panel received message:", message);

    switch (message.type) {
      case "ELEMENT_SELECTED":
        handleElementSelected(message);
        break;

      case "SELECTION_CANCELED":
        handleSelectionCanceled(message);
        break;

      case "SCREENSHOT_CAPTURED":
        handleScreenshotCaptured(message);
        break;

      case "SCREENSHOT_ERROR":
        handleScreenshotError(message);
        break;

      default:
        console.log("Panel: Unhandled message type", message.type);
    }
  }

  /**
   * Toggle selection mode
   */
  function toggleSelectionMode() {
    if (!isSelectionMode) {
      startSelectionMode();
    } else {
      stopSelectionMode();
    }
  }

  /**
   * Start selection mode
   */
  function startSelectionMode() {
    isSelectionMode = true;

    const selectBtn = document.getElementById("select-component-btn");
    const statusMessage = document.getElementById("status-message");

    if (selectBtn) {
      selectBtn.textContent = "Cancel Selection";
      selectBtn.classList.add("active");
    }

    if (statusMessage) {
      statusMessage.textContent = "Hover over elements to highlight, then click to select. Press ESC to cancel.";
    }

    // Ensure connection exists
    if (!port) {
      connectToBackground();
    }

    if (port && tabId) {
      port.postMessage({
        type: "START_SELECTION",
        tabId: tabId,
      });
    } else {
      console.error("Panel: No port or tabId available");
      showToast("Error: Could not start selection mode. Please reload.", "error");
      isSelectionMode = false;
      if (selectBtn) {
        selectBtn.textContent = "Select Component";
        selectBtn.classList.remove("active");
      }
    }
  }

  /**
   * Stop selection mode
   */
  function stopSelectionMode() {
    isSelectionMode = false;

    const selectBtn = document.getElementById("select-component-btn");
    const statusMessage = document.getElementById("status-message");

    if (selectBtn) {
      selectBtn.textContent = "Select Component";
      selectBtn.classList.remove("active");
    }

    if (statusMessage) {
      statusMessage.textContent = "";
    }

    if (port && tabId) {
      port.postMessage({
        type: "STOP_SELECTION",
        tabId: tabId,
      });
    }
  }

  /**
   * Handle selection canceled (e.g. via ESC key)
   */
  function handleSelectionCanceled(message) {
    stopSelectionMode();
    showToast("Selection canceled", "default");
  }

  /**
   * Handle element selection
   */
  function handleElementSelected(message) {
    const statusMessage = document.getElementById("status-message");

    if (statusMessage) {
      statusMessage.textContent = `Element selected. Capturing screenshot...`;
    }

    // Stop selection mode
    stopSelectionMode();

    // Store data
    window.__CA_PENDING_ELEMENT__ = {
      element: message.element,
      rect: message.rect,
      code: message.code || {},
      meta: message.meta || {},
      guessedAtomicLevel: message.guessedAtomicLevel,
    };

    // Request screenshot
    if (port && tabId) {
      port.postMessage({
        type: "CAPTURE_SCREENSHOT",
        tabId: tabId,
      });
    } else {
      showToast("Error: Connection lost. Could not capture screenshot.", "error");
    }
  }

  /**
   * Handle screenshot capture completion
   */
  function handleScreenshotCaptured(message) {
    const statusMessage = document.getElementById("status-message");
    const pendingElement = window.__CA_PENDING_ELEMENT__;

    if (!pendingElement) {
      showToast("Error: Screenshot captured but element info missing.", "error");
      return;
    }

    if (statusMessage) {
      statusMessage.textContent = "Processing component...";
    }

    // Crop screenshot
    cropScreenshot(message.dataUrl, pendingElement.rect)
      .then(function (croppedDataUrl) {
        // Clear ID for new capture
        window.__CA_COMPONENT_ID__ = null;

        // Store finalized data
        window.__CA_CROPPED_SCREENSHOT__ = croppedDataUrl;
        window.__CA_EXTRACTED_CODE__ = pendingElement.code || {};
        window.__CA_EXTRACTED_META__ = pendingElement.meta || {};
        window.__CA_ELEMENT_RECT__ = pendingElement.rect || {};
        window.__CA_ELEMENT_INFO__ = pendingElement.element || {};
        window.__CA_GUESSED_ATOMIC_LEVEL__ = pendingElement.guessedAtomicLevel;

        // Show editor
        showEditor();

        // Cleanup
        delete window.__CA_PENDING_ELEMENT__;
        if (statusMessage) statusMessage.textContent = "";
      })
      .catch(function (error) {
        console.error("Panel: Error cropping screenshot", error);
        showToast("Error: Could not crop screenshot.", "error");
        delete window.__CA_PENDING_ELEMENT__;
      });
  }

  /**
   * Handle screenshot capture error
   */
  function handleScreenshotError(message) {
    console.error("Panel: Screenshot error", message.error);
    showToast(`Error: ${message.error}`, "error");
    delete window.__CA_PENDING_ELEMENT__;

    const statusMessage = document.getElementById("status-message");
    if (statusMessage) statusMessage.textContent = "";
  }

  /**
   * Show the editor panel
   */
  function showEditor() {
    const emptyState = document.getElementById("empty-state");
    const editorContainer = document.getElementById("editor-container");
    const libraryContainer = document.getElementById("library-container");
    const settingsContainer = document.getElementById("settings-container");
    const viewCaptureBtn = document.getElementById("view-capture-btn");

    if (!emptyState || !editorContainer) return;

    // Switch to capture view tab if not active
    if (viewCaptureBtn && !viewCaptureBtn.classList.contains("active")) {
      showCaptureView();
    }

    emptyState.style.display = "none";
    if (libraryContainer) libraryContainer.classList.remove("active");
    if (settingsContainer) {
      settingsContainer.classList.remove("active");
      settingsContainer.style.display = "none";
    }
    editorContainer.classList.add("active");

    populateEditor();
    setupFormHandlers();
  }

  /**
   * Hide the editor
   */
  function hideEditor() {
    const emptyState = document.getElementById("empty-state");
    const editorContainer = document.getElementById("editor-container");

    if (!emptyState || !editorContainer) return;

    emptyState.style.display = "flex";
    editorContainer.classList.remove("active");

    const form = document.getElementById("component-form");
    if (form) form.reset();

    // Clear temporary data
    window.__CA_COMPONENT_ID__ = null;
    delete window.__CA_CROPPED_SCREENSHOT__;
    delete window.__CA_EXTRACTED_CODE__;
    delete window.__CA_EXTRACTED_META__;
    delete window.__CA_ELEMENT_RECT__;
    delete window.__CA_ELEMENT_INFO__;
  }

  /**
   * Populate the editor with captured data
   */
  function populateEditor() {
    const screenshotImg = document.getElementById("screenshot-img");
    const codeViewer = document.getElementById("code-viewer");
    const readonlySize = document.getElementById("readonly-size");
    const readonlyFont = document.getElementById("readonly-font");
    const readonlyUrl = document.getElementById("readonly-url");

    const croppedScreenshot = window.__CA_CROPPED_SCREENSHOT__;
    const codeData = window.__CA_EXTRACTED_CODE__ || {};
    const metaData = window.__CA_EXTRACTED_META__ || {};
    const elementRect = window.__CA_ELEMENT_RECT__ || {};

    // Screenshot
    if (screenshotImg && croppedScreenshot) {
      screenshotImg.src = croppedScreenshot;
    }

    // Code
    if (codeViewer) {
      const html = codeData.html || "";
      codeViewer.textContent =
        html.length > 5000 ? html.substring(0, 5000) + "\n\n... (truncated)" : html || "No HTML available";
    }

    // Technical Data
    if (readonlySize) {
      const width = Math.round(elementRect.width || 0);
      const height = Math.round(elementRect.height || 0);
      readonlySize.textContent = `${width} × ${height}px`;
    }

    if (readonlyFont) {
      const tokens = codeData.tokens || {};
      const fonts = tokens.fonts || [];
      const fontFamily = fonts.find((f) => f.type === "font-family")?.value;
      const fontSize = fonts.find((f) => f.type === "font-size")?.value;

      readonlyFont.textContent =
        fontFamily && fontSize ? `${fontFamily} (${fontSize})` : fontFamily || fontSize || "N/A";
    }

    if (readonlyUrl) {
      const route = metaData.route || "";
      const domain = metaData.domain || "";
      readonlyUrl.textContent = domain + route || "N/A";
    }

    // Pre-fill atomic level based on settings or guess
    const atomicLevelSelect = document.getElementById("atomic-level");
    if (atomicLevelSelect) {
      const defaultLevel = getDefaultAtomicLevel();
      let levelToUse = null;

      if (defaultLevel === "auto" && window.__CA_GUESSED_ATOMIC_LEVEL__) {
        levelToUse = window.__CA_GUESSED_ATOMIC_LEVEL__;
      } else if (defaultLevel !== "auto") {
        levelToUse = defaultLevel;
      }

      if (levelToUse && !atomicLevelSelect.value) {
        atomicLevelSelect.value = levelToUse;
      }
    }
  }

  /**
   * Setup form handlers
   */
  function setupFormHandlers() {
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const atomicLevelSelect = document.getElementById("atomic-level");

    if (cancelBtn) {
      // Remove old listeners to avoid duplicates
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

      newCancelBtn.addEventListener("click", function () {
        if (confirm("Discard changes?")) {
          hideEditor();
        }
      });
    }

    if (saveBtn) {
      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

      newSaveBtn.addEventListener("click", handleSave);
    }

    if (atomicLevelSelect) {
      atomicLevelSelect.addEventListener("change", () => validateField("atomic-level"));
    }
  }

  /**
   * Validate field
   */
  function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + "-error");

    if (!field) return true;

    let isValid = true;
    if (field.hasAttribute("required")) {
      isValid = field.value.trim() !== "";
    }

    if (errorElement) {
      errorElement.classList.toggle("show", !isValid);
    }

    field.style.borderColor = isValid ? "" : "var(--color-error)";
    return isValid;
  }

  /**
   * Handle save action
   */
  function handleSave() {
    if (!validateField("atomic-level")) {
      showToast("Please fill in required fields", "error");
      return;
    }

    const componentType = document.getElementById("component-type")?.value?.trim();
    const atomicLevel = document.getElementById("atomic-level")?.value;
    const designPattern = document.getElementById("design-pattern")?.value;
    const interactionPattern = document.getElementById("interaction-pattern")?.value;
    const notes = document.getElementById("notes")?.value;

    const componentData = {
      id: window.__CA_COMPONENT_ID__ || generateUUID(),
      label: generateLabel(componentType),
      meta: {
        ...window.__CA_EXTRACTED_META__,
        timestamp: new Date().toISOString(),
      },
      visuals: {
        screenshot_base64: window.__CA_CROPPED_SCREENSHOT__,
        dimensions: {
          width: window.__CA_ELEMENT_RECT__?.width || 0,
          height: window.__CA_ELEMENT_RECT__?.height || 0,
        },
      },
      code: window.__CA_EXTRACTED_CODE__ || {},
      semantics: {
        component_type: componentType || undefined,
        atomic_level: atomicLevel,
        design_pattern: designPattern || undefined,
        interaction_pattern: interactionPattern || undefined,
        notes: notes || undefined,
      },
    };

    if (window.ComponentAuditorDB?.save) {
      window.ComponentAuditorDB.save(componentData)
        .then((id) => {
          showToast("Component saved successfully!", "success");
          loadLibrary();
          setTimeout(hideEditor, 1000);
        })
        .catch((error) => {
          console.error("Save failed", error);
          showToast("Failed to save component: " + error.message, "error");
        });
    } else {
      showToast("Database not initialized", "error");
    }
  }

  /**
   * Load a component from the library into the editor
   */
  function loadComponentIntoEditor(component) {
    // Populate global state from component data
    window.__CA_COMPONENT_ID__ = component.id;
    window.__CA_CROPPED_SCREENSHOT__ = component.visuals?.screenshot_base64;
    window.__CA_EXTRACTED_CODE__ = component.code;
    window.__CA_EXTRACTED_META__ = component.meta;
    window.__CA_ELEMENT_RECT__ = component.visuals?.dimensions;
    window.__CA_ELEMENT_INFO__ = {
      tagName: component.label ? component.label.split("-")[0] : "element",
    }; // Approximate

    showEditor();

    // Populate semantic fields
    if (component.semantics) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
      };

      setVal("component-type", component.semantics.component_type);
      setVal("atomic-level", component.semantics.atomic_level);
      setVal("design-pattern", component.semantics.design_pattern);
      setVal("interaction-pattern", component.semantics.interaction_pattern);
      setVal("notes", component.semantics.notes);
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = "default") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Force reflow
    toast.offsetHeight;

    // Show
    requestAnimationFrame(() => toast.classList.add("show"));

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }

  // ... (UUID, Label, Crop, View Toggle functions remain mostly same but cleaned up) ...

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function generateLabel(componentType) {
    // If component type is provided, use it as the base
    if (componentType && componentType.trim()) {
      const elementInfo = window.__CA_ELEMENT_INFO__ || {};
      const className = elementInfo.className ? elementInfo.className.split(" ")[0] : "";
      const id = elementInfo.id || "";

      let label = componentType.trim();
      if (id) label += "-" + id;
      else if (className) label += "-" + className;
      return label;
    }

    // Fallback to original logic
    const elementInfo = window.__CA_ELEMENT_INFO__ || {};
    const tagName = elementInfo.tagName || "element";
    const className = elementInfo.className ? elementInfo.className.split(" ")[0] : "";
    const id = elementInfo.id || "";

    let label = tagName.toLowerCase();
    if (id) label += "-" + id;
    else if (className) label += "-" + className;

    return label;
  }

  function cropScreenshot(dataUrl, rect) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        try {
          const dpr = window.devicePixelRatio || 1;
          const cropX = rect.viewportX * dpr;
          const cropY = rect.viewportY * dpr;
          const cropWidth = rect.width * dpr;
          const cropHeight = rect.height * dpr;

          const canvas = document.createElement("canvas");
          canvas.width = Math.min(cropWidth, img.width - Math.max(0, cropX));
          canvas.height = Math.min(cropHeight, img.height - Math.max(0, cropY));

          if (canvas.width <= 0 || canvas.height <= 0) {
            throw new Error("Invalid crop dimensions");
          }

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, cropX, cropY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  }

  function setupViewToggle() {
    const viewLibraryBtn = document.getElementById("view-library-btn");
    const viewCaptureBtn = document.getElementById("view-capture-btn");

    if (viewLibraryBtn) {
      viewLibraryBtn.addEventListener("click", showLibraryView);
    }

    if (viewCaptureBtn) {
      viewCaptureBtn.addEventListener("click", showCaptureView);
    }
  }

  function showLibraryView() {
    document.getElementById("view-library-btn")?.classList.add("active");
    document.getElementById("view-capture-btn")?.classList.remove("active");

    document.getElementById("empty-state").style.display = "none";
    document.getElementById("editor-container")?.classList.remove("active");
    document.getElementById("settings-container")?.classList.remove("active");
    document.getElementById("settings-container").style.display = "none";
    document.getElementById("library-container")?.classList.add("active");

    loadLibrary();
  }

  function showCaptureView() {
    document.getElementById("view-library-btn")?.classList.remove("active");
    document.getElementById("view-capture-btn")?.classList.add("active");

    document.getElementById("library-container")?.classList.remove("active");
    document.getElementById("settings-container")?.classList.remove("active");
    document.getElementById("settings-container").style.display = "none";

    // Use editor state to determine what to show
    const editorContainer = document.getElementById("editor-container");
    if (editorContainer?.classList.contains("active")) {
      document.getElementById("empty-state").style.display = "none";
    } else {
      // Show minimal empty state (just status message if needed)
      document.getElementById("empty-state").style.display = "flex";
    }
  }

  function loadLibrary() {
    if (!window.ComponentAuditorDB?.getAll) return;

    window.ComponentAuditorDB.getAll()
      .then((components) => {
        displayLibrary(components);
        updateExportButton(components.length > 0);
      })
      .catch(console.error);
  }

  function displayLibrary(components) {
    const grid = document.getElementById("library-grid");
    const empty = document.getElementById("library-empty");
    if (!grid) return;

    grid.innerHTML = "";

    if (components.length === 0) {
      if (empty) empty.style.display = "block";
      grid.style.display = "none";
    } else {
      if (empty) empty.style.display = "none";
      grid.style.display = "grid";
      components.forEach((c) => grid.appendChild(createLibraryItem(c)));
    }
  }

  function createLibraryItem(component) {
    const item = document.createElement("div");
    item.className = "library-item";

    const domain = component.meta?.domain || "";
    const atomicLevel = component.semantics?.atomic_level || "N/A";
    const timestamp = component.meta?.timestamp ? new Date(component.meta.timestamp).toLocaleDateString() : "";
    const componentType = component.semantics?.component_type || "";

    // Build metadata string
    let metaParts = [];
    if (componentType) metaParts.push(componentType);
    metaParts.push(atomicLevel);
    if (domain) metaParts.push(domain);
    if (timestamp) metaParts.push(timestamp);

    // Content structure matching CSS
    item.innerHTML = `
      <div class="library-item-thumbnail">
        <img src="${component.visuals?.screenshot_base64 || ""}" alt="${component.label}">
        <button class="library-item-delete" title="Delete">×</button>
      </div>
      <div class="library-item-info">
        <div class="library-item-name">${component.label || "Unnamed"}</div>
        <div class="library-item-meta">
          ${metaParts.join(" • ")}
        </div>
      </div>
    `;

    // Add event listeners
    item.querySelector(".library-item-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteComponent(component.id);
    });

    item.addEventListener("click", () => {
      loadComponentIntoEditor(component);
    });

    return item;
  }

  function deleteComponent(id) {
    if (!confirm("Are you sure you want to delete this component?")) return;

    window.ComponentAuditorDB.delete(id)
      .then(() => {
        showToast("Component deleted", "success");
        loadLibrary();
      })
      .catch((err) => showToast("Failed to delete: " + err.message, "error"));
  }

  function setupExportButton() {
    document.getElementById("export-btn")?.addEventListener("click", exportDataset);
  }

  /**
   * Setup settings button and handlers
   */
  function setupSettingsButton() {
    const settingsBtn = document.getElementById("settings-btn");
    const settingsCloseBtn = document.getElementById("settings-close-btn");
    const settingsSaveBtn = document.getElementById("settings-save-btn");
    const settingsResetBtn = document.getElementById("settings-reset-btn");

    if (settingsBtn) {
      settingsBtn.addEventListener("click", showSettings);
    }

    if (settingsCloseBtn) {
      settingsCloseBtn.addEventListener("click", hideSettings);
    }

    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener("click", saveSettings);
    }

    if (settingsResetBtn) {
      settingsResetBtn.addEventListener("click", resetSettings);
    }

    // Load settings on init
    loadSettings();
  }

  /**
   * Show settings view
   */
  function showSettings() {
    document.getElementById("library-container")?.classList.remove("active");
    document.getElementById("editor-container")?.classList.remove("active");
    document.getElementById("empty-state").style.display = "none";
    const settingsContainer = document.getElementById("settings-container");
    if (settingsContainer) {
      settingsContainer.style.display = "block";
      settingsContainer.classList.add("active");
    }
    
    loadSettings();
  }

  /**
   * Hide settings view
   */
  function hideSettings() {
    const settingsContainer = document.getElementById("settings-container");
    if (settingsContainer) {
      settingsContainer.classList.remove("active");
      settingsContainer.style.display = "none";
    }
    
    // Return to library view
    showLibraryView();
  }

  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    try {
      const defaultAtomicLevel = localStorage.getItem("ca_defaultAtomicLevel") || "auto";
      const customTypes = localStorage.getItem("ca_customComponentTypes") || "";

      const defaultAtomicLevelSelect = document.getElementById("default-atomic-level");
      const customTypesTextarea = document.getElementById("custom-component-types");

      if (defaultAtomicLevelSelect) {
        defaultAtomicLevelSelect.value = defaultAtomicLevel;
      }

      if (customTypesTextarea) {
        customTypesTextarea.value = customTypes;
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  }

  /**
   * Save settings to localStorage
   */
  function saveSettings() {
    try {
      const defaultAtomicLevel = document.getElementById("default-atomic-level")?.value || "auto";
      const customTypes = document.getElementById("custom-component-types")?.value || "";

      localStorage.setItem("ca_defaultAtomicLevel", defaultAtomicLevel);
      localStorage.setItem("ca_customComponentTypes", customTypes);

      showToast("Settings saved successfully", "success");
      
      // Update component types list if needed
      updateComponentTypesList();
    } catch (error) {
      console.error("Failed to save settings", error);
      showToast("Failed to save settings: " + error.message, "error");
    }
  }

  /**
   * Reset settings to defaults
   */
  function resetSettings() {
    if (!confirm("Reset all settings to defaults?")) return;

    try {
      localStorage.removeItem("ca_defaultAtomicLevel");
      localStorage.removeItem("ca_customComponentTypes");

      loadSettings();
      updateComponentTypesList();
      showToast("Settings reset to defaults", "success");
    } catch (error) {
      console.error("Failed to reset settings", error);
      showToast("Failed to reset settings", "error");
    }
  }

  /**
   * Get default atomic level from settings
   */
  function getDefaultAtomicLevel() {
    try {
      return localStorage.getItem("ca_defaultAtomicLevel") || "auto";
    } catch (error) {
      return "auto";
    }
  }

  /**
   * Get custom component types from settings
   */
  function getCustomComponentTypes() {
    try {
      const customTypes = localStorage.getItem("ca_customComponentTypes") || "";
      return customTypes
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    } catch (error) {
      return [];
    }
  }

  /**
   * Update component types datalist with custom types
   */
  function updateComponentTypesList() {
    const datalist = document.getElementById("component-type-list");
    if (!datalist) return;

    // Get custom types
    const customTypes = getCustomComponentTypes();

    // Clear existing custom options (keep default ones)
    const existingOptions = Array.from(datalist.querySelectorAll("option"));
    existingOptions.forEach((opt) => {
      const defaultTypes = ["Button", "Card", "Modal", "Input", "List", "Navigation", "Image", "Text", "Form", "Header", "Footer", "Sidebar"];
      if (!defaultTypes.includes(opt.value)) {
        opt.remove();
      }
    });

    // Add custom types
    customTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      datalist.appendChild(option);
    });
  }

  function updateExportButton(enabled) {
    const btn = document.getElementById("export-btn");
    if (btn) btn.disabled = !enabled;
  }

  function exportDataset() {
    window.ComponentAuditorDB.getAll()
      .then((components) => {
        const dataset = {
          version: "1.0",
          exportDate: new Date().toISOString(),
          componentCount: components.length,
          components: components,
        };

        const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `component-auditor-dataset-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`Exported ${components.length} components successfully`, "success");
      })
      .catch((err) => showToast("Export failed: " + err.message, "error"));
  }

  // Init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
