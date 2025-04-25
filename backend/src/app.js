const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { simpleParser } = require('mailparser');
const db = require('./db');
const basicAuth = require('express-basic-auth'); // Import basic-auth
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy headers if running behind one (like Nginx, Heroku, etc.)
// This is important for getting the correct client IP address
app.set('trust proxy', 1); // Adjust the number based on your proxy setup depth

app.use(cors()); // Consider configuring origin for production
app.use(express.json());

// --- Basic Authentication Setup ---
// IMPORTANT: Replace 'admin' and 'password' with your desired credentials
// Consider using environment variables for these
// const users = { 'admin': 'password' }; // Simple hardcoded user

// app.use(basicAuth({
//     users: users,
//     challenge: true, // Sends the WWW-Authenticate header to prompt the browser
//     unauthorizedResponse: (req) => {
//         const clientIp = req.ip || req.socket.remoteAddress; // Get client IP
//         const logMessage = req.auth
//             ? `Credentials ${req.auth.user}:${req.auth.password} rejected`
//             : 'No credentials provided';
//         console.warn(`[AUTH] Unauthorized attempt from IP: ${clientIp} - ${logMessage}`); // Log unauthorized attempt with IP
//         return logMessage;
//     }
// }));
// --- End Basic Authentication Setup ---


// --- Enhanced Logging Middleware ---
// Place logging *after* auth so unauthorized attempts are still logged, but successful ones include user
app.use((req, res, next) => {
  const start = Date.now();
  const clientIp = req.ip || req.socket.remoteAddress; // Get client IP

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Log user if auth was successful
    const user = req.auth ? req.auth.user : 'anonymous';
    // Include IP address in the log
    console.log(`[API] ${req.method} ${req.originalUrl} - IP: ${clientIp} - User: ${user} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});
// --- End Logging Middleware ---


// --- API Routes ---

// Route to scan folders and index emails
app.post('/api/scan', async (req, res) => {
  const { rootDir } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress;
  console.log(`[API /api/scan] Request received from IP: ${clientIp} with rootDir: ${rootDir}`); // Log IP

  try {
    // ... (rest of scan route) ...
    if (!rootDir) {
      console.warn('[API /api/scan] Bad Request: Root directory is required');
      return res.status(400).json({ error: 'Root directory is required' });
    }
    // ... (rest of validation and scan logic) ...
    console.log(`[SCAN] Starting scan for directory: ${rootDir}`);
    const scanStats = await scanAndIndexEmails(rootDir);
    console.log('[SCAN] Scan finished. Stats:', scanStats);
    res.json({ success: true, stats: scanStats });
  } catch (error) {
    console.error('[API /api/scan] Error during scan process:', error);
    res.status(500).json({ error: 'Failed to scan folders', details: error.message });
  }
});

// ... (scanAndIndexEmails function remains the same) ...

// Route to get emails with filtering and pagination
app.get('/api/emails', async (req, res) => {
  const { user, folder, search, page = 1, limit = 50 } = req.query;
  const clientIp = req.ip || req.socket.remoteAddress;
  // Log the search term explicitly here if provided
  const searchLog = search ? `Search: '${search}', ` : '';
  console.log(`[API /api/emails] Request received from IP: ${clientIp} - User: ${user}, Folder: ${folder}, ${searchLog}Page: ${page}, Limit: ${limit}`); // Log IP and search term

  try {
    // ... (validation logic) ...
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    if (isNaN(pageNum) || pageNum < 1) {
        console.warn('[API /api/emails] Bad Request: Invalid page number');
        return res.status(400).json({ error: 'Invalid page number' });
    }
     if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        console.warn('[API /api/emails] Bad Request: Invalid limit number');
        return res.status(400).json({ error: 'Invalid limit number (must be 1-100)' });
    }

    const result = await db.getEmails({
        user: user || null,
        folder: folder || null,
        search: search || null,
        page: pageNum,
        limit: limitNum
    });
    console.log(`[API /api/emails] Found ${result.data.length} emails (Total: ${result.pagination.total}) for request from IP: ${clientIp}`); // Log result count with IP
    res.json(result);
  } catch (error) {
    console.error(`[API /api/emails] Error fetching emails for IP: ${clientIp}:`, error); // Log error with IP
    res.status(500).json({ error: 'Failed to fetch emails', details: error.message });
  }
});

// Route to get a specific email by ID
app.get('/api/emails/:id', async (req, res) => {
    const { id } = req.params;
    const clientIp = req.ip || req.socket.remoteAddress;
    console.log(`[API /api/emails/:id] Request received from IP: ${clientIp} for ID: ${id}`); // Log IP

    try {
        const emailId = parseInt(id, 10);
        if (isNaN(emailId)) {
            console.warn(`[API /api/emails/:id] Bad Request from IP: ${clientIp}: Invalid email ID: ${id}`);
            return res.status(400).json({ error: 'Invalid email ID' });
        }
        const email = await db.getEmailById(emailId);
        if (email) {
            console.log(`[API /api/emails/:id] Found email with ID: ${id} for IP: ${clientIp}`); // Log success with IP
            res.json(email);
        } else {
            console.log(`[API /api/emails/:id] Email not found with ID: ${id} for IP: ${clientIp}`); // Log not found with IP
            res.status(404).json({ error: 'Email not found' });
        }
    } catch (error) {
        console.error(`[API /api/emails/:id] Error fetching email ${id} for IP: ${clientIp}:`, error); // Log error with IP
        res.status(500).json({ error: 'Failed to fetch email', details: error.message });
    }
});


// Route to get distinct users and folders
app.get('/api/structure', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress;
    console.log(`[API /api/structure] Request received from IP: ${clientIp}`); // Log IP
    try {
        const structure = await db.getFolderStructure();
        console.log(`[API /api/structure] Found structure for ${Object.keys(structure).length} users for IP: ${clientIp}`); // Log result with IP
        res.json(structure);
    } catch (error) {
        console.error(`[API /api/structure] Error fetching folder structure for IP: ${clientIp}:`, error); // Log error with IP
        res.status(500).json({ error: 'Failed to fetch folder structure', details: error.message });
    }
});


// ... (scanAndIndexEmails function definition remains the same) ...

// Initialize server
app.listen(PORT, () => {
  console.log(`[SERVER] Server running on port ${PORT}`);
  console.log(`[SERVER] Database file expected at: ${path.resolve('emails.db')}`); // Adjust if using volume path like /data/emails.db
  console.log(`[AUTH] Basic authentication enabled. Use user 'admin' (or your chosen user).`);
});