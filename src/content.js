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
      // React Detection - Multiple reliable methods
      let hasReact = false;
      
      // Method 1: React DevTools hook (most reliable)
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        // Check if hook has renderers (indicates active React app)
        if (hook.renderers && hook.renderers.size > 0) {
          hasReact = true;
        } else if (hook._renderers && Object.keys(hook._renderers).length > 0) {
          hasReact = true;
        } else if (hook.onCommitFiberRoot || hook.onCommitFiberUnmount) {
          // React 16+ indicators
          hasReact = true;
        }
      }
      
      // Method 2: Check for React global (if exposed)
      if (!hasReact && (window.React || window.ReactDOM)) {
        hasReact = true;
      }
      
      // Method 3: Check DOM for React-specific root elements
      if (!hasReact) {
        const reactRoot = document.querySelector("[data-reactroot]") || 
                         document.querySelector("[data-react-helmet]") ||
                         document.querySelector("#root") ||
                         document.querySelector("#app");
        // If we find a common React root, it's likely React (heuristic)
        if (reactRoot) {
          hasReact = true;
        }
      }
      
      // Method 4: Check script tags (external) for React
      if (!hasReact) {
        const scripts = document.querySelectorAll("script[src]");
        for (const script of scripts) {
          const src = script.src.toLowerCase();
          if (src.includes("react") || src.includes("react-dom") || src.includes("/react/")) {
            hasReact = true;
            break;
          }
        }
      }
      
      // Method 5: Check inline scripts for React references
      if (!hasReact) {
        const inlineScripts = document.querySelectorAll("script:not([src])");
        for (const script of inlineScripts) {
          const content = script.textContent || script.innerHTML;
          if (content && (content.includes("React") || content.includes("react-dom") || content.includes("__REACT"))) {
            hasReact = true;
            break;
          }
        }
      }
      
      if (hasReact) {
        detected.push("React");
      }

      // Vue Detection - Multiple reliable methods
      let hasVue = false;
      
      // Method 1: Vue DevTools hook
      if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
        hasVue = true;
      }
      
      // Method 2: Vue global (Vue 2)
      if (!hasVue && typeof window.Vue !== "undefined") {
        hasVue = true;
      }
      
      // Method 3: Vue 3 app instance
      if (!hasVue && window.__VUE__) {
        hasVue = true;
      }
      
      // Method 4: Check DOM for Vue-specific attributes
      if (!hasVue) {
        // Vue 2 uses data-v-* attributes, Vue 3 uses v-* directives
        // Check for common Vue directives
        const vueElement = document.querySelector("[v-cloak]") ||
                          document.querySelector("[v-if]") ||
                          document.querySelector("[v-for]") ||
                          document.querySelector("[v-model]") ||
                          document.querySelector("[v-show]") ||
                          document.querySelector("[v-bind]");
        
        // Also check for Vue 2 data-v-* scoped style attributes
        if (!vueElement) {
          const allElements = document.querySelectorAll("*");
          for (let i = 0; i < Math.min(100, allElements.length); i++) {
            const el = allElements[i];
            if (el && el.hasAttribute && el.hasAttribute("data-v-")) {
              hasVue = true;
              break;
            }
            // Check for any attribute starting with data-v-
            const attrs = el.attributes;
            if (attrs) {
              for (let j = 0; j < attrs.length; j++) {
                if (attrs[j].name && attrs[j].name.startsWith("data-v-")) {
                  hasVue = true;
                  break;
                }
              }
              if (hasVue) break;
            }
          }
        }
        
        if (vueElement) {
          hasVue = true;
        }
      }
      
      // Method 5: Check script tags (external) for Vue
      if (!hasVue) {
        const scripts = document.querySelectorAll("script[src]");
        for (const script of scripts) {
          const src = script.src.toLowerCase();
          if (src.includes("vue") || src.includes("/vue/")) {
            hasVue = true;
            break;
          }
        }
      }
      
      // Method 6: Check inline scripts for Vue references
      if (!hasVue) {
        const inlineScripts = document.querySelectorAll("script:not([src])");
        for (const script of inlineScripts) {
          const content = script.textContent || script.innerHTML;
          if (content && (content.includes("Vue") || content.includes("__VUE"))) {
            hasVue = true;
            break;
          }
        }
      }
      
      if (hasVue) {
        detected.push("Vue");
      }

      // Angular Detection
      let hasAngular = false;
      
      // Method 1: AngularJS (v1.x)
      if (typeof window.angular !== "undefined" && window.angular.version) {
        detected.push("AngularJS");
        hasAngular = true;
      }
      
      // Method 2: Angular 2+ (check for ng-version attribute)
      if (!hasAngular) {
        const ngElement = document.querySelector("[ng-version]") ||
                         document.querySelector("[ng-app]") ||
                         document.querySelector("app-root") ||
                         document.querySelector("ng-component");
        if (ngElement) {
          detected.push("Angular");
          hasAngular = true;
        }
      }
      
      // Method 3: Check for Angular in window (Angular 2+)
      if (!hasAngular && (window.ng || window.ng.probe)) {
        detected.push("Angular");
        hasAngular = true;
      }
      
      // Method 4: Check script tags (external) for Angular
      if (!hasAngular) {
        const scripts = document.querySelectorAll("script[src]");
        for (const script of scripts) {
          const src = script.src.toLowerCase();
          if (src.includes("angular") || src.includes("/angular/")) {
            if (!detected.includes("Angular") && !detected.includes("AngularJS")) {
              detected.push("Angular");
            }
            hasAngular = true;
            break;
          }
        }
      }
      
      // Method 5: Check inline scripts for Angular references
      if (!hasAngular) {
        const inlineScripts = document.querySelectorAll("script:not([src])");
        for (const script of inlineScripts) {
          const content = script.textContent || script.innerHTML;
          if (content && (content.includes("angular") || content.includes("ng."))) {
            if (!detected.includes("Angular") && !detected.includes("AngularJS")) {
              detected.push("Angular");
            }
            hasAngular = true;
            break;
          }
        }
      }

      // jQuery Detection
      if (typeof window.jQuery !== "undefined" && typeof window.jQuery.fn !== "undefined") {
        detected.push("jQuery");
      } else if (typeof window.$ !== "undefined" && typeof window.$.fn !== "undefined" && window.$.fn.jquery) {
        detected.push("jQuery");
      }

      // Webpack Detection
      if (window.__webpack_require__ || window.webpackJsonp) {
        detected.push("webpack");
      }

      // CSS Framework Detection
      // Bootstrap - check for Bootstrap classes or data attributes
      const hasBootstrap = document.querySelector(".container") ||
                          document.querySelector(".row") ||
                          document.querySelector("[class*='col-']") ||
                          document.querySelector("[data-bs-toggle]") ||
                          document.querySelector("[data-toggle]");
      if (hasBootstrap) {
        detected.push("Bootstrap");
      }

      // Tailwind CSS - check for Tailwind utility classes
      // Check common container elements and a limited sample
      let hasTailwind = false;
      
      // Check body and common container elements first (most likely to have Tailwind classes)
      const commonElements = [
        document.body,
        document.querySelector("main"),
        document.querySelector("header"),
        document.querySelector("nav"),
        document.querySelector("footer"),
        document.querySelector("article"),
        document.querySelector("section"),
      ].filter(Boolean);
      
      // Tailwind-specific patterns that are less likely to be false positives
      const tailwindPattern = /^(flex|grid|hidden|block|inline|absolute|relative|fixed|sticky|p-\d+|px-\d+|py-\d+|pt-\d+|pr-\d+|pb-\d+|pl-\d+|m-\d+|mx-\d+|my-\d+|mt-\d+|mr-\d+|mb-\d+|ml-\d+|text-\w+|bg-\w+|border-\w+|rounded-\w+|w-\w+|h-\w+|max-w-\w+|min-w-\w+|max-h-\w+|min-h-\w+)/;
      
      for (const el of commonElements) {
        if (el && el.className && typeof el.className === "string") {
          const classes = el.className.split(/\s+/);
          if (classes.some(cls => tailwindPattern.test(cls))) {
            hasTailwind = true;
            break;
          }
        }
      }
      
      // If not found, check script tags for Tailwind
      if (!hasTailwind) {
        const scripts = document.querySelectorAll("script[src]");
        for (const script of scripts) {
          const src = script.src.toLowerCase();
          if (src.includes("tailwind")) {
            hasTailwind = true;
            break;
          }
        }
      }
      
      // Last resort: check a small sample of elements (first 100)
      if (!hasTailwind) {
        const allElements = document.querySelectorAll("*");
        const sampleSize = Math.min(100, allElements.length);
        for (let i = 0; i < sampleSize; i++) {
          const el = allElements[i];
          if (el && el.className && typeof el.className === "string") {
            const classes = el.className.split(/\s+/);
            if (classes.some(cls => tailwindPattern.test(cls))) {
              hasTailwind = true;
              break;
            }
          }
        }
      }
      
      if (hasTailwind) {
        detected.push("Tailwind");
      }

      // Material-UI - check for MUI class patterns
      const hasMUI = document.querySelector("[class*='Mui']") ||
                    document.querySelector("[class*='mui-']") ||
                    document.querySelector("[class*='makeStyles']");
      if (hasMUI) {
        detected.push("Material-UI");
      }
    } catch (error) {
      console.warn("Component Auditor: Error detecting frameworks", error);
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
      
      // Parse query parameters
      const queryParams = {};
      if (location.search) {
        const searchParams = new URLSearchParams(location.search);
        for (const [key, value] of searchParams.entries()) {
          queryParams[key] = value;
        }
      }

      return {
        route: route,
        queryParams: queryParams,
      };
    } catch (error) {
      console.warn("Component Auditor: Error parsing URL", error);
      return {
        route: window.location.pathname || "/",
        queryParams: {},
      };
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

    // Extract context awareness data (framework detection and URL parsing)
    const frameworks = detectFrameworks();
    const urlData = parseURL();

    // Prepare the selection message
    const selectionMessage = {
      type: "ELEMENT_SELECTED",
      tabId: currentTabId,
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

    // Send selection message to background script
    if (port) {
      try {
        port.postMessage(selectionMessage);
        console.log("Content script: Sent ELEMENT_SELECTED via port");
      } catch (error) {
        console.error("Content script: Error sending via port, trying fallback", error);
        // Fallback to chrome.runtime.sendMessage
        chrome.runtime.sendMessage(selectionMessage).catch(function (err) {
          console.error("Content script: Failed to send ELEMENT_SELECTED message", err);
        });
      }
    } else {
      console.warn("Content script: Port is null, using chrome.runtime.sendMessage fallback");
      // Fallback to chrome.runtime.sendMessage if port is disconnected
      chrome.runtime.sendMessage(selectionMessage).catch(function (err) {
        console.error("Content script: Failed to send ELEMENT_SELECTED message", err);
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
