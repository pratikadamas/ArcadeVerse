# 🛡️ Security Policy — ArcadeVerse

> **Project Lead & Admin:** [Debasmita Bose (@DebasmitaBose0)](https://github.com/DebasmitaBose0)  
> **Program:** Nexus Spring Of Code – Winter Edition 2026 (NSoC '26)  
> **Repository:** [ArcadeVerse](https://github.com/DebasmitaBose0/ArcadeVerse)

---

## 🔒 Supported Versions

We actively maintain and provide security updates for the primary branch of ArcadeVerse during the **Nexus Spring Of Code – Winter Edition 2026** lifecycle.

| Version / Branch | Supported | Notes |
| :--- | :---: | :--- |
| `main` | ✅ Yes | Active production branch for NSoC '26 |
| `<feature-branches>` | ❌ No | Temporary development branches; must merge into `main` |

---

## 🚨 Reporting a Vulnerability

The ArcadeVerse maintainers take security, client safety, and code integrity seriously. If you discover a security vulnerability, security loophole, or malicious code contribution, please report it **responsibly and privately**.

### ⚠️ Please Do NOT Open Public Issues for Security Vulnerabilities

Publicly opening an issue exposes the platform, contributors, and users to potential exploitation before a fix can be prepared.

### 📬 How to Report Privately

1. **GitHub Security Advisory:** Submit a private report via the repository's [Security Advisories](https://github.com/DebasmitaBose0/ArcadeVerse/security/advisories) tab (if enabled).
2. **Direct Maintainer Contact:** Reach out directly to **Debasmita Bose** ([@DebasmitaBose0](https://github.com/DebasmitaBose0)) via private contact details listed on their [GitHub Profile](https://github.com/DebasmitaBose0).

### 📋 What to Include in Your Report

- A clear description of the vulnerability.
- Steps to reproduce the issue (proof-of-concept code, payloads, or screenshots).
- Affected files, directories, or game components.
- Potential impact on end users or the platform.
- Any suggested remediations or mitigations.

### ⏱️ Response Timeline

- **Initial Acknowledgment:** Within **48 hours**.
- **Assessment & Triage:** Within **3 to 5 business days**.
- **Fix & Public Release:** Coordinated patch published promptly upon verification.

---

## 🌐 Cross-Origin & Font Preload Security (#494)

To prevent resource starvation or CORS-related denial of service when third-party font delivery networks fail:
- ArcadeVerse employs strict system font fallbacks (Cambria, Georgia, Impact, Consolas) with matched font metrics to prevent cumulative layout shift (CLS).
- Web font loading utilizes the Font Loading API (document.fonts.load()) wrapped in non-blocking 3000ms safety timeouts.
- Style sheets enforce @supports (font-display: swap) and offline fallbacks, maintaining a functional UI even in air-gapped or restricted CORS environments.

## 💻 Web Architecture & Code Safety Guidelines

ArcadeVerse is built strictly on **100% native web standards (HTML5, CSS3, Vanilla JavaScript)** without server-side runtimes, Python backends, or node dependencies. All games and platform features execute client-side in the user's browser.

To ensure client-side safety, all contributors **must** strictly adhere to the following security guidelines:

### 1. 🚫 Cross-Site Scripting (XSS) Prevention

- Never inject unescaped user inputs into `innerHTML`, `outerHTML`, or `document.write()`.
- Use `textContent`, `innerText`, or safe DOM element construction (`document.createElement()`, `setAttribute()`).
- Sanitize any player names, custom scores, or user-submitted text rendered on canvas or DOM elements.

### 2. 🚫 No Dynamic Code Execution (`eval()`)

- The use of `eval()`, `new Function()`, `setTimeout("string")`, or `setInterval("string")` is **strictly prohibited**.
- Any PR containing dynamic code execution primitives will be immediately flagged and rejected.

### 3. 🚫 No External Untrusted Scripts & CDNs

- All mini-games and platform components must be self-contained within their respective directories.
- Do not import arbitrary third-party JavaScript files, external CDNs, tracker scripts, analytics pixels, or remote libraries.
- Google Fonts and verified icon SVGs (e.g. Lucide) are allowed only via standard approved channels.

### 4. 📁 Strict Directory Isolation

- All game contributions must reside exclusively within the `'games' folder` under `games/<game-name>_<contributor-name>/`.
- Games must not attempt directory traversal (`../../`) to modify parent files, hijack other contributors' game assets, or overwrite platform core scripts (`assets/js/app.js`, `assets/js/games-registry.js`).

### 5. 🚫 Zero Malicious Payloads

- **Cryptominers:** Any script utilizing WebAssembly, Web Workers, or canvas loops for background cryptocurrency mining will result in an immediate **permanent ban and disqualification from NSoC '26**.
- **Persistent Tracking:** No unauthorized persistent tracking, localStorage poisoning, fingerprinting, or credential sniffing.
- **Harmful iframes:** No hidden iframes or redirects to external malicious domains.

---

### 6. 🔒 Strict Iframe Sandbox Policy (#492)

- **Omission of Top Navigation:** The central game viewport #game-iframe enforces sandbox restrictions strictly omitting llow-top-navigation and llow-top-navigation-by-user-activation.
- **Protection against Frame Hijacking:** Embedded games cannot redirect the parent hub to external or malicious sites via window location manipulation.
- **Active Session Lock:** An active beforeunload confirmation guard warns players before leaving or reloading during ongoing gameplay sessions.

---

## ⚖️ Enforcement & Code Review

Every Pull Request undergoes rigorous manual code review by the Project Admin before merging:

1. **Automated & Static Code Inspection:** Verification of pure vanilla JavaScript and absence of forbidden functions.
2. **Directory Conformance Audit:** Ensuring zero loose files in root and isolated folder structures.
3. **Behavioral Testing:** Running the game locally in an isolated browser instance to monitor network activity and resource utilization.

Violations of this Security Policy will be dealt with in accordance with our [Code of Conduct](CODE_OF_CONDUCT.md) and official NSoC '26 disciplinary rules.

---

## 🏅 Recognition for Security Researchers & Contributors

Responsible disclosure helps keep the open-source community safe. Security researchers and contributors who discover, responsibly report, and help patch verified vulnerabilities will receive:

- Public attribution in the repository release notes and Hall of Fame.
- **Grace Points** and recognition badges under the official Nexus Spring Of Code – Winter Edition 2026 guidelines.
