/**
 * Component Auditor - Panel UI Script
 *
 * This script handles the UI interactions within the DevTools panel.
 * Includes improved UX/UI features from Phase 4 and Phase 5.
 */

(function () {
  "use strict";

  let isSelectionMode = false;
  let port = null;
  let tabId = null;
  
  // Library State
  let allComponents = [];
  let filteredComponents = [];
  
  let appState = {
    viewMode: 'grid', // 'grid' or 'list'
    currentPage: 1,
    itemsPerPage: 50,
    filters: {
      search: "",
      domain: "",
      atomicLevel: "",
      sort: "date-desc"
    }
  };

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

    // Setup view toggle buttons (Main Tabs)
    setupMainViewTabs();

    // Setup library toolbar (search, filter, sort, layout toggle)
    setupLibraryToolbar();

    // Setup pagination
    setupPagination();

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
    }
  }

  // --- Selection Mode Logic ---

  function toggleSelectionMode() {
    if (!isSelectionMode) {
      startSelectionMode();
    } else {
      stopSelectionMode();
    }
  }

  function startSelectionMode() {
    isSelectionMode = true;
    updateSelectionUI(true);

    if (!port) connectToBackground();

    if (port && tabId) {
      port.postMessage({ type: "START_SELECTION", tabId: tabId });
    } else {
      showToast("Error: Could not start selection mode.", "error");
      isSelectionMode = false;
      updateSelectionUI(false);
    }
  }

  function stopSelectionMode() {
    isSelectionMode = false;
    updateSelectionUI(false);

    if (port && tabId) {
      port.postMessage({ type: "STOP_SELECTION", tabId: tabId });
    }
  }

  function updateSelectionUI(active) {
    const selectBtn = document.getElementById("select-component-btn");
    const statusMessage = document.getElementById("status-message");

    if (selectBtn) {
      selectBtn.textContent = active ? "Cancel Selection" : "Select Component";
      selectBtn.classList.toggle("active", active);
    }

    if (statusMessage) {
      statusMessage.textContent = active 
        ? "Hover over elements to highlight, then click to select. Press ESC to cancel." 
        : "";
    }
  }

  function handleSelectionCanceled(message) {
    stopSelectionMode();
    showToast("Selection canceled", "default");
  }

  function handleElementSelected(message) {
    const statusMessage = document.getElementById("status-message");
    if (statusMessage) statusMessage.textContent = `Element selected. Capturing screenshot...`;

    stopSelectionMode();

    window.__CA_PENDING_ELEMENT__ = {
      element: message.element,
      rect: message.rect,
      code: message.code || {},
      meta: message.meta || {},
      guessedAtomicLevel: message.guessedAtomicLevel,
    };

    if (port && tabId) {
      port.postMessage({ type: "CAPTURE_SCREENSHOT", tabId: tabId });
    } else {
      showToast("Error: Connection lost.", "error");
    }
  }

  function handleScreenshotCaptured(message) {
    const statusMessage = document.getElementById("status-message");
    const pendingElement = window.__CA_PENDING_ELEMENT__;

    if (!pendingElement) {
      showToast("Error: Screenshot captured but element info missing.", "error");
      return;
    }

    if (statusMessage) statusMessage.textContent = "Processing component...";

    cropScreenshot(message.dataUrl, pendingElement.rect)
      .then(function (croppedDataUrl) {
        window.__CA_COMPONENT_ID__ = null;
        window.__CA_CROPPED_SCREENSHOT__ = croppedDataUrl;
        window.__CA_EXTRACTED_CODE__ = pendingElement.code || {};
        window.__CA_EXTRACTED_META__ = pendingElement.meta || {};
        window.__CA_ELEMENT_RECT__ = pendingElement.rect || {};
        window.__CA_ELEMENT_INFO__ = pendingElement.element || {};
        window.__CA_GUESSED_ATOMIC_LEVEL__ = pendingElement.guessedAtomicLevel;

        showEditor();
        delete window.__CA_PENDING_ELEMENT__;
        if (statusMessage) statusMessage.textContent = "";
      })
      .catch(function (error) {
        console.error("Panel: Error cropping screenshot", error);
        showToast("Error: Could not crop screenshot.", "error");
        delete window.__CA_PENDING_ELEMENT__;
      });
  }

  function handleScreenshotError(message) {
    showToast(`Error: ${message.error}`, "error");
    delete window.__CA_PENDING_ELEMENT__;
    const statusMessage = document.getElementById("status-message");
    if (statusMessage) statusMessage.textContent = "";
  }

  // --- View Management ---

  function setupMainViewTabs() {
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

    const editorContainer = document.getElementById("editor-container");
    if (editorContainer?.classList.contains("active")) {
      document.getElementById("empty-state").style.display = "none";
    } else {
      document.getElementById("empty-state").style.display = "flex";
    }
  }

  function showEditor() {
    // Force switch to capture tab if not active
    const viewCaptureBtn = document.getElementById("view-capture-btn");
    if (viewCaptureBtn && !viewCaptureBtn.classList.contains("active")) {
      showCaptureView();
    }

    document.getElementById("empty-state").style.display = "none";
    document.getElementById("editor-container").classList.add("active");

    populateEditor();
    setupFormHandlers();
  }

  function hideEditor() {
    document.getElementById("empty-state").style.display = "flex";
    document.getElementById("editor-container").classList.remove("active");
    document.getElementById("component-form")?.reset();

    // Cleanup globals
    window.__CA_COMPONENT_ID__ = null;
    delete window.__CA_CROPPED_SCREENSHOT__;
    delete window.__CA_EXTRACTED_CODE__;
    delete window.__CA_EXTRACTED_META__;
    delete window.__CA_ELEMENT_RECT__;
    delete window.__CA_ELEMENT_INFO__;
  }

  // --- Library Logic ---

  function setupLibraryToolbar() {
    // Filters
    const searchInput = document.getElementById("library-search-input");
    const filterDomain = document.getElementById("library-filter-domain");
    const filterAtomic = document.getElementById("library-filter-atomic");
    const sortSelect = document.getElementById("library-sort");
    const clearBtn = document.getElementById("library-clear-filters");

    // Layout Toggles
    const viewGridBtn = document.getElementById("view-grid-btn");
    const viewListBtn = document.getElementById("view-list-btn");

    // Debounce
    const debounce = (func, delay) => {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
      };
    };

    // Event Listeners
    if (searchInput) {
      searchInput.addEventListener("input", debounce((e) => {
        appState.filters.search = e.target.value.toLowerCase();
        appState.currentPage = 1; // Reset to page 1
        filterAndSortLibrary();
      }, 300));
    }

    if (filterDomain) {
      filterDomain.addEventListener("change", (e) => {
        appState.filters.domain = e.target.value;
        appState.currentPage = 1;
        filterAndSortLibrary();
      });
    }

    if (filterAtomic) {
      filterAtomic.addEventListener("change", (e) => {
        appState.filters.atomicLevel = e.target.value;
        appState.currentPage = 1;
        filterAndSortLibrary();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        appState.filters.sort = e.target.value;
        appState.currentPage = 1;
        filterAndSortLibrary();
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        // Reset UI
        if (searchInput) searchInput.value = "";
        if (filterDomain) filterDomain.value = "";
        if (filterAtomic) filterAtomic.value = "";
        if (sortSelect) sortSelect.value = "date-desc";

        // Reset State
        appState.filters = {
          search: "",
          domain: "",
          atomicLevel: "",
          sort: "date-desc"
        };
        appState.currentPage = 1;
        
        filterAndSortLibrary();
      });
    }

    // View Toggles
    if (viewGridBtn) {
      viewGridBtn.addEventListener("click", () => setViewMode('grid'));
    }
    if (viewListBtn) {
      viewListBtn.addEventListener("click", () => setViewMode('list'));
    }
  }

  function setViewMode(mode) {
    appState.viewMode = mode;
    appState.itemsPerPage = mode === 'grid' ? 50 : 100; // More items in list view
    appState.currentPage = 1;

    // Update buttons
    document.getElementById("view-grid-btn").classList.toggle("active", mode === 'grid');
    document.getElementById("view-list-btn").classList.toggle("active", mode === 'list');

    // Update container class
    const content = document.getElementById("library-content");
    content.classList.remove("grid-view", "list-view");
    content.classList.add(`${mode}-view`);

    renderLibrary();
  }

  function setupPagination() {
    document.getElementById("prev-page-btn")?.addEventListener("click", () => {
      if (appState.currentPage > 1) {
        appState.currentPage--;
        renderLibrary();
      }
    });

    document.getElementById("next-page-btn")?.addEventListener("click", () => {
      const totalPages = Math.ceil(filteredComponents.length / appState.itemsPerPage);
      if (appState.currentPage < totalPages) {
        appState.currentPage++;
        renderLibrary();
      }
    });
  }

  function loadLibrary() {
    if (!window.ComponentAuditorDB?.getAll) return;

    window.ComponentAuditorDB.getAll()
      .then((components) => {
        allComponents = components;
        document.getElementById("component-count-badge").textContent = components.length;
        
        updateDomainFilter(components);
        filterAndSortLibrary();
        updateExportButton(components.length > 0);
      })
      .catch(console.error);
  }

  function updateDomainFilter(components) {
    const filterDomain = document.getElementById("library-filter-domain");
    if (!filterDomain) return;

    const domains = [...new Set(components.map(c => c.meta?.domain).filter(d => d))].sort();
    const currentVal = filterDomain.value;

    filterDomain.innerHTML = '<option value="">All Domains</option>';
    domains.forEach(domain => {
      const option = document.createElement("option");
      option.value = domain;
      option.textContent = domain;
      filterDomain.appendChild(option);
    });

    if (domains.includes(currentVal)) {
      filterDomain.value = currentVal;
    }
  }

  function filterAndSortLibrary() {
    let filtered = [...allComponents];
    const filters = appState.filters;

    // Show/Hide Clear Button
    const hasActiveFilters = filters.search || filters.domain || filters.atomicLevel;
    document.getElementById("library-clear-filters").style.display = hasActiveFilters ? "inline-block" : "none";

    // 1. Search
    if (filters.search) {
      const q = filters.search;
      filtered = filtered.filter(c => 
        (c.label && c.label.toLowerCase().includes(q)) ||
        (c.meta?.domain && c.meta.domain.toLowerCase().includes(q)) ||
        (c.meta?.route && c.meta.route.toLowerCase().includes(q))
      );
    }

    // 2. Domain
    if (filters.domain) {
      filtered = filtered.filter(c => c.meta?.domain === filters.domain);
    }

    // 3. Atomic Level
    if (filters.atomicLevel) {
      filtered = filtered.filter(c => c.semantics?.atomic_level === filters.atomicLevel);
    }

    // 4. Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.meta?.timestamp || 0).getTime();
      const dateB = new Date(b.meta?.timestamp || 0).getTime();
      const nameA = (a.label || "").toLowerCase();
      const nameB = (b.label || "").toLowerCase();

      switch (filters.sort) {
        case "date-asc": return dateA - dateB;
        case "name-asc": return nameA.localeCompare(nameB);
        case "name-desc": return nameB.localeCompare(nameA);
        case "date-desc": default: return dateB - dateA;
      }
    });

    filteredComponents = filtered;
    renderLibrary();
  }

  function renderLibrary() {
    const content = document.getElementById("library-content");
    const empty = document.getElementById("library-empty");
    const pagination = document.getElementById("pagination-controls");
    
    if (!content) return;

    content.innerHTML = "";

    if (filteredComponents.length === 0) {
      empty.style.display = "flex";
      content.style.display = "none";
      pagination.style.display = "none";
      
      // Customize empty message based on whether it's a filter result or empty DB
      const subText = empty.querySelector(".sub-text");
      if (allComponents.length > 0) {
          subText.textContent = "No components match your current filters.";
      } else {
          subText.textContent = "Try capturing a new component.";
      }
      return;
    }

    // Show content
    empty.style.display = "none";
    content.style.display = appState.viewMode === 'grid' ? 'grid' : 'flex';
    
    // Pagination Logic
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const pageItems = filteredComponents.slice(start, end);
    const totalPages = Math.ceil(filteredComponents.length / appState.itemsPerPage);

    // Update Pagination UI
    pagination.style.display = totalPages > 1 ? "flex" : "none";
    document.getElementById("page-info").textContent = `Page ${appState.currentPage} of ${totalPages}`;
    document.getElementById("prev-page-btn").disabled = appState.currentPage <= 1;
    document.getElementById("next-page-btn").disabled = appState.currentPage >= totalPages;

    // Render Items
    const fragment = document.createDocumentFragment();
    pageItems.forEach(item => {
      fragment.appendChild(createLibraryItem(item));
    });
    content.appendChild(fragment);
  }

  function createLibraryItem(component) {
    const item = document.createElement("div");
    item.className = "library-item";
    
    // Data preparation
    const domain = component.meta?.domain || "Unknown Domain";
    const atomicLevel = component.semantics?.atomic_level || "Unknown Level";
    const timestamp = component.meta?.timestamp ? new Date(component.meta.timestamp).toLocaleDateString() : "";
    const componentType = component.semantics?.component_type || "";
    const name = component.label || "Unnamed Component";
    const screenshot = component.visuals?.screenshot_base64 || "";

    if (appState.viewMode === 'grid') {
      item.innerHTML = `
        <div class="library-item-thumbnail">
          <img src="${screenshot}" alt="${name}" loading="lazy">
          <button class="library-item-delete" title="Delete">×</button>
        </div>
        <div class="library-item-info">
          <div class="library-item-name" title="${name}">${name}</div>
          <div class="library-item-meta">
            <div class="meta-row">
              <span class="meta-badge">${atomicLevel}</span>
              <span>${timestamp}</span>
            </div>
            <div class="meta-row" style="margin-top: 2px;">
              <span>${domain}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // List View
      item.innerHTML = `
        <div class="library-item-thumbnail">
          <img src="${screenshot}" alt="${name}" loading="lazy">
        </div>
        <div class="library-item-info">
          <div class="library-item-name" title="${name}">${name}</div>
          <div class="library-item-meta">
             <span>${componentType}</span>
             <span>${domain}</span>
             <span class="meta-badge">${atomicLevel}</span>
             <span>${timestamp}</span>
          </div>
        </div>
        <button class="library-item-delete" title="Delete">×</button>
      `;
    }

    // Event Listeners
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
    if (!confirm("Delete this component?")) return;

    window.ComponentAuditorDB.delete(id)
      .then(() => {
        showToast("Component deleted", "success");
        loadLibrary(); // Reloads and re-renders
      })
      .catch((err) => showToast("Delete failed: " + err.message, "error"));
  }

  // --- Editor & Settings Logic (Unchanged but ensuring scope access) ---

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

    if (screenshotImg && croppedScreenshot) screenshotImg.src = croppedScreenshot;

    if (codeViewer) {
      const html = codeData.html || "";
      codeViewer.textContent = html.length > 5000 ? html.substring(0, 5000) + "\n\n... (truncated)" : html || "No HTML available";
    }

    if (readonlySize) {
      readonlySize.textContent = `${Math.round(elementRect.width || 0)} × ${Math.round(elementRect.height || 0)}px`;
    }

    if (readonlyFont) {
      const fonts = codeData.tokens?.fonts || [];
      const font = fonts.find((f) => f.type === "font-family")?.value;
      const size = fonts.find((f) => f.type === "font-size")?.value;
      readonlyFont.textContent = font && size ? `${font} (${size})` : "N/A";
    }

    if (readonlyUrl) {
      readonlyUrl.textContent = (metaData.domain || "") + (metaData.route || "");
    }

    // Semantic Pre-fill
    const atomicLevelSelect = document.getElementById("atomic-level");
    if (atomicLevelSelect) {
      const defaultLevel = localStorage.getItem("ca_defaultAtomicLevel") || "auto";
      const guessed = window.__CA_GUESSED_ATOMIC_LEVEL__;
      
      if (defaultLevel === "auto" && guessed) atomicLevelSelect.value = guessed;
      else if (defaultLevel !== "auto") atomicLevelSelect.value = defaultLevel;
    }
  }

  function setupFormHandlers() {
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const atomicLevelSelect = document.getElementById("atomic-level");

    if (cancelBtn) {
      const newCancelBtn = cancelBtn.cloneNode(true);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
      newCancelBtn.addEventListener("click", () => {
        if (confirm("Discard changes?")) hideEditor();
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

  function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + "-error");
    if (!field) return true;

    let isValid = true;
    if (field.hasAttribute("required")) isValid = field.value.trim() !== "";

    if (errorElement) errorElement.classList.toggle("show", !isValid);
    field.style.borderColor = isValid ? "" : "var(--color-error)";
    return isValid;
  }

  function validateSchema(data) {
    if (!data.id) throw new Error("Missing ID");
    if (!data.label) throw new Error("Missing Label");
    if (!data.visuals?.screenshot_base64) throw new Error("Missing Screenshot");
    if (!data.semantics?.atomic_level) throw new Error("Missing Atomic Level");
    return true;
  }

  function handleSave() {
    if (!validateField("atomic-level")) {
      showToast("Please fill in required fields", "error");
      return;
    }

    const componentData = {
      id: window.__CA_COMPONENT_ID__ || generateUUID(),
      label: generateLabel(document.getElementById("component-type")?.value),
      meta: {
        ...window.__CA_EXTRACTED_META__,
        timestamp: new Date().toISOString(),
      },
      visuals: {
        screenshot_base64: window.__CA_CROPPED_SCREENSHOT__,
        dimensions: window.__CA_ELEMENT_RECT__,
      },
      code: window.__CA_EXTRACTED_CODE__ || {},
      semantics: {
        component_type: document.getElementById("component-type")?.value,
        atomic_level: document.getElementById("atomic-level")?.value,
        design_pattern: document.getElementById("design-pattern")?.value,
        interaction_pattern: document.getElementById("interaction-pattern")?.value,
        notes: document.getElementById("notes")?.value,
      },
    };

    try {
      validateSchema(componentData);
    } catch (e) {
      showToast("Validation Error: " + e.message, "error");
      return;
    }

    if (window.ComponentAuditorDB?.save) {
      window.ComponentAuditorDB.save(componentData)
        .then(() => {
          showToast("Saved!", "success");
          loadLibrary();
          setTimeout(() => {
            hideEditor();
            showLibraryView();
          }, 800);
        })
        .catch((err) => showToast(err.message, "error"));
    }
  }

  function loadComponentIntoEditor(component) {
    window.__CA_COMPONENT_ID__ = component.id;
    window.__CA_CROPPED_SCREENSHOT__ = component.visuals?.screenshot_base64;
    window.__CA_EXTRACTED_CODE__ = component.code;
    window.__CA_EXTRACTED_META__ = component.meta;
    window.__CA_ELEMENT_RECT__ = component.visuals?.dimensions;
    window.__CA_ELEMENT_INFO__ = { tagName: component.label?.split("-")[0] };

    showEditor();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };

    if (component.semantics) {
      setVal("component-type", component.semantics.component_type);
      setVal("atomic-level", component.semantics.atomic_level);
      setVal("design-pattern", component.semantics.design_pattern);
      setVal("interaction-pattern", component.semantics.interaction_pattern);
      setVal("notes", component.semantics.notes);
    }
  }

  // --- Utils ---

  function showToast(message, type = "default") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function generateLabel(componentType) {
    const info = window.__CA_ELEMENT_INFO__ || {};
    const base = componentType?.trim() || info.tagName?.toLowerCase() || "element";
    const suffix = info.id ? `-${info.id}` : (info.className?.split(" ")[0] ? `-${info.className.split(" ")[0]}` : "");
    return base + suffix;
  }

  function cropScreenshot(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        const cropWidth = rect.width * dpr;
        const cropHeight = rect.height * dpr;
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, rect.viewportX * dpr, rect.viewportY * dpr, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  }

  function setupExportButton() {
    document.getElementById("export-btn")?.addEventListener("click", () => {
      if (!allComponents.length) return;
      const blob = new Blob([JSON.stringify({
        version: "1.0",
        exportDate: new Date().toISOString(),
        count: allComponents.length,
        components: allComponents
      }, null, 2)], { type: "application/json" });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `component-auditor-dataset-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function updateExportButton(hasItems) {
    const btn = document.getElementById("export-btn");
    if (btn) btn.disabled = !hasItems;
  }

  // Settings (Simplified for brevity, same logic as before)
  function setupSettingsButton() {
    document.getElementById("settings-btn")?.addEventListener("click", () => {
      document.getElementById("library-container").classList.remove("active");
      document.getElementById("editor-container").classList.remove("active");
      document.getElementById("settings-container").style.display = "block";
      document.getElementById("settings-container").classList.add("active");
      loadSettings();
    });
    document.getElementById("settings-close-btn")?.addEventListener("click", () => {
      document.getElementById("settings-container").style.display = "none";
      document.getElementById("settings-container").classList.remove("active");
      showLibraryView();
    });
    document.getElementById("settings-save-btn")?.addEventListener("click", () => {
      localStorage.setItem("ca_defaultAtomicLevel", document.getElementById("default-atomic-level")?.value);
      localStorage.setItem("ca_customComponentTypes", document.getElementById("custom-component-types")?.value);
      showToast("Settings saved", "success");
      updateComponentTypesList();
    });
    document.getElementById("settings-reset-btn")?.addEventListener("click", () => {
      if (confirm("Reset settings?")) {
        localStorage.removeItem("ca_defaultAtomicLevel");
        localStorage.removeItem("ca_customComponentTypes");
        loadSettings();
        updateComponentTypesList();
        showToast("Settings reset", "success");
      }
    });
  }

  function loadSettings() {
    const def = localStorage.getItem("ca_defaultAtomicLevel") || "auto";
    const custom = localStorage.getItem("ca_customComponentTypes") || "";
    if (document.getElementById("default-atomic-level")) document.getElementById("default-atomic-level").value = def;
    if (document.getElementById("custom-component-types")) document.getElementById("custom-component-types").value = custom;
  }

  function updateComponentTypesList() {
    const list = document.getElementById("component-type-list");
    if (!list) return;
    const custom = (localStorage.getItem("ca_customComponentTypes") || "").split("\n").filter(t => t.trim());
    // (Logic to merge custom types into datalist would go here)
  }

  // Init
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

})();
