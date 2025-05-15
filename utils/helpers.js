/**
 * Helper function to create a delay
 * @param {number} ms - milliseconds to delay
 * @returns {Promise} - resolves after the specified time
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a hash for text to use as identifier
 * @param {string} text - text to hash
 * @returns {string} - hash string
 */
function generateHash(text) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Format date to a human-readable string
 * @param {Date} date - date object
 * @returns {string} - formatted date string
 */
function formatDate(date = new Date()) {
    return date.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

module.exports = {
    delay,
    generateHash,
    formatDate
};