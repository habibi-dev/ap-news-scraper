const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

// Constants for file size limits (in bytes)
const TELEGRAM_AUDIO_LIMIT = 50 * 1024 * 1024; // 50MB
const TELEGRAM_DOCUMENT_LIMIT = 2048 * 1024 * 1024; // 2GB

/**
 * Check file size
 * @param {string} filePath - Path to file
 * @returns {number} - File size in bytes
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        console.error(`Error getting file size for ${filePath}:`, error.message);
        return 0;
    }
}

/**
 * Compress audio file using ffmpeg
 * @param {string} inputPath - Input audio file path
 * @param {string} outputPath - Output compressed audio file path
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Path to compressed file
 */
async function compressAudio(inputPath, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Compressing audio: ${inputPath} -> ${outputPath}`);

        const {
            bitrate = '128k',
            format = 'mp3',
            channels = 2,
            sampleRate = 44100
        } = options;

        ffmpeg(inputPath)
            .audioBitrate(bitrate)
            .audioChannels(channels)
            .audioFrequency(sampleRate)
            .format(format)
            .on('start', (commandLine) => {
                console.log('FFmpeg process started:', commandLine);
            })
            .on('progress', (progress) => {
                console.log(`Compression progress: ${Math.round(progress.percent || 0)}%`);
            })
            .on('end', () => {
                console.log('Audio compression completed');
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('FFmpeg compression error:', err.message);
                reject(err);
            })
            .save(outputPath);
    });
}

/**
 * Progressive audio compression to fit size limit
 * @param {string} inputPath - Input audio file path
 * @param {number} targetSize - Target size in bytes
 * @returns {Promise<string>} - Path to compressed file that fits size limit
 */
async function progressiveCompress(inputPath, targetSize = TELEGRAM_AUDIO_LIMIT) {
    const tempDir = path.dirname(inputPath);
    const baseFilename = path.parse(inputPath).name;

    // Compression levels with different bitrates
    const compressionLevels = [
        { bitrate: '192k', suffix: '_192k' },
        { bitrate: '128k', suffix: '_128k' },
        { bitrate: '96k', suffix: '_96k' }
    ];

    for (const level of compressionLevels) {
        const outputPath = path.join(tempDir, `${baseFilename}${level.suffix}.mp3`);

        try {
            await compressAudio(inputPath, outputPath, {
                bitrate: level.bitrate,
                format: 'mp3'
            });

            const compressedSize = getFileSize(outputPath);
            console.log(`Compressed to ${level.bitrate}: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);

            if (compressedSize <= targetSize) {
                console.log(`Successfully compressed to fit size limit with bitrate ${level.bitrate}`);
                return outputPath;
            } else {
                // Delete this version and try next compression level
                deleteFile(outputPath);
            }
        } catch (error) {
            console.error(`Compression failed at ${level.bitrate}:`, error.message);
            continue;
        }
    }

    throw new Error('Unable to compress audio to fit within size limit');
}

/**
 * Send audio as document if too large for audio
 * @param {string} audioPath - Path to audio file
 * @param {Object} audioOptions - Audio metadata options
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramDocument(audioPath, audioOptions = {}) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    try {
        const fileSize = getFileSize(audioPath);
        const filename = path.basename(audioPath);

        const caption = `🎵 <b>${audioOptions.title || 'Audio File'}</b>\n` +
            `🎙️ ${audioOptions.performer || 'Unknown Artist'}\n` +
            `📁 Size: ${(fileSize / 1024 / 1024).toFixed(2)}MB\n` +
            `📎 Sent as document due to size limit`;

        const result = await bot.sendDocument(
            TARGET_CHANNEL_ID,
            audioPath,
            {
                caption: caption,
                parse_mode: 'HTML'
            },
            {
                filename: filename,
                contentType: 'audio/mpeg'
            }
        );

        console.log("Audio sent as document successfully");
        return result;

    } catch (error) {
        console.error('Error sending audio as document:', error.message);
        throw error;
    }
}

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
            timeout: 60000, // Increased timeout for large files
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const fileSize = getFileSize(filePath);
                console.log(`File downloaded successfully: ${filePath} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
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
 * Enhanced send audio file to Telegram channel with compression support
 * @param {string} audioUrl - URL of the audio file to send
 * @param {Object} audioOptions - Audio metadata options
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendTelegramAudio(audioUrl, audioOptions = {}) {
    const {TELEGRAM_BOT_TOKEN, TARGET_CHANNEL_ID} = process.env;
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {polling: false});

    let localAudioPath = null;
    let compressedAudioPath = null;
    let localThumbPath = null;

    try {
        // Generate unique filename for audio
        const audioId = uuidv4();
        const audioExtension = getFileExtension(audioUrl);
        const audioFilename = `audio_${audioId}${audioExtension}`;

        // Download audio file
        localAudioPath = await downloadFile(audioUrl, audioFilename);
        const originalSize = getFileSize(localAudioPath);

        console.log(`Original audio size: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);

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

        let audioToSend = localAudioPath;

        // Check if file is too large for audio and needs compression
        if (originalSize > TELEGRAM_AUDIO_LIMIT) {
            console.log(`Audio file too large (${(originalSize / 1024 / 1024).toFixed(2)}MB), attempting compression...`);

            try {
                compressedAudioPath = await progressiveCompress(localAudioPath, TELEGRAM_AUDIO_LIMIT);
                audioToSend = compressedAudioPath;

                const compressedSize = getFileSize(compressedAudioPath);
                console.log(`Compressed size: ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);

            } catch (compressionError) {
                console.log('Compression failed, trying to send as document:', compressionError.message);

                // If compression fails and file is within document limit, send as document
                if (originalSize <= TELEGRAM_DOCUMENT_LIMIT) {
                    return await sendTelegramDocument(localAudioPath, audioOptions);
                } else {
                    throw new Error(`File too large (${(originalSize / 1024 / 1024).toFixed(2)}MB) for both audio and document limits`);
                }
            }
        }

        // Try to send as audio
        try {
            const result = await bot.sendAudio(TARGET_CHANNEL_ID, audioToSend, options);
            console.log("Audio sent successfully");
            return result;
        } catch (audioError) {
            console.log('Failed to send as audio, trying as document:', audioError.message);

            // Fallback to document if audio sending fails
            const currentSize = getFileSize(audioToSend);
            if (currentSize <= TELEGRAM_DOCUMENT_LIMIT) {
                return await sendTelegramDocument(audioToSend, audioOptions);
            } else {
                throw audioError;
            }
        }

    } catch (error) {
        console.error('Error sending Telegram audio:', error.message);
        throw error;
    } finally {
        // Clean up downloaded files
        if (localAudioPath) {
            deleteFile(localAudioPath);
        }
        if (compressedAudioPath && compressedAudioPath !== localAudioPath) {
            deleteFile(compressedAudioPath);
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
        const caption = `🎵 <b>${music.translated_title}</b>\n\n🎙️ ${music.translated_artist}\n${SIGNATURE}`;

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

        // Step 2: Send audio file with enhanced handling
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
    sendTelegramDocument,
    downloadFile,
    compressAudio,
    progressiveCompress,
    cleanupTempDirectory
};