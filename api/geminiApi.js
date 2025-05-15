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

        // Remove all ASCII control characters (0-31) except allowed ones in JSON (\n, \r, \t)
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // Replace problematic Unicode characters
        cleaned = cleaned
            // Remove zero-width characters and other invisible characters
            .replace(/[\u200B-\u200F\uFEFF\u061C]/g, '')
            // Replace various types of spaces with standard space
            .replace(/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
            // Replace various types of hyphens and dashes with standard hyphen
            .replace(/[\u2010-\u2015\u2212]/g, '-')
            // Replace RTL and LTR marks
            .replace(/[\u202A-\u202E]/g, '');

        // Handle line breaks and properly escape them
        cleaned = cleaned
            .replace(/\r\n/g, '\\n')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t');

        // Fix potential unescaped quotes within string values
        // This is a simplistic approach - a more robust solution would be context-aware
        cleaned = fixUnescapedQuotes(cleaned);

        return JSON.parse(cleaned);
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
            throw err; // Throw the original error
        }
    }
}

/**
 * Fix potential unescaped quotes within JSON strings
 * This is a simplified approach and might not work for complex nested structures
 * @param {string} jsonString - The JSON string to fix
 * @returns {string} Fixed JSON string
 */
function fixUnescapedQuotes(jsonString) {
    // This is a simplified approach - would need more context awareness for complex JSON
    let inString = false;
    let result = '';
    let prevChar = '';

    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString[i];

        if (char === '"' && prevChar !== '\\') {
            inString = !inString;
        }

        if (inString && char === '"' && prevChar !== '\\') {
            result += '\\' + char;
        } else {
            result += char;
        }

        prevChar = char;
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

    // Try to extract the JSON contents if we can identify the structure
    const jsonMatch = cleaned.match(/\{\s*".*"\s*:\s*".*"\s*(?:,\s*".*"\s*:\s*".*"\s*)*\}/);
    if (jsonMatch) {
        cleaned = jsonMatch[0];
    }

    // Replace any non-printable or control characters with empty string
    // Excluding allowed JSON control characters
    return cleaned.replace(/[^\x20-\x7E\n\r\t]/g, '');
}


/**
 * Send news for review to Gemini
 * @param {Array} newsItems - Array of news items to review
 * @returns {Promise<Object>} - Review results
 */
async function reviewNews(newsItems) {
    const {GEMINI_PROMPT_REVIEW} = process.env;
    try {
        // Extract only title and ID for review
        const reviewData = newsItems.map(item => ({
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
        console.error('Error reviewing news:', error);
        throw error;
    }
}

/**
 * Translate a news article using Gemini
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
            content: article.content
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
    reviewNews,
    translateArticle
};