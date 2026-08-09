/* app.js - App entry point: screens switch karna, sab kuch initialize karna */

const Screens = ['billing', 'products', 'settings'];

function showScreen(name) {
  Screens.forEach(s => {
    document.getElementById('screen-' + s).style.display = (s === name) ? 'block' : 'none';
    document.getElementById('nav-' + s).classList.toggle('active', s === name);
  });
  location.hash = name;
}

function updateOnlineBadge() {
  const badge = document.getElementById('onlineBadge');
  if (navigator.onLine) {
    badge.textContent = 'Online';
    badge.className = 'badge online';
  } else {
    badge.textContent = 'Offline';
    badge.className = 'badge offline';
  }
}

async function init() {
  await openDB();

  Billing.init();
  Products.init();
  Settings.init();

  // Scanner globally kaam karta hai - jo bhi screen active ho usko route karo
  const originalOnScan = Scanner.onScan;
  Scanner.init((code) => {
    const activeScreen = Screens.find(s => document.getElementById('screen-' + s).style.display !== 'none');
    if (activeScreen === 'products') {
      Products.handleScanForForm(code);
    } else {
      Billing.addByBarcode(code);
    }
  });

  Screens.forEach(s => {
    document.getElementById('nav-' + s).addEventListener('click', () => showScreen(s));
  });
  const initial = location.hash.replace('#', '') || 'billing';
  showScreen(Screens.includes(initial) ? initial : 'billing');

  updateOnlineBadge();
  window.addEventListener('online', updateOnlineBadge);
  window.addEventListener('offline', updateOnlineBadge);

  // App khulte hi ek baar sync try karo (agar online hai aur URL set hai)
  if (navigator.onLine) {
    Sync.syncNow();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW register fail:', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
