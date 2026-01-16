/**
 * Component Auditor - DevTools Panel Entry Point
 * 
 * This script initializes the DevTools panel and establishes communication
 * channels between the panel, background service worker, and content scripts.
 */

(function() {
  'use strict';

  // Create the DevTools panel
  chrome.devtools.panels.create(
    'Component Auditor',           // Panel title
    'assets/icon-16.png',      // Icon (optional, will use default if not found)
    'src/panel.html',          // Panel HTML file
    function(panel) {
      let port = null;
      let tabId = null;

      // Get the inspected window's tab ID
      // Note: chrome.devtools.inspectedWindow.tabId is a property, not a promise
      tabId = chrome.devtools.inspectedWindow.tabId;
      
      // Establish connection to background script
      port = chrome.runtime.connect({
        name: 'devtools-panel'
      });

      // Send tabId in first message to background
      port.postMessage({
        type: 'DEVTOOLS_CONNECTED',
        tabId: tabId
      });

      // Handle messages from background script
      port.onMessage.addListener(function(message) {
        console.log('DevTools panel received message:', message);
        // Forward messages to panel UI (will be implemented in Phase 4)
        if (window.panelWindow) {
          window.panelWindow.postMessage(message, '*');
        }
      });

      // Handle disconnection
      port.onDisconnect.addListener(function() {
        console.log('DevTools panel disconnected from background');
        port = null;
      });

      // Store port reference for panel UI access
      window.devToolsPort = port;
      window.devToolsTabId = tabId;

      // Handle panel visibility changes
      panel.onShown.addListener(function(panelWindow) {
        console.log('Component Auditor panel shown');
        window.panelWindow = panelWindow;
        
        // Notify background that panel is active
        if (port) {
          port.postMessage({
            type: 'PANEL_SHOWN',
            tabId: tabId
        });
        }
      });

      panel.onHidden.addListener(function() {
        console.log('Component Auditor panel hidden');
        
        // Notify background that panel is hidden
        if (port) {
          port.postMessage({
            type: 'PANEL_HIDDEN',
            tabId: tabId
          });
        }
      });
    }
  );

  console.log('Component Auditor DevTools panel initialized');
})();
