/*
  Code.gs
  ------------------------------------------------------------------
  Ye script ek Google Sheet ko app ke "shared database" ki tarah use
  karti hai. README.md mein diye steps follow karke isse Google Sheet
  ke Apps Script editor mein paste karein aur Web App ki tarah deploy
  karein.
  ------------------------------------------------------------------
*/

const SHEET_NAME = 'Products';
const HEADERS = ['barcode', 'name', 'price', 'mrp', 'qty', 'updatedAt'];

function doGet(e) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const products = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue; // khali barcode wali row skip
    const obj = {};
    HEADERS.forEach((h, idx) => obj[h] = row[idx]);
    products.push(obj);
  }
  return jsonResponse({ products: products, count: products.length });
}

function doPost(e) {
  const sheet = getSheet();
  const body = JSON.parse(e.postData.contents);

  if (body.action === 'upsert' && Array.isArray(body.products)) {
    const data = sheet.getDataRange().getValues();
    const barcodeColIndex = HEADERS.indexOf('barcode');

    body.products.forEach(item => {
      const now = Date.now();
      const rowValues = HEADERS.map(h => {
        if (h === 'updatedAt') return now;
        return item[h] !== undefined && item[h] !== null ? item[h] : '';
      });

      let foundRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][barcodeColIndex]) === String(item.barcode)) {
          foundRow = i + 1; // sheet rows 1-indexed, +1 for header
          break;
        }
      }

      if (foundRow === -1) {
        sheet.appendRow(rowValues);
        data.push(rowValues); // future duplicate check ke liye local copy update
      } else {
        sheet.getRange(foundRow, 1, 1, HEADERS.length).setValues([rowValues]);
        data[foundRow - 1] = rowValues;
      }
    });

    return jsonResponse({ status: 'ok', updated: body.products.length });
  }

  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
