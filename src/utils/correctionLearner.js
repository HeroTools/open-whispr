/**
 * Extracts transcription corrections by diffing original text against
 * the edited field value. Returns corrected words to add to the custom dictionary.
 */

/** Levenshtein edit distance between two strings */
function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** Tokenize text into words, stripping punctuation from edges */
function tokenize(text) {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\w]+|[^\w]+$/g, ""))
    .filter((w) => w.length > 0);
}

/**
 * Find the region in fieldValue that corresponds to the pasted originalText.
 * Returns the matched region (which may have been edited by the user).
 * If the field only contains the pasted text, returns fieldValue as-is.
 */
function findEditedRegion(originalText, fieldValue) {
  // Exact match — field contains only our text (possibly edited)
  if (fieldValue.length <= originalText.length * 1.5) {
    return fieldValue;
  }

  // Field has existing content — find where our text was pasted
  const idx = fieldValue.indexOf(originalText);
  if (idx !== -1) {
    // Original text found verbatim (not yet edited) — no correction to learn
    return originalText;
  }

  // Original text was already edited — find the closest matching region.
  // Use the original text length as a window and slide it across the field value.
  const origWords = tokenize(originalText);
  const fieldWords = tokenize(fieldValue);
  const windowSize = origWords.length;

  if (fieldWords.length <= windowSize) {
    return fieldValue;
  }

  let bestStart = 0;
  let bestScore = -1;

  for (let i = 0; i <= fieldWords.length - windowSize; i++) {
    let matches = 0;
    for (let j = 0; j < windowSize; j++) {
      if (fieldWords[i + j].toLowerCase() === origWords[j].toLowerCase()) {
        matches++;
      }
    }
    if (matches > bestScore) {
      bestScore = matches;
      bestStart = i;
    }
  }

  // Require at least 30% word overlap to consider it a match
  if (bestScore < windowSize * 0.3) {
    return fieldValue;
  }

  return fieldWords.slice(bestStart, bestStart + windowSize).join(" ");
}

/**
 * Compute word-level LCS (Longest Common Subsequence) to find substitutions.
 * Returns pairs of [originalWord, editedWord] for words that were replaced.
 */
function findSubstitutions(origWords, editedWords) {
  const m = origWords.length;
  const n = editedWords.length;

  // LCS table
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1].toLowerCase() === editedWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find aligned pairs
  const aligned = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1].toLowerCase() === editedWords[j - 1].toLowerCase()) {
      aligned.unshift([origWords[i - 1], editedWords[j - 1]]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      aligned.unshift([null, editedWords[j - 1]]);
      j--;
    } else {
      aligned.unshift([origWords[i - 1], null]);
      i--;
    }
  }

  // Extract substitutions: consecutive delete+insert = substitution
  const subs = [];
  for (let k = 0; k < aligned.length - 1; k++) {
    const [origW, editW] = aligned[k];
    const [nextOrigW, nextEditW] = aligned[k + 1];

    // Pattern: [origWord, null] followed by [null, editedWord] = substitution
    if (origW !== null && editW === null && nextOrigW === null && nextEditW !== null) {
      subs.push([origW, nextEditW]);
    }
  }

  return subs;
}

/**
 * Extract corrected words from a user's edits to pasted transcription text.
 *
 * @param {string} originalText - The text that was originally pasted (from transcription)
 * @param {string} fieldValue - The current value of the text field (after user edits)
 * @param {string[]} existingDictionary - Words already in the custom dictionary
 * @returns {string[]} Array of corrected words to add to the dictionary
 */
function extractCorrections(originalText, fieldValue, existingDictionary) {
  if (!originalText || !fieldValue) return [];
  if (originalText === fieldValue) return [];

  const editedRegion = findEditedRegion(originalText, fieldValue);
  if (editedRegion === originalText) return [];

  const origWords = tokenize(originalText);
  const editedWords = tokenize(editedRegion);

  if (origWords.length === 0 || editedWords.length === 0) return [];

  // If more than 50% of words changed, this is a rewrite, not corrections
  const subs = findSubstitutions(origWords, editedWords);
  if (subs.length > origWords.length * 0.5) return [];

  const safeDict = Array.isArray(existingDictionary) ? existingDictionary : [];
  const dictSet = new Set(safeDict.map((w) => w.toLowerCase()));
  const results = [];

  for (const [origWord, correctedWord] of subs) {
    // Skip words already in dictionary
    if (dictSet.has(correctedWord.toLowerCase())) continue;

    // Skip case-only changes
    if (origWord.toLowerCase() === correctedWord.toLowerCase()) continue;

    // Skip very short words (unlikely to benefit from dictionary hints)
    if (correctedWord.length < 3) continue;

    // Skip if edit distance is too large relative to word length — semantic change, not correction.
    // Threshold of 0.65 allows phonetic corrections like "Shunade" → "Sinead" (dist 4/7 = 0.57)
    // while still filtering out completely unrelated word replacements.
    const dist = editDistance(origWord.toLowerCase(), correctedWord.toLowerCase());
    const maxLen = Math.max(origWord.length, correctedWord.length);
    if (dist / maxLen > 0.65) continue;

    results.push(correctedWord);
  }

  return results;
}

module.exports = { extractCorrections };
