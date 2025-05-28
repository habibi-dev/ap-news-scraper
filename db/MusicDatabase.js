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
        filename: './music.db',
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS music (
                                            id TEXT PRIMARY KEY,
                                            title TEXT NOT NULL,
                                            artist TEXT NOT NULL,
                                            link TEXT NOT NULL,
                                            image_url TEXT,
                                            mp3_url TEXT,
                                            translated_title TEXT,
                                            translated_artist TEXT,
                                            status TEXT DEFAULT '${StatusEnum.PENDING_REVIEW}',
                                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('Database initialized');
}

/**
 * Insert a music item into the database
 * @param {Object} musicItem - The music item to insert
 * @returns {Promise<string>} - The ID of the inserted music item
 */
async function insertMusicItem(musicItem) {
    // Generate unique ID based on title and link
    const id = generateHash(musicItem.title + musicItem.link);

    try {
        // Check if music already exists
        const existingMusic = await db.get('SELECT id FROM music WHERE id = ?', id);

        if (existingMusic) {
            console.log(`Music item already exists: ${musicItem.title}`);
            return id;
        }

        // Insert music item
        await db.run(
            'INSERT INTO music (id, title, link, artist, status) VALUES (?, ?, ?, ?, ?)',
            [id, musicItem.title, musicItem.link, musicItem.artist, StatusEnum.PENDING_TRANSLATION]
        );

        console.log(`Inserted music: ${musicItem.title}`);
        return id;
    } catch (error) {
        console.error('Error inserting music item:', error);
        throw error;
    }
}

/**
 * Update a music item in the database
 * @param {string} id - The ID of the music item to update
 * @param {Object} updates - The fields to update
 * @returns {Promise<void>}
 */
async function updateMusicItem(id, updates) {
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
            `UPDATE music SET ${fields.join(', ')} WHERE id = ?`,
            [...values, id]
        );

        console.log(`Updated music item: ${id}`);
    } catch (error) {
        console.error('Error updating music item:', error);
        throw error;
    }
}

/**
 * Get music items by status
 * @param {string} status - The status to filter by
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} - Array of music items
 */
async function getMusicByStatus(status, limit = 100) {
    try {
        return await db.all(
            'SELECT * FROM music WHERE status = ? ORDER BY created_at DESC LIMIT ?',
            [status, limit]
        );
    } catch (error) {
        console.error('Error getting music by status:', error);
        throw error;
    }
}

async function getMusicByStatusInLast24Hours(status, limit = 100) {
    try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        return await db.all(
            'SELECT * FROM music WHERE status = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?',
            [status, oneDayAgo, limit]
        );
    } catch (error) {
        console.error('Error getting music from last 24 hours by status:', error);
        throw error;
    }
}


/**
 * Get a music item by ID
 * @param {string} id - The ID of the music item
 * @returns {Promise<Object|null>} - The music item or null if not found
 */
async function getMusicById(id) {
    try {
        return await db.get('SELECT * FROM music WHERE id = ?', id);
    } catch (error) {
        console.error('Error getting music by ID:', error);
        throw error;
    }
}

/**
 * Update music status
 * @param {string} id - The ID of the music item
 * @param {string} status - The new status
 * @returns {Promise<void>}
 */
async function updateMusicStatus(id, status) {
    try {
        await db.run(
            'UPDATE music SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, id]
        );

        console.log(`Updated status for music item ${id} to ${status}`);
    } catch (error) {
        console.error('Error updating music status:', error);
        throw error;
    }
}

/**
 * Keep only the latest 10,000 records and delete the rest
 * @returns {Promise<number>} - Number of deleted records
 */
async function cleanupOldRecords() {
    try {
        // Get the created_at timestamp of the 10,000th record
        const result = await db.get(`
            SELECT created_at FROM music 
            ORDER BY created_at DESC 
            LIMIT 1 OFFSET 9999
        `);

        // If we have less than 10,000 records, no cleanup needed
        if (!result) {
            console.log('Less than 10,000 records found, no cleanup needed');
            return 0;
        }

        // Delete records older than the cutoff timestamp
        const { changes } = await db.run(`
            DELETE FROM music 
            WHERE created_at < ?
        `, [result.created_at]);

        console.log(`Deleted ${changes} old music records`);
        return changes;
    } catch (error) {
        console.error('Error cleaning up old records:', error);
        throw error;
    }
}

module.exports = {
    initDatabase,
    insertMusicItem,
    updateMusicItem,
    getMusicByStatus,
    getMusicById,
    updateMusicStatus,
    cleanupOldRecords,
    getMusicByStatusInLast24Hours,
    StatusEnum
};