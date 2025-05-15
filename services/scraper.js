const puppeteer = require('puppeteer');
const {delay} = require('../utils/helpers');
const {config} = require('../config');

/**
 * Extracts news information from a news website
 * @param {string} url - URL of the news website
 * @param {object} selectors - CSS selectors for different elements
 * @param {string} sourceName - Name of the news source
 * @returns {Promise<Array>} - Array of news items
 */
async function scrapeNews(url, selectors = {}, sourceName = '') {
    // Launch browser with settings from config
    const browser = await puppeteer.launch({
        headless: config.browser.headless,
        args: config.browser.args,
        ignoreHTTPSErrors: config.browser.ignoreHTTPSErrors,
    });

    try {
        console.log(`Starting to scrape: ${url}`);
        const page = await browser.newPage();

        // Set up a realistic user agent
        await page.setUserAgent(config.browser.userAgent);

        // Enable JavaScript - important for CloudFlare sites
        await page.setJavaScriptEnabled(true);

        // Set screen size to emulate a regular browser
        await page.setViewport(config.browser.viewport);

        // Add extra headers to look more like a real browser
        await page.setExtraHTTPHeaders(config.browser.headers);

        // Navigate to the page with more flexibility
        try {
            // First try with a longer timeout
            await page.goto(url, {
                waitUntil: 'domcontentloaded', // Less strict than networkidle2
                timeout: 90000 // Increased timeout to 90 seconds
            });
        } catch (error) {
            console.log('Initial navigation attempt failed, trying with basic settings...');
            // If timeout occurs, try again with minimal waiting
            await page.goto(url, {
                waitUntil: 'load', timeout: 120000
            });
        }

        // Wait a bit to ensure dynamic content loads
        await delay(8000);

        // Sometimes there's a CloudFlare challenge page - we need to wait for it to resolve
        await delay(5000);

        // If there's a CAPTCHA or challenge, wait longer for manual intervention
        const pageContent = await page.content();
        if (pageContent.includes('cloudflare') && pageContent.includes('challenge')) {
            console.log('CloudFlare challenge detected. Waiting 30 seconds for manual resolution...');
            await delay(30000);
        }

        console.log('Page loaded, extracting news...');

        // Extract all news items
        const newsItems = await page.evaluate((selectors) => {
            const items = [];
            const newsElements = document.querySelectorAll(selectors.newsContainer);

            newsElements.forEach((element) => {
                // Extract title
                const titleElement = element.querySelector(selectors.title);
                const title = titleElement ? titleElement.textContent.trim() : '';

                // Extract link
                let link = '';
                const linkElement = selectors.link.length ? element.querySelector(selectors.link) : element;
                const relativePath = linkElement ? linkElement.getAttribute('href') : '';
                if (relativePath) link = relativePath.startsWith('http') ? relativePath : new URL(relativePath, window.location.origin).href;

                if (title.length && link.length) items.push({
                    title, link,
                });
            });

            return items;
        }, selectors);

        console.log(`Extracted ${newsItems.length} news items from ${sourceName}`);

        return newsItems.map(news => ({...news, source: sourceName}));
    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Scrape news content from a specific article page
 * @param {string} url - URL of the article
 * @param selectors
 * @returns {Promise<Object>} - Article content with title, image, and text
 */
async function scrapeArticleContent(url, selectors) {
    // Launch browser with settings from config
    const browser = await puppeteer.launch({
        headless: config.browser.headless,
        args: config.browser.args,
        ignoreHTTPSErrors: config.browser.ignoreHTTPSErrors,
    });

    try {
        console.log(`Scraping article content from: ${url}`);
        const page = await browser.newPage();

        // Set up browser settings
        await page.setUserAgent(config.browser.userAgent);
        await page.setJavaScriptEnabled(true);
        await page.setViewport(config.browser.viewport);
        await page.setExtraHTTPHeaders(config.browser.headers);

        // Navigate to the page
        await page.goto(url, {
            waitUntil: 'domcontentloaded', timeout: 90000
        });

        // Wait for content to load
        await delay(5000);

        // Extract article content - common patterns in news sites
        return await page.evaluate((selectors) => {

            //Remove content that is not needed
            document.querySelectorAll(selectors.remove).forEach((element) => element.remove())

            // Try to find the main article content using common selectors
            const articleSelectors = ['article', '.article', '.story', '.story-body', '.post-content', '[itemprop="articleBody"]', '.news-content', '.article-content'];

            let content = '';


            // Find main image
            const image_url = document.querySelector(selectors.image).getAttribute('content')

            const element = document.querySelector(selectors.text);
            if (element) {
                // Remove scripts, ads, and other unnecessary elements
                const clonedElement = element.cloneNode(true);

                // Get just the text content
                content = clonedElement.textContent.trim()
                    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
                    .replace(/\n\s*\n/g, '\n\n'); // Replace multiple newlines with double newline

            }

            return {image_url, content};
        }, selectors);
    } catch (error) {
        console.error('Error scraping article content:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = {
    scrapeNews, scrapeArticleContent
};