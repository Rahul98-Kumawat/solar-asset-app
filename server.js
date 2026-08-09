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

const ASSETS_FILE = path.join(__dirname, 'assets.json');

// Get all assets
app.get('/api/assets', (req, res) => {
    try {
        if (fs.existsSync(ASSETS_FILE)) {
            const data = fs.readFileSync(ASSETS_FILE, 'utf8');
            return res.json(JSON.parse(data || '[]'));
        }
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: "Failed to read assets" });
    }
});

// Excel upload endpoint
app.post('/api/upload', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    try {
        const workbook = xlsx.read(req.body, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!rawRows || rawRows.length === 0) {
            return res.status(400).json({ error: "Excel file is empty" });
        }

        // Map any Excel columns dynamically
        const formattedAssets = rawRows.map((row, index) => {
            const keys = Object.keys(row);
            const getVal = (terms) => {
                const k = keys.find(key => terms.some(t => key.toLowerCase().includes(t)));
                return k ? row[k] : '-';
            };

            return {
                id: getVal(['id', 'sno', 'sr']) !== '-' ? getVal(['id', 'sno', 'sr']) : index + 1,
                location: getVal(['location', 'site', 'plant']),
                block: getVal(['block', 'area', 'zone']),
                equipmentName: getVal(['equipment', 'item', 'eqp']),
                subEquipmentName: getVal(['sub', 'smb']),
                make: getVal(['make', 'brand', 'vendor']),
                qty: getVal(['qty', 'quantity', 'nos']) !== '-' ? getVal(['qty', 'quantity', 'nos']) : 1,
                capacity: getVal(['capacity', 'cap', 'kw', 'mw', 'wp'])
            };
        });

        fs.writeFileSync(ASSETS_FILE, JSON.stringify(formattedAssets, null, 2));
        return res.json({ success: true, count: formattedAssets.length, data: formattedAssets });
    } catch (err) {
        console.error("Upload error:", err);
        return res.status(500).json({ error: "Failed to process Excel file" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});