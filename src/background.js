/**
 * Component Auditor - Background Service Worker
 * 
 * This service worker acts as the communication bridge between:
 * - DevTools panel (isolated context)
 * - Content scripts (page context)
 * - Extension APIs (storage, tabs, etc.)
 * 
 * It manages connections and ensures proper cleanup when DevTools closes.
 */

(function() {
  'use strict';

  // Store active connections by tabId
  const panelConnections = new Map();
  const contentConnections = new Map();

  /**
   * Handle incoming connections from DevTools panel or content scripts
   */
  chrome.runtime.onConnect.addListener(function(port) {
    console.log('Background: Connection received', port.name, {
      sender: port.sender,
      hasTab: !!(port.sender && port.sender.tab)
    });

    // Handle DevTools Panel Connections
    if (port.name === 'devtools-panel') {
      const initListener = function(message) {
        if (message.type === 'DEVTOOLS_CONNECTED' && message.tabId) {
          const tabId = message.tabId;
          console.log(`Background: Registered DevTools panel for tab ${tabId}`);
          panelConnections.set(tabId, port);
          port.onMessage.removeListener(initListener);
          
          // Setup cleanup
          port.onDisconnect.addListener(function() {
            console.log(`Background: DevTools panel disconnected for tab ${tabId}`);
            panelConnections.delete(tabId);
            handlePanelDisconnected(tabId);
          });
        }
      };
      port.onMessage.addListener(initListener);
    }
    
    // Handle Content Script Connections
    else if (port.name.startsWith('content-script')) {
      let tabId = null;
      if (port.sender && port.sender.tab) {
        tabId = port.sender.tab.id;
        console.log(`Background: Registered content script for tab ${tabId}`);
        contentConnections.set(tabId, port);
      }
      
      // Setup cleanup
      port.onDisconnect.addListener(function() {
        if (tabId) {
          console.log(`Background: Content script disconnected for tab ${tabId}`);
          contentConnections.delete(tabId);
        } else {
          console.log('Background: Content script disconnected (unknown tabId)');
        }
      });
    }

    /**
     * Handle messages from connected ports
     */
    port.onMessage.addListener(function(message) {
      // Ignore initial connection messages here (handled above)
      if (message.type === 'DEVTOOLS_CONNECTED' || message.type === 'CONTENT_SCRIPT_READY') {
        return;
      }

      console.log('Background: Message received via port', message.type);

      // Route messages based on type
      switch (message.type) {
        case 'PANEL_SHOWN':
          handlePanelShown(message.tabId);
          break;
        
        case 'PANEL_HIDDEN':
          handlePanelHidden(message.tabId);
          break;
        
        case 'ELEMENT_SELECTED':
          // Forward element selection to DevTools panel
          // Try to find the target tabId from the message, or the port
          let targetTabId = message.tabId;
          
          if (!targetTabId && port.sender && port.sender.tab) {
            targetTabId = port.sender.tab.id;
          }

          if (targetTabId) {
            console.log(`Background: Forwarding ELEMENT_SELECTED to panel for tab ${targetTabId}`);
            forwardToDevToolsPanel(targetTabId, message);
          } else {
            console.error('Background: Could not determine tabId for ELEMENT_SELECTED');
          }
          break;
        
        case 'START_SELECTION':
          if (message.tabId) {
            forwardToContentScript(message.tabId, { type: 'START_SELECTION' });
          }
          break;
        
        case 'STOP_SELECTION':
          if (message.tabId) {
            forwardToContentScript(message.tabId, { type: 'STOP_SELECTION' });
          }
          break;
        
        case 'CAPTURE_SCREENSHOT':
          if (message.tabId) {
            captureScreenshot(message.tabId, port);
          }
          break;
        
        default:
          console.warn('Background: Unknown message type', message.type);
      }
    });
  });

  /**
   * Handle messages sent via chrome.runtime.sendMessage (fallback for content scripts)
   */
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Background: Message received via onMessage', message.type);
    
    // Handle ELEMENT_SELECTED messages from content scripts
    if (message.type === 'ELEMENT_SELECTED' && sender.tab) {
      const tabId = sender.tab.id;
      console.log(`Background: Forwarding ELEMENT_SELECTED (via onMessage) to panel for tab ${tabId}`);
      forwardToDevToolsPanel(tabId, message);
      return true;
    }
    
    return false;
  });

  /**
   * Handle panel shown event
   */
  function handlePanelShown(tabId) {
    if (tabId) {
      forwardToContentScript(tabId, {
        type: 'DEVTOOLS_ACTIVE',
        tabId: tabId
      });
    }
  }

  /**
   * Handle panel hidden event
   */
  function handlePanelHidden(tabId) {
    if (tabId) {
      forwardToContentScript(tabId, {
        type: 'DEVTOOLS_INACTIVE',
        tabId: tabId
      });
    }
  }

  /**
   * Handle panel disconnection (safety switch)
   */
  function handlePanelDisconnected(tabId) {
    if (tabId) {
      forwardToContentScript(tabId, {
        type: 'DEVTOOLS_DISCONNECTED',
        tabId: tabId
      });
    }
  }

  /**
   * Forward message to DevTools panel for a specific tab
   */
  function forwardToDevToolsPanel(tabId, message) {
    const port = panelConnections.get(tabId);
    if (port) {
      port.postMessage(message);
    } else {
      console.warn(`Background: No DevTools panel connection found for tab ${tabId}`);
    }
  }

  /**
   * Forward message to content script for a specific tab
   */
  function forwardToContentScript(tabId, message) {
    // Try to use port first
    const port = contentConnections.get(tabId);
    if (port) {
      try {
        port.postMessage(message);
        return;
      } catch (e) {
        console.warn('Background: Failed to send via port, falling back to tabs.sendMessage', e);
        contentConnections.delete(tabId);
      }
    }
    
    // Fallback to tabs.sendMessage
    chrome.tabs.sendMessage(tabId, message).catch(err => {
      // Ignore errors about closed connection/tab
      console.log(`Background: Message delivery failed for tab ${tabId}`, err.message);
    });
  }

  /**
   * Capture screenshot of a tab
   */
  function captureScreenshot(tabId, port) {
    console.log(`Background: Capturing screenshot for tab ${tabId}`);
    
    chrome.tabs.get(tabId, function(tab) {
      if (chrome.runtime.lastError) {
        console.error('Background: Error getting tab', chrome.runtime.lastError);
        port.postMessage({
          type: 'SCREENSHOT_ERROR',
          error: chrome.runtime.lastError.message
        });
        return;
      }

      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, function(dataUrl) {
        if (chrome.runtime.lastError) {
          console.error('Background: Screenshot capture error', chrome.runtime.lastError);
          port.postMessage({
            type: 'SCREENSHOT_ERROR',
            error: chrome.runtime.lastError.message
          });
          return;
        }

        port.postMessage({
          type: 'SCREENSHOT_CAPTURED',
          dataUrl: dataUrl,
          tabId: tabId
        });
      });
    });
  }

  /**
   * Handle extension installation
   */
  chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Component Auditor installed/updated', details.reason);
  });

  console.log('Component Auditor background service worker initialized');
})();