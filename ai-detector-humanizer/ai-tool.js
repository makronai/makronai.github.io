/**
 * START OF FILE text/javascript (ai-tool.js)
 * Makron Writing Workbench & Structural Diagnostics Engine
 * Pure Vanilla JavaScript (ES2020+) - 100% Client-Side
 */

"use strict";

const WritingWorkbench = (() => {

  /* -------------------------------------------------------------
   * MODULE 1: NLP FOUNDATIONS (Tokenization, Segments, Syllables)
   * ------------------------------------------------------------- */
  const NLP = (() => {
    // English honorifics, titles, and common abbreviations to prevent incorrect sentence splits
    const ABBREVIATIONS = new Set([
      'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'eg', 'ie',
      'al', 'fig', 'inc', 'ltd', 'dept', 'approx', 'est', 'univ', 'no', 'vol'
    ]);

    // Common stop words filtered out during repetition / n-gram detection
    const STOP_WORDS = new Set([
      'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
      'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
      'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
      'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
      'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
      'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
      'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
      'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
      'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
      'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
      'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
      'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
      'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where',
      'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would',
      'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
    ]);

    /**
     * Splits text into individual words, handling Unicode letters and contractions.
     */
    function tokenizeWords(text) {
      if (!text || typeof text !== 'string') return [];
      // Use Intl.Segmenter if supported
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
        const words = [];
        for (const { segment, isWordLike } of segmenter.segment(text)) {
          if (isWordLike && segment.trim().length > 0) {
            words.push(segment);
          }
        }
        return words;
      }
      // Robust Unicode fallback
      const matches = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu);
      return matches ? Array.from(matches) : [];
    }

    /**
     * Splits text into sentences, protecting decimals, honorifics, and URLs.
     */
    function splitSentences(text) {
      if (!text || typeof text !== 'string') return [];
      const trimmed = text.trim();
      if (!trimmed) return [];

      // Regex matches boundary candidates: period, exclamation, question mark, or newline
      const candidateRegex = /([.!?]+|\n+)(?=\s+|$)/gu;
      const sentences = [];
      let lastIndex = 0;
      let match;

      while ((match = candidateRegex.exec(trimmed)) !== null) {
        const boundaryChar = match[0];
        const matchEnd = match.index + boundaryChar.length;
        const candidate = trimmed.slice(lastIndex, matchEnd).trim();

        // Check if candidate ends in an abbreviation like "Dr." or "e.g."
        const lastWordMatch = candidate.match(/([a-zA-Z]+)[.!?]+$/);
        if (lastWordMatch) {
          const lastWord = lastWordMatch[1].toLowerCase();
          if (ABBREVIATIONS.has(lastWord)) {
            // Check if followed by lowercase letter or continuation
            const remaining = trimmed.slice(matchEnd);
            if (/^\s+[a-z0-9]/u.test(remaining)) {
              continue; // Skip boundary: it's an abbreviation inside the sentence
            }
          }
        }

        // Check for decimal numbers, e.g. "3.14"
        const precedingChar = trimmed[match.index - 1];
        const followingChar = trimmed[matchEnd];
        if (boundaryChar === '.' && /\d/.test(precedingChar) && /\d/.test(followingChar)) {
          continue; // Skip decimal
        }

        if (candidate.length > 0) {
          sentences.push(candidate);
        }
        lastIndex = matchEnd;
      }

      const remainder = trimmed.slice(lastIndex).trim();
      if (remainder.length > 0) {
        sentences.push(remainder);
      }

      return sentences;
    }

    /**
     * Syllable Counter based on phonetic rules and morphological adjustments.
     */
    function countSyllables(word) {
      if (!word) return 0;
      const w = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!w) return 0;
      if (w.length <= 3) return 1;

      // Handle common silent suffixes and prefixes
      let cleaned = w
        .replace(/(?:[^laeiouy]|ed|es|e)$/, '')
        .replace(/^y/, '');

      const syllables = cleaned.match(/[aeiouy]{1,2}/g);
      return syllables ? Math.max(1, syllables.length) : 1;
    }

    /**
     * Extracts multi-word phrases (n-grams), filtering out pure stop-word sequences.
     */
    function extractNgrams(words, n = 2, minCount = 2) {
      if (!words || words.length < n) return [];
      const counts = new Map();

      for (let i = 0; i <= words.length - n; i++) {
        const slice = words.slice(i, i + n);
        const lowerSlice = slice.map(w => w.toLowerCase());

        // Skip if all tokens are stop words (e.g., "in the of")
        if (lowerSlice.every(w => STOP_WORDS.has(w))) continue;

        const phrase = lowerSlice.join(' ');
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }

      return Array.from(counts.entries())
        .filter(([_, count]) => count >= minCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16);
    }

    return {
      tokenizeWords,
      splitSentences,
      countSyllables,
      extractNgrams,
      STOP_WORDS
    };
  })();

  /* -------------------------------------------------------------
   * MODULE 2: METRICS & READABILITY ALGORITHMS
   * ------------------------------------------------------------- */
  const Metrics = (() => {

    /**
     * Computes comprehensive text statistics with strict safeguards against division by zero.
     */
    function analyzeText(rawText) {
      const text = rawText || '';
      const chars = text.length;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      const sentences = NLP.splitSentences(text);
      const words = NLP.tokenizeWords(text);

      const wordCount = words.length;
      const sentenceCount = sentences.length;
      const paragraphCount = paragraphs.length;

      if (wordCount === 0 || sentenceCount === 0) {
        return {
          counts: { words: 0, chars, sentences: 0, paragraphs: 0 },
          readability: { fre: 'N/A', fkg: 'N/A', cli: 'N/A', gfi: 'N/A' },
          rhythm: { mean: 0, median: 0, variance: 0, stdDev: 0, cv: 0, cadence: 'Empty' },
          lexical: { ttr: 0, rootTtr: 0, hapax: 0, connectorRatio: 0 },
          histogram: { short: 0, standard: 0, long: 0, veryLong: 0 },
          ngrams: []
        };
      }

      // 1. Syllable counting
      let totalSyllables = 0;
      let complexWords = 0; // >= 3 syllables for Gunning Fog
      for (const w of words) {
        const syl = NLP.countSyllables(w);
        totalSyllables += syl;
        if (syl >= 3) complexWords++;
      }

      // 2. Readability Formulas (Disclosed English standard equations)
      const wordsPerSentence = wordCount / sentenceCount;
      const syllablesPerWord = totalSyllables / wordCount;

      // Flesch Reading Ease: 206.835 - 1.015*(words/sent) - 84.6*(syl/word)
      const freRaw = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
      const fre = Math.min(100, Math.max(0, Math.round(freRaw * 10) / 10));

      // Flesch-Kincaid Grade Level: 0.39*(words/sent) + 11.8*(syl/word) - 15.59
      const fkgRaw = (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59;
      const fkg = Math.max(0, Math.round(fkgRaw * 10) / 10);

      // Coleman-Liau: 0.0588*L - 0.296*S - 15.8 (L = letters/100 words, S = sents/100 words)
      const letterCount = words.reduce((acc, w) => acc + w.replace(/[^a-zA-Z0-9]/g, '').length, 0);
      const L = (letterCount / wordCount) * 100;
      const S = (sentenceCount / wordCount) * 100;
      const cliRaw = (0.0588 * L) - (0.296 * S) - 15.8;
      const cli = Math.max(0, Math.round(cliRaw * 10) / 10);

      // Gunning Fog Index: 0.4 * ((words/sent) + 100 * (complexWords / words))
      const gfiRaw = 0.4 * (wordsPerSentence + (100 * (complexWords / wordCount)));
      const gfi = Math.max(0, Math.round(gfiRaw * 10) / 10);

      // 3. Sentence Length Cadence & Burstiness
      const sentLengths = sentences.map(s => NLP.tokenizeWords(s).length).filter(l => l > 0);
      const sortedLengths = [...sentLengths].sort((a, b) => a - b);
      const meanSent = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;

      const mid = Math.floor(sortedLengths.length / 2);
      const medianSent = sortedLengths.length % 2 !== 0 
        ? sortedLengths[mid] 
        : (sortedLengths[mid - 1] + sortedLengths[mid]) / 2;

      const variance = sentLengths.reduce((acc, len) => acc + Math.pow(len - meanSent, 2), 0) / sentLengths.length;
      const stdDev = Math.sqrt(variance);
      const cv = meanSent > 0 ? stdDev / meanSent : 0; // Coefficient of Variation

      let cadence = 'Balanced';
      if (cv < 0.28) cadence = 'Monotonous / Uniform';
      else if (cv > 0.55) cadence = 'Dynamic / Varied';

      // 4. Histogram distribution
      const histogram = { short: 0, standard: 0, long: 0, veryLong: 0 };
      for (const len of sentLengths) {
        if (len < 12) histogram.short++;
        else if (len <= 25) histogram.standard++;
        else if (len <= 35) histogram.long++;
        else histogram.veryLong++;
      }

      // 5. Lexical Diversity
      const lowerWords = words.map(w => w.toLowerCase());
      const uniqueWords = new Set(lowerWords);
      const ttr = uniqueWords.size / wordCount;
      // Guiraud's Index (Root TTR): V / sqrt(N) - reduces document length sensitivity
      const rootTtr = uniqueWords.size / Math.sqrt(wordCount);

      // Hapax Legomena: words occurring exactly once
      const freqMap = new Map();
      for (const w of lowerWords) freqMap.set(w, (freqMap.get(w) || 0) + 1);
      let hapaxCount = 0;
      for (const count of freqMap.values()) if (count === 1) hapaxCount++;
      const hapaxRatio = hapaxCount / uniqueWords.size;

      // Overused formal logical transitions ratio
      const connectors = new Set(['furthermore', 'moreover', 'additionally', 'consequently', 'therefore', 'thus', 'hence']);
      let connectorCount = 0;
      for (const s of sentences) {
        const firstWord = (NLP.tokenizeWords(s)[0] || '').toLowerCase();
        if (connectors.has(firstWord)) connectorCount++;
      }
      const connectorRatio = connectorCount / sentenceCount;

      return {
        counts: { words: wordCount, chars, sentences: sentenceCount, paragraphs: paragraphCount },
        readability: { fre, fkg, cli, gfi },
        rhythm: {
          mean: Math.round(meanSent * 10) / 10,
          median: Math.round(medianSent * 10) / 10,
          stdDev: Math.round(stdDev * 10) / 10,
          cv: Math.round(cv * 100) / 100,
          cadence
        },
        lexical: {
          ttr: Math.round(ttr * 100) / 100,
          rootTtr: Math.round(rootTtr * 10) / 10,
          hapax: Math.round(hapaxRatio * 100) + '%',
          connectorRatio: Math.round(connectorRatio * 100) + '%'
        },
        histogram,
        ngrams: NLP.extractNgrams(words, 2, 2)
      };
    }

    return { analyzeText };
  })();

  /* -------------------------------------------------------------
   * MODULE 3: INTERACTIVE EDITORIAL SUGGESTIONS ENGINE
   * ------------------------------------------------------------- */
  const Suggestions = (() => {

    /**
     * Catalog of explainable heuristic rules.
     * Each rule features an explicit reason and safe/review classification.
     */
    const HEURISTIC_RULES = [
      // Conciseness & Redundancy
      {
        regex: /\bin order to\b/gi,
        replacement: 'to',
        category: 'wordiness',
        label: 'Wordiness',
        reason: 'Simplify "in order to" to the direct infinitive "to".',
        isSafe: true
      },
      {
        regex: /\bdue to the fact that\b/gi,
        replacement: 'because',
        category: 'wordiness',
        label: 'Wordiness',
        reason: 'Replace the cumbersome phrase "due to the fact that" with "because".',
        isSafe: true
      },
      {
        regex: /\bat the present time\b/gi,
        replacement: 'currently',
        category: 'wordiness',
        label: 'Wordiness',
        reason: '"Currently" or "now" expresses this more concisely.',
        isSafe: true
      },
      {
        regex: /\butilize\b/gi,
        replacement: 'use',
        category: 'clarity',
        label: 'Simplicity',
        reason: '"Use" is almost always clearer and less pretentious than "utilize".',
        isSafe: true
      },
      {
        regex: /\butilization\b/gi,
        replacement: 'use',
        category: 'clarity',
        label: 'Simplicity',
        reason: 'Replace nominalization "utilization" with "use".',
        isSafe: true
      },
      {
        regex: /\ba large number of\b/gi,
        replacement: 'many',
        category: 'wordiness',
        label: 'Wordiness',
        reason: 'Use "many" instead of "a large number of".',
        isSafe: true
      },
      {
        regex: /\bhas the ability to\b/gi,
        replacement: 'can',
        category: 'clarity',
        label: 'Clarity',
        reason: 'Replace passive capability with "can".',
        isSafe: true
      },

      // Pretentious Filler & Weak Hedges
      {
        regex: /\bit is important to note that\b/gi,
        replacement: '',
        category: 'clarity',
        label: 'Preamble',
        reason: 'Empty preamble. Deleting it makes the following assertion stronger.',
        isSafe: false
      },
      {
        regex: /\bit is worth mentioning that\b/gi,
        replacement: '',
        category: 'clarity',
        label: 'Preamble',
        reason: 'Unnecessary throat-clearing phrase that delays the main idea.',
        isSafe: false
      },
      {
        regex: /\bdelve into\b/gi,
        replacement: 'examine',
        category: 'clarity',
        label: 'Cliché',
        reason: '"Delve into" is an overused cliché. Consider "examine", "explore", or "study".',
        isSafe: false
      },
      {
        regex: /\ba tapestry of\b/gi,
        replacement: 'a complex mix of',
        category: 'clarity',
        label: 'Cliché',
        reason: '"A tapestry of" is an overused cliché.',
        isSafe: false
      },
      {
        regex: /\btestament to\b/gi,
        replacement: 'evidence of',
        category: 'clarity',
        label: 'Cliché',
        reason: 'Consider "evidence of" or "proof of" for clearer academic tone.',
        isSafe: false
      },

      // Punctuation & Spacing Anomalies
      {
        regex: /[ ]{2,}/g,
        replacement: ' ',
        category: 'punctuation',
        label: 'Spacing',
        reason: 'Remove accidental multiple spaces.',
        isSafe: true
      },
      {
        regex: /\s+([,.;:!?])/g,
        replacement: '$1',
        category: 'punctuation',
        label: 'Punctuation',
        reason: 'Remove erroneous space before punctuation mark.',
        isSafe: true
      }
    ];

    /**
     * Scans text and generates a discrete, indexed list of proposed improvements.
     */
    function findSuggestions(text) {
      if (!text || typeof text !== 'string') return [];
      const suggestions = [];
      let nextId = 1;

      for (const rule of HEURISTIC_RULES) {
        let match;
        // Reset regex state
        rule.regex.lastIndex = 0;

        while ((match = rule.regex.exec(text)) !== null) {
          const matchedText = match[0];
          const start = match.index;
          const end = start + matchedText.length;

          // Preserve capitalization when replacement is a direct word
          let replacement = rule.replacement;
          if (replacement && matchedText[0] === matchedText[0].toUpperCase() && matchedText[0] !== matchedText[0].toLowerCase()) {
            replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
          }

          suggestions.push({
            id: nextId++,
            category: rule.category,
            label: rule.label,
            original: matchedText,
            replacement: replacement,
            start,
            end,
            reason: rule.reason,
            isSafe: rule.isSafe
          });
        }
      }

      // Identify overlong sentences (> 38 words)
      const sentences = NLP.splitSentences(text);
      let searchOffset = 0;
      for (const s of sentences) {
        const words = NLP.tokenizeWords(s);
        const sIndex = text.indexOf(s, searchOffset);
        if (sIndex !== -1) searchOffset = sIndex + s.length;

        if (words.length > 38 && sIndex !== -1) {
          suggestions.push({
            id: nextId++,
            category: 'clarity',
            label: 'Complex Sentence',
            original: s.slice(0, 40) + '…',
            replacement: '', // Manual editorial review required
            start: sIndex,
            end: sIndex + s.length,
            reason: `This sentence is ${words.length} words long. Consider breaking it into two sentences for readability.`,
            isSafe: false
          });
        }
      }

      // Sort in descending order of offset so sequential applications don't invalidate positions
      return suggestions.sort((a, b) => a.start - b.start);
    }

    /**
     * Applies a single suggestion cleanly by character slice.
     */
    function applySuggestion(text, suggestion) {
      const before = text.slice(0, suggestion.start);
      const after = text.slice(suggestion.end);
      let replacement = suggestion.replacement;

      // Clean up orphaned whitespace if an entire preamble phrase was removed
      if (replacement === '' && before.endsWith(' ') && after.startsWith(' ')) {
        return before + after.slice(1);
      }
      return before + replacement + after;
    }

    return {
      findSuggestions,
      applySuggestion
    };
  })();

  /* -------------------------------------------------------------
   * MODULE 4: DIFF & COMPARISON ENGINE
   * ------------------------------------------------------------- */
  const DiffEngine = (() => {

    /**
     * Escapes untrusted text to prevent XSS in diff renderers.
     */
    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    /**
     * Token-based Myers/LCS diff algorithm for clean revision comparisons.
     */
    function computeWordDiff(oldText, newText) {
      if (oldText === newText) {
        return escapeHtml(newText);
      }

      // Split into words and whitespace preservation tokens
      const tokenize = (str) => str.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+/gu) || [];
      const a = tokenize(oldText);
      const b = tokenize(newText);

      const N = a.length;
      const M = b.length;

      // LCS Matrix table
      const dp = Array.from({ length: N + 1 }, () => new Uint16Array(M + 1));

      for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
          if (a[i] === b[j]) {
            dp[i + 1][j + 1] = dp[i][j] + 1;
          } else {
            dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }
      }

      // Backtrack to build the diff
      let i = N;
      let j = M;
      const chunks = [];

      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
          chunks.unshift({ type: 'same', text: a[i - 1] });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          chunks.unshift({ type: 'ins', text: b[j - 1] });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          chunks.unshift({ type: 'del', text: a[i - 1] });
          i--;
        }
      }

      // Render safely escaped HTML
      let html = '';
      for (const chunk of chunks) {
        const escaped = escapeHtml(chunk.text);
        if (chunk.type === 'ins') {
          html += `<ins class="ait-diff-ins">${escaped}</ins>`;
        } else if (chunk.type === 'del') {
          html += `<del class="ait-diff-del">${escaped}</del>`;
        } else {
          html += escaped;
        }
      }
      return html;
    }

    return { computeWordDiff, escapeHtml };
  })();

  /* -------------------------------------------------------------
   * MODULE 5: WORKBENCH STATE & DOM CONTROLLER
   * ------------------------------------------------------------- */
  const UI = (() => {
    // Application State
    const state = {
      baselineText: '',
      history: [],
      historyIndex: -1,
      currentSuggestions: [],
      debounceTimer: null,
      fontSize: 15,
      isDark: false
    };

    // DOM Elements Cache
    let el = {};

    function cacheElements() {
      el = {
        mainInput: document.getElementById('ait-main-input'),
        liveCounts: document.getElementById('ait-live-counts'),
        suggestionsList: document.getElementById('ait-suggestions-list'),
        suggestionCount: document.getElementById('ait-suggestion-count'),
        acceptAllBtn: document.getElementById('ait-accept-all-btn'),
        undoBtn: document.getElementById('ait-undo-btn'),
        redoBtn: document.getElementById('ait-redo-btn'),
        clearBtn: document.getElementById('ait-clear-btn'),
        loadSampleBtn: document.getElementById('ait-load-sample-btn'),
        fileImport: document.getElementById('ait-file-import'),
        exportBtn: document.getElementById('ait-export-btn'),
        copyBtn: document.getElementById('ait-copy-input-btn'),
        statusMsg: document.getElementById('ait-status-message'),
        themeToggle: document.getElementById('btn-theme-toggle'),
        themeText: document.getElementById('theme-text'),
        themeIcon: document.getElementById('theme-icon'),
        fontInc: document.getElementById('btn-font-increase'),
        fontDec: document.getElementById('btn-font-decrease'),
        diffInline: document.getElementById('ait-diff-inline'),
        setBaselineBtn: document.getElementById('ait-set-baseline-btn'),
        restoreBaselineBtn: document.getElementById('ait-restore-baseline-btn'),
        runTestsBtn: document.getElementById('ait-run-tests-btn'),
        testResultsLog: document.getElementById('ait-test-results-log'),

        // Metric Values
        valFre: document.getElementById('val-fre'),
        valFkg: document.getElementById('val-fkg'),
        valCli: document.getElementById('val-cli'),
        valGfi: document.getElementById('val-gfi'),
        valMeanSent: document.getElementById('val-mean-sent'),
        valMedianSent: document.getElementById('val-median-sent'),
        valCvSent: document.getElementById('val-cv-sent'),
        valCadence: document.getElementById('val-cadence'),
        valTtr: document.getElementById('val-ttr'),
        valRootTtr: document.getElementById('val-root-ttr'),
        valHapax: document.getElementById('val-hapax'),
        valConnectors: document.getElementById('val-connectors'),
        histogramContainer: document.getElementById('ait-histogram-container'),
        ngramsContainer: document.getElementById('ait-ngrams-container')
      };
    }

    /**
     * Push state snapshot to internal undo/redo stack.
     */
    function recordHistory(text) {
      if (state.historyIndex >= 0 && state.history[state.historyIndex] === text) {
        return;
      }
      state.history = state.history.slice(0, state.historyIndex + 1);
      state.history.push(text);
      if (state.history.length > 25) state.history.shift();
      state.historyIndex = state.history.length - 1;
      updateHistoryButtons();
    }

    function updateHistoryButtons() {
      if (el.undoBtn) el.undoBtn.disabled = state.historyIndex <= 0;
      if (el.redoBtn) el.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
    }

    /**
     * Executes analysis and updates live UI elements.
     */
    function runLivePipeline() {
      const text = el.mainInput.value;
      const metrics = Metrics.analyzeText(text);

      // 1. Update Count Bar
      if (el.liveCounts) {
        el.liveCounts.innerHTML = `
          <span>${metrics.counts.words} words</span> &bull; 
          <span>${metrics.counts.chars} characters</span> &bull; 
          <span>${metrics.counts.sentences} sentences</span> &bull; 
          <span>${metrics.counts.paragraphs} paragraphs</span>
        `;
      }

      // 2. Update Diagnostics Metrics Panel
      if (el.valFre) el.valFre.textContent = metrics.readability.fre;
      if (el.valFkg) el.valFkg.textContent = metrics.readability.fkg;
      if (el.valCli) el.valCli.textContent = metrics.readability.cli;
      if (el.valGfi) el.valGfi.textContent = metrics.readability.gfi;

      if (el.valMeanSent) el.valMeanSent.textContent = metrics.rhythm.mean ? `${metrics.rhythm.mean} words` : '—';
      if (el.valMedianSent) el.valMedianSent.textContent = metrics.rhythm.median ? `${metrics.rhythm.median} words` : '—';
      if (el.valCvSent) el.valCvSent.textContent = metrics.rhythm.cv !== 0 ? metrics.rhythm.cv : '—';
      if (el.valCadence) el.valCadence.textContent = metrics.rhythm.cadence;

      if (el.valTtr) el.valTtr.textContent = metrics.lexical.ttr || '—';
      if (el.valRootTtr) el.valRootTtr.textContent = metrics.lexical.rootTtr || '—';
      if (el.valHapax) el.valHapax.textContent = metrics.lexical.hapax;
      if (el.valConnectors) el.valConnectors.textContent = metrics.lexical.connectorRatio;

      // 3. Render Sentence Length Histogram
      renderHistogram(metrics.histogram, metrics.counts.sentences);

      // 4. Render N-Grams
      renderNgrams(metrics.ngrams);

      // 5. Generate Suggestions
      state.currentSuggestions = Suggestions.findSuggestions(text);
      renderSuggestions(state.currentSuggestions);

      // 6. Update Diff View
      renderDiff();

      if (el.statusMsg) {
        el.statusMsg.textContent = `Analyzed ${metrics.counts.words} words locally at ${new Date().toLocaleTimeString()}.`;
      }
    }

    function renderHistogram(histo, totalSentences) {
      if (!el.histogramContainer) return;
      if (totalSentences === 0) {
        el.histogramContainer.innerHTML = '<span class="ait-placeholder-text">No sentence data yet.</span>';
        return;
      }

      const rows = [
        { label: 'Short (<12 words)', count: histo.short },
        { label: 'Medium (12–25)', count: histo.standard },
        { label: 'Long (26–35)', count: histo.long },
        { label: 'Complex (>35)', count: histo.veryLong }
      ];

      let html = '';
      for (const r of rows) {
        const pct = Math.round((r.count / totalSentences) * 100) || 0;
        html += `
          <div class="ait-histo-row">
            <span>${r.label}</span>
            <div class="ait-histo-bar-wrap">
              <div class="ait-histo-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="ait-histo-count">${r.count}</span>
          </div>
        `;
      }
      el.histogramContainer.innerHTML = html;
    }

    function renderNgrams(ngrams) {
      if (!el.ngramsContainer) return;
      if (!ngrams || ngrams.length === 0) {
        el.ngramsContainer.innerHTML = '<span class="ait-placeholder-text">Enter more text to identify repeated phrase clusters.</span>';
        return;
      }

      let html = '';
      for (const [phrase, count] of ngrams) {
        html += `
          <span class="ait-tag">
            ${DiffEngine.escapeHtml(phrase)}
            <span class="ait-tag-badge">&times;${count}</span>
          </span>
        `;
      }
      el.ngramsContainer.innerHTML = html;
    }

    function renderSuggestions(suggs) {
      if (!el.suggestionsList || !el.suggestionCount) return;
      el.suggestionCount.textContent = `${suggs.length} item${suggs.length === 1 ? '' : 's'}`;

      if (el.acceptAllBtn) {
        const safeCount = suggs.filter(s => s.isSafe && s.replacement !== '').length;
        el.acceptAllBtn.disabled = safeCount === 0;
        el.acceptAllBtn.textContent = `Apply ${safeCount} Safe Fix${safeCount === 1 ? '' : 'es'}`;
      }

      if (suggs.length === 0) {
        el.suggestionsList.innerHTML = `
          <div class="ait-empty-state">
            <p>No issues detected. Your draft exhibits direct phrasing and clear punctuation.</p>
          </div>
        `;
        return;
      }

      let html = '';
      for (const s of suggs) {
        const isActionable = s.replacement !== '';
        html += `
          <div class="ait-card-suggestion" id="sugg-card-${s.id}">
            <div class="ait-sugg-header">
              <span class="ait-sugg-type ait-sugg-type--${s.category}">● ${DiffEngine.escapeHtml(s.label)}</span>
              <span>${s.isSafe ? 'Automatic' : 'Review'}</span>
            </div>
            <div class="ait-sugg-diff">
              <span class="ait-sugg-orig">${DiffEngine.escapeHtml(s.original)}</span>
              ${isActionable ? `<span class="ait-sugg-new">&rarr; ${DiffEngine.escapeHtml(s.replacement || '(delete)')}</span>` : ''}
            </div>
            <div class="ait-sugg-reason">${DiffEngine.escapeHtml(s.reason)}</div>
            <div class="ait-sugg-actions">
              ${isActionable ? `
                <button type="button" class="ait-btn-primary ait-btn-sm" onclick="WritingWorkbench.applySingleSuggestion(${s.id})">
                  Apply
                </button>
              ` : `
                <button type="button" class="ait-btn-ghost ait-btn-sm" onclick="WritingWorkbench.dismissSuggestion(${s.id})">
                  Acknowledge
                </button>
              `}
              <button type="button" class="ait-btn-ghost ait-btn-sm" onclick="WritingWorkbench.dismissSuggestion(${s.id})">
                Dismiss
              </button>
            </div>
          </div>
        `;
      }
      el.suggestionsList.innerHTML = html;
    }

    function renderDiff() {
      if (!el.diffInline) return;
      const current = el.mainInput.value;
      if (!state.baselineText && current) {
        state.baselineText = current;
      }
      el.diffInline.innerHTML = DiffEngine.computeWordDiff(state.baselineText, current);
    }

    function debouncedAnalyze() {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(() => {
        runLivePipeline();
      }, 160);
    }

    /**
     * Tab Switcher with Accessible Attributes
     */
    function switchTab(targetTab) {
      const tabs = document.querySelectorAll('.ait-tab');
      const panels = document.querySelectorAll('.ait-panel');

      tabs.forEach(tab => {
        const isActive = tab.dataset.tab === targetTab;
        tab.classList.toggle('ait-tab--active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      panels.forEach(panel => {
        const isTarget = panel.id === `panel-${targetTab}`;
        panel.classList.toggle('ait-panel--active', isTarget);
      });

      if (targetTab === 'diff') {
        renderDiff();
      }
    }

    function setupEventListeners() {
      // Input event with debouncing and history capture
      el.mainInput.addEventListener('input', () => {
        debouncedAnalyze();
      });

      el.mainInput.addEventListener('change', () => {
        recordHistory(el.mainInput.value);
      });

      // Keyboard Undo/Redo Shortcuts
      el.mainInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            redo();
          } else {
            e.preventDefault();
            undo();
          }
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          redo();
        }
      });

      // Tab click events
      document.querySelectorAll('.ait-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
      });

      // Toolbar Actions
      if (el.clearBtn) {
        el.clearBtn.addEventListener('click', () => {
          if (el.mainInput.value && confirm('Clear editor contents?')) {
            el.mainInput.value = '';
            recordHistory('');
            runLivePipeline();
            el.mainInput.focus();
          }
        });
      }

      if (el.loadSampleBtn) {
        el.loadSampleBtn.addEventListener('click', loadSampleText);
      }

      if (el.undoBtn) el.undoBtn.addEventListener('click', undo);
      if (el.redoBtn) el.redoBtn.addEventListener('click', redo);

      if (el.acceptAllBtn) {
        el.acceptAllBtn.addEventListener('click', applyAllSafeSuggestions);
      }

      if (el.setBaselineBtn) {
        el.setBaselineBtn.addEventListener('click', () => {
          state.baselineText = el.mainInput.value;
          renderDiff();
          if (el.statusMsg) el.statusMsg.textContent = 'Comparison baseline reset to current draft.';
        });
      }

      if (el.restoreBaselineBtn) {
        el.restoreBaselineBtn.addEventListener('click', () => {
          if (confirm('Revert all changes and restore original baseline text?')) {
            el.mainInput.value = state.baselineText;
            recordHistory(state.baselineText);
            runLivePipeline();
          }
        });
      }

      if (el.copyBtn) {
        el.copyBtn.addEventListener('click', () => {
          if (!el.mainInput.value) return;
          navigator.clipboard.writeText(el.mainInput.value).then(() => {
            const originalText = el.copyBtn.textContent;
            el.copyBtn.textContent = 'Copied!';
            setTimeout(() => { el.copyBtn.textContent = originalText; }, 1400);
          });
        });
      }

      if (el.exportBtn) {
        el.exportBtn.addEventListener('click', () => {
          const text = el.mainInput.value;
          if (!text) return;
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `revised-draft-${new Date().toISOString().slice(0, 10)}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      }

      if (el.fileImport) {
        el.fileImport.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const text = event.target.result;
            el.mainInput.value = text;
            state.baselineText = text;
            recordHistory(text);
            runLivePipeline();
            switchTab('editor');
          };
          reader.readAsText(file);
        });
      }

      // Font size adjustment
      if (el.fontInc) {
        el.fontInc.addEventListener('click', () => {
          if (state.fontSize < 24) {
            state.fontSize += 1;
            document.documentElement.style.setProperty('--editor-font-size', `${state.fontSize}px`);
          }
        });
      }
      if (el.fontDec) {
        el.fontDec.addEventListener('click', () => {
          if (state.fontSize > 12) {
            state.fontSize -= 1;
            document.documentElement.style.setProperty('--editor-font-size', `${state.fontSize}px`);
          }
        });
      }

      // Theme toggle
      if (el.themeToggle) {
        el.themeToggle.addEventListener('click', () => {
          state.isDark = !state.isDark;
          document.documentElement.setAttribute('data-theme', state.isDark ? 'dark' : 'light');
          if (el.themeText) el.themeText.textContent = state.isDark ? 'Light' : 'Dark';
          if (el.themeIcon) el.themeIcon.textContent = state.isDark ? '☀️' : '🌙';
        });
      }

      if (el.runTestsBtn) {
        el.runTestsBtn.addEventListener('click', runTestSuite);
      }
    }

    function undo() {
      if (state.historyIndex > 0) {
        state.historyIndex--;
        el.mainInput.value = state.history[state.historyIndex];
        runLivePipeline();
        updateHistoryButtons();
      }
    }

    function redo() {
      if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        el.mainInput.value = state.history[state.historyIndex];
        runLivePipeline();
        updateHistoryButtons();
      }
    }

    function loadSampleText() {
      const sample = 
`In order to understand the development of modern science, it is important to note that researchers utilize a large number of empirical methodologies. Furthermore, due to the fact that early physical equipment was rudimentary, early scholars had the ability to observe natural phenomenon with only limited precision. At the present time, contemporary laboratories utilize advanced computational paradigms. Consequently, we can delve into intricate physical nuances that were once hidden behind a tapestry of experimental limitations.`;
      
      el.mainInput.value = sample;
      state.baselineText = sample;
      recordHistory(sample);
      runLivePipeline();
    }

    function applySingleSuggestion(id) {
      const sugg = state.currentSuggestions.find(s => s.id === id);
      if (!sugg) return;
      const current = el.mainInput.value;
      const updated = Suggestions.applySuggestion(current, sugg);
      el.mainInput.value = updated;
      recordHistory(updated);
      runLivePipeline();
    }

    function dismissSuggestion(id) {
      state.currentSuggestions = state.currentSuggestions.filter(s => s.id !== id);
      renderSuggestions(state.currentSuggestions);
    }

    function applyAllSafeSuggestions() {
      const safe = state.currentSuggestions
        .filter(s => s.isSafe && s.replacement !== '')
        .sort((a, b) => b.start - a.start); // Apply backwards to preserve index offsets

      if (safe.length === 0) return;
      let text = el.mainInput.value;
      for (const s of safe) {
        text = Suggestions.applySuggestion(text, s);
      }
      el.mainInput.value = text;
      recordHistory(text);
      runLivePipeline();
    }

    /**
     * MODULE 6: AUTOMATED IN-BROWSER TEST SUITE
     */
    function runTestSuite() {
      const log = el.testResultsLog;
      if (!log) return;
      log.innerHTML = 'Executing test cases...<br>';

      const results = [];
      function assert(name, condition) {
        results.push({ name, passed: Boolean(condition) });
      }

      // Test 1: Empty text handling
      const emptyRes = Metrics.analyzeText('');
      assert('Empty Input Handling', emptyRes.counts.words === 0 && emptyRes.readability.fre === 'N/A');

      // Test 2: Whitespace only
      const wsRes = Metrics.analyzeText('   \n\t   ');
      assert('Whitespace-Only Input', wsRes.counts.words === 0 && wsRes.counts.sentences === 0);

      // Test 3: Syllable counter precision
      assert('Syllable Count "the" = 1', NLP.countSyllables('the') === 1);
      assert('Syllable Count "monosyllabic" = 5', NLP.countSyllables('monosyllabic') === 5);
      assert('Syllable Count "rhythm" = 1', NLP.countSyllables('rhythm') === 1);

      // Test 4: Sentence splitting with abbreviations & decimals
      const sents = NLP.splitSentences('Dr. Smith bought 3.14 liters of fluid. He left at 5 p.m. to visit etc.');
      assert('Sentence Splitting Honorifics/Decimals', sents.length === 2);

      // Test 5: Unicode Tokenization
      const uniWords = NLP.tokenizeWords('Résumé, café, and naïve notions.');
      assert('Unicode Tokenizer Support', uniWords.includes('Résumé') && uniWords.includes('café'));

      // Test 6: Diff HTML sanitization (XSS guard)
      const dirtyOld = '<script>alert(1)</script>';
      const dirtyNew = '<script>alert(2)</script>';
      const diffOut = DiffEngine.computeWordDiff(dirtyOld, dirtyNew);
      assert('Diff Engine XSS Guard', !diffOut.includes('<script>') && diffOut.includes('&lt;script&gt;'));

      // Test 7: Suggestion Replacement Offset Consistency
      const initialText = 'In order to test.';
      const suggs = Suggestions.findSuggestions(initialText);
      assert('Suggestion Detection ("in order to")', suggs.length > 0 && suggs[0].replacement === 'to');
      if (suggs.length > 0) {
        const replaced = Suggestions.applySuggestion(initialText, suggs[0]);
        assert('Clean Offset Replacement', replaced === 'To test.');
      }

      // Render test output
      let html = '';
      let passedCount = 0;
      for (const r of results) {
        if (r.passed) passedCount++;
        const statusClass = r.passed ? 'ait-test-pass' : 'ait-test-fail';
        const label = r.passed ? '[PASS]' : '[FAIL]';
        html += `<span class="${statusClass}">${label}</span> ${DiffEngine.escapeHtml(r.name)}<br>`;
      }
      html += `<br><strong>Summary: ${passedCount} of ${results.length} tests passed successfully.</strong>`;
      log.innerHTML = html;
    }

    function init() {
      cacheElements();
      setupEventListeners();
      recordHistory(el.mainInput ? el.mainInput.value : '');
      runLivePipeline();
    }

    return {
      init,
      applySingleSuggestion,
      dismissSuggestion,
      switchTab
    };
  })();

  // Document Ready Initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UI.init);
  } else {
    UI.init();
  }

  return {
    applySingleSuggestion: UI.applySingleSuggestion,
    dismissSuggestion: UI.dismissSuggestion,
    switchTab: UI.switchTab
  };

})();

/* --- END OF FILE text/javascript --- */