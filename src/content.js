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
  let overlayTooltip = null;
  let port = null;
  let currentTabId = null;

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
    
    // Add global keyboard listener for ESC key
    document.addEventListener("keydown", handleKeyDown);

    // Handle disconnection
    port.onDisconnect.addListener(function () {
      const error = chrome.runtime.lastError;
      if (error) {
        console.log("Content script disconnected from background:", error.message);
      } else {
        console.log("Content script disconnected from background");
      }

      port = null;

      // Only cleanup if this was an unexpected disconnection
      // (not if we're in the middle of a selection)
      if (!isSelectionMode) {
        cleanup();
      } else {
        // Try to reconnect if we're still in selection mode
        console.log("Content script: Attempting to reconnect port");
        try {
          port = chrome.runtime.connect({
            name: `content-script-${Date.now()}`,
          });
          port.postMessage({
            type: "CONTENT_SCRIPT_READY",
          });
          port.onMessage.addListener(function (message) {
            handleMessage(message);
          });
          port.onDisconnect.addListener(function () {
            console.log("Content script disconnected from background (reconnect)");
            port = null;
          });
        } catch (err) {
          console.error("Content script: Failed to reconnect port", err);
        }
      }
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
        console.log("Content script: DevTools is active", message.tabId);
        if (message.tabId) {
          currentTabId = message.tabId;
        }
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
    
    // Use high contrast visual style
    overlay.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 2147483647; /* Max Z-Index */
      border: 2px solid #1a73e8;
      background-color: rgba(26, 115, 232, 0.1);
      box-sizing: border-box;
      display: none;
      transition: all 0.1s ease-out;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 4px 8px rgba(0, 0, 0, 0.1);
      border-radius: 2px;
    `;

    // Create Tooltip
    overlayTooltip = document.createElement("div");
    overlayTooltip.id = "__CA_OVERLAY_TOOLTIP__";
    overlayTooltip.style.cssText = `
      position: absolute;
      top: -28px;
      left: 0;
      background: #1a73e8;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      pointer-events: none;
      white-space: nowrap;
      z-index: 2147483647;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    overlay.appendChild(overlayTooltip);

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
    
    // Update position
    overlay.style.display = "block";
    overlay.style.left = `${rect.left + scrollX}px`;
    overlay.style.top = `${rect.top + scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    
    // Update tooltip
    if (overlayTooltip) {
      const tagName = target.tagName.toLowerCase();
      const id = target.id ? `#${target.id}` : '';
      const className = target.className && typeof target.className === 'string' 
        ? `.${target.className.split(' ')[0]}` 
        : '';
      const dimensions = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      
      overlayTooltip.textContent = `${tagName}${id}${className} (${dimensions})`;
      
      // Adjust tooltip position if it goes off screen
      if (rect.top < 30) {
        overlayTooltip.style.top = '100%';
        overlayTooltip.style.marginTop = '4px';
      } else {
        overlayTooltip.style.top = '-28px';
        overlayTooltip.style.marginTop = '0';
      }
    }
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
   * Handle keyboard events (ESC to cancel)
   */
  function handleKeyDown(e) {
    if (!isSelectionMode) return;
    
    if (e.key === "Escape") {
      console.log("Component Auditor: ESC pressed, cancelling selection");
      
      // Send cancel message to background (which forwards to panel)
      if (port) {
        port.postMessage({
          type: "SELECTION_CANCELED",
          tabId: currentTabId
        });
      } else {
        // Fallback
         chrome.runtime.sendMessage({
          type: "SELECTION_CANCELED",
          tabId: currentTabId
        });
      }
      
      disableSelectionMode();
    }
  }

  /**
   * Extract HTML from an element
   * @param {Element} element - The element to extract HTML from
   * @returns {string} - The outerHTML of the element
   */
  function extractHTML(element) {
    try {
      return element.outerHTML || "";
    } catch (error) {
      console.warn("Component Auditor: Error extracting HTML", error);
      return "";
    }
  }

  /**
   * Extract lineage (parent ancestors) up to 3 levels
   * @param {Element} element - The element to traverse from
   * @returns {Array<Object>} - Array of ancestor info (tagName, className, id)
   */
  function extractLineage(element) {
    const lineage = [];
    let current = element.parentElement;
    let level = 0;
    const maxLevels = 3;

    while (current && level < maxLevels) {
      try {
        lineage.push({
          tagName: current.tagName || "",
          className: current.className || "",
          id: current.id || "",
        });
        current = current.parentElement;
        level++;
      } catch (error) {
        console.warn("Component Auditor: Error extracting lineage", error);
        break;
      }
    }

    return lineage;
  }

  /**
   * Extract sibling elements (previous and next)
   * @param {Element} element - The element to get siblings for
   * @returns {Object} - Object with previousSibling and nextSibling HTML
   */
  function extractSiblings(element) {
    const siblings = {
      previousSibling: null,
      nextSibling: null,
    };

    try {
      // Get previous sibling
      if (element.previousElementSibling) {
        siblings.previousSibling = {
          tagName: element.previousElementSibling.tagName || "",
          className: element.previousElementSibling.className || "",
          id: element.previousElementSibling.id || "",
          html: element.previousElementSibling.outerHTML || "",
        };
      }

      // Get next sibling
      if (element.nextElementSibling) {
        siblings.nextSibling = {
          tagName: element.nextElementSibling.tagName || "",
          className: element.nextElementSibling.className || "",
          id: element.nextElementSibling.id || "",
          html: element.nextElementSibling.outerHTML || "",
        };
      }
    } catch (error) {
      console.warn("Component Auditor: Error extracting siblings", error);
    }

    return siblings;
  }

  /**
   * Extract computed style tokens from an element
   * @param {Element} element - The element to extract tokens from
   * @returns {Object} - Object containing color, typography, spacing, and effects tokens
   */
  function extractTokens(element) {
    const tokens = {
      colors: [],
      fonts: [],
      spacing: {},
      border: {},
      shadows: [],
      opacity: null,
    };

    try {
      const computedStyle = window.getComputedStyle(element);

      // Extract color tokens
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;
      const borderColor = computedStyle.borderColor;

      if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") {
        tokens.colors.push({ type: "color", value: color });
      }
      if (backgroundColor && backgroundColor !== "rgba(0, 0, 0, 0)" && backgroundColor !== "transparent") {
        tokens.colors.push({ type: "background-color", value: backgroundColor });
      }
      if (borderColor && borderColor !== "rgba(0, 0, 0, 0)" && borderColor !== "transparent") {
        tokens.colors.push({ type: "border-color", value: borderColor });
      }

      // Extract typography tokens
      const fontFamily = computedStyle.fontFamily;
      const fontSize = computedStyle.fontSize;
      const fontWeight = computedStyle.fontWeight;
      const lineHeight = computedStyle.lineHeight;

      if (fontFamily) {
        tokens.fonts.push({ type: "font-family", value: fontFamily });
      }
      if (fontSize) {
        tokens.fonts.push({ type: "font-size", value: fontSize });
      }
      if (fontWeight) {
        tokens.fonts.push({ type: "font-weight", value: fontWeight });
      }
      if (lineHeight && lineHeight !== "normal") {
        tokens.fonts.push({ type: "line-height", value: lineHeight });
      }

      // Extract spacing tokens (padding and margin)
      const paddingTop = computedStyle.paddingTop;
      const paddingRight = computedStyle.paddingRight;
      const paddingBottom = computedStyle.paddingBottom;
      const paddingLeft = computedStyle.paddingLeft;
      const marginTop = computedStyle.marginTop;
      const marginRight = computedStyle.marginRight;
      const marginBottom = computedStyle.marginBottom;
      const marginLeft = computedStyle.marginLeft;

      tokens.spacing = {
        padding: {
          top: paddingTop || "0px",
          right: paddingRight || "0px",
          bottom: paddingBottom || "0px",
          left: paddingLeft || "0px",
        },
        margin: {
          top: marginTop || "0px",
          right: marginRight || "0px",
          bottom: marginBottom || "0px",
          left: marginLeft || "0px",
        },
      };

      // Extract border tokens
      const borderRadius = computedStyle.borderRadius;
      const borderWidth = computedStyle.borderWidth;
      const borderStyle = computedStyle.borderStyle;

      if (borderRadius && borderRadius !== "0px") {
        tokens.border.radius = borderRadius;
      }
      if (borderWidth && borderWidth !== "0px") {
        tokens.border.width = borderWidth;
      }
      if (borderStyle && borderStyle !== "none") {
        tokens.border.style = borderStyle;
      }

      // Extract effects tokens
      const boxShadow = computedStyle.boxShadow;
      const opacity = computedStyle.opacity;

      if (boxShadow && boxShadow !== "none") {
        tokens.shadows.push(boxShadow);
      }

      if (opacity && opacity !== "1") {
        tokens.opacity = opacity;
      }
    } catch (error) {
      console.warn("Component Auditor: Error extracting tokens", error);
    }

    return tokens;
  }

  /**
   * Detect frameworks and libraries used on the page
   * @returns {Array<string>} - Array of detected framework/library names
   */
  function detectFrameworks() {
    const detected = [];

    try {
      // React Detection
      let hasReact = false;
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if ((hook.renderers && hook.renderers.size > 0) || (hook._renderers && Object.keys(hook._renderers).length > 0)) {
          hasReact = true;
        }
      }
      if (!hasReact && (window.React || window.ReactDOM)) {
        hasReact = true;
      }
      if (!hasReact) {
         if (document.querySelector("[data-reactroot]") || document.querySelector("[data-react-helmet]")) {
             hasReact = true;
         }
      }
      if (hasReact) detected.push("React");

      // Vue Detection
      let hasVue = false;
      if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__ || typeof window.Vue !== "undefined" || window.__VUE__) {
        hasVue = true;
      }
      if (hasVue) detected.push("Vue");
      
      // Angular Detection
      let hasAngular = false;
      if (!hasReact) { // Reduce false positives
          if (window.angular || document.querySelector("[ng-version]") || document.querySelector("[ng-app]")) {
              hasAngular = true;
          }
      }
      if (hasAngular) detected.push("Angular");

      // CSS Frameworks
      if (document.querySelector(".container") || document.querySelector("[class*='col-']")) detected.push("Bootstrap");
      
      const tailwindPattern = /^(flex|grid|p-\d+|m-\d+|text-\w+|bg-\w+|rounded-\w+)/;
      const allElements = document.querySelectorAll("*");
      for (let i = 0; i < Math.min(100, allElements.length); i++) {
          const el = allElements[i];
          if (el.className && typeof el.className === 'string') {
              const classes = el.className.split(/\s+/);
              if (classes.some(c => tailwindPattern.test(c))) {
                  detected.push("Tailwind");
                  break;
              }
          }
      }

    } catch (error) {
      console.error("Component Auditor: Error detecting frameworks", error);
    }

    return detected;
  }

  /**
   * Parse URL into route and query parameters
   * @returns {Object} - Object with route (pathname) and queryParams (parsed search params)
   */
  function parseURL() {
    try {
      const location = window.location;
      const route = location.pathname || "/";
      const queryParams = {};
      if (location.search) {
        const searchParams = new URLSearchParams(location.search);
        for (const [key, value] of searchParams.entries()) {
          queryParams[key] = value;
        }
      }
      return { route, queryParams };
    } catch (error) {
      return { route: "/", queryParams: {} };
    }
  }

  /**
   * Guess the atomic level of an element based on heuristics
   * @param {Element} element - The element to analyze
   * @returns {string} - Guessed atomic level (Atom, Molecule, Organism, Template, Page)
   */
  function guessAtomicLevel(element) {
    try {
      if (!element) return "Atom";

      const tagName = element.tagName.toLowerCase();
      const children = Array.from(element.children);
      const childCount = children.length;
      const textContent = element.textContent?.trim() || "";
      const hasText = textContent.length > 0;
      const hasOnlyText = childCount === 0 && hasText;

      // Block-level elements that are typically atoms
      const atomTags = ["button", "input", "img", "svg", "a", "span", "strong", "em", "code", "label"];
      
      // Large container elements that are typically organisms or templates
      const organismTags = ["header", "footer", "nav", "main", "article", "section", "aside"];
      const templateTags = ["body", "html"];

      // If it's a template-level tag
      if (templateTags.includes(tagName)) {
        return "Template";
      }

      // If it's a page-level container
      if (tagName === "html" || element === document.documentElement) {
        return "Page";
      }

      // If it has no children and is a simple element, likely an Atom
      if (hasOnlyText || (childCount === 0 && atomTags.includes(tagName))) {
        return "Atom";
      }

      // If it's a known organism-level tag
      if (organismTags.includes(tagName)) {
        return "Organism";
      }

      // If it has many children (5+), likely an Organism
      if (childCount >= 5) {
        return "Organism";
      }

      // If it has multiple distinct child types, likely a Molecule
      if (childCount >= 2) {
        const childTypes = new Set(children.map((c) => c.tagName.toLowerCase()));
        if (childTypes.size >= 2) {
          return "Molecule";
        }
      }

      // If it has one child, check if that child is complex
      if (childCount === 1) {
        const firstChild = children[0];
        const grandChildren = Array.from(firstChild.children || []);
        if (grandChildren.length > 0) {
          return "Molecule";
        }
        return "Atom";
      }

      // Default to Atom for simple elements
      return "Atom";
    } catch (error) {
      console.warn("Component Auditor: Error guessing atomic level", error);
      return "Atom";
    }
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
    
    // Animate overlay before proceeding (Visual feedback)
    if (overlay) {
        overlay.style.backgroundColor = "rgba(26, 115, 232, 0.4)";
        overlay.style.transition = "background-color 0.1s ease";
    }

    // Save reference to selected element
    window.__CA_LAST_ELEMENT__ = e.target;

    // Get element's bounding rectangle
    const rect = e.target.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Extract HTML, lineage, siblings, and tokens
    const html = extractHTML(e.target);
    const lineage = extractLineage(e.target);
    const siblings = extractSiblings(e.target);
    const tokens = extractTokens(e.target);

    // Extract context awareness data
    const frameworks = detectFrameworks();
    const urlData = parseURL();
    const guessedAtomicLevel = guessAtomicLevel(e.target);

    // Prepare the selection message
    const selectionMessage = {
      type: "ELEMENT_SELECTED",
      tabId: currentTabId,
      element: {
        tagName: e.target.tagName,
        className: e.target.className,
        id: e.target.id,
      },
      guessedAtomicLevel: guessedAtomicLevel,
      rect: {
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        width: rect.width,
        height: rect.height,
        // Also include viewport-relative coordinates for screenshot cropping
        viewportX: rect.left,
        viewportY: rect.top,
      },
      code: {
        html: html,
        lineage: lineage,
        siblings: siblings,
        tokens: tokens,
      },
      meta: {
        frameworks: frameworks,
        route: urlData.route,
        queryParams: urlData.queryParams,
        domain: window.location.hostname,
        timestamp: new Date().toISOString(),
      },
    };
    
    // Small delay to show visual feedback before closing overlay
    setTimeout(() => {
        // Send selection message to background script
        if (port) {
          try {
            port.postMessage(selectionMessage);
          } catch (error) {
            chrome.runtime.sendMessage(selectionMessage).catch(() => {});
          }
        } else {
          chrome.runtime.sendMessage(selectionMessage).catch(() => {});
        }

        // Disable selection mode after selection
        disableSelectionMode();
    }, 150);
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
    
    document.removeEventListener("keydown", handleKeyDown);

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
