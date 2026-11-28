(function (root) {
  'use strict';
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?'!/-():;=+_\"@$";
  const codes = ['.-','-...','-.-.','-..','.','..-.','--.','....','..','.---','-.-','.-..','--','-.','---','.--.','--.-','.-.','...','-','..-','...-','.--','-..-','-.--','--..','-----','.----','..---','...--','....-','.....','-....','--...','---..','----.','.-.-.-','--..--','..--..','.----.','-.-.--','-..-.','-....-','-.--.','-.--.-','---...','-.-.-.','-...-','.-.-.','..--.-','.-..-.','.--.-.','...-..-'];
  const alphabet = Object.fromEntries(Array.from(letters, (letter, index) => [letter, codes[index]]));
  const reverse = Object.fromEntries(Object.entries(alphabet).map(([letter, code]) => [code, letter]));
  function encode(text) {
    if (!text.trim()) return '';
    return text.toUpperCase().trim().split(/\s+/).map(word => Array.from(word).map(letter => {
      if (!alphabet[letter]) throw new Error('Unsupported character: ' + letter);
      return alphabet[letter];
    }).join(' ')).join(' / ');
  }
  function decode(code) {
    if (!code.trim()) return '';
    return code.trim().split(/\s*\/\s*/).map(word => word.split(/\s+/).map(token => {
      if (!reverse[token]) throw new Error('Unknown Morse symbol: ' + token);
      return reverse[token];
    }).join('')).join(' ');
  }
  function timeline(code, wpm) {
    if (!Number.isFinite(wpm) || wpm < 5 || wpm > 35) throw new Error('Speed must be 5–35 WPM.');
    if (!code.trim()) return [];
    decode(code);
    const unit = 1.2 / wpm;
    const events = [];
    let time = 0;
    code.trim().split(/\s*\/\s*/).forEach((word, wi) => {
      if (wi) time += 7 * unit;
      word.trim().split(/\s+/).forEach((letter, li) => {
        if (li) time += 3 * unit;
        Array.from(letter).forEach((symbol, si) => {
          if (si) time += unit;
          const duration = (symbol === '-' ? 3 : 1) * unit;
          events.push({time, duration});
          time += duration;
        });
      });
    });
    return events;
  }
  function envelope(param, start, duration, level) {
    const peak = Math.max(0.00001, level);
    param.setValueAtTime(0.00001, start);
    param.exponentialRampToValueAtTime(peak, start + 0.005);
    param.setValueAtTime(peak, start + duration - 0.005);
    param.exponentialRampToValueAtTime(0.00001, start + duration);
    param.setValueAtTime(0, start + duration + 0.001);
  }
  const api = {encode, decode, timeline, envelope};
  if (typeof module !== 'undefined') module.exports = api;
  root.MorseKeyer = api;
  if (typeof document === 'undefined' || !document.getElementById('key')) return;
  const get = id => document.getElementById(id);
  const status = message => { get('status').textContent = message; };
  let context, master, analyser, liveVoice;
  let voices = [];
  let held = false, pressedAt = 0, symbols = '', transcript = '', received = '';
  let letterTimer, wordTimer, finishTimer, frame;
  let starting = false, cancelled = false;
  let playbackVersion = 0;
  async function audio() {
    if (!context) {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio is unavailable in this browser.');
      context = new Audio();
      master = context.createGain();
      master.gain.value = Number(get('volume').value);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(analyser);
      analyser.connect(context.destination);
    }
    await context.resume();
    return context;
  }
  function voice() {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = Number(get('tone').value);
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    return {oscillator, gain};
  }
  function waveform() {
    cancelAnimationFrame(frame);
    const canvas = get('wave'), paint = canvas.getContext('2d');
    const samples = new Uint8Array(analyser.fftSize);
    function draw() {
      analyser.getByteTimeDomainData(samples);
      paint.clearRect(0, 0, canvas.width, canvas.height);
      paint.strokeStyle = '#79e7df'; paint.lineWidth = 2; paint.beginPath();
      samples.forEach((sample, i) => {
        const x = i * canvas.width / samples.length, y = sample * canvas.height / 256;
        if (i) paint.lineTo(x, y); else paint.moveTo(x, y);
      });
      paint.stroke();
      if (voices.length || held) frame = requestAnimationFrame(draw);
    }
    draw();
  }
  function finishLetter() {
    if (!symbols) return;
    received += (received ? ' ' : '') + symbols;
    transcript += reverse[symbols] || '?';
    symbols = '';
    get('received-code').textContent = received;
    get('received-text').textContent = transcript;
  }
  function keyUp() {
    if (!held) return;
    held = false;
    get('key').setAttribute('aria-pressed', 'false');
    const duration = (performance.now() - pressedAt) / 1000;
    const unit = 1.2 / Number(get('speed').value);
    symbols += duration < 2 * unit ? '.' : '-';
    if (liveVoice) {
      const now = context.currentTime;
      liveVoice.gain.gain.cancelAndHoldAtTime(now);
      liveVoice.gain.gain.linearRampToValueAtTime(0, now + 0.005);
      liveVoice.oscillator.stop(now + 0.006);
      liveVoice = null;
    }
    get('received-code').textContent = received + ' ' + symbols;
    letterTimer = setTimeout(finishLetter, 3 * unit * 1000);
    wordTimer = setTimeout(() => {
      finishLetter();
      if (transcript && !transcript.endsWith(' ')) {
        transcript += ' '; received += ' /';
        get('received-code').textContent = received;
        get('received-text').textContent = transcript;
      }
    }, 7 * unit * 1000);
  }
  function stop() {
    cancelled = true;
    playbackVersion += 1;
    clearTimeout(finishTimer);
    voices.forEach(v => {
      const now = context.currentTime;
      v.gain.gain.cancelAndHoldAtTime(now);
      v.gain.gain.linearRampToValueAtTime(0, now + 0.005);
      v.oscillator.stop(now + 0.006);
    });
    voices = [];
    keyUp();
  }
  async function keyDown() {
    if (held || starting || voices.length) return;
    starting = true; cancelled = false;
    try {
      await audio();
      if (cancelled) return;
      clearTimeout(letterTimer); clearTimeout(wordTimer);
      held = true; pressedAt = performance.now();
      liveVoice = voice();
      liveVoice.gain.gain.setValueAtTime(0, context.currentTime);
      liveVoice.gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.005);
      liveVoice.oscillator.start();
      get('key').setAttribute('aria-pressed','true');
      waveform();
    } catch (error) { status(error.message); }
    finally { starting = false; }
  }
  const key = get('key');
  key.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); key.focus(); key.setPointerCapture(event.pointerId); keyDown();
  });
  key.addEventListener('pointerup', () => { cancelled = true; keyUp(); });
  key.addEventListener('pointercancel', () => { cancelled = true; keyUp(); });
  key.addEventListener('lostpointercapture', () => { cancelled = true; keyUp(); });
  key.addEventListener('keydown', event => {
    if (event.code !== 'Space') return;
    event.preventDefault();
    if (!event.repeat) keyDown();
  });
  key.addEventListener('keyup', event => {
    if (event.code === 'Space') { event.preventDefault(); cancelled = true; keyUp(); }
  });
  key.addEventListener('blur', () => { cancelled = true; keyUp(); });
  get('encode').onclick = () => {
    try { get('code').value = encode(get('text').value); status('Message encoded.'); }
    catch (error) { status(error.message); }
  };
  get('decode').onclick = () => {
    try { get('text').value = decode(get('code').value); status('Morse decoded.'); }
    catch (error) { status(error.message); }
  };
  get('play').onclick = async () => {
    stop(); cancelled = false;
    const version = playbackVersion;
    try {
      const events = timeline(get('code').value, Number(get('speed').value));
      if (!events.length) throw new Error('Enter a message first.');
      await audio();
      if (cancelled) return;
      if (version !== playbackVersion) return;
      const start = context.currentTime + 0.03;
      voices = events.map(event => {
        const v = voice(), at = start + event.time;
        envelope(v.gain.gain, at, event.duration, 1);
        v.oscillator.start(at); v.oscillator.stop(at + event.duration + 0.002);
        return v;
      });
      waveform();
      status('Playing message.');
      const end = events[events.length - 1];
      finishTimer = setTimeout(() => { voices = []; status('Playback complete.'); }, (end.time + end.duration + 0.04) * 1000);
    } catch (error) { status(error.message); }
  };
  get('stop').onclick = () => { stop(); status('Stopped.'); };
  get('clear').onclick = () => {
    stop(); clearTimeout(letterTimer); clearTimeout(wordTimer);
    symbols = ''; transcript = ''; received = '';
    get('received-code').textContent = ''; get('received-text').textContent = '';
  };
  for (const id of ['speed','tone','volume']) get(id).oninput = () => {
    const value = Number(get(id).value);
    get(id + '-value').textContent = id === 'volume' ? Math.round(value * 200) + '%' : value + (id === 'speed' ? ' WPM' : ' Hz');
    if (id === 'volume' && master) master.gain.setTargetAtTime(value, context.currentTime, 0.01);
    if (id === 'tone' && liveVoice) liveVoice.oscillator.frequency.setTargetAtTime(value, context.currentTime, 0.01);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  root.addEventListener('pagehide', () => { stop(); if (context) context.close(); });
})(typeof window === 'undefined' ? globalThis : window);
