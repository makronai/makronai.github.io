const state = {
    scrolling: false,
    recording: false,
    paused: false,
    startTime: 0,
    scrollPos: 0,
    mediaRecorder: null,
    chunks: [],
    stream: null,
    audioCtx: new (window.AudioContext || window.webkitAudioContext)()
};

const els = {
    video: document.getElementById('cameraPreview'),
    overlay: document.getElementById('scriptOverlay'),
    content: document.getElementById('scrollContent'),
    input: document.getElementById('scriptInput'),
    speed: document.getElementById('scrollSpeed'),
    font: document.getElementById('fontSize'),
    timer: document.getElementById('timerDisplay'),
    recInd: document.getElementById('recordingIndicator'),
    camSelect: document.getElementById('cameraSelect')
};

// 1. Audio Beep System
function playBeep(count = 1) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => {
            const osc = state.audioCtx.createOscillator();
            const gain = state.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, state.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, state.audioCtx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(state.audioCtx.destination);
            osc.start();
            osc.stop(state.audioCtx.currentTime + 0.5);
        }, i * 300);
    }
}

// 2. Camera Access
async function initCamera() {
    try {
        state.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        els.video.srcObject = state.stream;
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        els.camSelect.innerHTML = videoDevices.map(d => 
            `<option value="${d.deviceId}">${d.label || 'Camera ' + d.deviceId.slice(0,5)}</option>`
        ).join('');
    } catch (err) {
        alert("Camera access denied. Please allow permissions to use the teleprompter.");
    }
}

// 3. Scrolling Logic
function toggleScroll() {
    state.scrolling = !state.scrolling;
    document.getElementById('btnStartScroll').innerText = state.scrolling ? "Stop Teleprompter" : "Start Teleprompter";
    if (state.scrolling) {
        state.scrollPos = els.overlay.offsetHeight / 2;
        requestAnimationFrame(scrollLoop);
    }
}

function scrollLoop() {
    if (!state.scrolling) return;
    
    const speed = parseFloat(els.speed.value) / 10;
    state.scrollPos += speed;
    els.content.style.transform = `translateY(-${state.scrollPos}px)`;
    
    // Reset if finished
    if (state.scrollPos > els.content.offsetHeight + els.overlay.offsetHeight) {
        state.scrollPos = 0;
    }
    requestAnimationFrame(scrollLoop);
}

// 4. Recording Logic
function toggleRecording() {
    if (!state.recording) {
        state.chunks = [];
        state.mediaRecorder = new MediaRecorder(state.stream);
        state.mediaRecorder.ondataavailable = e => state.chunks.push(e.data);
        state.mediaRecorder.onstop = () => {
            const blob = new Blob(state.chunks, { type: 'video/webm' });
            state.videoUrl = URL.createObjectURL(blob);
            document.getElementById('btnDownloadVideo').style.display = 'block';
        };
        
        state.mediaRecorder.start();
        state.recording = true;
        state.startTime = Date.now();
        els.recInd.classList.add('active');
        document.getElementById('btnRecord').innerText = "Stop Recording";
        document.getElementById('btnPause').disabled = false;
        startTimer();
    } else {
        state.mediaRecorder.stop();
        state.recording = false;
        els.recInd.classList.remove('active');
        document.getElementById('btnRecord').innerText = "Start Recording";
    }
}

function startTimer() {
    const targetMin = parseInt(document.getElementById('targetTime').value);
    let warned = false;
    let finished = false;

    const interval = setInterval(() => {
        if (!state.recording) {
            clearInterval(interval);
            return;
        }
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        const remaining = (targetMin * 60) - elapsed;

        const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const s = (elapsed % 60).toString().padStart(2, '0');
        els.timer.innerText = `${m}:${s}`;

        // Alarms
        if (remaining === 60 && !warned && document.getElementById('beepWarning').checked) {
            playBeep(1);
            warned = true;
        }
        if (remaining <= 0 && !finished && document.getElementById('beepFinal').checked) {
            playBeep(2);
            finished = true;
        }
    }, 1000);
}

// 5. Script & UI Utils
els.input.addEventListener('input', () => {
    els.content.innerText = els.input.value || "Your script here...";
});

els.font.addEventListener('input', () => {
    els.content.style.fontSize = `${els.font.value}px`;
});

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

// Handle Mirroring & Flipping
document.getElementById('mirrorCamera').addEventListener('change', (e) => {
    els.video.style.transform = e.target.checked ? 'scaleX(-1)' : 'scaleX(1)';
});

document.getElementById('flipScript').addEventListener('change', (e) => {
    els.content.style.transform = e.target.checked ? 'scale(-1, -1)' : 'translateY(-' + state.scrollPos + 'px)';
});

// Handle Camera Switching
els.camSelect.addEventListener('change', async () => {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
    }
    const constraints = {
        video: { deviceId: { exact: els.camSelect.value } },
        audio: true
    };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    els.video.srcObject = state.stream;
});

// Handle Script Import
document.getElementById('importScript').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        els.input.value = e.target.result;
        els.content.innerText = e.target.result;
    };
    reader.readAsText(file);
});

// Export Script as .txt
function exportScript() {
    const blob = new Blob([els.input.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'script.txt';
    a.click();
}

// Download the Recorded Video
function downloadVideo() {
    const a = document.createElement('a');
    a.href = state.videoUrl;
    a.download = 'teleprompter-recording.webm';
    a.click();
}

// Pause/Resume Recording
function togglePause() {
    if (!state.recording) return;
    
    if (!state.paused) {
        state.mediaRecorder.pause();
        state.paused = true;
        document.getElementById('btnPause').innerText = "Resume";
    } else {
        state.mediaRecorder.resume();
        state.paused = false;
        document.getElementById('btnPause').innerText = "Pause";
    }
}

// Initialize
initCamera();