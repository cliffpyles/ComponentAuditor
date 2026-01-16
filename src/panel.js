/**
 * Component Auditor - Panel UI Script
 * 
 * This script handles the UI interactions within the DevTools panel.
 * It will be expanded in Phase 4 to include the full editor interface.
 */

(function() {
  'use strict';

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
      handleMessage(message);
    });

    // Handle disconnection
    port.onDisconnect.addListener(function() {
      console.log('Panel: Disconnected from background');
      port = null;
    });

    // Get UI elements
    const selectBtn = document.getElementById('select-component-btn');
    const statusMessage = document.getElementById('status-message');

    if (!selectBtn) {
      console.error('Select component button not found');
      return;
    }

    // Handle select button click
    selectBtn.addEventListener('click', function() {
      toggleSelectionMode();
    });

    // Listen for messages from devtools.js (if needed for future features)
    window.addEventListener('message', function(event) {
      // Only accept messages from our extension
      if (event.data && event.data.type) {
        handleMessage(event.data);
      }
    });

    console.log('Component Auditor panel UI initialized', { tabId, port: !!port });
  }

  /**
   * Handle incoming messages
   */
  function handleMessage(message) {
    console.log('Panel received message:', message);

    switch (message.type) {
      case 'ELEMENT_SELECTED':
        handleElementSelected(message);
        break;
      
      default:
        console.log('Panel: Unhandled message type', message.type);
    }
  }

  /**
   * Toggle selection mode
   */
  function toggleSelectionMode() {
    const selectBtn = document.getElementById('select-component-btn');
    const statusMessage = document.getElementById('status-message');

    if (!isSelectionMode) {
      // Start selection mode
      startSelectionMode();
    } else {
      // Stop selection mode
      stopSelectionMode();
    }
  }

  /**
   * Start selection mode
   */
  function startSelectionMode() {
    isSelectionMode = true;
    
    const selectBtn = document.getElementById('select-component-btn');
    const statusMessage = document.getElementById('status-message');

    if (selectBtn) {
      selectBtn.textContent = 'Cancel Selection';
      selectBtn.classList.add('active');
    }

    if (statusMessage) {
      statusMessage.textContent = 'Hover over elements to highlight, then click to select.';
    }

    // Send message to background script to start selection
    if (!port) {
      console.error('Panel: Port not initialized. Reinitializing...');
      // Try to reinitialize
      tabId = chrome.devtools.inspectedWindow.tabId;
      port = chrome.runtime.connect({ name: 'devtools-panel' });
      port.postMessage({
        type: 'DEVTOOLS_CONNECTED',
        tabId: tabId
      });
      port.onMessage.addListener(function(message) {
        handleMessage(message);
      });
    }
    
    if (port && tabId) {
      port.postMessage({
        type: 'START_SELECTION',
        tabId: tabId
      });
    } else {
      console.error('Panel: No port or tabId available', { port: !!port, tabId });
      if (statusMessage) {
        statusMessage.textContent = 'Error: Could not start selection mode. Please reload the page.';
      }
      isSelectionMode = false;
      if (selectBtn) {
        selectBtn.textContent = 'Select Component';
        selectBtn.classList.remove('active');
      }
    }
  }

  /**
   * Stop selection mode
   */
  function stopSelectionMode() {
    isSelectionMode = false;
    
    const selectBtn = document.getElementById('select-component-btn');
    const statusMessage = document.getElementById('status-message');

    if (selectBtn) {
      selectBtn.textContent = 'Select Component';
      selectBtn.classList.remove('active');
    }

    if (statusMessage) {
      statusMessage.textContent = '';
    }

    // Send message to background script to stop selection
    if (port && tabId) {
      port.postMessage({
        type: 'STOP_SELECTION',
        tabId: tabId
      });
    } else {
      console.warn('Panel: Could not send STOP_SELECTION - port or tabId not available');
    }
  }

  /**
   * Handle element selection
   */
  function handleElementSelected(message) {
    const statusMessage = document.getElementById('status-message');
    
    if (statusMessage) {
      statusMessage.textContent = `Element selected: ${message.element.tagName}${message.element.className ? '.' + message.element.className.split(' ')[0] : ''}${message.element.id ? '#' + message.element.id : ''}`;
    }

    // Stop selection mode
    stopSelectionMode();

    // TODO: In Phase 4, this will trigger the extraction and editor UI
    console.log('Element selected:', message.element);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
