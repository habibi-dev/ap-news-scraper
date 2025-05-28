const {scrapeMusic, scrapeArticleContent} = require('./scraper');
const {translateArticle} = require('../api/geminiApi');
const {publishMusicToTelegram} = require('./telegram');
const {
    insertMusicItem,
    updateMusicItem,
    getMusicByStatus,
    updateMusicStatus,
    StatusEnum
} = require('../db/MusicDatabase');
const {config} = require('../config');
const {delay} = require("../utils/helpers");

/**
 * Scrape Music from all sources and store in database
 * @returns {Promise<void>}
 */
async function scrapeAndStoreMusic() {
    try {

        // If source name is provided and not 'all', only scrape that source
        const sourcesToScrape = config.sources;

        // Process each source
        for (const [name, source] of Object.entries(sourcesToScrape)) {
            try {
                console.log(`Scraping ${name} from ${source.url}`);
                const MusicItems = await scrapeMusic(source.url, source.selectors, name);

                // Store each Music item in database
                for (const item of MusicItems) {
                    await insertMusicItem(item);
                }

                console.log(`Completed scraping ${name}: ${MusicItems.length} items`);
            } catch (error) {
                console.error(`Error scraping ${name}:`, error);
                // Continue with next source if one fails
            }
        }

        console.log('Finished scraping all sources');
    } catch (error) {
        console.error('Error in scrapeAndStoreMusic:', error);
        throw error;
    }
}

/**
 * Process Music pending for review
 * @returns {Promise<void>}
 */

/**
 * Process Music waiting for translation
 * @returns {Promise<void>}
 */
async function processTranslationMusic() {
    try {
        // Get Music items waiting for translation
        const translationMusic = await getMusicByStatus(StatusEnum.PENDING_TRANSLATION);
        console.log(`Found ${translationMusic.length} Music items waiting for translation`);

        if (translationMusic.length === 0) {
            console.log('No Music to translate');
            return;
        }

        // Process each Music item
        for (const Music of translationMusic) {
            try {
                console.log(`Processing article: ${Music.id} - ${Music.title}`);

                // Scrape full content if not already present
                if (!Music.mp3_url) {
                    console.log(`Scraping content for ${Music.id} from ${Music.link}`);
                    const articleContent = await scrapeArticleContent(Music.link, config.sources.MrTehran.selectors);

                    // Update Music with content and image
                    await updateMusicItem(Music.id, {
                        mp3_url: articleContent.mp3_url,
                        image_url: articleContent.image_url
                    });

                    // Update the Music object with the scraped content
                    Music.mp3_url = articleContent.mp3_url;
                    Music.image_url = articleContent.image_url;
                }

                // Send to Gemini for translation
                console.log(`Translating article: ${Music.id}`);
                const translation = await translateArticle(Music);

                // Update with translated content
                await updateMusicItem(Music.id, {
                    mp3_url: Music.mp3_url,
                    translated_title: translation.translatedTitle,
                    translated_artist: translation.translatedArtist,
                    status: StatusEnum.TRANSLATED
                });

                console.log(`Completed translation for ${Music.id}`);
            } catch (error) {
                console.error(`Error processing article ${Music.id}:`, error);
                // Continue with next Music item if one fails
            }
        }

        console.log('Completed processing translation Music');
    } catch (error) {
        console.error('Error processing translation Music:', error);
        throw error;
    }
}

function containsKeyword(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}

/**
 * Publish translated Music to Telegram
 * @returns {Promise<void>}
 */
async function publishMusic() {
    try {
        // Get translated Music ready for publishing
        const translatedMusic = await getMusicByStatus(StatusEnum.TRANSLATED);
        console.log(`Found ${translatedMusic.length} translated Music items to publish`);

        if (translatedMusic.length === 0) {
            console.log('No translated Music to publish');
            return;
        }

        // Process each Music item
        for (const Music of translatedMusic) {
            try {
                console.log(`Publishing article: ${Music.id} - ${Music.translated_title}`);

                // Publish to Telegram
                await publishMusicToTelegram(Music);

                // Update status to published
                await updateMusicStatus(Music.id, StatusEnum.PUBLISHED);

                console.log(`Successfully published ${Music.id}`);

            } catch (error) {
                console.error(`Error publishing article ${Music.id}:`, error);
                // Continue with next Music item if one fails
            }
            await delay(3000)
        }

        console.log('Completed publishing Music');
    } catch (error) {
        console.error('Error publishing Music:', error);
        throw error;
    }
}

module.exports = {
    scrapeAndStoreMusic,
    processTranslationMusic,
    publishMusic
};