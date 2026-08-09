/* db.js
   Poora local storage IndexedDB use karke — koi external library nahi,
   isliye 100% offline reliable hai (CDN pe depend nahi karta).
   Stores:
     - products    : { barcode (key), name, price, qty, updatedAt }
     - pendingSync : { id (auto), barcode, name, price, qty, updatedAt }  -> jo abhi Sheet pe push nahi hue
     - meta        : { key (id/lastSync/settings), value }
     - sales       : { id (auto), items, total, createdAt } -> local bill history
*/

const DB_NAME = 'gomati_mart_db';
const DB_VERSION = 1;
let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'barcode' });
      }
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sales')) {
        db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode) {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  // ---- products ----
  async getAllProducts() {
    const store = await tx('products', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getProduct(barcode) {
    const store = await tx('products', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(barcode);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  // localOnly=true: sirf is device pe save karo, pendingSync queue mein mat daalo
  // (server se aaya hua data merge karte waqt use hota hai)
  async saveProduct(product, queueForSync = true) {
    product.updatedAt = product.updatedAt || Date.now();
    const store = await tx('products', 'readwrite');
    await new Promise((resolve, reject) => {
      const req = store.put(product);
      req.onsuccess = resolve; req.onerror = () => reject(req.error);
    });
    if (queueForSync) {
      const qstore = await tx('pendingSync', 'readwrite');
      qstore.add(Object.assign({}, product));
    }
  },

  async deleteProduct(barcode) {
    const store = await tx('products', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(barcode);
      req.onsuccess = resolve; req.onerror = () => reject(req.error);
    });
  },

  // ---- pending sync queue ----
  async getPendingSync() {
    const store = await tx('pendingSync', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async clearPendingSync(ids) {
    const store = await tx('pendingSync', 'readwrite');
    ids.forEach(id => store.delete(id));
  },

  // ---- meta (settings, last sync time) ----
  async getMeta(key) {
    const store = await tx('meta', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  },

  async setMeta(key, value) {
    const store = await tx('meta', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = resolve; req.onerror = () => reject(req.error);
    });
  },

  // ---- sales / bill history (local only, simple log) ----
  async addSale(sale) {
    sale.createdAt = Date.now();
    const store = await tx('sales', 'readwrite');
    store.add(sale);
  },

  async getRecentSales(limit = 20) {
    const store = await tx('sales', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result.sort((a, b) => b.createdAt - a.createdAt);
        resolve(all.slice(0, limit));
      };
      req.onerror = () => reject(req.error);
    });
  }
};
