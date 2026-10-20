// audio.js — Advanced Audio Processing, FX Rack, EQ, Knob UI
// Fixed & Enhanced

// ============================================================
//  STATE
// ============================================================
let currentFile      = null;
let originalDuration = 0;
let decodedAudioBuffer = null;
let liveAudioCtx     = null;
let liveSourceNode   = null;
let isPlaying        = false;
let playbackStartTime = 0;  // liveAudioCtx.currentTime when play started
let pauseOffset      = 0;   // audio-time cursor in seconds
let animationFrameId = null;

const fxState = {
    bypass: false,
    reverb:  { enabled: false, wet: 0.25, decay: 1.8, pre: 0.02 },
    delay:   { enabled: false, time: 0.38, feedback: 0.40, wet: 0.30 },
    dist:    { enabled: false, drive: 40,  tone: 0.6 },
    chorus:  { enabled: false, rate: 0.5,  depth: 0.004 },
    comp:    { enabled: true,  threshold: -20, ratio: 4, attack: 0.010, release: 0.120 },
};

const eqState = {
    enabled: true,
    // [freq, gain(dB), type]
    bands: [
        [60,    0, 'lowshelf'],
        [250,   0, 'peaking'],
        [500,   0, 'peaking'],
        [1000,  0, 'peaking'],
        [3500,  0, 'peaking'],
        [7000,  0, 'peaking'],
        [16000, 0, 'highshelf'],
    ]
};

let pitchSemitones = 0;   // ±24
let speedRate      = 1.0; // 0.25–4.0

// ============================================================
//  KNOB INITIALISATION
// ============================================================
function initKnobs() {
    document.querySelectorAll('.knob').forEach(knob => {
        // Read initial value from data-val and sync label
        const val = parseFloat(knob.dataset.val) ?? 50;
        setKnobRotation(knob, val);
        // Sync label from actual data-val (not hardcoded 50)
        const fx = knob.dataset.fx;
        const param = knob.dataset.param;
        if (fx && param) updateKnobLabel(fx, param, val);

        let startY, startVal;

        const onMouseMove = (e) => {
            const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? startY;
            const dy = startY - clientY;
            const newVal = Math.max(0, Math.min(100, startVal + dy));
            knob.dataset.val = newVal;
            setKnobRotation(knob, newVal);
            dispatchKnobChange(knob, newVal);
        };
        const onMouseUp = () => {
            knob.classList.remove('active');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup',  onMouseUp);
            document.removeEventListener('touchmove', onMouseMove);
            document.removeEventListener('touchend',  onMouseUp);
        };

        knob.addEventListener('mousedown', (e) => {
            startY   = e.clientY;
            startVal = parseFloat(knob.dataset.val) ?? 50;
            knob.classList.add('active');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup',  onMouseUp);
            e.preventDefault();
        });

        knob.addEventListener('touchstart', (e) => {
            startY   = e.touches[0].clientY;
            startVal = parseFloat(knob.dataset.val) ?? 50;
            knob.classList.add('active');
            document.addEventListener('touchmove', onMouseMove, { passive: false });
            document.addEventListener('touchend',  onMouseUp);
            e.preventDefault();
        }, { passive: false });

        // Double-click → reset to default (50 = centre)
        knob.addEventListener('dblclick', () => {
            knob.dataset.val = 50;
            setKnobRotation(knob, 50);
            dispatchKnobChange(knob, 50);
        });

        // Scroll wheel support
        knob.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 2 : -2;
            const newVal = Math.max(0, Math.min(100, (parseFloat(knob.dataset.val) ?? 50) + delta));
            knob.dataset.val = newVal;
            setKnobRotation(knob, newVal);
            dispatchKnobChange(knob, newVal);
        }, { passive: false });
    });
}

function setKnobRotation(knob, val) {
    const dot = knob.querySelector('.knob-dot');
    if (!dot) return;
    // -135° (min) → +135° (max), centre = val 50
    const deg = (val / 100) * 270 - 135;
    dot.style.transform = `translateX(-50%) rotate(${deg}deg)`;
}

function dispatchKnobChange(knob, val) {
    const fx    = knob.dataset.fx;
    const param = knob.dataset.param;
    if (!fx || !param) return;

    applyKnobValue(fx, param, val / 100);
    updateKnobLabel(fx, param, val);
}

// ============================================================
//  KNOB LABEL UPDATES
// ============================================================
function updateKnobLabel(fx, param, val0to100) {
    const n   = val0to100;      // 0–100 raw
    const n01 = n / 100;        // 0–1 normalised
    const el  = document.getElementById(`val-${fx}-${param}`);
    if (!el) return;

    let display = Math.round(n);

    if (fx === 'reverb') {
        if (param === 'wet')   display = Math.round(n) + '%';
        if (param === 'decay') display = (n01 * 4).toFixed(1) + 's';
        if (param === 'pre')   display = Math.round(n01 * 80) + 'ms';
    } else if (fx === 'delay') {
        if (param === 'time')  display = Math.round(n01 * 1500) + 'ms';
        if (param === 'fb')    display = Math.round(n) + '%';
        if (param === 'wet')   display = Math.round(n) + '%';
    } else if (fx === 'dist') {
        if (param === 'drive') display = Math.round(n);
        if (param === 'tone')  display = Math.round(n) + '%';
    } else if (fx === 'chorus') {
        if (param === 'rate')  display = (n01 * 4).toFixed(2) + 'Hz';
        if (param === 'depth') display = Math.round(n) + '%';
    } else if (fx === 'comp') {
        if (param === 'thresh')  display = '-' + Math.round(n01 * 50) + 'dB';
        if (param === 'ratio')   display = (1 + n01 * 19).toFixed(1) + ':1';
        if (param === 'attack')  display = Math.round(n01 * 200) + 'ms';
        if (param === 'release') display = Math.round(n01 * 800) + 'ms';
    } else if (fx === 'eq') {
        const gain = (n01 - 0.5) * 30;
        display = (gain >= 0 ? '+' : '') + gain.toFixed(1) + 'dB';
    } else if (fx === 'pitch') {
        if (param === 'semitones') {
            const st = Math.round((n01 - 0.5) * 48);
            display = (st >= 0 ? '+' : '') + st + ' ST';
            pitchSemitones = st;
            const pitchInput = document.getElementById('pitchShift');
            if (pitchInput) pitchInput.value = st;
        }
        if (param === 'speed') {
            const rate = 0.25 + n01 * 3.75;
            display = rate.toFixed(2) + 'x';
            speedRate = rate;
            const speedInput = document.getElementById('speedRate');
            if (speedInput) speedInput.value = rate.toFixed(2);
        }
    }

    el.textContent = display;
}

// ============================================================
//  APPLY KNOB VALUES TO fxState / eqState
// ============================================================
function applyKnobValue(fx, param, n) { // n = 0..1
    if (fx === 'reverb') {
        if (param === 'wet')   fxState.reverb.wet   = n * 0.9;
        if (param === 'decay') fxState.reverb.decay = n * 4;
        if (param === 'pre')   fxState.reverb.pre   = n * 0.08;
    }
    if (fx === 'delay') {
        if (param === 'time')  fxState.delay.time     = n * 1.5;
        if (param === 'fb')    fxState.delay.feedback = n * 0.95;
        if (param === 'wet')   fxState.delay.wet      = n;
    }
    if (fx === 'dist') {
        if (param === 'drive') fxState.dist.drive = n * 100;
        if (param === 'tone')  fxState.dist.tone  = n;
    }
    if (fx === 'chorus') {
        if (param === 'rate')  fxState.chorus.rate  = n * 4;
        if (param === 'depth') fxState.chorus.depth = n * 0.01;
    }
    if (fx === 'comp') {
        if (param === 'thresh')  fxState.comp.threshold = -(n * 50);
        if (param === 'ratio')   fxState.comp.ratio     = 1 + n * 19;
        if (param === 'attack')  fxState.comp.attack    = n * 0.2;
        if (param === 'release') fxState.comp.release   = n * 0.8;
    }
    if (fx === 'eq') {
        const bandIndex = parseInt(param.replace('band', ''));
        if (!isNaN(bandIndex)) {
            eqState.bands[bandIndex][1] = (n - 0.5) * 30;
            drawEQCurve();
        }
    }
}

// ============================================================
//  FX TOGGLE
// ============================================================
function toggleFX(id) {
    if (!fxState[id] || !('enabled' in fxState[id])) return; // guard
    const slot   = document.getElementById(`slot-${id}`);
    const toggle = document.getElementById(`toggle-${id}`);
    if (!slot || !toggle) return;
    fxState[id].enabled = !fxState[id].enabled;
    toggle.classList.toggle('on', fxState[id].enabled);
    slot.classList.toggle('enabled', fxState[id].enabled);
}

// ============================================================
//  EQ CURVE CANVAS
// ============================================================
function drawEQCurve() {
    const canvas = document.getElementById('eqCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Sync canvas pixel dimensions to its CSS layout size
    const W = canvas.clientWidth || canvas.offsetWidth || 400;
    const H = canvas.clientHeight || parseInt(canvas.getAttribute('height')) || 140;
    canvas.width  = W;
    canvas.height = H;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    for (let i = 1; i < 4; i++) {
        const y = (i / 4) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // 0 dB centre line
    ctx.strokeStyle = 'rgba(0,232,184,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.setLineDash([]);

    if (!eqState.enabled) {
        ctx.fillStyle = 'rgba(90,100,120,0.7)';
        ctx.font = '11px IBM Plex Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EQ BYPASSED', W / 2, H / 2 + 4);
        return;
    }

    // Frequency response curve (log-scale visual approximation)
    const freqPoints = 200;
    const minFreq    = 20;
    const maxFreq    = 20000;

    // Build curve points first
    const points = [];
    for (let i = 0; i <= freqPoints; i++) {
        const t    = i / freqPoints;
        const freq = minFreq * Math.pow(maxFreq / minFreq, t);
        let gain   = 0;

        eqState.bands.forEach(([bandFreq, bandGain, type]) => {
            const Q = type === 'peaking' ? 1.2 : 0.7;
            let g;
            if (type === 'peaking') {
                const denom = 1 + ((freq - bandFreq) / (bandFreq / Q)) ** 2;
                g = bandGain / denom;
            } else if (type === 'lowshelf') {
                g = bandGain * Math.max(0, 1 - (freq - bandFreq) / bandFreq);
            } else { // highshelf
                g = bandGain * Math.max(0, 1 - (bandFreq - freq) / bandFreq);
            }
            gain += (isFinite(g) ? g : 0);
        });

        const maxGain = 15;
        const y = H / 2 - (gain / maxGain) * (H / 2 - 8);
        points.push({ x: t * W, y });
    }

    // Filled gradient area under curve (separate path from stroke)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,232,184,0.15)');
    grad.addColorStop(1, 'rgba(0,232,184,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the curve on a fresh path (no fill artefacts)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#00e8b8';
    ctx.lineWidth   = 2;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = 'rgba(0,232,184,0.5)';
    ctx.stroke();
    ctx.shadowBlur  = 0;
}

function resetEQ() {
    eqState.bands.forEach((b, i) => {
        b[1] = 0;
        const knob = document.querySelector(`.knob[data-fx="eq"][data-param="band${i}"]`);
        if (knob) {
            knob.dataset.val = 50;
            setKnobRotation(knob, 50);
        }
        const label = document.getElementById(`val-eq-band${i}`);
        if (label) label.textContent = '0.0dB';
    });
    drawEQCurve();
}

// ============================================================
//  WAVEFORM CANVAS
// ============================================================
function syncWaveformCanvasSize() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return false;
    const newW = canvas.clientWidth || canvas.offsetWidth || 500;
    const newH = 120;
    if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width  = newW;
        canvas.height = newH;
        // Invalidate peak cache on resize
        window.cachedWaveformPeaks = null;
        return true;
    }
    return false;
}

function drawWaveform(buffer, currentTime = 0) {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;

    syncWaveformCanvasSize();
    const ctx    = canvas.getContext('2d');
    const width  = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    if (!buffer) return;

    // Build or reuse peak cache (keyed to current canvas width)
    if (!window.cachedWaveformPeaks || window.cachedWaveformPeaks.length !== width) {
        const leftChannel = buffer.getChannelData(0);
        const skip = Math.max(1, Math.floor(leftChannel.length / width));
        window.cachedWaveformPeaks = new Float32Array(width);
        for (let i = 0; i < width; i++) {
            let max = 0;
            const base = i * skip;
            for (let j = 0; j < skip; j++) {
                const val = Math.abs(leftChannel[base + j] || 0);
                if (val > max) max = val;
            }
            window.cachedWaveformPeaks[i] = max;
        }
    }

    const peaks     = window.cachedWaveformPeaks;
    const playheadX = Math.min(width - 1, (currentTime / buffer.duration) * width);
    const barSpacing = 2;

    for (let i = 0; i < width; i += barSpacing) {
        const peak      = peaks[i] || 0;
        const barHeight = Math.max(2, peak * height * 0.85);
        const y0 = (height - barHeight) / 2;
        const y1 = (height + barHeight) / 2;

        ctx.lineWidth = 1.5;
        if (i < playheadX) {
            ctx.strokeStyle = 'var(--primary, #0052cc)';
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        }
        ctx.beginPath();
        ctx.moveTo(i + 0.5, y0);
        ctx.lineTo(i + 0.5, y1);
        ctx.stroke();
    }

    // Playhead line
    ctx.strokeStyle = 'var(--primary, #0052cc)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
}

// ============================================================
//  UI TABS
// ============================================================
function switchTab(tabId, event) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    const panel = document.getElementById('tab-' + tabId);
    if (panel) panel.classList.add('active');
    if (tabId === 'eq') {
        // Use rAF so the tab is visible and has layout before drawing
        requestAnimationFrame(() => drawEQCurve());
    }
}

function toggleFormatOptions() {
    const format = document.getElementById('formatSelect')?.value;
    const opts   = document.getElementById('mp3Options');
    if (opts) opts.style.display = (format === 'mp3') ? 'block' : 'none';
}

function resetUploader() {
    // Stop any in-progress playback first
    if (isPlaying) pausePreview();

    currentFile    = null;
    pauseOffset    = 0;
    window.cachedWaveformPeaks = null;

    // Close the live audio context so it doesn't leak
    if (liveAudioCtx) {
        liveAudioCtx.close().catch(() => {});
        liveAudioCtx = null;
    }
    decodedAudioBuffer = null;
    originalDuration   = 0;

    const audioInput  = document.getElementById('audioInput');
    const uploadUI    = document.getElementById('uploadUI');
    const playerCon   = document.getElementById('playerContainer');
    const player      = document.getElementById('audioPlayer');
    const dl          = document.getElementById('downloadLink');
    const convertBtn  = document.getElementById('convertBtn');
    const liveControls = document.getElementById('livePlayerControls');

    if (audioInput)   audioInput.value       = '';
    if (uploadUI)     uploadUI.style.display  = 'block';
    if (playerCon)    playerCon.style.display = 'none';
    if (player)       player.src              = '';
    if (dl)           dl.style.display        = 'none';
    if (convertBtn)   convertBtn.disabled     = true;
    if (liveControls) liveControls.style.display = 'none';

    updateStatus('Ready to process', 0);
}

function updateStatus(text, progress) {
    const st = document.getElementById('statusText');
    const pb = document.getElementById('progressBar');
    if (st) st.innerText = text;
    if (pb) pb.value     = progress;
}

// ============================================================
//  FILE DROP & UPLOAD
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const dropzone   = document.getElementById('dropzone');
    const audioInput = document.getElementById('audioInput');

    if (dropzone) {
        dropzone.addEventListener('dragover',  (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
        });
    }
    if (audioInput) {
        audioInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFile(e.target.files[0]);
        });
    }

    // EQ enabled checkbox
    const eqCheck = document.getElementById('eqEnabled');
    if (eqCheck) {
        eqCheck.addEventListener('change', () => {
            eqState.enabled = eqCheck.checked;
            drawEQCurve();
        });
    }

    // FX bypass checkbox
    const bypassCheck = document.getElementById('fxBypass');
    if (bypassCheck) {
        bypassCheck.addEventListener('change', () => {
            fxState.bypass = bypassCheck.checked;
        });
    }

    // Sync trim-tab pitch/speed numeric inputs with FX rack knobs
    const pitchInput = document.getElementById('pitchShift');
    if (pitchInput) pitchInput.addEventListener('input', () => {
        pitchSemitones = Math.max(-24, Math.min(24, parseFloat(pitchInput.value) || 0));
        const n = (pitchSemitones / 48 + 0.5) * 100;
        const knob = document.querySelector('.knob[data-fx="pitch"][data-param="semitones"]');
        if (knob) { knob.dataset.val = n; setKnobRotation(knob, n); updateKnobLabel('pitch', 'semitones', n); }
    });
    const speedInput = document.getElementById('speedRate');
    if (speedInput) speedInput.addEventListener('input', () => {
        speedRate = Math.max(0.25, Math.min(4.0, parseFloat(speedInput.value) || 1.0));
        const n = ((speedRate - 0.25) / 3.75) * 100;
        const knob = document.querySelector('.knob[data-fx="pitch"][data-param="speed"]');
        if (knob) { knob.dataset.val = n; setKnobRotation(knob, n); updateKnobLabel('pitch', 'speed', n); }
    });

    // Keyboard shortcut: Space = play/pause
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && decodedAudioBuffer) {
            // Prevent page scroll
            if (e.target === document.body || e.target.tagName === 'BUTTON') e.preventDefault();
            togglePlayback();
        }
    });

    initKnobs();
    drawEQCurve();

    // ResizeObserver for waveform canvas
    const waveCanvas = document.getElementById('waveformCanvas');
    if (waveCanvas && window.ResizeObserver) {
        new ResizeObserver(() => {
            window.cachedWaveformPeaks = null;
            if (decodedAudioBuffer) {
                const playbackRate = Math.pow(2, pitchSemitones / 12) * speedRate;
                const current = isPlaying
                    ? (liveAudioCtx.currentTime - playbackStartTime) * playbackRate + pauseOffset
                    : pauseOffset;
                drawWaveform(decodedAudioBuffer, current);
            }
        }).observe(waveCanvas);
    }
});

// ============================================================
//  WAVEFORM TIMELINE SCRUB (click & drag)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;

    let isDragging = false;

    function getTimeFromEvent(e) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX ?? e.touches?.[0]?.clientX ?? rect.left) - rect.left;
        return Math.max(0, Math.min(originalDuration, (x / rect.width) * originalDuration));
    }

    function scrub(e) {
        if (!decodedAudioBuffer || !originalDuration) return;
        pauseOffset = getTimeFromEvent(e);
        const timeDisplay = document.getElementById('currentTimeDisplay');
        if (timeDisplay) timeDisplay.textContent = formatTime(pauseOffset);
        drawWaveform(decodedAudioBuffer, pauseOffset);
        if (isPlaying) { pausePreview(); playPreview(); }
    }

    canvas.addEventListener('mousedown', (e) => { isDragging = true; scrub(e); });
    window.addEventListener('mousemove', (e) => { if (isDragging) scrub(e); });
    window.addEventListener('mouseup',  ()  => { isDragging = false; });

    canvas.addEventListener('touchstart', (e) => { isDragging = true; scrub(e); e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove',  (e) => { if (isDragging) { scrub(e); e.preventDefault(); } }, { passive: false });
    window.addEventListener('touchend',   ()  => { isDragging = false; });
});

// ============================================================
//  FILE HANDLER
// ============================================================
async function handleFile(file) {
    // Stop existing playback & clean up old context
    if (isPlaying) pausePreview();
    if (liveAudioCtx) {
        liveAudioCtx.close().catch(() => {});
        liveAudioCtx = null;
    }
    decodedAudioBuffer = null;
    window.cachedWaveformPeaks = null;
    pauseOffset = 0;

    if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        alert('Please upload a valid audio or video file.');
        return;
    }
    currentFile = file;

    const uploadUI    = document.getElementById('uploadUI');
    const playerCon   = document.getElementById('playerContainer');
    const fileDetails = document.getElementById('fileDetails');
    const convertBtn  = document.getElementById('convertBtn');

    if (uploadUI)    uploadUI.style.display   = 'none';
    if (playerCon)   playerCon.style.display  = 'block';
    if (fileDetails) fileDetails.innerText    = `${file.name}  (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    if (convertBtn)  convertBtn.disabled      = false;

    updateStatus('Decoding audio for live preview…', 10);

    try {
        const ab = await file.arrayBuffer();
        liveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Clone the buffer so decodeAudioData doesn't detach it
        decodedAudioBuffer = await liveAudioCtx.decodeAudioData(ab.slice(0));

        originalDuration = decodedAudioBuffer.duration;

        const endTimeEl = document.getElementById('endTime');
        if (endTimeEl) endTimeEl.placeholder = originalDuration.toFixed(1);

        const liveControls = document.getElementById('livePlayerControls');
        if (liveControls) liveControls.style.display = 'flex';

        const durationDisplay = document.getElementById('durationDisplay');
        if (durationDisplay) durationDisplay.textContent = formatTime(originalDuration);

        const currentTimeDisplay = document.getElementById('currentTimeDisplay');
        if (currentTimeDisplay) currentTimeDisplay.textContent = '0:00';

        // Sync canvas dimensions before drawing
        syncWaveformCanvasSize();
        drawWaveform(decodedAudioBuffer, 0);
        updateStatus('File loaded — ready to process', 0);
    } catch (e) {
        updateStatus('Error decoding audio: ' + e.message, 0);
        console.error(e);
    }
}

// ============================================================
//  MAKE DISTORTION CURVE
// ============================================================
function makeDistortionCurve(amount) {
    const n    = 256;
    const curve = new Float32Array(n);
    const deg  = Math.PI / 180;
    const k    = typeof amount === 'number' ? amount : 50;
    for (let i = 0; i < n; ++i) {
        const x = (i * 2) / n - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// ============================================================
//  BUILD IMPULSE RESPONSE FOR REVERB
// ============================================================
function buildImpulse(sampleRate, decay, pre) {
    const rate   = sampleRate;
    const length = Math.ceil(Math.max(0.1, decay) * rate);   // FIX: must be integer
    const preLen = Math.round(pre * rate);
    const impulse = new AudioBuffer({ length: length + preLen, numberOfChannels: 2, sampleRate: rate });
    for (let c = 0; c < 2; c++) {
        const ch = impulse.getChannelData(c);
        for (let i = 0; i < ch.length; i++) {
            const t = Math.max(0, i - preLen);
            ch[i]   = (Math.random() * 2 - 1) * Math.pow(1 - t / length, 2.5);
        }
    }
    return impulse;
}

// ============================================================
//  LIVE PREVIEW ENGINE
// ============================================================
function togglePlayback() {
    if (!decodedAudioBuffer) return;
    isPlaying ? pausePreview() : playPreview();
}

function playPreview() {
    if (!liveAudioCtx || !decodedAudioBuffer) return;
    if (liveAudioCtx.state === 'suspended') liveAudioCtx.resume();

    liveSourceNode = liveAudioCtx.createBufferSource();
    liveSourceNode.buffer = decodedAudioBuffer;

    const playbackRate = Math.pow(2, pitchSemitones / 12) * speedRate;
    liveSourceNode.playbackRate.value = playbackRate;

    const volumeLevel = (parseFloat(document.getElementById('volumeSelect')?.value) || 100) / 100;
    const gainNode = liveAudioCtx.createGain();
    gainNode.gain.value = volumeLevel;

    liveSourceNode.connect(gainNode);
    let lastNode = gainNode;

    // Build live FX chain
    if (!fxState.bypass) {
        if (eqState.enabled) {
            const filters = eqState.bands.map(([freq, gain, type]) => {
                const f = liveAudioCtx.createBiquadFilter();
                f.type = type;
                f.frequency.value = freq;
                f.Q.value = type === 'peaking' ? 1.2 : 0.7;
                f.gain.value = gain;
                return f;
            });
            lastNode.connect(filters[0]);
            for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
            lastNode = filters[filters.length - 1];
        }

        if (fxState.comp.enabled) {
            const comp = liveAudioCtx.createDynamicsCompressor();
            comp.threshold.value = fxState.comp.threshold;
            comp.ratio.value     = fxState.comp.ratio;
            comp.attack.value    = fxState.comp.attack;
            comp.release.value   = fxState.comp.release;
            lastNode.connect(comp);
            lastNode = comp;
        }

        if (fxState.dist.enabled) {
            const hp = liveAudioCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 80 + fxState.dist.tone * 1200;
            const dist = liveAudioCtx.createWaveShaper();
            dist.curve = makeDistortionCurve(fxState.dist.drive);
            dist.oversample = '4x';
            lastNode.connect(hp);
            hp.connect(dist);
            lastNode = dist;
        }

        if (fxState.chorus.enabled) {
            const chorusDry = liveAudioCtx.createGain(); chorusDry.gain.value = 0.7;
            const chorusWet = liveAudioCtx.createGain(); chorusWet.gain.value = 0.5;
            const delayNode = liveAudioCtx.createDelay(0.05);
            delayNode.delayTime.value = 0.020 + fxState.chorus.depth;
            const chorusLFO = liveAudioCtx.createOscillator();
            const chorusLFOGain = liveAudioCtx.createGain();
            chorusLFO.frequency.value = fxState.chorus.rate;
            chorusLFOGain.gain.value  = fxState.chorus.depth;
            chorusLFO.connect(chorusLFOGain);
            chorusLFOGain.connect(delayNode.delayTime);
            chorusLFO.start();
            lastNode.connect(chorusDry);
            lastNode.connect(delayNode);
            delayNode.connect(chorusWet);
            const merge = liveAudioCtx.createGain();
            chorusDry.connect(merge);
            chorusWet.connect(merge);
            lastNode = merge;
        }

        if (fxState.reverb.enabled) {
            const convolver = liveAudioCtx.createConvolver();
            convolver.buffer = buildImpulse(liveAudioCtx.sampleRate, fxState.reverb.decay, fxState.reverb.pre);
            const dryGain = liveAudioCtx.createGain(); dryGain.gain.value = 1;
            const wetGain = liveAudioCtx.createGain(); wetGain.gain.value = fxState.reverb.wet;
            lastNode.connect(dryGain);
            lastNode.connect(convolver);
            convolver.connect(wetGain);
            const merge2 = liveAudioCtx.createGain();
            dryGain.connect(merge2);
            wetGain.connect(merge2);
            lastNode = merge2;
        }

        if (fxState.delay.enabled) {
            const delNode = liveAudioCtx.createDelay(2.0);
            delNode.delayTime.value = Math.min(fxState.delay.time, 1.99);
            const fbGain  = liveAudioCtx.createGain(); fbGain.gain.value  = fxState.delay.feedback;
            const wetGain2 = liveAudioCtx.createGain(); wetGain2.gain.value = fxState.delay.wet;
            const dryGain2 = liveAudioCtx.createGain(); dryGain2.gain.value = 1;
            lastNode.connect(delNode);
            delNode.connect(fbGain);
            fbGain.connect(delNode);
            delNode.connect(wetGain2);
            lastNode.connect(dryGain2);
            const merge3 = liveAudioCtx.createGain();
            dryGain2.connect(merge3);
            wetGain2.connect(merge3);
            lastNode = merge3;
        }
    }

    lastNode.connect(liveAudioCtx.destination);

    // Start from pauseOffset (in audio time).
    // Record liveAudioCtx.currentTime as the wall-clock start.
    liveSourceNode.start(0, pauseOffset);
    playbackStartTime = liveAudioCtx.currentTime;

    isPlaying = true;
    const btn = document.getElementById('playPauseBtn');
    if (btn) { btn.innerText = '⏸ Pause'; btn.classList.add('playing'); }

    liveSourceNode.onended = () => { if (isPlaying) pausePreview(true); };
    animationFrameId = requestAnimationFrame(updateSeekUI);
}

function pausePreview(ended = false) {
    if (liveSourceNode) {
        liveSourceNode.onended = null;
        try { liveSourceNode.stop(); } catch (e) {}
        liveSourceNode = null;
    }

    // FIX: compute correct audio position before marking isPlaying = false
    if (!ended && liveAudioCtx) {
        const playbackRate = Math.pow(2, pitchSemitones / 12) * speedRate;
        // elapsed wall-clock time × playback rate = elapsed audio time
        const elapsed = (liveAudioCtx.currentTime - playbackStartTime) * playbackRate;
        pauseOffset = Math.min(originalDuration, pauseOffset + elapsed);
    }

    isPlaying = false;
    cancelAnimationFrame(animationFrameId);

    const btn = document.getElementById('playPauseBtn');
    if (btn) { btn.innerText = '▶ Play Preview'; btn.classList.remove('playing'); }

    if (ended) {
        pauseOffset = 0;
        const el = document.getElementById('currentTimeDisplay');
        if (el) el.textContent = '0:00';
        if (decodedAudioBuffer) drawWaveform(decodedAudioBuffer, 0);
    } else {
        if (decodedAudioBuffer) drawWaveform(decodedAudioBuffer, pauseOffset);
        const el = document.getElementById('currentTimeDisplay');
        if (el) el.textContent = formatTime(pauseOffset);
    }
}

function updateSeekUI() {
    if (!isPlaying || !liveAudioCtx) return;

    const playbackRate   = Math.pow(2, pitchSemitones / 12) * speedRate;
    // FIX: add pauseOffset as the starting position, then add elapsed time
    const elapsed        = (liveAudioCtx.currentTime - playbackStartTime) * playbackRate;
    const currentAudioTime = Math.min(originalDuration, pauseOffset + elapsed);

    const timeDisplay = document.getElementById('currentTimeDisplay');
    if (timeDisplay) timeDisplay.textContent = formatTime(currentAudioTime);

    if (decodedAudioBuffer) drawWaveform(decodedAudioBuffer, currentAudioTime);

    animationFrameId = requestAnimationFrame(updateSeekUI);
}

function formatTime(seconds) {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ============================================================
//  MAIN PROCESSING PIPELINE
// ============================================================
async function processAndConvert() {
    if (!currentFile || !decodedAudioBuffer) return;

    const format      = document.getElementById('formatSelect')?.value    || 'mp3';
    const bitrate     = parseInt(document.getElementById('bitrateSelect')?.value) || 320;
    const targetChan  = document.getElementById('channelSelect')?.value   || 'original';
    const startTime   = parseFloat(document.getElementById('startTime')?.value)  || 0;
    const normalize   = document.getElementById('normalizeCheck')?.checked || false;
    let   endTime     = parseFloat(document.getElementById('endTime')?.value)    || 0;
    const volumeLevel = (parseFloat(document.getElementById('volumeSelect')?.value) || 100) / 100;

    // Sync manual trim-tab overrides for pitch / speed
    const pitchInputEl = document.getElementById('pitchShift');
    const speedInputEl = document.getElementById('speedRate');
    if (pitchInputEl && pitchInputEl.value !== '') pitchSemitones = parseFloat(pitchInputEl.value) || 0;
    if (speedInputEl && speedInputEl.value !== '') speedRate      = parseFloat(speedInputEl.value) || 1.0;

    const convertBtn = document.getElementById('convertBtn');
    const dlLink     = document.getElementById('downloadLink');
    if (convertBtn) convertBtn.disabled = true;
    if (dlLink)     dlLink.style.display = 'none';

    try {
        updateStatus('Step 1 / 6 — Reading file…', 8);
        const arrayBuffer = await currentFile.arrayBuffer();

        updateStatus('Step 2 / 6 — Decoding audio…', 20);
        const audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuf = await audioCtx.decodeAudioData(arrayBuffer);

        if (!endTime || endTime <= startTime) endTime = decodedBuf.duration;
        if (endTime > decodedBuf.duration)    endTime = decodedBuf.duration;
        const duration = Math.max(0.01, endTime - startTime);

        const playbackRate    = Math.pow(2, pitchSemitones / 12) * speedRate;
        const renderedSamples = Math.ceil((duration / playbackRate) * decodedBuf.sampleRate);

        let channels = decodedBuf.numberOfChannels;
        if (targetChan !== 'original') channels = parseInt(targetChan);

        updateStatus('Step 3 / 6 — Applying trim, pitch & speed…', 38);

        const offlineCtx = new OfflineAudioContext(
            channels,
            renderedSamples,
            decodedBuf.sampleRate
        );

        const sourceNode = offlineCtx.createBufferSource();
        sourceNode.buffer             = decodedBuf;
        sourceNode.playbackRate.value = playbackRate;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.value = volumeLevel;

        sourceNode.connect(gainNode);
        let lastNode = gainNode;

        if (!fxState.bypass) {
            updateStatus('Step 4 / 6 — Building FX chain…', 52);

            if (eqState.enabled) {
                const filters = eqState.bands.map(([freq, gain, type]) => {
                    const f = offlineCtx.createBiquadFilter();
                    f.type = type;
                    f.frequency.value = freq;
                    f.Q.value   = type === 'peaking' ? 1.2 : 0.7;
                    f.gain.value = gain;
                    return f;
                });
                lastNode.connect(filters[0]);
                for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
                lastNode = filters[filters.length - 1];
            }

            if (fxState.comp.enabled) {
                const comp = offlineCtx.createDynamicsCompressor();
                comp.threshold.value = fxState.comp.threshold;
                comp.ratio.value     = fxState.comp.ratio;
                comp.attack.value    = fxState.comp.attack;
                comp.release.value   = fxState.comp.release;
                comp.knee.value      = 10;
                lastNode.connect(comp);
                lastNode = comp;
            }

            if (fxState.dist.enabled) {
                const hp = offlineCtx.createBiquadFilter();
                hp.type = 'highpass';
                hp.frequency.value = 80 + fxState.dist.tone * 1200;
                const dist = offlineCtx.createWaveShaper();
                dist.curve    = makeDistortionCurve(fxState.dist.drive);
                dist.oversample = '4x';
                lastNode.connect(hp);
                hp.connect(dist);
                lastNode = dist;
            }

            if (fxState.chorus.enabled) {
                const chorusDry = offlineCtx.createGain(); chorusDry.gain.value = 0.7;
                const chorusWet = offlineCtx.createGain(); chorusWet.gain.value = 0.5;
                const delayNode = offlineCtx.createDelay(0.05);
                delayNode.delayTime.value = 0.020 + fxState.chorus.depth;
                lastNode.connect(chorusDry);
                lastNode.connect(delayNode);
                delayNode.connect(chorusWet);
                const merge = offlineCtx.createGain();
                chorusDry.connect(merge);
                chorusWet.connect(merge);
                lastNode = merge;
            }

            if (fxState.reverb.enabled) {
                const convolver = offlineCtx.createConvolver();
                convolver.buffer = buildImpulse(offlineCtx.sampleRate, fxState.reverb.decay, fxState.reverb.pre);
                const dryGain = offlineCtx.createGain(); dryGain.gain.value = 1;
                const wetGain = offlineCtx.createGain(); wetGain.gain.value = fxState.reverb.wet;
                lastNode.connect(dryGain);
                lastNode.connect(convolver);
                convolver.connect(wetGain);
                const merge2 = offlineCtx.createGain();
                dryGain.connect(merge2);
                wetGain.connect(merge2);
                lastNode = merge2;
            }

            if (fxState.delay.enabled) {
                const delNode  = offlineCtx.createDelay(2.0);
                delNode.delayTime.value = Math.min(fxState.delay.time, 1.99);
                const fbGain   = offlineCtx.createGain(); fbGain.gain.value   = fxState.delay.feedback;
                const wetGain2 = offlineCtx.createGain(); wetGain2.gain.value = fxState.delay.wet;
                const dryGain2 = offlineCtx.createGain(); dryGain2.gain.value = 1;
                lastNode.connect(delNode);
                delNode.connect(fbGain);
                fbGain.connect(delNode);
                delNode.connect(wetGain2);
                lastNode.connect(dryGain2);
                const merge3 = offlineCtx.createGain();
                dryGain2.connect(merge3);
                wetGain2.connect(merge3);
                lastNode = merge3;
            }
        }

        lastNode.connect(offlineCtx.destination);
        sourceNode.start(0, startTime, duration);

        updateStatus('Step 5 / 6 — Rendering…', 68);
        let renderedBuffer = await offlineCtx.startRendering();

        // Normalize if requested
        if (normalize) {
            updateStatus('Step 5.5 / 6 — Normalizing…', 75);
            renderedBuffer = normalizeBuffer(renderedBuffer);
        }

        let resultBlob;
        if (format === 'mp3') {
            updateStatus(`Step 6 / 6 — Encoding MP3 (${bitrate} kbps)…`, 78);
            resultBlob = await encodeMp3(renderedBuffer, bitrate);
        } else {
            updateStatus('Step 6 / 6 — Encoding WAV…', 88);
            resultBlob = audioBufferToWav(renderedBuffer);
        }

        updateStatus('✓ Done! File ready to download.', 100);

        const baseName = currentFile.name.replace(/\.[^/.]+$/, '') || 'audio';
        if (dlLink) {
            // Revoke any previous object URL to avoid memory leaks
            if (dlLink._prevUrl) URL.revokeObjectURL(dlLink._prevUrl);
            const url = URL.createObjectURL(resultBlob);
            dlLink._prevUrl     = url;
            dlLink.href         = url;
            dlLink.download     = `${baseName}_processed.${format}`;
            dlLink.style.display = 'block';
        }

        await audioCtx.close();

    } catch (err) {
        updateStatus('Error: ' + err.message, 0);
        console.error(err);
    } finally {
        if (convertBtn) convertBtn.disabled = false;
    }
}

// ============================================================
//  NORMALIZE BUFFER
// ============================================================
function normalizeBuffer(buffer) {
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
        }
    }
    if (peak < 0.001 || peak >= 1.0) return buffer; // nothing to do
    const scale = 0.99 / peak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) data[i] *= scale;
    }
    return buffer;
}

// ============================================================
//  MP3 ENCODER (lamejs)
// ============================================================
function encodeMp3(audioBuffer, bitrate) {
    return new Promise((resolve, reject) => {
        if (typeof lamejs === 'undefined') {
            reject(new Error('lamejs not loaded. Ensure the CDN script tag is present.'));
            return;
        }
        const channels   = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const encoder    = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
        const mp3Data    = [];
        const blockSize  = 1152;
        const left       = audioBuffer.getChannelData(0);
        const right      = channels > 1 ? audioBuffer.getChannelData(1) : left;

        const floatToInt16 = (arr) => {
            const out = new Int16Array(arr.length);
            for (let i = 0; i < arr.length; i++) {
                const s = Math.max(-1, Math.min(1, arr[i]));
                out[i]  = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            return out;
        };

        const iLeft  = floatToInt16(left);
        const iRight = channels > 1 ? floatToInt16(right) : iLeft;

        for (let i = 0; i < iLeft.length; i += blockSize) {
            const lChunk = iLeft.subarray(i, i + blockSize);
            const rChunk = iRight.subarray(i, i + blockSize);
            const buf    = channels === 2
                ? encoder.encodeBuffer(lChunk, rChunk)
                : encoder.encodeBuffer(lChunk);
            if (buf.length > 0) mp3Data.push(buf);

            if (i % (blockSize * 80) === 0) {
                const pct = (i / iLeft.length) * 22;
                const pb  = document.getElementById('progressBar');
                if (pb) pb.value = 78 + pct;
            }
        }
        const fin = encoder.flush();
        if (fin.length > 0) mp3Data.push(fin);
        resolve(new Blob(mp3Data, { type: 'audio/mp3' }));
    });
}

// ============================================================
//  WAV ENCODER
// ============================================================
function audioBufferToWav(buffer) {
    const numCh  = buffer.numberOfChannels;
    const length = buffer.length * numCh * 2 + 44;
    const arr    = new ArrayBuffer(length);
    const view   = new DataView(arr);
    const ch     = [];
    let pos = 0;
    const w16 = (d) => { view.setUint16(pos, d, true); pos += 2; };
    const w32 = (d) => { view.setUint32(pos, d, true); pos += 4; };

    w32(0x46464952); w32(length - 8); w32(0x45564157);
    w32(0x20746d66); w32(16); w16(1); w16(numCh);
    w32(buffer.sampleRate); w32(buffer.sampleRate * 2 * numCh);
    w16(numCh * 2); w16(16);
    w32(0x61746164); w32(length - pos - 4);

    for (let i = 0; i < numCh; i++) ch.push(buffer.getChannelData(i));
    let offset = 0;
    while (pos < length) {
        for (let i = 0; i < numCh; i++) {
            let s = Math.max(-1, Math.min(1, ch[i][offset]));
            s     = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
            view.setInt16(pos, s, true);
            pos  += 2;
        }
        offset++;
    }
    return new Blob([arr], { type: 'audio/wav' });
}
