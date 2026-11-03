/**
 * Detective Mystery: Neo-Tokyo Syndicate
 * Crime Scene Investigation, Suspect Interrogation, Contradiction Finder, and Verdict Warrant Engine
 * Author: Babin Bid (Babin123456)
 */

(() => {
  'use strict';

  // --- AUDIO SYNTHESIZER ---
  class SoundSynth {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClue() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }

    playContradictionSuccess() {
      if (!this.enabled || !this.ctx) return;
      const now = this.ctx.currentTime;
      [300, 450, 600, 900].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.2, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.15);
      });
    }

    playError() {
      if (!this.enabled || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(60, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  }

  const sound = new SoundSynth();

  // --- MULTIPLE CASES DATABASE ---
  const CASES = [
    {
      id: 1,
      title: "CASE #01: THE ARASAKA VAULT HEIST",
      scene: "Neo-Arasaka Core Vault",
      hotspots: [
        {
          id: "biometric_log",
          title: "Biometric Scanner Terminal",
          tag: "CYBER TELEMETRY",
          desc: "Access logs show Chief Security Officer Ren cleared the blast doors at 02:14 AM using an overridden master cipher.",
          clue: "Ren's 02:14 AM Biometric Access Timestamp"
        },
        {
          id: "broken_circuit",
          title: "Severed Fiberoptic Cable",
          tag: "PHYSICAL FORENSICS",
          desc: "A surgical micro-monomolecular laser cut made from inside the vault. Only lab engineering tools could slice this cleanly.",
          clue: "Monomolecular Laser Slice Pattern"
        },
        {
          id: "dropped_chip",
          title: "Encrypted Data Shard",
          tag: "DIGITAL EVIDENCE",
          desc: "A dropped memory drive bearing offshore Cayman credits transferred to Dr. Vance's private black-market wallet.",
          clue: "Dr. Vance's Offshore Cayman Transfer Log"
        },
        {
          id: "perfume_scent",
          title: "Synthetic Cyanide Odor",
          tag: "CHEMICAL RESIDUE",
          desc: "Traces of illegal aerosol neuro-dampener sprayed to disable the vault AI sentries without setting off fire suppressors.",
          clue: "Synthetic Neuro-Dampener Aerosol Trace"
        }
      ],
      suspects: [
        {
          id: "dr_vance",
          name: "Dr. Alistair Vance",
          role: "Chief Cybernetics Engineer",
          testimony: "I was in the Sector 4 cryo-lab all night! I never had any dealings with offshore buyers, and I certainly never possessed illegal black-market transaction shards.",
          flawClue: "Dr. Vance's Offshore Cayman Transfer Log",
          breakResponse: "D-damn it! How did you decrypt that Cayman wallet?! Fine, I needed the credits for my research, but I didn't unlock the blast door!"
        },
        {
          id: "officer_ren",
          name: "Captain Jin Ren",
          role: "Head of Corporate Security",
          testimony: "My biometric credentials were with me asleep in quarters at 02:00 AM. No one touched the vault terminal during my watch.",
          flawClue: "Ren's 02:14 AM Biometric Access Timestamp",
          breakResponse: "Wait... the scanner log recorded my override?! I thought the electromagnetic wipe wiped the local server! It was an offer I couldn't refuse..."
        },
        {
          id: "kora_hacker",
          name: "Kora 'Zero' Thorne",
          role: "Network Systems Administrator",
          testimony: "I was debugging routing switches remotely from Shinjuku. I don't carry physical laser scalpels.",
          flawClue: "Monomolecular Laser Slice Pattern",
          breakResponse: "That's an engineer's tool! I told you, I'm purely software!"
        },
        {
          id: "sarah_exec",
          name: "Sarah Chen",
          role: "Financial Vice President",
          testimony: "I have no motive to steal our own prototype. I authorized the transfer protocol legally.",
          flawClue: "Synthetic Neuro-Dampener Aerosol Trace",
          breakResponse: "Chemical sprays? Security guards handle weapons, not executive board members."
        }
      ],
      solution: {
        culprit: "officer_ren",
        motive: "Corporate Espionage Betrayal",
        evidence: "Ren's 02:14 AM Biometric Access Timestamp"
      }
    },
    {
      id: 2,
      title: "CASE #02: SHADOW RUNNER POISONING",
      scene: "Neon District Skyline Lounge",
      hotspots: [
        {
          id: "empty_glass",
          title: "Smashed Highball Glass",
          tag: "CHEMICAL TOXICOLOGY",
          desc: "Contains dissolved nanite poison. Dissolution speed matches a high-temperature bartender cocktail shaker.",
          clue: "Nanite Toxin Cocktail Residue"
        },
        {
          id: "hacked_cam",
          title: "Hacked Security Camera Lens",
          tag: "DIGITAL INTERCEPT",
          desc: "Footage between 11:45 PM and 11:50 PM was looped using an automated proxy tool signature traced to Thorne.",
          clue: "Zero's Looped Camera Proxy Signature"
        },
        {
          id: "vip_card",
          title: "Scratched VIP Lounge Badge",
          tag: "FORENSIC LOG",
          desc: "Dropped near the balcony door. Fingerprints reveal financial VP Sarah Chen visited the crime scene 5 minutes before the hit.",
          clue: "Sarah Chen's VIP Balcony Access Log"
        }
      ],
      suspects: [
        {
          id: "kora_hacker",
          name: "Kora 'Zero' Thorne",
          role: "Black Market Netrunner",
          testimony: "I don't touch club cameras. I was eating noodles at Kabukicho.",
          flawClue: "Zero's Looped Camera Proxy Signature",
          breakResponse: "Agh! You found my proxy signature in the feed headers! Okay, I was paid to blind the cameras, but Sarah was the one who met the target!"
        },
        {
          id: "sarah_exec",
          name: "Sarah Chen",
          role: "Financial Vice President",
          testimony: "I never left the penthouse suite. I was nowhere near the VIP balcony.",
          flawClue: "Sarah Chen's VIP Balcony Access Log",
          breakResponse: "My card was scanned at the balcony?! Curse those redundant offline magnetic readers!"
        }
      ],
      solution: {
        culprit: "sarah_exec",
        motive: "Silencing a Blackmail Whistleblower",
        evidence: "Sarah Chen's VIP Balcony Access Log"
      }
    }
  ];

  let currentCaseIdx = 0;
  let collectedClues = [];
  let examinedHotspots = new Set();
  let activeSuspectId = null;

  // --- INIT & SETUP ---
  function loadCase(idx) {
    currentCaseIdx = idx;
    const c = CASES[currentCaseIdx];
    collectedClues = [];
    examinedHotspots = new Set();
    activeSuspectId = c.suspects[0].id;

    document.getElementById('case-badge').textContent = c.title;
    document.getElementById('clue-count').textContent = '0';

    renderHotspots();
    renderSuspects();
    renderNotebook();
    populateWarrantDropdowns();

    document.getElementById('verdict-modal').classList.add('hidden');
    document.getElementById('warrant-modal').classList.add('hidden');
    document.getElementById('help-modal').classList.add('hidden');
  }

  // --- HOTSPOT / EVIDENCE EXAMINATION ---
  function renderHotspots() {
    const c = CASES[currentCaseIdx];
    const grid = document.getElementById('hotspots-grid');
    grid.innerHTML = '';

    c.hotspots.forEach(h => {
      const card = document.createElement('div');
      card.className = `hotspot-card ${examinedHotspots.has(h.id) ? 'examined' : ''}`;
      card.innerHTML = `
        <span class="hotspot-tag">${h.tag}</span>
        <h4>${h.title}</h4>
        <p>${h.desc}</p>
      `;

      card.addEventListener('click', () => {
        sound.init();
        if (!examinedHotspots.has(h.id)) {
          examinedHotspots.add(h.id);
          collectedClues.push(h.clue);
          sound.playClue();
          showClueToast(h.title, h.clue);
          card.classList.add('examined');
          document.getElementById('clue-count').textContent = collectedClues.length;
          renderNotebook();
          renderSuspectInterrogation();
          populateWarrantDropdowns();
        }
      });

      grid.appendChild(card);
    });
  }

  function showClueToast(title, clue) {
    const toast = document.getElementById('clue-toast');
    document.getElementById('clue-toast-title').textContent = title.toUpperCase();
    document.getElementById('clue-toast-desc').textContent = `New Evidence: "${clue}"`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  // --- INTERROGATION ROOM ---
  function renderSuspects() {
    const c = CASES[currentCaseIdx];
    const list = document.getElementById('suspects-list');
    list.innerHTML = '';

    c.suspects.forEach(s => {
      const item = document.createElement('div');
      item.className = `suspect-item ${s.id === activeSuspectId ? 'active' : ''}`;
      item.innerHTML = `
        <div>
          <div class="suspect-name">${s.name}</div>
          <div class="suspect-tagline">${s.role}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        sound.init();
        activeSuspectId = s.id;
        document.querySelectorAll('.suspect-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderSuspectInterrogation();
      });
      list.appendChild(item);
    });

    renderSuspectInterrogation();
  }

  function renderSuspectInterrogation() {
    const c = CASES[currentCaseIdx];
    const s = c.suspects.find(sp => sp.id === activeSuspectId) || c.suspects[0];

    document.getElementById('active-name').textContent = s.name;
    document.getElementById('active-role').textContent = s.role;
    document.getElementById('active-testimony').textContent = `"${s.testimony}"`;

    const selector = document.getElementById('evidence-selector');
    selector.innerHTML = '';
    const feedback = document.getElementById('contra-feedback');
    feedback.className = 'feedback-msg hidden';

    if (collectedClues.length === 0) {
      selector.innerHTML = '<span style="color:#64748b; font-size:0.75rem;">(Examine crime scene to collect evidence to present)</span>';
      return;
    }

    collectedClues.forEach(clue => {
      const btn = document.createElement('button');
      btn.className = 'evidence-pill-btn';
      btn.textContent = clue;
      btn.addEventListener('click', () => {
        sound.init();
        if (clue === s.flawClue) {
          sound.playContradictionSuccess();
          feedback.className = 'feedback-msg success';
          feedback.textContent = `CONTRADICTION EXPOSED! ${s.name}: "${s.breakResponse}"`;
          document.getElementById('active-testimony').textContent = `"${s.breakResponse}"`;
        } else {
          sound.playError();
          feedback.className = 'feedback-msg fail';
          feedback.textContent = `${s.name}: "That proves nothing about my involvement!"`;
        }
      });
      selector.appendChild(btn);
    });
  }

  // --- EVIDENCE NOTEBOOK ---
  function renderNotebook() {
    const grid = document.getElementById('notebook-grid');
    grid.innerHTML = '';

    if (collectedClues.length === 0) {
      grid.innerHTML = '<p style="color:#64748b; font-size:0.9rem;">No clues secured yet. Investigate the Crime Scene hotspots.</p>';
      return;
    }

    collectedClues.forEach((clue, idx) => {
      const card = document.createElement('div');
      card.className = 'evidence-card';
      card.innerHTML = `
        <h4>Clue #${idx + 1}</h4>
        <p><strong>${clue}</strong></p>
      `;
      grid.appendChild(card);
    });
  }

  // --- WARRANT INDICTMENT ---
  function populateWarrantDropdowns() {
    const c = CASES[currentCaseIdx];
    const sSelect = document.getElementById('warrant-suspect');
    const mSelect = document.getElementById('warrant-motive');
    const eSelect = document.getElementById('warrant-evidence');

    sSelect.innerHTML = '';
    c.suspects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.role})`;
      sSelect.appendChild(opt);
    });

    mSelect.innerHTML = `
      <option value="Corporate Espionage Betrayal">Corporate Espionage Betrayal</option>
      <option value="Black-Market Tech Smuggling">Black-Market Tech Smuggling</option>
      <option value="Silencing a Blackmail Whistleblower">Silencing a Blackmail Whistleblower</option>
      <option value="AI Singularity Sabotage">AI Singularity Sabotage</option>
    `;

    eSelect.innerHTML = '';
    collectedClues.forEach(clue => {
      const opt = document.createElement('option');
      opt.value = clue;
      opt.textContent = clue;
      eSelect.appendChild(opt);
    });
  }

  document.getElementById('execute-warrant-btn').addEventListener('click', () => {
    sound.init();
    const c = CASES[currentCaseIdx];
    const chosenSuspect = document.getElementById('warrant-suspect').value;
    const chosenMotive = document.getElementById('warrant-motive').value;
    const chosenEvidence = document.getElementById('warrant-evidence').value;

    document.getElementById('warrant-modal').classList.add('hidden');

    const isCorrect = (chosenSuspect === c.solution.culprit && chosenEvidence === c.solution.evidence);

    if (isCorrect) {
      sound.playContradictionSuccess();
      document.getElementById('verdict-badge').className = 'badge-tag';
      document.getElementById('verdict-badge').textContent = 'VERDICT AFFIRMED';
      document.getElementById('verdict-title').textContent = 'CASE CLOSED SUCCESSFULLY';
      document.getElementById('verdict-desc').textContent = `Correct deduction! The perpetrator was apprehended with undeniable forensic proof.`;
      document.getElementById('new-case-btn').textContent = currentCaseIdx + 1 < CASES.length ? 'PROCEED TO CASE #02' : 'RESTART INVESTIGATION';
    } else {
      sound.playError();
      document.getElementById('verdict-badge').className = 'badge-tag red';
      document.getElementById('verdict-badge').textContent = 'INDICTMENT DISMISSED';
      document.getElementById('verdict-title').textContent = 'FALSE ACCUSATION';
      document.getElementById('verdict-desc').textContent = `Insufficient proof or wrongful accusation! The true culprit covered their tracks. Re-examine the evidence and alibis.`;
      document.getElementById('new-case-btn').textContent = 'TRY AGAIN';
    }

    document.getElementById('verdict-modal').classList.remove('hidden');
  });

  document.getElementById('new-case-btn').addEventListener('click', () => {
    if (document.getElementById('verdict-badge').classList.contains('red')) {
      loadCase(currentCaseIdx);
    } else {
      if (currentCaseIdx + 1 < CASES.length) loadCase(currentCaseIdx + 1);
      else loadCase(0);
    }
  });

  // --- TABS & NAVIGATION ---
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      sound.init();
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
    });
  });

  document.getElementById('warrant-btn').addEventListener('click', () => {
    sound.init();
    document.getElementById('warrant-modal').classList.remove('hidden');
  });
  document.getElementById('close-warrant-btn').addEventListener('click', () => {
    document.getElementById('warrant-modal').classList.add('hidden');
  });

  document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
  });
  document.getElementById('close-help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
  });

  document.getElementById('sound-btn').addEventListener('click', () => {
    sound.init();
    sound.enabled = !sound.enabled;
    document.getElementById('sound-on').classList.toggle('hidden', !sound.enabled);
    document.getElementById('sound-off').classList.toggle('hidden', sound.enabled);
  });

  // Launch initial case
  loadCase(0);
})();
