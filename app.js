const express = require('express');
const fs = require('fs');
const path = require('path');
const { scanImages, serializeGroups } = require('./lib/grouping');

const app = express();
const port = 3000;
const publicDir = path.join(__dirname, 'public');
const imgDir = path.join(publicDir, 'imgs');
const outputPath = path.join(publicDir, 'data', 'images.json');

// Auto-regenerate static JSON on startup so dev always has fresh data
try {
    const groups = scanImages(imgDir);
    fs.writeFileSync(outputPath, JSON.stringify(serializeGroups(groups), null, 2));
    console.log(`Generated ${outputPath} (${groups.length} groups)`);
} catch (error) {
    console.error('Warning: could not regenerate images.json:', error.message);
}

// Serves the whole public tree:
//   /                -> public/index.html (device router)
//   /desktop/        -> public/desktop/index.html
//   /mobile/         -> public/mobile/index.html
//   /imgs/, /data/   -> shared assets used by both variants (absolute paths
//                       in the unbundled JS resolve here)
app.use(express.static(publicDir));

app.listen(port, () => {
    console.log(`Gallery app listening at http://localhost:${port}`);
});
