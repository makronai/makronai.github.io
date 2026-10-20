const { PDFDocument, rgb, degrees } = PDFLib;

// Core DOM Elements
const fileInput = document.getElementById('pdfInput');
const fileQueue = document.getElementById('fileQueue');
const fileCountBadge = document.getElementById('fileCountBadge');
const previewBox = document.getElementById('previewBox');
const previewCanvas = document.getElementById('pdfPreviewCanvas');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const dot = document.getElementById('watermarkDot');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const downloadLink = document.getElementById('downloadLink');

// State Variables
let currentPdfBytes = null; 
let pdfViewportInfo = { scaleX: 1, scaleY: 1, pdfW: 0, pdfH: 0 };
let wmCoords = { x: 50, y: 50 };

// --- UI Interaction Logic ---

document.querySelectorAll('.v-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.v-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.tool-group').forEach(tg => tg.style.display = 'none');
        document.getElementById(`cat-${tab.dataset.category}`).style.display = 'block';
        
        // Select first tool in category automatically
        const firstTool = document.querySelector(`#cat-${tab.dataset.category} input[type="radio"]`);
        if (firstTool) {
            firstTool.checked = true;
            updateToolOptions();
        }
    });
});

document.querySelectorAll('input[name="activeTool"]').forEach(radio => {
    radio.addEventListener('change', updateToolOptions);
});

function updateRangeLabel(val) {
    document.getElementById('compValDisplay').innerText = Math.round(val * 100) + '%';
}

function updateToolOptions() {
    const tool = document.querySelector('input[name="activeTool"]:checked').value;
    document.querySelectorAll('.opt-panel').forEach(el => el.classList.remove('active'));
    
    const targetPanel = document.getElementById(`opts-${tool}`);
    if(targetPanel) {
        targetPanel.classList.add('active');
    } else {
        document.getElementById('opts-default').classList.add('active');
    }
    
    // Watermark specific logic
    if (tool === 'watermark') {
        previewBox.style.cursor = 'crosshair';
    } else {
        previewBox.style.cursor = 'default';
        dot.style.display = 'none';
    }
    invalidateResult();
}

function setStatus(msg, color='var(--primary)', prog=null) {
    statusText.innerText = msg;
    statusText.style.color = color;
    if(prog !== null) progressBar.value = prog;
}

function invalidateResult() {
    downloadLink.style.display = 'none';
    if(statusText.innerText.includes('Success')) {
        setStatus('Configuration updated. Please Execute Task again.', 'var(--text-muted)', 0);
    } else {
        progressBar.value = 0;
    }
}

// --- File Handling & Preview ---

fileInput.addEventListener('change', async function(e) {
    if (!this.files.length) return;
    invalidateResult();
    dot.style.display = 'none';
    fileQueue.innerHTML = '';
    
    fileCountBadge.innerText = `${this.files.length} File(s)`;
    
    Array.from(this.files).forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg> ${file.name}`;
        fileQueue.appendChild(item);
    });

    const file = this.files[0];
    if (file.type === 'application/pdf') {
        setStatus('Loading document preview...', 'var(--text-muted)', 10);
        try {
            const arrayBuffer = await file.arrayBuffer();
            currentPdfBytes = new Uint8Array(arrayBuffer); 
            await renderPdfPreview(currentPdfBytes.slice());
            await populateMetadataFields(currentPdfBytes.slice());
        } catch(err) {
            setStatus(`Preview Error: ${err.message}`, '#e53e3e', 0);
            currentPdfBytes = null;
        }
    } else if (file.type.startsWith('image/')) {
        setStatus('Images loaded for conversion.', 'var(--primary)', 100);
        previewCanvas.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        previewPlaceholder.innerHTML = `<p><b>${this.files.length} Image(s) selected</b></p>`;
        currentPdfBytes = null;
    } else {
        setStatus('Unsupported file format.', '#e53e3e', 0);
        currentPdfBytes = null;
    }
});

async function renderPdfPreview(pdfData) {
    try {
        const loadingTask = pdfjsLib.getDocument({data: pdfData});
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({scale: 1.5});
        previewCanvas.width = viewport.width;
        previewCanvas.height = viewport.height;
        
        const ctx = previewCanvas.getContext('2d');
        await page.render({canvasContext: ctx, viewport: viewport}).promise;
        
        previewCanvas.style.display = 'block';
        previewPlaceholder.style.display = 'none';
        
        pdfViewportInfo.pdfW = viewport.width / 1.5; 
        pdfViewportInfo.pdfH = viewport.height / 1.5;
        
        setStatus('File ready.', 'var(--primary)', 100);
    } catch(e) {
        setStatus(`Render error: ${e.message}`, '#e53e3e', 0);
        previewCanvas.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        previewPlaceholder.innerText = "Cannot render preview (File may be encrypted)";
    }
}

async function populateMetadataFields(pdfData) {
    try {
        const pdfDoc = await PDFDocument.load(pdfData);
        document.getElementById('metaTitle').value = pdfDoc.getTitle() || '';
        document.getElementById('metaAuthor').value = pdfDoc.getAuthor() || '';
        document.getElementById('metaSubject').value = pdfDoc.getSubject() || '';
    } catch(e) {
        console.warn("Could not read metadata");
    }
}

previewBox.addEventListener('click', (e) => {
    const activeTool = document.querySelector('input[name="activeTool"]:checked').value;
    if(activeTool !== 'watermark' || previewCanvas.style.display === 'none') return;
    
    const rect = previewCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    if(clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) return;

    const canvasScaleX = previewCanvas.width / rect.width;
    const canvasScaleY = previewCanvas.height / rect.height;
    const cvsX = clickX * canvasScaleX;
    const cvsY = clickY * canvasScaleY;

    const pdfX = cvsX / 1.5;
    const pdfY = pdfViewportInfo.pdfH - (cvsY / 1.5); 
    
    wmCoords = { x: pdfX, y: pdfY };
    document.getElementById('lblX').innerText = Math.round(pdfX);
    document.getElementById('lblY').innerText = Math.round(pdfY);
    
    dot.style.left = `${clickX}px`;
    dot.style.top = `${clickY}px`;
    dot.style.display = 'block';
    invalidateResult();
});

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'flex';
    setStatus('Success! File ready.', '#0b875b', 100);
}

// --- Tool Execution Logic ---

function parsePageRanges(str, maxPages) {
    if(!str.trim()) return Array.from({length: maxPages}, (_, i) => i);
    const indices = [];
    str.split(',').forEach(part => {
        const range = part.split('-').map(n => parseInt(n.trim()));
        if(range.length === 1 && !isNaN(range[0])) indices.push(range[0] - 1);
        else if(range.length === 2 && !isNaN(range[0]) && !isNaN(range[1])) {
            const start = range[0] - 1, end = range[1] - 1;
            const step = start <= end ? 1 : -1;
            for(let i = start; step > 0 ? i <= end : i >= end; i += step) indices.push(i);
        }
    });
    return indices.filter(i => i >= 0 && i < maxPages);
}

async function processPDF() {
    if (!fileInput.files.length) return setStatus('Error: No files uploaded', '#e53e3e');
    setStatus('Initializing...', 'var(--text-muted)', 5);
    downloadLink.style.display = "none";
    
    try {
        const tool = document.querySelector('input[name="activeTool"]:checked').value;
        if(tool === 'img2pdf') await handleImg2Pdf();
        else if(tool === 'pdf2img') await handlePdf2Img();
        else if(tool === 'rearrange') await handleRearrange();
        else if(tool === 'merge') await handleMerge();
        else if(tool === 'rotate') await handleRotate();
        else if(tool === 'watermark') await handleWatermark();
        else if(tool === 'metadata') await handleMetadata();
        else if(tool === 'compress') await handleCompress();
    } catch(e) {
        console.error(e);
        setStatus(`Error: ${e.message}`, '#e53e3e', 0);
    }
}

// Implementations for execution tasks...
async function handleImg2Pdf() {
    const imageFiles = Array.from(fileInput.files).filter(f => f.type.startsWith('image/'));
    if(imageFiles.length === 0) throw new Error("No image files selected.");
    setStatus('Converting Images to PDF...', 'var(--primary)', 20);
    const pdfDoc = await PDFDocument.create();
    for (let i = 0; i < imageFiles.length; i++) {
        const f = imageFiles[i];
        const bytes = await f.arrayBuffer();
        let img;
        try { img = f.type === 'image/jpeg' ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes); } 
        catch(err) { throw new Error(`Failed to embed ${f.name}.`); }
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        progressBar.value = 20 + ((i/imageFiles.length)*60);
    }
    const pdfBytes = await pdfDoc.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_images.pdf');
}

async function handlePdf2Img() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    if(typeof JSZip === 'undefined') throw new Error('JSZip library missing.');
    setStatus('Extracting pages...', 'var(--primary)', 20);
    const zip = new JSZip();
    const pdf = await pdfjsLib.getDocument({data: currentPdfBytes.slice()}).promise;
    
    for(let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale: 2.0}); 
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        zip.file(`page_${i}.jpg`, base64, {base64: true});
        progressBar.value = 20 + ((i/pdf.numPages)*60);
    }
    const content = await zip.generateAsync({type:"blob"});
    triggerDownload(content, 'pdf_extracted.zip');
}

async function handleMerge() {
    const pdfFiles = Array.from(fileInput.files).filter(f => f.type === 'application/pdf');
    if(pdfFiles.length < 2) throw new Error("Please upload at least 2 PDF files to merge.");
    const outPdf = await PDFDocument.create();
    setStatus('Merging PDFs...', 'var(--primary)', 30);
    for(let i=0; i<pdfFiles.length; i++) {
        const bytes = await pdfFiles[i].arrayBuffer();
        const srcDoc = await PDFDocument.load(bytes);
        const copiedPages = await outPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(p => outPdf.addPage(p));
        progressBar.value = 30 + ((i/pdfFiles.length)*50);
    }
    const pdfBytes = await outPdf.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_merged.pdf');
}

async function handleRearrange() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    setStatus('Processing Pages...', 'var(--primary)', 30);
    const outPdf = await PDFDocument.create();
    const srcDoc = await PDFDocument.load(currentPdfBytes.slice());
    const orderStr = document.getElementById('pageRange').value;
    const indices = parsePageRanges(orderStr, srcDoc.getPageCount());
    if(indices.length === 0) throw new Error("Invalid page range.");
    const copiedPages = await outPdf.copyPages(srcDoc, indices);
    copiedPages.forEach(p => outPdf.addPage(p));
    progressBar.value = 80;
    const pdfBytes = await outPdf.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_split.pdf');
}

async function handleRotate() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    setStatus('Rotating Pages...', 'var(--primary)', 40);
    const srcDoc = await PDFDocument.load(currentPdfBytes.slice());
    const angle = parseInt(document.getElementById('rotAngle').value);
    
    srcDoc.getPages().forEach(page => {
        const currentRot = page.getRotation().angle;
        page.setRotation(degrees(currentRot + angle));
    });
    
    progressBar.value = 80;
    const pdfBytes = await srcDoc.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_rotated.pdf');
}

async function handleMetadata() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    setStatus('Updating Metadata...', 'var(--primary)', 50);
    const srcDoc = await PDFDocument.load(currentPdfBytes.slice());
    
    const title = document.getElementById('metaTitle').value;
    const author = document.getElementById('metaAuthor').value;
    const subject = document.getElementById('metaSubject').value;
    
    if(title) srcDoc.setTitle(title);
    if(author) srcDoc.setAuthor(author);
    if(subject) srcDoc.setSubject(subject);
    
    progressBar.value = 90;
    const pdfBytes = await srcDoc.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_meta.pdf');
}

async function handleWatermark() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    const text = document.getElementById('wmText').value;
    const imgFile = document.getElementById('wmImage').files[0];
    const size = parseInt(document.getElementById('wmSize').value) || 48;
    
    if(!text && !imgFile) throw new Error("Provide watermark text or image.");
    setStatus('Applying Watermark...', 'var(--primary)', 30);
    const pdfDoc = await PDFDocument.load(currentPdfBytes.slice());
    
    let wmImage = null;
    if(imgFile) {
        if(!['image/jpeg', 'image/png'].includes(imgFile.type)) throw new Error("Image must be JPG/PNG.");
        const imgBytes = await imgFile.arrayBuffer();
        wmImage = imgFile.type === 'image/jpeg' ? await pdfDoc.embedJpg(imgBytes) : await pdfDoc.embedPng(imgBytes);
    }

    const pages = pdfDoc.getPages();
    for(let i=0; i<pages.length; i++) {
        const page = pages[i];
        if(wmImage) {
            const scaled = wmImage.scaleToFit(9999, size);
            page.drawImage(wmImage, { x: wmCoords.x, y: wmCoords.y, width: scaled.width, height: scaled.height, opacity: 0.8 });
        } else if(text) {
            page.drawText(text, { x: wmCoords.x, y: wmCoords.y, size: size, color: rgb(0,0,0), opacity: 0.3 });
        }
        progressBar.value = 30 + ((i/pages.length)*50);
    }
    const pdfBytes = await pdfDoc.save();
    triggerDownload(new Blob([pdfBytes], {type: 'application/pdf'}), 'pdf_watermarked.pdf');
}

async function handleCompress() {
    if(!currentPdfBytes) throw new Error('Please load a valid PDF first.');
    setStatus('Compressing (Rasterizing)...', 'var(--primary)', 10);
    const quality = parseFloat(document.getElementById('compQuality').value);
    const pdf = await pdfjsLib.getDocument({data: currentPdfBytes.slice()}).promise;
    const newDoc = await PDFDocument.create();
    
    for(let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = quality < 0.5 ? 1.0 : (quality < 0.8 ? 1.5 : 2.0); 
        const viewport = page.getViewport({scale: scale});
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width; canvas.height = viewport.height;
        await page.render({canvasContext: canvas.getContext('2d'), viewport: viewport}).promise;
        
        const imgData = canvas.toDataURL('image/jpeg', quality);
        const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
        
        const embed = await newDoc.embedJpg(imgBytes);
        const newPage = newDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(embed, { x: 0, y: 0, width: viewport.width, height: viewport.height });
        progressBar.value = 10 + ((i/pdf.numPages)*70);
    }
    const outBytes = await newDoc.save({ useObjectStreams: true });
    triggerDownload(new Blob([outBytes], {type: 'application/pdf'}), 'pdf_compressed.pdf');
}

// Initialization
updateToolOptions();