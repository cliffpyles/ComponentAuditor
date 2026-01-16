/**
 * Component Auditor - IndexedDB Database Wrapper
 * 
 * This module provides a simple interface for storing and retrieving
 * component data using IndexedDB.
 */

(function() {
  'use strict';

  const DB_NAME = 'ComponentAuditorDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'components';

  let dbInstance = null;

  /**
   * Open the IndexedDB database
   * @returns {Promise<IDBDatabase>} - Promise that resolves to the database instance
   */
  function openDB() {
    return new Promise(function(resolve, reject) {
      // Return existing instance if already open
      if (dbInstance) {
        resolve(dbInstance);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function() {
        console.error('IndexedDB: Failed to open database', request.error);
        reject(request.error);
      };

      request.onsuccess = function() {
        dbInstance = request.result;
        console.log('IndexedDB: Database opened successfully');
        resolve(dbInstance);
      };

      request.onupgradeneeded = function(event) {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'id'
          });
          
          // Create index for label (for searching/filtering in future)
          objectStore.createIndex('label', 'label', { unique: false });
          
          // Create index for timestamp (for sorting)
          objectStore.createIndex('timestamp', 'meta.timestamp', { unique: false });
          
          console.log('IndexedDB: Object store created');
        }
      };
    });
  }

  /**
   * Save a component record to the database
   * @param {Object} data - Component data object (must include 'id' field)
   * @returns {Promise<string>} - Promise that resolves to the saved record ID
   */
  function save(data) {
    return new Promise(function(resolve, reject) {
      if (!data || !data.id) {
        reject(new Error('Component data must include an id field'));
        return;
      }

      openDB()
        .then(function(db) {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const objectStore = transaction.objectStore(STORE_NAME);
          
          const request = objectStore.put(data);

          request.onsuccess = function() {
            console.log('IndexedDB: Component saved successfully', data.id);
            resolve(data.id);
          };

          request.onerror = function() {
            console.error('IndexedDB: Failed to save component', request.error);
            reject(request.error);
          };
        })
        .catch(function(error) {
          reject(error);
        });
    });
  }

  /**
   * Retrieve all component records from the database
   * @returns {Promise<Array>} - Promise that resolves to an array of all component records
   */
  function getAll() {
    return new Promise(function(resolve, reject) {
      openDB()
        .then(function(db) {
          const transaction = db.transaction([STORE_NAME], 'readonly');
          const objectStore = transaction.objectStore(STORE_NAME);
          
          const request = objectStore.getAll();

          request.onsuccess = function() {
            const components = request.result || [];
            console.log('IndexedDB: Retrieved', components.length, 'components');
            resolve(components);
          };

          request.onerror = function() {
            console.error('IndexedDB: Failed to retrieve components', request.error);
            reject(request.error);
          };
        })
        .catch(function(error) {
          reject(error);
        });
    });
  }

  /**
   * Delete a component record from the database
   * @param {string} id - The UUID of the component to delete
   * @returns {Promise<void>} - Promise that resolves when the record is deleted
   */
  function deleteRecord(id) {
    return new Promise(function(resolve, reject) {
      if (!id) {
        reject(new Error('Component ID is required'));
        return;
      }

      openDB()
        .then(function(db) {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const objectStore = transaction.objectStore(STORE_NAME);
          
          const request = objectStore.delete(id);

          request.onsuccess = function() {
            console.log('IndexedDB: Component deleted successfully', id);
            resolve();
          };

          request.onerror = function() {
            console.error('IndexedDB: Failed to delete component', request.error);
            reject(request.error);
          };
        })
        .catch(function(error) {
          reject(error);
        });
    });
  }

  // Export functions to global scope for use in panel.js
  window.ComponentAuditorDB = {
    openDB: openDB,
    save: save,
    getAll: getAll,
    delete: deleteRecord
  };
})();
