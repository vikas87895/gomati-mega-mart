/* billing.js - Bill banane ki screen */

const Billing = {
  cart: [], // { barcode, name, price, mrp, qty }

  init() {
    Scanner.init((code) => this.addByBarcode(code));
    document.getElementById('manualAddForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('manualName').value.trim();
      const price = parseFloat(document.getElementById('manualPrice').value);
      const qty = parseFloat(document.getElementById('manualQty').value) || 1;
      if (!name || isNaN(price)) return;
      this.addLine({ barcode: '', name, price, mrp: price, qty });
      e.target.reset();
      document.getElementById('manualName').focus();
    });
    document.getElementById('printBillBtn').addEventListener('click', () => this.printBill());
    document.getElementById('clearBillBtn').addEventListener('click', () => this.clearCart());
    this.render();
  },

  async addByBarcode(code) {
    const product = await DB.getProduct(code);
    if (!product) {
      this.showScanMsg(`Barcode "${code}" mila nahi. Pehle Products screen se add karein, ya manually neeche add karein.`, true);
      return;
    }
    this.addLine({ barcode: product.barcode, name: product.name, price: product.price, mrp: product.mrp || product.price, qty: 1 });
    this.showScanMsg(`✓ ${product.name} add hua`, false);
  },

  addLine(line) {
    if (line.barcode) {
      const existing = this.cart.find(c => c.barcode === line.barcode);
      if (existing) { existing.qty += line.qty; this.render(); return; }
    }
    this.cart.push(line);
    this.render();
  },

  removeLine(index) { this.cart.splice(index, 1); this.render(); },

  updateQty(index, qty) {
    qty = parseFloat(qty);
    if (isNaN(qty) || qty <= 0) return;
    this.cart[index].qty = qty;
    this.render();
  },

  clearCart() {
    this.cart = [];
    document.getElementById('customerName').value = '';
    document.getElementById('customerMobile').value = '';
    this.render();
  },

  getTotal() { return this.cart.reduce((sum, c) => sum + c.qty * c.price, 0); },

  showScanMsg(msg, isError) {
    const el = document.getElementById('scanMsg');
    el.textContent = msg;
    el.className = isError ? 'scan-msg error' : 'scan-msg ok';
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(() => { el.textContent = ''; }, 3000);
  },

  render() {
    const tbody = document.getElementById('cartBody');
    tbody.innerHTML = '';
    this.cart.forEach((line, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(line.name)}</td>
        <td><input type="number" step="any" value="${line.qty}" class="qty-input" data-i="${i}"></td>
        <td>₹${line.price.toFixed(2)}</td>
        <td>₹${(line.qty * line.price).toFixed(2)}</td>
        <td><button class="btn-remove" data-i="${i}">✕</button></td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.qty-input').forEach(inp => {
      inp.dataset.scannerIgnore = 'true';
      inp.addEventListener('change', (e) => this.updateQty(e.target.dataset.i, e.target.value));
    });
    tbody.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => this.removeLine(e.target.dataset.i));
    });
    document.getElementById('billTotal').textContent = '₹' + this.getTotal().toFixed(2);
  },

  async getNextBillNo() {
    let n = await DB.getMeta('nextBillNo');
    if (!n) {
      const starting = await DB.getMeta('startingBillNo');
      n = starting ? parseInt(starting, 10) : 1;
    }
    await DB.setMeta('nextBillNo', n + 1);
    return n;
  },

  async printBill() {
    if (this.cart.length === 0) { alert('Cart khali hai'); return; }
    const shop = {
      name: (await DB.getMeta('shopName')) || 'Gomati Mega Mart',
      address: (await DB.getMeta('shopAddress')) || '',
      phone: (await DB.getMeta('shopPhone')) || '',
      gstin: (await DB.getMeta('gstin')) || ''
    };
    const customer = {
      name: document.getElementById('customerName').value.trim(),
      mobile: document.getElementById('customerMobile').value.trim()
    };

    try {
      const billNo = await this.getNextBillNo();
      await BillPrinter.printBill(shop, customer, billNo, this.cart);
      await DB.addSale({ billNo, customer, items: this.cart, total: this.getTotal() });
      this.clearCart();
    } catch (err) {
      alert('Print nahi ho paya: ' + err.message + '\n\nSettings screen mein ja kar "Bill Printer Pair Karein" try karein.');
    }
  }
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
