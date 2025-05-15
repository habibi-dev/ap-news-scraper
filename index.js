const {initDatabase} = require('./db/newsDatabase');
const {scrapeAndStoreNews, processPendingNews, processTranslationNews, publishNews} = require('./services/newsService');
require('dotenv').config();

/**
 * Main function to run the application
 */
async function main() {
    try {
        // Initialize database
        await initDatabase();

        // Define the command line arguments and run appropriate function
        const command = process.argv[2];

        switch (command) {
            case 'read':
                // Scrape all news sources and store them in database
                const sourceName = process.argv[3];
                await scrapeAndStoreNews(sourceName);
                break;

            case 'pending':
                // Get pending news for review and send to Gemini
                await processPendingNews();
                break;

            case 'translate':
                // Process news waiting for translation
                await processTranslationNews();
                break;

            case 'publish':
                // Publish translated news to Telegram
                await publishNews();
                break;

            default:
                console.log('Available commands:');
                console.log('  read [sourceName] - Scrape news from sources');
                console.log('  pending - Process news pending for review');
                console.log('  translate - Process news waiting for translation');
                console.log('  publish - Publish translated news to Telegram');
        }
    } catch (error) {
        console.error('Application error:', error);
    }
}

// Run the script
if (require.main === module) {
    main().then(() => {
        console.log('Completed execution');
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}