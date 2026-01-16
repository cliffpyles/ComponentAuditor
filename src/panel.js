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
        
        // Store the cropped screenshot, code data, and meta data
        window.__CA_CROPPED_SCREENSHOT__ = croppedDataUrl;
        window.__CA_EXTRACTED_CODE__ = pendingElement.code || {};
        window.__CA_EXTRACTED_META__ = pendingElement.meta || {};
        window.__CA_ELEMENT_RECT__ = pendingElement.rect || {};
        window.__CA_ELEMENT_INFO__ = pendingElement.element || {};
        
        // Show the editor with populated data
        showEditor();

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
   * Show the editor panel with captured component data
   */
  function showEditor() {
    const emptyState = document.getElementById('empty-state');
    const editorContainer = document.getElementById('editor-container');
    
    if (!emptyState || !editorContainer) {
      console.error('Panel: Editor elements not found');
      return;
    }
    
    // Hide empty state and show editor
    emptyState.style.display = 'none';
    editorContainer.classList.add('active');
    
    // Populate the editor with captured data
    populateEditor();
    
    // Setup form event handlers
    setupFormHandlers();
  }

  /**
   * Hide the editor and return to empty state
   */
  function hideEditor() {
    const emptyState = document.getElementById('empty-state');
    const editorContainer = document.getElementById('editor-container');
    
    if (!emptyState || !editorContainer) {
      return;
    }
    
    // Show empty state and hide editor
    emptyState.style.display = 'flex';
    editorContainer.classList.remove('active');
    
    // Reset form
    const form = document.getElementById('component-form');
    if (form) {
      form.reset();
    }
    
    // Clear stored data
    delete window.__CA_CROPPED_SCREENSHOT__;
    delete window.__CA_EXTRACTED_CODE__;
    delete window.__CA_EXTRACTED_META__;
    delete window.__CA_ELEMENT_RECT__;
    delete window.__CA_ELEMENT_INFO__;
  }

  /**
   * Populate the editor with captured component data
   */
  function populateEditor() {
    const screenshotImg = document.getElementById('screenshot-img');
    const codeViewer = document.getElementById('code-viewer');
    const readonlySize = document.getElementById('readonly-size');
    const readonlyFont = document.getElementById('readonly-font');
    const readonlyUrl = document.getElementById('readonly-url');
    
    const croppedScreenshot = window.__CA_CROPPED_SCREENSHOT__;
    const codeData = window.__CA_EXTRACTED_CODE__ || {};
    const metaData = window.__CA_EXTRACTED_META__ || {};
    const elementRect = window.__CA_ELEMENT_RECT__ || {};
    const elementInfo = window.__CA_ELEMENT_INFO__ || {};
    
    // Populate screenshot
    if (screenshotImg && croppedScreenshot) {
      screenshotImg.src = croppedScreenshot;
      screenshotImg.alt = 'Component Screenshot';
    }
    
    // Populate code viewer
    if (codeViewer) {
      const html = codeData.html || '';
      // Truncate very long HTML for display
      if (html.length > 5000) {
        codeViewer.textContent = html.substring(0, 5000) + '\n\n... (truncated)';
      } else {
        codeViewer.textContent = html || 'No HTML available';
      }
    }
    
    // Populate read-only technical data
    if (readonlySize) {
      const width = elementRect.width || 0;
      const height = elementRect.height || 0;
      readonlySize.textContent = `${Math.round(width)} × ${Math.round(height)}px`;
    }
    
    if (readonlyFont) {
      const tokens = codeData.tokens || {};
      const fonts = tokens.fonts || [];
      if (fonts.length > 0) {
        // Extract font-family and font-size from tokens
        const fontFamily = fonts.find(f => f.type === 'font-family')?.value || '';
        const fontSize = fonts.find(f => f.type === 'font-size')?.value || '';
        
        if (fontFamily && fontSize) {
          readonlyFont.textContent = `${fontFamily} ${fontSize}`;
        } else if (fontFamily) {
          readonlyFont.textContent = fontFamily;
        } else if (fontSize) {
          readonlyFont.textContent = `Size: ${fontSize}`;
        } else {
          readonlyFont.textContent = 'N/A';
        }
      } else {
        readonlyFont.textContent = 'N/A';
      }
    }
    
    if (readonlyUrl) {
      const route = metaData.route || '';
      const domain = metaData.domain || '';
      const fullUrl = domain + route;
      readonlyUrl.textContent = fullUrl || 'N/A';
    }
  }

  /**
   * Setup form event handlers
   */
  function setupFormHandlers() {
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const atomicLevelSelect = document.getElementById('atomic-level');
    
    // Handle cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        hideEditor();
      });
    }
    
    // Handle save button
    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        handleSave();
      });
    }
    
    // Handle form validation on change
    if (atomicLevelSelect) {
      atomicLevelSelect.addEventListener('change', function() {
        validateField('atomic-level');
      });
    }
  }

  /**
   * Validate a specific form field
   * @param {string} fieldId - The ID of the field to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + '-error');
    
    if (!field) {
      return true;
    }
    
    let isValid = true;
    
    // Check required fields
    if (field.hasAttribute('required')) {
      const value = field.value.trim();
      isValid = value !== '';
    }
    
    // Show/hide error message
    if (errorElement) {
      if (isValid) {
        errorElement.classList.remove('show');
      } else {
        errorElement.classList.add('show');
      }
    }
    
    // Update field styling
    if (isValid) {
      field.style.borderColor = '#ddd';
    } else {
      field.style.borderColor = '#ea4335';
    }
    
    return isValid;
  }

  /**
   * Validate the entire form
   * @returns {boolean} - True if form is valid, false otherwise
   */
  function validateForm() {
    const atomicLevel = document.getElementById('atomic-level');
    
    let isValid = true;
    
    // Validate required fields
    if (atomicLevel && atomicLevel.hasAttribute('required')) {
      if (!validateField('atomic-level')) {
        isValid = false;
      }
    }
    
    return isValid;
  }

  /**
   * Handle save button click
   */
  function handleSave() {
    // Validate form
    if (!validateForm()) {
      console.log('Panel: Form validation failed');
      return;
    }
    
    // Get form values
    const atomicLevel = document.getElementById('atomic-level')?.value || '';
    const designPattern = document.getElementById('design-pattern')?.value || '';
    const interactionPattern = document.getElementById('interaction-pattern')?.value || '';
    const notes = document.getElementById('notes')?.value || '';
    
    // Prepare component data object
    const componentData = {
      id: generateUUID(),
      label: generateLabel(),
      meta: {
        ...window.__CA_EXTRACTED_META__,
        timestamp: new Date().toISOString()
      },
      visuals: {
        screenshot_base64: window.__CA_CROPPED_SCREENSHOT__,
        dimensions: {
          width: window.__CA_ELEMENT_RECT__?.width || 0,
          height: window.__CA_ELEMENT_RECT__?.height || 0
        }
      },
      code: window.__CA_EXTRACTED_CODE__ || {},
      semantics: {
        atomic_level: atomicLevel,
        design_pattern: designPattern || undefined,
        interaction_pattern: interactionPattern || undefined,
        notes: notes || undefined
      }
    };
    
    console.log('Panel: Component data prepared for save:', componentData);
    
    // Save to IndexedDB
    if (window.ComponentAuditorDB && window.ComponentAuditorDB.save) {
      window.ComponentAuditorDB.save(componentData)
        .then(function(id) {
          console.log('Panel: Component saved successfully with ID:', id);
          
          // Show success message
          const statusMessage = document.getElementById('status-message');
          if (statusMessage) {
            statusMessage.textContent = 'Component saved successfully!';
            statusMessage.style.color = '#34a853';
          }
          
          // Hide editor and return to empty state after a brief delay
          setTimeout(function() {
            hideEditor();
            if (statusMessage) {
              statusMessage.textContent = '';
              statusMessage.style.color = '';
            }
          }, 1500);
        })
        .catch(function(error) {
          console.error('Panel: Failed to save component', error);
          
          // Show error message
          const statusMessage = document.getElementById('status-message');
          if (statusMessage) {
            statusMessage.textContent = 'Error: Failed to save component. ' + error.message;
            statusMessage.style.color = '#ea4335';
          }
        });
    } else {
      console.error('Panel: Database wrapper not available');
      const statusMessage = document.getElementById('status-message');
      if (statusMessage) {
        statusMessage.textContent = 'Error: Database not initialized.';
        statusMessage.style.color = '#ea4335';
      }
    }
  }

  /**
   * Generate a UUID for the component
   * @returns {string} - UUID v4 string
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate a label for the component based on captured data
   * @returns {string} - Generated label
   */
  function generateLabel() {
    const elementInfo = window.__CA_ELEMENT_INFO__ || {};
    const tagName = elementInfo.tagName || 'element';
    const className = elementInfo.className ? elementInfo.className.split(' ')[0] : '';
    const id = elementInfo.id || '';
    
    let label = tagName.toLowerCase();
    if (id) {
      label += '-' + id;
    } else if (className) {
      label += '-' + className;
    }
    
    return label;
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
