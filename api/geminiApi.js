const axios = require('axios');


/**
 * Send text to Gemini for review or translation
 * @param {string} text - text to process
 * @param {string} prompt - prompt to send to Gemini (review or translation)
 * @returns {Promise<string>} - Response from Gemini
 */
async function processWithGemini(text, prompt) {
    const {GEMINI_API_KEY} = process.env;
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{
                    parts: [{text: prompt + " : " + text}]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 4048
                }
            }
        );

        // Extract the response text from Gemini
        if (response.data &&
            response.data.candidates &&
            response.data.candidates.length > 0 &&
            response.data.candidates[0].content &&
            response.data.candidates[0].content.parts &&
            response.data.candidates[0].content.parts.length > 0) {

            return response.data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Invalid response format from Gemini API');
        }
    } catch (error) {
        console.error('Error processing with Gemini:', error.message);
        if (error.response) {
            console.error('API Response Error:', error.response.data);
        }
        throw error;
    }
}

/**
 * Enhanced JSON parser that handles various problematic characters in Persian/Arabic text
 * while preserving important characters like ZWNJ (Zero Width Non-Joiner)
 * @param {string} result - The JSON string to parse
 * @returns {Object} Parsed JSON object
 */
function cleanAndParseJson(result) {
    try {
        // Remove code block markers if present
        let cleaned = result
            .replace(/^```json\s*/i, '')  // remove opening ```json
            .replace(/\s*```$/, '')       // remove closing ```
            .trim();

        // Fix common BOM (Byte Order Mark) issues at the beginning of the file
        cleaned = cleaned.replace(/^\uFEFF/, '');

        // Handle potential non-standard JSON format issues
        cleaned = cleaned.replace(/^[\s\n\r]*\{/, '{'); // Fix issues at the start of JSON

        // Remove all ASCII control characters (0-31) except allowed ones in JSON (\n, \r, \t)
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // Replace problematic Unicode characters EXCEPT ZWNJ (U+200C) which is important for Persian
        cleaned = cleaned
            // Remove zero-width characters and other invisible characters EXCEPT ZWNJ
            .replace(/[\u200B\u200D-\u200F\uFEFF\u061C]/g, '') // Keeping U+200C (ZWNJ)
            // Replace various types of spaces with standard space
            .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
            // Replace various types of hyphens and dashes with standard hyphen
            .replace(/[\u2010-\u2015\u2212]/g, '-')
            // Replace RTL and LTR marks
            .replace(/[\u202A-\u202E]/g, '');

        // Properly handle newlines in the JSON content
        // First identify if we're dealing with actual newlines in the content
        if (cleaned.includes('\n')) {
            // Check if it's within quotes or not
            const matches = cleaned.match(/"[^"]*(?:\\.[^"]*)*"/g) || [];
            for (const match of matches) {
                if (match.includes('\n')) {
                    const escaped = match.replace(/\n/g, '\\n');
                    cleaned = cleaned.replace(match, escaped);
                }
            }
        }

        // Fix tabs similarly
        cleaned = cleaned.replace(/\t/g, '\\t');

        // Try to parse the JSON directly after basic cleaning
        try {
            return JSON.parse(cleaned);
        } catch (initialErr) {
            // If direct parsing fails, try more aggressive fixes

            // Fix potential unescaped quotes within string values
            cleaned = fixUnescapedQuotes(cleaned);

            // Try parsing again after fixing quotes
            return JSON.parse(cleaned);
        }
    } catch (err) {
        console.error("Error parsing JSON:", err.message);
        console.log("Original result:\n", result);

        // Fallback method if the above cleaning doesn't work
        try {
            // More aggressive cleaning for particularly problematic JSON
            const stripped = stripProblemChars(result);
            console.log("Attempting with more aggressive cleaning...");
            return JSON.parse(stripped);
        } catch (fallbackErr) {
            console.error("Fallback parsing also failed:", fallbackErr.message);

            // One last attempt - try to manually extract the JSON structure
            try {
                const extractedJson = extractValidJson(result);
                console.log("Attempting with manually extracted JSON...");
                return JSON.parse(extractedJson);
            } catch (extractErr) {
                console.error("All parsing methods failed:", extractErr.message);
                throw err; // Throw the original error
            }
        }
    }
}

/**
 * Fix potential unescaped quotes within JSON strings
 * @param {string} jsonString - The JSON string to fix
 * @returns {string} Fixed JSON string
 */
function fixUnescapedQuotes(jsonString) {
    // More robust approach to handle quotes within strings
    let inString = false;
    let result = '';
    let i = 0;

    while (i < jsonString.length) {
        const char = jsonString[i];

        if (char === '"') {
            // Check if this quote is escaped
            let isEscaped = false;
            let j = i - 1;
            let backslashCount = 0;

            // Count preceding backslashes
            while (j >= 0 && jsonString[j] === '\\') {
                backslashCount++;
                j--;
            }

            // An odd number of backslashes means the quote is escaped
            isEscaped = backslashCount % 2 === 1;

            if (!isEscaped) {
                inString = !inString;
            }
        }

        // If inside a string and we encounter a quote that's not properly escaped
        if (inString && char === '"' && i > 0 && jsonString[i-1] !== '\\' &&
            (i < 2 || (i >= 2 && jsonString[i-2] !== '\\' && jsonString[i-1] === '\\'))) {
            // This is an unescaped quote within a string - escape it
            result += '\\' + char;
        } else {
            result += char;
        }

        i++;
    }

    return result;
}

/**
 * A more aggressive approach to strip problematic characters
 * @param {string} jsonStr - The JSON string to clean
 * @returns {string} Cleaned JSON string
 */
function stripProblemChars(jsonStr) {
    // Remove code block markers
    let cleaned = jsonStr
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    // Fix BOM and initial whitespace issues
    cleaned = cleaned.replace(/^\uFEFF/, '').replace(/^[\s\n\r]*\{/, '{');

    // Try to extract the JSON contents if we can identify the structure
    const jsonMatch = cleaned.match(/\{\s*".*"\s*:\s*".*"\s*(?:,\s*".*"\s*:\s*".*"\s*)*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }

    // Replace any non-printable or control characters with empty string
    // Excluding allowed JSON control characters and ZWNJ (U+200C)
    cleaned = cleaned.replace(/[^\x20-\x7E\n\r\t\u200C]/g, '');

    // Ensure proper handling of newlines
    cleaned = cleaned.replace(/\\n/g, '\\n').replace(/\n/g, '\\n');

    return cleaned;
}

/**
 * Attempt to extract valid JSON from a potentially malformed string
 * @param {string} rawInput - The raw input string
 * @returns {string} Extracted JSON string
 */
function extractValidJson(rawInput) {
    // Remove code block markers and trim
    let input = rawInput
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    // Find the starting and ending braces for objects or brackets for arrays
    const firstBrace = input.indexOf('{');
    const lastBrace = input.lastIndexOf('}');
    const firstBracket = input.indexOf('[');
    const lastBracket = input.lastIndexOf(']');

    let start, end;

    // Determine if we're dealing with an object or array
    if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        // It's an object
        start = firstBrace;
        end = lastBrace + 1;
    } else if (firstBracket !== -1 && lastBracket !== -1) {
        // It's an array
        start = firstBracket;
        end = lastBracket + 1;
    } else {
        throw new Error("Could not find valid JSON structure");
    }

    // Extract the JSON part
    let jsonCandidate = input.substring(start, end);

    // Clean up the extracted JSON
    jsonCandidate = jsonCandidate
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control chars
        .replace(/[\u200B\u200D-\u200F\uFEFF\u061C]/g, '')  // Remove zero-width chars but keep ZWNJ (U+200C)
        .replace(/\n/g, '\\n')                        // Escape newlines
        .replace(/\t/g, '\\t');                       // Escape tabs

    return jsonCandidate;
}


/**
 * Send Music for review to Gemini
 * @param {Array} MusicItems - Array of Music items to review
 * @returns {Promise<Object>} - Review results
 */
async function reviewMusic(MusicItems) {
    const {GEMINI_PROMPT_REVIEW} = process.env;
    try {
        // Extract only title and ID for review
        const reviewData = MusicItems.map(item => ({
            id: item.id,
            title: item.title
        }));

        // Convert to JSON string
        const textForReview = JSON.stringify(reviewData, null, 2);

        // Send to Gemini with review prompt
        const result = await processWithGemini(textForReview, GEMINI_PROMPT_REVIEW);

        // Parse the JSON response from Gemini
        return cleanAndParseJson(result);
    } catch (error) {
        console.error('Error reviewing Music:', error);
        throw error;
    }
}

/**
 * Translate a Music article using Gemini
 * @param {Object} article - Article to translate
 * @returns {Promise<Object>} - Translated article
 */
async function translateArticle(article) {
    const {GEMINI_PROMPT_TRANSLATE} = process.env;
    let result_backup = null;
    try {
        // Prepare article for translation
        const textForTranslation = JSON.stringify({
            title: article.title,
            artist: article.artist
        }, null, 2);

        // Send to Gemini with translation prompt
        const result = await processWithGemini(textForTranslation, GEMINI_PROMPT_TRANSLATE);

        result_backup = result;
        // Parse the JSON response from Gemini
        // Expecting a format like: {"translatedTitle": "...", "translatedContent": "..."}
        return cleanAndParseJson(result);
    } catch (error) {
        console.error('Error translating article:', error);
        throw error;
    }
}

module.exports = {
    reviewMusic,
    translateArticle
};