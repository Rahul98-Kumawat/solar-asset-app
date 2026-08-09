const express = require('express');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const EXCEL_FILE = path.join(__dirname, 'Asset Detail Software.xlsx');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure uploads folder exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage engine for Logo Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, 'logo' + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Default Application Settings
let appSettings = {
    appTitle: "Solar Plant Asset Management System",
    adminPassword: "AdminPassword123",
    logoUrl: ""
};

// Load persistent settings if available
if (fs.existsSync(SETTINGS_FILE)) {
    try {
        appSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    } catch (e) {
        console.error("Error loading settings.json", e);
    }
} else {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
}

// Authentication Middleware
const checkAuth = (req, res, next) => {
    const pass = req.headers['x-admin-password'];
    if (pass !== appSettings.adminPassword) {
        return res.status(401).json({ success: false, message: "Unauthorized: Invalid Admin Password" });
    }
    next();
};

// Read Excel Spreadsheet
function loadAssetData() {
    if (!fs.existsSync(EXCEL_FILE)) return [];
    const workbook = xlsx.readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    return rawData.map((item, index) => ({
        id: item.id || index + 1,
        location: (item['Location'] || 'PV Field').toString().trim(),
        block: item['Block'] !== undefined && item['Block'] !== '' ? item['Block'].toString().trim() : 'N/A',
        equipmentName: (item['Equipment Name'] || '').toString().trim(),
        subEquipmentName: (item['Sub Equipment Name'] || '-').toString().trim(),
        make: (item['Make'] || '-').toString().trim(),
        qty: item['Qty.'] !== undefined ? item['Qty.'] : 1,
        capacity: (item['Capacity/ Rating'] || '-').toString().trim(),
        serialNo: (item['Equipment Serial No.'] || '-').toString().trim(),
        ipAddress: (item['IP Address'] || '-').toString().trim(),
        ipForEquipment: (item['IP for Equipment'] || '-').toString().trim()
    }));
}

// Write Excel Spreadsheet
function saveAssetData(data) {
    const formattedData = data.map(item => ({
        'Location': item.location,
        'Block': item.block === 'N/A' ? '' : isNaN(item.block) ? item.block : Number(item.block),
        'Equipment Name': item.equipmentName,
        'Sub Equipment Name': item.subEquipmentName === '-' ? '' : item.subEquipmentName,
        'Make': item.make === '-' ? '' : item.make,
        'Qty.': Number(item.qty) || 1,
        'Capacity/ Rating': item.capacity === '-' ? '' : item.capacity,
        'Equipment Serial No.': item.serialNo === '-' ? '' : item.serialNo,
        'IP Address': item.ipAddress === '-' ? '' : item.ipAddress,
        'IP for Equipment': item.ipForEquipment === '-' ? '' : item.ipForEquipment
    }));

    const worksheet = xlsx.utils.json_to_sheet(formattedData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    xlsx.writeFile(workbook, EXCEL_FILE);
}

// API Routes
app.get('/api/settings', (req, res) => res.json(appSettings));

app.post('/api/settings', checkAuth, (req, res) => {
    if (req.body.appTitle) appSettings.appTitle = req.body.appTitle;
    if (req.body.newPassword) appSettings.adminPassword = req.body.newPassword;
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
    res.json({ success: true, settings: appSettings });
});

app.post('/api/upload-logo', checkAuth, upload.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No logo uploaded" });
    appSettings.logoUrl = '/uploads/' + req.file.filename + '?v=' + Date.now();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2));
    res.json({ success: true, logoUrl: appSettings.logoUrl });
});

app.get('/api/assets', (req, res) => {
    const data = loadAssetData();
    res.json({ success: true, count: data.length, data });
});

// Anyone can ADD material
app.post('/api/assets/add', (req, res) => {
    try {
        let assets = loadAssetData();
        const newItem = req.body;
        newItem.id = Date.now();
        assets.push(newItem);
        saveAssetData(assets);
        res.json({ success: true, message: "New material added successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// EDIT material (Password Protected)
app.post('/api/assets/edit', checkAuth, (req, res) => {
    try {
        let assets = loadAssetData();
        const updatedItem = req.body;
        const idx = assets.findIndex(a => String(a.id) === String(updatedItem.id));
        if (idx !== -1) {
            assets[idx] = { ...assets[idx], ...updatedItem };
            saveAssetData(assets);
            res.json({ success: true, message: "Material updated successfully!" });
        } else {
            res.status(404).json({ success: false, message: "Item not found" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE material (Password Protected)
app.post('/api/assets/delete', checkAuth, (req, res) => {
    try {
        let assets = loadAssetData();
        const { id } = req.body;
        assets = assets.filter(a => String(a.id) !== String(id));
        saveAssetData(assets);
        res.json({ success: true, message: "Material deleted successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Download updated Excel spreadsheet
app.get('/api/assets/download', (req, res) => {
    res.download(EXCEL_FILE, 'Asset_Detail_Software_Export.xlsx');
});

// Start Express Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://localhost:${PORT}`);
});