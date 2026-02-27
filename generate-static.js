const fs = require('fs');
const path = require('path');
const { scanImages, serializeGroups } = require('./lib/grouping');

const imgDir = path.join(__dirname, 'public', 'imgs');
const outputPath = path.join(__dirname, 'public', 'data', 'images.json');

try {
    const groups = scanImages(imgDir);
    fs.writeFileSync(outputPath, JSON.stringify(serializeGroups(groups), null, 2));
    console.log(`Successfully generated ${outputPath} (${groups.length} groups)`);
} catch (error) {
    console.error('Error generating static JSON:', error);
    process.exit(1);
}
