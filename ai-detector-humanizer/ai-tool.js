/**
 * ai-tool.js
 * Streamlined AI Text Detector, Auto-Humanizer, and Multi-Format File Parser
 * Pure Client-Side (Zero External Dependencies)
 */

"use strict";

const App = (() => {

  /* -------------------------------------------------------------
   * 1. MULTI-FORMAT DOCUMENT PARSERS (TXT, MD, PDF, DOCX, DOC)
   * ------------------------------------------------------------- */
  const FileParser = {
    async parse(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const buffer = await file.arrayBuffer();

      switch (ext) {
        case 'txt':
        case 'md':
        case 'text':
          return new TextDecoder('utf-8').decode(buffer);

        case 'docx':
          return await this.parseDocx(buffer);

        case 'pdf':
          return await this.parsePdf(buffer);

        case 'doc':
          return this.parseDoc(buffer);

        default:
          return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
      }
    },

    /**
     * Parses standard Office Open XML (.docx) ZIP archives
     */
    async parseDocx(buffer) {
      const bytes = new Uint8Array(buffer);
      let offset = 0;
      let xmlContent = '';

      // Scan ZIP local file headers
      while (offset < bytes.length - 30) {
        if (bytes[offset] === 0x50 && bytes[offset + 1] === 0x4b && bytes[offset + 2] === 0x03 && bytes[offset + 3] === 0x04) {
          const compMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
          const compSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
          const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
          const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
          
          const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
          const filename = new TextDecoder().decode(nameBytes);
          const dataStart = offset + 30 + nameLen + extraLen;
          const dataEnd = dataStart + compSize;

          if (filename === 'word/document.xml') {
            const raw = bytes.subarray(dataStart, dataEnd);
            if (compMethod === 0) {
              xmlContent = new TextDecoder().decode(raw);
            } else if (compMethod === 8 && typeof DecompressionStream !== 'undefined') {
              try {
                const ds = new DecompressionStream('deflate-raw');
                const writer = ds.writable.getWriter();
                writer.write(raw);
                writer.close();
                const decomp = await new Response(ds.readable).arrayBuffer();
                xmlContent = new TextDecoder().decode(decomp);
              } catch (e) {
                // Fallback for wrapped zlib deflate
                const ds = new DecompressionStream('deflate');
                const writer = ds.writable.getWriter();
                writer.write(raw);
                writer.close();
                const decomp = await new Response(ds.readable).arrayBuffer();
                xmlContent = new TextDecoder().decode(decomp);
              }
            }
            break;
          }
          offset = (compSize > 0) ? (dataStart + compSize) : (offset + 1);
        } else {
          offset++;
        }
      }

      if (!xmlContent) {
        // Fallback string extraction for uncompressed or non-standard zip streams
        const fullString = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const matches = fullString.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (matches) {
          return matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
        }
        throw new Error('Could not parse text from DOCX file.');
      }

      const xmlDoc = new DOMParser().parseFromString(xmlContent, 'application/xml');
      const paragraphs = xmlDoc.getElementsByTagName('w:p');
      const lines = [];
      for (let p of paragraphs) {
        const textRuns = p.getElementsByTagName('w:t');
        let line = '';
        for (let t of textRuns) line += t.textContent;
        if (line.trim()) lines.push(line);
      }
      return lines.join('\n\n') || xmlDoc.documentElement.textContent;
    },

    /**
     * Extracts text tokens from PDF streams
     */
    async parsePdf(buffer) {
      const bytes = new Uint8Array(buffer);
      const latin = new TextDecoder('latin1').decode(bytes);
      const textParts = [];

      // 1. Direct Text Stream Extraction (BT ... ET)
      const streamMatches = latin.match(/BT[\s\S]*?ET/g) || [];
      for (const block of streamMatches) {
        const tjMatches = block.match(/\((.*?)\)\s*Tj/g);
        if (tjMatches) {
          tjMatches.forEach(m => textParts.push(m.replace(/\s*Tj$/, '').slice(1, -1).replace(/\\([()\\])/g, '$1')));
        }
        const arrayMatches = block.match(/\[(.*?)\]\s*TJ/g);
        if (arrayMatches) {
          arrayMatches.forEach(arr => {
            const inner = arr.match(/\((.*?)\)/g);
            if (inner) {
              textParts.push(inner.map(s => s.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''));
            }
          });
        }
      }

      if (textParts.length > 0) return textParts.join(' ');

      // 2. Decompress Deflate Streams if necessary
      if (typeof DecompressionStream !== 'undefined') {
        const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
        let match;
        while ((match = streamRegex.exec(latin)) !== null) {
          const start = match.index + match[0].indexOf('\n') + 1;
          const end = match.index + match[0].lastIndexOf('endstream');
          if (start < end) {
            try {
              const streamBytes = bytes.subarray(start, end);
              const ds = new DecompressionStream('deflate');
              const writer = ds.writable.getWriter();
              writer.write(streamBytes);
              writer.close();
              const dec = await new Response(ds.readable).arrayBuffer();
              const decStr = new TextDecoder('latin1').decode(dec);
              const subMatches = decStr.match(/\((.*?)\)\s*Tj/g);
              if (subMatches) {
                subMatches.forEach(sm => textParts.push(sm.replace(/\s*Tj$/, '').slice(1, -1).replace(/\\([()\\])/g, '$1')));
              }
            } catch (e) {}
          }
        }
      }

      if (textParts.length > 0) return textParts.join(' ');

      // 3. Fallback: Extract printable ASCII tokens
      const words = latin.match(/[A-Za-z0-9,.'";:?!]{3,}/g) || [];
      const clean = words.filter(w => !/obj|endobj|stream|xref/i.test(w));
      if (clean.length > 20) return clean.join(' ');

      throw new Error('Unable to extract plain text from this PDF.');
    },

    /**
     * Legacy Word Binary (.doc) text scanner
     */
    parseDoc(buffer) {
      const bytes = new Uint8Array(buffer);
      let out = '';
      let i = 0;
      // Extract UTF-16LE characters
      while (i < bytes.length - 1) {
        if (bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 0) {
          let run = '';
          while (i < bytes.length - 1 && bytes[i] >= 32 && bytes[i] <= 126 && bytes[i + 1] === 0) {
            run += String.fromCharCode(bytes[i]);
            i += 2;
          }
          if (run.length > 3) out += run + ' ';
        } else {
          i++;
        }
      }
      if (out.trim().length > 40) return out.trim();
      throw new Error('Unable to parse legacy binary .DOC format.');
    }
  };

  /* -------------------------------------------------------------
   * 2. STATISTICAL AI PATTERN DETECTOR ENGINE
   * ------------------------------------------------------------- */
  const Detector = {
    CONNECTORS: new Set(['furthermore','moreover','additionally','consequently','nevertheless','therefore','thus','hence']),
    CLICHES: new Set(['delve','tapestry','testament','beacon','foster','nuance','landscape','orchestrate','underscore','intricate','seamless','harness','multifaceted','pivotal','paramount','utilize','leverage','robust','comprehensive']),

    score(text) {
      if (!text || text.trim().length < 20) return 0;

      const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
      const sents = text.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0);

      const N = words.length || 1;
      const S = sents.length || 1;

      // 1. Cliché and Buzzword Frequency
      let clicheCount = 0;
      for (const w of words) {
        if (this.CLICHES.has(w.toLowerCase())) clicheCount++;
      }
      const fCliche = Math.min((clicheCount / N) * 22, 1);

      // 2. Formal Transition Overuse
      let connectorCount = 0;
      for (const s of sents) {
        const firstWord = (s.trim().split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z]/g, '');
        if (this.CONNECTORS.has(firstWord)) connectorCount++;
      }
      const fConnector = Math.min((connectorCount / S) * 2.2, 1);

      // 3. Sentence Length Uniformity (Low burstiness = AI pattern)
      const sentLengths = sents.map(s => (s.match(/\S+/g) || []).length);
      const mean = sentLengths.reduce((a, b) => a + b, 0) / S;
      const variance = sentLengths.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / S;
      const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      const fUniformity = Math.max(0, 1 - (cv * 1.6)); // Higher when sentences are identical length

      // 4. Robotic Preamble Count
      const preambles = (text.match(/\b(it is important to note that|it is worth mentioning that|it should be noted that)\b/gi) || []).length;
      const fPreambles = Math.min(preambles * 0.25, 1);

      // Weighted combination
      const raw = (fCliche * 0.35) + (fConnector * 0.25) + (fUniformity * 0.25) + (fPreambles * 0.15);
      const score = Math.round(Math.min(raw * 115, 98));

      return Math.max(score, 6); // Realistic floor
    }
  };

  /* -------------------------------------------------------------
   * 3. AUTO-HUMANIZER (BEHIND-THE-SCENES REWRITING)
   * ------------------------------------------------------------- */
  const Humanizer = {
    REPLACEMENTS: [
      // Preambles
      [/\b(it is important to note that|it is worth mentioning that|it should be noted that|it is evident that)\s*/gi, ''],
      // Clichés & Buzzwords
      [/\bdelve into\b/gi, 'examine'],
      [/\bdelve\b/gi, 'dig'],
      [/\ba tapestry of\b/gi, 'a complex mix of'],
      [/\ba testament to\b/gi, 'evidence of'],
      [/\bmultifaceted\b/gi, 'complex'],
      [/\borchestrating\b/gi, 'managing'],
      [/\bnuances\b/gi, 'details'],
      [/\blandscape\b/gi, 'field'],
      [/\bpivotal\b/gi, 'key'],
      [/\bfoster\b/gi, 'build'],
      [/\butilize\b/gi, 'use'],
      [/\butilization\b/gi, 'use'],
      [/\bfacilitate\b/gi, 'help'],
      [/\bdemonstrated\b/gi, 'shown'],
      [/\bleverage\b/gi, 'use'],
      [/\bcomprehensive\b/gi, 'full'],
      [/\brobust\b/gi, 'strong'],
      [/\bparamount\b/gi, 'vital'],
      [/\bmitigate\b/gi, 'reduce'],
      // Formal Connectors
      [/\bfurthermore,\s*/gi, 'Also, '],
      [/\bmoreover,\s*/gi, 'Plus, '],
      [/\bconsequently,\s*/gi, 'So, '],
      [/\bnevertheless,\s*/gi, 'Still, '],
      [/\btherefore,\s*/gi, 'So, ']
    ],

    process(text) {
      if (!text) return '';
      let result = text;

      // Apply vocabulary simplification
      for (const [regex, replacement] of this.REPLACEMENTS) {
        result = result.replace(regex, (match) => {
          if (!replacement) return '';
          if (match[0] === match[0].toUpperCase()) {
            return replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }
          return replacement;
        });
      }

      // Cleanup double spaces and punctuation anomalies
      result = result
        .replace(/[ ]{2,}/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\. \./g, '.');

      // Restructure robotic cadence: Break long sentences joined by repetitive conjunctions
      let splitCount = 0;
      result = result.replace(/\b and also \b/gi, '. Plus, ');
      result = result.replace(/\b, which in turn \b/gi, '. This ');

      return result.trim();
    }
  };

  /* -------------------------------------------------------------
   * 4. DIFF ENGINE & HTML ESCAPING
   * ------------------------------------------------------------- */
  const Diff = {
    escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    compute(oldStr, newStr) {
      const a = oldStr.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+/gu) || [];
      const b = newStr.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+/gu) || [];
      const N = a.length, M = b.length;
      const dp = Array.from({ length: N + 1 }, () => new Uint16Array(M + 1));

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
          dp[i + 1][j + 1] = (a[i] === b[j]) ? dp[i][j] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }

      let i = N, j = M;
      const chunks = [];
      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
          chunks.unshift({ t: 'same', val: a[i - 1] });
          i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          chunks.unshift({ t: 'ins', val: b[j - 1] });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          chunks.unshift({ t: 'del', val: a[i - 1] });
          i--;
        }
      }

      return chunks.map(c => {
        if (c.t === 'ins') return `<ins class="diff-ins">${this.escape(c.val)}</ins>`;
        if (c.t === 'del') return `<del class="diff-del">${this.escape(c.val)}</del>`;
        return this.escape(c.val);
      }).join('');
    }
  };

  /* -------------------------------------------------------------
   * 5. UI CONTROLLER & EVENT BINDINGS
   * ------------------------------------------------------------- */
  let origScore = 0;
  let humanScore = 0;
  let showingDiff = false;
  let isDark = false;

  const dom = {};

  function init() {
    dom.input = document.getElementById('input-original');
    dom.output = document.getElementById('output-humanized');
    dom.origPill = document.getElementById('orig-score-pill');
    dom.origVal = document.getElementById('orig-score-val');
    dom.humanPill = document.getElementById('human-score-pill');
    dom.humanVal = document.getElementById('human-score-val');
    dom.origCount = document.getElementById('orig-word-count');
    dom.humanCount = document.getElementById('human-word-count');
    dom.diffView = document.getElementById('diff-view');
    dom.toggleDiffBtn = document.getElementById('toggle-diff-btn');
    dom.dropZone = document.getElementById('drop-zone');
    dom.fileUploader = document.getElementById('file-uploader');
    dom.humanizeBtn = document.getElementById('humanize-btn');
    dom.clearBtn = document.getElementById('clear-btn');
    dom.sampleBtn = document.getElementById('load-sample-btn');
    dom.copyBtn = document.getElementById('copy-btn');
    dom.downloadBtn = document.getElementById('download-btn');
    dom.themeBtn = document.getElementById('theme-toggle-btn');
    dom.mobileOrigScore = document.getElementById('mobile-orig-score');
    dom.mobileHumanScore = document.getElementById('mobile-human-score');
    dom.paneOrig = document.getElementById('pane-original');
    dom.paneHuman = document.getElementById('pane-humanized');

    // Desktop default visibility
    dom.paneOrig.classList.add('pane--visible');
    dom.paneHuman.classList.add('pane--visible');

    bindEvents();
    updateOriginalAnalysis();
  }

  function bindEvents() {
    dom.input.addEventListener('input', updateOriginalAnalysis);

    dom.humanizeBtn.addEventListener('click', () => {
      runAutoHumanize();
      // On mobile, automatically show the humanized tab upon processing
      if (window.innerWidth <= 840) setMobileTab('human');
    });

    dom.clearBtn.addEventListener('click', () => {
      dom.input.value = '';
      dom.output.value = '';
      showingDiff = false;
      dom.diffView.style.display = 'none';
      dom.output.style.display = 'block';
      updateOriginalAnalysis();
      updateHumanizedScore('');
    });

    dom.sampleBtn.addEventListener('click', loadSample);

    dom.copyBtn.addEventListener('click', () => {
      if (!dom.output.value) return;
      navigator.clipboard.writeText(dom.output.value).then(() => {
        const prev = dom.copyBtn.textContent;
        dom.copyBtn.textContent = 'Copied!';
        setTimeout(() => dom.copyBtn.textContent = prev, 1500);
      });
    });

    dom.downloadBtn.addEventListener('click', exportFile);

    dom.toggleDiffBtn.addEventListener('click', toggleDiff);

    // Theme Switcher
    dom.themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    });

    // File Drag and Drop
    ['dragenter', 'dragover'].forEach(name => {
      dom.dropZone.addEventListener(name, (e) => { e.preventDefault(); dom.dropZone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      dom.dropZone.addEventListener(name, (e) => { e.preventDefault(); dom.dropZone.classList.remove('dragover'); });
    });
    dom.dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    dom.fileUploader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFile(file);
    });
  }

  async function handleFile(file) {
    try {
      const text = await FileParser.parse(file);
      dom.input.value = text;
      updateOriginalAnalysis();
    } catch (err) {
      alert(`File Error: ${err.message}`);
    }
  }

  function updateOriginalAnalysis() {
    const text = dom.input.value;
    const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    dom.origCount.textContent = `${words} words \u2022 ${text.length} chars`;

    origScore = Detector.score(text);
    renderPill(dom.origPill, dom.origVal, origScore, text.trim().length > 0);
    dom.mobileOrigScore.textContent = text.trim() ? `${origScore}%` : '—';
  }

  function runAutoHumanize() {
    const text = dom.input.value.trim();
    if (!text) return;

    const result = Humanizer.process(text);
    dom.output.value = result;

    updateHumanizedScore(result);

    if (showingDiff) {
      dom.diffView.innerHTML = Diff.compute(text, result);
    }
  }

  function updateHumanizedScore(result) {
    const words = (result.match(/[\p{L}\p{N}]+/gu) || []).length;
    dom.humanCount.textContent = `${words} words`;

    humanScore = Detector.score(result);
    renderPill(dom.humanPill, dom.humanVal, humanScore, result.trim().length > 0);
    dom.mobileHumanScore.textContent = result.trim() ? `${humanScore}%` : '—';
  }

  function renderPill(pill, label, score, hasText) {
    pill.className = 'score-pill';
    if (!hasText) {
      pill.classList.add('score-pill--empty');
      label.textContent = '0% AI Score';
      return;
    }

    if (score >= 65) {
      pill.classList.add('score-pill--high');
    } else if (score >= 35) {
      pill.classList.add('score-pill--mid');
    } else {
      pill.classList.add('score-pill--low');
    }
    label.textContent = `${score}% AI Pattern`;
  }

  function toggleDiff() {
    if (!dom.output.value) return;
    showingDiff = !showingDiff;

    if (showingDiff) {
      dom.diffView.innerHTML = Diff.compute(dom.input.value, dom.output.value);
      dom.diffView.style.display = 'block';
      dom.output.style.display = 'none';
      dom.toggleDiffBtn.textContent = 'Hide Diff';
    } else {
      dom.diffView.style.display = 'none';
      dom.output.style.display = 'block';
      dom.toggleDiffBtn.textContent = 'Show Diff';
    }
  }

  function loadSample() {
    const sample = 
`It is important to note that researchers utilize a comprehensive variety of computational models. Furthermore, the utilization of these algorithms has demonstrated significant potential in orchestrating more robust workflows. Consequently, it is worth mentioning that modern institutions leverage a tapestry of tools to delve into the intricate nuances of this landscape.`;
    dom.input.value = sample;
    updateOriginalAnalysis();
    runAutoHumanize();
  }

  function exportFile() {
    const text = dom.output.value;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humanized-text-${Date.now().toString().slice(-4)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function setMobileTab(tab) {
    const btnOrig = document.getElementById('tab-btn-orig');
    const btnHuman = document.getElementById('tab-btn-human');

    if (tab === 'orig') {
      btnOrig.classList.add('mobile-tab--active');
      btnOrig.setAttribute('aria-selected', 'true');
      btnHuman.classList.remove('mobile-tab--active');
      btnHuman.setAttribute('aria-selected', 'false');

      dom.paneOrig.classList.add('pane--visible');
      dom.paneHuman.classList.remove('pane--visible');
    } else {
      btnHuman.classList.add('mobile-tab--active');
      btnHuman.setAttribute('aria-selected', 'true');
      btnOrig.classList.remove('mobile-tab--active');
      btnOrig.setAttribute('aria-selected', 'false');

      dom.paneHuman.classList.add('pane--visible');
      dom.paneOrig.classList.remove('pane--visible');
    }
  }

  return { init, setMobileTab };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', App.init);
} else {
  App.init();
}