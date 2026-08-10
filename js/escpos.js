/* escpos.js
   WebUSB API ka use karke USB thermal printer ko seedha ESC/POS raw commands
   bhejta hai. Zyadatar cheap USB bill printer aur QR/barcode label printer
   ESC/POS (ya compatible) commands support karte hain.

   NOTE: WebUSB sirf Chrome (Android) mein kaam karta hai aur HTTPS chahiye
   (GitHub Pages HTTPS deta hai, isliye theek rahega).
*/

const ESC = 0x1b, GS = 0x1d;

function textToBytes(str) {
  // Basic printers Latin/ASCII hi support karte hain achhi tarah.
  // Hindi/unicode text print karne k liye printer ka font support chahiye hoga -
  // isliye receipt mein English/numbers use karna safest hai.
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes.push(code < 256 ? code : 63); // unknown char -> '?'
  }
  return bytes;
}

class ThermalPrinter {
  constructor(storageKey) {
    this.storageKey = storageKey; // 'billPrinterDevice' ya 'qrPrinterDevice' (identify karne k liye)
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

    // TVS RP3200 / LP46 jaise printers mein aksar ek se zyada interfaces hote hain
    // (printer class + kabhi kabhi ek extra vendor interface). Pehla wala hamesha
    // claim nahi hota (kabhi kabhi OS/dusri service usse pakde baithi hoti hai),
    // isliye har OUT-endpoint wale interface ko try karte hain jab tak ek claim
    // na ho jaye.
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
      throw new Error('Printer ka USB OUT endpoint nahi mila. Ye device print karne layak nahi lag raha - USB cable/port badal ke dekhein.');
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
        '2. Phone ki koi bhi "Printer" ya "USB" app band karein jo background mein chal rahi ho\n' +
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
    const devices = await navigator.usb.getDevices(); // pehle se paired devices (permission diya hua)
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

  // ---- High level receipt commands ----

  async printBill(shop, items, total, footer) {
    let cmds = [];
    cmds.push(ESC, 0x40); // init
    cmds.push(ESC, 0x61, 1); // center align
    if (shop.name) cmds = cmds.concat(textToBytes(shop.name + '\n'));
    if (shop.address) cmds = cmds.concat(textToBytes(shop.address + '\n'));
    if (shop.phone) cmds = cmds.concat(textToBytes('Ph: ' + shop.phone + '\n'));
    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds.push(ESC, 0x61, 0); // left align
    items.forEach(it => {
      const line1 = it.name.substring(0, 32);
      const qtyPrice = `${it.qty} x Rs${it.price.toFixed(2)}`;
      const amount = (it.qty * it.price).toFixed(2);
      const line2 = padRight(qtyPrice, 20) + padLeft('Rs' + amount, 12);
      cmds = cmds.concat(textToBytes(line1 + '\n'));
      cmds = cmds.concat(textToBytes(line2 + '\n'));
    });
    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds.push(ESC, 0x45, 1); // bold on
    cmds = cmds.concat(textToBytes(padRight('TOTAL', 20) + padLeft('Rs' + total.toFixed(2), 12) + '\n'));
    cmds.push(ESC, 0x45, 0); // bold off
    cmds = cmds.concat(textToBytes('--------------------------------\n'));
    cmds.push(ESC, 0x61, 1);
    cmds = cmds.concat(textToBytes((footer || 'Dhanyavaad! Fir aaiyega.') + '\n'));
    const now = new Date();
    cmds = cmds.concat(textToBytes(now.toLocaleString('en-IN') + '\n'));
    cmds.push(0x0a, 0x0a, 0x0a);
    cmds.push(GS, 0x56, 0x41, 0x10); // partial cut
    await this.send(cmds);
  }

  // Printer ke andar hi QR code generate + print karwata hai (GS ( k command,
  // ye zyadatar ESC/POS thermal printers mein QR support ke liye standard hai)
  async printQRLabel(product) {
    const data = `${product.name}|Rs${product.price}`;
    let cmds = [];
    cmds.push(ESC, 0x40);
    cmds.push(ESC, 0x61, 1); // center

    // QR: model select
    cmds.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // QR: size (module size 6)
    cmds.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
    // QR: error correction level (48 = L)
    cmds.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
    // QR: store data
    const dataBytes = textToBytes(data);
    const len = dataBytes.length + 3;
    const pL = len & 0xff, pH = (len >> 8) & 0xff;
    cmds.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes);
    // QR: print
    cmds.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);

    cmds = cmds.concat(textToBytes('\n' + product.name.substring(0, 32) + '\n'));
    cmds.push(ESC, 0x45, 1);
    cmds = cmds.concat(textToBytes('Rs ' + Number(product.price).toFixed(2) + '\n'));
    cmds.push(ESC, 0x45, 0);
    cmds.push(0x0a, 0x0a);
    cmds.push(GS, 0x56, 0x41, 0x10);
    await this.send(cmds);
  }
}

function padRight(str, len) { str = String(str); return str.length >= len ? str.substring(0, len) : str + ' '.repeat(len - str.length); }
function padLeft(str, len) { str = String(str); return str.length >= len ? str.substring(0, len) : ' '.repeat(len - str.length) + str; }

const BillPrinter = new ThermalPrinter('billPrinterDevice');
const QRPrinter = new ThermalPrinter('qrPrinterDevice');
