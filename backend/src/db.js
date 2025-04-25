const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db;

/**
 * Initializes the SQLite database connection and creates tables if they don't exist.
 */
async function initDatabase() {
  // Avoid re-initializing if db is already open
  if (db) return; 
  
  try {
    console.log('Initializing database connection...');
    db = await open({
      filename: '/data/emails.db', // Creates or opens emails.db in the backend directory
      driver: sqlite3.Database
    });

    console.log('Ensuring database tables exist...');
    // Create emails table to store metadata and content
    await db.exec(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        messageId TEXT UNIQUE, -- Added UNIQUE constraint
        user TEXT NOT NULL,
        folder TEXT NOT NULL,
        filename TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        subject TEXT,
        date TEXT,
        html TEXT,
        text TEXT,
        timestamp INTEGER -- Store date as Unix timestamp for sorting
      );
    `);

    // Create FTS5 virtual table for full-text search
    await db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS email_search USING fts5(
        id UNINDEXED, -- Link to emails table, unindexed for performance
        messageId,
        user,
        folder,
        from_address,
        to_address,
        subject,
        text,
        content='emails', -- Specify content table
        content_rowid='id' -- Specify rowid column in content table
      );
    `);

    // Trigger to keep FTS table synchronized with emails table
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
        INSERT INTO email_search (rowid, messageId, user, folder, from_address, to_address, subject, text)
        VALUES (new.id, new.messageId, new.user, new.folder, new.from_address, new.to_address, new.subject, new.text);
      END;
    `);
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
        DELETE FROM email_search WHERE rowid=old.id;
      END;
    `);
    await db.exec(`
      CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
        UPDATE email_search SET 
          messageId = new.messageId, 
          user = new.user, 
          folder = new.folder, 
          from_address = new.from_address, 
          to_address = new.to_address, 
          subject = new.subject, 
          text = new.text
        WHERE rowid=old.id;
      END;
    `);

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err; // Re-throw error to be caught by caller or exit process
  }
}

/**
 * Clears all data from the email tables.
 */
async function clearEmails() {
  if (!db) await initDatabase();
  try {
    await db.exec('DELETE FROM emails');
    // FTS table is cleared automatically by the trigger on DELETE FROM emails
    // If triggers weren't used: await db.exec('DELETE FROM email_search'); 
    console.log('Email tables cleared');
  } catch (err) {
    console.error('Failed to clear email tables:', err);
    throw err;
  }
}

/**
 * Inserts a single parsed email into the database.
 * @param {object} email - Parsed email data.
 */
async function insertEmail(email) {
  if (!db) await initDatabase();
  try {
    // Use INSERT OR IGNORE to avoid errors if messageId is duplicate
    const result = await db.run(
      `INSERT OR IGNORE INTO emails (
        messageId, user, folder, filename, from_address, to_address,
        subject, date, html, text, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email.messageId || `missing-${Date.now()}-${Math.random()}`, // Ensure messageId is unique
        email.user,
        email.folder,
        email.filename,
        email.fromAddress,
        email.toAddress,
        email.subject,
        email.date, // Store as ISO string
        email.html,
        email.text,
        email.timestamp // Store as Unix timestamp
      ]
    );
    // Note: FTS insertion is handled by the trigger now
    return result.lastID; // Returns ID of inserted row, or 0 if ignored
  } catch (err) {
    console.error(`Failed to insert email ${email.filename}:`, err);
    throw err;
  }
}

/**
 * Retrieves emails with filtering, searching, and pagination.
 * @param {object} options - Filtering and pagination options.
 * @param {string} [options.user] - Filter by user.
 * G* @param {string} [options.folder] - Filter by folder.
 * @param {string} [options.search] - Search term for full-text search.
 * @param {number} [options.page=1] - Page number.
 * @param {number} [options.limit=50] - Results per page.
 */
async function getEmails({ user, folder, search, page = 1, limit = 50 }) {
  if (!db) await initDatabase();
  
  const offset = (page - 1) * limit;
  let baseQuery = `SELECT emails.* FROM emails `;
  let countQuery = `SELECT COUNT(emails.id) as total FROM emails `;
  let whereClauses = [];
  const params = [];
  const countParams = [];

  if (search && search.trim()) {
    // If searching, join with FTS table
    baseQuery += ` JOIN email_search ON emails.id = email_search.rowid `;
    countQuery += ` JOIN email_search ON emails.id = email_search.rowid `;
    whereClauses.push(`email_search MATCH ?`);
    const searchTerm = search.trim(); // Use the cleaned search term
    params.push(searchTerm);
    countParams.push(searchTerm);
  }

  // Add user/folder filters
  if (user) {
    whereClauses.push(`emails.user = ?`);
    params.push(user);
    countParams.push(user);
  }
  if (folder) {
    whereClauses.push(`emails.folder = ?`);
    params.push(folder);
    countParams.push(folder);
  }

  // Combine WHERE clauses
  if (whereClauses.length > 0) {
    const whereString = ` WHERE ${whereClauses.join(' AND ')}`;
    baseQuery += whereString;
    countQuery += whereString;
  }

  // Add ordering, limit, and offset for pagination
  baseQuery += ' ORDER BY emails.timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    // Execute both queries
    const [emails, countResult] = await Promise.all([
        db.all(baseQuery, params),
        db.get(countQuery, countParams)
    ]);
    
    const total = countResult.total;

    return {
        data: emails,
        pagination: {
            total: total,
            page: page,
            limit: limit,
            pages: Math.ceil(total / limit)
        }
    };
  } catch (err) {
      console.error('Failed to get emails:', err);
      throw err;
  }
}

/**
 * Retrieves a single email by its ID.
 * @param {number} id - The ID of the email.
 */
async function getEmailById(id) {
  if (!db) await initDatabase();
  try {
    return await db.get('SELECT * FROM emails WHERE id = ?', [id]);
  } catch (err) {
    console.error(`Failed to get email by ID ${id}:`, err);
    throw err;
  }
}

/**
 * Retrieves the distinct user and folder structure from the database.
 * @returns {object} An object where keys are users and values are arrays of folders.
 */
async function getFolderStructure() {
  if (!db) await initDatabase();
  try {
    const rows = await db.all('SELECT DISTINCT user, folder FROM emails ORDER BY user COLLATE NOCASE, folder COLLATE NOCASE');
    
    const structure = {};
    rows.forEach(row => {
      if (!structure[row.user]) {
        structure[row.user] = [];
      }
      // Avoid adding duplicate folders if data somehow has variations (e.g., case)
      if (!structure[row.user].includes(row.folder)) {
          structure[row.user].push(row.folder);
      }
    });
    
    return structure;
  } catch (err) {
    console.error('Failed to get folder structure:', err);
    throw err;
  }
}

// Initialize the database when the module is loaded.
// We wrap this in a self-executing async function to handle potential errors
// during the initial connection without crashing immediately if not awaited elsewhere.
(async () => {
  try {
    await initDatabase();
  } catch (err) {
    console.error('Critical error during initial database setup. Exiting.', err);
    process.exit(1); // Exit if DB initialization fails critically on startup
  }
})();

module.exports = {
  initDatabase, // Exporting init might be useful for explicit calls if needed
  clearEmails,
  insertEmail,
  getEmails,
  getEmailById,
  getFolderStructure,
};