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
    // Get port and tabId from devtools.js
    port = window.devToolsPort;
    tabId = window.devToolsTabId;

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

    // Listen for messages from devtools.js
    window.addEventListener('message', function(event) {
      // Only accept messages from our extension
      if (event.data && event.data.type) {
        handleMessage(event.data);
      }
    });

    // Listen for messages from port (background script)
    if (port) {
      port.onMessage.addListener(function(message) {
        handleMessage(message);
      });
    }

    console.log('Component Auditor panel UI initialized');
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
    if (port && tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'START_SELECTION'
      }).catch(err => {
        console.error('Panel: Could not send START_SELECTION message', err);
        if (statusMessage) {
          statusMessage.textContent = 'Error: Could not start selection mode.';
        }
        isSelectionMode = false;
        if (selectBtn) {
          selectBtn.textContent = 'Select Component';
          selectBtn.classList.remove('active');
        }
      });
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
      chrome.tabs.sendMessage(tabId, {
        type: 'STOP_SELECTION'
      }).catch(err => {
        console.warn('Panel: Could not send STOP_SELECTION message', err);
      });
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
