const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Download file from URL to local filesystem
 * @param {string} url - URL to download
 * @param {string} filename - Local filename to save
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadFile(url, filename) {
    const tempDir = path.join(__dirname, 'temp');

    // Create temp directory if it doesn't exist
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, filename);

    try {
        console.log(`Downloading file from: ${url}`);

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`File downloaded successfully: ${filePath}`);
                resolve(filePath);
            });
            writer.on('error', reject);
        });

    } catch (error) {
        console.error(`Error downloading file from ${url}:`, error.message);
        throw error;
    }
}

/**
 * Delete file from filesystem
 * @param {string} filePath - Path to file to delete
 */
function deleteFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`File deleted: ${filePath}`);
        }
    } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error.message);
    }
}

/**
 * Get file extension from URL
 * @param {string} url - URL to analyze
 * @returns {string} - File extension
 */
function getFileExtension(url) {
    try {
        const urlPath = new URL(url).pathname;
        const extension = path.extname(urlPath);
        return extension || '.tmp';
    } catch (error) {
        return '.tmp';
    }
}

/**
 * Send photo with caption to Telegram channel
 * @param {string} imageUrl - URL of the image to send
 * @param {string} caption - caption text
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramPhoto(imageUrl, caption) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    let localImagePath = null;

    try {
        // Generate unique filename
        const imageId = uuidv4();
        const imageExtension = getFileExtension(imageUrl);
        const imageFilename = `image_${imageId}${imageExtension}`;

        // Download image
        localImagePath = await downloadFile(imageUrl, imageFilename);

        // Send photo using local file
        const result = await bot.sendPhoto(
            TARGET_CHANNEL_ID,
            localImagePath,
            {
                caption: caption,
                parse_mode: 'HTML'
            }
        );

        console.log("Photo sent successfully");
        return result;

    } catch (error) {
        console.error('Error sending Telegram photo:', error.message);
        throw error;
    } finally {
        // Clean up downloaded file
        if (localImagePath) {
            deleteFile(localImagePath);
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

    let localAudioPath = null;
    let localThumbPath = null;

    try {
        // Generate unique filename for audio
        const audioId = uuidv4();
        const audioExtension = getFileExtension(audioUrl);
        const audioFilename = `audio_${audioId}${audioExtension}`;

        // Download audio file
        localAudioPath = await downloadFile(audioUrl, audioFilename);

        const options = {
            parse_mode: 'HTML',
            ...audioOptions
        };

        // Download thumbnail if provided
        if (options.thumb) {
            try {
                const thumbId = uuidv4();
                const thumbExtension = getFileExtension(options.thumb);
                const thumbFilename = `thumb_${thumbId}${thumbExtension}`;

                localThumbPath = await downloadFile(options.thumb, thumbFilename);
                options.thumb = localThumbPath;
            } catch (thumbError) {
                console.log('Failed to download thumbnail, continuing without it:', thumbError.message);
                delete options.thumb;
            }
        }

        const result = await bot.sendAudio(TARGET_CHANNEL_ID, localAudioPath, options);
        console.log("Audio sent successfully");
        return result;

    } catch (error) {
        console.error('Error sending Telegram audio:', error.message);
        throw error;
    } finally {
        // Clean up downloaded files
        if (localAudioPath) {
            deleteFile(localAudioPath);
        }
        if (localThumbPath) {
            deleteFile(localThumbPath);
        }
    }
}

/**
 * Send text message as fallback
 * @param {string} message - Message text
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramMessage(message) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    try {
        return await bot.sendMessage(TARGET_CHANNEL_ID, message, {
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('Error sending Telegram message:', error.message);
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
    let photoSent = false;
    let audioSent = false;

    try {
        // Create a nice looking message
        const caption = `👨‍🎤<b>${music.translated_title}</b>\n\n🎙️ ${music.translated_artist}\n${SIGNATURE}`;

        // Step 1: Send photo with caption
        if (music.image_url) {
            try {
                await sendTelegramPhoto(music.image_url, caption);
                photoSent = true;
                console.log('Photo with caption sent successfully');

                // Wait a moment before sending audio
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.log('Photo sending failed:', error.message);
            }
        }

        // Step 2: Send audio file
        if (music.mp3_url) {
            try {
                const audioOptions = {
                    title: music.translated_title,
                    performer: music.translated_artist,
                    duration: music.duration || undefined,
                    thumb: music.image_url || undefined
                };

                await sendTelegramAudio(music.mp3_url, audioOptions);
                audioSent = true;
                console.log('Audio sent successfully');

            } catch (error) {
                console.log('Audio sending failed:', error.message);
            }
        }

        // If both failed, send as text message
        if (!photoSent && !audioSent) {
            console.log('Both media sending failed, sending as text message');
            const textMessage = `${caption}\n\n🎵 Audio: ${music.mp3_url || 'Not available'}\n🖼️ Image: ${music.image_url || 'Not available'}`;
            await sendTelegramMessage(textMessage);
            console.log('Text message sent as fallback');
        }

        console.log(`Published Music to Telegram: ${music.id}`);
        return {
            success: true,
            photoSent,
            audioSent,
            musicId: music.id
        };

    } catch (error) {
        console.error('Error publishing Music to Telegram:', error);
        throw error;
    }
}

/**
 * Clean up temp directory on startup
 */
function cleanupTempDirectory() {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        try {
            const files = fs.readdirSync(tempDir);
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                fs.unlinkSync(filePath);
            });
            console.log('Temp directory cleaned up');
        } catch (error) {
            console.error('Error cleaning temp directory:', error.message);
        }
    }
}

// Clean up temp directory on startup
cleanupTempDirectory();

module.exports = {
    publishMusicToTelegram,
    sendTelegramPhoto,
    sendTelegramAudio,
    sendTelegramMessage,
    downloadFile,
    cleanupTempDirectory
};