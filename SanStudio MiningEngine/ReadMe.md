# ⚡ SanStudio Mining Engine – Hamster-Style Web App

A fully functional **Hamster-Kombat–inspired Tap Mining Web Application** built using only **HTML, CSS, and Vanilla JavaScript**.  
This is not a prototype — it is a **real mining-style engine** with live decimals, passive income, upgrades, exchange view, and persistent progress.

The app feels like a **real crypto mining game**, not a website. Live Demo : https://sanstudio.neocities.org/SanStudio%20MiningEngine

---

## 🚀 Features

### 🔐 Local Authentication
- Username & Password (stored in `localStorage`)
- Register / Login system
- Session handling
- Logout without losing progress

### 🏠 Home – Mining Engine
- Big animated mining core
- Tap-to-earn with decimal precision (`+0.024`, `100.132`)
- Live balance animation
- Real-time profit indicators:
  - Profit per Tap  
  - Profit per Hour  
- Floating coin effects and glow animations

### ⚙️ Real-Time Mining Logic
- Floating-point economy system
- Passive income engine (per second & per hour)
- Offline earnings using last active timestamp
- Smooth number rolling

### 🪙 Upgrade System
- Multi-tier upgrade cards:
  - Tap Boost
  - Engine Boost
  - Network Multiplier
- Dynamic pricing using exponential growth
- Live impact on mining engine
- Persistent levels & stats

### 📊 Exchange / Engine View
- Crypto-style dashboard
- Live stats:
  - Per-second flow
  - Network power
  - Engine multiplier
- HUD-style layout

### 📈 Stats Panel
- Lifetime mined
- Engine uptime
- Taps per minute
- Real-time performance metrics

---

## 🛠 Tech Stack

- **HTML5**
- **CSS3 (Glassmorphism + Neon UI)**
- **Vanilla JavaScript**
- `localStorage` for:
  - Users
  - Balance
  - Upgrades
  - Engine state
  - Offline earnings

> No frameworks.  
> No backend.  
> 100% offline-ready.

---

## 🧠 Core Engine Concepts

```js
balance           // float
profitPerTap      // float
profitPerSecond   // float
engineMultiplier  // float
```




![SanStudio MiningEngine Screenshot](https://github.com/A-Santhosh-Hub/HTML/blob/main/SanStudio%20MiningEngine/SanStudio.png)
