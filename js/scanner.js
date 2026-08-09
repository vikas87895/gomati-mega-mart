/* scanner.js
   USB barcode scanner (jo keyboard ki tarah kaam karta hai - scan karte hi
   characters type ho jate hain aur end mein Enter aata hai) ko capture karta hai.
   Isme koi special API nahi chahiye - browser ko wo normal typing hi lagti hai.
*/

const Scanner = {
  buffer: '',
  lastKeyTime: 0,
  onScan: null, // callback(barcode)

  init(onScanCallback) {
    this.onScan = onScanCallback;
    document.addEventListener('keydown', (e) => this.handleKey(e));
  },

  handleKey(e) {
    // Agar user kisi normal text input/textarea mein type kar raha hai
    // (jaise manual add form), to scanner capture skip karo.
    const active = document.activeElement;
    const isTypingField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
      active.dataset.scannerIgnore === 'true';
    if (isTypingField) return;

    const now = Date.now();
    // Scanner bahut fast type karta hai (har character < 50ms mein).
    // Agar gap zyada hai to naya scan maano (purana buffer reset).
    if (now - this.lastKeyTime > 100) {
      this.buffer = '';
    }
    this.lastKeyTime = now;

    if (e.key === 'Enter') {
      if (this.buffer.length >= 3) {
        const code = this.buffer.trim();
        this.buffer = '';
        if (this.onScan) this.onScan(code);
      }
      this.buffer = '';
      return;
    }

    if (e.key.length === 1) {
      this.buffer += e.key;
    }
  }
};
