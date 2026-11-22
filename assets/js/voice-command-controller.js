/**
 * VoiceCommandController - Web Speech Recognition & Intent Mapping Engine
 * 
 * Provides accessible voice-driven gaming inputs using Web Speech API,
 * phoneme/Levenshtein fuzzy matching, and synthetic keyboard event dispatching.
 */
class VoiceCommandController {
  constructor(options = {}) {
    this.target = options.target || (typeof window !== 'undefined' ? window : null);
    this.confidenceThreshold = options.confidenceThreshold !== undefined ? options.confidenceThreshold : 0.65;
    this.commands = new Map();
    this.listening = false;
    this.lastRecognized = null;

    // Initialize mock or native speech recognition
    this.SpeechRecognition = typeof window !== 'undefined' 
      ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
      : null;
    this.recognition = null;
  }

  registerCommand(phrase, keyMapping, options = {}) {
    const normalized = phrase.trim().toLowerCase();
    this.commands.set(normalized, {
      key: keyMapping.key || 'Space',
      code: keyMapping.code || 'Space',
      keyCode: keyMapping.keyCode || 32,
      holdDuration: options.holdDuration || 120
    });
  }

  levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  matchPhrase(transcript) {
    const text = transcript.trim().toLowerCase();
    if (this.commands.has(text)) {
      return { phrase: text, command: this.commands.get(text), distance: 0 };
    }

    let closest = null;
    let minDistance = Infinity;

    for (const [registeredPhrase, command] of this.commands.entries()) {
      const dist = this.levenshtein(text, registeredPhrase);
      if (dist < minDistance && dist <= 2) {
        minDistance = dist;
        closest = { phrase: registeredPhrase, command, distance: dist };
      }
    }

    return closest;
  }

  dispatchInput(command) {
    if (!this.target) return;

    if (typeof this.target.dispatchEvent === 'function') {
      const downEvent = typeof KeyboardEvent !== 'undefined'
        ? new KeyboardEvent('keydown', { key: command.key, code: command.code, keyCode: command.keyCode, bubbles: true })
        : { type: 'keydown', key: command.key, code: command.code };
      
      this.target.dispatchEvent(downEvent);

      setTimeout(() => {
        const upEvent = typeof KeyboardEvent !== 'undefined'
          ? new KeyboardEvent('keyup', { key: command.key, code: command.code, keyCode: command.keyCode, bubbles: true })
          : { type: 'keyup', key: command.key, code: command.code };
        this.target.dispatchEvent(upEvent);
      }, command.holdDuration);
    }
  }

  processTranscript(transcript, confidence = 1.0) {
    if (confidence < this.confidenceThreshold) return null;
    const match = this.matchPhrase(transcript);
    if (match) {
      this.lastRecognized = match.phrase;
      this.dispatchInput(match.command);
      return match;
    }
    return null;
  }

  start() {
    this.listening = true;
    if (this.SpeechRecognition && !this.recognition) {
      this.recognition = new this.SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.onresult = (e) => {
        const result = e.results[e.results.length - 1];
        if (result && result[0]) {
          this.processTranscript(result[0].transcript, result[0].confidence);
        }
      };
      this.recognition.start();
    }
  }

  stop() {
    this.listening = false;
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VoiceCommandController };
}
