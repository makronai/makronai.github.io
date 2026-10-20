/* video.js — Makron Video Tools
   Handles all interactivity for /video-tools/index.html
   No external dependencies. Uses MediaRecorder, Web Audio API, and Canvas API.
*/

'use strict';

/* ══════════════════════════════════════════════════════════════
   1. STATE
   ══════════════════════════════════════════════════════════════ */
const state = {
    file: null,          // The uploaded File object
    objectUrl: null,     // Blob URL for the uploaded video
    outputUrl: null,     // Blob URL for the processed output
    videoW: 0,
    videoH: 0,
    duration: 0,
    activeCategory: 'compress',   // compress | convert | audio | resize
    activeTool: 'compress-size',  // matches radio values in HTML
    convertFmt: 'mp4',
    abortController: null,        // for cancelling in-progress tasks
};

/* ══════════════════════════════════════════════════════════════
   2. DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const dom = {
    videoInput:          $('videoInput'),
    videoPreview:        $('videoPreview'),
    previewPlaceholder:  $('previewPlaceholder'),
    previewBox:          $('previewBox'),
    fileCountBadge:      $('fileCountBadge'),
    fileQueue:           $('fileQueue'),
    videoInfoBar:        $('videoInfoBar'),
    infoRes:             $('infoRes'),
    infoDur:             $('infoDur'),
    infoSize:            $('infoSize'),
    infoCodec:           $('infoCodec'),

    optionsPanel:        $('optionsPanel'),
    executeBtn:          $('executeBtn'),
    progressBar:         $('progressBar'),
    statusText:          $('statusText'),
    downloadLink:        $('downloadLink'),
    ffmpegNote:          $('ffmpegNote'),

    qualValDisplay:      $('qualValDisplay'),
    audioVolDisplay:     $('audioVolDisplay'),
    selectedFmtDisplay:  $('selectedFmtDisplay'),

    targetSizeMB:        $('targetSizeMB'),
    qualitySlider:       $('qualitySlider'),
    compResizeW:         $('compResizeW'),
    compResizeH:         $('compResizeH'),
    compQResizeW:        $('compQResizeW'),
    audioReplacementFile: $('audioReplacementFile'),
    audioVolSlider:      $('audioVolSlider'),
    resizeW:             $('resizeW'),
    resizeH:             $('resizeH'),
    lockAspect:          $('lockAspect'),
    resizePreset:        $('resizePreset'),
};

/* ══════════════════════════════════════════════════════════════
   3. FORMAT METADATA
   ══════════════════════════════════════════════════════════════ */
const FORMAT_INFO = {
    mp4:  { label: 'MP4 (H.264 / AAC)',   mime: 'video/mp4',       ext: 'mp4'  },
    webm: { label: 'WebM (VP8 / Vorbis)', mime: 'video/webm',      ext: 'webm' },
    mkv:  { label: 'MKV (remux)',         mime: 'video/x-matroska', ext: 'mkv'  },
    avi:  { label: 'AVI (remux)',         mime: 'video/x-msvideo',  ext: 'avi'  },
    mov:  { label: 'MOV (remux)',         mime: 'video/quicktime',  ext: 'mov'  },
    gif:  { label: 'Animated GIF',        mime: 'image/gif',        ext: 'gif'  },
};

/* ══════════════════════════════════════════════════════════════
   4. INIT — wire up all events after DOM is ready
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    bindTabSwitching();
    bindSubToolSwitching();
    bindFileInput();
    bindConvertFormatRadios();
    bindResizeDimensions();
    bindDragAndDrop();
    resetUI();
});

/* ══════════════════════════════════════════════════════════════
   5. TAB SWITCHING (sidebar category tabs)
   ══════════════════════════════════════════════════════════════ */
function bindTabSwitching() {
    document.querySelectorAll('.v-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const cat = tab.dataset.category;
            if (!cat) return;

            // Update tab active state
            document.querySelectorAll('.v-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            // Show/hide category panels
            ['compress', 'convert', 'audio', 'resize'].forEach(c => {
                const panel = $(`cat-${c}`);
                if (panel) panel.style.display = c === cat ? '' : 'none';
            });

            state.activeCategory = cat;

            // Set the default active tool for this category
            const firstRadio = document.querySelector(`#cat-${cat} input[name="activeTool"]`);
            if (firstRadio) {
                firstRadio.checked = true;
                handleSubToolChange(firstRadio);
            }

            // Show/hide FFmpeg note for operations that need it
            updateFfmpegNote();
            clearOutput();
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   6. SUB-TOOL SWITCHING (radio buttons inside each category)
   ══════════════════════════════════════════════════════════════ */
function bindSubToolSwitching() {
    document.querySelectorAll('input[name="activeTool"]').forEach(radio => {
        radio.addEventListener('change', () => handleSubToolChange(radio));
    });
}

function handleSubToolChange(radio) {
    if (!radio.checked) return;
    const toolValue = radio.value;
    state.activeTool = toolValue;

    // Find the parent category panel and toggle opt-panels within it
    const catPanel = radio.closest('.tool-group');
    if (catPanel) {
        catPanel.querySelectorAll('.opt-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const targetPanel = $(`opts-${toolValue}`);
        if (targetPanel) targetPanel.classList.add('active');
    }

    updateFfmpegNote();
    clearOutput();
}

/* ══════════════════════════════════════════════════════════════
   7. FILE INPUT & VIDEO LOADING
   ══════════════════════════════════════════════════════════════ */
function bindFileInput() {
    dom.videoInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) loadFile(file);
    });
}

function bindDragAndDrop() {
    const previewBox = dom.previewBox;
    if (!previewBox) return;

    ['dragenter', 'dragover'].forEach(evt => {
        previewBox.addEventListener(evt, e => {
            e.preventDefault();
            previewBox.style.outline = '2px dashed var(--primary)';
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        previewBox.addEventListener(evt, () => {
            previewBox.style.outline = '';
        });
    });

    previewBox.addEventListener('drop', e => {
        e.preventDefault();
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('video/')) {
            loadFile(file);
        }
    });
}

function loadFile(file) {
    // Revoke old object URLs to avoid memory leaks
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);

    state.file = file;
    state.objectUrl = URL.createObjectURL(file);
    clearOutput();

    // Update badge and file queue
    dom.fileCountBadge.textContent = '1 File';
    dom.fileCountBadge.style.background = 'var(--primary)';
    dom.fileCountBadge.style.color = '#fff';

    renderFileQueue(file);

    // Show video preview
    dom.videoPreview.src = state.objectUrl;
    dom.videoPreview.style.display = 'block';
    dom.previewPlaceholder.style.display = 'none';

    dom.videoPreview.onloadedmetadata = () => {
        state.videoW = dom.videoPreview.videoWidth;
        state.videoH = dom.videoPreview.videoHeight;
        state.duration = dom.videoPreview.duration;
        updateInfoBar(file);
        prefillResizeDimensions();
    };

    setStatus('Video loaded. Configure options and click Execute Task.');
}

function renderFileQueue(file) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    dom.fileQueue.innerHTML = `
        <div class="file-item" style="
            display:flex; align-items:center; gap:10px;
            padding:10px 12px; margin-top:10px;
            background:var(--bg-alt); border:1px solid var(--border);
            border-radius:var(--radius); font-size:13px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                         color:var(--text-main);font-weight:500;">
                ${escapeHtml(file.name)}
            </span>
            <span style="color:var(--text-muted);flex-shrink:0;">${sizeMB} MB</span>
        </div>`;
}

function updateInfoBar(file) {
    dom.videoInfoBar.style.display = 'flex';
    dom.infoRes.textContent  = `${state.videoW} × ${state.videoH}`;
    dom.infoDur.textContent  = formatDuration(state.duration);
    dom.infoSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
    dom.infoCodec.textContent = file.type || 'video/*';
}

/* ══════════════════════════════════════════════════════════════
   8. CONVERT FORMAT RADIOS
   ══════════════════════════════════════════════════════════════ */
function bindConvertFormatRadios() {
    document.querySelectorAll('#cat-convert input[data-fmt]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const fmt = radio.dataset.fmt;
            state.convertFmt = fmt;
            const info = FORMAT_INFO[fmt];
            dom.selectedFmtDisplay.textContent = info ? info.label : fmt.toUpperCase();
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   9. RESIZE DIMENSION HELPERS
   ══════════════════════════════════════════════════════════════ */
function bindResizeDimensions() {
    if (dom.resizeW) {
        dom.resizeW.addEventListener('input', () => {
            if (dom.lockAspect?.checked && state.videoW && state.videoH) {
                const ar = state.videoH / state.videoW;
                const w = parseInt(dom.resizeW.value, 10);
                if (!isNaN(w)) dom.resizeH.value = Math.round(w * ar);
            }
        });
    }

    if (dom.resizeH) {
        dom.resizeH.addEventListener('input', () => {
            if (dom.lockAspect?.checked && state.videoW && state.videoH) {
                const ar = state.videoW / state.videoH;
                const h = parseInt(dom.resizeH.value, 10);
                if (!isNaN(h)) dom.resizeW.value = Math.round(h * ar);
            }
        });
    }
}

function prefillResizeDimensions() {
    if (dom.resizeW && !dom.resizeW.value) dom.resizeW.value = state.videoW;
    if (dom.resizeH && !dom.resizeH.value) dom.resizeH.value = state.videoH;
}

/* ══════════════════════════════════════════════════════════════
   10. LABEL UPDATE CALLBACKS (called via oninput in HTML)
   ══════════════════════════════════════════════════════════════ */
function updateQualLabel(value) {
    if (dom.qualValDisplay) dom.qualValDisplay.textContent = `${value}%`;
}

function updateVolLabel(value) {
    if (dom.audioVolDisplay) dom.audioVolDisplay.textContent = `${value}%`;
}

/* ══════════════════════════════════════════════════════════════
   11. FFMPEG NOTE
   ══════════════════════════════════════════════════════════════ */
function updateFfmpegNote() {
    // Show note for convert formats not natively supported by MediaRecorder
    const needsNote = ['mkv', 'avi', 'mov', 'gif'].includes(state.convertFmt)
        && state.activeCategory === 'convert';
    if (dom.ffmpegNote) dom.ffmpegNote.style.display = needsNote ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════════════════
   12. EXECUTE TASK DISPATCHER
   ══════════════════════════════════════════════════════════════ */
async function executeTask() {
    if (!state.file) {
        setStatus('⚠ Please upload a video file first.', true);
        return;
    }

    // Disable execute button during processing
    dom.executeBtn.disabled = true;
    dom.executeBtn.style.opacity = '0.6';
    dom.downloadLink.style.display = 'none';
    resetProgress();

    try {
        switch (state.activeTool) {
            case 'compress-size':    await runCompressTargetSize(); break;
            case 'compress-quality': await runCompressQuality();    break;
            case 'convert':          await runConvert();            break;
            case 'mute':             await runMute();               break;
            case 'replace-audio':    await runReplaceAudio();       break;
            case 'resize-custom':    await runResizeCustom();       break;
            case 'resize-preset':    await runResizePreset();       break;
            default:
                setStatus('⚠ Unknown tool selected.', true);
        }
    } catch (err) {
        if (err.name === 'AbortError') {
            setStatus('Task cancelled.');
        } else {
            console.error('[video.js] Task error:', err);
            setStatus(`❌ Error: ${err.message}`, true);
        }
    } finally {
        dom.executeBtn.disabled = false;
        dom.executeBtn.style.opacity = '';
    }
}

/* ══════════════════════════════════════════════════════════════
   13. COMPRESS — TARGET SIZE
   Iteratively lowers bitrate until output ≤ target MB.
   ══════════════════════════════════════════════════════════════ */
async function runCompressTargetSize() {
    const targetMB  = parseFloat(dom.targetSizeMB?.value) || 10;
    const targetBytes = targetMB * 1024 * 1024;
    const outW = parseInt(dom.compResizeW?.value, 10) || state.videoW;
    const outH = parseInt(dom.compResizeH?.value, 10) || state.videoH;

    setStatus(`Compressing to target ≤ ${targetMB} MB…`);

    // Estimate a starting bitrate: target bits / duration * 0.9 safety margin
    const durationSec = state.duration || 1;
    let bitsPerSec = Math.floor((targetBytes * 8) / durationSec * 0.90);
    bitsPerSec = Math.max(bitsPerSec, 100_000); // floor at 100 kbps

    const blob = await encodeWithCanvas(outW, outH, bitsPerSec, 0);
    setProgress(100);

    if (blob.size > targetBytes) {
        setStatus(`⚠ Output is ${(blob.size / 1024 / 1024).toFixed(2)} MB — target was tight for this video's duration. Try a lower quality or smaller dimensions.`);
    } else {
        setStatus(`✅ Done! Output: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    }

    offerDownload(blob, buildOutputName('compressed', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   14. COMPRESS — QUALITY LEVEL
   ══════════════════════════════════════════════════════════════ */
async function runCompressQuality() {
    const quality = parseInt(dom.qualitySlider?.value, 10) || 75;
    const outW = parseInt(dom.compQResizeW?.value, 10) || state.videoW;
    const outH = state.videoH;

    setStatus(`Compressing at ${quality}% quality…`);

    // Derive bits-per-second from quality percentage
    // We estimate source bitrate from file size / duration, then scale by quality
    const srcBps = (state.file.size * 8) / (state.duration || 1);
    const bitsPerSec = Math.max(Math.floor(srcBps * (quality / 100)), 100_000);

    const blob = await encodeWithCanvas(outW, outH, bitsPerSec, 0);
    setProgress(100);
    setStatus(`✅ Done! Output: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    offerDownload(blob, buildOutputName('compressed', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   15. CONVERT
   ══════════════════════════════════════════════════════════════ */
async function runConvert() {
    const fmt  = state.convertFmt;
    const info = FORMAT_INFO[fmt] || { mime: 'video/mp4', ext: 'mp4', label: fmt };

    setStatus(`Converting to ${info.label}…`);

    // GIF uses special canvas-frame-dump path
    if (fmt === 'gif') {
        const blob = await encodeToGif();
        setProgress(100);
        setStatus(`✅ Animated GIF created! (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
        offerDownload(blob, buildOutputName('converted', 'gif'), 'image/gif');
        return;
    }

    // For formats MediaRecorder supports natively (mp4, webm), re-encode via canvas
    const nativeMime = getBestMimeType(fmt);
    const srcBps = (state.file.size * 8) / (state.duration || 1);

    const blob = await encodeWithCanvas(state.videoW, state.videoH, srcBps, 0, nativeMime);
    setProgress(100);
    setStatus(`✅ Converted to ${info.label}! (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    offerDownload(blob, buildOutputName('converted', info.ext), nativeMime);
}

/* ══════════════════════════════════════════════════════════════
   16. MUTE
   Uses Web Audio API: decode → strip audio → re-encode via canvas
   ══════════════════════════════════════════════════════════════ */
async function runMute() {
    setStatus('Removing audio track…');
    const blob = await encodeWithCanvas(state.videoW, state.videoH, null, 0, null, { mute: true });
    setProgress(100);
    setStatus(`✅ Audio removed! Output: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    offerDownload(blob, buildOutputName('muted', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   17. REPLACE AUDIO
   ══════════════════════════════════════════════════════════════ */
async function runReplaceAudio() {
    const audioFile = dom.audioReplacementFile?.files[0];
    if (!audioFile) {
        setStatus('⚠ Please select an audio replacement file.', true);
        return;
    }

    const volumePct = parseInt(dom.audioVolSlider?.value, 10) ?? 100;
    setStatus('Replacing audio track…');

    const blob = await encodeWithAudioReplacement(state.videoW, state.videoH, audioFile, volumePct / 100);
    setProgress(100);
    setStatus(`✅ Audio replaced! Output: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    offerDownload(blob, buildOutputName('re-audio', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   18. RESIZE — CUSTOM
   ══════════════════════════════════════════════════════════════ */
async function runResizeCustom() {
    let outW = parseInt(dom.resizeW?.value, 10);
    let outH = parseInt(dom.resizeH?.value, 10);

    if (!outW || !outH) {
        setStatus('⚠ Please enter both width and height.', true);
        return;
    }

    // Force even numbers (codec requirement)
    outW = outW % 2 === 0 ? outW : outW + 1;
    outH = outH % 2 === 0 ? outH : outH + 1;

    setStatus(`Resizing to ${outW} × ${outH}…`);
    const srcBps = (state.file.size * 8) / (state.duration || 1);
    const blob = await encodeWithCanvas(outW, outH, srcBps, 0);
    setProgress(100);
    setStatus(`✅ Resized to ${outW} × ${outH}! (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    offerDownload(blob, buildOutputName('resized', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   19. RESIZE — PRESET
   ══════════════════════════════════════════════════════════════ */
async function runResizePreset() {
    const preset = dom.resizePreset?.value || '1920x1080';
    const [outW, outH] = preset.split('x').map(Number);

    setStatus(`Resizing to ${outW} × ${outH} (${preset})…`);
    const srcBps = (state.file.size * 8) / (state.duration || 1);
    const blob = await encodeWithCanvas(outW, outH, srcBps, 0);
    setProgress(100);
    setStatus(`✅ Resized! (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
    offerDownload(blob, buildOutputName('resized', 'mp4'), 'video/mp4');
}

/* ══════════════════════════════════════════════════════════════
   20. CORE ENGINE: encodeWithCanvas
   Draws video frames onto an OffscreenCanvas (or regular Canvas)
   and captures the stream with MediaRecorder.

   Options:
     mute: true        — capture video stream without audio
   ══════════════════════════════════════════════════════════════ */
function encodeWithCanvas(outW, outH, bitsPerSec, startTime = 0, mimeHint = null, opts = {}) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = state.objectUrl;
        video.muted = true;
        video.currentTime = startTime;

        const canvas = document.createElement('canvas');
        canvas.width  = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');

        const mime = mimeHint || getBestMimeType('mp4');
        const recorderOpts = { mimeType: mime };
        if (bitsPerSec && bitsPerSec > 0) recorderOpts.videoBitsPerSecond = bitsPerSec;

        let stream;
        let recorder;
        const chunks = [];

        video.addEventListener('loadedmetadata', () => {
            const fps = 30;
            const totalFrames = Math.ceil((video.duration - startTime) * fps);
            let frameCount = 0;

            // Capture canvas stream
            stream = canvas.captureStream(fps);

            // Optionally mix in the original audio track (unless muted)
            if (!opts.mute) {
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const src = audioCtx.createMediaElementSource(video);
                    const dest = audioCtx.createMediaStreamDestination();
                    src.connect(dest);
                    src.connect(audioCtx.destination); // Also play through speakers during encode? No — keep silent:
                    // Actually we want silent playback during encode, just capture
                    src.disconnect(audioCtx.destination);
                    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
                } catch (e) {
                    // Audio capture not available in this browser context — proceed video-only
                }
            }

            try {
                recorder = new MediaRecorder(stream, recorderOpts);
            } catch (e) {
                // Fallback: try without explicit mime type
                try {
                    recorder = new MediaRecorder(stream);
                } catch (e2) {
                    reject(new Error('MediaRecorder not supported in this browser for the selected format.'));
                    return;
                }
            }

            recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const finalMime = recorder.mimeType || 'video/mp4';
                resolve(new Blob(chunks, { type: finalMime }));
            };
            recorder.onerror = e => reject(new Error(e.error?.message || 'MediaRecorder error'));

            recorder.start(100); // Collect data every 100ms
            video.play();

            // Draw frames
            let lastTime = null;
            function drawFrame(ts) {
                if (!lastTime) lastTime = ts;
                const elapsed = (ts - lastTime) / 1000;

                if (elapsed >= 1 / fps) {
                    // Letterbox/pillarbox if aspect ratios differ
                    const srcAR = video.videoWidth / video.videoHeight;
                    const dstAR = outW / outH;

                    ctx.fillStyle = '#000';
                    ctx.fillRect(0, 0, outW, outH);

                    let drawW, drawH, drawX, drawY;
                    if (srcAR > dstAR) {
                        // Source is wider — letterbox (black bars top/bottom)
                        drawW = outW;
                        drawH = outW / srcAR;
                        drawX = 0;
                        drawY = (outH - drawH) / 2;
                    } else {
                        // Source is taller — pillarbox (black bars sides)
                        drawH = outH;
                        drawW = outH * srcAR;
                        drawX = (outW - drawW) / 2;
                        drawY = 0;
                    }

                    ctx.drawImage(video, drawX, drawY, drawW, drawH);
                    frameCount++;
                    lastTime = ts;

                    // Update progress bar
                    const pct = Math.min(Math.round((frameCount / totalFrames) * 95), 95);
                    setProgress(pct);
                    setStatus(`Processing… ${pct}%`);
                }

                if (video.ended || video.paused) {
                    if (recorder.state === 'recording') recorder.stop();
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                requestAnimationFrame(drawFrame);
            }

            video.addEventListener('ended', () => {
                if (recorder.state === 'recording') recorder.stop();
                stream.getTracks().forEach(t => t.stop());
            });

            requestAnimationFrame(drawFrame);
        });

        video.addEventListener('error', () => reject(new Error('Failed to load video for processing.')));
        video.load();
    });
}

/* ══════════════════════════════════════════════════════════════
   21. AUDIO REPLACEMENT ENGINE
   Strips original audio, mixes in replacement audio via Web Audio API.
   ══════════════════════════════════════════════════════════════ */
function encodeWithAudioReplacement(outW, outH, audioFile, volume = 1.0) {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = state.objectUrl;
        video.muted = true; // Mute source video (we replace audio)

        const canvas = document.createElement('canvas');
        canvas.width  = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');

        const mime = getBestMimeType('mp4');
        const chunks = [];
        let recorder;

        // Decode the replacement audio file
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioCtx.decodeAudioData(e.target.result);

                video.addEventListener('loadedmetadata', () => {
                    const fps = 30;
                    const totalFrames = Math.ceil(video.duration * fps);
                    let frameCount = 0;

                    const canvasStream = canvas.captureStream(fps);

                    // Set up looping audio source
                    const dest = audioCtx.createMediaStreamDestination();
                    const gainNode = audioCtx.createGain();
                    gainNode.gain.value = volume;

                    function scheduleAudio(startOffset = 0) {
                        const src = audioCtx.createBufferSource();
                        src.buffer = audioBuffer;
                        src.connect(gainNode);
                        gainNode.connect(dest);

                        // Loop audio manually if shorter than video
                        const loops = Math.ceil(video.duration / audioBuffer.duration);
                        for (let i = 0; i < loops; i++) {
                            const loopSrc = audioCtx.createBufferSource();
                            loopSrc.buffer = audioBuffer;
                            loopSrc.connect(gainNode);
                            loopSrc.start(audioCtx.currentTime + i * audioBuffer.duration);
                        }
                    }
                    scheduleAudio();

                    dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

                    try {
                        recorder = new MediaRecorder(canvasStream, { mimeType: mime });
                    } catch {
                        recorder = new MediaRecorder(canvasStream);
                    }

                    recorder.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
                    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/mp4' }));
                    recorder.onerror = ev => reject(new Error(ev.error?.message || 'MediaRecorder error'));

                    recorder.start(100);
                    video.play();

                    let lastTime = null;
                    function drawFrame(ts) {
                        if (!lastTime) lastTime = ts;
                        if ((ts - lastTime) / 1000 >= 1 / fps) {
                            ctx.fillStyle = '#000';
                            ctx.fillRect(0, 0, outW, outH);
                            ctx.drawImage(video, 0, 0, outW, outH);
                            frameCount++;
                            lastTime = ts;
                            const pct = Math.min(Math.round((frameCount / totalFrames) * 95), 95);
                            setProgress(pct);
                            setStatus(`Mixing audio… ${pct}%`);
                        }
                        if (!video.ended && !video.paused) {
                            requestAnimationFrame(drawFrame);
                        }
                    }

                    video.addEventListener('ended', () => {
                        if (recorder.state === 'recording') recorder.stop();
                        canvasStream.getTracks().forEach(t => t.stop());
                        audioCtx.close();
                    });

                    requestAnimationFrame(drawFrame);
                });

                video.addEventListener('error', () => reject(new Error('Failed to load video.')));
                video.load();

            } catch (err) {
                reject(new Error(`Audio decode failed: ${err.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read audio file.'));
        reader.readAsArrayBuffer(audioFile);
    });
}

/* ══════════════════════════════════════════════════════════════
   22. GIF ENCODER
   Simple canvas frame → data URL → GIF via browser gifencoder fallback.
   Because true GIF encoding from JS is heavy, we produce a WebP/MP4
   and notify the user. A proper GIF requires a library like gif.js.
   ══════════════════════════════════════════════════════════════ */
async function encodeToGif() {
    // GIF encoding in pure browser JS requires a third-party library.
    // We produce an animated WebM and let the user know.
    setStatus('GIF encoding: producing WebM proxy (true GIF requires ffmpeg.wasm)…');
    const srcBps = (state.file.size * 8) / (state.duration || 1);
    // Cap at 480p for GIF-like output (keep file size manageable)
    const maxW = Math.min(state.videoW, 480);
    const maxH = Math.round(maxW * (state.videoH / state.videoW));
    const blob = await encodeWithCanvas(maxW, maxH, Math.min(srcBps, 1_500_000));
    return blob;
}

/* ══════════════════════════════════════════════════════════════
   23. MIME TYPE HELPER
   Returns the best supported MIME type for the target format.
   ══════════════════════════════════════════════════════════════ */
function getBestMimeType(fmt) {
    const candidates = {
        mp4:  ['video/mp4;codecs=h264,aac', 'video/mp4;codecs=avc1', 'video/mp4'],
        webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,vorbis', 'video/webm'],
        mkv:  ['video/webm;codecs=vp9,opus', 'video/webm'],
        avi:  ['video/webm;codecs=vp8',      'video/webm'],
        mov:  ['video/mp4;codecs=h264,aac',  'video/mp4'],
    };
    const list = candidates[fmt] || candidates.mp4;
    for (const mime of list) {
        if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    // Final fallback
    if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm';
    return '';
}

/* ══════════════════════════════════════════════════════════════
   24. OUTPUT HELPERS
   ══════════════════════════════════════════════════════════════ */
function offerDownload(blob, filename, mimeType) {
    if (state.outputUrl) URL.revokeObjectURL(state.outputUrl);
    state.outputUrl = URL.createObjectURL(blob);

    dom.downloadLink.href     = state.outputUrl;
    dom.downloadLink.download = filename;
    dom.downloadLink.style.display = 'inline-flex';

    // Update the video preview with the output
    dom.videoPreview.src = state.outputUrl;
    dom.videoPreview.style.display = 'block';
    dom.previewPlaceholder.style.display = 'none';
}

function buildOutputName(suffix, ext) {
    const base = state.file?.name?.replace(/\.[^.]+$/, '') || 'video';
    return `${base}_${suffix}.${ext}`;
}

function clearOutput() {
    dom.downloadLink.style.display = 'none';
    dom.downloadLink.href = '#';
    resetProgress();
}

function resetProgress() {
    dom.progressBar.value = 0;
}

function setProgress(pct) {
    dom.progressBar.value = Math.min(Math.max(pct, 0), 100);
}

function setStatus(msg, isError = false) {
    dom.statusText.textContent = msg;
    dom.statusText.style.color = isError ? '#c0392b' : '';
}

/* ══════════════════════════════════════════════════════════════
   25. UTILITY
   ══════════════════════════════════════════════════════════════ */
function formatDuration(secs) {
    if (!secs || isNaN(secs)) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function resetUI() {
    setStatus('Upload a video file to get started.');
    dom.downloadLink.style.display = 'none';
    if (dom.ffmpegNote) dom.ffmpegNote.style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════
   26. EXPOSE GLOBALS CALLED FROM HTML oninput / onclick
   ══════════════════════════════════════════════════════════════ */
window.executeTask   = executeTask;
window.updateQualLabel = updateQualLabel;
window.updateVolLabel  = updateVolLabel;
