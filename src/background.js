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
  const connections = new Map();

  /**
   * Handle incoming connections from DevTools panel or content scripts
   */
  chrome.runtime.onConnect.addListener(function(port) {
    console.log('Background: Connection received', port.name);

    // Extract tabId from port or sender
    let tabId = null;
    
    if (port.sender && port.sender.tab) {
      tabId = port.sender.tab.id;
    } else if (port.name && port.name.includes('tabId')) {
      // If tabId is passed in connection name, extract it
      const match = port.name.match(/tabId:(\d+)/);
      if (match) {
        tabId = parseInt(match[1], 10);
      }
    }

      // For DevTools panel connections, wait for first message with tabId
      if (!tabId && port.name === 'devtools-panel') {
        // DevTools panel will send tabId in first message
        const messageHandler = function(message) {
          if (message.type === 'DEVTOOLS_CONNECTED' && message.tabId) {
            tabId = message.tabId;
            storeConnection(tabId, port);
            // Remove this one-time handler
            port.onMessage.removeListener(messageHandler);
          }
        };
        port.onMessage.addListener(messageHandler);
      }

    // Store connection if we have a tabId
    if (tabId) {
      storeConnection(tabId, port);
    } else {
      // Store connection with a temporary key for non-tab connections
      const tempKey = `temp_${Date.now()}`;
      connections.set(tempKey, port);
    }

    /**
     * Handle messages from connected ports
     */
    port.onMessage.addListener(function(message, senderPort) {
      console.log('Background: Message received', message);

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
          const elementTabId = getTabIdFromPort(senderPort);
          if (elementTabId) {
            forwardToDevToolsPanel(elementTabId, message);
          }
          break;
        
        case 'CONTENT_SCRIPT_READY':
          // Content script is ready (no action needed)
          console.log('Background: Content script ready');
          break;
        
        case 'START_SELECTION':
          // Forward start selection message to content script
          const startTabId = message.tabId || getTabIdFromPort(port) || findTabIdFromConnection(port);
          if (startTabId) {
            forwardToContentScript(startTabId, {
              type: 'START_SELECTION'
            });
          } else {
            console.error('Background: Could not determine tabId for START_SELECTION');
          }
          break;
        
        case 'STOP_SELECTION':
          // Forward stop selection message to content script
          const stopTabId = message.tabId || getTabIdFromPort(port) || findTabIdFromConnection(port);
          if (stopTabId) {
            forwardToContentScript(stopTabId, {
              type: 'STOP_SELECTION'
            });
          } else {
            console.error('Background: Could not determine tabId for STOP_SELECTION');
          }
          break;
        
        default:
          console.warn('Background: Unknown message type', message.type);
      }
    });

    /**
     * Handle disconnection (cleanup)
     */
    port.onDisconnect.addListener(function() {
      console.log('Background: Connection disconnected', port.name);
      
      // Find and remove connection from map
      for (const [key, storedPort] of connections.entries()) {
        if (storedPort === port) {
          connections.delete(key);
          
          // If this was a DevTools panel connection, trigger cleanup
          if (key !== null && typeof key === 'number') {
            handlePanelDisconnected(key);
          }
          break;
        }
      }
    });
  });

  /**
   * Store a connection by tabId
   * If a connection already exists for this tabId, it will be replaced
   */
  function storeConnection(tabId, port) {
    if (tabId) {
      if (connections.has(tabId)) {
        console.log(`Background: Replacing existing connection for tab ${tabId}`);
      }
      connections.set(tabId, port);
      console.log(`Background: Stored connection for tab ${tabId}`);
    }
  }

  /**
   * Handle panel shown event
   */
  function handlePanelShown(tabId) {
    console.log(`Background: Panel shown for tab ${tabId}`);
    
    // Notify content script that DevTools is active
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'DEVTOOLS_ACTIVE',
        tabId: tabId
      }).catch(err => {
        console.warn('Background: Could not send message to content script', err);
      });
    }
  }

  /**
   * Handle panel hidden event
   */
  function handlePanelHidden(tabId) {
    console.log(`Background: Panel hidden for tab ${tabId}`);
    
    // Notify content script that DevTools is inactive
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'DEVTOOLS_INACTIVE',
        tabId: tabId
      }).catch(err => {
        console.warn('Background: Could not send message to content script', err);
      });
    }
  }

  /**
   * Handle panel disconnection (safety switch)
   * This triggers cleanup when DevTools is closed
   */
  function handlePanelDisconnected(tabId) {
    console.log(`Background: Panel disconnected for tab ${tabId} - triggering cleanup`);
    
    // Notify content script to clean up overlay
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'DEVTOOLS_DISCONNECTED',
        tabId: tabId
      }).catch(err => {
        console.warn('Background: Could not send cleanup message to content script', err);
      });
    }
  }

  /**
   * Forward message to DevTools panel for a specific tab
   */
  function forwardToDevToolsPanel(tabId, message) {
    const connection = connections.get(tabId);
    if (connection) {
      connection.postMessage(message);
    } else {
      console.warn(`Background: No DevTools panel connection found for tab ${tabId}`);
    }
  }

  /**
   * Forward message to content script for a specific tab
   */
  function forwardToContentScript(tabId, message) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, message).catch(err => {
        console.warn(`Background: Could not send message to content script for tab ${tabId}`, err);
      });
    } else {
      console.warn('Background: No tabId provided for content script message');
    }
  }

  /**
   * Get tabId from port sender
   */
  function getTabIdFromPort(port) {
    if (port && port.sender && port.sender.tab) {
      return port.sender.tab.id;
    }
    return null;
  }

  /**
   * Find tabId by looking up which connection this port belongs to
   */
  function findTabIdFromConnection(port) {
    for (const [tabId, storedPort] of connections.entries()) {
      if (storedPort === port && typeof tabId === 'number') {
        return tabId;
      }
    }
    return null;
  }

  /**
   * Handle extension installation
   */
  chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Component Auditor installed/updated', details.reason);
  });

  console.log('Component Auditor background service worker initialized');
})();
