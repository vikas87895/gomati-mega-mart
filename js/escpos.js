/* escpos.js
   WebUSB API ka use karke USB printers ko seedha commands bhejta hai.
   - Bill Printer (RP3200 jaisa): ESC/POS commands
   - Label Printer (LP46 jaisa): TSPL commands (barcode label ke liye)

   NOTE: WebUSB sirf Chrome (Android) mein kaam karta hai aur HTTPS chahiye
   (GitHub Pages HTTPS deta hai, isliye theek rahega).
*/

const ESC = 0x1b, GS = 0x1d;

function textToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code < 256 ? code : 63); // unknown char -> '?'
  }
  return bytes;
}

function padRight(str, len) { str = String(str); return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length); }
function padLeft(str, len) { str = String(str); return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str; }

// Bill ka total amount shabdon mein likhta hai (Indian numbering - lakh/crore)
function numberToWordsIndian(num) {
  num = Math.round(num);
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function threeDigits(n) {
    let str = '';
    if (n >= 100) { str += ones[Math.floor(n / 100)] + ' Hundred'; n = n % 100; if (n) str += ' '; }
    if (n) str += twoDigits(n);
    return str;
  }

  let crore = Math.floor(num / 10000000); num %= 10000000;
  let lakh = Math.floor(num / 100000); num %= 100000;
  let thousand = Math.floor(num / 1000); num %= 1000;
  let rest = num;

  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

class ThermalPrinter {
  constructor(storageKey) {
    this.storageKey = storageKey; // 'billPrinterDevice' ya 'qrPrinterDevice'
    this.device = null;
    this.endpointOut = null;
  }

  async requestAndPair() {
    if (!navigator.usb) throw new Error('Ye browser WebUSB support nahi karta. Chrome (Android) use karein.');
    const device = await navigator.usb.requestDevice({ filters: [] });
    await this.openDevice(device);
    return device;
  }

  async openDevice(device) {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Kayi printers mein ek se zyada interfaces hote hain - jo pehla claim ho
    // jaaye wahi use karte hain.
    const candidates = [];
    for (const config of device.configurations || [device.configuration]) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          const outEp = alt.endpoints.find(ep => ep.direction === 'out');
          if (outEp) {
            candidates.push({ interfaceNumber: iface.interfaceNumber, endpointNumber: outEp.endpointNumber });
          }
        }
      }
    }

    if (candidates.length === 0) {
      throw new Error('Printer ka USB OUT endpoint nahi mila. USB cable/port badal ke dekhein.');
    }

    const attemptErrors = [];
    let claimed = null;
    for (const c of candidates) {
      try {
        await device.claimInterface(c.interfaceNumber);
        claimed = c;
        break;
      } catch (err) {
        attemptErrors.push(`Interface ${c.interfaceNumber}: ${err.message}`);
      }
    }

    if (!claimed) {
      throw new Error(
        'Printer se connect nahi ho paya (' + candidates.length + ' interface try kiye, sab fail).\n' +
        attemptErrors.join('\n') + '\n\n' +
        'Ye try karein:\n' +
        '1. Printer ko USB cable se nikaal ke dobara lagayein\n' +
        '2. Phone ki koi bhi "Printer" ya "USB" app band karein\n' +
        '3. Chrome ko poori tarah band karke dobara kholein\n' +
        '4. Phone restart karke ek baar try karein'
      );
    }

    this.device = device;
    this.interfaceNumber = claimed.interfaceNumber;
    this.endpointOut = claimed.endpointNumber;
  }

  async reconnectSaved() {
    if (!navigator.usb) return false;
    const devices = await navigator.usb.getDevices();
    const savedId = localStorage.getItem(this.storageKey);
    if (!savedId) return false;
    const found = devices.find(d => (d.vendorId + ':' + d.productId) === savedId);
    if (!found) return false;
    await this.openDevice(found);
    return true;
  }

  saveAsDefault() {
    if (this.device) {
      localStorage.setItem(this.storageKey, this.device.vendorId + ':' + this.device.productId);
    }
  }

  async send(bytes) {
    if (!this.device) {
      const reconnected = await this.reconnectSaved();
      if (!reconnected) throw new Error('Printer connected nahi hai. Settings mein ja kar printer pair karein.');
    }
    const data = new Uint8Array(bytes);
    await this.device.transferOut(this.endpointOut, data);
  }

  // ---- BILL PRINTER (ESC/POS) ----
  // shop: {name, address, phone, gstin}
  // customer: {name, mobile}
  // items: [{ name, qty, price, mrp }]
  async printBill(shop, customer, billNo, items) {
    const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
    const totalMRP = items.reduce((s, it) => s + it.qty * (it.mrp || it.price), 0);
    const savings = totalMRP - subtotal;
    const itemQty = items.reduce((s, it) => s + it.qty, 0);
    const grandTotal = Math.round(subtotal);
    const roundOff = grandTotal - subtotal;

    const now = new Date();
    let cmds = [];
    cmds.push(ESC, 0x40); // init

    cmds.push(ESC, 0x61, 1); // center
    if (shop.gstin) cmds = cmds.concat(textToBytes(shop.gstin + '\n'));
    cmds.push(ESC, 0x45, 1);
    cmds = cmds.concat(textToBytes((shop.name || '') + '\n'));
    cmds.push(ESC, 0x45, 0);
    if (shop.address) cmds = cmds.concat(textToBytes(shop.address + '\n'));
    if (shop.phone) cmds = cmds.concat(textToBytes('Ph: ' + shop.phone + '\n'));
    cmds = cmds.concat(textToBytes('--------------------------------\n'));

    cmds.push(ESC, 0x61, 0); // left
    cmds = cmds.concat(textToBytes('Customer: ' + (customer.name || 'Cash') + '\n'));
    if (customer.mobile) cmds = cmds.concat(textToBytes('Mobile: ' + customer.mobile + '\n'));
    cmds = cmds.concat(textToBytes(`Bill No: ${billNo}   Date: ${now.toLocaleDateString('en-IN')}\n`));
    cmds = cmds.concat(textToBytes(`Time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n`));
    cmds = cmds.concat(textToBytes('--------------------------------\n'));

    items.forEach((it, i) => {
      const nameLine = `${i + 1}. ${it.name}`.substring(0, 32);
      cmds = cmds.concat(textToBytes(nameLine + '\n'));
      const mrp = Number(it.mrp || it.price).toFixed(2);
      const rate = Number(it.price).toFixed(2);
      const amt = (it.qty * it.price).toFixed(2);
      const detailLine = `Qty:${it.qty} MRP:${mrp} Rate:${rate}`;
      cmds = cmds.concat(textToBytes(padRight(detailLine, 24) + padLeft(amt, 8) + '\n'));
    });

    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds = cmds.concat(textToBytes(padRight('Item Qty:', 20) + padLeft(String(itemQty), 12) + '\n'));
    cmds = cmds.concat(textToBytes(padRight('Total MRP Value:', 20) + padLeft(totalMRP.toFixed(2), 12) + '\n'));
    cmds = cmds.concat(textToBytes(padRight('Your Savings:', 20) + padLeft(savings.toFixed(2), 12) + '\n'));
    cmds = cmds.concat(textToBytes(padRight('Sub Total:', 20) + padLeft(subtotal.toFixed(2), 12) + '\n'));
    cmds = cmds.concat(textToBytes(padRight('Round off:', 20) + padLeft(roundOff.toFixed(2), 12) + '\n'));
    cmds.push(ESC, 0x45, 1);
    cmds = cmds.concat(textToBytes(padRight('G. TOTAL:', 20) + padLeft(grandTotal.toFixed(2), 12) + '\n'));
    cmds.push(ESC, 0x45, 0);
    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds = cmds.concat(textToBytes('Rs ' + numberToWordsIndian(grandTotal) + ' only\n'));
    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds = cmds.concat(textToBytes('Goods once sold will not be taken\nback & no cash refund\n'));

    cmds.push(ESC, 0x61, 1); // center
    cmds = cmds.concat(textToBytes('\nFor ' + (shop.name || '') + '\n'));
    cmds.push(0x0a, 0x0a, 0x0a);
    cmds.push(GS, 0x56, 0x41, 0x10); // partial cut
    await this.send(cmds);

    return grandTotal;
  }

  // ---- LABEL PRINTER (TSPL) ----
  // Barcode label: Shop name, MRP, product name, barcode (jaise purane "KAJU" sticker mein tha)
  // Label size: 50mm x 25mm (agar tumhara label size alag ho to SIZE/GAP line badal dena)
  async printQRLabel(product) {
    const shopName = (await DB.getMeta('shopName')) || '';
    const cleanName = String(product.name).replace(/["\r\n]/g, '').substring(0, 24);
    const mrp = Number(product.mrp || product.price).toFixed(2);
    const barcodeValue = String(product.barcode).replace(/["\r\n]/g, '');

    const tspl =
      'SIZE 50 mm, 25 mm\r\n' +
      'GAP 2 mm, 0 mm\r\n' +
      'DIRECTION 0\r\n' +
      'REFERENCE 0,0\r\n' +
      'CLS\r\n' +
      `TEXT 20,8,"2",0,1,1,"${shopName.substring(0, 22)}"\r\n` +
      `TEXT 20,35,"2",0,1,1,"MRP: ${mrp}"\r\n` +
      `TEXT 20,60,"2",0,1,1,"${cleanName}"\r\n` +
      `BARCODE 20,90,"128",50,1,0,2,4,"${barcodeValue}"\r\n` +
      'PRINT 1,1\r\n';

    await this.send(textToBytes(tspl));
  }
}

const BillPrinter = new ThermalPrinter('billPrinterDevice');
const QRPrinter = new ThermalPrinter('qrPrinterDevice');
