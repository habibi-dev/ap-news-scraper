const puppeteer = require('puppeteer');
const {delay} = require('../utils/helpers');
const {config} = require('../config');

/**
 * Extracts Music information from a Music website
 * @param {string} url - URL of the Music website
 * @param {object} selectors - CSS selectors for different elements
 * @param {string} sourceName - Name of the Music source
 * @returns {Promise<Array>} - Array of Music items
 */
async function scrapeMusic(url, selectors = {}, sourceName = '') {
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

        console.log('Page loaded, extracting Music...');

        // Extract all Music items
        const MusicItems = await page.evaluate((selectors) => {
            const items = [];
            const MusicElements = document.querySelectorAll(selectors.MusicContainer);

            MusicElements.forEach((element) => {
                // Extract title
                const titleElement = element.querySelector(selectors.title);
                const title = titleElement ? titleElement.textContent.trim() : '';

                const artistElement = element.querySelector(selectors.artist);
                const artist = artistElement ? artistElement.textContent.trim() : '';

                // Extract link
                let link = '';
                const linkElement = element.querySelector(selectors.link);
                const relativePath = linkElement ? linkElement.getAttribute('href') : '';
                if (relativePath) link = relativePath.startsWith('http') ? relativePath : new URL(relativePath, window.location.origin).href;

                if (title.length && link.length && artist.length) items.push({
                    title, artist, link,
                });
            });

            return items;
        }, selectors);

        console.log(`Extracted ${MusicItems.length} Music items from ${sourceName}`);

        return MusicItems.map(Music => ({...Music, source: sourceName}));
    } catch (error) {
        console.error('Error during scraping:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Scrape Music content from a specific article page
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

        // Extract article content - common patterns in Music sites
        return await page.evaluate(async (selectors) =>  {
            // Find main image
            const image_url = document.querySelector(selectors.image).getAttribute('src')

            document.querySelector("div.page-detail-actions > button").click()
            await delay(500);
            document.querySelector("div.bottom-sheet-content .bottom-sheet-menu > div:nth-child(4)").click()
            await delay(500);
            const mp3_url = document.querySelector(".texts div:nth-child(4) > a").getAttribute('href')

            return {image_url, mp3_url};
        }, selectors);
    } catch (error) {
        console.error('Error scraping article content:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = {
    scrapeMusic, scrapeArticleContent
};