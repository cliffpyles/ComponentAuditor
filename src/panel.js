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
      
      case 'SCREENSHOT_CAPTURED':
        handleScreenshotCaptured(message);
        break;
      
      case 'SCREENSHOT_ERROR':
        handleScreenshotError(message);
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
      statusMessage.textContent = `Element selected. Capturing screenshot...`;
    }

    // Stop selection mode
    stopSelectionMode();

    // Store element info, rect, code data, and meta data for later use
    const elementInfo = message.element;
    const elementRect = message.rect;
    const codeData = message.code || {};
    const metaData = message.meta || {};

    console.log('Element selected:', elementInfo, elementRect);
    console.log('Code data extracted:', codeData);
    console.log('Meta data extracted:', metaData);

    // Request screenshot from background script
    if (port && tabId) {
      port.postMessage({
        type: 'CAPTURE_SCREENSHOT',
        tabId: tabId
      });
      
      // Store element info temporarily for when screenshot arrives
      window.__CA_PENDING_ELEMENT__ = {
        element: elementInfo,
        rect: elementRect,
        code: codeData,
        meta: metaData
      };
    } else {
      console.error('Panel: Cannot request screenshot - port or tabId not available');
      if (statusMessage) {
        statusMessage.textContent = 'Error: Could not capture screenshot.';
      }
    }
  }

  /**
   * Handle screenshot capture completion
   */
  function handleScreenshotCaptured(message) {
    const statusMessage = document.getElementById('status-message');
    const pendingElement = window.__CA_PENDING_ELEMENT__;
    
    if (!pendingElement) {
      console.error('Panel: Received screenshot but no pending element info');
      if (statusMessage) {
        statusMessage.textContent = 'Error: Screenshot captured but element info missing.';
      }
      return;
    }

    if (statusMessage) {
      statusMessage.textContent = 'Cropping screenshot...';
    }

    // Crop the screenshot to the element's bounds
    cropScreenshot(message.dataUrl, pendingElement.rect)
      .then(function(croppedDataUrl) {
        console.log('Panel: Screenshot cropped successfully');
        
        // Store the cropped screenshot, code data, and meta data (will be used in Phase 4 for the editor)
        window.__CA_CROPPED_SCREENSHOT__ = croppedDataUrl;
        window.__CA_EXTRACTED_CODE__ = pendingElement.code || {};
        window.__CA_EXTRACTED_META__ = pendingElement.meta || {};
        
        if (statusMessage) {
          const element = pendingElement.element;
          const codeData = pendingElement.code || {};
          const metaData = pendingElement.meta || {};
          const hasLineage = codeData.lineage && codeData.lineage.length > 0;
          const hasSiblings = codeData.siblings && (codeData.siblings.previousSibling || codeData.siblings.nextSibling);
          const tokens = codeData.tokens || {};
          const hasTokens = tokens.colors || tokens.fonts || tokens.spacing || tokens.border || tokens.shadows;
          const frameworks = metaData.frameworks || [];
          
          const codeInfo = [];
          if (codeData.html) codeInfo.push('HTML');
          if (hasLineage) codeInfo.push(`${codeData.lineage.length} ancestors`);
          if (hasSiblings) codeInfo.push('siblings');
          if (hasTokens) codeInfo.push('tokens');
          if (frameworks.length > 0) codeInfo.push(`${frameworks.length} framework(s)`);
          
          let statusText = `Element captured: ${element.tagName}${element.className ? '.' + element.className.split(' ')[0] : ''}${element.id ? '#' + element.id : ''}`;
          if (codeInfo.length > 0) {
            statusText += ` (${codeInfo.join(', ')})`;
          }
          statusMessage.textContent = statusText;
        }

        // Clean up pending element
        delete window.__CA_PENDING_ELEMENT__;
      })
      .catch(function(error) {
        console.error('Panel: Error cropping screenshot', error);
        if (statusMessage) {
          statusMessage.textContent = 'Error: Could not crop screenshot.';
        }
        delete window.__CA_PENDING_ELEMENT__;
      });
  }

  /**
   * Handle screenshot capture error
   */
  function handleScreenshotError(message) {
    const statusMessage = document.getElementById('status-message');
    
    console.error('Panel: Screenshot error', message.error);
    
    if (statusMessage) {
      statusMessage.textContent = `Error: ${message.error}`;
    }

    // Clean up pending element
    delete window.__CA_PENDING_ELEMENT__;
  }

  /**
   * Crop screenshot to element bounds using HTML5 Canvas
   * @param {string} dataUrl - Base64 data URL of the full screenshot
   * @param {Object} rect - Element bounding rectangle with x, y, width, height, viewportX, viewportY
   * @returns {Promise<string>} - Promise that resolves to cropped Base64 data URL
   */
  function cropScreenshot(dataUrl, rect) {
    return new Promise(function(resolve, reject) {
      try {
        // Create an image element to load the screenshot
        const img = new Image();
        
        img.onload = function() {
          try {
            // Get device pixel ratio to account for high-DPI displays
            // Screenshots are captured at device pixel ratio, so we need to scale coordinates
            const devicePixelRatio = window.devicePixelRatio || 1;
            
            // Calculate crop coordinates
            // Screenshot is captured at device pixel ratio, so we need to scale the viewport coordinates
            const cropX = rect.viewportX * devicePixelRatio;
            const cropY = rect.viewportY * devicePixelRatio;
            const cropWidth = rect.width * devicePixelRatio;
            const cropHeight = rect.height * devicePixelRatio;

            // Ensure crop dimensions don't exceed image dimensions
            const actualCropX = Math.max(0, Math.min(cropX, img.width));
            const actualCropY = Math.max(0, Math.min(cropY, img.height));
            const actualCropWidth = Math.min(cropWidth, img.width - actualCropX);
            const actualCropHeight = Math.min(cropHeight, img.height - actualCropY);

            // Create canvas for cropping
            const canvas = document.createElement('canvas');
            canvas.width = actualCropWidth;
            canvas.height = actualCropHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            // Draw the cropped portion of the image
            ctx.drawImage(
              img,
              actualCropX, actualCropY, actualCropWidth, actualCropHeight,  // Source rectangle
              0, 0, actualCropWidth, actualCropHeight  // Destination rectangle
            );

            // Export as Base64 PNG
            const croppedDataUrl = canvas.toDataURL('image/png');
            resolve(croppedDataUrl);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = function() {
          reject(new Error('Failed to load screenshot image'));
        };

        // Load the image
        img.src = dataUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
