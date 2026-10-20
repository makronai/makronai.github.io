/**
 * ai-tool.js
 * Local AI Text Detector, by Makron
 */

const AIT = (() => {

  const TT = {
    WORD: 'WORD', PUNCT: 'PUNCT', CONNECTOR: 'CONNECTOR', HEDGE: 'HEDGE',
    FILLER: 'FILLER', TRANSITION: 'TRANSITION', FORMAL: 'FORMAL', CLICHE: 'CLICHE',
    PASSIVE_AUX: 'PASSIVE_AUX', NUMBER: 'NUMBER', SENTENCE_END: 'SENTENCE_END', WS: 'WS',
  };

  /* ── Stricter Lexer Keyword Sets ── */
  const CONNECTORS = new Set(['furthermore','moreover','additionally','consequently','nevertheless','nonetheless','therefore','thus','hence','meanwhile','subsequently','accordingly','alternatively','conversely', 'firstly', 'secondly', 'lastly']);
  const HEDGES = new Set(['important','note','worth','mention','crucial','essential','significant','paramount','vital','pivotal','noteworthy','imperative','evident','apparent','clear','obvious', 'undoubtedly', 'certainly', 'arguably', 'potentially']);
  const FILLERS = new Set(['basically','essentially','notably','fundamentally','inherently','ultimately','clearly','obviously','simply','comprehensive','robust','holistic','synergy','paradigm','various','numerous','diverse','straightforward', 'multifaceted', 'dynamic']);
  const TRANSITIONS = new Set(['conclusion','summary','overview','result','regard','terms','perspective','context','light', 'overall', 'summary']);
  const FORMAL = new Set(['utilize','facilitate','demonstrate','implement','leverage','optimize','prioritize','streamline','endeavor','ascertain','commence','terminate','obtain','require','regarding','aforementioned','herein','thereof','thereby','wherein','whereby','insofar','inasmuch', 'elucidate', 'mitigate', 'encompass']);
  const CLICHES = new Set(['delve', 'tapestry', 'testament', 'beacon', 'foster', 'nuance', 'realm', 'landscape', 'symbiosis', 'orchestrate', 'underscore', 'intricate', 'seamless', 'harness', 'unwavering', 'catalyst', 'navigate', 'resonate', 'testament', 'tailored']);
  const PASSIVE_AUX = new Set(['is','are','was','were','be','been','being','has','have','had']);
  
  const AI_SIGNAL_TYPES = new Set([TT.CONNECTOR, TT.HEDGE, TT.FILLER, TT.FORMAL, TT.TRANSITION, TT.CLICHE]);

  function lex(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        let j = i; while (j < text.length && /\s/.test(text[j])) j++;
        tokens.push({ type: TT.WS, value: text.slice(i, j), pos: i });
        i = j; continue;
      }
      if (/[.!?]/.test(ch)) {
        tokens.push({ type: TT.SENTENCE_END, value: ch, pos: i }); i++; continue;
      }
      if (/[,;:()"'\-–—]/.test(ch)) {
        tokens.push({ type: TT.PUNCT, value: ch, pos: i }); i++; continue;
      }
      if (/[0-9]/.test(ch)) {
        let j = i; while (j < text.length && /[0-9.,]/.test(text[j])) j++;
        tokens.push({ type: TT.NUMBER, value: text.slice(i, j), pos: i });
        i = j; continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        let j = i; while (j < text.length && /[a-zA-Z'\u2019-]/.test(text[j])) j++;
        const raw  = text.slice(i, j);
        const lower = raw.toLowerCase().replace(/['\u2019]/g, "'");
        let type = TT.WORD;

        if (CONNECTORS.has(lower)) type = TT.CONNECTOR;
        else if (CLICHES.has(lower)) type = TT.CLICHE;
        else if (FILLERS.has(lower)) type = TT.FILLER;
        else if (FORMAL.has(lower)) type = TT.FORMAL;
        else if (HEDGES.has(lower)) type = TT.HEDGE;
        else if (TRANSITIONS.has(lower)) type = TT.TRANSITION;
        else if (PASSIVE_AUX.has(lower)) type = TT.PASSIVE_AUX;

        tokens.push({ type, value: raw, lower, pos: i });
        i = j; continue;
      }
      i++; 
    }
    return tokens;
  }

  function parse(tokens) {
    const sentences = [];
    let phrases = [], phrase = [];

    function flushPhrase() {
      const signals = phrase.filter(t => t.type !== TT.WS);
      if (signals.length > 0) phrases.push({ tokens: [...phrase], signals });
      phrase = [];
    }
    function flushSentence() {
      flushPhrase();
      if (phrases.length > 0) sentences.push({ phrases: [...phrases], raw: phrases.flatMap(p => p.tokens).map(t => t.value).join('') });
      phrases = [];
    }

    for (const tok of tokens) {
      if (tok.type === TT.SENTENCE_END) { flushSentence(); continue; }
      if (tok.type === TT.CONNECTOR && phrase.some(t => t.type !== TT.WS)) flushPhrase();
      phrase.push(tok);
    }
    flushSentence();
    return { type: 'Document', sentences, tokenCount: tokens.filter(t => t.type !== TT.WS).length };
  }

  function semanticAnalyze(ast) {
    const { sentences } = ast;
    if (sentences.length === 0) return null;

    const allTokens = sentences.flatMap(s => s.phrases.flatMap(p => p.signals));
    const words = allTokens.filter(t => t.type !== TT.PUNCT && t.type !== TT.SENTENCE_END && t.type !== TT.NUMBER);
    
    const count = (type) => words.filter(t => t.type === type).length;
    const N = words.length || 1;
    const S = sentences.length || 1;

    const nConn = count(TT.CONNECTOR); const f1 = Math.min((nConn / S) * 1.5, 1);
    const nHedge = count(TT.HEDGE); const f2 = Math.min((nHedge / N) * 8, 1);
    const nFill = count(TT.FILLER); const f3 = Math.min((nFill / N) * 10, 1);
    const nForm = count(TT.FORMAL); const f4 = Math.min((nForm / N) * 12, 1);
    const nCliche = count(TT.CLICHE); const fCliche = Math.min((nCliche / N) * 20, 1); // Heavy penalty for AI cliches
    
    const sentWordCounts = sentences.map(s => s.phrases.flatMap(p => p.signals).filter(t => [TT.WORD, TT.FILLER, TT.FORMAL, TT.CONNECTOR, TT.HEDGE, TT.CLICHE].includes(t.type)).length);
    const mean = sentWordCounts.reduce((a, b) => a + b, 0) / S;
    const variance = sentWordCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / S;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    const f6 = Math.max(0, 1 - (cv * 1.5)); // Penalize highly uniform sentences strictly

    const f7 = (mean >= 15 && mean <= 28) ? 0.8 : mean > 35 ? 0.3 : 0.4;
    const listOpeners = sentences.filter(s => { const first = s.phrases[0]?.signals[0]; return first && (first.type === TT.CONNECTOR || first.type === TT.TRANSITION); });
    const f8 = Math.min((listOpeners.length / S) * 2, 1);

    const wordValues = words.map(t => (t.lower || t.value.toLowerCase()));
    const ttr = new Set(wordValues).size / (wordValues.length || 1);
    const f9 = Math.max(0, 1 - ttr * 1.5);

    const W = { f1:0.12, f2:0.08, f3:0.12, f4:0.10, fCliche: 0.20, f6:0.15, f7:0.05, f8:0.08, f9:0.10 };
    const raw = W.f1*f1 + W.f2*f2 + W.f3*f3 + W.f4*f4 + W.fCliche*fCliche + W.f6*f6 + W.f7*f7 + W.f8*f8 + W.f9*f9;
    const score = Math.round(Math.min(raw * 140, 99));

    return {
      score, features: { f1, f2, f3, f4, fCliche, f6, f7, f8, f9 },
      metrics: { connectors: nConn, fillers: nFill, formals: nForm, hedges: nHedge, cliches: nCliche, avgSentLen: Math.round(mean * 10) / 10, ttr: Math.round(ttr * 100) / 100, sentUniformity: Math.round(f6 * 100), totalWords: wordValues.length, totalSentences: S },
      signalTokens: allTokens.filter(t => AI_SIGNAL_TYPES.has(t.type)).map(t => t.value),
      aiSignalTypes: AI_SIGNAL_TYPES, tokens: allTokens, ast,
    };
  }

  function levelClass(val) { return val > 0.5 ? 'high' : val > 0.25 ? 'mid' : 'low'; }

  function renderResults(result, rawTokens) {
    const sidebar = document.getElementById('ait-sidebar');
    const { score, features: F, metrics: M, signalTokens, aiSignalTypes, ast } = result;
    const level = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
    const verdictText = score >= 70 ? 'Surely AI' : score > 10 ? 'Likely AI' : 'Likely Human';

    const circ = 2 * Math.PI * 40;
    const offset = circ * (1 - score / 100);
    const ringColor = level === 'high' ? 'var(--ait-high)' : level === 'mid' ? 'var(--ait-mid)' : 'var(--ait-low)';

    const featureRows = [
      ['AI Clichés',          F.fCliche, `${M.cliches} found`],
      ['Connector density',   F.f1, `${M.connectors} found`],
      ['Filler / buzzwords',  F.f3, `${M.fillers} found`],
      ['Formal register',     F.f4, `${M.formals} found`],
      ['Sent. uniformity',    F.f6, `${M.sentUniformity}%`],
      ['Lexical diversity',   F.f9, `TTR ${M.ttr}`],
    ].map(([name, val, extra]) => {
      const lv = levelClass(val);
      return `<div class="ait-metric-row"><span class="ait-metric-name">${name}</span><span class="ait-metric-val ait-metric-val--${lv}">${extra}</span></div><div class="ait-bar-wrap"><div class="ait-bar-fill ait-bar-fill--${lv}" style="width:${Math.round(val*100)}%"></div></div>`;
    }).join('');

    const chips = signalTokens.slice(0, 28).map(t => `<span class="ait-token ait-token--signal">${t}</span>`).join('');
    const hl = rawTokens.map(t => {
      if (t.type === TT.WS) return t.value;
      if (aiSignalTypes.has(t.type)) return `<span class="ait-hl-signal" title="${t.type}">${t.value}</span>`;
      return t.value;
    }).join('');

    sidebar.innerHTML = `
      <div class="ait-score-block">
        <div class="ait-ring-wrap">
          <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r="40" fill="none" stroke="var(--ait-border)" stroke-width="8"/>
            <circle cx="48" cy="48" r="40" fill="none" stroke="${ringColor}" stroke-width="8" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" stroke-linecap="round" style="transition:stroke-dashoffset 0.6s ease"/>
          </svg>
          <div class="ait-ring-label"><span class="ait-ring-pct" style="color:${ringColor}">${score}%</span><span class="ait-ring-sub">AI Score</span></div>
        </div>
        <span class="ait-verdict ait-verdict--${level}">${verdictText}</span>
      </div>
      <div><div class="ait-section-label">// Semantic features</div><div class="ait-card">${featureRows}</div></div>
      <div><div class="ait-section-label">// AI-signal tokens</div><div class="ait-card"><div class="ait-token-list">${chips || '<span class="ait-token ait-token--neutral">No strong signals</span>'}</div></div></div>
      <div><div class="ait-section-label">// Signal highlights</div><div class="ait-highlight-box">${hl}</div></div>
      <div class="ait-card ait-stats-card">Words: ${M.totalWords} · Sentences: ${M.totalSentences}<br>Avg sentence: ${M.avgSentLen} words</div>`;
  }

  function setPhase(msg) { const el = document.getElementById('ait-phase-text'); if (el) el.textContent = msg; }
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function runPipeline() {
    const text = document.getElementById('ait-detect-input').value.trim();
    if (!text) return;
    const btn = document.getElementById('ait-analyze-btn');
    btn.disabled = true; btn.innerHTML = '<span class="ait-spin"></span>Analyzing…';
    
    setPhase('Phase 1 — Lexical analysis: tokenizing…'); await delay(80);
    const tokens = lex(text);
    setPhase('Phase 2 — Syntax analysis: building AST…'); await delay(80);
    const ast = parse(tokens);
    setPhase('Phase 3 — Semantic analysis: scoring features…'); await delay(120);
    const result = semanticAnalyze(ast);

    if (result) renderResults(result, tokens);
    setPhase(`Done — ${ast.sentences.length} sentences analyzed`);
    btn.disabled = false; btn.textContent = 'Analyze →';
  }

  function updateCount() {
    const text = document.getElementById('ait-detect-input').value;
    const words  = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el = document.getElementById('ait-word-count');
    if (el) el.textContent = `${words} words`;
  }

  function clearDetect() {
    document.getElementById('ait-detect-input').value = ''; updateCount();
    document.getElementById('ait-sidebar').innerHTML = `<div class="ait-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><p>Paste text and click <strong>Analyze</strong>.</p></div>`;
    setPhase('Ready — awaiting input');
  }

  function loadExample() {
    document.getElementById('ait-detect-input').value = `It is important to note that artificial intelligence has fundamentally transformed the way we approach complex problems in a multifaceted world. Furthermore, the utilization of machine learning algorithms has demonstrated significant potential in orchestrating more efficient workflows. Moreover, it is worth mentioning that these technologies leverage a tapestry of computational paradigms to ensure robust outcomes. In conclusion, we must delve into the nuances of this landscape.`;
    updateCount();
  }

  function switchTab(name) {
    document.querySelectorAll('.ait-tab').forEach(t => t.classList.toggle('ait-tab--active', t.dataset.tab === name));
    document.getElementById('ait-panel-detect').classList.toggle('ait-panel--active', name === 'detect');
    document.getElementById('ait-panel-humanize').classList.toggle('ait-panel--active', name === 'humanize');
  }

  function importFromDetector() {
    const text = document.getElementById('ait-detect-input').value;
    if (text.trim()) { document.getElementById('ait-humanize-input').value = text; switchTab('humanize'); }
  }

  /* ── 100% LOCAL HUMANIZER ENGINE ──────────────────────────── */
  let _humanizedText = '';
  let _showingDiff   = false;

  const LOCAL_REPLACEMENTS = [
    // Remove robotic hedges
    [/\b(it is important to note that|it is worth mentioning that|it should be noted that|it is evident that|it is clear that)\b/gi, ""],
    // Replace overused AI cliches
    [/\bdelve into\b/gi, "look at"], [/\bdelve\b/gi, "dig"], [/\ba tapestry of\b/gi, "many"], 
    [/\ba testament to\b/gi, "proof of"], [/\bmultifaceted\b/gi, "complex"],
    [/\borchestrating\b/gi, "managing"], [/\bnuances\b/gi, "details"],
    [/\blandscape\b/gi, "area"], [/\bpivotal\b/gi, "key"], [/\bfoster\b/gi, "build"],
    // Simplify vocabulary
    [/\butilize\b/gi, "use"], [/\butilization\b/gi, "use"], [/\bfacilitate\b/gi, "help"],
    [/\bdemonstrated\b/gi, "shown"], [/\bleverage\b/gi, "use"], [/\bcomprehensive\b/gi, "full"],
    [/\brobust\b/gi, "strong"], [/\bparamount\b/gi, "top"], [/\bmitigate\b/gi, "reduce"],
    [/\bendeavor\b/gi, "try"], [/\bcommence\b/gi, "start"], [/\bterminate\b/gi, "end"],
    // Tone down formal transitions
    [/\bfurthermore, \b/gi, "Also, "], [/\bmoreover, \b/gi, "Plus, "], [/\badditionally, \b/gi, "And "],
    [/\bconsequently, \b/gi, "So, "], [/\bnevertheless, \b/gi, "Still, "], [/\btherefore, \b/gi, "So "],
    [/\bin conclusion, \b/gi, "To wrap up, "], [/\bto summarize, \b/gi, "In short, "]
  ];

  function localHumanizeProcessor(text) {
    let result = text;
    // Apply all regex replacements
    for (const [regex, replacement] of LOCAL_REPLACEMENTS) {
      result = result.replace(regex, (match) => {
        // preserve basic capitalization for sentence starters
        if (match[0] === match[0].toUpperCase()) {
          if (!replacement) return ""; // Capitalized phrase removed completely
          return replacement.charAt(0).toUpperCase() + replacement.slice(1);
        }
        return replacement;
      });
    }
    
    // Cleanup double spaces, weird punctuation left by removed hedges
    result = result.replace(/  +/g, ' ').replace(/\. \./g, '.').replace(/^[,.]\s*/g, '');
    
    // Add minor human imperfection: occasionally change "and" to a period to break long sentences
    let sentenceCount = 0;
    result = result.replace(/\b and \b/gi, (match) => {
      sentenceCount++;
      // Break roughly every 4th "and" into a new sentence
      return (sentenceCount % 4 === 0) ? ". Plus, " : match;
    });

    return result.trim();
  }

  async function runHumanizer() {
    const text = document.getElementById('ait-humanize-input').value.trim();
    if (!text) return;

    const btn = document.getElementById('ait-humanize-btn');
    const out = document.getElementById('ait-humanize-output');

    btn.disabled = true; btn.innerHTML = '<span class="ait-spin"></span>Processing…';
    out.innerHTML = '<span class="ait-output-placeholder">Rewriting locally…</span>';
    document.getElementById('ait-diff-btn').style.display = 'none'; _showingDiff = false;

    // Simulate slight processing time for UI feedback
    await delay(600); 

    try {
      _humanizedText = localHumanizeProcessor(text);
      out.innerHTML = ''; out.textContent = _humanizedText;

      const origW = text.trim().split(/\s+/).length;
      const newW  = _humanizedText.trim().split(/\s+/).length;
      const stats = document.getElementById('ait-h-stats');
      if (stats) stats.textContent = `${origW} → ${newW} words`;

      document.getElementById('ait-diff-btn').style.display = '';
    } catch (err) {
      out.innerHTML = `<span class="ait-output-placeholder">Error processing text locally.</span>`;
    }

    btn.disabled = false; btn.textContent = 'Humanize →';
  }

  function copyOutput() {
    if (!_humanizedText) return;
    navigator.clipboard.writeText(_humanizedText).then(() => {
      const btn = document.getElementById('ait-copy-btn');
      btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    });
  }

  function toggleDiff() {
    const out = document.getElementById('ait-humanize-output');
    const btn = document.getElementById('ait-diff-btn');
    _showingDiff = !_showingDiff;
    btn.textContent = _showingDiff ? 'Show Diff' : 'Show Diff';

    if (_showingDiff) {
      const orig = document.getElementById('ait-humanize-input').value;
      out.innerHTML = buildDiff(orig, _humanizedText);
    } else {
      out.textContent = _humanizedText;
    }
  }

  function buildDiff(a, b) {
    const aWords = a.split(/(\s+)/); const bWords = b.split(/(\s+)/);
    const aSet = new Set(aWords.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
    const bSet = new Set(bWords.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));

    const removed = aWords.filter(w => { const k = w.toLowerCase().replace(/[^a-z]/g,''); return k && !bSet.has(k); }).map(w => `<span class="ait-diff-del">${w}</span>`).join(' ');
    const added = bWords.map(w => {
      const k = w.toLowerCase().replace(/[^a-z]/g,'');
      if (!k) return w; return aSet.has(k) ? w : `<span class="ait-diff-add">${w}</span>`;
    }).join('');

    return `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--ait-border)"><span class="ait-section-label">Removed: </span>${removed || '<em style="color:var(--ait-text-muted)">none</em>'}</div>${added}`;
  }

  return { runPipeline, updateCount, clearDetect, loadExample, switchTab, importFromDetector, runHumanizer, copyOutput, toggleDiff };

})();

function aitRunPipeline()       { AIT.runPipeline(); }
function aitUpdateCount()       { AIT.updateCount(); }
function aitClearDetect()       { AIT.clearDetect(); }
function aitLoadExample()       { AIT.loadExample(); }
function aitSwitchTab(name)     { AIT.switchTab(name); }
function aitImportFromDetector(){ AIT.importFromDetector(); }
function aitRunHumanizer()      { AIT.runHumanizer(); }
function aitCopyOutput()        { AIT.copyOutput(); }
function aitToggleDiff()        { AIT.toggleDiff(); }