#!/usr/bin/env node
/**
 * patch-matcher.js — makes Consent-O-Matic's text matching language-tolerant.
 *
 * WHY THIS EXISTS
 * ---------------
 * Consent-O-Matic is a git submodule, so we can't edit it directly without our
 * changes being blown away on the next `git submodule update`. This script
 * re-applies our patch at build time and is idempotent (safe to run repeatedly).
 *
 * THE BUG IT FIXES
 * ----------------
 * Tools.findElement() filters candidate elements with `textFilter`, doing a
 * naive lowercase substring compare:
 *
 *     textContent.toLowerCase().indexOf(text.toLowerCase()) !== -1
 *
 * That silently fails on non-English banners for three reasons:
 *
 *   1. ACCENTS — a rule says "Funzionalità" but the page (or a different
 *      Unicode normalisation form) renders "Funzionalita"/decomposed NFD.
 *      Byte-wise these differ, so the match fails.
 *   2. APOSTROPHES — the bundled Italian rules contain a CURLY apostrophe
 *      (U+2019), e.g. "Miglioramento dell’esperienza". Sites frequently emit a
 *      STRAIGHT quote ('). One character difference = no match = banner ignored.
 *   3. WHITESPACE — non-breaking spaces (U+00A0) are common in European
 *      layouts and never equal a plain space.
 *
 * There are 679 textFilter occurrences across the 207 bundled CMP rules, so
 * this affects every non-English locale, not just Italian.
 *
 * THE FIX
 * -------
 * Normalise BOTH sides of the comparison before matching:
 *   - Unicode NFKD + strip combining marks  (à -> a)
 *   - unify quotes/apostrophes/dashes       (’ -> ')
 *   - collapse all whitespace incl. NBSP
 *
 * This only ever makes matching MORE permissive, so it cannot cause a
 * previously-working English rule to stop matching.
 */

const fs = require('fs');
const path = require('path');

const toolsPath = path.resolve(
  __dirname, '..', 'Consent-O-Matic', 'Extension', 'Tools.js'
);

const MARKER = '__ccNormalizeText';

const HELPER = `
    /**
     * Crumb Control: normalise text for language-tolerant matching.
     * Strips accents, unifies punctuation and collapses whitespace so rules
     * written in one locale still match banners rendered in another.
     */
    static ${MARKER}(str) {
        if (str == null) return "";
        return String(str)
            .normalize("NFKD")
            // strip combining diacritics: à -> a, ü -> u, ç -> c
            .replace(/[\\u0300-\\u036f]/g, "")
            // curly/typographic apostrophes + quotes -> straight
            .replace(/[\\u2018\\u2019\\u201A\\u201B\\u2032\\u00B4\\u0060]/g, "'")
            .replace(/[\\u201C\\u201D\\u201E\\u201F\\u2033]/g, '"')
            // dashes -> hyphen
            .replace(/[\\u2010-\\u2015\\u2212]/g, "-")
            // any whitespace (incl. NBSP U+00A0) -> single space
            .replace(/[\\s\\u00a0\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000]+/g, " ")
            .trim()
            .toLowerCase();
    }
`;

const OLD_BLOCK = `        if (options.textFilter != null) {
            let filterMultipleSpacesRegex = /\\s{2,}/gm;

            possibleTargets = possibleTargets.filter((possibleTarget) => {
                let textContent = possibleTarget.textContent.toLowerCase().replace(filterMultipleSpacesRegex, " ");

                if (Array.isArray(options.textFilter)) {
                    let foundText = false;

                    for (let text of options.textFilter) {
                        if (textContent.indexOf(text.toLowerCase().replace(filterMultipleSpacesRegex, " ")) !== -1) {
                            foundText = true;
                            break;
                        }
                    }

                    return foundText;
                } else if (options.textFilter != null) {
                    return textContent.indexOf(options.textFilter.toLowerCase()) !== -1;
                }
            });
        }`;

const NEW_BLOCK = `        if (options.textFilter != null) {
            possibleTargets = possibleTargets.filter((possibleTarget) => {
                // Crumb Control: accent/punctuation/whitespace-insensitive match
                let textContent = Tools.${MARKER}(possibleTarget.textContent);

                if (Array.isArray(options.textFilter)) {
                    let foundText = false;

                    for (let text of options.textFilter) {
                        if (textContent.indexOf(Tools.${MARKER}(text)) !== -1) {
                            foundText = true;
                            break;
                        }
                    }

                    return foundText;
                } else if (options.textFilter != null) {
                    return textContent.indexOf(Tools.${MARKER}(options.textFilter)) !== -1;
                }
            });
        }`;

function main() {
  if (!fs.existsSync(toolsPath)) {
    console.error(`patch-matcher: Tools.js not found at ${toolsPath}`);
    console.error('patch-matcher: did you run `git submodule update --init`?');
    process.exit(1);
  }

  let src = fs.readFileSync(toolsPath, 'utf8');

  if (src.includes(MARKER)) {
    console.log('patch-matcher: already applied, skipping');
    return;
  }

  if (!src.includes(OLD_BLOCK)) {
    console.error(
      'patch-matcher: FAILED — the textFilter block in Tools.js does not match\n' +
      'what this patch expects. Upstream Consent-O-Matic has changed.\n' +
      'Re-check Tools.findElement() and update scripts/patch-matcher.js.'
    );
    process.exit(1);
  }

  // 1. swap in the normalising comparison
  src = src.replace(OLD_BLOCK, NEW_BLOCK);

  // 2. inject the helper as the first member of the Tools class
  const anchor = 'export default class Tools {';
  if (!src.includes(anchor)) {
    console.error('patch-matcher: FAILED — could not find Tools class declaration');
    process.exit(1);
  }
  src = src.replace(anchor, anchor + '\n' + HELPER);

  fs.writeFileSync(toolsPath, src);
  console.log('patch-matcher: applied language-tolerant text matching to Tools.js');
}

main();
