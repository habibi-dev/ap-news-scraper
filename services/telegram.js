const TelegramBot = require('node-telegram-bot-api');
const {formatDate} = require('../utils/helpers');

/**
 * Send photo with caption to Telegram channel
 * @param {string} imageUrl - URL of the image to send
 * @param {string} caption - caption text
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramPhoto(imageUrl, caption) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    try {
        return await bot.sendPhoto(
            TARGET_CHANNEL_ID,
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
        try {
            return await bot.sendMessage(
                TARGET_CHANNEL_ID,
                caption,
                { parse_mode: 'HTML' }
            );
        } catch (msgError) {
            console.error('Error sending message:', msgError.message);
            throw msgError;
        }
    }
}

/**
 * Send audio file to Telegram channel
 * @param {string} audioUrl - URL of the audio file to send
 * @param {Object} audioOptions - Audio metadata options
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramAudio(audioUrl, audioOptions = {}) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    try {
        const options = {
            parse_mode: 'HTML',
            ...audioOptions
        };

        return await bot.sendAudio(TARGET_CHANNEL_ID, audioUrl, options);
    } catch (error) {
        console.error('Error sending Telegram audio:', error.message);
        throw error;
    }
}

/**
 * Send media group (photo + audio) to Telegram channel
 * @param {string} imageUrl - URL of the image
 * @param {string} audioUrl - URL of the audio file
 * @param {string} caption - Caption for the media group
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramMediaGroup(imageUrl, audioUrl, caption) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    try {
        const media = [
            {
                type: 'photo',
                media: imageUrl,
                caption: caption,
                parse_mode: 'HTML'
            },
            {
                type: 'audio',
                media: audioUrl
            }
        ];

        return await bot.sendMediaGroup(TARGET_CHANNEL_ID, media);
    } catch (error) {
        console.error('Error sending Telegram media group:', error.message);
        throw error;
    }
}

/**
 * Publish Music article to Telegram with audio file
 * @param {Object} music - The Music object to publish
 * @returns {Promise<Object>} - Result of the publishing operation
 */
async function publishMusicToTelegram(music) {
    const {SIGNATURE} = process.env;
    try {
        const formattedDate = formatDate();

        // Create a nice looking message
        const caption = `<b>${music.translated_title}</b>\n\n` +
            `🎙️ ${music.translated_artist}\n\n` +
            `${SIGNATURE}`;

        // Audio metadata for better display
        const audioMetadata = {
            title: music.translated_title,
            performer: music.translated_artist,
            duration: music.duration || undefined,
            thumb: music.image_url || undefined
        };

        let result;
        let photoSent = false;

        // Strategy 1: Send photo first (if available and valid)
        if (music.image_url && music.image_url.trim() !== '') {
            try {
                console.log('Attempting to send photo...');
                await sendTelegramPhoto(music.image_url, caption);
                console.log('Photo sent successfully');
                photoSent = true;
            } catch (error) {
                console.log('Photo sending failed:', error.message);
                photoSent = false;
            }
        }

        // Strategy 2: Send audio file
        if (music.mp3_url && music.mp3_url.trim() !== '') {
            try {
                const audioOptions = {
                    // Only add caption if no photo was sent successfully
                    caption: !photoSent ? caption : undefined,
                    title: music.translated_title,
                    performer: music.translated_artist,
                    duration: music.duration || undefined,
                    thumb: music.image_url || undefined
                };

                console.log('Attempting to send audio...');
                result = await sendTelegramAudio(music.mp3_url, audioOptions);
                console.log('Audio sent successfully');
            } catch (error) {
                console.log('Audio sending failed:', error.message);

                // If both photo and audio failed, send at least the text message
                if (!photoSent) {
                    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
                    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

                    try {
                        result = await bot.sendMessage(
                            TARGET_CHANNEL_ID,
                            caption,
                            { parse_mode: 'HTML' }
                        );
                        console.log('Sent as text message only');
                    } catch (textError) {
                        console.error('Failed to send even text message:', textError.message);
                        throw textError;
                    }
                } else {
                    // Photo was sent, so we're okay
                    console.log('Photo was sent successfully, audio failed but continuing...');
                }
            }
        } else if (!photoSent) {
            // No audio URL and no photo sent, send as text message
            console.log('No audio URL provided, sending as text message...');
            const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
            const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

            result = await bot.sendMessage(
                TARGET_CHANNEL_ID,
                caption,
                { parse_mode: 'HTML' }
            );
        }

        console.log(`Published Music to Telegram: ${music.id}`);
        return result;

    } catch (error) {
        console.error('Error publishing Music to Telegram:', error);
        throw error;
    }
}

module.exports = {
    publishMusicToTelegram,
    sendTelegramPhoto,
    sendTelegramAudio
};