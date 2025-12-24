/**
 * Industry-standard text cleanup utility for transcription processing
 * Optimized for performance with batch processing and smart filtering
 */

class TextCleanup {
  // Optimized patterns for transcription cleanup
  static PATTERNS = {
    // Non-verbal artifacts in brackets, parentheses, or asterisks
    nonVerbal: [
      /\[(?:laughter|music|noise|crosstalk|applause|coughing|inaudible|unclear|pause|silence|background|static|beep|mumbling|whispering|breathing|sighing|yawning|typing|footsteps|door|phone|rain|wind|traffic|crowd)\]/gi,
      /\((?:laughter|music|noise|crosstalk|applause|coughing|inaudible|unclear|pause|silence|background|static|beep|mumbling|whispering|breathing|sighing|yawning|typing|footsteps|door|phone|rain|wind|traffic|crowd)\)/gi,
      /\*(?:laughter|music|noise|crosstalk|applause|coughing|inaudible|unclear|pause|silence|background|static|beep|mumbling|whispering|breathing|sighing|yawning|typing|footsteps|door|phone|rain|wind|traffic|crowd)\*/gi,
    ],

    // Speaker labels and metadata
    speakers: [
      /^Speaker\s*\d+:\s*/gim,
      /^\w+:\s*/gm,
      /\[\d{1,2}:\d{2}(:\d{2})?\]/g, // Timestamps
      /\<\d+\.\d+\>/g, // Confidence scores
      /\[SPEAKER_\d+\]/gi,
      /\[MUSIC\]/gi,
      /\[SOUND\]/gi,
    ],

    // Enhanced filler words - industry standard
    fillers: [
      /\b(?:um|uh|er|ah|mm|hmm|mhm)\b\s*/gi, // Hesitation sounds
      /\b(?:like|so|well|right|okay|ok|yeah|yep|yup|sure|alright)\b\s*/gi, // Common discourse markers
      /\b(?:you know|I mean|I guess|sort of|kind of)\b\s*/gi, // Meaningless phrases and uncertainty markers
      /\b(?:maybe|perhaps)\b(?=\s)/gi, // Uncertainty markers (when not essential)
      /\b(?:basically|literally|totally|honestly|obviously|definitely|probably|actually)\b\s*/gi, // Overused intensifiers
      /\bOh,?\s+(?=\w)/gi, // "Oh" when followed by another word (often just filler)
    ],

    // Repetition patterns
    repetitions: [
      /\b(\w+)\s+\1\b/gi, // Doubled words
      /\b(\w+)\s+\1\s+\1\b/gi, // Tripled words
      /\b(\w{2,})\s+\1\s+\1\s+\1\b/gi, // Quadrupled words
      /\b(\w+[-']\w+)\s+\1\b/gi, // Repeated hyphenated/contracted
      /\b([a-z]{1,3})\s+\1\s+\1\b/gi, // Stuttering (short words)
    ],

    // Smart quotes and punctuation normalization
    quotes: [
      /[“”]/g, // Smart quotes to regular quotes
      /[‘’]/g, // Smart apostrophes to regular
      /…/g, // Ellipsis to three periods
    ],

    // Excessive punctuation
    punctuation: [
      /\.{4,}/g, // 4+ periods to ellipsis
      /\.{3}\s*\.+/g, // Ellipsis + more periods
      /\?{2,}/g, // Multiple question marks
      /!{2,}/g, // Multiple exclamation marks
      /,{2,}/g, // Multiple commas
      /;{2,}/g, // Multiple semicolons
      /:{2,}/g, // Multiple colons
      /-{3,}/g, // Long dashes to em-dash
    ],
  };

  // Common contractions and their expansions
  static CONTRACTIONS = {
    "won't": "will not",
    "can't": "cannot",
    "n't": " not",
    "'re": " are",
    "'ve": " have",
    "'ll": " will",
    "'d": " would",
    "'m": " am",
    "'s": " is", // Note: This is ambiguous ('s could be 'is' or possessive)
  };

  // Sentence-ending punctuation
  static SENTENCE_ENDERS = /[.!?]/;

  // Common sentence starters (capitalized words that typically start sentences)
  static SENTENCE_STARTERS =
    /\b(?:The|This|That|These|Those|A|An|I|We|You|They|He|She|It|There|Here|What|When|Where|Why|How|Who|Which|My|Our|Your|Their|His|Her|Its|Some|Many|Most|All|Every|Each|One|Two|First|Second|Next|Then|Now|Today|Yesterday|Tomorrow|After|Before|During|While|Since|Because|Although|However|Therefore|Furthermore|Moreover|Nevertheless|Meanwhile|Finally|Initially|Subsequently|Consequently|Additionally|Specifically|Particularly|Essentially|Actually|Obviously|Clearly|Certainly|Definitely|Probably|Perhaps|Maybe|Sometimes|Often|Usually|Always|Never|Once|Again|Still|Yet|Already|Just|Only|Even|Also|Too|Very|Really|Quite|Rather|Extremely|Completely|Absolutely|Totally|Entirely|Exactly|Precisely|Approximately|About|Around|Nearly|Almost|Especially|Particularly|Generally|Typically|Normally|Usually|Frequently|Occasionally|Rarely|Seldom)\b/;

  /**
   * Main cleanup function - processes text with all cleanup rules
   * @param {string} text - Raw transcription text
   * @param {Object} options - Cleanup options
   * @returns {string} - Cleaned text
   */
  static cleanTranscription(text, options = {}) {
    const {
      removeArtifacts = true,
      normalizeSpaces = true,
      fixPunctuation = true,
      expandContractions = false,
      removeFillers = true,
      removeRepetitions = true,
      capitalizeFirst = true,
      addPeriod = true,
      customFilters = [],
      preserveEmphasis = false,
    } = options;

    if (!text || typeof text !== "string") {
      return "";
    }

    // Start with trimming
    let cleanedText = text.trim();

    // Early return for empty text
    if (!cleanedText) {
      return "";
    }

    // Apply cleanup steps in order of importance
    if (removeArtifacts) {
      cleanedText = this.removeNonVerbalArtifacts(cleanedText);
    }

    if (removeFillers) {
      cleanedText = this.removeFillerWords(cleanedText);
    }

    if (removeRepetitions) {
      cleanedText = this.removeRepeatedWords(cleanedText);
    }

    if (expandContractions) {
      cleanedText = this.expandContractions(cleanedText);
    }

    // Smart sentence reconstruction
    cleanedText = this.reconstructSentences(cleanedText);

    if (fixPunctuation) {
      cleanedText = this.fixPunctuation(cleanedText);
    }

    if (normalizeSpaces) {
      cleanedText = this.normalizeSpaces(cleanedText);
    }

    // Apply custom filters
    if (customFilters.length > 0) {
      cleanedText = this.applyCustomFilters(cleanedText, customFilters);
    }

    // Final formatting
    if (capitalizeFirst) {
      cleanedText = this.capitalizeFirstLetter(cleanedText);
    }

    if (addPeriod) {
      cleanedText = this.ensurePeriod(cleanedText);
    }

    return cleanedText.trim();
  }

  /**
   * Remove non-verbal artifacts and speaker metadata
   * @param {string} text
   * @returns {string}
   */
  static removeNonVerbalArtifacts(text) {
    let cleaned = text;

    // Remove non-verbal artifacts
    this.PATTERNS.nonVerbal.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, " ");
    });

    // Remove speaker artifacts
    this.PATTERNS.speakers.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "");
    });

    return cleaned;
  }

  /**
   * Remove common filler words - enhanced industry standard approach
   * @param {string} text
   * @returns {string}
   */
  static removeFillerWords(text) {
    let cleaned = text;

    // Apply enhanced filler removal patterns
    this.PATTERNS.fillers.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, " ");
    });

    return cleaned;
  }

  /**
   * Remove repeated words - enhanced pattern detection
   * @param {string} text
   * @returns {string}
   */
  static removeRepeatedWords(text) {
    let cleaned = text;

    // Apply all repetition patterns
    this.PATTERNS.repetitions.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, "$1");
    });

    return cleaned;
  }

  /**
   * Expand common contractions
   * @param {string} text
   * @returns {string}
   */
  static expandContractions(text) {
    let expanded = text;

    Object.entries(this.CONTRACTIONS).forEach(([contraction, expansion]) => {
      const regex = new RegExp(contraction.replace(/'/g, "'?"), "gi");
      expanded = expanded.replace(regex, expansion);
    });

    return expanded;
  }

  /**
   * Fix punctuation issues - enhanced industry standard approach
   * @param {string} text
   * @returns {string}
   */
  static fixPunctuation(text) {
    let fixed = text;

    // Normalize smart quotes first
    this.PATTERNS.quotes.forEach((pattern, index) => {
      if (index === 0) {
        fixed = fixed.replace(pattern, '"'); // Smart quotes to regular
      } else if (index === 1) {
        fixed = fixed.replace(pattern, "'"); // Smart apostrophes to regular
      } else if (index === 2) {
        fixed = fixed.replace(pattern, "..."); // Ellipsis to three periods
      }
    });

    // Fix excessive punctuation using patterns
    this.PATTERNS.punctuation.forEach((pattern, index) => {
      if (pattern.toString().includes("{4,}")) {
        fixed = fixed.replace(pattern, "..."); // 4+ periods to ellipsis
      } else if (pattern.toString().includes("\\?{2,}")) {
        fixed = fixed.replace(pattern, "?"); // Multiple ? to single
      } else if (pattern.toString().includes("!{2,}")) {
        fixed = fixed.replace(pattern, "!"); // Multiple ! to single
      } else if (pattern.toString().includes(",{2,}")) {
        fixed = fixed.replace(pattern, ","); // Multiple , to single
      } else if (pattern.toString().includes("-{3,}")) {
        fixed = fixed.replace(pattern, "—"); // Long dashes to em-dash
      } else {
        fixed = fixed.replace(pattern, (match) => match.charAt(0)); // Other multiples to single
      }
    });

    // Fix spacing around punctuation (industry standard)
    fixed = fixed.replace(/\s+([,.!?;:])/g, "$1"); // Remove space before punctuation
    fixed = fixed.replace(/([,.!?;:])\s{2,}/g, "$1 "); // Single space after punctuation
    fixed = fixed.replace(/([.!?])([A-Z])/g, "$1 $2"); // Ensure space after sentence endings

    return fixed;
  }

  /**
   * Smart sentence boundary detection and reconstruction
   * @param {string} text
   * @returns {string}
   */
  static reconstructSentences(text) {
    let cleaned = text;

    // Remove orphaned punctuation and fix spacing issues
    cleaned = this.cleanOrphanedPunctuation(cleaned);

    // Add periods before clear sentence starters (safe approach)
    // Look for: lowercase letter + space + capitalized sentence starter
    cleaned = cleaned.replace(
      /([a-z])\s+(The|This|That|These|Those|I|We|You|They|He|She|It|There|Here|What|When|Where|Why|How|Who|Which|My|Our|Your|Their|His|Her|Its|Then|Now|Today|Yesterday|Tomorrow|After|Before|However|Therefore|Furthermore|Moreover|Nevertheless|Meanwhile|Finally|Initially|Subsequently|Consequently|Additionally)\b/g,
      "$1. $2"
    );

    // Add periods after common sentence endings that don't have punctuation
    // Look for: statement-ending words + space + capitalized word
    cleaned = cleaned.replace(
      /\b(said|asked|replied|answered|explained|stated|mentioned|noted|added|continued|concluded|decided|agreed|disagreed|thought|believed|knew|felt|saw|heard|found|got|went|came|left|started|finished|ended|began|stopped|worked|played|studied|learned|taught|helped|tried|wanted|needed|liked|loved|hated|enjoyed|preferred|expected|hoped|wished|planned|intended|suggested|recommended|proposed|offered|promised|refused|accepted|rejected|approved|denied|confirmed|admitted|confessed|revealed|discovered|realized|understood|remembered|forgot|ignored|avoided|prevented|caused|created|built|made|did|took|gave|received|bought|sold|paid|cost|saved|spent|lost|won|failed|succeeded|improved|changed|increased|decreased|grew|shrank|expanded|reduced|opened|closed|started|stopped|turned|moved|walked|ran|drove|flew|traveled|visited|met|called|wrote|read|watched|listened|talked|spoke|discussed|argued|fought|competed|cooperated|collaborated|participated|contributed|donated|volunteered|organized|managed|led|followed|obeyed|disobeyed|respected|admired|praised|criticized|blamed|thanked|apologized|forgiven|punished|rewarded|celebrated|mourned|worried|relaxed|rested|slept|woke|ate|drank|cooked|cleaned|washed|dressed|exercised|practiced|performed|presented|demonstrated|showed|proved|tested|examined|investigated|researched|studied|analyzed|compared|contrasted|evaluated|judged|rated|scored|measured|counted|calculated|estimated|predicted|forecasted|planned|scheduled|arranged|organized|prepared|completed|accomplished|achieved|reached|attained|obtained|acquired|gained|earned|deserved|qualified|graduated|retired|resigned|quit|joined|entered|exited|arrived|departed|returned|stayed|remained|continued|persisted|persevered|survived|recovered|healed|improved|deteriorated|worsened|died|lived|existed|appeared|disappeared|emerged|vanished|occurred|happened|began|ended|lasted|continued|repeated|resumed)\s+([A-Z])/g,
      "$1. $2"
    );

    // Add periods before obvious new thoughts starting with conjunctions
    cleaned = cleaned.replace(
      /([a-z])\s+(But|And|Or|So|Yet|Still|Also|However|Therefore|Furthermore|Moreover|Nevertheless|Meanwhile|Additionally|Consequently|Subsequently|Similarly|Likewise|Otherwise|Instead|Rather|Indeed|Actually|Obviously|Clearly|Certainly|Definitely|Probably|Perhaps|Maybe|Hopefully|Unfortunately|Fortunately|Interestingly|Surprisingly|Remarkably)\b/g,
      "$1. $2"
    );

    return cleaned;
  }

  /**
   * Clean orphaned punctuation and fix spacing issues
   * @param {string} text
   * @returns {string}
   */
  static cleanOrphanedPunctuation(text) {
    return (
      text
        // Remove multiple consecutive punctuation marks
        .replace(/,{2,}/g, ",") // Multiple commas to single
        .replace(/\.{2,}/g, ".") // Multiple periods to single
        .replace(/;{2,}/g, ";") // Multiple semicolons to single
        .replace(/:{2,}/g, ":") // Multiple colons to single
        .replace(/!{2,}/g, "!") // Multiple exclamations to single
        .replace(/\?{2,}/g, "?") // Multiple questions to single

        // Remove orphaned punctuation combinations
        .replace(/\s*,\s*,/g, ",") // Double commas with spaces
        .replace(/\s*\.\s*\./g, ".") // Double periods with spaces
        .replace(/\s*\.\s*,/g, ".") // Period comma
        .replace(/\s*,\s*\./g, ".") // Comma period
        .replace(/\s*;\s*,/g, ";") // Semicolon comma
        .replace(/\s*,\s*;/g, ";") // Comma semicolon
        .replace(/\s*!\s*,/g, "!") // Exclamation comma
        .replace(/\s*,\s*!/g, "!") // Comma exclamation
        .replace(/\s*\?\s*,/g, "?") // Question comma
        .replace(/\s*,\s*\?/g, "?") // Comma question

        // Remove standalone punctuation with spaces
        .replace(/\s+[.,;:!?]\s*$/g, "") // Trailing orphaned punctuation
        .replace(/^\s*[.,;:!?]\s+/g, "") // Leading orphaned punctuation

        // Fix spacing issues around punctuation
        .replace(/\s+([.,;:!?])/g, "$1") // Remove spaces before punctuation
        .replace(/([.,;:!?])\s{2,}/g, "$1 ")
    ); // Single space after punctuation
  }

  /**
   * Normalize whitespace - public method for minimal cleanup
   * @param {string} text
   * @returns {string}
   */
  static normalizeSpaces(text) {
    if (!text) return "";
    return text
      .replace(/\s+/g, " ") // Multiple spaces to single space
      .replace(/[ 	]+(?=[.,!?;:])/g, "") // Remove spaces before punctuation
      .replace(/\n+/g, " ") // Newlines to spaces
      .replace(/\t+/g, " ") // Tabs to spaces
      .trim();
  }

  /**
   * Apply custom user-defined filters
   * @param {string} text
   * @param {Array} filters - Array of {pattern, replacement} objects
   * @returns {string}
   */
  static applyCustomFilters(text, filters) {
    let filtered = text;

    filters.forEach((filter) => {
      if (filter.pattern && typeof filter.replacement !== "undefined") {
        const regex = new RegExp(filter.pattern, filter.flags || "gi");
        filtered = filtered.replace(regex, filter.replacement);
      }
    });

    return filtered;
  }

  /**
   * Capitalize first letter of text
   * @param {string} text
   * @returns {string}
   */
  static capitalizeFirstLetter(text) {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Ensure text ends with appropriate punctuation
   * @param {string} text
   * @returns {string}
   */
  static ensurePeriod(text) {
    if (!text) return text;

    const trimmed = text.trim();
    const lastChar = trimmed.slice(-1);

    // Don't add period if already has sentence-ending punctuation
    if (this.SENTENCE_ENDERS.test(lastChar)) {
      return trimmed;
    }

    return trimmed + ".";
  }

  /**
   * Batch process multiple texts for better performance
   * @param {Array<string>} texts
   * @param {Object} options
   * @returns {Array<string>}
   */
  static batchClean(texts, options = {}) {
    if (!Array.isArray(texts)) {
      return [];
    }

    // Process in chunks for better memory management
    const chunkSize = options.chunkSize || 100;
    const results = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const cleanedChunk = chunk.map((text) => this.cleanTranscription(text, options));
      results.push(...cleanedChunk);
    }

    return results;
  }

  /**
   * Get performance metrics for cleanup operation
   * @param {string} text
   * @param {Object} options
   * @returns {Object}
   */
  static cleanWithMetrics(text, options = {}) {
    const start = performance.now();
    const originalLength = text.length;

    const cleaned = this.cleanTranscription(text, options);

    const end = performance.now();
    const processingTime = end - start;
    const cleanedLength = cleaned.length;
    const compressionRatio = originalLength > 0 ? cleanedLength / originalLength : 0;

    return {
      cleaned,
      metrics: {
        originalLength,
        cleanedLength,
        compressionRatio,
        processingTime,
        charactersRemoved: originalLength - cleanedLength,
      },
    };
  }
}

export default TextCleanup;
