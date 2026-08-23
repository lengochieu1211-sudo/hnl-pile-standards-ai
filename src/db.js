const DB_NAME = 'hnl-pile-standards-ai';
const DB_VERSION = 2;
const STORES = Object.freeze({
  documents: 'documents',
  chatSessions: 'chatSessions',
  calculations: 'calculations'
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.documents)) db.createObjectStore(STORES.documents, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.chatSessions)) {
        const store = db.createObjectStore(STORES.chatSessions, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.calculations)) {
        const store = db.createObjectStore(STORES.calculations, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  }));
}

function getAll(storeName) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  }));
}

function remove(storeName, id) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

export function saveDocument(doc) { return put(STORES.documents, doc); }
export function getDocuments() { return getAll(STORES.documents); }
export function deleteDocument(id) { return remove(STORES.documents, id); }

export function saveChatSession(session) { return put(STORES.chatSessions, session); }
export async function getChatSessions() {
  const rows = await getAll(STORES.chatSessions);
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}
export function deleteChatSession(id) { return remove(STORES.chatSessions, id); }

export function saveCalculation(entry) { return put(STORES.calculations, entry); }
export async function getCalculations() {
  const rows = await getAll(STORES.calculations);
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
export function deleteCalculation(id) { return remove(STORES.calculations, id); }
