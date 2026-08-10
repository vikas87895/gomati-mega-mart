/* products.js - Product master data screen (add/edit + barcode label print) */

const Products = {
  editingBarcode: null,

  init() {
    document.getElementById('productForm').addEventListener('submit', (e) => this.save(e));
    document.getElementById('searchProducts').addEventListener('input', (e) => this.renderList(e.target.value));
    document.getElementById('resetProductForm').addEventListener('click', () => this.resetForm());
    document.getElementById('scanForProductBtn').addEventListener('click', () => this.armScanForForm());
    this.renderList('');
  },

  armScanForForm() {
    this._captureNextScan = true;
    this.showFormMsg('Ab barcode scan karein...');
  },

  handleScanForForm(code) {
    if (this._captureNextScan) {
      document.getElementById('pBarcode').value = code;
      this._captureNextScan = false;
      this.showFormMsg('Barcode fill ho gaya: ' + code);
    }
  },

  showFormMsg(msg) {
    const el = document.getElementById('productFormMsg');
    el.textContent = msg;
    clearTimeout(this._t);
    this._t = setTimeout(() => el.textContent = '', 3000);
  },

  async save(e) {
    e.preventDefault();
    const barcode = document.getElementById('pBarcode').value.trim();
    const name = document.getElementById('pName').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const mrpRaw = document.getElementById('pMrp').value;
    const mrp = mrpRaw === '' ? price : parseFloat(mrpRaw);
    const qtyRaw = document.getElementById('pQty').value;
    const qty = qtyRaw === '' ? null : parseFloat(qtyRaw);
    if (!barcode || !name || isNaN(price)) { alert('Barcode, Name aur Price zaroori hain'); return; }

    await DB.saveProduct({ barcode, name, price, mrp, qty, updatedAt: Date.now() }, true);
    this.resetForm();
    this.renderList(document.getElementById('searchProducts').value);
    this.showFormMsg('✓ Product save ho gaya (jab internet aayega, dusre devices pe apne aap chala jayega)');

    if (navigator.onLine) Sync.syncNow();
  },

  resetForm() {
    document.getElementById('productForm').reset();
    this.editingBarcode = null;
  },

  async edit(barcode) {
    const p = await DB.getProduct(barcode);
    if (!p) return;
    document.getElementById('pBarcode').value = p.barcode;
    document.getElementById('pName').value = p.name;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pMrp').value = (p.mrp === undefined || p.mrp === null) ? '' : p.mrp;
    document.getElementById('pQty').value = p.qty === null || p.qty === undefined ? '' : p.qty;
    this.editingBarcode = barcode;
    window.scrollTo(0, 0);
  },

  async remove(barcode) {
    if (!confirm('Ye product delete karein?')) return;
    await DB.deleteProduct(barcode);
    this.renderList(document.getElementById('searchProducts').value);
  },

  async printQR(barcode) {
    const p = await DB.getProduct(barcode);
    if (!p) return;
    try {
      await QRPrinter.printQRLabel(p);
      this.showFormMsg('✓ Label printer ko command bhej di gayi (barcode: ' + p.barcode + ')');
    } catch (err) {
      alert('Label print nahi ho paya: ' + err.message + '\n\nSettings screen mein ja kar "QR Label Printer Pair Karein" try karein.');
    }
  },

  async renderList(filter) {
    const all = await DB.getAllProducts();
    filter = (filter || '').toLowerCase();
    const filtered = all.filter(p =>
      p.name.toLowerCase().includes(filter) || p.barcode.includes(filter)
    ).sort((a, b) => a.name.localeCompare(b.name));

    const tbody = document.getElementById('productListBody');
    tbody.innerHTML = '';
    filtered.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.barcode)}</td>
        <td>₹${Number(p.price).toFixed(2)}</td>
        <td>${p.qty === null || p.qty === undefined ? '-' : p.qty}</td>
        <td class="actions">
          <button data-action="edit" data-bc="${p.barcode}">Edit</button>
          <button data-action="qr" data-bc="${p.barcode}">Label Print</button>
          <button data-action="del" data-bc="${p.barcode}" class="btn-danger">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const bc = e.target.dataset.bc, action = e.target.dataset.action;
        if (action === 'edit') this.edit(bc);
        else if (action === 'del') this.remove(bc);
        else if (action === 'qr') this.printQR(bc);
      });
    });
    document.getElementById('productCount').textContent = filtered.length + ' products';
  }
};
