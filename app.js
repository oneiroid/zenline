const express = require('express');
const fs = require('fs');
const path = require('path');
const { scanImages, serializeGroups } = require('./lib/grouping');

const app = express();
const port = 3000;
const imgDir = path.join(__dirname, 'public', 'imgs');
const outputPath = path.join(__dirname, 'public', 'data', 'images.json');

// Auto-regenerate static JSON on startup so dev always has fresh data
try {
    const groups = scanImages(imgDir);
    fs.writeFileSync(outputPath, JSON.stringify(serializeGroups(groups), null, 2));
    console.log(`Generated ${outputPath} (${groups.length} groups)`);
} catch (error) {
    console.error('Warning: could not regenerate images.json:', error.message);
}

// Serve static files
app.use(express.static('public'));

app.listen(port, () => {
    console.log(`Gallery app listening at http://localhost:${port}`);
});
