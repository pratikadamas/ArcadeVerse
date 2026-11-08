<!-- markdownlint-disable -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=1e3a8a,2563eb,38bdf8,60a5fa&height=180&section=header&text=ArcadeVerse&fontSize=42&fontAlignY=38&desc=The%20Open-Source%20Community%20Arcade%20Station%20%E2%80%A2%20Nexus%20Spring%20Of%20Code%20%E2%80%93%20Winter%20Edition%202026&descAlignY=58&descSize=16&fontColor=ffffff" width="100%" alt="ArcadeVerse Header Wave" />

  <p align="center">
    <b>🎮 Play Web Games • 🧪 Build Conflict-Free Mini-Games • 🏆 Climb the Live Hall of Fame</b>
  </p>

  <p align="center">
    <a href="https://github.com/DebasmitaBose0/ArcadeVerse"><img src="https://img.shields.io/badge/Nexus%20Spring%20Of%20Code-Winter%20Edition%202026-6366f1?style=for-the-badge&logo=github&logoColor=white" alt="Nexus Spring Of Code – Winter Edition 2026"></a>
    <a href="https://github.com/DebasmitaBose0/ArcadeVerse"><img src="https://img.shields.io/badge/Tech-100%25%20Vanilla%20HTML%20%7C%20CSS%20%7C%20JS-3b82f6?style=for-the-badge&logo=javascript" alt="Tech Stack"></a>
    <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-Welcome%20%F0%9F%9A%80-10b981?style=for-the-badge" alt="PRs Welcome"></a>
    <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg?style=for-the-badge" alt="Code of Conduct"></a>
    <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-Policy-e11d48?style=for-the-badge" alt="Security Policy"></a>
    <a href="ARCHITECTURE.md"><img src="https://img.shields.io/badge/Architecture-Specification-8b5cf6?style=for-the-badge" alt="Architecture"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge&logo=open-source-initiative&logoColor=white" alt="License"></a>
  </p>
</div>

---

### 👑 **PROJECT LEADERSHIP & PROGRAM ETHOS**

> - 👩‍💻 **Project Admin & Lead Architect:** **Debasmita Bose** ([@DebasmitaBose0](https://github.com/DebasmitaBose0))
> - ❄️ **Event & Program:** **Nexus Spring Of Code – Winter Edition 2026**
> - ⚡ **Native Tech Stack:** **100% Pure HTML5 + CSS3 + Vanilla JavaScript** (Zero frameworks, zero Python backends, zero bundlers)
> - 🎯 **Program Vision:** A collision-free, beginner-friendly yet high-performance web arcade station giving contributors their first real, permanent open-source merge!

---

## ⚡ **KEY HIGHLIGHTS & ARCHITECTURAL ADVANTAGES**

- 🚀 **100% Native Web Standards:** Pure HTML5, CSS3, & Modern Vanilla JS. Runs instantly in any web browser without any installation!
- 📁 **Isolated Directory Pattern (`games/game-name_your-name/`):** Every participant works inside their own isolated folder. **Zero Git merge conflicts!**
- 🕹️ **Multi-Game Diversity:** Multiple contributors can build different versions of the same game idea without collision.
- 📖 **Comprehensive Contributor Guide ([CONTRIBUTING.md](CONTRIBUTING.md)):** Detailed instructions, isolation rules, and architecture guidelines on how to contribute games.
- 🏛️ **Automated CI Architecture ([ARCHITECTURE.md](ARCHITECTURE.md)):** Detailed architectural specifications and Mermaid workflow diagrams illustrating automated game registry compilation, client DOM hydration, and sensory accessibility engines.
- 🛠️ **Conflict-Free Automated Contribution:** Contributors simply add their files along with `game.json` in `games/` — our automated GitHub Actions workflow compiles the registry without conflicts!
- 🏆 **Live GitHub Hall of Fame ([leaderboard.html](leaderboard.html)):** Real-time contribution scoring, podium champions, and custom rank badges fetched directly from the GitHub REST API!
- 🔒 **Sandboxed Game Isolation (#492):** Secure HTML5 iframe sandboxing preventing unverified top navigation and rogue window frame manipulation.

---

## 💻 **HOW TO RUN THIS PROJECT LOCALLY**

This project has **no backend servers, no build steps, and no Python app**. You can run it instantly using any of the following methods:

### 🔹 **METHOD 1: INSTANT BROWSER LAUNCH (RECOMMENDED)**

Run this single command in your terminal to open the platform in Google Chrome immediately:

- **Windows (PowerShell / Command Prompt):**

  ```powershell
  start chrome "$PWD\index.html"
  ```

  *(Alternative default browser: `start index.html`)*

- **macOS:**

  ```bash
  open index.html
  ```

- **Linux:**

  ```bash
  xdg-open index.html
  ```

---

### 🔹 **METHOD 2: VS CODE LIVE SERVER EXTENSION**

1. Open the project folder in **VS Code**.
2. Right-click on **`index.html`**.
3. Select **"Open with Live Server"**.

---

### 🔹 **METHOD 3: DOUBLE-CLICK `index.html`**

Simply open your project folder in File Explorer and **double-click `index.html`**! It opens right away in Chrome, Edge, Brave, or Firefox.

---

## 🕹️ **STARTER REFERENCE GAMES INCLUDED**

- 🧩 **Quantum Memory Matrix** (`games/memory-matrix_debasmita/`):
  - Pure HTML, CSS & Vanilla JS 3D card flip puzzle.
- 🏓 **Cyber Neon Pong** (`games/cyber-neon-pong_debasmita/`):
  - Pure canvas AI paddle game demonstrating smooth 60fps rendering and dynamic physics.

---

## 📖 **CONTRIBUTOR GUIDELINES & WORKFLOW**

> [!IMPORTANT]
> **All contributors are strictly required to read our comprehensive [CONTRIBUTING.md](CONTRIBUTING.md) guide before submitting a Pull Request!**

### 📌 **Quick Checklist for Contributors**

1. 📖 **Read the Guidelines:** Review the complete [CONTRIBUTING.md](CONTRIBUTING.md) for official Nexus Spring Of Code – Winter Edition 2026 dual-point systems and 45-day program tiers.
2. ⚠️ **Strict Folder Naming:** All game submissions **MUST** be placed in the `'games' folder` under `games/<game-name_your-name>/` (e.g., `games/cyber-pong_your-name/`).
3. 🤝 **Adhere to Code of Conduct:** Read our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Plagiarism, toxic comments, broken AI dumps, or rule violations will result in PR rejection and event disqualification.
4. 🛡️ **Review Security Rules:** Review [SECURITY.md](SECURITY.md) for web security requirements (pure vanilla JS, no external tracker scripts, no dynamic `eval()` execution, and strict DOM safety).
5. ⏱️ **Submission Timeline:** Submit PRs within **5 days** of issue assignment (issues with 7 days of inactivity will be auto-reassigned).
6. 🧪 **Pre-Flight Game Validation:** Run `node scripts/validate-games.js` (or `npm run validate`) locally to verify that your `game.json` schema, required files, and asset references pass automated checks before opening a PR!
7. 📝 **Automated Game Registration:** Include `game.json` metadata in your game folder (`games/<game-name_your-name>/`). Do NOT edit root files or `games-registry.js` — registration is handled automatically by GitHub Actions!
8. 🎖️ **Earn Contributor Badges:** Unlock official titles on our live [Hall of Fame Leaderboard](leaderboard.html) across both **Games Dedicated** (`Master Game Architect`, `Hyper Game Developer`, `Arcade Developer`, `Arcade Explorer`) and **Platform & Core** (`Master Core Architect`, `Elite Contributor`, `Platform Contributor`, `Active Contributor`) tracks.

---

## 📄 **COMMUNITY GOVERNANCE, SECURITY & OPEN SOURCE LICENSE**

ArcadeVerse is built by and for the open-source community. All community contributions are protected and governed by the following official documents:

- 🏛️ **[Architecture & Workflow Specification (ARCHITECTURE.md)](ARCHITECTURE.md)**: Deep dive into the zero-bundler pipeline, 4-file sandboxed game contract, automated continuous integration registry builder, and runtime execution model.
- 📖 **[Contribution Guidelines (CONTRIBUTING.md)](CONTRIBUTING.md)**: Comprehensive guide on dual scoring systems, milestone tiers, folder conventions, and pull request workflows.
- 🤝 **[Code of Conduct (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md)**: Community standards, inclusion pledges, anti-harassment policies, and enforcement guidelines.
- 🛡️ **[Security Policy (SECURITY.md)](SECURITY.md)**: Private vulnerability reporting procedures, client-side web security constraints, and safety audits.
- 📜 **[Open Source License (LICENSE)](LICENSE)**: Licensed under the permissive **MIT License** terms.  

---

## 👥 **PROJECT CONTRIBUTORS & HALL OF FAME**

A huge thank you to all the amazing developers building, contributing, and refining **ArcadeVerse** during **Nexus Spring Of Code – Winter Edition 2026**! 🌟

<div align="center">

<a href="https://github.com/DebasmitaBose0/ArcadeVerse/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=DebasmitaBose0/ArcadeVerse" alt="ArcadeVerse Contributors" />
</a>

<p align="center">
  <b>Want to be featured here?</b> Read our <a href="CONTRIBUTING.md"><b>Contribution Guide</b></a>, pick an open issue, and submit your Pull Request! 🚀
</p>

</div>

---

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=60a5fa,38bdf8,2563eb,1e3a8a&height=120&section=footer" width="100%" alt="ArcadeVerse Footer Wave" />

  <p align="center">
    Designed & Engineered with ❤️ by <b><a href="https://github.com/DebasmitaBose0">Debasmita Bose</a></b> for <b>Nexus Spring Of Code – Winter Edition 2026</b> ❄️<br>
    <i>Empowering open-source contributors with their first real merge!</i> 🚀
  </p>
</div> 
