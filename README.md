# Gomati Mega Mart - Billing App

Offline PWA app — USB barcode scanner se bill banane, USB thermal printer se bill print
karne, aur USB QR label printer se product label print karne ke liye. Data Google Sheet
ke through sab devices mein sync hota hai (internet aane par).

---

## ⚠️ Pehle ye 3 baatein zaroor samajh lo

1. **Browser**: App sirf **Google Chrome (Android)** mein poori tarah kaam karegi, kyunki
   USB printer se connect hone ke liye "WebUSB" feature chahiye jo sirf Chrome mein hai.
   Chrome se hi "Add to Home Screen" karke install karna.

2. **Printer compatibility**: Maine ESC/POS standard commands use kiye hain (zyada tar
   cheap USB thermal bill printers aur QR label printers ye support karte hain). Agar
   tumhara printer print nahi karta ya ulta-pulta print karta hai, to bata dena — printer
   ka exact model/brand chahiye hoga taaki commands adjust kar sakein.

3. **OTG**: Phone mein ek time pe usually ek hi USB device lag pata hai (jab tak achha OTG
   HUB na ho). Isliye acche OTG HUB (multiple USB ports wala) lena best rahega taaki
   scanner + printer dono ek saath laga sako.

---

## Step 1: GitHub Pages pe host karna

1. GitHub pe naya repository banao (jaise `gomati-mart-app`).
2. Is folder ki saari files us repository mein upload kar do (index.html root mein hona
   chahiye).
3. Repo → **Settings → Pages** → Source: `main` branch, folder `/ (root)` → Save.
4. Kuch minute baad URL milega jaisa: `https://yourusername.github.io/gomati-mart-app/`

---

## Step 2: Google Sheet + Apps Script setup (data sync ke liye)

1. [sheets.google.com](https://sheets.google.com) pe naya blank Sheet banao — naam do
   jaise "Gomati Mart Data".
2. Sheet ke andar: **Extensions → Apps Script**.
3. Jo bhi default code likha hai use delete karke, is folder ki `google-apps-script/Code.gs`
   file ka pura content paste kar do.
4. Upar **Save** (💾 icon) karo.
5. **Deploy → New deployment** pe click karo.
   - "Select type" (⚙️ icon) → **Web app** chuno.
   - Description: kuch bhi likh do.
   - "Execute as": **Me**
   - "Who has access": **Anyone** ⚠️ (zaroori hai, warna app data nahi bhej payegi)
   - **Deploy** button dabao.
6. Pehli baar permission maangega — apna Google account allow kar do ("Advanced" → "Go to
   project (unsafe)" aa sakta hai, wo normal hai apni khud ki script ke liye — allow kar do).
7. Deploy hone ke baad ek **Web app URL** milega, kuch aisa:
   `https://script.google.com/macros/s/AKfycb.../exec`
   **Ye URL copy kar lo.**
8. App kholo → **Settings** tab → "Google Apps Script Web App URL" field mein ye URL paste
   karke **Save Settings** dabao.

Bas — ab jab bhi koi device product add karega, wo is Google Sheet mein save hoga, aur
jab bhi koi doosra device internet se connect hoga, wahan bhi apne aap aa jayega.

> Agar future mein script mein koi badlav karo, to dobara "Deploy → Manage deployments →
> Edit (pencil) → New version → Deploy" karna padega.

---

## Step 3: Phone pe app install karna

1. Phone mein **Chrome** browser kholo, apna GitHub Pages URL open karo.
2. Chrome menu (⋮) → **"Add to Home screen"** / **"Install app"** dabao.
3. Ab app icon home screen pe aa jayega, aur ye normal app ki tarah khulegi (offline bhi).

Har device (jitne bhi phone use karne hain) pe yahi 3 steps repeat karo.

---

## Step 4: USB devices connect karna

App kholo → **Settings** tab:

- **"Bill Printer Pair Karein"** dabao → USB permission popup aayega → apna bill printer
  chuno. Ek baar pairing hone ke baad wo yaad rahega.
- **"QR Label Printer Pair Karein"** dabao → same tarike se apna QR/label printer chuno.
- **USB barcode scanner** ke liye kuch pair nahi karna — wo automatically kaam karta hai
  (jaise keyboard), bas usko OTG se laga do aur Billing/Products screen pe scan karo.

---

## App kaise use karein

### Billing (bill banana)
- Scanner se product scan karo → apne aap cart mein add ho jata hai.
- Sabzi/loose items (jo barcode mein nahi hain) — neeche "manual add" form se naam, price,
  qty daal ke add karo.
- Qty edit karni ho to cart mein number box mein change kar do.
- **Print Bill** dabao → bill printer se print ho jayega.

### Products (product master data)
- Naya product add karna ho: Barcode (scan bhi kar sakte ho "Scan" button se), naam, price,
  optional stock qty daal ke **Save Product** karo.
- Kisi bhi product ke aage **QR Print** button se uska QR label print kar sakte ho (open
  items pe lagane ke liye — usme naam aur price dono hota hai).
- Edit/Delete bhi list mein se ho sakta hai.

### Settings
- Dukaan ka naam/address/phone (bill ke header pe print hota hai).
- Sync status yahan dikhta hai — "Last sync" time aur kitne changes abhi bhejne baaki hain.
- **Sync Now** button se manually bhi sync kar sakte ho.

---

## Offline kaise kaam karta hai

- Saara data phone ke andar (IndexedDB) mein save hota hai — internet ke bina bhi bill
  banana, print karna, product add karna sab chalta hai.
- Jab bhi internet aata hai, app apne aap Google Sheet se sync kar leti hai (naya data
  bhejna + doosron ka naya data lena).
- Settings screen hamesha batati hai ki **last sync kab hua tha**, taaki pata chale data
  latest hai ya nahi.

---

## Agar kuch kaam na kare (Troubleshooting)

- **"WebUSB support nahi karta"**: Chrome browser use karo (Firefox/Samsung Internet mein
  nahi chalega).
- **Printer pair nahi ho raha**: Kisi aur app (jaise printer ki khud ki app) ko band karo jo
  printer already use kar rahi ho.
- **Print ulta-pulta ya kuch print hi nahi hota**: Printer ka exact model bata dena, ESC/POS
  commands us model ke hisab se adjust karne padenge.
- **Sync nahi ho raha**: Settings mein Apps Script URL sahi se paste hui hai check karo,
  aur wo Sheet "Anyone" access ke saath deploy hui honi chahiye.

---

Koi bhi cheez samajh na aaye ya kuch aur badlwana ho, bata dena.
