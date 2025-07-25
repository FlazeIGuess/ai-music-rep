// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const app = express();
const port = process.env.PORT || 8888;

// --- Database Connection Pool ---
// Dynamically configure for either socketPath (production) or host/port (local/docker)
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

if (process.env.DB_SOCKET_PATH) {
    dbConfig.socketPath = process.env.DB_SOCKET_PATH;
} else {
    dbConfig.host = process.env.DB_HOST || '127.0.0.1';
    dbConfig.port = process.env.DB_PORT || 3306;
}

const pool = mysql.createPool(dbConfig);


// --- Middleware ---
const corsOptions = {
    origin: process.env.FRONTEND_URL

};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public')); // Serve static files from the 'public' directory

function authenticateToken(req, res, next) {
    const token = (req.headers.authorization || '').split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- API Routes ---
const router = express.Router();

// GET /artists
router.get('/artists', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, spotify_id FROM artists');
        res.json({ artists: rows });
    } catch (err) {
        console.error('❌ Error reading artists from MySQL:', err);
        res.status(500).json({ message: 'Error loading artist list.' });
    }
});

// GET /daily-song
router.get('/daily-song', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM daily_song WHERE id = 1');
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Song of the day has not been selected yet.' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('❌ Error reading daily song from MySQL:', err);
        res.status(500).json({ message: 'Error loading song of the day.' });
    }
});

// POST /submit
router.post('/submit', async (req, res) => {
    try {
        const { artistName, spotifyLink } = req.body;
        if (!artistName || !spotifyLink) {
            return res.status(400).json({ message: 'Artist name and Spotify link are required.' });
        }
        const match = spotifyLink.match(/artist\/([a-zA-Z0-9]+)/);
        if (!match) {
            return res.status(400).json({ message: 'Invalid Spotify artist link.' });
        }
        const spotify_id = match[1];

        const [result] = await pool.query(
            'INSERT INTO submissions (name, spotify_id, status) VALUES (?, ?, ?)',
            [artistName, spotify_id, 'pending']
        );
        const [newSubmission] = await pool.query('SELECT * FROM submissions WHERE id = ?', [result.insertId]);

        res.status(201).json({ message: 'Submission received successfully!', submission: newSubmission[0] });
    } catch (err) {
        console.error('❌ Error processing submission with MySQL:', err);
        res.status(500).json({ message: 'Error processing submission.' });
    }
});

// POST /admin/login (No DB interaction, remains the same)
router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    res.status(401).json({ message: 'Invalid credentials' });
});

// GET /submissions (for admin panel)
router.get('/submissions', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
        res.json({ submissions: rows });
    } catch (err) {
        console.error('❌ Error reading submissions from MySQL:', err);
        res.status(500).json({ message: 'Error loading submissions.' });
    }
});

// POST /submissions/manage
router.post('/submissions/manage', authenticateToken, async (req, res) => {
    const { submissionId, action } = req.body;
    if (!submissionId || !action) {
        return res.status(400).json({ message: 'Submission ID and action are required.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query('SELECT * FROM submissions WHERE id = ?', [submissionId]);
        const submission = rows[0];

        if (!submission) {
            await connection.rollback();
            return res.status(404).json({ message: 'Submission not found.' });
        }

        if (action === 'approve') {
            await connection.query(
                'INSERT IGNORE INTO artists (name, spotify_id) VALUES (?, ?)',
                [submission.name, submission.spotify_id]
            );
        }

        await connection.query('DELETE FROM submissions WHERE id = ?', [submissionId]);
        await connection.commit();

        res.json({ message: `Submission ${submissionId} ${action}d.` });
    } catch (err) {
        await connection.rollback();
        console.error('❌ Error managing submission with MySQL:', err);
        res.status(500).json({ message: 'Error managing submission.' });
    } finally {
        connection.release();
    }
});

// DELETE /artists/:id
router.delete('/artists/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM artists WHERE id = ?', [id]);
        res.status(200).json({ message: `Artist ${id} deleted successfully.` });
    } catch (err) {
        console.error('❌ Error deleting artist:', err);
        res.status(500).json({ message: 'Error deleting artist.' });
    }
});

app.use('/api', router);

// --- Scheduled Task Logic (migrated from select-daily-song.js) ---
async function getSpotifyAccessToken() {
    const basicAuth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', process.env.SPOTIFY_REFRESH_TOKEN);

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    if (!response.ok) throw new Error('Spotify token refresh failed');
    const data = await response.json();
    return data.access_token;
}

async function selectAndStoreDailySong() {
    console.log("Running daily song selection...");
    const PLAYLIST_NAMES = ['4.0', '4.5', '5.0'];
    try {
        const accessToken = await getSpotifyAccessToken();
        const playlistsResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!playlistsResponse.ok) throw new Error("Failed to fetch user's playlists.");
        const playlistsData = await playlistsResponse.json();
        const targetPlaylists = playlistsData.items.filter(p => PLAYLIST_NAMES.includes(p.name));
        if (targetPlaylists.length === 0) throw new Error(`No playlists found with names: ${PLAYLIST_NAMES.join(', ')}`);

        let allTracks = [];
        for (const id of targetPlaylists.map(p => p.id)) {
            let url = `https://api.spotify.com/v1/playlists/${id}/tracks`;
            while (url) {
                const response = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (!response.ok) { url = null; continue; }
                const data = await response.json();
                allTracks.push(...data.items.filter(item => item.track && item.track.id));
                url = data.next;
            }
        }
        if (allTracks.length === 0) throw new Error("No tracks found in target playlists.");

        const randomTrack = allTracks[Math.floor(Math.random() * allTracks.length)].track;
        const songData = {
            song_name: randomTrack.name,
            artist_name: randomTrack.artists.map(a => a.name).join(', '),
            spotify_url: randomTrack.external_urls.spotify,
            image_url: randomTrack.album.images[0]?.url || null
        };

        await pool.query(
            `INSERT INTO daily_song (id, song_name, artist_name, spotify_url, image_url) 
             VALUES (1, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE 
             song_name = VALUES(song_name), artist_name = VALUES(artist_name), 
             spotify_url = VALUES(spotify_url), image_url = VALUES(image_url)`,
            [songData.song_name, songData.artist_name, songData.spotify_url, songData.image_url]
        );
        console.log(`✅ Successfully updated Song of the Day: ${songData.song_name}`);
    } catch (error) {
        console.error("❌ Error in daily song selection:", error);
    }
}

// Route to manually trigger the daily song selection (for cron jobs)
app.post('/run-daily-song-selection', (req, res) => {
    // Optional: Add a secret key check for security
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
        return res.status(401).send('Unauthorized');
    }
    selectAndStoreDailySong();
    res.status(202).send('Daily song selection process started.');
});


// --- Start Server ---
async function startServer() {
    try {
        // Test the database connection
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully!');
        connection.release();

        // Start the server if the connection is successful
        app.listen(port, () => {
            console.log(`🚀 Server listening at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('❌ Could not connect to the database.', error);
        process.exit(1); // Exit the process with an error code
    }
}

startServer();
