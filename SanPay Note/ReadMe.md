# 💸 SanPay Note — Multi-Person Expense & Wallet Manager

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-pink?style=for-the-badge)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Offline First](https://img.shields.io/badge/Offline--First-Local_Storage-emerald?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

**A sleek, privacy-focused, offline-first personal & shared finance manager designed with GTA VI-inspired Neon Glassmorphism and OriginOS-style fluid aesthetics.**

[Explore Features](#-features) • [Export Engine](#-export--reporting-center) • [Getting Started](#-getting-started) • [Google Sheets Sync](#-google-sheets-cloud-sync) • [Android Bridge](#-android-hybrid-bridge)

</div>

---

## 📖 Overview

**SanPay Note** is a modern, single-page web application (PWA & Android WebView ready) built for tracking income, daily expenses, loans, debts, split purchases, recurring bills, and savings goals across multiple people or independent accounts.

Whether you are managing your personal household budget, splitting expenses with flatmates, tracking business petty cash, or lending money to friends, **SanPay Note** keeps your balance calculations transparent, instantaneous, and completely offline.

### 🌟 Key Highlights

* **100% Offline & Private:** All data resides exclusively in your browser's `localStorage` or native device storage. No tracking, no mandatory cloud sign-ins, and zero third-party database dependency.
* **Multi-Person Wallets:** Track individual balances, salaries, and contributions under a single unified dashboard.
* **GTA VI × OriginOS Glassmorphism:** AMOLED deep navy theme (`#0A0A14`), glowing hot pink (`#E91E8C`), sunset gold accents (`#F5A623`), backdrop blur glass cards, and fluid transitions.
* **Multi-Format Export Engine:** Generate printable corporate-grade **PDF statements**, multi-sheet **Excel workbooks (.xlsx)** with dynamic formulas, **CSV datasets**, and full **JSON backups**.
* **Live Google Sheets Sync:** Optional 2-way cloud backup using a lightweight Google Apps Script endpoint.
* **Android Native Bridge Ready:** Pre-wired for Android WebViews with native UPI apps (GPay, PhonePe, Paytm), camera QR scanning, contacts picker, and native file sharing.

---

## 🚀 Features

### 1. 📊 Smart Dashboard & Analytics
* **Net Balance Overview:** Visual card tracking total balance, monthly income, expense, and savings.
* **Privacy Toggle:** One-click eye icon to mask financial numbers when browsing in public.
* **Quick Insights:** Live calculation of today’s spending, daily average burn rate, and single largest monthly expense.
* **Spending Breakdown:** Category-based distribution with percentage indicators and visual bars.
* **Interactive 6-Month Chart:** Responsive bar visualization powered by Chart.js comparing income, expense, and savings month-over-month.
* **Smart Reminders:** Top notification banner aggregating pending loan collections, debt repayments, and upcoming auto-pay deadlines.

### 2. 👥 Multi-Person Wallets & Swaps
* Assign transactions to specific members (e.g., Me, Partner, Roommate, Business Partner).
* Customized avatar colors and monthly salary paydays.
* **Wallet Swap (Internal Transfers):** Move money between members without altering the overall net cash flow of the account.

### 3. 💳 Transactions & Activity Feed
* Instant creation for **Income**, **Expense**, **Lent**, **Borrowed**, **Savings Deposit**, and **Withdrawal**.
* Real-time search by keyword, note, UPI ID, reference number, or category.
* Filter by person and custom date ranges (All time, This Month, Last Month, Last 30 Days).
* Transaction detail modal featuring digital receipt layout, settlement history, and copy-to-clipboard sharing.

### 4. 🔄 Auto Pay & Recurring Subscriptions
* Automate scheduled payments for rent, subscriptions (Netflix, Spotify), utility bills, or recurring investments.
* Select frequencies: **Daily**, **Weekly**, **Monthly** (with short-month anchor date preservation), or **Yearly**.
* Automatic background generator runs on app load when payments are due.

### 5. 🤝 Lent & Borrowed Money Trackers (Debt Manager)
* Dedicated tracking for money you gave (**Lent Tracker**) and money you took (**Borrowed Tracker**).
* Separate boards for **Active Loans** and **Fully Settled** transactions.
* **Partial Repayments:** Incrementally settle or add more capital to existing loans while maintaining a full chronological audit trail.

### 6. ⚖️ Fair Split (Shared Bills)
* Split shared purchases (groceries, dinners, trips) evenly or with custom distributions among multiple users.
* Generates individual ledger entries automatically.
* Formats a clean WhatsApp-ready breakdown message with one-tap clipboard copy.

### 7. 🎯 Savings Goals & Vault
* Create targeted goals (e.g., *Vacation, PS5, Emergency Fund*) with custom target amounts and deadlines.
* Interactive progress bars and automated advice on how much to save monthly to meet target dates.
* Money committed to goals is set aside from available wallet balance.
* Mark as completed to automatically log the final purchase expense.

### 8. 📈 Month-over-Month Comparison
* Side-by-side analysis between any two months (Base vs. Target).
* Filter comparison by individual user or total workspace.
* Automated summary highlighting percentage fluctuations in income, expenses, and net cash flow.

### 9. 🗂️ Multi-Account Workspaces
* Create multiple workspaces (e.g., *Personal*, *Family*, *Side Business*, *Trip to Goa*).
* Seamlessly switch between workspaces from the top navigation bar.

---

## 📑 Export & Reporting Center

SanPay Note comes equipped with a client-side reporting engine that runs fully offline with bundled vendor libraries and automatic CDN fallbacks:

| Format | Output | Capabilities |
| :--- | :--- | :--- |
| **PDF Report** | `.pdf` | Multi-page A4 document with branded GTA-pink header band, KPI summary tiles, opening/closing balance statements, category share breakdown bars, per-person summaries, loan/debt tables, and detailed transaction ledger. |
| **Excel Workbook** | `.xlsx` | Multi-sheet spreadsheet generated via SheetJS. Includes formatted cells, `SUMIF` live formulas for total cash in/out, number formatting, auto-filtered columns, and dedicated tabs for Categories, People, Loans, and Splits. |
| **CSV** | `.csv` | UTF-8 formatted comma-separated transaction records with dates, people, categories, notes, cash flow direction, amounts, running balance, and payment references. |
| **Full Backup** | `.json` | Complete cryptographic snapshot of all workspaces, users, transactions, auto-pays, and preferences. Enables 1-click migration between devices. |

> **Offline Architecture:** Libraries (`jspdf.umd.min.js`, `jspdf.plugin.autotable.min.js`, `xlsx.full.min.js`) are bundled locally under `libs/`. If local files are ever missing or blocked, the app automatically fails over to verified CDNs on demand.

---

## 🛠️ Tech Stack

* **Core:** HTML5, Modern ECMAScript (Vanilla JS, ES6+ Modules)
* **Styling & Design System:**
  * [Tailwind CSS](https://tailwindcss.com/) (CDN runtime build)
  * Deep Glassmorphism (`backdrop-filter: blur(24px)`)
  * GTA VI Palette (Hot Pink `#E91E8C`, Sunset Gold `#F5A623`, AMOLED Dark `#0A0A14`)
  * Typography: Google Fonts [`Outfit`](https://fonts.google.com/specimen/Outfit)
* **Icons:** [Phosphor Icons](https://phosphoricons.com/) Web Font
* **Data Visualizations:** [Chart.js](https://www.chartjs.org/)
* **Document Generation:**
  * [jsPDF](https://github.com/parallax/jsPDF) (v2.5.1)
  * [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (v3.8.2)
  * [SheetJS / xlsx](https://sheetjs.com/) (v0.18.5)
* **Storage Engine:** Browser `localStorage` API + JSON Serialization

---

## 📂 Project Structure

```text
SanPay Note/
├── index.html              # Complete single-page application (UI, state & business logic)
├── README.md               # Project documentation & setup guide
├── .vscode/
│   └── extensions.json     # Recommended VS Code tooling
└── libs/                   # Bundled offline export libraries
    ├── jspdf.umd.min.js             # Client-side PDF generation
    ├── jspdf.plugin.autotable.min.js# PDF tabular data layout plugin
    └── xlsx.full.min.js             # Excel .xlsx workbook engine
```

---

## ⚡ Getting Started

### Option 1: Direct File Launch (No Server Required)
Simply double-click `index.html` or open it directly in any modern browser (Chrome, Edge, Firefox, Safari, Brave):
```text
file:///path/to/SanPay Note/index.html
```

### Option 2: Run via Local Development Server
For the optimal PWA and local asset loading experience, serve the directory using any lightweight server:

#### Using Python:
```bash
# Python 3.x
python -m http.server 8080
```
Then visit `http://localhost:8080` in your browser.

#### Using Node.js / npx:
```bash
npx serve .
# or
npx live-server
```

---

## ☁️ Google Sheets Cloud Sync

Want access to your records on Google Drive? SanPay Note features a built-in Google Apps Script integration:

1. Open SanPay Note $\rightarrow$ Navigate to **Settings** $\rightarrow$ **Google Sheets Live Sync**.
2. Click **Copy AppScript Code**.
3. Open [Google Sheets](https://sheets.new) $\rightarrow$ Navigate to **Extensions** $\rightarrow$ **Apps Script**.
4. Paste the copied code, click **Deploy** $\rightarrow$ **New Deployment** $\rightarrow$ Select type **Web app**.
5. Set:
   * **Execute as:** *Me*
   * **Who has access:** *Anyone*
6. Copy the generated **Web App URL** and paste it into the SanPay Note settings field.
7. Click **Connect & Sync**. Your transactions and summaries will now synchronize directly into your spreadsheet.

---

## 📱 Android Hybrid Bridge

SanPay Note includes JavaScript interfaces designed to communicate with an Android native WebView container via `window.AndroidBridge`:

* `AndroidBridge.openQrScanner()` — Opens native camera to scan UPI QR codes.
* `AndroidBridge.startUpiPayment(upiUri)` — Deep-links directly to Google Pay, PhonePe, Paytm, or BHIM.
* `AndroidBridge.pickContact()` — Opens device contact picker for quick person assignment.
* `AndroidBridge.saveBase64File(base64, mime, name)` — Writes exported PDFs/Excel sheets directly to Android's `Downloads` folder.
* `AndroidBridge.shareFile(uri, mime)` — Invokes Android native Share Sheet.

> *When running in a standard web browser, SanPay Note gracefully falls back to browser file downloads, the HTML5 Clipboard API, and standard Web APIs.*

---

## 🔒 Privacy & Security

* **Zero Tracking:** No tracking scripts, analytics SDKs, cookies, or external surveillance.
* **Client-Only Execution:** Financial calculations, reports, and file encodings happen 100% locally on your device CPU.
* **Data Ownership:** You can back up your entire financial history with one click as an unencrypted, human-readable JSON file and import it anywhere, anytime.

---

## 👨‍💻 Author

**Developed with ❤️ by Santhosh A**
* **Portfolio:** [a-santhosh-hub.github.io/in](https://a-santhosh-hub.github.io/in/)


---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
Feel free to fork, customize, and build upon it!

