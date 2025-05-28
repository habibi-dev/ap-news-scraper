const TelegramBot = require('node-telegram-bot-api');

/**
 * Send photo with caption to Telegram channel
 * @param {string} imageUrl - URL of the image to send
 * @param {string} caption - caption text
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramPhoto(imageUrl, caption) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    console.log("caption", caption);
    try {
        await bot.sendPhoto(
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
        throw error;
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
 * Publish Music article to Telegram with audio file
 * @param {Object} music - The Music object to publish
 * @returns {Promise<Object>} - Result of the publishing operation
 */
async function publishMusicToTelegram(music) {
    const {SIGNATURE} = process.env;
    try {
        // Create a nice looking message
        const caption = `<b>${music.translated_title}</b>\n🎙️ ${music.translated_artist}\n${SIGNATURE}`;

        // Strategy 2: Send photo first, then audio
        if (music.image_url) {
            try {
                await sendTelegramPhoto(music.image_url, caption);
                console.log('Photo sent successfully');
            } catch (error) {
                console.log('Photo sending failed, continuing with audio...');
            }
        }

        // Send audio file
        if (music.mp3_url) {
            const audioOptions = {
                title: music.translated_title,
                performer: music.translated_artist,
                duration: music.duration || undefined,
                thumb: music.image_url || undefined
            };

            await sendTelegramAudio(music.mp3_url, audioOptions);
            console.log('Audio sent successfully');
        }

        console.log(`Published Music to Telegram: ${music.id}`);
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