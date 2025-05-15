const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { generateHash } = require('../utils/helpers');

// Define status enum
const StatusEnum = {
    PENDING_REVIEW: 'pending_review',
    PENDING_TRANSLATION: 'pending_translation',
    TRANSLATED: 'translated',
    PUBLISHED: 'published',
    REJECTED: 'rejected'
};

let db;

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
async function initDatabase() {
    // Open database connection
    db = await open({
        filename: './news.db',
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS news (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            source TEXT,
            image_url TEXT,
            content TEXT,
            translated_title TEXT,
            translated_content TEXT,
            status TEXT DEFAULT '${StatusEnum.PENDING_REVIEW}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Database initialized');
}

/**
 * Insert a news item into the database
 * @param {Object} newsItem - The news item to insert
 * @returns {Promise<string>} - The ID of the inserted news item
 */
async function insertNewsItem(newsItem) {
    // Generate unique ID based on title and link
    const id = generateHash(newsItem.title + newsItem.link);

    try {
        // Check if news already exists
        const existingNews = await db.get('SELECT id FROM news WHERE id = ?', id);

        if (existingNews) {
            console.log(`News item already exists: ${newsItem.title}`);
            return id;
        }

        // Insert news item
        await db.run(
            'INSERT INTO news (id, title, link, source, status) VALUES (?, ?, ?, ?, ?)',
            [id, newsItem.title, newsItem.link, newsItem.source || '', StatusEnum.PENDING_REVIEW]
        );

        console.log(`Inserted news: ${newsItem.title}`);
        return id;
    } catch (error) {
        console.error('Error inserting news item:', error);
        throw error;
    }
}

/**
 * Update a news item in the database
 * @param {string} id - The ID of the news item to update
 * @param {Object} updates - The fields to update
 * @returns {Promise<void>}
 */
async function updateNewsItem(id, updates) {
    try {
        // Create SET part of SQL query dynamically
        const fields = Object.keys(updates)
            .filter(key => key !== 'id') // Don't update ID
            .map(key => `${key} = ?`);

        const values = Object.keys(updates)
            .filter(key => key !== 'id')
            .map(key => updates[key]);

        // Add updated_at timestamp
        fields.push('updated_at = CURRENT_TIMESTAMP');

        // Execute update
        await db.run(
            `UPDATE news SET ${fields.join(', ')} WHERE id = ?`,
            [...values, id]
        );

        console.log(`Updated news item: ${id}`);
    } catch (error) {
        console.error('Error updating news item:', error);
        throw error;
    }
}

/**
 * Get news items by status
 * @param {string} status - The status to filter by
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of news items
 */
async function getNewsByStatus(status, limit = 100) {
    try {
        const news = await db.all(
            'SELECT * FROM news WHERE status = ? ORDER BY created_at DESC LIMIT ?',
            [status, limit]
        );

        return news;
    } catch (error) {
        console.error('Error getting news by status:', error);
        throw error;
    }
}

/**
 * Get a news item by ID
 * @param {string} id - The ID of the news item
 * @returns {Promise<Object|null>} - The news item or null if not found
 */
async function getNewsById(id) {
    try {
        const news = await db.get('SELECT * FROM news WHERE id = ?', id);
        return news;
    } catch (error) {
        console.error('Error getting news by ID:', error);
        throw error;
    }
}

/**
 * Update news status
 * @param {string} id - The ID of the news item
 * @param {string} status - The new status
 * @returns {Promise<void>}
 */
async function updateNewsStatus(id, status) {
    try {
        await db.run(
            'UPDATE news SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
        );

        console.log(`Updated status for news item ${id} to ${status}`);
    } catch (error) {
        console.error('Error updating news status:', error);
        throw error;
    }
}

module.exports = {
    initDatabase,
    insertNewsItem,
    updateNewsItem,
    getNewsByStatus,
    getNewsById,
    updateNewsStatus,
    StatusEnum
};