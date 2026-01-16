/**
 * Component Auditor - Content Script
 *
 * This script is injected into every page and handles:
 * - Visual overlay for element selection
 * - Hover highlighting
 * - Element selection and communication with DevTools panel
 */

(function () {
  "use strict";

  // State management
  let isSelectionMode = false;
  let overlay = null;
  let port = null;

  /**
   * Initialize the content script
   */
  function init() {
    console.log("Component Auditor content script loaded");

    // Connect to background script
    port = chrome.runtime.connect({
      name: `content-script-${Date.now()}`,
    });

    // Send ready message (background will extract tabId from sender)
    port.postMessage({
      type: "CONTENT_SCRIPT_READY",
    });

    // Listen for messages from background script via port
    port.onMessage.addListener(function (message) {
      handleMessage(message);
    });

    // Listen for messages sent via chrome.tabs.sendMessage (from panel or background)
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      handleMessage(message);
      return true; // Keep channel open for async response
    });

    // Handle disconnection
    port.onDisconnect.addListener(function () {
      console.log("Content script disconnected from background");
      cleanup();
    });
  }

  /**
   * Get the current tab ID
   */
  function getTabId() {
    // Content scripts can't directly access tabId, but we can get it from chrome.runtime
    // The background script will handle routing based on sender.tab.id
    return null; // Will be handled by background script
  }

  /**
   * Handle messages from background script
   */
  function handleMessage(message) {
    console.log("Content script received message:", message);

    if (!message || !message.type) {
      console.warn("Content script: Invalid message format", message);
      return;
    }

    switch (message.type) {
      case "DEVTOOLS_ACTIVE":
        // DevTools panel is active, ready to accept selections
        console.log("Content script: DevTools is active");
        break;

      case "DEVTOOLS_INACTIVE":
        // DevTools panel is hidden, disable selection mode
        console.log("Content script: DevTools is inactive");
        disableSelectionMode();
        break;

      case "DEVTOOLS_DISCONNECTED":
        // DevTools closed, cleanup everything
        console.log("Content script: DevTools disconnected");
        cleanup();
        break;

      case "START_SELECTION":
        // Start selection mode
        console.log("Content script: Starting selection mode");
        enableSelectionMode();
        break;

      case "STOP_SELECTION":
        // Stop selection mode
        console.log("Content script: Stopping selection mode");
        disableSelectionMode();
        break;

      default:
        console.warn("Content script: Unknown message type", message.type);
    }
  }

  /**
   * Create the overlay element
   */
  function createOverlay() {
    if (overlay && document.body.contains(overlay)) {
      return overlay;
    }

    // Ensure body exists
    if (!document.body) {
      console.warn("Component Auditor: document.body not available yet");
      return null;
    }

    overlay = document.createElement("div");
    overlay.id = "__CA_OVERLAY__";
    overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 999999;
      border: 2px solid #4285f4;
      background-color: rgba(66, 133, 244, 0.1);
      box-sizing: border-box;
      display: none;
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  /**
   * Update overlay position and size to match target element
   */
  function updateOverlay(target) {
    if (!overlay) {
      const created = createOverlay();
      if (!created) {
        return; // Could not create overlay
      }
    }

    const rect = target.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    overlay.style.display = "block";
    overlay.style.left = `${rect.left + scrollX}px`;
    overlay.style.top = `${rect.top + scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  /**
   * Hide the overlay
   */
  function hideOverlay() {
    if (overlay) {
      overlay.style.display = "none";
    }
  }

  /**
   * Handle mouseover event for hover highlighting
   */
  function handleMouseOver(e) {
    if (!isSelectionMode) {
      return;
    }

    // Don't highlight the overlay itself
    if (e.target === overlay || (overlay && overlay.contains(e.target))) {
      return;
    }

    updateOverlay(e.target);
  }

  /**
   * Handle click event for element selection
   */
  function handleClick(e) {
    if (!isSelectionMode) {
      return;
    }

    // Prevent default behavior and stop propagation
    e.preventDefault();
    e.stopPropagation();

    // Don't select the overlay itself
    if (e.target === overlay || (overlay && overlay.contains(e.target))) {
      return;
    }

    // Save reference to selected element
    window.__CA_LAST_ELEMENT__ = e.target;

    // Get element's bounding rectangle
    const rect = e.target.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Send selection message to background script
    if (port) {
      port.postMessage({
        type: "ELEMENT_SELECTED",
        element: {
          tagName: e.target.tagName,
          className: e.target.className,
          id: e.target.id,
        },
        rect: {
          x: rect.left + scrollX,
          y: rect.top + scrollY,
          width: rect.width,
          height: rect.height,
          // Also include viewport-relative coordinates for screenshot cropping
          viewportX: rect.left,
          viewportY: rect.top,
        },
      });
    }

    // Disable selection mode after selection
    disableSelectionMode();
  }

  /**
   * Enable selection mode
   */
  function enableSelectionMode() {
    if (isSelectionMode) {
      return;
    }

    isSelectionMode = true;
    createOverlay();

    // Add event listeners
    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("click", handleClick, true);

    // Change cursor to indicate selection mode
    // Use a style element to override page styles
    const style = document.createElement("style");
    style.id = "__CA_CURSOR_STYLE__";
    style.textContent = "* { cursor: crosshair !important; }";
    document.head.appendChild(style);

    console.log("Component Auditor: Selection mode enabled");
  }

  /**
   * Disable selection mode
   */
  function disableSelectionMode() {
    if (!isSelectionMode) {
      return;
    }

    isSelectionMode = false;
    hideOverlay();

    // Remove event listeners
    document.removeEventListener("mouseover", handleMouseOver, true);
    document.removeEventListener("click", handleClick, true);

    // Restore cursor by removing the style element
    const style = document.getElementById("__CA_CURSOR_STYLE__");
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    console.log("Component Auditor: Selection mode disabled");
  }

  /**
   * Cleanup: Remove overlay and disable selection mode
   */
  function cleanup() {
    disableSelectionMode();

    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      overlay = null;
    }

    // Remove cursor style if it exists
    const style = document.getElementById("__CA_CURSOR_STYLE__");
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    // Clear the global reference
    if (window.__CA_LAST_ELEMENT__) {
      delete window.__CA_LAST_ELEMENT__;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", cleanup);
})();
