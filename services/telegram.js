const TelegramBot = require('node-telegram-bot-api');
const {config} = require('../config');
const {formatDate} = require('../utils/helpers');
const {SIGNATURE} = process.env;

// Initialize the bot with token
const bot = new TelegramBot(config.telegram.botToken, {polling: false});

/**
 * Send message to Telegram channel
 * @param {string} message - message to send
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramMessage(message) {
    try {
        return await bot.sendMessage(
            config.telegram.channelId,
            message,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: false
            }
        );
    } catch (error) {
        console.error('Error sending Telegram message:', error.message);
        throw error;
    }
}

/**
 * Send photo with caption to Telegram channel
 * @param {string} imageUrl - URL of the image to send
 * @param {string} caption - caption text
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramPhoto(imageUrl, caption) {
    try {
        return await bot.sendPhoto(
            config.telegram.channelId,
            imageUrl,
            {
                caption: caption,
                parse_mode: 'HTML'
            }
        );
    } catch (error) {
        console.error('Error sending Telegram photo:', error.message);

        // If photo sending fails, try sending as a message
        console.log('Attempting to send as message instead...');
        return sendTelegramMessage(`${caption}\n\n<a href="${imageUrl}">تصویر خبر</a>`);
    }
}

/**
 * Publish news article to Telegram
 * @param {Object} article - The news article to publish
 * @returns {Promise<Object>} - Result of the publishing operation
 */
async function publishNewsToTelegram(article) {
    try {
        const formattedDate = formatDate();

        // Create a nice looking message
        const caption = `<b>${article.translated_title}</b>\n\n` +
            `${article.translated_content.substring(0, 1000)}${article.translated_content.length > 1000 ? '...' : ''}\n\n` +
            `⏰ ${formattedDate}\n` +
            `{SIGNATURE}`;

        let result;

        // Send with image if available
        if (article.image_url) {
            result = await sendTelegramPhoto(article.image_url, caption);
        } else {
            result = await sendTelegramMessage(caption);
        }

        console.log(`Published news to Telegram: ${article.id}`);
        return result;
    } catch (error) {
        console.error('Error publishing news to Telegram:', error);
        throw error;
    }
}

module.exports = {
    sendTelegramMessage,
    sendTelegramPhoto,
    publishNewsToTelegram
};