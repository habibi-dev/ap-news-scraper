const axios = require('axios');
const {config} = require('../config');

/**
 * Send text to Gemini for review or translation
 * @param {string} text - text to process
 * @param {string} prompt - prompt to send to Gemini (review or translation)
 * @returns {Promise<string>} - Response from Gemini
 */
async function processWithGemini(text, prompt) {
    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.gemini.apiKey}`,
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

function cleanAndParseJson(result) {
    try {
        const cleaned = result
            .replace(/^```json\s*/i, '')  // remove opening ```json
            .replace(/\s*```$/, '')       // remove closing ```
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove invisible unicode chars
            .trim();

        return JSON.parse(cleaned);
    } catch (err) {
        console.error("Error parsing JSON:", err.message);
        console.log("Original result:\n", result);
        throw err;
    }
}


/**
 * Send news for review to Gemini
 * @param {Array} newsItems - Array of news items to review
 * @returns {Promise<Object>} - Review results
 */
async function reviewNews(newsItems) {
    try {
        // Extract only title and ID for review
        const reviewData = newsItems.map(item => ({
            id: item.id,
            title: item.title
        }));

        // Convert to JSON string
        const textForReview = JSON.stringify(reviewData, null, 2);

        // Send to Gemini with review prompt
        const result = await processWithGemini(textForReview, config.gemini.reviewPrompt);

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
    let result_backup = null;
    try {
        // Prepare article for translation
        const textForTranslation = JSON.stringify({
            title: article.title,
            content: article.content
        }, null, 2);

        // Send to Gemini with translation prompt
        const result = await processWithGemini(textForTranslation, config.gemini.translationPrompt);

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