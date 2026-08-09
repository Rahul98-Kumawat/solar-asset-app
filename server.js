const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// File paths
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const ASSETS_FILE = path.join(__dirname, 'assets.json');

// Ensure necessary files and folders exist on startup
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ dropdowns: {} }, null, 2));
}

// API Routes
app.get('/api/assets', (req, res) => {
    try {
        if (fs.existsSync(ASSETS_FILE)) {
            const data = fs.readFileSync(ASSETS_FILE, 'utf8');
            return res.json(JSON.parse(data || '[]'));
        }
        res.json([]);
    } catch (err) {
        console.error("Error reading assets.json:", err);
        res.status(500).json({ error: "Failed to read assets file" });
    }
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

// Endpoint to handle Excel/CSV uploads
app.post('/api/upload', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    try {
        const workbook = xlsx.read(req.body, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Map Excel columns to match asset structure
        const formattedAssets = rawRows.map((row, index) => ({
            id: row['ID'] || row['id'] || index + 1,
            location: row['Location'] || row['location'] || '-',
            block: row['Block'] || row['block'] || '-',
            equipmentName: row['Equipment'] || row['Equipment Name'] || row['equipmentName'] || '-',
            subEquipmentName: row['Sub-Equipment'] || row['subEquipmentName'] || '-',
            make: row['Make'] || row['make'] || '-',
            qty: row['Qty'] || row['Quantity'] || row['qty'] || 1,
            capacity: row['Capacity'] || row['capacity'] || '-'
        }));

        // Write updated assets to assets.json
        fs.writeFileSync(ASSETS_FILE, JSON.stringify(formattedAssets, null, 2));
        return res.json({ success: true, count: formattedAssets.length, data: formattedAssets });
    } catch (err) {
        console.error('Error processing Excel file:', err);
        return res.status(500).json({ error: 'Failed to process Excel file' });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});