const {scrapeNews, scrapeArticleContent} = require('./scraper');
const {reviewNews, translateArticle} = require('../api/geminiApi');
const {publishNewsToTelegram} = require('./telegram');
const {
    insertNewsItem,
    updateNewsItem,
    getNewsByStatus,
    updateNewsStatus,
    StatusEnum
} = require('../db/newsDatabase');
const {config} = require('../config');
const {delay} = require("../utils/helpers");

/**
 * Scrape news from all sources and store in database
 * @param {string} sourceName - Optional name of a specific source to scrape
 * @returns {Promise<void>}
 */
async function scrapeAndStoreNews(sourceName = null) {
    try {
        // If sourceName is 'all' or null, scrape all sources
        const shouldScrapeAll = sourceName === null || sourceName === 'all';

        // If source name is provided and not 'all', only scrape that source
        const sourcesToScrape = shouldScrapeAll ?
            config.sources :
            {[sourceName]: config.sources[sourceName]};

        // Check if the source exists when a specific source is requested
        if (!shouldScrapeAll && !config.sources[sourceName]) {
            console.error(`Source "${sourceName}" not found in configuration`);
            console.log('Available sources:', Object.keys(config.sources).join(', '));
            return;
        }

        console.log(`Scraping ${shouldScrapeAll ? 'all sources' : sourceName}...`);

        // Process each source
        for (const [name, source] of Object.entries(sourcesToScrape)) {
            try {
                console.log(`Scraping ${name} from ${source.url}`);
                const newsItems = await scrapeNews(source.url, source.selectors, name);

                // Store each news item in database
                for (const item of newsItems) {
                    await insertNewsItem(item);
                }

                console.log(`Completed scraping ${name}: ${newsItems.length} items`);
            } catch (error) {
                console.error(`Error scraping ${name}:`, error);
                // Continue with next source if one fails
            }
        }

        console.log('Finished scraping all sources');
    } catch (error) {
        console.error('Error in scrapeAndStoreNews:', error);
        throw error;
    }
}

/**
 * Process news pending for review
 * @returns {Promise<void>}
 */
async function processPendingNews() {
    try {
        // Get news items pending review
        const publishedNews = await getNewsByStatus(StatusEnum.PUBLISHED);
        const pendingNews = await getNewsByStatus(StatusEnum.PENDING_REVIEW);
        console.log(`Found ${pendingNews.length} news items pending review`);

        if (pendingNews.length === 0) {
            console.log('No pending news to process');
            return;
        }

        // Create simplified list for Gemini review
        const simplifiedNews = pendingNews.map(news => ({
            id: news.id,
            title: news.title
        }));

        const simplifiedNewsPublished = publishedNews.map(news => ({
            title: news.title
        }));

        console.log('Sending news to Gemini for review...');
        const reviewResults = await reviewNews([...simplifiedNewsPublished, ...simplifiedNews]);
        const accepted = {};
        reviewResults.forEach(result => {
            accepted[result.id] = true;
        });
        // Update news items based on review results
        console.log('Processing review results...');
        for (const result of simplifiedNews) {
            if (accepted.hasOwnProperty(result.id)) {
                await updateNewsStatus(result.id, StatusEnum.PENDING_TRANSLATION);
                console.log(`Approved for translation: ${result.id}`);
            } else {
                await updateNewsStatus(result.id, StatusEnum.REJECTED);
                console.log(`Rejected: ${result.id}`);
            }
        }

        console.log('Completed processing pending news');
    } catch (error) {
        console.error('Error processing pending news:', error);
        throw error;
    }
}

/**
 * Process news waiting for translation
 * @returns {Promise<void>}
 */
async function processTranslationNews() {
    try {
        // Get news items waiting for translation
        const translationNews = await getNewsByStatus(StatusEnum.PENDING_TRANSLATION);
        console.log(`Found ${translationNews.length} news items waiting for translation`);

        if (translationNews.length === 0) {
            console.log('No news to translate');
            return;
        }

        // Process each news item
        for (const news of translationNews) {
            try {
                console.log(`Processing article: ${news.id} - ${news.title}`);

                if (containsKeyword(news.title, config.filters) || (news.content && containsKeyword(news.content, config.filters))) {
                    await updateNewsStatus(news.id, StatusEnum.REJECTED);
                    continue;
                }

                // Scrape full content if not already present
                if (!news.content) {
                    console.log(`Scraping content for ${news.id} from ${news.link}`);
                    const articleContent = await scrapeArticleContent(news.link, config.sources[news.source].selectors);

                    // Update news with content and image
                    await updateNewsItem(news.id, {
                        content: articleContent.content,
                        image_url: articleContent.image_url
                    });

                    // Update the news object with the scraped content
                    news.content = articleContent.content;
                    news.image_url = articleContent.image_url;
                }

                // Send to Gemini for translation
                console.log(`Translating article: ${news.id}`);
                const translation = await translateArticle(news);

                // Update with translated content
                await updateNewsItem(news.id, {
                    content: news.content,
                    translated_title: translation.translatedTitle,
                    translated_content: translation.translatedContent,
                    status: containsKeyword(translation.translatedTitle, config.filters) || containsKeyword(translation.translatedContent, config.filters) ? StatusEnum.REJECTED : StatusEnum.TRANSLATED
                });

                console.log(`Completed translation for ${news.id}`);
            } catch (error) {
                console.error(`Error processing article ${news.id}:`, error);
                // Continue with next news item if one fails
            }
        }

        console.log('Completed processing translation news');
    } catch (error) {
        console.error('Error processing translation news:', error);
        throw error;
    }
}

function containsKeyword(text, keywords) {
    return keywords.some(keyword => text.includes(keyword));
}

/**
 * Publish translated news to Telegram
 * @returns {Promise<void>}
 */
async function publishNews() {
    try {
        // Get translated news ready for publishing
        const translatedNews = await getNewsByStatus(StatusEnum.TRANSLATED);
        console.log(`Found ${translatedNews.length} translated news items to publish`);

        if (translatedNews.length === 0) {
            console.log('No translated news to publish');
            return;
        }

        // Process each news item
        for (const news of translatedNews) {
            try {
                console.log(`Publishing article: ${news.id} - ${news.translated_title}`);

                // Publish to Telegram
                await publishNewsToTelegram(news);

                // Update status to published
                await updateNewsStatus(news.id, StatusEnum.PUBLISHED);

                console.log(`Successfully published ${news.id}`);

            } catch (error) {
                console.error(`Error publishing article ${news.id}:`, error);
                // Continue with next news item if one fails
            }
            await delay(1000)
        }

        console.log('Completed publishing news');
    } catch (error) {
        console.error('Error publishing news:', error);
        throw error;
    }
}

module.exports = {
    scrapeAndStoreNews,
    processPendingNews,
    processTranslationNews,
    publishNews
};