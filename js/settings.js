/* settings.js */

const Settings = {
  async init() {
    document.getElementById('settingsForm').addEventListener('submit', (e) => this.save(e));
    document.getElementById('pairBillPrinter').addEventListener('click', () => this.pair(BillPrinter, 'billPrinterStatus'));
    document.getElementById('pairQRPrinter').addEventListener('click', () => this.pair(QRPrinter, 'qrPrinterStatus'));
    document.getElementById('syncNowBtn').addEventListener('click', () => this.syncNow());
    await this.load();
    await this.refreshSyncStatus();
  },

  async load() {
    document.getElementById('shopName').value = (await DB.getMeta('shopName')) || 'Gomati Mega Mart';
    document.getElementById('shopAddress').value = (await DB.getMeta('shopAddress')) || 'Azad Nagar, Hisar';
    document.getElementById('shopPhone').value = (await DB.getMeta('shopPhone')) || '';
    document.getElementById('scriptUrl').value = (await DB.getMeta('scriptUrl')) || '';
  },

  async save(e) {
    e.preventDefault();
    await DB.setMeta('shopName', document.getElementById('shopName').value.trim());
    await DB.setMeta('shopAddress', document.getElementById('shopAddress').value.trim());
    await DB.setMeta('shopPhone', document.getElementById('shopPhone').value.trim());
    await DB.setMeta('scriptUrl', document.getElementById('scriptUrl').value.trim());
    document.getElementById('settingsMsg').textContent = '✓ Settings save ho gayi';
    setTimeout(() => document.getElementById('settingsMsg').textContent = '', 2500);
  },

  async pair(printer, statusElId) {
    try {
      await printer.requestAndPair();
      printer.saveAsDefault();
      document.getElementById(statusElId).textContent = '✓ Paired: ' + (printer.device.productName || 'USB Printer');
    } catch (err) {
      document.getElementById(statusElId).textContent = '✗ ' + err.message;
    }
  },

  async syncNow() {
    const btn = document.getElementById('syncNowBtn');
    btn.disabled = true; btn.textContent = 'Sync ho raha hai...';
    const result = await Sync.syncNow();
    btn.disabled = false; btn.textContent = 'Sync Now';
    await this.refreshSyncStatus();
    if (!result.ok) {
      document.getElementById('syncStatusMsg').textContent =
        result.reason === 'no-url' ? 'Pehle Google Sheet URL settings mein daalein' :
        result.reason === 'offline' ? 'Internet nahi hai - jab connect hoga apne aap sync hoga' :
        'Sync mein dikkat: ' + result.reason;
    } else {
      document.getElementById('syncStatusMsg').textContent = '✓ Sync ho gaya';
    }
  },

  async refreshSyncStatus() {
    document.getElementById('lastSyncText').textContent = await Sync.getLastSyncText();
    const pending = await DB.getPendingSync();
    document.getElementById('pendingSyncText').textContent = pending.length > 0
      ? `${pending.length} changes abhi bhejne baaki hain (internet aane pe apne aap chale jayenge)`
      : 'Sab kuch sync hai';
  }
};

window.onSyncStatusChange = () => { if (Settings.refreshSyncStatus) Settings.refreshSyncStatus(); };
