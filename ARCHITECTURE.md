# ArcadeVerse — System Architecture & Workflow Specification

> **Nexus Spring of Code – Winter Edition 2026**  
> **Project Admin & Lead Architect:** Debasmita Bose ([@DebasmitaBose0](https://github.com/DebasmitaBose0))  
> **Core Architecture:** 100% Pure Native Web Standards (Vanilla HTML5 + CSS3 + Modern JavaScript). Zero Bundlers, Zero Frameworks, Zero Backend Services.

---

## 1. Architectural Philosophy & Guiding Principles

ArcadeVerse is an open-source web arcade platform engineered specifically for **high-concurrency open-source collaboration** during the 45-day **Nexus Spring of Code – Winter Edition 2026**.

To allow dozens of contributors to submit mini-games simultaneously without stepping on each other's code, ArcadeVerse enforces three architectural pillars:

1. **Zero-Bundler Simplicity:** No Node build steps, Webpack, Vite, or TypeScript compilation required to run the client. The application runs immediately in any browser by double-clicking `index.html`.
2. **Strict Folder Isolation (`games/<game-name_author>/`):** Every game is encapsulated within its own sandboxed subfolder. Contributors never touch shared platform code.
3. **Automated Continuous Integration Compilation:** Game registration, metadata indexing, and contributor commit calculations are compiled automatically via GitHub Actions upon pull request merge into `main`.

---

## 2. The 4-File Game Specification

Every playable game inside `games/<game-name_author>/` must strictly and exclusively contain four files:

```text
games/<game-name_author>/
├── index.html       # Game viewport markup & UI controls (SVG/Lucide icons only, NO emojis)
├── style.css        # Scoped styling, layout constraints, CRT/retro effects
├── game.js          # Pure client-side gameplay loop, state machine, audio & input handlers
└── game.json        # Standardized metadata declaration ingested by CI pipeline
```

### Standardized `game.json` Contract

```json
{
  "id": "cyber-brick-breaker",
  "title": "Cyber Brick Breaker",
  "category": "Arcade",
  "lucideIcon": "brick-wall",
  "description": "Deflect neon energy spheres through multi-layered cyber bricks with power-up capsules.",
  "author": "Babin Bid",
  "github": "Babin123456",
  "role": "Arcade Developer",
  "tags": ["Arcade", "Physics", "Retro"],
  "stars": 28,
  "featured": true,
  "difficulty": "Medium",
  "releaseDate": "2026-10-28"
}
```

---

## 3. End-to-End Automated CI/CD Compilation Pipeline

When a contributor pushes a game folder into `games/` and their Pull Request is merged into `main`, GitHub Actions automatically processes and indexes the new game without manual administrative overhead.

### Workflow Sequence Diagram

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "actorBkg": "#DBEAFE",
    "actorBorder": "#2563EB",
    "actorTextColor": "#172554",
    "actorLineColor": "#64748B",
    "signalColor": "#334155",
    "signalTextColor": "#0F172A",
    "labelBoxBkgColor": "#E0E7FF",
    "labelBoxBorderColor": "#6366F1",
    "labelTextColor": "#312E81",
    "activationBkgColor": "#CFFAFE",
    "activationBorderColor": "#0891B2",
    "sequenceNumberColor": "#FFFFFF"
  },
  "sequence": {
    "showSequenceNumbers": true,
    "actorMargin": 35,
    "messageMargin": 25,
    "mirrorActors": false
  }
}}%%

sequenceDiagram
    autonumber

    actor Contributor as Contributor (@username)
    participant Branch as Dedicated Git Branch
    participant PR as GitHub Pull Request
    actor Admin as Project Admin (@DebasmitaBose0)
    participant CI as GitHub Actions
    participant Script as scripts/build-registry.js
    participant Registry as assets/js/games-registry.js
    participant Client as Client Browser (index.html)

    rect rgb(239, 246, 255)
        Contributor->>Branch: Create game folder containing 4 files
        Contributor->>Branch: Run npm run validate
        Contributor->>PR: Open pull request targeting main
        Admin->>PR: Review code and approve merge
    end

    rect rgb(236, 253, 245)
        PR->>CI: Merge into main triggers workflow for games/**
        CI->>Script: Run node scripts/build-registry.js
        Script->>Script: Scan games/*/game.json
        Script->>Script: Audit git shortlog -sne
        Script->>Registry: Generate game and contributor registries
        CI->>Registry: Commit and push generated registry [skip ci]
    end

    rect rgb(250, 245, 255)
        Client->>Registry: Load updated registry
        Registry-->>Client: Return game and contributor metadata
        Client->>Client: Render catalog cards and leaderboard
    end

    Note over Contributor,Admin: Contribution, review and approval
    Note over CI,Registry: Automated validation and registry generation
    Note over Registry,Client: Static registry consumed by the browser
```

---

## 4. Platform Topology & Runtime Data Flow

ArcadeVerse employs a decentralized data flow where static declarations are compiled at build-time and hydrated dynamically in the browser DOM.

### Architecture Topology Flowchart

```mermaid
%%{init: {
  "theme": "base",
  "flowchart": {
    "htmlLabels": true,
    "curve": "linear",
    "nodeSpacing": 35,
    "rankSpacing": 45,
    "padding": 12
  },
  "themeVariables": {
    "fontFamily": "Arial, sans-serif",
    "fontSize": "14px",
    "lineColor": "#64748B",
    "textColor": "#0F172A",
    "clusterBkg": "#F8FAFC",
    "clusterBorder": "#94A3B8"
  }
}}%%

flowchart TB

    subgraph STORAGE["01 | COMMUNITY GAMES REPOSITORY"]
        direction LR
        G1["games/memory-matrix_debasmita/"]
        G2["games/cyber-brick-breaker_babin/"]
        G3["games/neon-rhythm-blaster_babin/"]
        GN["games/game-name_author/"]
    end

    subgraph CI["02 | GITHUB ACTIONS AUTOMATION"]
        direction LR
        Trigger(["Push or merge to main<br/>games/**"])
        Validator["scripts/validate-games.js"]
        Compiler["scripts/build-registry.js"]

        Trigger --> Validator
        Validator --> Compiler
    end

    subgraph OUTPUT["03 | AUTO-COMPILED REGISTRY"]
        RegistryFile[("assets/js/games-registry.js<br/>GAMES_REGISTRY<br/>CONTRIBUTORS_REGISTRY")]
    end

    subgraph CLIENT["04 | BROWSER RUNTIME ENGINE"]
        direction TB

        Index["index.html<br/>Home Hub"]

        subgraph MODULES["Client-Side Modules"]
            direction LR
            App["assets/js/app.js"]
            Daily["assets/js/daily-challenge.js"]
            A11y["assets/js/a11y-engine.js"]
            Leaderboard["assets/js/leaderboard.js"]
        end

        Modal["Game Player Modal<br/>Sandboxed iframe"]

        Index --> App
        Index --> Daily
        Index --> A11y
        Index --> Leaderboard

        App --> Modal
        Daily --> Modal
    end

    G1 -.-> Trigger
    G2 -.-> Trigger
    G3 -.-> Trigger
    GN -.-> Trigger

    Compiler --> RegistryFile

    RegistryFile --> App
    RegistryFile --> Daily
    RegistryFile --> Leaderboard

    classDef storage fill:#DBEAFE,stroke:#2563EB,color:#172554,stroke-width:2px
    classDef automation fill:#D1FAE5,stroke:#059669,color:#064E3B,stroke-width:2px
    classDef output fill:#FEF3C7,stroke:#D97706,color:#78350F,stroke-width:3px
    classDef client fill:#F3E8FF,stroke:#9333EA,color:#581C87,stroke-width:2px
    classDef modal fill:#CFFAFE,stroke:#0891B2,color:#164E63,stroke-width:2px

    class G1,G2,G3,GN storage
    class Trigger,Validator,Compiler automation
    class RegistryFile output
    class Index,App,Daily,A11y,Leaderboard client
    class Modal modal

    style STORAGE fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style CI fill:#ECFDF5,stroke:#059669,stroke-width:2px
    style OUTPUT fill:#FFFBEB,stroke:#D97706,stroke-width:2px
    style CLIENT fill:#FAF5FF,stroke:#9333EA,stroke-width:2px
    style MODULES fill:#F3E8FF,stroke:#A78BFA,stroke-width:1px
```

---

## 5. Client-Side Runtime Execution & Modal Isolation

Games execute inside a sandboxed `<iframe>` within the main application. This ensures:

1. **CSS Collision Prevention:** Game stylesheets cannot bleed into the host application or navigation bar.
2. **JavaScript Scope Isolation:** Global variables declared in games do not pollute the parent window.
3. **Clean Teardown:** Closing the player modal terminates game loops and releases audio contexts by clearing `iframe.src = ""`.

```mermaid
%%{init: {
  "theme": "base",
  "flowchart": {
    "curve": "linear",
    "nodeSpacing": 35,
    "rankSpacing": 45,
    "htmlLabels": true
  },
  "themeVariables": {
    "fontFamily": "Arial, sans-serif",
    "fontSize": "14px",
    "lineColor": "#64748B",
    "textColor": "#0F172A"
  }
}}%%

flowchart TB

    User(["Player"])

    subgraph OPEN["OPEN GAME | INITIALIZATION"]
        direction LR
        Click["Click game card"]
        OpenFn["app.js<br/>openGameModal(game)"]
        ModalDOM["DOM<br/>#game-modal.active"]
        Iframe["Load game URL<br/>iframe.src = games/.../index.html"]
        Runtime["Isolated Game Runtime<br/>Canvas · Audio · Game Loop"]

        Click --> OpenFn
        OpenFn --> ModalDOM
        ModalDOM --> Iframe
        Iframe --> Runtime
    end

    subgraph CLOSE["CLOSE GAME | CLEANUP"]
        direction LR
        CloseClick["Click close button"]
        CloseFn["app.js<br/>closeGameModal()"]
        Cleanup["Set iframe.src = ''"]
        Teardown["Embedded document unloaded<br/>Game execution stopped"]

        CloseClick --> CloseFn
        CloseFn --> Cleanup
        Cleanup --> Teardown
    end

    User --> Click
    User --> CloseClick

    classDef user fill:#E0E7FF,stroke:#4F46E5,color:#312E81,stroke-width:2px
    classDef open fill:#DBEAFE,stroke:#2563EB,color:#172554,stroke-width:2px
    classDef runtime fill:#D1FAE5,stroke:#059669,color:#064E3B,stroke-width:2px
    classDef close fill:#FFEDD5,stroke:#EA580C,color:#7C2D12,stroke-width:2px
    classDef teardown fill:#FEE2E2,stroke:#DC2626,color:#7F1D1D,stroke-width:2px

    class User user
    class Click,OpenFn,ModalDOM,Iframe open
    class Runtime runtime
    class CloseClick,CloseFn,Cleanup close
    class Teardown teardown

    style OPEN fill:#EFF6FF,stroke:#2563EB,stroke-width:2px
    style CLOSE fill:#FFF7ED,stroke:#EA580C,stroke-width:2px
```

---

## 6. Dual Point Systems & Scoring Architecture

ArcadeVerse maintains two independent scoring tiers:

### 1. Official Nexus Spring of Code (NSoC '26) Program Points

Assigned manually by the Project Admin on the evaluation sheet upon merging:

- `level1` (**3 points**): Documentation, typo corrections, small patches.
- `level2` (**5 points**): UI layout enhancements, responsive design, components.
- `level3` (**10 points**): Verified playable games in `games/`, canvas physics, core architecture.

### 2. In-App Arcade XP Formula (Live Hall of Fame)

Dynamically synthesized in real time on [leaderboard.html](leaderboard.html):

$$
\mathbf{Arcade\ Score} = (\text{Games} \times 100) + (\text{Mechanics} \times 25) + (\text{Features} \times 50) + (\text{Fixes} \times 25) + (\mathbf{Commits} \times \mathbf{5})
$$

---

## 7. Universal Accessibility (WCAG 2.1 AAA) Engine

The **Accessibility Hub** (`assets/js/a11y-engine.js` & `assets/css/a11y-engine.css`) introduces sensory customization directly onto `document.documentElement`:

| Mode | Target Class | Visual Effect |
| :--- | :--- | :--- |
| **Reduced Motion** | `.a11y-reduced-motion` | Eliminates glow orbs, ambient grids, pulses, and forced instant transitions |
| **High Contrast** | `.a11y-high-contrast` | 7:1+ contrast ratio, bold 2px borders, pure solid black/white canvas |
| **Large Typography** | `.a11y-large-text` | 118% base font-size scaling across hero, catalog cards, and controls |
| **Focus Rings** | `.a11y-focus-highlight` | High-visibility 3px blue outline with offset for keyboard navigation |

All preferences are stored in `localStorage` under `arcadeverse_a11y_prefs` and dynamically respond to light and dark theme toggles.

---

## 8. Contributor Quality Gate CLI

Before creating a Pull Request, contributors can validate their game directory locally using the pre-flight validator:

```bash
npm test
# or
npm run validate
# or
node scripts/validate-games.js
```

The script audits:

- Exact directory naming convention: `games/<game-name_your-name>/`
- Presence of all 4 required files (`index.html`, `style.css`, `game.js`, `game.json`)
- Strict JSON schema validity and required attributes
- Prohibition of raw Unicode emojis in markup in favor of SVG/Lucide icons
- Proper relative asset paths
- Sanitization of dynamic attributes & Lucide icon name whitelist enforcement (#491)
- Strict prevention of attribute breakouts in game metadata

---

## 9. Key Documentation Links

- [Contribution Guidelines](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Open Source License (MIT)](LICENSE)
