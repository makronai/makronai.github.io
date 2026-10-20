// image.js - Tool Logic
const state = {
    file: null,
    imageObj: new Image(),
    origWidth: 0,
    origHeight: 0,
    aspectRatio: 1,
    transform: { rotate: 0, flipH: 1, flipV: 1 },
    filters: {
        opacity: { val: 1, min: 0, max: 1, step: 0.05, unit: '' },
        brightness: { val: 100, min: 0, max: 300, step: 1, unit: '%' },
        contrast: { val: 100, min: 0, max: 300, step: 1, unit: '%' },
        saturate: { val: 100, min: 0, max: 300, step: 1, unit: '%' },
        grayscale: { val: 0, min: 0, max: 100, step: 1, unit: '%' },
        sepia: { val: 0, min: 0, max: 100, step: 1, unit: '%' },
        invert: { val: 0, min: 0, max: 100, step: 1, unit: '%' },
        'hue-rotate': { val: 0, min: 0, max: 360, step: 1, unit: 'deg' },
        blur: { val: 0, min: 0, max: 50, step: 0.5, unit: 'px' }
    }
};

// DOM Elements
const els = {
    file: document.getElementById('fileInput'),
    preview: document.getElementById('previewImage'),
    placeholder: document.getElementById('previewPlaceholder'),
    w: document.getElementById('imgWidth'),
    h: document.getElementById('imgHeight'),
    keepAspect: document.getElementById('keepAspect'),
    filterBox: document.getElementById('filterControls'),
    btnProcess: document.getElementById('processBtn'),
    linkDownload: document.getElementById('downloadLink'),
    status: document.getElementById('statusText'),
    progress: document.getElementById('progressBar'),
    format: document.getElementById('formatSelect'),
    qualityGroup: document.getElementById('qualityGroup'),
    quality: document.getElementById('exportQuality')
};

// 1. Initialize Filter UI
function initFilters() {
    els.filterBox.innerHTML = '';
    for (const [key, data] of Object.entries(state.filters)) {
        const row = document.createElement('div');
        row.className = 'filter-row';
        row.innerHTML = `
            <div class="filter-header">
                <span>${key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' ')}</span>
                <span style="color:var(--text-muted); font-size:11px;">${data.unit}</span>
            </div>
            <div class="filter-controls">
                <input type="range" id="range_${key}" min="${data.min}" max="${data.max}" step="${data.step}" value="${data.val}">
                <input type="number" id="num_${key}" class="filter-number" value="${data.val}" step="${data.step}">
            </div>
        `;
        els.filterBox.appendChild(row);

        const range = document.getElementById(`range_${key}`);
        const num = document.getElementById(`num_${key}`);

        // Two-way binding allowing numbers to exceed range limits
        range.addEventListener('input', (e) => {
            num.value = e.target.value;
            applyFilters();
        });
        num.addEventListener('input', (e) => {
            range.value = Math.min(Math.max(e.target.value, data.min), data.max);
            applyFilters();
        });
    }
}
initFilters();

// 2. UI Interactions
function switchTab(tabId, btnElem) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btnElem.classList.add('active');
}

function handleFormatChange() {
    const isLossy = ['image/jpeg', 'image/webp'].includes(els.format.value);
    els.qualityGroup.style.display = isLossy ? 'flex' : 'none';
    invalidateResult();
}

function invalidateResult() {
    els.linkDownload.style.display = 'none';
    if (state.file) {
        els.status.innerText = 'Pending changes...';
        els.status.style.color = 'var(--text-main)';
        els.btnProcess.disabled = false;
        els.btnProcess.innerText = 'Process Image';
    }
    els.progress.value = 0;
}

// 3. Image Loading
els.file.addEventListener('change', function(e) {
    if (!this.files || this.files.length === 0) return;
    state.file = this.files[0];
    const reader = new FileReader();
    
    reader.onload = function(event) {
        state.imageObj.onload = function() {
            els.preview.src = state.imageObj.src;
            els.preview.style.display = 'block';
            els.placeholder.style.display = 'none';
            
            state.origWidth = state.imageObj.width;
            state.origHeight = state.imageObj.height;
            state.aspectRatio = state.origWidth / state.origHeight;
            
            els.w.value = state.origWidth;
            els.h.value = state.origHeight;
            
            resetTransform();
            resetFilters();
            
            els.status.innerText = 'Image loaded successfully.';
            els.btnProcess.disabled = false;
            invalidateResult();
        };
        state.imageObj.src = event.target.result;
    };
    reader.readAsDataURL(state.file);
});

// 4. Geometry handling
function handleResize(changed) {
    if (!els.keepAspect.checked) return;
    let w = parseFloat(els.w.value);
    let h = parseFloat(els.h.value);
    
    // Use the *current* aspect ratio based on rotation
    const isRotated = state.transform.rotate % 180 !== 0;
    const currentRatio = isRotated ? (1 / state.aspectRatio) : state.aspectRatio;

    if (changed === 'width' && w > 0) els.h.value = Math.round(w / currentRatio);
    else if (changed === 'height' && h > 0) els.w.value = Math.round(h * currentRatio);
    invalidateResult();
}

function applyTransform(type, val) {
    if(type === 'rotate') state.transform.rotate = (state.transform.rotate + val) % 360;
    if(type === 'flipH') state.transform.flipH *= -1;
    if(type === 'flipV') state.transform.flipV *= -1;
    
    // Swap width/height inputs if rotated 90/270
    if (type === 'rotate' && Math.abs(val) === 90) {
        const temp = els.w.value;
        els.w.value = els.h.value;
        els.h.value = temp;
    }

    updatePreviewTransforms();
}

function resetTransform() {
    state.transform = { rotate: 0, flipH: 1, flipV: 1 };
    els.w.value = state.origWidth;
    els.h.value = state.origHeight;
    updatePreviewTransforms();
}

function updatePreviewTransforms() {
    const t = state.transform;
    els.preview.style.transform = `rotate(${t.rotate}deg) scale(${t.flipH}, ${t.flipV})`;
    invalidateResult();
}

// 5. Filters Handling
function applyFilters() {
    let filterString = '';
    for (const [key, data] of Object.entries(state.filters)) {
        const val = document.getElementById(`num_${key}`).value;
        if (key === 'opacity') {
            els.preview.style.opacity = val;
        } else {
            filterString += `${key}(${val}${data.unit}) `;
        }
    }
    els.preview.style.filter = filterString.trim();
    invalidateResult();
}

function resetFilters() {
    for (const [key, data] of Object.entries(state.filters)) {
        document.getElementById(`range_${key}`).value = data.val;
        document.getElementById(`num_${key}`).value = data.val;
    }
    applyFilters();
}

// 6. Processing Engine (Canvas)
function processAndDownload() {
    if (!state.file) return;

    els.status.innerText = 'Processing...';
    els.progress.value = 20;
    els.btnProcess.disabled = true;
    els.btnProcess.innerText = 'Processing...';

    setTimeout(() => {
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        let targetW = parseInt(els.w.value) || state.origWidth;
        let targetH = parseInt(els.h.value) || state.origHeight;
        
        canvas.width = targetW;
        canvas.height = targetH;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply visual filters
        ctx.globalAlpha = parseFloat(document.getElementById('num_opacity').value);
        ctx.filter = els.preview.style.filter;

        // Apply Transforms
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(state.transform.rotate * Math.PI / 180);
        ctx.scale(state.transform.flipH, state.transform.flipV);

        // Calculate drawing dimensions. If rotated 90/270, swap W and H for the draw call relative to canvas
        const isRotated = Math.abs(state.transform.rotate) % 180 === 90;
        const drawW = isRotated ? targetH : targetW;
        const drawH = isRotated ? targetW : targetH;

        ctx.drawImage(state.imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        els.progress.value = 80;

        // Export
        const format = els.format.value;
        const quality = format !== 'image/png' ? (els.quality.value / 100) : undefined;
        const originalName = state.file.name.substring(0, state.file.name.lastIndexOf('.')) || 'image';
        
        canvas.toBlob(function(blob) {
            els.progress.value = 100;
            els.status.innerText = 'Process Complete!';
            els.status.style.color = 'var(--primary)';
            els.btnProcess.innerText = 'Process Complete';
            
            const url = URL.createObjectURL(blob);
            const ext = format.split('/')[1].replace('jpeg', 'jpg');
            
            els.linkDownload.href = url;
            els.linkDownload.download = `${originalName}_edited.${ext}`;
            els.linkDownload.style.display = 'block';
            els.linkDownload.innerText = `⬇️ Download ${ext.toUpperCase()} (${(blob.size / 1024).toFixed(1)} KB)`;
            
        }, format, quality);
    }, 100);
}