const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File paths
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure necessary files and folders exist on startup
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ dropdowns: {} }, null, 2));
}

// API Routes
app.get('/api/assets', (req, res) => {
    res.json([]); // Returns empty array as default fallback
});

app.get('/api/settings', (req, res) => {
    try {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        res.json({ dropdowns: {} });
    }
});

const SITE_PASSWORD = process.env.SITE_PASSWORD || "Admin123";
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === SITE_PASSWORD) {
        return res.json({ success: true, message: "Authenticated successfully" });
    }
    return res.status(401).json({ success: false, message: "Incorrect Password" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});