/* sync.js
   Google Apps Script Web App (jo Google Sheet ko database ki tarah use karta hai)
   ke saath data sync karta hai. Apps Script URL Settings screen mein save hota hai.
*/

const Sync = {
  isSyncing: false,

  async getScriptUrl() {
    return await DB.getMeta('scriptUrl');
  },

  // Server se latest products le aao, jo naye/updated hain unhe local DB mein merge karo
  async pull() {
    const url = await this.getScriptUrl();
    if (!url) return { ok: false, reason: 'no-url' };
    try {
      const res = await fetch(url + '?action=list', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const serverProducts = data.products || [];
      for (const sp of serverProducts) {
        if (!sp.barcode) continue;
        const local = await DB.getProduct(sp.barcode);
        // Sirf tab overwrite karo jab server ka data local se naya ho
        if (!local || Number(sp.updatedAt) > Number(local.updatedAt || 0)) {
          await DB.saveProduct({
            barcode: String(sp.barcode),
            name: sp.name || '',
            price: Number(sp.price) || 0,
            qty: sp.qty !== undefined ? Number(sp.qty) : null,
            updatedAt: Number(sp.updatedAt) || Date.now()
          }, false); // false = pendingSync queue mein mat daalo, ye already server se aaya h
        }
      }
      await DB.setMeta('lastSync', Date.now());
      return { ok: true, count: serverProducts.length };
    } catch (err) {
      console.warn('Sync pull failed:', err);
      return { ok: false, reason: err.message };
    }
  },

  // Local pending changes server pe bhejo
  async push() {
    const url = await this.getScriptUrl();
    if (!url) return { ok: false, reason: 'no-url' };
    const pending = await DB.getPendingSync();
    if (pending.length === 0) return { ok: true, count: 0 };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script CORS ke liye text/plain best hai
        body: JSON.stringify({ action: 'upsert', products: pending })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await DB.clearPendingSync(pending.map(p => p.id));
      await DB.setMeta('lastSync', Date.now());
      return { ok: true, count: pending.length };
    } catch (err) {
      console.warn('Sync push failed:', err);
      return { ok: false, reason: err.message };
    }
  },

  // Push pehle (apna data bhejo) phir pull (dusro ka naya data lo)
  async syncNow() {
    if (this.isSyncing) return { ok: false, reason: 'already-syncing' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    this.isSyncing = true;
    try {
      const pushResult = await this.push();
      const pullResult = await this.pull();
      return { ok: pushResult.ok && pullResult.ok, pushResult, pullResult };
    } finally {
      this.isSyncing = false;
      if (window.onSyncStatusChange) window.onSyncStatusChange();
    }
  },

  async getLastSyncText() {
    const t = await DB.getMeta('lastSync');
    if (!t) return 'Kabhi sync nahi hua';
    const diffMin = Math.round((Date.now() - t) / 60000);
    const d = new Date(t);
    const timeStr = d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
    if (diffMin < 1) return `Abhi (${timeStr})`;
    if (diffMin < 60) return `${diffMin} min pehle (${timeStr})`;
    return timeStr;
  }
};

// Jab internet wapas aaye, apne aap sync try karo
window.addEventListener('online', () => {
  Sync.syncNow();
});
