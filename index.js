const {initDatabase, cleanupOldRecords} = require('./db/MusicDatabase');
const {scrapeAndStoreMusic, processTranslationMusic, publishMusic} = require('./services/MusicService');
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
                await scrapeAndStoreMusic();
                break;

            case 'translate':
                // Process Music waiting for translation
                await processTranslationMusic();
                break;

            case 'publish':
                // Publish translated Music to Telegram
                await publishMusic();
                break;

            case 'clear':
                // Publish translated Music to Telegram
                await cleanupOldRecords();
                break;

            default:
                console.log('Available commands:');
                console.log('  read [sourceName] - Scrape Music from sources');
                console.log('  translate - Process Music waiting for translation');
                console.log('  publish - Publish translated Music to Telegram');
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